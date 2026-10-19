import * as T from 'three';
import {campusMusic} from './campus_music.js';
import {FACILITIES} from './construction/catalog.js';
import {cinemaSeats} from './construction/models.js';
/* 电影馆放映系统（第7馆）：VideoTexture 上幕、距离音量、坐席入座、离馆自动停。
 * 红线遵守：不新增灯光；video 元素只在放映期间存在，stop() 即移除 src 释放内存。
 * 主线接线（见交付报告）：
 *   const {CampusCinema}=await import('./js/cinema.js'); cinema=new CampusCinema({scene,toast:showToast});
 *   主循环每帧 cinema.tick(dt,{x:player.position.x,z:player.position.z});
 *   action('cinema') 分支：window.__campusCinema?.openDialog()（或直接 cinema.openDialog()）。
 * scene 可省略：省略时不会自动扫描挂接，需外部 attach(场馆Group)（验收套件走这条路）。 */
export const CINEMA_FILMS=[
 {id:'bbb',title:'大雄兔 Big Buck Bunny',meta:'10 分钟 · CC-BY Blender 基金会',desc:'巨型兔子的温柔复仇喜剧'},
 {id:'tos',title:'钢之泪 Tears of Steel',meta:'12 分钟 · CC-BY Blender 基金会',desc:'阿姆斯特丹的科幻机甲大片'},
 {id:'ed',title:'大象之梦 Elephants Dream',meta:'11 分钟 · CC-BY Blender 基金会',desc:'世界第一部开源电影'},
];
const VIDEO_BASE='assets/video/cinema/';
export class CampusCinema{
 constructor({scene=null,toast=()=>{}}={}){
  this.scene=scene;this.toast=typeof toast==='function'?toast:()=>{};
  this.group=null;this.screen=null;this.screenWorld=null;this.center=null;this.seatList=null;
  this.video=null;this.texture=null;this.pending=null;this.playing=null;this.videoReady=false;
  this.seatTaken=null;this.failures=new Set();this.scanAt=0;this.clock=0;this.dialog=null;
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop();});
  addEventListener('pagehide',()=>this.stop());
  // 验收口 + 主线 action 分支直达：state 必备，其余为同名薄委托（避免暴露实例引用被外部改写内部状态）
  window.__campusCinema={state:()=>this.state(),openDialog:()=>this.openDialog(),play:id=>this.play(id),stop:()=>this.stop(),
   tick:(dt,p)=>this.tick(dt,p),seats:()=>this.seats(),sitAt:i=>this.sitAt(i),attach:g=>this.attach(g)};
 }
 /* —— 挂接：主线可在建成场景里传场馆Group；不传则用 scene 轻量节流扫描建设根 —— */
 attach(group){
  if(!group)return false;
  let screen=null;group.traverse(o=>{if(!screen&&(o.name==='cinema-screen'||o.userData?.screen))screen=o;});
  if(!screen)return false;
  this.stop(true);
  this.group=group;this.screen=screen;this.attached=true;
  this.screenWorld=screen.getWorldPosition(new T.Vector3());
  this.center=this.center||this.facilityCenter();
  return true;
 }
 ensureAttached(now=performance.now()){
  if(this.attached)return true;
  if(!this.scene||now-this.scanAt<2000)return false;
  this.scanAt=now;
  for(const root of this.scene.children){
   if(!root.isGroup)continue;
   for(const g of root.children)if(g.userData?.id==='cinema'&&g.userData.built)return this.attach(g);
  }
  return false;
 }
 facilityCenter(){const v=FACILITIES.find(f=>f.id==='cinema');return v?{x:v.x,z:v.z}:null;}
 detach(){this.stop(true);this.attached=false;this.group=this.screen=null;this.screenWorld=null;}
 /* —— 放映菜单（dialog 样式内联，视觉沿用场馆活动面板的中文 UI 风格） —— */
 openDialog(){
  if(!this.dialog){
   const d=document.createElement('dialog');
   d.setAttribute('aria-labelledby','cinemaTitle');
   d.style.cssText='width:min(680px,calc(100vw - 32px));box-sizing:border-box;max-height:calc(100dvh - 40px);overflow:auto;padding:26px;border:1px solid #c2d9d4;border-radius:20px;background:#f5f4e9;color:#183b35;font:16px/1.7 system-ui;touch-action:pan-y';
   d.addEventListener('cancel',e=>{e.preventDefault();this.closeDialog();});
   d.addEventListener('click',e=>{if(e.target===d)this.closeDialog();});
   for(const ev of ['pointerdown','pointerup','touchstart','touchend'])d.addEventListener(ev,e=>e.stopPropagation());
   document.body.append(d);this.dialog=d;
  }
  if(this.dialog.open)return;                       // 已开着时不重复 showModal（避免 InvalidStateError）
  this.renderDialog(true);this.dialog.showModal();this.dialog.querySelector('button')?.focus(); // force：showModal 前面板未 open，须绕过“仅开着时刷新”守卫
 }
 closeDialog(){if(this.dialog?.open)this.dialog.close();}
 el(tag,css,text){const e=document.createElement(tag);if(css)e.style.cssText=css;if(text!=null)e.textContent=text;return e;}
 renderDialog(force=false){
  const d=this.dialog;if(!d||(!d.open&&!force))return;   // 常规刷新仅在开着时；openDialog 强制渲染
  d.replaceChildren();
  const header=this.el('header','display:flex;gap:12px;align-items:center;justify-content:space-between;margin-bottom:14px');
  const title=this.el('h2','font-size:24px;margin:0','电影馆 · 开放放映');title.id='cinemaTitle';header.append(title);
  const close=this.el('button','font:inherit;background:#1d6657;color:#fff;border:0;border-radius:10px;min-height:40px;padding:8px 16px;cursor:pointer','关闭');
  close.onclick=()=>this.closeDialog();header.append(close);d.append(header);
  d.append(this.el('p','margin:0 0 14px;color:#2c5a50','三部 Blender 开源电影循环放映，坐到红绒座椅上即可观影；离开场馆放映自动停止。'));
  const list=this.el('div','display:grid;gap:10px');
  for(const film of CINEMA_FILMS){
   const card=this.el('article','border:1px solid #c9d6cd;border-radius:12px;background:#eef0e4;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px');
   const info=this.el('div');
   const failed=this.failures.has(film.id),active=this.playing?.id===film.id;
   info.append(this.el('h3','margin:0 0 4px;font-size:16px',failed?film.title+'（入库中）':film.title));
   info.append(this.el('div','font-size:13px;color:#47635b',film.meta));
   info.append(this.el('div','font-size:13px;color:#47635b',film.desc));
   const go=this.el('button',`font:inherit;border:0;border-radius:10px;min-height:42px;padding:10px 18px;cursor:pointer;background:${active?'#b98a1e':'#1d6657'};color:#fff${failed?';opacity:.5;cursor:not-allowed':''}`,active?'正在放映':failed?'影片正在入库':'放映');
   go.disabled=failed||active;go.dataset.film=film.id;
   go.onclick=()=>this.play(film.id);
   card.append(info,go);list.append(card);
  }
  d.append(list);
  const actions=this.el('div','display:flex;gap:12px;flex-wrap:wrap;margin-top:16px');
  const stopBtn=this.el('button','font:inherit;background:transparent;border:1px solid #1d6657;color:#1d6657;border-radius:10px;min-height:42px;padding:10px 18px;cursor:pointer','停止放映');
  stopBtn.disabled=!this.playing;stopBtn.onclick=()=>this.stop();actions.append(stopBtn);
  const sitBtn=this.el('button','font:inherit;background:transparent;border:1px solid #1d6657;color:#1d6657;border-radius:10px;min-height:42px;padding:10px 18px;cursor:pointer','入座观影 · 正对银幕');
  sitBtn.disabled=!this.playing;sitBtn.onclick=()=>{this.closeDialog();this.onSit?.();};actions.append(sitBtn);d.append(actions);
  const status=this.el('p','min-height:1.6em;margin:12px 0 0;font-size:13px;color:#47635b','自由观影不授星、不发金币。');
  status.setAttribute('role','status');
  if(this.playing){const f=CINEMA_FILMS.find(x=>x.id===this.playing.id);status.textContent=`正在放映《${f?f.title:this.playing.id}》 · ${Math.floor(this.playing.at/60)}:${String(Math.floor(this.playing.at%60)).padStart(2,'0')}（音量随离银幕距离衰减）`;}
  d.append(status);
 }
 /* —— 放映：video 元素随播随建、随停随删（404→失败标记，不抛错） —— */
 play(id){
  const film=CINEMA_FILMS.find(f=>f.id===id);if(!film)return;
  if(!this.attached&&!this.ensureAttached())return void this.toast('电影馆尚未建设，请先在建设面板建馆');
  if(this.failures.has(id))return void this.toast('影片正在入库，稍后再来');
  this.stop(true);
  const video=document.createElement('video');
  video.src=VIDEO_BASE+id+'.mp4';video.playsInline=true;video.loop=true;video.preload='auto';
  video.style.display='none';document.body.append(video);
  this.video=video;this.pending=id;
  video.addEventListener('error',()=>{
   if(this.video!==video&&this.pending!==id)return;
   this.failures.add(id);this.toast('影片正在入库，稍后再来');this.stop(true);this.renderDialog();
  },{once:true});
  video.addEventListener('canplay',()=>{
   if(this.video!==video||this.pending!==id)return;
   const texture=new T.VideoTexture(video);texture.colorSpace=T.SRGBColorSpace;
   this.texture=texture;this.screen.material.map=texture;this.screen.material.color.set('#ffffff');this.screen.material.needsUpdate=true;
   this.pending=null;this.videoReady=true;this.playing={id,at:0,duration:video.duration||0};
   video.play().catch(()=>this.toast('浏览器拦截了自动播放，可再点一次“放映”'));
   campusMusic.duck('cinema',true);           // 压低校园配乐给电影让路
   this.renderDialog();
  },{once:true});
 }
 stop(quiet=false){
  this.pending=null;this.videoReady=false;
  if(this.video){try{this.video.pause();}catch{}this.video.removeAttribute('src');this.video.load();this.video.remove();this.video=null;}
  if(this.texture){this.texture.dispose();this.texture=null;}
  if(this.screen){this.screen.material.map=null;this.screen.material.color.set('#2e3036');this.screen.material.needsUpdate=true;}
  const was=!!this.playing;this.playing=null;campusMusic.duck('cinema',false);
  if(was&&!quiet)this.toast('放映已停止');
  this.renderDialog();
 }
 /* —— 坐席：世界坐标由 models.js 同源布局换算；sitAt 供主线把玩家固定到座椅并朝向银幕 —— */
 seats(){if(!this.seatList){const v=FACILITIES.find(f=>f.id==='cinema');this.seatList=v?cinemaSeats(v):[];}return this.seatList;}
 sitAt(i){
  const seats=this.seats();
  if(i===null||i===undefined){this.seatTaken=null;return null;}
  const s=seats[i];if(!s)return null;
  this.seatTaken=i;return {x:s.x,y:s.y,z:s.z,yaw:s.yaw,row:s.row};
 }
 /* —— 每帧轻量 tick（主线调用）：进度/音量每秒一更；离馆>40m 自动停 —— */
 tick(dt,playerPos=null){
  if(!this.attached)this.ensureAttached();
  if(!this.playing)return;
  this.clock+=(dt||0);
  if(this.video){this.playing.at=this.video.currentTime||0;this.playing.duration=this.video.duration||this.playing.duration;}
  if(this.clock<1)return;
  this.clock=0;
  const center=this.center||this.facilityCenter();
  if(playerPos&&center){
   if(Math.hypot(playerPos.x-center.x,playerPos.z-center.z)>40){this.stop();this.toast('已离开电影馆，放映自动停止');return;}
   if(this.video&&this.screenWorld){
    const d=Math.hypot(playerPos.x-this.screenWorld.x,playerPos.z-this.screenWorld.z);
    this.video.volume=Math.max(0,Math.min(1,1/(1+d/18)));   // 音量=1/(1+距银幕米数/18)
   }
  }
  this.renderDialog();
 }
 state(){if(this.playing&&this.video){this.playing.at=this.video.currentTime||this.playing.at;this.playing.duration=this.video.duration||this.playing.duration;}   // live 读数：主线漏挂 tick 时进度也不失真
  return {attached:!!this.attached,videoReady:!!this.videoReady,playing:this.playing?{...this.playing}:null,seatTaken:this.seatTaken,failures:[...this.failures]};}
}
