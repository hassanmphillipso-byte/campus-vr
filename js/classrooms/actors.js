import * as T from 'three';
import {attachCast,detachCast,updateCastMixer,installCastControls} from '../campus_cast.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as skeletonClone} from 'three/addons/utils/SkeletonUtils.js';
import {initNaturalMotion,restoreNaturalMotion,applyNaturalMotion} from '../npc_motion.js';
import {characterBones,initSceneActivity,restoreSceneActivity,advanceSceneActivity,applySceneActivity,sceneActivityState,disposeSceneActivity} from '../npc_activities.js';

export const ROOM_CAST={
 '1-1':['测速助教','lab-timer','Man_Teacher'],
 '1-2':['排名核验员','reviewer','Woman_Teacher'],
 '1-3':['泳道实验员','lab-measure','Girl_A'],
 '1-4':['分组审核员','reviewer','Man_Teacher'],
 '2-1':['数据记录员','analyst','Boy_A'],
 '2-2':['成绩登记员','registrar','Woman_Teacher'],
 '2-3':['统计研讨助教','analyst','Man_Teacher'],
 '2-4':['荣誉资料管理员','reviewer','Woman_Teacher'],
 '2-5':['逻辑设备实验员','technician','Boy_A'],
 '3-1':['计数训练助教','lab-timer','Woman_Teacher'],
 '3-2':['耐力训练记录员','lab-timer','Man_Teacher'],
 '3-3':['设备检修员','technician','Man_Teacher'],
 '3-4':['毕业项目助教','programmer','Woman_Teacher'],
 '3-5':['巡回训练指导员','lab-timer','Woman_Teacher'],
 archive:['成绩档案管理员','archivist','Woman_Teacher'],
 'exam-1':['运算考核教师','reviewer','Man_Teacher'],
 'exam-2':['数据答辩教师','reviewer','Woman_Teacher'],
 'exam-3':['成果评审教师','analyst','Man_Teacher'],
};

export async function loadRoomCharacters(){
 installCastControls();
 const result={};await Promise.all(['Boy_A','Girl_A','Man_Teacher','Woman_Teacher'].map(async id=>{
  const gltf=await new GLTFLoader().loadAsync('assets/characters_hs/'+id+'.glb');
  result[id]={scene:gltf.scene,clips:Object.fromEntries(gltf.animations.map(c=>[c.name,c]))};
 }));return result;
}

export function buildRoomActors(characters,room,wing,group,colliders){
 const spec=room?ROOM_CAST[room.id]:['教学区值日教师','lesson-prep','Woman_Teacher'];
 if(!spec)throw Error('未分配教室人物 '+room?.id);
 const [name,profile,model]=spec,asset=characters[model],obj=skeletonClone(asset.scene);
 const bb=new T.Box3().setFromObject(obj),height=model.includes('Teacher')?1.68:1.61;
 obj.scale.setScalar(height/(bb.max.y-bb.min.y));obj.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false;}});
 const candidates=room?[[3.2,-.8],[-3.2,-.8],[3.2,1.6],[-3.2,1.6],[3.2,2.7],[-3.2,2.7],[2.7,2.7],[-2.7,2.7]]:[[1.65,1.8]];
 const clear=([x,z])=>!colliders.some(c=>c.y+c.h/2>.2&&c.y-c.h/2<1.7&&Math.abs(x-c.x)<c.w/2+.30&&Math.abs(z-c.z)<c.d/2+.30);
 let location=candidates.find(clear);
 if(!location){
  for(let z=2.7;z>-3;z-=.4){for(const x of [-3.3,3.3,-2.8,2.8])if(clear([x,z])){location=[x,z];break;}if(location)break;}
 }
 if(!location)throw Error('教室人物无安全位置 '+room?.id);
 obj.position.set(location[0],0,location[1]);obj.rotation.y=location[0]>0?-Math.PI/3:Math.PI/3;group.add(obj);
 const n={n:name+' · '+(room?.number||('教学区'+wing)),r:name,m:model,b:'stand',state:'idle',height,obj,B:characterBones(obj),mixer:new T.AnimationMixer(obj)};
 const clip=asset.clips.Man_Idle||asset.clips.Female_Idle;n.action=n.mixer.clipAction(clip);n.action.play();
 initNaturalMotion(n);n.action.time=n.motion.phase/(Math.PI*2)*clip.duration;n.mixer.update(0);
 initSceneActivity(n,group,[room?.id||('corridor-'+wing),profile]);
 colliders.push({x:location[0],y:.85,z:location[1],w:.56,h:1.7,d:.56});
 // Only teaching roles whose held-note gestures are verified. Specialists
 // retain their original clothing and motions until dedicated assets exist.
 const castId=!room?'teacher-04':(['1-2','1-4','2-2','2-3','3-4','exam-1','exam-2','exam-3'].includes(room.id)&&model.includes('Teacher')?(model==='Man_Teacher'?'teacher-02':'teacher-01'):null);
 if(castId)void attachCast(n,castId);
 let previous=performance.now();
 return {
  state:()=>[{...sceneActivityState(n),role:name,model:n.cast?.variant||model,clip:n.action.getClip().name}],
  tick(now){const dt=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;
   restoreSceneActivity(n);restoreNaturalMotion(n);updateCastMixer(n,dt);advanceSceneActivity(n,dt);applyNaturalMotion(n,dt);applySceneActivity(n,dt);
  },
  dispose(){n.castDisposed=true;detachCast(n);disposeSceneActivity(n);obj.removeFromParent();n.mixer.uncacheRoot(obj);},
 };
}
