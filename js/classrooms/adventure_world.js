import * as T from 'three';
import {landingY} from './adventure_sim.js';

const PLACES={basic:[-7,0,-3],blocks:[7,0,-3],fighter:[0,0,7]};
const COLORS=[0x81e0d0,0xf6c879,0xc5b5f5];
export class AdventureWorld{
 constructor(environment){
  this.scene=new T.Scene();this.scene.background=new T.Color(0x183a50);this.scene.fog=new T.Fog(0x183a50,38,110);
  this.scene.environment=environment;this.scene.environmentIntensity=.25;
  this.camera=new T.PerspectiveCamera(44,1,.1,160);this.camera.position.set(21,27,32);this.camera.lookAt(0,0,0);
  this.scene.add(new T.HemisphereLight(0xc7f2ff,0x18372e,2));const sun=new T.DirectionalLight(0xffe4b8,3);sun.position.set(-12,20,12);this.scene.add(sun);
  this.root=new T.Group();this.scene.add(this.root);this.materials=new Map();this.geometries=new Set();this.extraMats=new Set();this.textures=new Set();this.mode='';this.actorMeshes=new Map();this.transient=[];
 }
 mat(color){if(!this.materials.has(color))this.materials.set(color,new T.MeshStandardMaterial({color,roughness:.63,metalness:.12}));return this.materials.get(color);}
 mesh(geo,color,x,y,z,parent=this.root){this.geometries.add(geo);const m=new T.Mesh(geo,this.mat(color));m.position.set(x,y,z);parent.add(m);return m;}
 box(x,y,z,w,h,d,color,parent){return this.mesh(new T.BoxGeometry(w,h,d),color,x,y,z,parent);}
 ball(x,y,z,r,color,parent){return this.mesh(new T.IcosahedronGeometry(r,1),color,x,y,z,parent);}
 cylinder(x,y,z,r1,r2,h,color,parent){return this.mesh(new T.CylinderGeometry(r1,r2,h,8),color,x,y,z,parent);}
 label(text,x,y,z,width=4,color='#eafcff',parent=this.root){
  const lines=text.split('\n'),cv=document.createElement('canvas'),c=cv.getContext('2d');c.font='500 42px monospace';cv.width=Math.min(1024,Math.max(128,...lines.map(line=>Math.ceil(c.measureText(line).width+40))));cv.height=Math.max(84,lines.length*54+24);
  c.fillStyle='rgba(10,30,43,.94)';c.beginPath();c.roundRect(0,0,cv.width,cv.height,14);c.fill();c.fillStyle=color;c.font='500 42px monospace';c.textBaseline='middle';c.textAlign='center';lines.forEach((s,i)=>c.fillText(s,cv.width/2,42+i*54,cv.width-30));
  const tx=new T.CanvasTexture(cv);tx.colorSpace=T.SRGBColorSpace;this.textures.add(tx);const mat=new T.SpriteMaterial({map:tx,depthTest:false});this.extraMats.add(mat);const s=new T.Sprite(mat);s.position.set(x,y,z);const height=Math.min(lines.length===1?1.05:2.6,width*cv.height/cv.width);s.scale.set(height*cv.width/cv.height,height,1);parent.add(s);return s;
 }
 clear(){this.root.clear();this.geometries.forEach(g=>g.dispose());this.geometries.clear();this.extraMats.forEach(m=>m.dispose());this.extraMats.clear();this.textures.forEach(t=>t.dispose());this.textures.clear();this.actorMeshes.clear();this.transient=[];this.signature='';}
 island(x,z,color){this.cylinder(x,-1.3,z,4.5,1.9,3.2,0x263e50);this.cylinder(x,.25,z,4.6,4.5,.35,color);this.cylinder(x,.46,z,3.8,3.9,.08,0x2c5360);}
 ship(color,parent=this.root,small=false){
  const g=new T.Group();parent.add(g);this.box(0,.15,0,.45,.32,1.7,color,g);const wing=this.box(0,0,.25,1.65,.13,.62,color,g);wing.rotation.y=.08;
  this.box(0,.4,-.3,.3,.28,.55,0x9fe9ed,g);this.box(-.45,.1,.8,.18,.2,.6,0xf6c879,g);this.box(.45,.1,.8,.18,.2,.6,0xf6c879,g);
  this.ball(-.45,.05,1.12,.13,0x70e6ff,g);this.ball(.45,.05,1.12,.13,0x70e6ff,g);if(small)g.scale.setScalar(.7);return g;
 }
 map(a,home=false){
  this.mode='map';this.clear();this.scene.background.set(0x183a50);this.camera.position.set(21,27,32);this.camera.lookAt(0,0,0);
  for(const [i,key] of ['basic','blocks','fighter'].entries()){
   const [x,,z]=PLACES[key],answer=a?.answers?.[key];this.island(x,z,answer?(answer.pass?0x72b7a0:0xa99470):0x507889);
   const beacon=this.cylinder(x,1,z,1,1.2,.7,COLORS[i]);beacon.userData.key=key;
   if(key==='basic'){
    this.cylinder(x,2,z,.18,.3,2.3,0xc7d3c5);this.ball(x,3.6,z,.6,COLORS[i]);
    const ring=this.mesh(new T.TorusGeometry(1.1,.09,8,40),COLORS[i],x,3.6,z);ring.rotation.y=Math.PI/4;
   }else if(key==='blocks'){
    for(let j=0;j<6;j++)this.box(x+(j%3-1)*.7,1.7+Math.floor(j/3)*.7,z,.62,.62,.62,COLORS[j%3]);
   }else{const ship=this.ship(0xd9e9df);ship.position.set(x,1.6,z);ship.rotation.y=-.4;ship.scale.setScalar(1.6);}
   for(let j=0;j<4;j++){const ang=j*Math.PI/2;this.cylinder(x+Math.cos(ang)*3.2,.9,z+Math.sin(ang)*3.2,.12,.25,.8,0xabc8bd);this.ball(x+Math.cos(ang)*3.2,1.4,z+Math.sin(ang)*3.2,.15,answer?0xc9f8b5:COLORS[i]);}
  }
  const order=a?.order||['basic','blocks','fighter'];for(let i=0;i<2;i++){
   const p=new T.Vector3(...PLACES[order[i]]),q=new T.Vector3(...PLACES[order[i+1]]);const center=p.clone().add(q).multiplyScalar(.5),len=p.distanceTo(q);
   const bridge=this.box(center.x,.03,center.z,.65,.2,len,a?.answers[order[i]]?0xc4cba0:0x2c5667);bridge.rotation.y=Math.atan2(q.x-p.x,q.z-p.z);
  }
  // Companion marks the current destination; no score text is baked into the scene.
  const target=PLACES[order[Math.min(a?.cursor||0,2)]],robot=new T.Group();this.root.add(robot);robot.position.set(target[0]-1.5,1,target[2]+1.8);
  this.box(0,.3,0,.45,.55,.35,0xc9dfd7,robot);this.ball(0,.85,0,.32,0xecce8c,robot);this.box(0,.85,.27,.36,.08,.06,0x28688d,robot);
  for(let i=0;i<14;i++){const angle=i/14*Math.PI*2,dist=25+i%3*7;this.cylinder(Math.cos(angle)*dist,-4-i%4,Math.sin(angle)*dist,3,1,5,0x244555);}
  this.home=home;
 }
 blocks(s,q){
  const signature=JSON.stringify([s.grid,s.cells,s.x,s.y,s.index,q?.code]);if(this.mode==='blocks'&&signature===this.signature)return;
  this.mode='blocks';this.clear();this.signature=signature;this.scene.background.set(0x112d3d);this.camera.position.set(0,5,27);this.camera.lookAt(0,5,0);
  this.box(0,4.25,-.45,13.4,13.8,.6,0x173e50);this.box(0,-2.8,0,14,.5,2.6,0x4b7180);
  for(let lane=0;lane<3;lane++){
   this.box(lane*4-4,3.8,-.08,3.94,12,.12,0x214353);
   this.label(String(q?.lanes[lane]??''),lane*4-4,10.9,.2,2.4,['#9eeedd','#ffe0a0','#d9c7ff'][lane]);
  }
  for(let x=0;x<=12;x++)this.box(x-6,-.0+3.8,0,.015,12,.03,0x3e6270);
  for(let y=0;y<=12;y++)this.box(0,y-2.2,0,12,.015,.03,0x3e6270);
  for(let y=0;y<12;y++)for(let x=0;x<12;x++)if(s.grid[y][x])this.box(x-5.5,y-1.7,.38,.88,.88,.7,COLORS[(s.grid[y][x]-1)%3]);
  const ly=landingY(s);for(const [x,y] of s.cells){this.box(s.x+x-5.5,ly+y-1.7,.13,.82,.82,.06,0x456b78);this.box(s.x+x-5.5,s.y+y-1.7,.48,.9,.9,.78,COLORS[s.index%3]);}
 }
 beginFlight(){
  this.mode='fighter';this.clear();this.scene.background.set(0x102c43);this.camera.position.set(0,22,19);this.camera.lookAt(0,0,0);
  this.box(0,-1.3,0,13,.25,36,0x1b4960);
  for(const side of [-1,1])for(let i=0;i<9;i++){
   const cliff=this.cylinder(side*(6.5+i%2),-1.2,i*4-18,1.8,1.2,1.7+i%3,0x284b59);this.transient.push(cliff);
   this.ball(side*5.8,.1,i*4-18,.12,0x5a92a5);
  }
  this.player=this.ship(0xe4eeec);this.flightActors=new T.Group();this.root.add(this.flightActors);
  this.bulletGeo=new T.SphereGeometry(.08,6,4);this.geometries.add(this.bulletGeo);
  this.bulletPool=[];this.redPool=[];this.effectPool=[];
 }
 flight(s,task){
  if(this.mode!=='fighter')this.beginFlight();
  this.player.position.set(s.player.x,.4,s.player.y-8);this.player.rotation.z=s.recover>0?Math.sin(s.time*28)*.13:0;
  for(const a of s.actors){
   let g=this.actorMeshes.get(a.id);if(!g){
    g=a.kind==='enemy'?this.ship(0xd66f69,this.flightActors,true):new T.Group();if(a.kind!=='enemy'){this.flightActors.add(g);this.box(0,.2,0,.8,.5,1.1,0xe3c685,g);this.box(0,.5,0,1.1,.06,.5,0x89bea5,g);}
    if(a.shield){const ring=this.mesh(new T.TorusGeometry(.75,.035,6,28),0x8edbfa,0,.1,0,g);ring.rotation.x=Math.PI/2;}
    if(task.lv===2)this.label(String(a.energy),0,1,0,1.1,'#ffffff',g);
    g.rotation.y=Math.PI;this.actorMeshes.set(a.id,g);
   }g.visible=a.alive;g.position.set(a.x,.2,a.y-8);
  }
  const draw=(items,pool,color)=>{while(pool.length<items.length){const m=new T.Mesh(this.bulletGeo,this.mat(color));this.root.add(m);pool.push(m);}pool.forEach((m,i)=>{m.visible=i<items.length;if(m.visible)m.position.set(items[i].x,.35,items[i].y-8);});};
  draw(s.bullets,this.bulletPool,0xa3f6e5);draw(s.enemyShots,this.redPool,0xffb795);
  const effects=s.effects||[];
  while(this.effectPool.length<effects.length){const ring=this.mesh(new T.TorusGeometry(.5,.055,6,24),0xffd79c,0,0,0);ring.rotation.x=-Math.PI/2;this.effectPool.push(ring);}
  this.effectPool.forEach((ring,i)=>{ring.visible=i<effects.length;if(ring.visible){const fx=effects[i];ring.position.set(fx.x,.4,fx.y-8);ring.scale.setScalar(.3+fx.age*3);}});
  for(const [i,m] of this.transient.entries())m.position.z=((i%9)*4-18+s.time*1.4+36)%36-18;
 }
 project(key){const v=new T.Vector3(...PLACES[key]);v.y=4.8;v.project(this.camera);return {x:(v.x+1)/2,y:(1-v.y)/2};}
 point(clientX,clientY,rect){
  const pointer=new T.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),ray=new T.Raycaster();ray.setFromCamera(pointer,this.camera);const hit=new T.Vector3();return ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),hit)?{x:hit.x,y:hit.z+8}:null;
 }
 render(renderer,element){
  const rect=element.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const size=renderer.getSize(this.size??=new T.Vector2());if(size.x!==rect.width||size.y!==rect.height)renderer.setSize(rect.width,rect.height);
  this.camera.aspect=rect.width/rect.height;
  this.camera.zoom=this.mode==='blocks'?Math.min(1.03,this.camera.aspect/.74):this.mode==='fighter'?Math.min(1.17,this.camera.aspect/.66):Math.min(1.15,this.camera.aspect/.95);
  this.camera.updateProjectionMatrix();renderer.render(this.scene,this.camera);
 }
 dispose(){this.clear();this.materials.forEach(m=>m.dispose());this.materials.clear();}
}
