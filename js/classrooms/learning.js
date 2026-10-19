import {assertSaveCurrent} from '../save_session.js';
// Shared question bank and actual Python Worker; compatible with campusPy1.
import {createConstructionStore} from '../construction/store.js';
const constructionRewards=createConstructionStore();
import {lockReason,migrateCourseProgress,canAccessExam} from './progress.js';
import {classroomLevels,lessonDraftKey,recordLessonStep,lessonOutputMatches} from './lesson_tasks.js';
export const levels=classroomLevels(window.PY_LEVELS);
let raw={};try{raw=JSON.parse(localStorage.getItem('campusPy1')||'{}')||{};}catch{}
const dict=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
export const save={...dict(raw),tasks:dict(raw.tasks),taskSteps:dict(raw.taskSteps),quiz:dict(raw.quiz),submitted:dict(raw.submitted),papers:dict(raw.papers),drafts:dict(raw.drafts),log:Array.isArray(raw.log)?raw.log:[]};
export function persist(){try{assertSaveCurrent();localStorage.setItem('campusPy1',JSON.stringify(save));constructionRewards.syncLearningRewards().catch(e=>console.warn('[construction-rewards]',e.message));return true;}catch{return false;}}
export function record(type,detail){save.log.push({time:new Date().toISOString(),type,detail});if(save.log.length>3000)save.log=save.log.slice(-3000);return persist();}
export const titles=[['跳绳测频室','整数商观察室','泳道模型实验室','分组判定室'],['总成绩统计室','参赛登记室','平均成绩分析室','极值颁奖室','循环问题室'],['循环训练室','累加训练室','故障排查室','毕业数据室','for巡回训练室']];
export const rooms=levels.flatMap((lv,i)=>lv.tasks.map((t,j)=>({id:t.id,lv:lv.id,index:j,title:titles[i][j],kind:'task',task:t,steps:t.steps,number:`${lv.id}0${j+1}`})));
rooms.push({id:'archive',lv:2,kind:'archive',title:'运动会成绩资料室',number:'206'});
for(const lv of levels)rooms.push({id:`exam-${lv.id}`,lv:lv.id,kind:'exam',title:`${['运算','数据','循环'][lv.id-1]}考核室`,number:`${lv.id}09`});
if(migrateCourseProgress(rooms,save))persist();
export const examAccessible=lv=>canAccessExam(rooms,save,lv);
export const locked=room=>lockReason(room,save);
export const done=lv=>levels[lv-1].tasks.every(t=>save.tasks[t.id]>=1);
export function draft(room,tier){return save.drafts[lessonDraftKey(room,tier)]??room.task.tiers[tier];}
export function setDraft(room,tier,code){save.drafts[lessonDraftKey(room,tier)]=code;persist();}
let worker=null,seq=0,busy=false,pending=null;
function execute(task,code,pre=task.pre){
 return new Promise(resolve=>{
  const id=++seq;worker??=new Worker('js/py_worker.js');const w=worker;
  const finish=result=>{clearTimeout(timer);pending=null;resolve(result);};
  const timer=setTimeout(()=>{w.terminate();worker=null;finish({timeout:true});},4000);
  pending=()=>{w.terminate();worker=null;finish({cancelled:true});};
  w.onmessage=e=>{if(e.data.id===id)finish(e.data);};
  w.onerror=e=>{w.terminate();worker=null;finish({ok:false,err:e.message});};
  w.postMessage({id,preamble:pre,code,suffix:task.suffix});
 });
}
export function cancel(){pending?.();}
export async function run(room,tier,code){
 if(busy)return {error:'程序正在运行，请稍候'};busy=true;setDraft(room,tier,code);
 try{
  const t=room.task,stripped=code.replace(/#[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g,'');
  if(/[：（）“”‘’，；]/.test(stripped))return {error:'代码中有中文全角符号，请换成英文标点。'};
  const r=await execute(t,code);if(r.cancelled)return r;
  const failedRun=error=>({pass:false,error:error+(r.trace?' 已保留部分过程记录，不能作为完整执行或获得星级。':''),out:r.out||'',trace:r.trace||null,process:r.process||null,step:t.step,partial:!!r.trace,traceNote:r.trace?'这是中断前的部分运行记录，不能作为完整过程或获得星级。':undefined});
  if(r.timeout){record('timeout',t.id);const hint=t.requiresFor?'检查 range 的范围和嵌套循环是否能结束，再修改运行。':'检查循环停止条件和循环内的变量更新，再修改运行。';return {...failedRun('程序已在安全时限内停止。'+hint),timeout:true};}
  if(!r.ok)return failedRun(r.err||'Python执行失败');
  if(r.trace?.truncated)return {...failedRun('运行记录超过安全上限，只保留部分过程；请简化循环后重试。'),partial:true};
  const lines=r.out.split('\n').map(s=>s.trim()).filter(s=>s&&!s.startsWith('ACTS:'));
  let result=t.check(lines,r.out);
  if(result.pass)result=window.PY_GRADING.processCheck(t,r)||result;
  if(result.pass&&t.tests)for(const test of t.tests){
   const x=await execute(t,code,test.pre);if(x.cancelled)return x;
   const process=x.ok?window.PY_GRADING.processCheck(t,x):null;
   const matches=x.ok&&(t.step?lessonOutputMatches(x.out,test.expected):window.PY_GRADING.testMatches(x.out,test));
   if(!matches||process?.pass===false||x.trace?.truncated){
    result={pass:false,hint:[window.PY_GRADING.boundaryHint(t,code,x,test),process?.hint,`本次复核输出：${x.timeout?'超时':x.err||x.out?.trim()||'无输出'}。`].filter(Boolean).join(' '),boundaryTrace:x.trace};break;
   }
  }
  if(result.pass){if(t.step)recordLessonStep(save,t.id,t.step,tier+1);else save.tasks[t.id]=Math.max(save.tasks[t.id]||0,tier+1);record('pass',t.step?`${t.id}:${t.step}`:t.id);}
  return {...result,out:r.out,step:t.step,process:r.process,trace:r.trace};
 }finally{busy=false;}
}
