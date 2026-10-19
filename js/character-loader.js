/** Integration helper: imported by the main engineer, not installed into the campus. */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
export const BONE_NAMES={hips:'J_Bip_C_Hips',spine:'J_Bip_C_Spine',torso:'J_Bip_C_UpperChest',head:'J_Bip_C_Head',lArm:'J_Bip_L_UpperArm',rArm:'J_Bip_R_UpperArm',lFore:'J_Bip_L_LowerArm',rFore:'J_Bip_R_LowerArm',lHand:'J_Bip_L_Hand',rHand:'J_Bip_R_Hand',lThigh:'J_Bip_L_UpperLeg',rThigh:'J_Bip_R_UpperLeg',lShin:'J_Bip_L_LowerLeg',rShin:'J_Bip_R_LowerLeg',lFoot:'J_Bip_L_Foot',rFoot:'J_Bip_R_Foot'};
const pending=new Map(),loader=new GLTFLoader();
export async function loadCharacter({url,height=1.7,castShadow=true}){
 if(!pending.has(url))pending.set(url,loader.loadAsync(url).catch(e=>{pending.delete(url);throw e}));
 const asset=await pending.get(url),model=cloneSkeleton(asset.scene),root=new THREE.Group();
 // Clone materials per person; meshes/textures remain cached and shared.
 model.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();o.castShadow=castShadow;o.frustumCulled=false;}});
 const box=new THREE.Box3().setFromObject(model),naturalHeight=box.max.y-box.min.y;
 if(!(naturalHeight>0))throw Error('Invalid character bounds '+url);
 const scale=height/naturalHeight;model.scale.multiplyScalar(scale);model.position.y-=box.min.y*scale;root.add(model);
 const bones=Object.fromEntries(Object.entries(BONE_NAMES).map(([key,name])=>[key,model.getObjectByName(name)]));
 for(const [key,bone] of Object.entries(bones))if(!bone?.isBone)throw Error('Missing bone '+key+' in '+url);
 const mixer=new THREE.AnimationMixer(model),clips=Object.fromEntries(asset.animations.map(c=>[c.name,c]));let current=null,disposed=false;
 function play(name='Idle',fade=.15){if(!clips[name])throw Error('Unavailable clip '+name);const next=mixer.clipAction(clips[name]);if(current===next)return;next.reset().play();if(current){next.crossFadeFrom(current,fade,false);}current=next;}
 function expression(name,value){model.traverse(o=>{const i=o.morphTargetDictionary?.[name];if(i!==undefined)o.morphTargetInfluences[i]=THREE.MathUtils.clamp(value,0,1)});}
 play('Idle');mixer.update(0);
 return {root,model,bones,mixer,clips,play,expression,
  update(dt){if(!disposed)mixer.update(Math.min(.1,Math.max(0,dt)));},
  dispose(){if(disposed)return;disposed=true;mixer.stopAllAction();mixer.uncacheRoot(model);root.removeFromParent();model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});},
 };
}
