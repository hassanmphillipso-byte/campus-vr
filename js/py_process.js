/* Runtime lesson evidence. AST describes a statement; Skulpt snapshots prove it ran.
 * This intentionally recognises the introductory lesson forms, not arbitrary Python.
 * Trace lines are 1-based student-code lines; preamble/suffix are never replayed as code.
 */
function createPythonProcessRecorder(Sk, full, first, last) {
  const parsed = Sk.parse('student', full);
  const tree = Sk.astFromParse(parsed.cst, 'student', parsed.flags);
  const sites = new Map(), actionEntries = new Map(), scopes = new WeakMap();
  const pending = new Map(), sources = new Map(), actions = [], reached = [], iterations = new Map();
  const trace = {version: 1, events: [], truncated: false};
  const process = {floor: false, whileJump: false, whileJumpEmpty: false, whileScores: false, forTrain: false, forTrainEmpty: false};
  // Exam method evidence: constructs proven by execution, never by text search.
  const exec = {kinds: new Set(), calls: new Set(), ops: new Set(), literal: false};
  const EXCLUDED_STATEMENTS = ['Assign','AugAssign','Expr','If','While','For','FunctionDef','Return','Break','Continue','Pass'];
  // 求三元条件值：常量布尔与快照可解的变量/表达式给出确定分支；解不出返回 undefined（退回双分支）。
  function literalTest(n, values, deps) {
    const k = kind(n);
    if (k === 'Num') return n.n.v;
    if (k === 'NameConstant' && n.value && typeof n.value.v !== 'undefined') return n.value.v; // True/False/None
    if (k === 'Name' && ['True','False','None'].includes(n.id.v)) return {True:true,False:false,None:null}[n.id.v];
    return expression(n, values, deps).value;
  }
  function walkExpr(n, values, deps) {
    const k = kind(n); if (!k) return;
    if (k === 'IfExp') { // 三元只把实际走到的分支计入方法证据（R03）：sum 在永不执行的分支里不算用过
      walkExpr(n.test, values, deps);
      const t = literalTest(n.test, values, deps);
      const branch = t === true || t === 1 ? n.body : t === false || t === 0 ? n.orelse : null;
      if (branch) walkExpr(branch, values, deps);
      else { walkExpr(n.body, values, deps); walkExpr(n.orelse, values, deps); }
      return;
    }
    if (k === 'Call') { const f = name(n.func); if (f) exec.calls.add(f); }
    if (['BinOp','BoolOp','UnaryOp'].includes(k)) exec.ops.add(kind(n.op));
    if (k === 'Compare') for (const op of n.ops) exec.ops.add(kind(op));
    if (k === 'List' || k === 'Tuple') exec.literal = true;
    for (const val of Object.values(n)) {
      for (const c of Array.isArray(val) ? val : [val]) if (c && typeof c === 'object' && kind(c) && !EXCLUDED_STATEMENTS.includes(kind(c))) walkExpr(c, values, deps);
    }
  }
  function collectExec(node, values, deps) {
    const k = kind(node); exec.kinds.add(k);
    if (k === 'AugAssign') exec.ops.add(kind(node.op)); // += 的运算种类在语句节点上，不在子表达式里
    const parts = [];
    if (k === 'Expr') parts.push(node.value);
    else if (k === 'Assign') parts.push(node.value, ...(node.targets||[]));
    else if (k === 'AugAssign') parts.push(node.target, node.value);
    else if (k === 'Return') parts.push(node.value);
    else if (k === 'While') parts.push(node.test);
    else if (k === 'For') parts.push(node.iter);
    else if (k === 'If') parts.push(node.test);
    for (const p of parts) if (p && kind(p) && !EXCLUDED_STATEMENTS.includes(kind(p))) walkExpr(p, values, deps);
  }
  let serial = 0, lineage = 0, lastLine = 0, iteration = 0;
  const kind = n => n?._astname || n?.prototype?._astname;
  const name = n => kind(n) === 'Name' ? n.id.v : null;
  const key = n => `${n.lineno}:${n.col_offset}`;
  const inCode = n => n?.lineno >= first && n.lineno <= last;
  const children = n => Object.values(n || {}).flat().filter(v => v && typeof v === 'object' && kind(v));
  const has = (n, test) => !!n && (test(n) || children(n).some(c => has(c, test)));
  const hasCall = (n, id) => has(n, x => kind(x) === 'Call' && name(x.func) === id);
  function walk(n, loops = []) {
    if (!n || !kind(n)) return;
    if (Number.isInteger(n.lineno) && ['Assign','AugAssign','Expr','While','For','If','Return','Break','Continue','FunctionDef'].includes(kind(n))) sites.set(key(n), {node:n, loops});
    if (kind(n) === 'FunctionDef' && n.lineno < first && ['jump','train'].includes(n.name.v)) {
      actionEntries.set(key(n.body[0]), {name:n.name.v, parameter:n.args.args[0].arg.v});
    }
    for (const [prop, val] of Object.entries(n)) {
      const childLoops = ['While','For'].includes(kind(n)) && prop === 'body' ? [...loops,n] : kind(n) === 'FunctionDef' ? [] : loops;
      for (const c of Array.isArray(val) ? val : [val]) if (c && typeof c === 'object' && kind(c)) walk(c, childLoops);
    }
  }
  walk(tree);
  const add = event => {if (trace.events.length < 2048) trace.events.push(event); else trace.truncated = true;};
  function plain(v, depth = 0) {
    if (!v || depth > 2) return undefined;
    if (v === Sk.builtin.none.none$) return null;
    if (typeof v.v === 'number' || typeof v.v === 'boolean') return v.v;
    if (typeof v.v === 'string') return v.v.slice(0,160);
    if (Array.isArray(v.v)) return v.v.slice(0,128).map(x => plain(x, depth+1));
    return undefined;
  }
  function snapshot(frame) {
    const values = {};
    for (const [key,v] of Object.entries({...frame.$gbl,...frame.$loc,...Object.fromEntries(Object.entries(frame.$tmps||{}).filter(([key])=>!key.startsWith('$')))})) {
      if (key.startsWith('__')) continue;
      const p = plain(v); if (p !== undefined) values[key] = p;
      if (Object.keys(values).length >= 40) break;
    }
    return values;
  }
  function expression(n, values, deps) {
    const k = kind(n);
    if (k === 'Name') return {value:values[n.id.v], source:deps.get(n.id.v)};
    if (k === 'Num') return {value:n.n.v};
    if (k === 'UnaryOp') {const v=expression(n.operand,values,deps).value;return {value:kind(n.op)==='USub'?-v:v};}
    if (k === 'Subscript' && name(n.value) === 'scores') {
      const index=expression(n.slice.value || n.slice,values,deps).value;
      return {value:values.scores?.[index],source:{kind:'score',index}};
    }
    if (k === 'Call' && n.args.length === 1) {
      const arg=expression(n.args[0],values,deps),fn=name(n.func);
      if (fn === 'len' && Array.isArray(arg.value)) return {value:arg.value.length,source:name(n.args[0])==='scores'?{kind:'length'}:undefined};
      if (['float','int'].includes(fn) && typeof arg.value==='number') return {value:fn==='float'?arg.value:Math.trunc(arg.value),source:fn==='float'?arg.source:undefined};
    }
    if (k === 'BinOp') {
      const a=expression(n.left,values,deps),b=expression(n.right,values,deps),op=kind(n.op);
      const value=({Add:()=>a.value+b.value,Sub:()=>a.value-b.value,Mult:()=>a.value*b.value,Div:()=>a.value/b.value,FloorDiv:()=>Math.floor(a.value/b.value),Mod:()=>((a.value%b.value)+b.value)%b.value,Pow:()=>a.value**b.value})[op]?.();
      const source=op==='Div'&&a.source?.kind==='total'&&b.source?.kind==='length'?{...a.source,kind:'average'}:undefined;
      return {value,source};
    }
    return {};
  }
  const complete = (source, values) => source?.kind==='total' && source.indices.length===values.scores?.length && new Set(source.indices).size===values.scores.length && source.indices.every(i=>Number.isInteger(i)&&i>=0&&i<values.scores.length);
  function finishStatement(previous, after) {
    if (!previous) return;
    const {site,values,deps,line} = previous, n=site.node, k=kind(n);
    if (!['Assign','AugAssign'].includes(k)) return;
    const target=k==='AugAssign'?name(n.target):n.targets.length===1?name(n.targets[0]):null;
    if (!target) {
      // Accept observed zero seeds in tuple/list or chained initialisation. Every
      // other overwritten target loses provenance, including sum() assignments.
      const seeds=[];
      function zeroSeeds(assigned,value) {
        const id=name(assigned),rhs=expression(value,values,deps);
        if(id&&rhs.value===0&&(!rhs.source||rhs.source.kind==='seed')&&after[id]===0)seeds.push(id);
        else if(['Tuple','List'].includes(kind(assigned))&&['Tuple','List'].includes(kind(value))&&assigned.elts.length===value.elts.length)assigned.elts.forEach((item,i)=>zeroSeeds(item,value.elts[i]));
      }
      if(k==='Assign')for(const assigned of n.targets)zeroSeeds(assigned,n.value);
      for(const assigned of n.targets||[n.target])has(assigned,x=>{const id=name(x);if(id)deps.delete(id);return false;});
      for(const id of seeds)deps.set(id,{kind:'seed',value:0});
      return;
    }
    const rhs=expression(n.value,values,deps);
    let source=rhs.source, score=null;
    if (kind(site.loops.at(-1))==='While') {
      if (k==='AugAssign'&&kind(n.op)==='Add') score=rhs;
      if (k==='Assign'&&kind(n.value)==='BinOp'&&kind(n.value.op)==='Add') {
        if (name(n.value.left)===target) score=expression(n.value.right,values,deps);
        else if (name(n.value.right)===target) score=expression(n.value.left,values,deps);
      }
    }
    const old=deps.get(target);
    if (score?.source?.kind==='score' && ['seed','total'].includes(old?.kind) && typeof values[target]==='number' && values[target]===old.value && typeof score.value==='number' && after[target]===values[target]+score.value) {
      source={kind:'total',id:old.id||++lineage,indices:[...(old.indices||[]),score.source.index],value:after[target]};
      add({type:'accumulate',line,variable:target,index:score.source.index,value:score.value,before:values[target],after:after[target]});
    } else if (k==='AugAssign') source=undefined;
    // An actual assignment overwrites provenance, including a later sum(scores).
    if (k==='Assign' && rhs.value===0 && !source && after[target]===0) source={kind:'seed',value:0};
    if (source && (k==='AugAssign'||after[target]===rhs.value||source.kind==='total')) deps.set(target,source); else deps.delete(target);
  }
  function capture(suspension) {
    if(trace.truncated)return;
    const frames=[];for(let s=suspension;s;s=s.child)if(s.$loc&&s.$filename==='student.py')frames.push(s);
    const frame=frames.at(-1);if(!frame)return;
    const point={lineno:frame.$lineno,col_offset:frame.$colno},site=sites.get(key(point));
    if(!site)return;
    let scope=scopes.get(frame.$loc);if(!scope){scope=++serial;scopes.set(frame.$loc,scope);sources.set(scope,new Map());}
    const values=snapshot(frame),deps=sources.get(scope);
    finishStatement(pending.get(scope),values);pending.delete(scope);
    const entry=actionEntries.get(key(point));
    if(entry&&suspension.data.type==='Sk.debug') {
      const callers=frames.slice(0,-1).map(f=>({frame:f,site:sites.get(`${f.$lineno}:${f.$colno}`)})).filter(c=>c.site);
      const loops=callers.flatMap(c=>c.site.loops.map(loop=>({loop,scope:scopes.get(c.frame.$loc)}))),caller=callers.find(c=>inCode(c.site.node)),driver=loops.at(-1);
      const action={name:entry.name,value:values[entry.parameter],while:kind(driver?.loop)==='While',for:kind(driver?.loop)==='For',iteration:driver?iterations.get(`${driver.scope}:${key(driver.loop)}`):undefined};
      actions.push(action);add({type:'action',name:action.name,value:action.value,line:caller?caller.site.node.lineno-first+1:lastLine});
    }
    if(!inCode(site.node))return;
    collectExec(site.node,values,deps);
    const line=site.node.lineno-first+1;lastLine=line;
    if (suspension.data.type==='Sk.delay'&&['For','While'].includes(kind(site.node))) iterations.set(`${scope}:${key(site.node)}`,++iteration);
    add({type:suspension.data.type==='Sk.delay'?'loop':'statement',line,column:site.node.col_offset,values});
    if (['For','While'].includes(kind(site.node))) reached.push({node:site.node,values});
    // Only executed statement expressions count; a false branch cannot earn evidence.
    if (has(site.node,x=>kind(x)==='BinOp'&&kind(x.op)==='FloorDiv') && !['If','While','For','FunctionDef'].includes(kind(site.node))) process.floor=true;
    if (suspension.data.type==='Sk.debug') {
      const call=kind(site.node)==='Expr'&&site.node.value;
      if(kind(call)==='Call'&&name(call.func)==='print'&&call.args.length===3) {
        const a=expression(call.args[0],values,deps),b=expression(call.args[1],values,deps);
        if(complete(a.source,values)&&b.source?.kind==='average'&&a.source.id===b.source.id&&JSON.stringify(a.source.indices)===JSON.stringify(b.source.indices)) process.whileScores=true;
      }
      pending.set(scope,{site,values,deps,line});
    }
  }
  function finish(module) {
    const globals=module?.$d||{};
    const scope=scopes.get(globals);if(scope)finishStatement(pending.get(scope),snapshot({$loc:globals}));
    const acts=plain(globals.ACTS),jump=actions.filter(a=>a.name==='jump'),train=actions.filter(a=>a.name==='train');
    const exact=a=>Array.isArray(acts)&&JSON.stringify(a.map(x=>x.value))===JSON.stringify(acts);
    process.whileJump=jump.length>0&&jump.every(a=>a.while&&a.iteration!==undefined)&&new Set(jump.map(a=>a.iteration)).size===jump.length&&exact(jump);
    process.forTrain=train.length>0&&train.every(a=>a.for&&a.iteration!==undefined)&&new Set(train.map(a=>a.iteration)).size===train.length&&exact(train);
    process.whileJumpEmpty=jump.length===0&&exact(jump)&&reached.some(r=>kind(r.node)==='While'&&hasCall({body:r.node.body,_astname:'Body'},'jump')&&r.values.target===0);
    // A positive-count guard legitimately skips the whole for at count=0.
    // All nonzero test cases still require actual, distinct for-driven actions.
    const staticFor=[...sites.values()].some(site=>inCode(site.node)&&kind(site.loops.at(-1))==='For'&&kind(site.node)==='Expr'&&kind(site.node.value)==='Call'&&name(site.node.value.func)==='train');
    process.forTrainEmpty=train.length===0&&exact(train)&&plain(globals.count)===0&&staticFor;
    process.exec={kinds:[...exec.kinds],calls:[...exec.calls],ops:[...exec.ops],literal:exec.literal};
    // 数值变量在事件序列里的相邻变化量（连续重复去掉）：为「每轮加 N」类循环步长核验提供真实观测（R02）。
    const steps={},seen={};
    for(const e of trace.events){
      if(!e.values)continue;
      for(const [key,v] of Object.entries(e.values)){
        if(typeof v!=='number'||!Number.isFinite(v))continue;
        if(key in seen&&seen[key]!==v)(steps[key]??=[]).push(+(v-seen[key]).toFixed(6));
        seen[key]=v;
      }
    }
    for(const key of Object.keys(steps))if(steps[key].length>96)steps[key]=steps[key].slice(0,96);
    process.steps=steps;
    if(trace.truncated){trace.partial=true;trace.reason='trace-limit';for(const k of Object.keys(process))process[k]=false;}
    return {process,trace};
  }
  function fail(reason) {trace.partial=true;trace.reason=reason;for(const key of Object.keys(process))process[key]=false;return {process,trace};}
  return {capture,finish,fail,trace,output:text=>add({type:'output',line:lastLine,text})};
}
