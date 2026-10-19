import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {loadRoomCharacters,buildRoomActors} from './actors.js';
import {buildExitStairwell} from './stairwell.js';
export async function loadAssets(renderer){
 const tl=new T.TextureLoader();const [kit,diff,normal,rough,hdr]=await Promise.all([new GLTFLoader().loadAsync('assets/classrooms/furniture.glb'),tl.loadAsync('assets/classrooms/textures/wood_diff.jpg'),tl.loadAsync('assets/classrooms/textures/wood_nor_gl.jpg'),tl.loadAsync('assets/classrooms/textures/wood_rough.jpg'),new HDRLoader().loadAsync('assets/sky/campus_sky_2k.hdr')]);
 diff.colorSpace=T.SRGBColorSpace;for(const t of [diff,normal,rough]){t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}
 const pm=new T.PMREMGenerator(renderer),env=pm.fromEquirectangular(hdr).texture;pm.dispose();hdr.mapping=T.EquirectangularReflectionMapping;
 kit.scene.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)if(m.name==='Oak laminate'){m.map=diff;m.normalMap=normal;m.normalScale=new T.Vector2(.12,.12);m.roughnessMap=rough;m.color.set('#d5b991');}}});
 const characters=await loadRoomCharacters();
 const manifest=await fetch('assets/spaces/manifest.json').then(r=>{if(!r.ok)throw Error('独立场景清单加载失败');return r.json();});
 const spaces={};
 async function loadSpace(id){
  if(spaces[id])return spaces[id];const spec=manifest.spaces.find(s=>s.id===id);if(!spec)throw Error('未知独立场景 '+id);
  const gltf=await new GLTFLoader().loadAsync('assets/spaces/'+spec.file);
  gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=!o.material.transparent;o.receiveShadow=true;if(o.material.name==='Oak'&&o.material.map!==diff){const old=[o.material.map,o.material.roughnessMap];o.material.map=diff;o.material.normalMap=normal;o.material.roughnessMap=rough;o.material.normalScale=new T.Vector2(.12,.12);for(const t of new Set(old))t?.dispose();}}});
  return spaces[id]={model:gltf.scene,spec};
 }

 return {kit:kit.scene,diff,normal,rough,hdr,env,spaces,loadSpace,characters};
}
export function buildEnvironment(assets,room,wingRooms){
 const group=new T.Group(),colliders=[],interactions=[],dynamic=[],owned=[],doorSigns={};let screen,screenContext,screenTexture,demoObject=null,barGroup=null,averageLine=null,anim=null,ball=null;
 const own=o=>(owned.push(o),o),mat=(c,rough=.7,metal=0)=>own(new T.MeshStandardMaterial({color:c,roughness:rough,metalness:metal}));
 const m={wall:mat('#eeeee4'),trim:mat('#d2d8c8'),metal:mat('#76817b',.32,.6),white:mat('#f1f0e6',.5),dark:mat('#273b36',.43),green:mat('#284f44',.9),rubber:mat('#5d746e',.95),gold:mat('#b9985e',.35,.55),oak:own(new T.MeshStandardMaterial({map:assets.diff,normalMap:assets.normal,normalScale:new T.Vector2(.14,.14),roughnessMap:assets.rough,color:'#d7c3a5'}))};
 const box=(x,y,z,w,h,d,material,solid=false)=>{const geo=own(new T.BoxGeometry(w,h,d)),mesh=new T.Mesh(geo,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);if(solid)colliders.push({x,y,z,w,h,d});return mesh;};
 const cyl=(x,y,z,r,h,material)=>{const mesh=new T.Mesh(own(new T.CylinderGeometry(r,r,h,24)),material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;};
 const sphere=(x,y,z,r,material)=>{const mesh=new T.Mesh(own(new T.SphereGeometry(r,24,16)),material);mesh.position.set(x,y,z);mesh.castShadow=true;group.add(mesh);return mesh;};
 function furniture(name,x,z,angle=0){const source=assets.kit.getObjectByName(name);if(!source)throw Error('Missing furniture '+name);const o=source.clone(true);o.position.set(x,0,z);o.rotation.y=angle;group.add(o);return o;}
 function label(text,x,y,z,w=1.5,h=.34,ry=0,bg='#edf0e5',fg='#31483c'){
  const cv=document.createElement('canvas');cv.width=1024;cv.height=Math.round(1024*h/w);const c=cv.getContext('2d');c.fillStyle=bg;c.fillRect(0,0,cv.width,cv.height);c.fillStyle=fg;c.font=`500 ${Math.min(cv.height*.43,1024/(text.length+2))}px "PingFang SC",sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,512,cv.height/2);
  const tx=own(new T.CanvasTexture(cv));tx.colorSpace=T.SRGBColorSpace;const mt=own(new T.MeshStandardMaterial({map:tx,roughness:.8})),mesh=new T.Mesh(own(new T.PlaneGeometry(w,h)),mt);mesh.position.set(x,y,z);mesh.rotation.y=ry;group.add(mesh);
  mesh.userData.write=(text,bg,fg)=>{c.fillStyle=bg;c.fillRect(0,0,cv.width,cv.height);c.fillStyle=fg;c.font=`600 ${Math.min(cv.height*.53,1024/(text.length+2))}px "PingFang SC",sans-serif`;c.fillText(text,512,cv.height/2);tx.needsUpdate=true;};return mesh;
 }
 function plant(x,z){const pot=cyl(x,.17,z,.16,.34,mat('#c3a684'));cyl(x,.34,z,.143,.01,mat('#534336'));for(let i=0;i<9;i++){const a=i*2.4;const leaf=sphere(x+Math.cos(a)*.12,.57+(i%3)*.14,z+Math.sin(a)*.12,.13,m.green);leaf.scale.set(.36,1.8,.62);leaf.rotation.z=Math.sin(a)*.5;}}
 function windowBay(x,z){
  box(x,1.95,z,.08,1.8,2.65,m.white); // frame behind clear opening, thin bars replace infill below
 }
 function lamp(x,z){box(x,3.12,z,1.25,.055,.22,m.metal);const lm=own(new T.MeshStandardMaterial({color:'#fffbea',emissive:'#fff4dc',emissiveIntensity:1.4}));box(x,3.086,z,1.18,.01,.16,lm);for(const dx of [-.45,.45])cyl(x+dx,3.24,z,.005,.2,m.metal);}
 function door(x,z,side,text){
  const pivot=new T.Group();group.add(pivot); // public corridor doors are genuine framed 3D panels
  const leaf=box(x,1.08,z,.085,2.16,1.36,m.oak);leaf.userData.door=true;
  for(const dz of [-.75,.75])box(x,1.17,z+dz,.18,2.34,.085,m.trim);
  box(x,2.31,z,.18,.085,1.58,m.trim);
  box(x-side*.06,1.55,z,.02,.47,.57,mat('#aabbb3',.17,.25));
  const handle=box(x-side*.12,1.04,z+.44,.17,.032,.18,m.metal);handle.castShadow=true;
  label(text,x-side*.115,2.6,z,2,.25,-side*Math.PI/2);
  const sign=label('○ 未完成',x-side*.12,2.08,z,1.18,.23,-side*Math.PI/2,'#edf3ed','#294735');
  sign.material=own(new T.MeshBasicMaterial({map:sign.material.map,toneMapped:false}));return sign;
 }
 const ambient=new T.HemisphereLight('#eff6ff','#a1947c',.7);group.add(ambient);
 const sun=new T.DirectionalLight('#fff1d2',3.3);sun.position.set(-7,5,2);sun.target.position.set(1,0,-2);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-9,right:9,top:10,bottom:-10,near:.1,far:35});sun.shadow.bias=-.00012;sun.shadow.normalBias=.025;group.add(sun,sun.target);
 for(const z of [-2,2]){const l=new T.PointLight('#fff2df',13,12,2);l.position.set(0,2.9,z);group.add(l);}
 let spawn={x:0,z:2.8,yaw:0},length=9,stairwell=null;
 if(!room){
  length=Math.ceil(wingRooms.length/2)*3.7+3;const center=3.6-length/2;
  box(0,-.1,center,6,.2,length,m.white,true);box(0,3.36,center,6,.18,length,m.wall,true);
  box(-3,1.65,center,.18,3.3,length,m.wall,true);box(3,1.65,center,.18,3.3,length,m.wall,true);
  box(0,1.65,3-length,6,3.3,.18,m.wall,true);
  for(const x of [-2.88,2.88]){box(x,.5,center,.04,1,length,m.trim);box(x,.055,center,.075,.11,length,m.metal);}
  for(let z=2.5;z>3-length;z-=1){box(0,.008,z,5.75,.004,.01,m.trim);}
  wingRooms.forEach((r,i)=>{const side=i%2?1:-1,z=.4-Math.floor(i/2)*3.7;doorSigns[r.id]=door(side*2.88,z,side,r.number+' · '+r.title);interactions.push({type:'door',id:r.id,x:side*2.36,z,faceX:side*2.88,faceZ:z,label:`进入 ${r.number} ${r.title}`});lamp(0,z);});
  plant(-2.3,2.8);plant(2.3,2.8);
  stairwell=buildExitStairwell({group,colliders,interactions,box,cyl,label,mat,m});
  interactions.push({type:'wing',x:0,z:2.9,label:'查看教学区导览'});
 }else{
  const independent=assets.spaces[room.id];if(!independent)throw Error('独立房间模型缺失：'+room.id);
  const architecture=independent.model.clone(true);architecture.name='independent-space-'+room.id;group.add(architecture);
  colliders.push(...independent.spec.colliders.map(c=>({...c})));
  // Shared exterior planting is scenery beyond each independently modeled shell.
  box(-10,-.13,0,12,.14,28,mat('#9eaa88'));box(-13,1.45,0,.4,2.9,28,mat('#d7d5c5'));
  const leaves=new T.InstancedMesh(own(new T.SphereGeometry(.13,8,5)),mat('#71885c',.92),320),leafPose=new T.Object3D();let leafIndex=0;
  for(const z of [-7,-2,3,8]){cyl(-10,1.1,z,.075,2.2,mat('#746247'));for(let i=0;i<80;i++){const a=i*2.39996,r=.3+Math.sqrt((i%41)/41);leafPose.position.set(-10+Math.cos(a)*r,2+((i*37)%97)/97*1.7,z+Math.sin(a)*r);leafPose.rotation.set(i*.61,i*1.3,i*.37);leafPose.scale.set(.7,1.75,.27);leafPose.updateMatrix();leaves.setMatrixAt(leafIndex++,leafPose.matrix);}}
  leaves.castShadow=true;group.add(leaves);
  // Framed front display and real chalkboard surround.
  box(0,1.96,-4.31,4.9,1.42,.08,m.metal);box(0,1.96,-4.25,4.8,1.31,.035,m.green);box(0,1.24,-4.17,4.9,.04,.15,m.metal);
  box(0,2.02,-4.17,3.55,1.18,.045,m.dark);
  const cv=document.createElement('canvas');cv.width=1600;cv.height=500;screenContext=cv.getContext('2d');screenTexture=own(new T.CanvasTexture(cv));screenTexture.colorSpace=T.SRGBColorSpace;
  screen=new T.Mesh(own(new T.PlaneGeometry(3.42,1.07)),own(new T.MeshBasicMaterial({map:screenTexture,toneMapped:false})));screen.position.set(0,2.02,-4.138);group.add(screen);
  label(room.number+'  /  '+room.title,1.94,2.94,-4.365,3.2,.21);
  // Clock, air conditioner, switches and notice board are modeled at real scale.
  const clock=cyl(3.32,2.63,-4.26,.21,.06,m.white);clock.rotation.x=Math.PI/2;
  for(let i=0;i<12;i++){const a=i*Math.PI/6;const tick=box(3.32+Math.sin(a)*.16,2.63+Math.cos(a)*.16,-4.217,.012,.029,.01,m.dark);tick.rotation.z=-a;}
  box(3.32,2.68,-4.199,.012,.11,.01,m.dark);box(3.37,2.63,-4.197,.11,.012,.01,m.dark);
  for(const x of [-.99,1.03])box(x,1.15,4.355,.09,.13,.018,m.white);
  plant(-3.3,-3.92);plant(3.4,3.85);
  const wb=furniture('Workbench',1.65,-2.25);colliders.push({x:1.65,y:.43,z:-2.25,w:2.24,h:.9,d:.88});
  const monitor=furniture('Monitor',1.55,-2.45);monitor.position.y=.871;
  const keyboard=furniture('Keyboard',1.55,-2.03);keyboard.position.y=.87;
  label('PY / '+room.number,1.55,1.26,-2.418,.47,.24,0,'#233e37','#dfeadd');
  interactions.push({type:room.kind==='archive'?'paper':room.kind==='exam'?'exam':'task',id:room.id,x:1.55,z:-1.46,label:room.kind==='exam'?'开始小测与交作业':room.kind==='archive'?'整理成绩资料':'使用本室编程工作台'});
  // Aim at the recess backing, so the exit stays ahead even when pressed against it.
  interactions.push({type:'exit',x:0,z:4.08,faceX:0,faceZ:5.1,label:'离开教室，返回走廊'});
  label('出口 / RETURN',0,2.68,4.355,1.3,.2,Math.PI,'#d9e6d1','#315e43');
  if(room.kind==='archive'){
   furniture('Workbench',-1.65,-2.25);colliders.push({x:-1.65,y:.45,z:-2.25,w:2.24,h:.9,d:.88});for(let i=0;i<3;i++){box(-2.25+i*.6,.88,-2.25,.43,.026,.32,m.white);label('档案 '+(i+1),-2.25+i*.6,1.04,-2.08,.45,.13);}
  }else if(room.kind==='exam'){
   furniture('Workbench',-1.65,-2.3);colliders.push({x:-1.65,y:.45,z:-2.3,w:2.2,h:.9,d:.88});label('教师评阅 / '+['邹亮','邓老师','张守安'][room.lv-1],-1.65,1.05,-1.99,1.3,.19);for(let i=0;i<4;i++)box(-2.2+i*.35,.88,-2.1,.26,.015,.35,m.white);
  }else if(room.id==='3-5'){
   const route=independent.spec.trainingRoute;
   for(const stop of route){const left=stop.x<0;label(String(stop.station),left?-3.305:3.355,1.02,stop.z,.45,.4,left?Math.PI/2:-Math.PI/2);}
   label('起点包含 · 终点不包含',3.775,2.58,1.0,3.4,.25,-Math.PI/2);
   label('1 → 2 → 3 → 4 → 5',3.775,1.95,1.0,3.4,.55,-Math.PI/2);
   label('START / 1',-2.25,2.35,3.48,1.04,.13);
   label('FINISH / 5',2.4,2.35,3.14,1.04,.13);
   demoObject=sphere(route[0].x,.19,route[0].z,.11,m.gold);demoObject.visible=false;
  }else if(room.lv===3&&room.index<3){
   box(-1.65,.025,-1.7,2.2,.05,2.5,m.rubber);label('循环训练模型 · 按程序逐轮演示',-1.6,.4,-3.1,2,.22);
   demoObject=furniture('Mannequin',-1.65,-1.9);demoObject.position.y=.05;colliders.push({x:-1.65,y:.82,z:-1.9,w:.72,h:1.65,d:.4});
   if(room.index===2){label('急停 / STOP',-2.8,1.4,-3.25,.6,.25,0,'#a84531','#fff7e9');box(-2.8,1.1,-3.3,.48,.7,.23,m.white);sphere(-2.8,1.4,-3.08,.055,mat('#b83f2c'));}
  }else{
   furniture('Workbench',-1.65,-2.25);colliders.push({x:-1.65,y:.45,z:-2.25,w:2.24,h:.9,d:.88});
   if(room.id==='1-1'||room.id==='1-2'){
    box(-1.65,.887,-2.25,2,.032,.65,mat('#a05d44'));for(let i=0;i<3;i++)box(-1.65,.907,-2.49+i*.24,1.9,.004,.014,m.white);
    for(const x of [-2.48,-.82]){box(x,1.02,-2.55,.035,.24,.035,m.metal);box(x,1.02,-1.97,.035,.24,.035,m.metal);box(x,1.145,-2.26,.035,.025,.62,m.metal);}
    ball=sphere(-2.35,.96,-2.25,.052,m.gold);demoObject=ball;
    label(room.id==='1-1'?'跳绳垫 / 每秒频率教学模型':'100 m 跑道 / 1:50 教学模型',-1.65,.77,-1.80,1.65,.12);
   }else if(room.id==='1-3'){
    box(-1.65,.9,-2.25,2,.08,.68,m.white);box(-1.65,.952,-2.25,1.85,.018,.54,own(new T.MeshPhysicalMaterial({color:'#72aeb1',metalness:.1,roughness:.15,transparent:true,opacity:.8})));
    for(let i=0;i<3;i++)box(-1.65,.964,-2.46+i*.21,1.75,.007,.01,m.white);demoObject=sphere(-1.55,1,-2.26,.046,m.gold);label('50 m 泳道 / 比例模型',-1.65,.77,-1.8,1.55,.12);
   }else if(room.id==='1-4'){
    for(let i=0;i<2;i++){box(-2.2+i*1.08,1.17,-2.25,.09,.55,.32,m.metal);const gate=box(-1.95+i*.6,1.33,-2.25,.54,.035,.045,m.gold);dynamic.push(gate);label(i?'剩余 == 0':'组数 ≥ 1',-2.2+i*1.08,.78,-1.8,.75,.14);}
   }else if(room.id==='2-2'){
    for(let i=0;i<8;i++){const x=-2.43+(i%4)*.5,z=-2.45+Math.floor(i/4)*.35;box(x,.89,z,.38,.015,.27,m.white);label(String(i+1).padStart(2,'0'),x,1.13,z+.06,.28,.18,0,'#edf2e7','#315b47');}
    label('参赛名册 · 每张卡片对应1人',-1.65,.77,-1.8,1.9,.13);
   }else if(room.id==='2-4'){
    for(let i=0;i<3;i++){const x=-2.3+i*.65,h=[.18,.32,.12][i];box(x,.88+h/2,-2.3,.5,h,.45,m.oak);label(['2','1','3'][i],x,.92+h/2,-2.066,.2,.12);}
    cyl(-1.65,1.4,-2.3,.09,.28,m.gold);sphere(-1.65,1.58,-2.3,.11,m.gold);box(-1.65,1.23,-2.3,.28,.045,.22,m.dark);
    label('找出最高成绩与最低成绩',-1.65,.77,-1.8,1.9,.13);
   }else if(room.id==='2-5'){
    for(let i=0;i<8;i++){const x=-2.48+i*.235;box(x,1.15,-2.25,.18,.5,.14,m.white);sphere(x,1.27,-2.16,.034,i%3?m.green:m.gold);label(String(i+1),x,1.04,-2.168,.1,.12);}
    label('逐个判断 → 让循环自动判断',-1.65,.77,-1.8,1.9,.13);
   }else{
    barGroup=new T.Group();group.add(barGroup);const values=JSON.parse(room.task.pre.match(/scores\s*=\s*(\[[^\]]+\])/)?.[1]||'[160,175,180,168,190,174,185,166]');
    values.forEach((v,i)=>{const b=box(-2.48+i*.235,1.12,-2.25,.14,.44,.18,mat(i%2?'#719584':'#326652'));b.userData.value=v;b.userData.h=.2+v/230*.7;barGroup.attach(b);});
    if(room.id==='2-3'){const avg=values.reduce((a,b)=>a+b,0)/values.length;averageLine=box(-1.65,.88+.2+avg/230*.7,-2.12,1.9,.014,.025,m.gold);averageLine.visible=false;}
    label(room.id==='3-4'?'毕业汇总 · 总数 / 平均 / 最小值':'成绩统计 · 数据驱动模型',-1.65,.77,-1.8,1.9,.13);
   }
  }
  spawn={x:0,z:3.6,yaw:0};
 }
 const arrowShape=new T.Shape();arrowShape.moveTo(0,.32);arrowShape.lineTo(-.21,-.18);arrowShape.lineTo(.21,-.18);arrowShape.closePath();
 const arrowGeo=own(new T.ShapeGeometry(arrowShape));arrowGeo.rotateX(-Math.PI/2);
 const routeMesh=new T.InstancedMesh(arrowGeo,own(new T.MeshBasicMaterial({color:'#2ca267',side:T.DoubleSide,toneMapped:false})),64);routeMesh.count=0;routeMesh.frustumCulled=false;group.add(routeMesh);
 const lineMesh=new T.InstancedMesh(own(new T.BoxGeometry(1,1,1)),own(new T.MeshBasicMaterial({color:'#187f50',toneMapped:false})),256);lineMesh.count=0;lineMesh.frustumCulled=false;group.add(lineMesh);
 const routePose=new T.Object3D();let routePoints=[],doorStates={};
 function setRoute(points){routePoints=points;let count=0,segments=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);if(d<.01)continue;
  if(segments<256){routePose.position.set((a.x+b.x)/2,.015,(a.z+b.z)/2);routePose.rotation.set(0,Math.atan2(dx,dz),0);routePose.scale.set(.13,.01,d+.025);routePose.updateMatrix();lineMesh.setMatrixAt(segments++,routePose.matrix);}
  routePose.scale.set(1,1,1);for(let t=.25;t<d&&count<64;t+=.8){routePose.position.set(a.x+dx*t/d,.027,a.z+dz*t/d);routePose.rotation.set(0,Math.atan2(-dx,-dz),0);routePose.updateMatrix();routeMesh.setMatrixAt(count++,routePose.matrix);}}
  routeMesh.count=count;routeMesh.instanceMatrix.needsUpdate=true;lineMesh.count=segments;lineMesh.instanceMatrix.needsUpdate=true;
 }
 function setProgress(states){doorStates=states;for(const [id,sign] of Object.entries(doorSigns)){const s=states[id];if(!s)continue;const text=s.label+(s.stars?' · '+'★'.repeat(s.stars):'');const colors=s.key==='done'?['#206b43','#ffffff']:['active','submit'].includes(s.key)?['#ffdf91','#5a390e']:s.key==='locked'?['#d0d8d1','#435548']:['#eef4ee','#294735'];sign.userData.write(text,...colors);}}
 function display(title,detail='先观察设备，再到工作台运行代码'){
  if(!screenContext)return;const c=screenContext;c.fillStyle='#173e35';c.fillRect(0,0,1600,500);c.fillStyle='#a9bd9c';c.font='24px "PingFang SC"';c.fillText('阳光中学 / '+room.number+' '+room.title,65,65);c.fillStyle='#f2f1dd';c.font='500 66px "PingFang SC"';c.fillText(title.slice(0,23),65,232);c.fillStyle='#c9d8ba';c.font='30px "PingFang SC"';c.fillText(detail.slice(0,46),65,338);c.fillStyle='#8eb297';c.fillRect(65,397,1470,2);screenTexture.needsUpdate=true;
 }
 if(room)display(room.task?.title||room.title);
 const actors=buildRoomActors(assets.characters,room,wingRooms[0]?.lv||1,group,colliders);
 return {group,colliders,interactions,spawn,length,ball,actors,stairwell,model:room?assets.spaces[room.id].spec:null,
  display,setProgress,setRoute,journeyState:()=>({doors:doorStates,route:routePoints,routeSegments:lineMesh.count,routeArrows:routeMesh.count}),
  animate(result){anim={start:performance.now(),result};display('程序运行成功',result.out?.trim().replace(/\n/g,'  ').slice(0,46)||'观察设备响应');},
  tick(now){actors.tick(now);if(!anim)return;const t=(now-anim.start)/1000;const count=anim.result.acts?.length||0;
   if(room?.id==='3-5'&&demoObject){const route=assets.spaces[room.id].spec.trainingRoute,sequence=anim.result.acts||[],k=Math.min(sequence.length-1,Math.floor(t/.85)),stop=route.find(s=>s.station===sequence[k]);if(!stop){demoObject.visible=false;display('未产生可回放的训练动作');anim=null;return;}demoObject.visible=true;demoObject.position.set(stop.x,.2+Math.sin(t*4)*.05,stop.z);display(t<sequence.length*.85?`访问训练站 ${stop.station}`:`完成 ${sequence.length} 站巡回`,'本次程序动作：'+sequence.join(' → '));if(t>=sequence.length*.85)anim=null;}
   else if(room?.lv===3&&room.index<3&&demoObject){const k=Math.min(count,Math.floor(t/.68));demoObject.position.y=.05+(k<count?Math.sin((t%.68)/.68*Math.PI)*.24:0);display(k<count?`第 ${k+1} / ${count} 轮`:`完成 ${count} 轮`,room.index===1?`累计 ${Math.min(k,count)*60} 个 / 目标500个`:'循环变量随每次动作前进');if(k===count)anim=null;}
   else if(room?.id==='1-3'&&demoObject){demoObject.position.x=-2.45+Math.min(1,t/3)*1.15;display('本趟已游 '+(anim.result.out?.trim()||'37')+' 米','137 = 2 × 50 + 37；本趟 50 − 37 = 13 米');}
   else if(room?.id==='1-4'){const m4=(anim.result.out||'').trim().match(/^(\d+)\s+(\d+)\s+(True|False)$/),full=m4?m4[3]==='True':false;dynamic.forEach((g,i)=>g.rotation.y=(full?Math.min(1,t):0)*Math.PI/2*(i?-1:1));display(full?'两项都满足 · 正好分完':'剩余不为 0 · 还有余下队员',m4?`组数 ${m4[1]} ≥ 1 AND 剩余 ${m4[2]} == 0 → ${m4[3]}`:'组数 ≥ 1 AND 剩余 == 0');}
   else if(barGroup){barGroup.children.forEach(b=>{const h=b.userData.h*Math.min(1,t);b.scale.y=h/.44;b.position.y=.88+h/2;});if(averageLine)averageLine.visible=t>1;}
  },
  dispose(){actors.dispose();for(const o of owned)o.dispose?.();group.clear();}
 };
}
