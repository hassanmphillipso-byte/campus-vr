import * as T from 'three';
import {loadCharacter} from './character-loader.js';
import {restoreNaturalMotion,initNaturalMotion} from './npc_motion.js';
import {restoreSceneActivity} from './npc_activities.js';

// Explicitly reviewed scope: no seated people, sports participants, younger
// pupils or unsupported professional clothing. Names and activities stay intact.
export const CAST_MODELS={
 '胡博文':'student-03','陈雨欣':'student-04','孙梦洁':'student-05',
 '万老师':'teacher-01','李老师':'teacher-02','胡老师':'teacher-04',
 '邓老师':'teacher-01','张守安':'security-01','林小雨':'teacher-04',
};
const params=new URLSearchParams(location.search);
function saved(key,fallback){try{return localStorage.getItem(key)||fallback;}catch{return fallback;}}
export const castMode=(params.get('cast')||saved('campusCastMode','v02'))==='legacy'?'legacy':'v02';
export const castPalette=(params.get('uniform')||saved('campusCastPalette','blue'))==='yellow'?'yellow':'blue';
const active=new Set();let loading=0;
const errors=[];
export function castVariant(id){return id.startsWith('student-')?`${id}-${castPalette}`:id;}
export async function attachCast(n,id){
 if(castMode==='legacy'||n.cast||n.castLoading||n.castDisposed)return;
 n.castLoading=true;loading++;
 try{
  const variant=castVariant(id),actor=await loadCharacter({url:`assets/campus-cast/${variant}.glb`,height:n.height,castShadow:false});
  if(n.castDisposed||n.castCancelled){actor.dispose();return;}
  restoreSceneActivity(n);restoreNaturalMotion(n);
  const visibility=[];n.obj.traverse(o=>{if(o.isMesh){visibility.push([o,o.visible]);o.visible=false;}});
  const original={mixer:n.mixer,action:n.action,B:n.B,motion:n.motion,visibility};
  actor.root.scale.set(1/n.obj.scale.x,1/n.obj.scale.y,1/n.obj.scale.z);
  n.obj.add(actor.root);actor.mixer.stopAllAction();
  n.cast={actor,variant,original,elapsed:0,updates:0};n.B=actor.bones;n.mixer=actor.mixer;n.shadowNear=undefined;
  const oldClip=original.action?.getClip().name||'';
  n.action=n.mixer.clipAction(actor.clips[/Run/.test(oldClip)?'Run':/Walk/.test(oldClip)?'Walk':'Idle']).play();
  initNaturalMotion(n);n.action.time=n.motion.phase/6.283*n.action.getClip().duration;
  n.mixer.update(0);n.activity?.base.clear();n.activity?.previousPose?.clear();
  createAccessories(n);
  active.add(n);
 }catch(e){errors.push({name:n.n,message:String(e)});console.warn('[campus-cast] 保留原角色',n.n,e);n.castFailed=true;}
 finally{loading--;n.castLoading=false;}
}
export function detachCast(n){
 n.castCancelled=true;
 if(!n.cast)return;
 restoreSceneActivity(n);restoreNaturalMotion(n);
 const {actor,original}=n.cast;
 for(const p of n.cast.accessories){p.geometry.dispose();p.material.dispose();}
 actor.dispose();
 for(const [mesh,visible] of original.visibility)mesh.visible=visible;
 n.mixer=original.mixer;n.action=original.action;n.B=original.B;n.motion=original.motion;n.shadowNear=undefined;
 n.activity?.base.clear();n.activity?.previousPose?.clear();n.cast=null;active.delete(n);
}
function createAccessories(n){
 const c=n.cast;c.accessories=[];
 function add(name,geometry,color){const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.85}));mesh.name=name;c.actor.root.add(mesh);c.accessories.push(mesh);return mesh;}
 if(n.r?.includes('学生'))add('school-badge',new T.BoxGeometry(.055,.085,.012),0xf2f2e5);
 if(n.bag)add('school-bag',new T.BoxGeometry(.26,.32,.14),n.castIdentity?.bagCol||0x34527c);
 if(n.castIdentity?.armband)add('duty-armband',new T.CylinderGeometry(.073,.073,.075,16,1,true),n.castIdentity.armband);
}
// Props use world bone positions and actor directions, never Quaternius offsets.
export function updateCastAccessories(n){
 if(!n.cast)return;
 const {actor,accessories}=n.cast;n.obj.updateWorldMatrix(true,true);
 const facing=n.obj.getWorldQuaternion(new T.Quaternion());
 for(const p of accessories){
  let point=n.B.torso.getWorldPosition(new T.Vector3());
  if(p.name==='duty-armband'){
   const shoulder=n.B.lArm.getWorldPosition(new T.Vector3()),elbow=n.B.lFore.getWorldPosition(new T.Vector3());point=shoulder.clone().lerp(elbow,.32);
   p.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),elbow.sub(shoulder).normalize()).premultiply(actor.root.getWorldQuaternion(new T.Quaternion()).invert());
  }else{
   point.add(new T.Vector3(p.name==='school-badge'?.07:0,-.10,p.name==='school-badge'?.12:-.15).applyQuaternion(facing));
   p.quaternion.copy(actor.root.getWorldQuaternion(new T.Quaternion()).invert().multiply(facing));
  }
  p.position.copy(actor.root.worldToLocal(point));
 }
}
export function updateCastMixer(n,dt,distance=0){
 if(!n.cast){n.mixer.update(dt);return;}
 const c=n.cast;c.elapsed+=dt;
 // Nearby gestures update every frame; distant skeletons at 15 Hz.
 if(distance<12||c.elapsed>=1/15){n.mixer.update(c.elapsed);c.elapsed=0;c.updates++;}
}
let last=0;
export function updateCampusCast(people,player,now){
 if(castMode==='legacy'||now-last<.3)return;last=now;
 const candidates=people.filter(n=>CAST_MODELS[n.n]).map(n=>({n,d:n.obj.position.distanceTo(player.position)})).sort((a,b)=>a.d-b.d);
 const wanted=new Set(candidates.filter(x=>x.d<24).slice(0,6).map(x=>x.n));
 for(const {n,d} of candidates){
  if(n.cast&&(!wanted.has(n)&&d>28))detachCast(n);
  if(!wanted.has(n)&&n.castLoading)n.castCancelled=true;
 }
 for(const {n} of candidates){
  if(loading>=2||active.size+loading>=6)break;
  if(wanted.has(n)&&!n.cast&&!n.castLoading&&!n.castFailed){n.castCancelled=false;void attachCast(n,CAST_MODELS[n.n]);}
 }
}
export function castState(){return {mode:castMode,palette:castPalette,loading,limit:6,errors:[...errors],active:[...active].map(n=>({name:n.n,variant:n.cast.variant,height:n.height,clip:n.action?.getClip().name,rootScale:n.obj.scale.toArray(),modelScale:n.cast.actor.root.scale.toArray(),position:n.obj.position.toArray(),accessories:n.cast.accessories.map(p=>p.name),updates:n.cast.updates,bones:Object.fromEntries(Object.entries(n.B).map(([k,b])=>[k,b.name])),feet:['lFoot','rFoot'].map(k=>n.B[k].getWorldPosition(new T.Vector3()).y),head:n.B.head.getWorldPosition(new T.Vector3()).y}))};}
window.__campusCast={state:castState};
export function installCastControls(){
 if(document.getElementById('castOptions'))return;
 const box=document.createElement('details');box.id='castOptions';
 box.style.cssText='position:fixed;right:16px;top:112px;z-index:65;color:#eaf3f9;background:#162b3bee;border:1px solid #7f9bb055;border-radius:12px;padding:9px 12px;font:13px system-ui;max-width:240px';
 box.innerHTML=`<summary style="cursor:pointer">人物外观</summary><div style="display:grid;gap:9px;padding-top:12px"><label>模型 <select id="castMode"><option value="v02">校园人物 v0.2</option><option value="legacy">原版人物</option></select></label><label>新校服 <select id="castPalette"><option value="blue">蓝色</option><option value="yellow">黄色</option></select></label><small>切换会重新载入当前页面。特殊动作和未配装岗位保留原人物。</small><a href="assets/campus-cast/README.md" target="_blank" style="color:#a8d7ed">人物来源与制作版说明</a></div>`;
 for(const event of ['keydown','pointerdown','click'])box.addEventListener(event,e=>e.stopPropagation());
 document.body.appendChild(box);
 const mode=box.querySelector('#castMode'),palette=box.querySelector('#castPalette');mode.value=castMode;palette.value=castPalette;
 function change(){try{localStorage.setItem('campusCastMode',mode.value);localStorage.setItem('campusCastPalette',palette.value);}catch{}const url=new URL(location.href);url.searchParams.set('cast',mode.value);url.searchParams.set('uniform',palette.value);location.assign(url);}
 mode.onchange=palette.onchange=change;
}
