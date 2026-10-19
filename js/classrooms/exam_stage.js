import * as T from 'three';

// A quiet, text-free environment for the instruments. This is scenery, not a task map.
export function createExamStage(lv){
  const palette=lv===1?{sky:0x9abac0,land:0x6b8e73,rock:0x506b68,stone:0xccd5be,leaf:0x3c6b57,light:0xe7c887}
    :lv===2?{sky:0xbdabb0,land:0xa99674,rock:0x776b67,stone:0xe7cbb0,leaf:0x6c7961,light:0xffd289}
    :{sky:0x587e90,land:0x5a7c81,rock:0x3c5967,stone:0xa6bebd,leaf:0x456f72,light:0x9debdc};
  const root=new T.Group(),materials=new Map();
  const mat=color=>{if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.9}));return materials.get(color);};
  const mesh=(geometry,color,x,y,z)=>{const m=new T.Mesh(geometry,mat(color));m.position.set(x,y,z);root.add(m);return m;};
  const box=(x,y,z,w,h,d,color)=>mesh(new T.BoxGeometry(w,h,d),color,x,y,z);
  const cylinder=(x,y,z,r1,r2,h,color,n=24)=>mesh(new T.CylinderGeometry(r1,r2,h,n),color,x,y,z);
  // Terraced island and a circular instrument court.
  cylinder(0,-1.65,0,11.5,8.4,2.6,palette.rock,12);
  cylinder(0,-.4,0,11.7,11.4,.5,palette.land,48);
  cylinder(0,-.14,0,6.3,6.5,.18,palette.stone,64);
  cylinder(0,-.05,0,5.85,5.85,.1,palette.rock,64);
  // A walkway and paired beacons frame the distant gateway.
  for(let i=0;i<7;i++)box(0,-.1,-6.3-i*.65,2.7,.18,.48,palette.stone);
  for(const x of [-3.9,3.9]){
    box(x,2.15,-8.3,.62,5.1,.75,palette.stone);
    box(x,4.8,-8.3,.86,.25,1,palette.stone);
    cylinder(x,5.18,-8.3,.25,.32,.4,palette.light,12);
  }
  box(0,4.45,-8.3,8.4,.55,.75,palette.stone);
  for(const x of [-5.6,5.6])for(const z of [-3,3]){
    cylinder(x,.2,z,.22,.42,.7,palette.stone,8);
    const orb=mesh(new T.IcosahedronGeometry(.26,1),palette.light,x,.76,z);
    orb.material=new T.MeshStandardMaterial({color:palette.light,emissive:palette.light,emissiveIntensity:.45});
  }
  // Deterministic planting: decorative objects never encode the answer.
  for(let i=0;i<13;i++){
    const angle=i/13*Math.PI*2,x=Math.cos(angle)*9.5,z=Math.sin(angle)*9.5;
    if(Math.abs(x)<3&&z<0)continue;
    const h=1.7+(i%3)*.5;
    cylinder(x,h/2-.25,z,.13,.23,h,0x657060,7);
    mesh(new T.IcosahedronGeometry(.95+(i%2)*.25,1),palette.leaf,x,h+.15,z);
    mesh(new T.IcosahedronGeometry(.6,0),palette.leaf,x+.55,h-.3,z+.2);
  }
  for(let i=0;i<10;i++){
    const angle=i/10*Math.PI*2,dist=25+(i%3)*8;
    cylinder(Math.cos(angle)*dist,-3-(i%4),Math.sin(angle)*dist,4+i%3,1.5,7+i%3,palette.rock,7);
    cylinder(Math.cos(angle)*dist,.55-(i%4),Math.sin(angle)*dist,4.15+i%3,4+i%3,.3,palette.land,7);
  }
  const water=mesh(new T.PlaneGeometry(180,180),lv===2?0x9cabb0:0x6d9da4,0,-8,0);water.rotation.x=-Math.PI/2;
  return {root,sky:palette.sky,dispose(){
    const geometries=new Set(),mats=new Set(materials.values());
    root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)mats.add(o.material);});
    geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());root.removeFromParent();
  }};
}
