import * as T from '../../vendor/three/build/three.module.js';
import {mergeGeometries} from '../../vendor/three/examples/jsm/utils/BufferGeometryUtils.js';
// Merge only within one movable facility. Its root, colliders and sprites stay independent.
export function batchFacility(group){
 group.updateMatrixWorld(true);
 const buckets=new Map();
 for(const mesh of [...group.children]){
  if(!mesh.isMesh||Array.isArray(mesh.material))continue;
  const key=mesh.material.uuid+':'+mesh.castShadow+':'+mesh.receiveShadow;
  if(!buckets.has(key))buckets.set(key,[]);
  buckets.get(key).push(mesh);
 }
 for(const meshes of buckets.values()){
  if(meshes.length<2)continue;
  const transformed=meshes.map(m=>m.geometry.clone().applyMatrix4(m.matrix));
  const geometry=mergeGeometries(transformed,false);
  transformed.forEach(g=>g.dispose());
  if(!geometry)continue;
  const first=meshes[0],merged=new T.Mesh(geometry,first.material);
  merged.castShadow=first.castShadow;merged.receiveShadow=first.receiveShadow;
  const old=new Set();for(const m of meshes){old.add(m.geometry);group.remove(m);}old.forEach(g=>g.dispose());
  group.add(merged);
 }
 return group;
}
