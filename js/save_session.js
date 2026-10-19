// A reset invalidates every open page's in-memory save before any key is changed.
export const DATA_KEYS=['campusPy1','campus.construction.v1','campus.sportsExam.v1','campus.sports.v1','campus.training.v1','campus.training.v2'];
export const REPLAY_KEY='campus.replay.v1',EPOCH_KEY='campus.replay.epoch',JOURNAL_KEY='campus.replay.pending.v1';
export const SAVE_LOCK='campus.construction.v1';
const storage=globalThis.localStorage;
let epoch;try{epoch=storage?.getItem(EPOCH_KEY);}catch{}
export function assertSaveCurrent(target=globalThis.localStorage){
 if(target!==storage||!target)return;
 if(target.getItem(EPOCH_KEY)!==epoch||target.getItem(JOURNAL_KEY))throw Error('存档已在另一页面切换，请重新载入后继续。');
}
export function restoreValues(target,values){for(const [key,value] of Object.entries(values))value===null?target.removeItem(key):target.setItem(key,value);}
export async function recoverInterrupted(target=storage,locks=globalThis.navigator?.locks){
 if(!locks?.request)throw Error('请使用支持安全存档的新版 Chrome 或 Edge');
 await locks.request(SAVE_LOCK,()=>{const raw=target.getItem(JOURNAL_KEY);if(!raw)return;const journal=JSON.parse(raw);
  if(!journal.before||![...DATA_KEYS.filter(k=>k!=='campus.training.v2'),REPLAY_KEY].every(k=>Object.hasOwn(journal.before,k)))throw Error('恢复信息不完整，请先保留浏览器数据。');
  restoreValues(target,{'campus.training.v2':null,...journal.before});target.removeItem(JOURNAL_KEY);
 });
}
function showChanged(){
 if(!globalThis.document||document.getElementById('saveChangedDialog'))return;
 const d=document.createElement('dialog');d.id='saveChangedDialog';d.setAttribute('aria-label','存档已切换');
 d.style.cssText='max-width:440px;padding:28px;border-radius:14px;color:#183f31;background:#f7f9f3;line-height:1.8';
 const title=document.createElement('h2');title.textContent='学习记录已切换';
 const p=document.createElement('p');p.textContent='此页面已暂停保存。重新载入即可使用最新记录；若上次切换中断，会先恢复原存档。';
 const b=document.createElement('button');b.textContent='重新载入最新记录';b.style.cssText='padding:12px 20px;cursor:pointer';
 b.onclick=async()=>{b.disabled=true;try{await recoverInterrupted();location.reload();}catch(e){p.textContent=e.message;b.disabled=false;}};
 d.append(title,p,b);d.addEventListener('cancel',e=>e.preventDefault());
 document.querySelectorAll('audio,video').forEach(m=>m.pause());document.body.append(d);d.showModal();
 window.dispatchEvent(new Event('campus-save-invalidated'));
}
if(globalThis.window?.addEventListener&&storage){
 const check=()=>{try{assertSaveCurrent();}catch{showChanged();}};
 window.addEventListener('storage',e=>{if(e.key===EPOCH_KEY||e.key===JOURNAL_KEY)check();});
 window.addEventListener('pageshow',check);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',check,{once:true});else check();
}
