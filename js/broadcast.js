// 校园广播：按真实作息打电铃 + 语音播报变体（同一天措辞稳定，隔天自动换）。
// 语音由集成方注入的 speak(url) 播放（内部已含 duck 与解码缓存），本模块不碰音频上下文；清单可能缺失，一律静默降级。
const ROOT=new URL('../assets/audio/broadcast/',import.meta.url);
const p2=n=>String(n).padStart(2,'0');
const hhmm=d=>p2(d.getHours())+':'+p2(d.getMinutes());
const ymd=d=>d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());
const ymdc=d=>''+d.getFullYear()+p2(d.getMonth()+1)+p2(d.getDate());
const mins=t=>+t.slice(0,2)*60+ +t.slice(3);
const fnv=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}; // FNV-1a 32 位
// 作息表（本地时间，分钟粒度）：class/break 只打铃，speech-morning 走早间语音；10:25 与 16:25 是大课间（铃后加播）
export const BELL_SCHEDULE=[['07:50','class'],['07:52','speech-morning'],['08:45','break'],['09:35','class'],['10:25','break'],['10:55','class'],['11:45','break'],['14:00','class'],['14:45','break'],['15:35','class'],['16:25','break'],['19:00','class']];
const BIG_BREAKS=new Set(['10:25','16:25']);
class CampusBroadcast{
 constructor({bell=()=>{},speak=url=>0,toast=()=>{},now=()=>new Date()}={}){
  this.bell=bell;this.speak=speak;this.toast=toast;this.now=now;
  this.types=null;this.manifestOk=false;this.clips=0;
  this.fired=[];this.firedKeys=new Set();this.pending=[];this.scanned=false; // firedKeys 内存去重，跨天自动换键
  this.announcing=null;this.announceUntil=0;this.lastAnnouncement=null;
  this.lastHM='';this.lastWork=-Infinity;
  this.ready=(async()=>{ // 离线管线产物可能缺失：失败不抛错，仅 manifestOk=false
   try{
    const r=await fetch(new URL('manifest.json',ROOT));if(!r.ok)return;
    const types=(await r.json())?.types;if(!types||typeof types!=='object')return;
    const clean={};let n=0;
    for(const [k,v] of Object.entries(types)){const list=(Array.isArray(v)?v:[]).filter(x=>x&&x.id&&x.file&&x.text).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);if(list.length){clean[k]=list;n+=list.length;}}
    this.types=clean;this.clips=n;this.manifestOk=n>0;
   }catch{}
  })();
 }
 at(d,pt){const [h,m]=pt.split(':');return new Date(d.getFullYear(),d.getMonth(),d.getDate(),+h,+m).getTime();} // 今天某点位的时间戳
 tick(){
  const d=this.now(),t=d.getTime(),dt=t-this.lastWork;
  if(dt>=0&&dt<250)return; // 节流：实际工作至多每 250ms 一次
  this.lastWork=t;
  if(this.announceUntil&&t>=this.announceUntil){this.announcing=null;this.announceUntil=0;} // 播报到期回收
  for(let i=this.pending.length;i--;){const p=this.pending[i];if(t>=p.at){this.pending.splice(i,1);this.announce(p.type,p.slot);}} // 大课间"铃后 2.5s"走 tick 时间轴
  const hm=hhmm(d);
  if(hm===this.lastHM)return; // 分钟字符串未变：不再深入扫描（高频调用保持廉价）
  this.lastHM=hm;
  this.scan(d,t);
 }
 scan(d,t){
  const day=ymdc(d);
  if(!this.scanned){this.scanned=true; // 初始化补偿：开页时更早的已过点位只登记不补，留给下面 ≤120s 判定补最近一个
   let last=-1;BELL_SCHEDULE.forEach(([pt],i)=>{if(t>=this.at(d,pt))last=i;});
   BELL_SCHEDULE.forEach(([pt],i)=>{if(i<last)this.firedKeys.add(day+'|'+pt);});
  }
  for(const [pt,kind] of BELL_SCHEDULE){
   const key=day+'|'+pt,el=t-this.at(d,pt);
   if(el<0||this.firedKeys.has(key))continue;
   this.firedKeys.add(key);
   if(el>120000)continue; // 错过超两分钟：静默放弃，避免开页补一串旧铃（07:51 打开仍能补上 07:50 的铃）
   this.fire(kind,pt,t);
  }
 }
 fire(kind,pt,t){
  this.fired.push(pt+' '+kind);if(this.fired.length>5)this.fired.shift();
  if(kind==='speech-morning'){this.announce('morning');return;}
  try{this.bell(kind);}catch{} // 电铃由集成方程序合成；配乐 duck 也在集成方处理
  if(kind==='break'&&BIG_BREAKS.has(pt))this.pending.push({at:t+2500,type:'break',slot:''}); // 大课间铃响 2.5s 后追加课间播报，其余下课铃只打铃
 }
 announce(type,slot=''){
  try{
   const list=this.types&&this.types[type];
   if(!this.manifestOk||!list||!list.length)return false; // 无清单/该类无条目：静默返回 false，绝不抛错
   if(this.announcing===type)return false; // 同类播报进行中：忽略；不同类型则直接换源
   const d=this.now(),pick=list[fnv(ymd(d)+'|'+type+'|'+slot)%list.length]; // 键=日期|类型|场次：同天跨刷新稳定，隔天自动换措辞
   this.announcing=type;this.announceUntil=Infinity; // 先占位防重入，拿到时长后再定到期时间
   this.lastAnnouncement={type,id:pick.id,text:pick.text,at:d.getTime()};
   try{this.toast('📻 '+pick.text);}catch{}
   let secs;try{secs=this.speak('assets/audio/broadcast/'+pick.file);}catch{this.announcing=null;this.announceUntil=0;return false;}
   const end=s=>{if(this.announcing!==type)return;if(s>0)this.announceUntil=this.now().getTime()+s*1000;else{this.announcing=null;this.announceUntil=0;}};
   if(secs&&typeof secs.then==='function'){Promise.resolve(secs).then(end,()=>{if(this.announcing===type){this.announcing=null;this.announceUntil=0;}});return true;}
   end(secs||0);return secs>0; // speak 返回 0=不可用
  }catch{return false;}
 }
 isBreak(){const d=this.now(),m=d.getHours()*60+d.getMinutes();return BELL_SCHEDULE.some(([pt,k])=>k==='break'&&m>=mins(pt)&&m<mins(pt)+10);} // 每个 break 铃后 10 分钟为课间窗
 state(){
  const d=this.now(),t=d.getTime();
  if(this.announceUntil&&t>=this.announceUntil){this.announcing=null;this.announceUntil=0;} // 惰性回收，保证汇报即时准确
  const sec=d.getHours()*3600+d.getMinutes()*60+d.getSeconds();let next=BELL_SCHEDULE[0][0];
  for(const [pt] of BELL_SCHEDULE)if(mins(pt)*60>sec){next=pt;break;}
  return {fired:[...this.fired],lastAnnouncement:this.lastAnnouncement?{...this.lastAnnouncement}:null,nextBell:next,manifestOk:this.manifestOk,clips:this.clips,announcing:this.announcing||null};
 }
}
export {CampusBroadcast};
