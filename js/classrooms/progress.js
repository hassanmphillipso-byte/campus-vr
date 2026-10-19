// One interpretation of the existing save, shared by doors, lists and rewards.
import {findRoute} from '../character_navigation.js';
import {lessonDraftKey,lessonProgress} from './lesson_tasks.js';
import {isCorrect} from './question_bank.js';
export const COURSE_VERSION=2;
export const GRADUATION_ID=`graduation-v${COURSE_VERSION}`;
const hasScore=v=>typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<=4; // 旧3题制满分3；现行4题制满分4（E02）
// 版本化经典最高分：score/total/version 属于同一条成绩记录（R04）。
// 旧存档没有版本化记录时，从 legacy 的 examBest+examBestTotal 推断一次；之后 finish() 会写入正式记录。
export function classicBestByVer(save,key){
  const out={},stored=save.examBestByVer?.[key];
  if(stored&&typeof stored==='object'&&!Array.isArray(stored)){
    for(const [ver,rec] of Object.entries(stored))if(rec&&typeof rec==='object'&&Number.isFinite(rec.score)&&Number.isFinite(rec.total))out[ver]={score:rec.score,total:rec.total};
  }
  if(!out.v1&&!out.v2){
    const legacy=save.examBest?.[key];
    if(hasScore(legacy)){const total=save.examBestTotal?.[key]||3;out[total>=4?'v2':'v1']={score:legacy,total};}
  }
  return out;
}
const hasExamRecord=(save,lv)=>hasScore(save.quiz?.[lv])||[1,2,3].some(tier=>save.exams?.[`${lv}:${tier}`]||save.exams?.[`adventure:${lv}:${tier}`]||hasScore(save.examBest?.[`${lv}:${tier}`])||hasScore(save.examBest?.[`adventure:${lv}:${tier}`]));
// 满分与题量绑定场次版本：历史 3 题卷按 3 判满分，现行 4 题卷按 4 判满分。
const perfectAttempt=a=>!!a&&!!a.finished&&Array.isArray(a.questions)&&a.questions.length>0&&Array.isArray(a.answers)&&a.answers.length===a.questions.length&&a.questions.every((q,i)=>isCorrect(q,a.answers[i]));
function classicFullMark(save,key){
  if(save.examFullMark?.[key])return true;
  if(perfectAttempt(save.exams?.[key]))return true;
  return Array.isArray(save.examHistory)&&save.examHistory.some(v=>v?.key===key&&perfectAttempt(v.attempt));
}
// 学以致用：该场本人实测且全部题目都已提交首答（按题型校验，不再要求“3条整数首答”）。
function answeredAll(a){
  const qs=a?.questions;
  if(!Array.isArray(qs)||!Array.isArray(a.answers)||a.answers.length!==qs.length)return false;
  return qs.every((q,i)=>{
    const v=a.answers[i],qt=q.type||'choice';
    if(!v||!('first' in v))return false;
    return qt==='blank'?typeof v.first==='string'&&v.first.trim()!=='':qt==='code'?typeof v.first?.code==='string'&&v.first.code.trim()!=='':Number.isInteger(v.first);
  });
}
// Add an explicit entitlement before upgrading an old save. Grades, submission
// receipts, awards and the construction ledger remain untouched.
export function migrateCourseProgress(rooms,save){
 if(Number(save.courseVersion)>=COURSE_VERSION)return false;
 const access={...(save.courseExamAccess&&typeof save.courseExamAccess==='object'&&!Array.isArray(save.courseExamAccess)?save.courseExamAccess:{})};
 for(const lv of [1,2,3]){
  const previous=rooms.filter(r=>r.lv===lv&&r.task&&r.id!=='3-5');
  if(save.submitted?.[lv]||hasExamRecord(save,lv)||(previous.length&&previous.every(r=>save.tasks?.[r.id]>=1)))access[lv]=true;
 }
 save.courseExamAccess=access;save.courseVersion=COURSE_VERSION;return true;
}
export function canAccessExam(rooms,save,lv){
 const tasks=rooms.filter(r=>r.lv===lv&&r.task);
 return !!(save.submitted?.[lv]||save.courseExamAccess?.[lv]||hasExamRecord(save,lv)||(tasks.length&&tasks.every(r=>save.tasks?.[r.id]>=1)));
}
export function courseSummary(rooms,save){const tasks=rooms.filter(r=>r.task);return {total:tasks.length,completed:tasks.filter(r=>save.tasks?.[r.id]>=1).length,version:COURSE_VERSION};}
export function walkingRoute(points,colliders){
 if(!points.length)return [];
 const obstacles=colliders.filter(c=>c.y+c.h/2>.21&&c.y-c.h/2<1.62);
 const blocked=(x,z)=>obstacles.some(c=>Math.abs(x-c.x)<c.w/2+.29&&Math.abs(z-c.z)<c.d/2+.29);
 const route=[points[0]];
 for(const point of points.slice(1)){if(Math.hypot(point.x-route.at(-1).x,point.z-route.at(-1).z)<.08)continue;const leg=findRoute(route.at(-1),point,blocked,{cell:.28,budget:2200,margin:4});if(!leg.length)return [];route.push(...leg);}
 return route;
}
export const WING_NAMES=['运算教学区','数据教学区','循环教学区'];
export function awardDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function lockReason(room,save){
 if(room.lv===3&&!(save.submitted?.[1]&&save.submitted?.[2]))return '先完成第一、二关并在考核室交作业';
 if(room.lv===2&&room.kind==='task'&&![0,1,2].every(i=>save.papers?.[`2-${i}`]||save.submitted?.[2]))return '先去206资料室整理三张成绩单';
 return '';
}
export function roomStatus(room,save){
 const locked=lockReason(room,save),base={stars:0,locked};
 if(room.kind==='archive'){
  const n=[0,1,2].filter(i=>save.papers?.[`2-${i}`]).length;
  return {...base,key:n===3?'done':n?'active':'todo',label:n===3?'✓ 已整理':'资料待整理',detail:`已整理 ${n} / 3 份成绩单`};
 }
  if(room.kind==='exam'){
   const attempts=[1,2,3].flatMap(i=>[save.exams?.[`${room.lv}:${i}`],save.exams?.[`adventure:${room.lv}:${i}`]]);
   // 每级分版本展示自己的最高分（R04）：旧3题卷 3/3 与新4题卷 2/4 并列可见，不再拼成 3/4。
   const detail=[1,2,3].map(i=>{
    const key=`${room.lv}:${i}`,a=save.examBest?.[`adventure:${room.lv}:${i}`],byVer=classicBestByVer(save,key);
    const parts=[];if(byVer.v1)parts.push(`旧版 ${byVer.v1.score}/${byVer.v1.total}`);if(byVer.v2)parts.push(`新版最高 ${byVer.v2.score}/${byVer.v2.total}`);
    return `${i}级 经典${parts.length?parts.join('；'):'未记录'}${hasScore(a)?` · 冒险 ${a}/3（历史玩法）`:''}`;
   }).join(' · ');
  if(save.submitted?.[room.lv])return {...base,key:'done',label:'✓ 已向老师提交',detail};
  if(hasScore(save.quiz?.[room.lv])||attempts.some(a=>a?.finished))return {...base,key:'submit',label:'待提交给老师',detail};
  if(locked)return {...base,key:'locked',label:'未解锁',detail:locked};
  if(attempts.some(a=>a&&!a.finished))return {...base,key:'active',label:'考核进行中',detail};
  return {...base,key:'todo',label:'尚未作答',detail};
 }
 const stars=Math.min(3,Math.max(0,Number(save.tasks?.[room.id])||0));
 if(stars)return {...base,key:'done',label:'✓ 已完成',stars:room.task?.type==='narrative'?0:stars,detail:room.task?.type==='narrative'?'衔接学习已完成':`最高 ${stars} 星 · ${['填空','补全','独立编程'][stars-1]}`};
 if(locked)return {...base,key:'locked',label:'未解锁',detail:locked};
 const variants=room.steps||[room.task];
 const started=variants.some(task=>task?.tiers?.some((template,i)=>{const value=save.drafts?.[lessonDraftKey({...room,task},i)];return typeof value==='string'&&value.trim()!==template.trim();}));
 if(room.id==='3-5'&&(save.submitted?.[3]||save.courseExamAccess?.[3]))return {...base,key:started?'active':'todo',label:started?'◐ 补学中':'○ 新课待补学',detail:'原成绩、金币与考核访问保留；完成 for 课程后可获新版结业纪念卡'};
 if(room.steps){const p=lessonProgress(save,room.id),active=p.completed>0||started;return {...base,key:active?'active':'todo',label:p.completed>0?'◐ 进行中':started?'◐ 有草稿':'○ 未完成',detail:`独立步骤 ${p.completed}/${p.total} · ${started&&!p.completed?'已保存代码尚未通过；打开检查或继续学习':'两步都通过才算完成本室；想多拿星星可以挑战更高难度，不强制'}`};}
 return {...base,key:started?'active':'todo',label:started?'◐ 有草稿':'○ 未完成',detail:started?'已保存代码尚未通过；打开检查或继续学习':'通过任意一档就能继续学下一间；想多拿星星可以挑战更高难度，不强制'};
}
export function wingSummary(rooms,save,lv){
 const tasks=rooms.filter(r=>r.lv===lv&&r.task);
 return {completed:tasks.filter(r=>save.tasks?.[r.id]>=1).length,total:tasks.length,submitted:!!save.submitted?.[lv]};
}
export function nextObjective(rooms,save,wing=1){
 const order=[wing,...[1,2,3].filter(lv=>lv!==wing)];
 for(const lv of order){
  if(lv===3&&!(save.submitted?.[1]&&save.submitted?.[2]))continue;
  const summary=wingSummary(rooms,save,lv);if(summary.submitted&&summary.completed===summary.total)continue;
  if(lv===2&&!save.submitted?.[2]&&![0,1,2].every(i=>save.papers?.[`2-${i}`]))return {...rooms.find(r=>r.id==='archive'),reason:'先整理三份成绩单，解锁数据课程'};
  const task=rooms.find(r=>r.lv===lv&&r.task&&!save.tasks?.[r.id]);
  if(task)return {...task,reason:task.id==='3-5'&&(save.submitted?.[3]||save.courseExamAccess?.[3])?'新增 for 巡回课程待补学；原有成绩和考核访问已保留':roomStatus(task,save).key==='active'?'继续上次未完成的练习':'完成这间教室的学习任务'};
  const exam=rooms.find(r=>r.id===`exam-${lv}`);
  return {...exam,reason:roomStatus(exam,save).key==='submit'?'答题已完成，请向老师提交':'本区课程已完成，参加小测并提交'};
 }
 return {id:null,number:'',title:'三关已完成',reason:'查看结业纪念卡，或自选更高难度复习'};
}
export function awardCatalog(rooms,save){
 const awards=[],add=(id,name,rule,condition,icon,extra={})=>{const record=save.learningAwards?.[id],recordValid=extra.courseVersion?record?.courseVersion===extra.courseVersion&&record?.taskIds?.includes('3-5'):!!record;awards.push({id,name,rule,icon,...extra,earned:!!condition||recordValid,earnedAt:record?.earnedAt});};
 for(const lv of [1,2,3]){
  const summary=wingSummary(rooms,save,lv),name=['运算','数据','循环'][lv-1];
  if(lv===3&&save.learningAwards?.['region-3'])add('region-3','循环区域完成章（旧课程）','历史课程完成记录；含 for 的新版完成章另行记录',false,'循',{historical:true});
  add(lv===3?`region-3-v${COURSE_VERSION}`:`region-${lv}`,name+'区域完成章','完成本区课程，并向老师提交考核',summary.completed===summary.total&&summary.submitted&&(lv!==3||save.tasks?.['3-5']>=1),['算','数','循'][lv-1],lv===3?{courseVersion:COURSE_VERSION}:{});
  for(const tier of [1,2,3]){
   add(`adventure-master-${lv}-${tier}`,`${name} ${tier}级冒险掌握章（历史玩法）`,'早期基地冒险玩法：同场信号、方块、巡检三站首次方案全部通过（该玩法已于 2026-10 下线，已获记录保留）',save.examBest?.[`adventure:${lv}:${tier}`]===3,'◇');
   add(`master-${lv}-${tier}`,`${name} ${tier}级掌握章`,'本级某次完整小测首答全对（本场满分；3题卷按3分、4题卷按4分），纠错不补首答分',classicFullMark(save,`${lv}:${tier}`),'★');
   const a=save.exams?.[`${lv}:${tier}`],sport=a?.sport;
   const real=sport&&(lv===2?Array.isArray(sport.shots)&&sport.shots.length>0:Number(sport.distance)>0&&Number(sport.seconds)>0);
   add(`applied-${lv}-${tier}`,`${name} ${tier}级学以致用章`,'同一场本人体育实测后，完成该场全部知识题的首答',a?.finished&&a.source==='本人实测'&&a.missionId&&real&&answeredAll(a),'体');
  }
 }
 if(save.learningAwards?.graduation)add('graduation','校园探索结业纪念卡（旧课程）','历史纪念卡保留；不代表含 for 的新版课程已完成',false,'学',{historical:true});
 add(GRADUATION_ID,'校园探索结业纪念卡（新版）','完成含 for 巡回训练的全部课程，并向三位老师提交',save.tasks?.['3-5']>=1&&[1,2,3].every(lv=>{const s=wingSummary(rooms,save,lv);return s.completed===s.total&&s.submitted;}),'学',{courseVersion:COURSE_VERSION});
 return awards;
}
export function syncAwards(rooms,save,now=new Date().toISOString()){
 if(!save.learningAwards||typeof save.learningAwards!=='object'||Array.isArray(save.learningAwards))save.learningAwards={};
 const added=[];for(const a of awardCatalog(rooms,save))if(a.earned&&!save.learningAwards[a.id]){save.learningAwards[a.id]={earnedAt:now,...(a.courseVersion?{courseVersion:a.courseVersion,taskIds:rooms.filter(r=>r.task).map(r=>r.id),total:courseSummary(rooms,save).total}:{})};added.push(a);}
 return added;
}
