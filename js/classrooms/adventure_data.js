import {questions} from './exam_data.js';

export const ADVENTURE_VERSION=1;
export const adventureKey=(lv,tier)=>`adventure:${lv}:${tier}`;
export function random(seed){let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
export function shuffle(items,rng){const out=items.slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
const integer=(rng,a,b)=>a+Math.floor(rng()*(b-a+1));
export function blockQuestions(lv,tier,rng){
  return Array.from({length:4},(_,i)=>{
    let code,value,ex;
    const a=integer(rng,3,6+tier),b=integer(rng,2,4),c=integer(rng,1,3);
    if(lv===1){
      const op=['//','%','**','+'][i];const n=i===2?b:a*b+c;
      value=op==='//'?Math.floor(n/b):op==='%'?n%b:op==='**'?b**c:n+b;
      code=op==='**'?`${b} ** ${c}`:`${n} ${op} ${b}`;ex=`${code} = ${value}。${op==='%'?'余数小于除数。':op==='**'?'** 表示乘方。':op==='//'?'本题均为正整数，// 取完整份数。':'相加求总数。'}`;
    }else if(lv===2){
      const values=[a,b,b,c],op=['sum','len','max','min'][i];code=`${op}([${values.join(', ')}])`;
      value=op==='sum'?a+b+b+c:op==='len'?4:op==='max'?Math.max(...values):Math.min(...values);
      ex=`${code} = ${value}。重复的 ${b} 是独立记录，不能删掉。`;
    }else{
      const start=i===3?a:0,end=i===3?a:a,step=i===2?2:1,inclusive=i===1;
      value=0;for(let v=start;inclusive?v<=end:v<end;v+=step)value++;
      code=`i = ${start}\nwhile i ${inclusive?'<=':'<'} ${end}:\n    jump()\n    i += ${step}`;
      ex=`jump() 执行 ${value} 次。先判断条件，再执行动作并更新；${i===3?'初始条件为假，所以一次也不执行。':'到不满足条件时停止。'}`;
    }
    return {id:'block-'+i,code,value,lanes:shuffle([value,value+1,value===0?value+2:value-1],rng),ex};
  });
}
export function fighterTask(lv,tier,rng){
  const high=integer(rng,7,10),energies=[high,4,high,2],end=3+tier;
  const actors=Array.from({length:12},(_,i)=>({id:i,x:[-3.4,-1.1,1.1,3.4][i%4],kind:i%4<2?'enemy':'transport',shield:lv===2?0:i%2===0?0:1,energy:energies[i%4],hp:lv===3?end:2,at:i*1.15}));
  return {lv,tier,end,energies,actors,duration:23,
    title:lv===3?'设备巡检 · 脉冲计数':lv===2?'设备巡检 · 能量筛选':'设备巡检 · 识别故障',
    goal:lv===3?`故障设备的检修需要 ${end} 发校准脉冲。让 i 从 0 开始，每轮发射一次并加 1，恰好发射 ${end} 次。`:lv===2?`只检修故障设备，而且能量读数必须等于本批最高值。扫描记录：[${energies.join(', ')}]。`:'只标记没有防护罩的故障设备，不要碰到正常设备。',
  };
}
export function loopPulses(config){
  let i=0,count=0;const end=Number(config.end),step=Number(config.step);
  if(!Number.isInteger(end)||end<1||end>10||![1,-1].includes(step)||!['<','<='].includes(config.op))return {count:0,stopped:false};
  while(config.op==='<'?i<end:i<=end){if(count>=12)return {count,stopped:false};count++;i+=step;}
  return {count,stopped:true};
}
export function targetsActor(task,config,actor){
  if(task.lv===3)return actor.kind==='enemy'&&actor.shield===0;
  const first=actor.kind===config.kind;
  const second=task.lv===1?actor.shield===Number(config.shield):actor.energy===(config.aggregate==='max'?Math.max(...task.energies):config.aggregate==='min'?Math.min(...task.energies):task.energies.reduce((a,b)=>a+b,0));
  return config.join==='and'?first&&second:first||second;
}
export function judgeFighter(task,config){
  if(task.lv===3){const trace=loopPulses(config);return {pass:trace.stopped&&trace.count===task.end,trace,ex:`从 0 开始，i < ${task.end}，每次 i += 1，恰好 ${task.end} 次。你的方案执行 ${trace.count} 次${trace.stopped?'后停止':'后被安全暂停，条件仍然成立'}。`};}
  const mismatches=task.actors.filter(a=>targetsActor(task,config,a)!==(a.kind==='enemy'&&(task.lv===1?a.shield===0:a.energy===Math.max(...task.energies))));
  return {pass:mismatches.length===0,mismatches:mismatches.map(a=>a.id),ex:task.lv===1?'两个条件必须同时满足：故障设备 and 防护罩为 0。or 会误选有罩故障设备或无罩正常设备。':`本批最高能量是 ${Math.max(...task.energies)}；同时必须是故障设备。使用 max 和 and，不能只按能量读数忽略设备状态。`};
}
export function createAdventure(lv,tier,seed,extras=[]){
  if(![1,2,3].includes(lv)||![1,2,3].includes(tier))throw Error('无效冒险等级');
  const rng=random(seed),bank=[...questions(lv,tier),...extras].filter(q=>!q.noSignal),source=bank[integer(rng,0,bank.length-1)];   // noSignal：老师审阅（2026-10-13）认定广播判断式转述太绕的题不进信号台
  const truth=rng()>.5,judgment=rng()>.5;
  const opts=judgment?['成立','不成立']:shuffle(source.opts,rng);
  const proposed=truth?source.a:(source.a+1)%source.opts.length;
  const basic={title:'信号台 · 校验广播',code:source.code,prompt:judgment?`${source.title}\n广播给出的答案是「${source.opts[proposed]}」，这个答案正确吗？`:source.title,opts,a:judgment?(truth?0:1):opts.indexOf(source.opts[source.a]),ex:source.ex};
  return {version:ADVENTURE_VERSION,mode:'adventure',id:`${seed}-${lv}-${tier}-${Date.now()}`,lv,tier,seed,started:Date.now(),order:shuffle(['basic','blocks','fighter'],rng),basic,blocks:blockQuestions(lv,tier,rng),fighter:fighterTask(lv,tier,rng),answers:{},drafts:{},cursor:0,scene:'intro'};
}
// Restore missing question context in pre-audit saves; keep choices and grades intact.
export function restoreQuestionContext(a){
  if(a.basic?.prompt?.startsWith('广播称结果为')){
    const q=questions(a.lv,a.tier).find(q=>q.code===a.basic.code&&q.ex===a.basic.ex);
    if(q)a.basic.prompt=q.title+'\n'+a.basic.prompt.replace('广播称结果为','广播给出的答案是').replace('这条信息成立吗','这个答案正确吗');
  }
  return a;
}
export function validAdventure(a){
  const num=Number.isFinite,integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
  if(!(a?.version===ADVENTURE_VERSION&&a.mode==='adventure'&&[1,2,3].includes(a.lv)&&[1,2,3].includes(a.tier)&&Array.isArray(a.order)&&a.order.length===3&&new Set(a.order).size===3&&a.order.every(k=>['basic','blocks','fighter'].includes(k))&&Array.isArray(a.basic?.opts)&&a.basic.opts.length>=2&&a.basic.opts.every(v=>typeof v==='string')&&integer(a.basic.a,0,a.basic.opts.length-1)&&typeof a.basic.code==='string'&&Array.isArray(a.blocks)&&a.blocks.length===4&&a.blocks.every(q=>typeof q.code==='string'&&num(q.value)&&Array.isArray(q.lanes)&&q.lanes.length===3&&q.lanes.every(num)&&new Set(q.lanes).size===3&&q.lanes.includes(q.value))&&a.fighter?.actors?.length===12&&a.fighter.lv===a.lv&&a.answers&&a.drafts&&integer(a.cursor,0,3)))return false;
  if(!['intro','map','basic','blocksBrief','blocks','fighterSetup','fighter','complete'].includes(a.scene))return false;
  if(Object.keys(a.answers).length!==a.cursor||a.order.some((key,i)=>i<a.cursor?typeof a.answers[key]?.pass!=='boolean':!!a.answers[key]))return false;
  if(a.cursor===3&&(!a.finished||a.scene!=='complete')||a.cursor<3&&(a.finished||a.scene==='complete'))return false;
  const s=a.drafts.blocks;
  if(s&&!(Array.isArray(s.grid)&&s.grid.length===12&&s.grid.every(row=>Array.isArray(row)&&row.length===12&&row.every(v=>integer(v,0,4)))&&integer(s.index,0,4)&&integer(s.x,0,11)&&integer(s.y,0,11)&&Array.isArray(s.cells)&&s.cells.length===4&&s.cells.every(p=>Array.isArray(p)&&p.length===2&&p.every(v=>integer(v,0,3)))&&Array.isArray(s.answers)&&s.answers.length===s.index&&s.answers.every(v=>typeof v.pass==='boolean')&&num(s.clock)&&num(s.lines)))return false;
  if(['blocks','blocksBrief'].includes(a.scene)&&(!s||s.index>=4))return false;
  const f=a.drafts.flight;
  if(f&&!(num(f.time)&&f.time>=0&&integer(f.spawned,0,12)&&num(f.player?.x)&&num(f.player?.y)&&Array.isArray(f.actors)&&f.actors.every(v=>num(v.x)&&num(v.y)&&integer(v.id,0,11))&&Array.isArray(f.bullets)&&f.bullets.every(v=>num(v.x)&&num(v.y)&&integer(v.target,0,11))&&Array.isArray(f.enemyShots)&&f.enemyShots.every(v=>num(v.x)&&num(v.y))&&['cooldown','hostileClock','hits','friendlyHits','blocked','damage','recover'].every(k=>num(f[k]))&&f.config&&typeof f.done==='boolean'&&(a.lv!==3||num(f.pulse?.count))))return false;
  if(a.scene==='fighter'&&!f)return false;
  return true;
}
export function adventureScore(a){return ['basic','blocks','fighter'].reduce((n,k)=>n+(a.answers[k]?.pass===true?1:0),0);}
export function recordAdventureAnswer(a,key,result){
  if(a.answers[key]||a.order[a.cursor]!==key)return false;
  a.answers[key]={...result,at:Date.now()};a.cursor++;
  if(a.cursor===3){a.finished=Date.now();a.scene='complete';}else a.scene='map';return true;
}
