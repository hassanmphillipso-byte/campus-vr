import * as T from '../../vendor/three/build/three.module.js';
import {FACILITIES} from './catalog.js';
// 音乐馆定时演出：每天 10:30/16:00/20:00 两首嵌入歌曲，节拍驱动演员；零曲目时优雅回退为振荡器排练模式。
// 手法对齐 activities.js（人物克隆/坐姿/Natural_Seated/清场）与 programmes.js（三角波 tone）；本模块不改考核逻辑。
const V=FACILITIES.find(v=>v.id==='music');                 // {x:45,z:-110,w:22,d:18,facing:1}
const SHOW_TIMES=[['10:30',10,30],['16:00',16,0],['20:00',20,0]];
const PERF_DIR='assets/audio/performance/',ANNOUNCE_SEC=300,STAGE_DIST=60,FULL_DIST=25,FADE_DIST=130;
const REHEARSAL_PIECE=48,REHEARSAL_BEAT=.6;                  // 排练：48s/首，100bpm(0.6s/拍)方波
const MELODY=[60,64,67,64,62,65,69,67,64,67,72,71,69,67,64,60];
const PIANO=[V.x-1,.7,V.z-4.8];                              // VENUE_CAST.music pianist 世界位（钢琴）：[44,.7,-114.8]
// 观众席：台阶 3 人（y=.7，朝钢琴一侧）+ 平地 3 人（朝舞台，-z），模型缺失即跳过
const AUDIENCE_SEATS=[['Boy_A',43.4,.7,-114.9,0],['Girl_B',45,.7,-115.6,0],['Boy_C',46.6,.7,-116.3,0],['Girl_A',42.8,0,-111.4,Math.PI],['Boy_B',44.8,0,-112.1,Math.PI],['Girl_C',46.7,0,-111.7,Math.PI]];
const p2=n=>String(n).padStart(2,'0');
export class VenueShows{
 constructor({isBuilt,position,notice,onAnnounce,onShowStart,onShowEnd,characters,campusMusic,scene}){
  this.isBuilt=isBuilt||(()=>false);this.position=position||(()=>({x:0,z:0}));this.notice=notice||(()=>{});
  this.onAnnounce=onAnnounce;this.onShowStart=onShowStart;this.onShowEnd=onShowEnd;
  this.characters=characters||{};this.campusMusic=campusMusic||null;                     // 可能空对象→不生成观众
  this.scene=scene||globalThis.window?.__campus?.sceneRef||null;                          // 舞台挂载根（未传则读调试引用）
  this.phase='idle';this.test=false;this.manifest=null;this.manifestOk=false;this.manifestLoading=false;this.pendingForce=false;
  this.pieces=[];this.trackIndex=0;this.nowPlaying=null;this.rehearsal=false;this.rehearsalClock=0;this.noteIdx=-1;
  this.showClock=0;this.clapUntil=0;this.token=0;this.distFactor=1;this.duration=0;this.onsets=null;this.onsetIdx=-1;
  this.audio=null;this.songGain=null;this.src=null;this.srcActive=false;this.songT0=0;
  this.stage=null;this.stageLights=[];this.stageDisposables=[];this.audience=null;this.audienceN=0;
  this.announced=new Set();this.started=new Set();this.next=null;this._d=new Date();      // 复用 Date，tick 零分配
  this.cloneSkeleton=null;
  // SkeletonUtils 走 vendor 相对路径动态加载（其内部 bare 'three' 由 importmap 解析；Node 自检下静默降级）
  import('../../vendor/three/examples/jsm/utils/SkeletonUtils.js').then(m=>{this.cloneSkeleton=m.clone;}).catch(()=>{});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&this.phase==='performing'&&this.audio?.state==='suspended')this.audio.resume().catch(()=>{});}); // 页面隐藏不停演，回来续播
  this.loadManifest();
 }
 loadManifest(){ // 清单失败不抛错：manifestOk=false，开演时回退排练模式
  if(this.manifestLoading)return;this.manifestLoading=true;
  fetch(PERF_DIR+'manifest.json').then(r=>{if(!r.ok)throw Error('http '+r.status);return r.json();}).then(m=>{this.manifest=m;this.manifestOk=Array.isArray(m?.tracks)&&m.tracks.length>0;if(!this.manifestOk)this.manifest=null;}).catch(()=>{this.manifestOk=false;}).finally(()=>{this.manifestLoading=false;
   if(this.pendingForce){this.pendingForce=false;this.forceShow();}}); // 清单就绪后补执行强制开演，避免误入排练模式
 }
 // —— 时刻表：本地时区今天/明天下一场（'YYYYMMDD|HH:MM' 去重键）——
 recomputeNext(now=Date.now()){this._d.setTime(now);const day0=this._d.getDate();let best=null;
  for(let day=0;day<2&&!best;day++)for(const [label,hh,mm] of SHOW_TIMES){
   if(day===0&&hh*3600+mm*60<this._d.getHours()*3600+this._d.getMinutes()*60+this._d.getSeconds()-60)continue; // 场次整分钟内都算“到点”（'YYYYMMDD|HH:MM' 去重）
   this._d.setDate(day0+day);this._d.setHours(hh,mm,0,0);
   const key=this._d.getFullYear()+p2(this._d.getMonth()+1)+p2(this._d.getDate())+'|'+label;
   if(this.started.has(key))continue;best={ms:this._d.getTime(),key,label};break;         // 已开过的场次跳过（含当日 done 后不再开）
  }
  this.next=best;}
 get performing(){return this.phase==='performing';}
 forceShow(){if(this.manifestLoading){this.pendingForce=true;return;}                  // 清单还在路上：就绪后再开（见 loadManifest）
  if(this.phase==='performing')this.endShow();this.startShow(true);}                   // ?showtest=1 验收：跳过预告
 startShow(test=false){
  this.token++;this.endAudio();this.test=test;this.phase='performing';
  this.showClock=0;this.clapUntil=0;this.trackIndex=0;this.noteIdx=-1;this.rehearsalClock=0;this.duration=0;this.onsets=null;this.onsetIdx=-1;this.nowPlaying=null;
  if(!this.manifestOk&&!this.manifestLoading)this.loadManifest();                           // 失败后每场再试一次（仅影响后续场次）
  // 选歌：按自 1970 起的本地天数轮转取 2 首 [i%N,(i+1)%N]；无清单 → 排练模式两首
  const tracks=this.manifest?.tracks?.length?this.manifest.tracks:null;
  if(tracks){this._d.setTime(Date.now());this._d.setHours(0,0,0,0);                        // 自 1970 起的本地天数
   const day=Math.floor(this._d.getTime()/864e5);
   this.pieces=[{...tracks[day%tracks.length]},{...tracks[(day+1)%tracks.length]}];}
  else this.pieces=[{title:'排练曲 · 一',duration:REHEARSAL_PIECE},{title:'排练曲 · 二',duration:REHEARSAL_PIECE}];
  this.campusMusic?.duck?.('performance',true);
  try{this.onShowStart?.();}catch{}
  this.playPiece(0);}
 playPiece(i){
  this.trackIndex=i;const piece=this.pieces[i];this.rehearsal=!piece?.file;
  this.nowPlaying={title:piece?.title||'现场演出',index:i,total:this.pieces.length,progress01:0};
  if(this.rehearsal){this.rehearsalClock=0;this.noteIdx=-1;this.srcActive=false;this.ensureAudio();return;}
  this.playToken=(this.playToken||0)+1;const token=this.playToken;                         // fetch/decode 竞态守卫
  this.srcActive=false;this.ensureAudio();
  const audio=this.audio;
  if(!audio){this.fallbackRehearsal();return;}
  fetch(PERF_DIR+encodeURI(piece.file)).then(r=>{if(!r.ok)throw Error('http '+r.status);return r.arrayBuffer();}).then(b=>audio.decodeAudioData(b)).then(buffer=>{
   if(token!==this.playToken||this.phase!=='performing')return;                            // 收场/换曲后丢弃迟到回调
   this.endAudio();const src=audio.createBufferSource();src.buffer=buffer;src.connect(this.songGain);
   this.duration=buffer.duration;this.songT0=audio.currentTime;this.src=src;this.srcActive=true;
   this.onsets=Array.isArray(piece.onsets)&&piece.onsets.length?piece.onsets:null;this.onsetIdx=-1;
   src.onended=()=>{if(token!==this.playToken)return;this.pieceDone();};                   // 自动下一首
   src.start(0);
  }).catch(()=>{if(token!==this.playToken||this.phase!=='performing')return;this.notice('曲目暂时不可用，本场改用排练模式');this.fallbackRehearsal();});}
 fallbackRehearsal(){ // 单曲加载失败：当前及余下场次换排练曲，灯/观众/收场流程不变
  this.pieces=this.pieces.slice(0,this.trackIndex).concat([{title:'排练曲 · 替场一',duration:REHEARSAL_PIECE},{title:'排练曲 · 替场二',duration:REHEARSAL_PIECE}]);
  this.playPiece(this.trackIndex);}
 pieceDone(){if(this.phase!=='performing')return;
  this.clapUntil=this.showClock+5;this.srcActive=false;this.src=null;this.progressResume=0; // 幕间鼓掌 5s
  if(++this.trackIndex>=this.pieces.length){this.endShow();return;}
  this.playPiece(this.trackIndex);}
 endShow(){if(this.phase!=='performing')return;
  this.token++;this.playToken=(this.playToken||0)+1;this.endAudio();this.phase='done';
  this.campusMusic?.duck?.('performance',false);
  try{this.onShowEnd?.();}catch{}
  this.dropStage();this.nowPlaying=null;this.onsets=null;this.duration=0;this.recomputeNext();}
 ensureAudio(){try{this.audio??=new (window.AudioContext||window.webkitAudioContext)();this.audio.resume().catch(()=>{});
  this.songGain??=this.audio.createGain();this.songGain.gain.value=this.distFactor;this.songGain.connect(this.audio.destination);}catch{this.audio=null;}
  return this.audio;}
 endAudio(){try{this.src?.stop();}catch{}this.src=null;this.srcActive=false;}
 // —— 每帧驱动：稳态路径零分配 ——
 tick(dt){
  if(!this.isBuilt()){if(this.phase==='performing')this.endShow();return;}                 // 音乐馆未建成则全程休眠
  dt=Math.min(dt,.1);
  const now=Date.now();
  if(this.phase!=='performing'){this.scheduleTick(now);return;}
  this.showClock+=dt;
  const p=this.position(),dist=Math.hypot(p.x-V.x,p.z-V.z);
  this.distFactor=dist<=FULL_DIST?1:dist>=FADE_DIST?.3:.3+(1-(dist-FULL_DIST)/(FADE_DIST-FULL_DIST))*.7;   // ≤25m 全响，25→130m 线性衰到 .3
  if(this.audio&&this.songGain)this.songGain.gain.setTargetAtTime(this.distFactor,this.audio.currentTime,.15);
  if(this.rehearsal)this.tickRehearsal(dt);
  else if(this.srcActive&&this.audio){const t=this.audio.currentTime-this.songT0;this.advanceOnsets(t);
   this.nowPlaying.progress01=this.duration?Math.min(1,t/this.duration):0;
   if(this.duration&&t>this.duration+2)this.pieceDone();}                                  // onended 兜底，防挂场
  if(this.phase!=='performing')return;                                                     // 本帧内收场后不得再重建舞台
  const near=dist<STAGE_DIST;
  if(near&&!this.stage)this.ensureStage();
  if(this.stage){this.stage.visible=near;
   if(!this.audience&&this.cloneSkeleton)this.buildAudience();                             // SkeletonUtils 就绪后补观众
   if(near&&this.audience)this.tickAudience(dt);}                                          // 离开 60m 自动收起（仅 visible 开关）
 }
 scheduleTick(now){
  if(!this.next||now>=this.next.ms)this.recomputeNext(now);
  const n=this.next;if(!n)return;
  if(now>=n.ms){if(!this.started.has(n.key)){this.started.add(n.key);this.startShow();}this.recomputeNext(now);return;}
  if(now>=n.ms-ANNOUNCE_SEC*1000&&!this.announced.has(n.key)){this.announced.add(n.key);this.phase='announced'; // 每场一次预告
   try{this.onAnnounce?.(Math.max(1,Math.round((n.ms-now)/1000)));}catch{}}}
 tickRehearsal(dt){this.rehearsalClock+=dt;
  const idx=Math.floor(this.rehearsalClock/REHEARSAL_BEAT);
  if(idx!==this.noteIdx){this.noteIdx=idx;this.tone(MELODY[idx%MELODY.length],idx%4===0);}   // 600ms 一音，循环旋律
  this.nowPlaying.progress01=Math.min(1,this.rehearsalClock/(this.pieces[this.trackIndex]?.duration||REHEARSAL_PIECE));
  if(this.rehearsalClock>=(this.pieces[this.trackIndex]?.duration||REHEARSAL_PIECE))this.pieceDone();}
 tone(pitch,accent){ // 三角波短音，写法对齐 programmes.js；音量随距离与配乐总开关
  const audio=this.audio,cm=this.campusMusic;
  if(!audio||audio.state!=='running')return;if(cm&&(cm.enabled===false||cm.masterOn===false))return;
  const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;o.type='triangle';
  o.frequency.value=440*2**((pitch+(accent?12:0)-69)/12);
  const vol=Math.max(.0002,.15*(cm?.volume??.8)*this.distFactor);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.48);
  o.connect(g);g.connect(audio.destination);o.onended=()=>{o.disconnect();g.disconnect();};o.start(t);o.stop(t+.5);}
 // —— 节拍出口：演出中由集成方接进活动系统上下文 ——
 advanceOnsets(t){const o=this.onsets;if(!o)return;while(this.onsetIdx+1<o.length&&o[this.onsetIdx+1]<=t)this.onsetIdx++;}
 beat(){if(this.phase!=='performing')return 0;
  if(this.rehearsal){const p=this.rehearsalClock%REHEARSAL_BEAT;return p<REHEARSAL_BEAT/2?1:0;} // 100bpm 方波脉冲
  if(!this.audio||!this.srcActive||!this.onsets)return 0;
  const t=this.audio.currentTime-this.songT0;this.advanceOnsets(t);
  return this.onsetIdx<0?Math.exp(-t*6):Math.exp(-(t-this.onsets[this.onsetIdx])*6);}      // 距最近 onset 指数衰减
 pianoRate(){if(this.phase!=='performing')return 3;
  if(this.rehearsal)return 3+7*Math.min(1,(1+Math.floor(this.rehearsalClock%2.4/REHEARSAL_BEAT))/4); // 假想节拍：2.4s 窗口 1..4 个 onset
  const o=this.onsets;if(!o||!this.audio||!this.srcActive)return 3;
  const t=this.audio.currentTime-this.songT0;let n=0;
  for(let j=this.onsetIdx;j>=0&&o[j]>t-2;j--)n++;                                          // 最近 2s 窗口 onset 数
  return 3+7*Math.min(1,n/16);}                                                            // 映射到 3..10
 // —— 舞台呈现：懒建一次，近远只切 visible ——
 ensureStage(){
  if(this.stage||!this.scene)return;
  const g=new T.Group();g.name='music-show-lights';this.scene.add(g);this.stage=g;
  const spot=new T.SpotLight(0xfff2d8,60,30,.5,.4);spot.position.set(V.x,7.5,V.z-3);spot.castShadow=false;
  spot.target.position.set(PIANO[0],PIANO[1],PIANO[2]);g.add(spot);g.add(spot.target);this.stageLights.push(spot);
  for(const dx of [-6.5,6.5]){const l=new T.PointLight(dx<0?0x64d2ff:0xff8fb1,12,14);l.position.set(V.x+dx,3.6,V.z-4.2);l.castShadow=false;g.add(l);this.stageLights.push(l);} // 舞台两侧
  const mic=new T.Group(),poleMat=new T.MeshStandardMaterial({color:0x2e3338,roughness:.6,metalness:.4}),popMat=new T.MeshStandardMaterial({color:0x3a4046,roughness:.9});
  const pole=new T.Mesh(new T.CylinderGeometry(.016,.02,1.5,10),poleMat);pole.position.y=.75;mic.add(pole);
  const pop=new T.Mesh(new T.SphereGeometry(.075,14,10),popMat);pop.position.y=1.56;mic.add(pop);                            // 防风球
  mic.position.set(V.x-2.6,0,V.z-5.9);mic.rotation.z=.09;mic.rotation.x=-.05;g.add(mic);                                     // 微倾，摆合唱位旁
  this.stageDisposables.push(pole.geometry,poleMat,pop.geometry,popMat);}
 buildAudience(){ // 克隆+缩放+坐姿，手法对齐 activities.js；缺资产/缺 clip 即跳过该座位
  if(!this.stage||!this.cloneSkeleton)return;const members=[];
  for(const [model,x,y,z,ry] of AUDIENCE_SEATS){
   const asset=this.characters?.[model],clips=asset?.clips||{};
   const sit=Object.values(clips).find(c=>/Sit_Chair_Idle|Sitting/.test(c.name));if(!asset?.scene||!sit)continue;
   const obj=this.cloneSkeleton(asset.scene),height=model.includes('Teacher')?1.7:1.62,box=new T.Box3().setFromObject(obj);
   obj.scale.setScalar(height/(box.max.y-box.min.y));
   const materials=new Set();obj.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);o.frustumCulled=false;o.castShadow=true;}});
   obj.position.set(x,y,z);obj.rotation.y=ry;this.stage.add(obj);
   const rest=clips.Natural_Seated ||= T.AnimationUtils.subclip(sit,sit.name+'_Rest',Math.floor(sit.duration*.62*30),Math.floor(sit.duration*.95*30),30); // 坐姿取后半段定镜
   const mixer=new T.AnimationMixer(obj),sitAction=mixer.clipAction(rest);sitAction.play();mixer.update(0);
   let hips=null;obj.traverse(o=>{if(!hips&&o.isBone&&/^hips|pelvis/i.test(o.name))hips=o;});
   if(hips){obj.updateMatrixWorld(true);const hip=hips.getWorldPosition(new T.Vector3());obj.position.y+=y+.58-hip.y;}         // 臀部落座高
   const clap=Object.values(clips).find(c=>/Clap|Clapping/.test(c.name));
   members.push({obj,mixer,materials,sitAction,clapAction:clap?mixer.clipAction(clap):null,current:sitAction,mode:'sit'});}
  this.audience=members;this.audienceN=members.length;}
 tickAudience(dt){ // 幕间鼓掌：clap 约 5s 再切回坐姿（无 clap clip 自动跳过）
  const clap=this.clapUntil>this.showClock;
  for(const m of this.audience){
   const want=clap&&m.clapAction?'clap':'sit';
   if(m.mode!==want){const next=want==='clap'?m.clapAction:m.sitAction;next.reset().play();if(m.current&&m.current!==next)next.crossFadeFrom(m.current,.25,false);m.current=next;m.mode=want;}
   m.mixer.update(dt);}}
 dropStage(){ // 清理口径参照 VenueActors.sync
  if(this.audience)for(const m of this.audience){m.mixer.stopAllAction();m.mixer.uncacheRoot(m.obj);m.materials.forEach(x=>x.dispose());m.obj.removeFromParent();}
  this.audience=null;this.audienceN=0;
  for(const l of this.stageLights){l.dispose?.();}
  for(const o of this.stageDisposables){o.geometry?.dispose?.();o.material?.dispose?.();}
  this.stageLights.length=0;this.stageDisposables.length=0;
  this.stage?.removeFromParent();this.stage=null;}
 // —— 面板/调试出口 ——
 describe(){
  if(!this.safeBuilt())return {times:SHOW_TIMES.map(t=>t[0]),nextShow:null,countdownSec:null,performing:false,nowPlaying:null};
  if(!this.next||Date.now()>=this.next.ms)this.recomputeNext();
  return {times:SHOW_TIMES.map(t=>t[0]),nextShow:this.next?.label||null,countdownSec:this.next?Math.max(0,Math.round((this.next.ms-Date.now())/1000)):null,
   performing:this.performing,nowPlaying:this.nowPlaying?{...this.nowPlaying}:null};}
 state(){
  if(!this.next||Date.now()>=this.next.ms)this.recomputeNext();
  return {built:this.safeBuilt(),phase:this.phase,test:this.test,manifestOk:this.manifestOk,tracksN:this.manifest?.tracks?.length||0,
   songs:this.pieces?.length||0,nowPlaying:this.nowPlaying?{...this.nowPlaying}:null,beat:this.beat(),pianoRate:this.pianoRate(),
   audienceN:this.audienceN,lightsOn:!!this.stage&&this.stage.visible,nextShow:this.next?.label||null,countdownSec:this.next?Math.max(0,Math.round((this.next.ms-Date.now())/1000)):null};}
 safeBuilt(){try{return !!this.isBuilt();}catch{return false;}}
}
