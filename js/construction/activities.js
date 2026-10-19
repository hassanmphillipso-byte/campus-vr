import * as T from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {characterBones,initSceneActivity,restoreSceneActivity,advanceSceneActivity,applySceneActivity,disposeSceneActivity,sceneActivityState} from '../npc_activities.js';
import {initNaturalMotion,restoreNaturalMotion,applyNaturalMotion} from '../npc_motion.js';

// Local coordinates, explicit jobs and authored clips; no random campus wanderers.
export const VENUE_CAST={
 classroom:[['林宁','自习同学','Girl_A','bench-read',-3,.0,-2.1,'sit'],['陈舟','作业同学','Boy_A','bench-read',3,0,.9,'sit'],['自习指导老师','答疑指导','Woman_Teacher','reviewer',-4.5,0,5,'stand']],
 gym:[['体育指导老师','热身指导','Man_Teacher','warmup-lead',-6,0,3.5,'stand'],['周启','拉伸训练','Boy_B','warmup',-5,0,-2,'stand'],['许然','拉伸训练','Girl_B','warmup',0,0,-2,'stand'],['何宇','拉伸训练','Boy_C','warmup',5,0,-2,'stand']],
 music:[['钢琴社同学','钢琴排练','Girl_C','pianist',-1,.7,-4.8,'sit'],['音乐指导老师','排练指导','Woman_Teacher','choir-lead',-4,.7,-6.3,'stand'],['合唱社同学甲','合唱排练','Boy_A','choir',3,.7,-6.3,'stand'],['合唱社同学乙','合唱排练','Girl_A','choir',5,.7,-6.3,'stand'],['欣赏社同学','观众','Boy_B','bench-rest',-3,0,-1,'sit']],
 pool:[['泳队指导老师','出发准备与计时','Man_Teacher','pool-prep',2.6,0,-2.1,'stand'],['泳队同学甲','下水前热身','Boy_B','warmup',-2.6,0,-2.1,'stand'],['泳队同学乙','下水前热身','Girl_B','warmup',0,0,-2.1,'stand']],
 tennis:[['球场指导老师','场地与器材指导','Man_Teacher','reviewer',5,0,8,'stand'],['网球社同学甲','赛前拉伸','Boy_C','warmup',-4,0,-6,'stand'],['网球社同学乙','赛前拉伸','Girl_C','warmup',4,0,6,'stand']],
 basketball:[['篮球指导老师','动作指导','Man_Teacher','basketball-coach',-2.5,0,5,'stand'],['篮球队同学','持球准备','Boy_B','dribble',0,0,-3,'stand'],['篮球记录同学','训练记录','Girl_A','rope-record',2.5,0,5,'stand']],
 // 电影馆：坐席坐标对齐 models.js 首排座椅（±2.95,-2.2）；站姿位在门厅带（台阶区之外）
 cinema:[['检票员同学','检票与引座','Boy_A','reviewer',2.2,0,4.4,'stand'],['放映员师傅','放映值守','Man_Teacher','reviewer',-3.8,0,4.6,'stand'],['观影同学甲','候场','Girl_A','bench-rest',2.95,0,-2.2,'sit'],['观影同学乙','候场','Boy_B','bench-rest',-2.95,0,-2.2,'sit']],
};
export function actorObstacles(v){return (VENUE_CAST[v.id]||[]).filter(s=>s[8]!=='sit').map(s=>{const f=v.facing||1,x=v.x+s[4]*f,z=v.z+s[6]*f;return {minX:x-.25,maxX:x+.25,minZ:z-.25,maxZ:z+.25,y0:s[5],y1:s[5]+1.7};});}
export class VenueActors{
 constructor(scene,assets,label,notice=()=>{}){this.scene=scene;this.assets=assets||{};this.label=label;this.notice=notice;this.loadErrors=new Map();this.groups=new Map();this.previous=performance.now();}
 sync(built){for(const [id,group] of this.groups)if(!built.includes(id)){for(const n of group.actors){disposeSceneActivity(n);n.mixer.uncacheRoot(n.obj);n.materials.forEach(m=>m.dispose());n.tag.material.map.dispose();n.tag.material.dispose();n.privateBall?.geometry.dispose();}group.root.removeFromParent();this.groups.delete(id);}}
 load(v){
  // Validate all shared resources before allocating a group; missing downloads must not stop the campus render loop.
  for(const spec of VENUE_CAST[v.id]||[]){
   const asset=this.assets[spec[2]],clip=Object.values(asset?.clips||{}).find(c=>spec[8]==='sit'?/Sit_Chair_Idle|Sitting/.test(c.name):/Idle/.test(c.name));
   if(!asset?.scene||!clip){const message=v.name+'人物资源暂未就绪，请刷新重试（'+spec[2]+'）';if(!this.loadErrors.has(v.id))this.notice(message);this.loadErrors.set(v.id,message);return null;}
  }
  this.loadErrors.delete(v.id);
  const root=new T.Group();root.name='venue-actors-'+v.id;this.scene.add(root);const actors=[];
  for(const spec of VENUE_CAST[v.id]||[]){
   const [name,role,model,profile,x,y,z,pose]=spec,asset=this.assets[model];if(!asset)throw Error('场馆人物资源缺失 '+model);
   const obj=cloneSkeleton(asset.scene),height=model.includes('Teacher')?1.7:1.62,box=new T.Box3().setFromObject(obj);obj.scale.setScalar(height/(box.max.y-box.min.y));const materials=new Set();
   obj.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);o.frustumCulled=false;o.castShadow=true;}});
   const f=v.facing||1;obj.position.set(v.x+x*f,y,v.z+z*f);obj.rotation.y=(f===-1?Math.PI:0)+(pose==='sit'?Math.PI:0);root.add(obj);
   const n={n:name,r:role,obj,height,B:characterBones(obj),b:pose==='sit'?'sitChair':'stand',materials,mixer:new T.AnimationMixer(obj)};
   let clip=Object.values(asset.clips).find(c=>pose==='sit'?/Sit_Chair_Idle|Sitting/.test(c.name):/Idle/.test(c.name));if(!clip)throw Error('缺少场馆待机动作 '+model);
   if(pose==='sit')clip=asset.clips.Natural_Seated ||= T.AnimationUtils.subclip(clip,clip.name+'_Rest',Math.floor(clip.duration*.62*30),Math.floor(clip.duration*.95*30),30);
   n.action=n.mixer.clipAction(clip);n.action.play();n.mixer.update(0);
   if(pose==='sit'){obj.updateMatrixWorld(true);const hip=n.B.hips.getWorldPosition(new T.Vector3());obj.position.y+=y+.58-hip.y;}
   initNaturalMotion(n);initSceneActivity(n,root,[v.id,profile]);
   // These small interiors have stationary workstations, not roaming patrols.
   if(profile==='dribble'){n.privateBall=new T.Mesh(new T.SphereGeometry(.12,16,12),new T.MeshStandardMaterial({color:0xbc6b30,roughness:.8}));root.add(n.privateBall);materials.add(n.privateBall.material);n.activity.plan=[['dribble',9],['rest',6]];}
   n.activity.plan=n.activity.plan.map(([kind,d])=>[['walk','patrol','run'].includes(kind)?'look':kind,d]);
   const tag=this.label(name+' · '+role,0,0,0,2.8);root.add(tag);n.tag=tag;actors.push(n);
  }
  const group={root,actors,visible:true};this.groups.set(v.id,group);return group;
 }
 tick(facilities,built,position,music,perf){
  const now=performance.now(),dt=Math.min(.05,(now-this.previous)/1000);this.previous=now;this.sync(built);
  for(const v of facilities){if(!built.includes(v.id))continue;const distance=Math.hypot(position.x-v.x,position.z-v.z),near=distance<45;let group=this.groups.get(v.id);if(!group&&near)group=this.load(v);if(!group)continue;group.root.visible=near;group.visible=near;if(!near)continue;
   for(const n of group.actors){restoreSceneActivity(n);restoreNaturalMotion(n);n.mixer.update(dt);advanceSceneActivity(n,dt);applyNaturalMotion(n,dt);
    const context={time:now/1000,music,pianoKeys:new T.Vector3(v.x-1,1.54,v.z-5.4),...(perf&&typeof perf==='object'?perf:{})};
    if(n.privateBall){const p=new T.Vector3(n.obj.position.x-.18,.2+(n.activity.kind==='dribble'?Math.abs(Math.sin(n.activity.localTime*3.8))*.62:0),n.obj.position.z+.3);n.privateBall.position.copy(p);context.practiceBall=()=>p;}
    // The practice ball is visual and never enters the player's scoring system.
    applySceneActivity(n,dt,context);
    n.obj.updateMatrixWorld(true);n.tag.position.copy(n.obj.position);n.tag.position.y=(n.B.head?.getWorldPosition(new T.Vector3()).y||n.height)+.36;n.tag.visible=distance<20;
   }
  }
 }
 snapshot(){return [...this.groups].map(([id,g])=>({id,visible:g.visible,actors:g.actors.map(n=>({...sceneActivityState(n),name:n.n,role:n.r,x:n.obj.position.x,y:n.obj.position.y,z:n.obj.position.z}))}));}
}
