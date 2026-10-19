// 每日题库与多题型判分（考试 v2）。
// 经典考核每场从"当日题库"随机抽 4 题：当日题库由日期种子确定（同一天重考换题不换库，
// 第二天自动换库），题目来自 93 题扩充池 + 27 个参数化题位（带 3D 演示）。
import {POOL,KNOWLEDGE_POINTS,KP_GATES} from './question_bank_data.js';
import {questions,shuffledQuestion} from './exam_data.js';
import {random,shuffle} from './adventure_data.js';
import {runExamCode} from './exam_py.js';

const ATTEMPT_SIZE=4;           // 每场考核题数
const DAILY_PER_TYPE=3;         // 当日题库每种题型的数量
const hashStr=s=>[...s].reduce((h,ch)=>(h*31+ch.charCodeAt(0))>>>0,7);
export const todayKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

// 参数化题位（exam_data）挂靠的知识点标签：供统计与均匀覆盖使用。
const MODEL_KP={run:'div',group:'floor',branch:'pow',cards:'len',bars:'avg',rank:'maxmin',loop:'while3'};

// 填空判分：忽略所有空白、全角转半角、统一小写后精确匹配 accept 列表。
export function normalizeAnswer(text){
  return String(text??'').replace(/[\uff01-\uff5e]/g,ch=>String.fromCharCode(ch.charCodeAt(0)-0xfee0))
    .replace(/\s+/g,'').toLowerCase();
}
export const blankOk=(q,text)=>{
  const norm=normalizeAnswer(text);
  // 表达式空位（如 i += ___、range(1, ___)）：整句赋值填进去会拼出非法语法，直接拒绝（E04）。
  if(q.exprSlot&&norm.includes('='))return false;
  return (q.accept||[q.answer]).map(normalizeAnswer).includes(norm);
};
// 编程题判分：逐行去首尾空白、去空行后整段比对。
export const normalizeOutput=out=>String(out??'').split('\n').map(l=>l.trim()).filter(Boolean).join('\n');
export const outputMatches=(out,expect)=>normalizeOutput(out)===normalizeOutput(expect);

export function dailySet(lv,tier=1,dateKey=todayKey(),done=null){
  if(![1,2,3].includes(lv)||![1,2,3].includes(tier))throw Error('无效题组');
  const rng=random(hashStr(`campus-exam|${dateKey}|${lv}|${tier}`));
  const byKp=new Map();
  for(const q of POOL){
    if(q.lv!==lv)continue;
    if(done&&KP_GATES[q.kp]&&!done.has(KP_GATES[q.kp]))continue;  // 未学到教学教室的知识点先不进当日题库
    if(!byKp.has(q.kp))byKp.set(q.kp,[]);
    byKp.get(q.kp).push(q);
  }
  const kpOrder=shuffle([...byKp.keys()],rng);
  // 知识点内先洗牌，再按"难度贴近所选档位"稳定排序：同一天同档结果完全确定。
  const byType={choice:[],tf:[],blank:[],code:[]};
  for(const kp of kpOrder){
    const group=shuffle(byKp.get(kp),rng).sort((a,b)=>Math.abs(a.dif-tier)-Math.abs(b.dif-tier));
    for(const q of group)byType[q.type].push(q);
  }
  // 知识点轮转后每种题型取 3 题：全天 12 题、四种题型齐、知识点覆盖均匀。
  const daily=[];
  for(const type of ['choice','tf','blank','code'])daily.push(...byType[type].slice(0,DAILY_PER_TYPE));
  return daily;
}

export function classicQuestions(lv,tier,result=null){
  return questions(lv,tier,result).map(q=>({...q,type:'choice',bank:'classic',kp:q.kp||MODEL_KP[q.model]||'mix'}));
}

// 每场抽题：1 道参数化题（带 3D 演示与个人实测数据）+ 3 道当日题库题（题型互不相同）。
export function drawAttempt(lv,tier,result=null,rng=Math.random,dateKey=todayKey(),done=null){
  const daily=dailySet(lv,tier,dateKey,done);
  const classic=classicQuestions(lv,tier,result).map(q=>shuffledQuestion(q,rng));
  const picked=[{...classic[Math.floor(rng()*classic.length)]}];
  // 同代码去重守卫：参数化题抽中后，把题库里 normalize 后 code 相同的题从本场候选剔除，
  // 避免同一张卷出现两道一模一样代码的题（如 100 // 13 与 B121、-= 死循环与 B322）。
  const pickedCode=new Set(picked.map(q=>normalizeOutput(q.code)));
  const bankDaily=daily.filter(q=>!pickedCode.has(normalizeOutput(q.code)));
  const used=new Set(picked.map(q=>q.id));
  for(const type of shuffle(['choice','tf','blank','code'],rng)){
    if(picked.length>=ATTEMPT_SIZE)break;
    const candidates=bankDaily.filter(q=>q.type===type&&!used.has(q.id));
    if(!candidates.length)continue;
    const q=candidates[Math.floor(rng()*candidates.length)];
    used.add(q.id);
    picked.push(type==='choice'||type==='tf'?shuffledQuestion({...q},rng):{...q});
  }
  while(picked.length<ATTEMPT_SIZE){
    const candidates=bankDaily.filter(q=>!used.has(q.id));
    if(!candidates.length)break;
    const q=candidates[Math.floor(rng()*candidates.length)];
    used.add(q.id);picked.push({...q});
  }
  return {questions:shuffle(picked,rng),dailyKey:dateKey};
}

// ---- v2 作答与判分：首答计分，纠正不改分。----
export function answerFirst(a,index,payload){
  const q=a?.questions?.[index];
  if(!q||a.answers[index])return false;
  if(q.type==='blank'){
    if(typeof payload!=='string'||!payload.trim())return false;
    a.answers[index]={kind:'blank',first:payload};
  }else if(q.type==='code'){
    if(!payload||typeof payload.code!=='string'||!payload.code.trim())return false;
    a.answers[index]={kind:'code',first:{code:payload.code,out:String(payload.out??''),ok:payload.ok===true,pass:payload.pass===true}};
  }else{
    if(!Number.isInteger(payload)||payload<0||payload>=q.opts.length)return false;
    a.answers[index]={kind:'choice',first:payload};
  }
  return true;
}
export function correctAttempt(a,index,payload){
  const q=a?.questions?.[index],ans=a?.answers?.[index];
  if(!q||!ans||ans.corrected)return false;
  const qt=q.type||'choice';
  if(qt==='blank'&&typeof payload==='string'&&blankOk(q,payload)){ans.corrected=true;return true;}
  if(qt==='code'&&payload?.pass===true){ans.corrected=true;return true;}
  if((qt==='choice'||qt==='tf')&&Number.isInteger(payload)&&payload===q.a){ans.corrected=true;return true;}
  return false;
}
export const isCorrect=(q,ans)=>{
  if(!ans)return false;
  const qt=q.type||'choice';
  if(qt==='blank')return blankOk(q,ans.first);
  if(qt==='code')return ans.first?.pass===true;
  return ans.first===q.a;
};
export function gradeAttemptV2(a){return (a?.questions||[]).reduce((n,q,i)=>n+(isCorrect(q,a.answers?.[i])?1:0),0);}

// ---- 编程题加固判分（E03）：变式数据 + 方法执行证据。----
// 取 starter 开头连续的变量赋值行：变式运行时把它们替换成另一组数据，
// 直接打印原题答案的代码换数据后就会暴露。
// 赋值行按「变量名 + 去空白右值」识别：学生只改空格风格（distance=50）也算同一行（R01）。
export function parseAssignLine(line){
  const m=String(line).match(/^(\s*)([A-Za-z_]\w*)\s*=(=?)\s*(.+?)\s*$/);
  if(!m||m[3])return null; // == 是比较不是赋值
  return {name:m[2],rhs:m[4].replace(/\s+/g,'')};
}
export function starterVarLines(starter){
  const out=[];
  for(const line of String(starter).split('\n')){
    if(parseAssignLine(line)){out.push(line);continue;}
    if(!line.trim())continue;
    break;
  }
  return out;
}
export function swapStarterVars(code,from,to){
  const fromP=from.map(parseAssignLine);
  const lines=String(code).split('\n');
  const used=new Set();
  const replaced=lines.map(l=>{
    const p=parseAssignLine(l);if(!p)return l;
    const i=fromP.findIndex((f,idx)=>f&&!used.has(idx)&&f.name===p.name&&f.rhs===p.rhs);
    if(i<0)return l;
    used.add(i);return to[i]??l; // 按变量对应位置替换，学生调整行序也不会张冠李戴
  });
  if(used.size<fromP.length)return [...to,...lines].join('\n'); // 学生删/改了数据行：前置变式数据，硬编码即暴露
  return replaced.join('\n');
}
const METHOD_NAMES={While:'while 循环',For:'for 循环',Div:'/（除法）',FloorDiv:'//（整除）',Mod:'%（取余）',Pow:'**（乘方）',Add:'+（加法）',GtE:'>=（大于等于）',And:'and（并且）',sum:'sum 函数',len:'len 函数',max:'max 函数',min:'min 函数',range:'range 函数',round:'round 函数',print:'print 输出'};
export async function gradeExamCode(q,code,run=runExamCode){
  const runs=[{code:String(code),expect:q.expect,variant:false}];
  const vars=starterVarLines(q.starter);
  for(const c of q.cases||[])runs.push({code:vars.length?swapStarterVars(code,vars,String(c.pre).split('\n')):String(code),expect:c.expect,variant:true});
  let first=null;
  for(const r of runs){
    const res=await run(r.code);
    if(!r.variant)first=res;
    if(!res.ok)return {pass:false,ok:false,error:res.err||'运行失败'};
    if(!outputMatches(res.out,r.expect)){
      if(r.variant)return {pass:false,ok:true,out:first?.out||'',reason:'variant',message:`换一组数据后结果不对（应输出 ${String(r.expect).split('\n').join(' / ')}）。固定打印原题答案过不了这一关——要用题目给的变量来算。`};
      return {pass:false,ok:true,out:res.out,reason:'output'};
    }
  }
  const ev=first?.process?.exec;
  if(q.require){
    const banned=(q.require.bannedCalls||[]).filter(x=>ev?.calls?.includes(x));
    if(banned.length)return {pass:false,ok:true,out:first?.out||'',reason:'banned',message:`题目要求不使用 ${banned.map(x=>METHOD_NAMES[x]||x).join('、')}，请按题目指定的方法完成。`};
    const missing=[
      ...(q.require.kinds||[]).filter(x=>!ev?.kinds?.includes(x)).map(x=>METHOD_NAMES[x]||x),
      ...(q.require.calls||[]).filter(x=>!ev?.calls?.includes(x)).map(x=>METHOD_NAMES[x]||x),
      ...(q.require.ops||[]).filter(x=>!ev?.ops?.includes(x)).map(x=>METHOD_NAMES[x]||x),
      ...(q.require.literal&&!ev?.literal?['列表 [ ]']:[]),
    ];
    if(missing.length)return {pass:false,ok:true,out:first?.out||'',reason:'method',message:`输出对了，但这次的代码没有真正用到题目要求的方法（${missing.join('、')}）。只打印预先算好的答案不算掌握；首答按未通过记录，可看参考解答后再练。`};
    // 循环步长核验（R02）：出现 while 和加法不等于每轮按题意累加；一次 +10 冒充每轮 +5 要能拦下。
    const stepRule=q.require.whileStep;
    if(Number.isFinite(stepRule)){
      const steps=first?.process?.steps;
      if(steps&&typeof steps==='object'){ // 过程记录被截断/缺失时不据此拦截
        const moved=Object.entries(steps).filter(([,deltas])=>deltas.length);
        const ok=moved.some(([,deltas])=>deltas.every(d=>Math.abs(d-stepRule)<1e-9));
        if(!ok)return {pass:false,ok:true,out:first?.out||'',reason:'step',message:`输出对了，但循环不是每轮加 ${stepRule}：观测到的变量变化是 ${moved.map(([n,d])=>`${n} `+d.map(x=>x>0?'+'+x:String(x)).join('、')).join('；')}。请让循环体每轮累加 ${stepRule}，不要把几轮并成一次加。`};
      }
    }
  }
  return {pass:true,ok:true,out:first?.out||''};
}

// 冒险模式"信号台"的扩充题源：仅选择题（信号台的选项/判断转换依赖 opts/a 结构）。
export const poolChoices=(lv,done=null)=>POOL.filter(q=>q.lv===lv&&q.type==='choice'&&!(done&&KP_GATES[q.kp]&&!done.has(KP_GATES[q.kp])));

export function validQuestionV2(q){
  if(!q||typeof q.title!=='string'||typeof q.ex!=='string')return false;
  const qt=q.type||'choice';
  if(qt==='blank')return typeof q.answer==='string'&&Array.isArray(q.accept)&&q.accept.length>0&&q.accept.every(s=>typeof s==='string');
  if(qt==='code')return typeof q.starter==='string'&&typeof q.solve==='string'&&typeof q.expect==='string';
  return Array.isArray(q.opts)&&q.opts.length>=2&&q.opts.every(s=>typeof s==='string')&&new Set(q.opts).size===q.opts.length&&Number.isInteger(q.a)&&q.a>=0&&q.a<q.opts.length;
}
export function validAttemptV2(a){
  if(a?.version===1){
    return Array.isArray(a.questions)&&a.questions.length===3&&a.questions.every(q=>validQuestionV2(q)&&Array.isArray(q.opts)&&q.opts.every(s=>typeof s==='string')&&Number.isInteger(q.a)&&q.a>=0&&q.a<q.opts.length&&q.values)&&Array.isArray(a.answers)&&a.answers.length<=3&&a.answers.every((v,i)=>!v||(Number.isInteger(v.first)&&v.first>=0&&v.first<a.questions[i]?.opts.length))&&Number.isInteger(a.index)&&a.index>=0&&a.index<3;
  }
  if(a?.version!==2)return false;
  return Array.isArray(a.questions)&&a.questions.length===ATTEMPT_SIZE&&a.questions.every(validQuestionV2)
    &&Array.isArray(a.answers)&&a.answers.length<=ATTEMPT_SIZE&&a.answers.every((v,i)=>!v||((v.kind==='choice'&&Number.isInteger(v.first)&&v.first>=0&&v.first<a.questions[i].opts.length)||(v.kind==='blank'&&typeof v.first==='string')||(v.kind==='code'&&v.first&&typeof v.first.code==='string')))
    &&Number.isInteger(a.index)&&a.index>=0&&a.index<ATTEMPT_SIZE&&typeof a.dailyKey==='string';
}

export {POOL,KNOWLEDGE_POINTS,ATTEMPT_SIZE};
