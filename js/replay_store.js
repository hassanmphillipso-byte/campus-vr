import {DATA_KEYS,REPLAY_KEY,EPOCH_KEY,JOURNAL_KEY,SAVE_LOCK,assertSaveCurrent,restoreValues} from './save_session.js';
import {rewardRecords} from './construction/catalog.js';
import {createConstructionStore} from './construction/store.js';
export const freshLearning=()=>({tasks:{},taskSteps:{},quiz:{},submitted:{},papers:{},drafts:{},exams:{},examHistory:[],examBest:{},examBestTotal:{},examBestByVer:{},examDrafts:{},examFullMark:{},examMissions:{},examTier:{},learningAwards:{},log:[],courseVersion:2});
export function archiveAttempt(save,key,attempt,now=new Date().toISOString()){
 if(!attempt)return;
 const history=save.examHistory??=[];
 if(!Array.isArray(history))throw Error('历史考试记录无法读取，已保留原记录');
 if(!history.some(v=>v.key===key&&v.attempt.id===attempt.id))history.push({key,archivedAt:now,attempt:structuredClone(attempt)});
}
const parse=(raw,fallback)=>raw===null?fallback:JSON.parse(raw);
export function readReplay(storage=globalThis.localStorage){
 const m=parse(storage.getItem(REPLAY_KEY),{version:1,round:1,rounds:[],backup:null});
 if(m?.version!==1||!Array.isArray(m.rounds))throw Error('重玩历史无法读取，原记录已保留');return m;
}
export const snapshot=(storage=globalThis.localStorage)=>Object.fromEntries(DATA_KEYS.map(k=>[k,storage.getItem(k)]));
export async function switchReplay(mode,{storage=globalThis.localStorage,locks=globalThis.navigator?.locks,lv=1,tier=1,kind='classic',now=new Date().toISOString(),token=globalThis.crypto.randomUUID()}={}){
 if(!['retake','round','reset','restore'].includes(mode))throw Error('未知的重玩选项');
 if(!locks?.request)throw Error('请使用支持安全存档的新版 Chrome 或 Edge');
 return locks.request(SAVE_LOCK,()=>{
  assertSaveCurrent(storage);if(storage.getItem(JOURNAL_KEY))throw Error('上次切换未完成，请重新载入并恢复');
  const before={...snapshot(storage),[REPLAY_KEY]:storage.getItem(REPLAY_KEY)};
  const meta=readReplay(storage),learning=parse(before.campusPy1,{});
  if(!learning||typeof learning!=='object'||Array.isArray(learning))throw Error('学习记录无法读取，原记录已保留');
  const backup={savedAt:now,mode,snapshot:snapshot(storage),round:meta.round,rounds:meta.rounds};
  let next={...before},updated={...meta,backup};
  if(mode==='retake'){
   if(![1,2,3].includes(lv)||![1,2,3].includes(tier)||!['classic','adventure'].includes(kind))throw Error('请选择有效的区域、难度和形式');
   const key=kind==='classic'?`${lv}:${tier}`:`adventure:${lv}:${tier}`;
   learning.exams??={};archiveAttempt(learning,key,learning.exams[key],now);delete learning.exams[key];
   next.campusPy1=JSON.stringify(learning);
  }else if(mode==='round'||mode==='reset'){
   next.campusPy1=JSON.stringify(freshLearning());
   next['campus.sportsExam.v1']='[]';next['campus.sports.v1']='{}';next['campus.training.v1']='{}';next['campus.training.v2']='{}';
   if(mode==='round'){
    updated.round=(meta.round||1)+1;
    updated.rounds=[...meta.rounds,{id:token,number:meta.round||1,endedAt:now,snapshot:backup.snapshot}];
    // Bank any already-earned rewards before clearing current course progress.
    const bank=createConstructionStore({storage,locks}).getConstructionState();
    for(const [id,r] of Object.entries(rewardRecords(learning)))bank.awards[id]??={...r,earnedAt:now};
    bank.revision++;next['campus.construction.v1']=JSON.stringify(bank);
   }else{updated.round=1;updated.rounds=[];next['campus.construction.v1']=JSON.stringify({version:1,revision:0,awards:{},purchases:{}});}
  }else{
   const b=meta.backup;if(!b||!DATA_KEYS.filter(k=>k!=='campus.training.v2').every(k=>Object.hasOwn(b.snapshot||{},k)))throw Error('没有可恢复的备份');
   // Pre-v2 backups remain valid; they simply contain no new-rule sports record.
   next={...next,...Object.fromEntries(DATA_KEYS.map(k=>[k,b.snapshot[k]??null]))};updated={version:1,round:b.round,rounds:b.rounds,backup};
  }
  next[REPLAY_KEY]=JSON.stringify(updated);
  // No await inside this commit. The write-ahead journal survives a tab crash.
  // On quota failure the untouched or rolled-back original remains recoverable.
  try{storage.setItem(JOURNAL_KEY,JSON.stringify({before,token}));}catch{throw Error('备份保存失败，原记录没有改变。请先导出记录并检查浏览器存储空间。');}
  try{storage.setItem(EPOCH_KEY,token);restoreValues(storage,next);storage.removeItem(JOURNAL_KEY);}
  catch(e){try{restoreValues(storage,before);storage.removeItem(JOURNAL_KEY);}catch{}throw Error('切换未完成，原存档有恢复备份。请重新载入恢复后重试：'+e.message);}
  return updated;
 });
}
