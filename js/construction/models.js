import * as T from '../../vendor/three/build/three.module.js';
import {batchFacility} from './batch.js';
// 电影馆坐席布局（局部常量与 facilityModel 的 cinema 分支同源）→ 世界坐标供 js/cinema.js 的 sitAt 使用；
// facing=-1 时整馆旋转 180°：局部 x/z 取反、朝向对调；yaw 单位为度，0=面向 -z（银幕方向）。
const CINEMA_ROWS=[{z:-2.2,y:0},{z:-.7,y:.28},{z:.8,y:.56},{z:2.3,y:.84}],CINEMA_SEAT_X=[-4.5,-2.95,-1.15,1.15,2.95,4.5];
export function cinemaSeats(v){const f=v.facing||1,out=[];for(let r=0;r<4;r++)for(const lx of CINEMA_SEAT_X)out.push({x:v.x+lx*f,z:v.z+CINEMA_ROWS[r].z*f,y:CINEMA_ROWS[r].y,yaw:f===-1?180:0,row:r});return out;}
// The same geometry factory supplies the real scene and catalog thumbnails.
// 2026-10-13 四点评估第③项：六场馆内部从"方块拼家具"升级为成套设施
// （体育馆=看台+器材架+球车+跳箱+肋木+球网；音乐馆=三角钢琴+合唱台+谱架+定音鼓；
//   游泳馆前厅=更衣柜+长椅+计时屏+浮板架+救生圈；教室补讲台书柜；篮球馆补球车记分牌）。
// 仍走程序化同步生成：colliders 由 solid 家具自动产出，缩略图与实体同源。
export function facilityModel(v){const group=new T.Group(),colliders=[],materials=new Map(),lines=new Map();const mat=(color,options={})=>{const key=JSON.stringify([color,options]);if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness:.85,...options}));return materials.get(key);};const ms={wall:mat('#e9e2d5'),trim:mat(v.accent),wood:mat('#bd9e78'),metal:mat('#677c83'),glass:mat('#a2c9d1',{transparent:true,opacity:.32,depthWrite:false}),floor:mat('#d7cbb6'),green:mat('#396856'),seat:mat('#9aada9')};
 function box(x,y,z,w,h,d,m,solid=false,ry=0,rx=0){const o=new T.Mesh(new T.BoxGeometry(w,h,d),typeof m==='string'?mat(m):m);o.position.set(x,y,z);if(ry)o.rotation.y=ry;if(rx)o.rotation.x=rx;o.castShadow=!o.material.transparent;o.receiveShadow=true;group.add(o);if(solid)colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,y0:y-h/2,y1:y+h/2});return o;}
 function cyl(x,y,z,r,h,m,solid=false,rx=0,rz=0){const o=new T.Mesh(new T.CylinderGeometry(r,r,h,12),typeof m==='string'?mat(m):m);o.position.set(x,y,z);if(rx)o.rotation.x=rx;if(rz)o.rotation.z=rz;o.castShadow=!o.material.transparent;o.receiveShadow=true;group.add(o);if(solid)colliders.push({minX:x-r,maxX:x+r,minZ:z-r,maxZ:z+r,y0:y-h/2,y1:y+h/2});return o;}
 function sph(x,y,z,r,m){const o=new T.Mesh(new T.SphereGeometry(r,14,10),typeof m==='string'?mat(m):m);o.position.set(x,y,z);o.castShadow=!o.material.transparent;group.add(o);return o;}
 function tor(x,y,z,R,t,m,rx=0){const o=new T.Mesh(new T.TorusGeometry(R,t,10,24),typeof m==='string'?mat(m):m);o.position.set(x,y,z);if(rx)o.rotation.x=rx;group.add(o);return o;}
 function line(pts,color='#fff4de'){if(!lines.has(color))lines.set(color,[]);const values=lines.get(color);for(let i=1;i<pts.length;i++)values.push(...pts[i-1],...pts[i]);}
 function chair(x,z){box(x,.44,z,.55,.08,.55,ms.seat,true);box(x,.8,z-.26,.55,.7,.06,ms.seat,true);for(const dx of [-.2,.2])for(const dz of [-.2,.2])box(x+dx,.22,z+dz,.05,.44,.05,ms.metal);}
 function ballRow(x,y,z,n,r,colors){for(let i=0;i<n;i++)sph(x+i*r*2.15,y,z,r,colors[i%colors.length]);}
 const {w,d}=v,h=4.4;box(0,-.06,0,w,.16,d,ms.floor);box(-w/2,h/2,0,.22,h,d,ms.wall,true);box(w/2,h/2,0,.22,h,d,ms.wall,true);box(0,h/2,-d/2,w,h,.22,ms.wall,true);for(const dir of [-1,1])box(dir*(w/4+.8),h/2,d/2,w/2-1.6,h,.22,ms.wall,true);box(0,3.7,d/2,3.2,1.4,.22,ms.trim,true);box(0,h+.12,0,w+.6,.18,d+.6,ms.glass);for(let z=-d/2;z<=d/2;z+=3)box(0,h,z,w,.18,.14,ms.trim);for(const x of [-w/2,w/2])for(let z=-d/2+2;z<d/2;z+=3){box(x*.985,2.6,z,.04,1.45,2,ms.glass);}
 if(v.id==='classroom'){box(0,2,-d/2+.17,5,1.5,.05,ms.green);box(0,.52,-d/2+1.15,1.5,1.04,.75,ms.wood,true);box(0,1.1,-d/2+.75,.9,.1,.5,'#e8e4da');/* 讲台 */
   for(const x of [-3,0,3])for(const z of [-3,0,3]){box(x,.76,z,1.8,.12,.7,ms.wood,true);for(const dx of [-.7,.7])box(x+dx,.36,z,.06,.72,.06,ms.metal);chair(x,z+.9);}
   for(const sx of [-1,1]){/* 后墙书柜（避开门洞 x±1.6） */const bx=sx*(w/2-2.6);box(bx,.9,d/2-.55,2.4,1.8,.5,ms.wood,true);for(let s=0;s<3;s++){box(bx,.25+s*.55,d/2-.3,2.2,.05,.42,'#8a7358');for(let b=0;b<6;b++)box(bx-.95+b*.38,.42+s*.55,d/2-.3,.3,.32,.3,['#b5544b','#4f7fa8','#c9a13c','#5d8a5f','#7a6aa0'][b],false,sx*.04);}}}
 if(v.id==='music'){
   /* 三角钢琴（北墙中央）：琴体+倾斜琴盖+三条腿+键盘+谱架 */
   const px=0,pz=-d/2+3.4;
   box(px,1.05,pz,2.9,.42,1.5,'#232e36',true);box(px+.55,1.05,pz-.55,1.7,.42,1.35,'#232e36',true,.5);
   box(px-.2,1.45,pz-.18,2.5,.05,1.28,'#2e3d47',false,0,.3);cyl(px+.95,1.35,pz+.3,.03,.55,ms.metal,false,0,.35);
   for(const [lx,lz] of [[-1.2,.55],[1.2,.55],[-1,-.6]])cyl(px+lx,.42,pz+lz,.06,.86,'#232e36',true);
   box(px,1.32,pz+.85,1.5,.09,.3,'#f4f1e8');for(let k=0;k<11;k++)box(px-.62+k*.124,1.34,pz+.78,.07,.05,.14,'#1c2329');
   box(px,1.32,pz+1.04,.34,.24,.08,'#232e36');box(px,1.05,pz+1.5,1.2,.1,.42,ms.wood,true);/* 琴凳 */
   /* 合唱台（南半场三排，北移留出中轴进门通道到 interior 点）+ 谱架 */
   for(let r=0;r<3;r++){const zz=d/2-7.2+r*1.15;box(0,.2+r*.28,zz,9.5,.4+r*.56,1.05,ms.wood,true);box(0,.45+r*.28,zz-.45,9.5,.06,.12,ms.trim);
     for(let i=0;i<4;i++){const sx=-3.4+i*2.3;cyl(sx,1.05+r*.28,zz+.1,.03,.9,ms.metal);box(sx,1.5+r*.28,zz+.16,.5,.04,.36,'#e8e4da',false,0,-.18);}}
   /* 定音鼓×2 + 大鼓（西墙） */
   for(const gz of [-2.5,1.5]){cyl(-w/2+1.6,.72,gz,.55,.6,'#a8793f',true);cyl(-w/2+1.6,1.05,gz,.55,.06,'#e6dcc8');for(let a=0;a<3;a++)cyl(-w/2+1.6+Math.cos(a*2.1)*.5,.2,gz+Math.sin(a*2.1)*.5,.02,.44,ms.metal);}
   cyl(-w/2+1.6,.75,4.4,.7,.55,'#8a3b32',true);cyl(-w/2+1.6,1.06,4.4,.7,.06,'#e6dcc8');
   /* 指挥台 + 东墙吸音板 */
   box(3.2,.11,.8,1.3,.22,1.3,ms.wood,true);for(let p=0;p<5;p++)box(w/2-.35,2,-6+p*2.8,.08,1.6,.9,'#9c7b57');}
 if(v.id==='pool'){
   /* 更衣柜（北墙两段通高，双色门+把手+透气缝） */
   const lz=-d/2+.42;for(let i=0;i<16;i++){const x=-8.2+i*1.1;if(Math.abs(x)<1.9)continue;const col=i%2?'#dfe8ea':'#c9d8dc';
     box(x,.58,lz,1,.96,.62,col,true);box(x,1.62,lz,1,1.1,.62,i%2?'#c9d8dc':'#dfe8ea',true);
     box(x+.34,.62,lz+.33,.05,.22,.04,ms.metal);box(x+.34,1.66,lz+.33,.05,.22,.04,ms.metal);
     for(let s=0;s<2;s++)box(x,.45+s*.16,lz+.33,.6,.03,.02,'#aab6ba');}
   /* 中央长椅×2（条板+金属腿） */
   for(const bx of [-4.5,4.5]){box(bx,.5,0,3.6,.09,.55,ms.wood,true);for(const dx of [-1.5,1.5])for(const dz of [-.18,.18])cyl(bx+dx,.23,dz,.03,.46,ms.metal);}
   /* 西墙：计时屏（泳道读数）+救生圈×2 */
   box(-w/2+.4,2.55,0,.2,1.05,3.2,'#20262c',true);box(-w/2+.32,2.55,0,.04,.8,2.8,'#ffd23c',{emissive:'#ffb61e',emissiveIntensity:.7});
   for(let s=0;s<4;s++)box(-w/2+.29,2.55,-1.05+s*.7,.04,.5,.14,'#20262c');
   for(const cz of [-1,1])tor(-w/2+.42,2.05,cz*2.2,.42,.07,'#d95f4b',Math.PI/2);
   /* 东墙：浮板架（彩色斜板）+泳镜挂钩 */
   box(w/2-.6,.5,0,.5,.06,3.8,ms.metal,true);box(w/2-.6,.75,0,.5,.06,3.8,ms.metal);
   for(let i=0;i<6;i++)box(w/2-.75,1.05+i*.16,-1.5+i*.5,.5,.85,.14,['#e2b13c','#4f9ec4','#d95f4b','#5d8a5f','#7a6aa0','#e28ab1'][i],false,0,.42);}
 if(v.id==='gym'){
   /* 主场区：地胶+球场边线+球网 */
   box(0,.04,0,w-1.6,.08,d-1.6,'#7fa89b');const cw=w/2-2.8,cd=d/2-2.4;
   line([[-cw,.09,-cd],[cw,.09,-cd],[cw,.09,cd],[-cw,.09,cd],[-cw,.09,-cd]],'#f2ece0');line([[-cw,.09,0],[cw,.09,0]],'#f2ece0');
   for(const x of [-cw,cw])cyl(x,1.6,0,.05,3.2,ms.metal,true);box(0,1.6,0,cw*2,1.15,.04,'#eef2ef',{transparent:true,opacity:.55,depthWrite:false});
   box(0,2.25,0,cw*2,.05,.05,ms.trim);
   /* 北墙看台三排（阶梯+扶手） */
   for(let r=0;r<3;r++){const zz=-d/2+1.5+r*1.15;box(-1.5,.24+r*.3,zz,10,.48+r*.6,1.05,ms.seat,true);box(-1.5,.52+r*.3,zz+.45,10,.06,.1,ms.trim);}
   /* 南墙器材架：立柱+三层搁板+球/横放垫 */
   for(const sx of [-1,1])box(sx*4.5,1.1,d/2-1.15,.09,2.2,.09,ms.metal,true);
   for(let s=0;s<3;s++){box(0,.5+s*.75,d/2-1.15,9,.06,.8,ms.metal);
     if(s<2)ballRow(-3.8,.68+s*.75,d/2-1.15,4,.24,['#d97b3f','#e2b13c','#5d8a5f','#4f7fa8']);
     else for(let m2=0;m2<3;m2++)cyl(-2.6+m2*2.4,1.32,d/2-1.15,.24,.9,'#6fa3a8',false,0,Math.PI/2);}
   /* 球车×2（斜口筐+球） */
   for(const cx of [-6.5,6.5]){box(cx,.42,3.2,1.15,.55,.85,ms.metal,true,false,0);box(cx,.78,3.05,1.15,.3,.55,ms.metal,false,0,.35);ballRow(cx-.36,.62,3.2,2,.22,['#d97b3f','#e2b13c']);for(const wx of [-.45,.45])cyl(cx+wx,.1,3.2,.12,.06,'#2c3338');}
   /* 跳箱三级+踏板（东北角） */
   box(w/2-3,.35,-d/2+4.2,1.3,.7,1.3,ms.wood,true);box(w/2-3,.8,-d/2+4.2,1.1,.5,1.1,ms.wood,true);box(w/2-3,1.15,-d/2+4.2,.9,.4,.9,ms.wood,true);
   box(w/2-3,.09,-d/2+5.9,1.2,.18,.7,'#c9a13c',true,0,.18);
   /* 东墙肋木（攀爬横档） */
   for(let r2=0;r2<9;r2++)cyl(w/2-.5,.5+r2*.42,-2+r2*.5,.025,2.6,ms.metal,false,0,Math.PI/2);
   box(w/2-.5,.06,-3.2,.12,.12,4.6,ms.metal,true);box(w/2-.5,.06,2.2,.12,.12,4.6,ms.metal,true);}
 if(v.id==='tennis'){const rx=-w/2+1.1,rz=d/2-3;box(rx,.45,rz,1.4,.1,2,ms.wood,true);for(const zz of [-.7,.7])box(rx,.23,rz+zz,.08,.46,.08,ms.metal);for(const dx of [-.35,.15]){const racket=new T.Mesh(new T.TorusGeometry(.23,.022,8,28),ms.trim);racket.scale.y=1.3;racket.position.set(rx+dx,1.3,rz);group.add(racket);box(rx+dx,.82,rz,.045,.4,.04,ms.metal);for(let j=-.15;j<=.15;j+=.075)line([[rx+dx+j,1.06,rz],[rx+dx+j,1.54,rz]],'#e1e8e6');}for(let i=0;i<3;i++){const ball=new T.Mesh(new T.SphereGeometry(.1,12,8),mat('#d8d967'));ball.position.set(rx-.35+i*.25,.6,rz+.55);group.add(ball);}box(0,.027,0,w-2,.014,d-2,'#669789');const cw2=w/2-2,cd2=d/2-2;line([[-cw2,.04,-cd2],[cw2,.04,-cd2],[cw2,.04,cd2],[-cw2,.04,cd2],[-cw2,.04,-cd2]]);for(const z of [-6,6])line([[-cw2,.04,z],[cw2,.04,z]]);line([[0,.04,-6],[0,.04,6]]);for(const x of [-cw2,cw2])box(x,.65,0,.07,1.3,.07,ms.metal,true);box(0,.55,0,cw2*2,1.1,.045,ms.glass,true);for(let x=-cw2;x<=cw2;x+=.3)line([[x,0,0],[x,1.1,0]],'#e0ebe2');}
 if(v.id==='basketball'){box(0,.03,0,w-1,.02,d-1,'#c6a077');for(const x of [-w/2+1,w/2-1])for(const z of [-4,-1,2])chair(x,z);box(0,2.8,-d/2+.5,2,1.2,.08,'#f5f3e9');
   /* 记分牌（北墙高处，翻分样式） */
   box(0,2.9,-d/2+.42,1.6,.7,.12,'#20262c',true);box(-.4,2.9,-d/2+.36,.5,.5,.03,'#e2b13c',{emissive:'#b98a1e',emissiveIntensity:.5});box(.4,2.9,-d/2+.36,.5,.5,.03,'#e2b13c',{emissive:'#b98a1e',emissiveIntensity:.5});box(0,2.9,-d/2+.35,.05,.5,.03,'#20262c');
   /* 球车（西南角）+ 边线球 */
   box(-w/2+1.6,.42,-d/2+2.6,1.15,.55,.85,ms.metal,true);box(-w/2+1.6,.78,-d/2+2.45,1.15,.3,.55,ms.metal,false,0,.35);ballRow(-w/2+1.24,.62,-d/2+2.6,2,.22,['#d97b3f','#e2b13c']);
   const ring=new T.Mesh(new T.TorusGeometry(.25,.035,6,24),ms.trim);ring.rotation.x=Math.PI/2;ring.position.set(0,2.6,-d/2+1);group.add(ring);line([[-2,.05,-d/2+1],[-2,.05,-d/2+5],[2,.05,-d/2+5],[2,.05,-d/2+1]]);}
 // 第7馆·电影馆：前墙大幕+金帘边，地面三级抬升，4排×6座红绒座椅，侧墙吸音条，南墙放映窗
 if(v.id==='cinema'){
   box(0,.025,0,w-1.3,.05,d-1.3,'#23262e');                                   // 深色观影地坪
   /* 大幕：深灰 Plane（材质独占，不进 batchFacility 合并桶；name/userData 供放映系统检索贴图） */
   const screen=new T.Mesh(new T.PlaneGeometry(10,3.6),new T.MeshBasicMaterial({color:'#2e3036'}));
   screen.position.set(0,2.25,-d/2+.42);screen.name='cinema-screen';screen.userData.screen=true;group.add(screen);
   /* 金色帘边竖条 + 暗红侧幕 + 顶部帷幔（前墙饰） */
   for(const sx of [-1,1]){box(sx*5.45,2.1,-d/2+.34,.36,4.2,.14,'#c9a13c');box(sx*5.95,2.1,-d/2+.3,.36,4.2,.1,'#5e2626');}
   box(0,4.14,-d/2+.34,11.5,.44,.16,'#c9a13c');box(0,3.8,-d/2+.36,11.5,.26,.1,'#5e2626');
   /* 三级台阶上升：0排平地、1-3排抬升；本体不挡人（入座走 sitAt），仅台阶前沿给低碰撞条 */
   for(let r=1;r<4;r++){const row=CINEMA_ROWS[r];box(0,row.y/2,row.z,11.6,row.y,1.5,'#31353f');box(0,row.y/2,row.z-.68,11.6,row.y,.14,ms.trim,true);}
   /* 4排×6座红绒座椅（roughness .95，同材质 Box 自动合并；中过道两侧各3座） */
   const velvet=mat('#8c2f33',{roughness:.95});
   for(const row of CINEMA_ROWS)for(const x of CINEMA_SEAT_X){box(x,row.y+.4,row.z,.58,.1,.52,velvet);box(x,row.y+.72,row.z+.24,.58,.62,.12,velvet);box(x,row.y+.17,row.z,.14,.34,.34,'#2a2d35');}
   for(const row of CINEMA_ROWS)box(0,row.y+.04,row.z,1.6,.02,1.3,'#57302f'); // 中过道暗红地毯
   /* 侧墙吸音竖条（双色交替）+ 四角紫色装饰线 */
   let ai=0;for(const sx of [-1,1])for(let z=-5.2;z<=3.4;z+=1.15,ai++)box(sx*(w/2-.28),2.15,z,.07,3.1,.55,ai%2?'#3a3f4b':'#2f333d');
   for(const sx of [-1,1]){box(sx*(w/2-.03),h/2,-d/2+.08,.2,h,.2,ms.trim);box(sx*(w/2-.03),h/2,d/2-.08,.2,h,.2,ms.trim);}
   /* 南墙（门侧）放映窗+放映机机身：emissive 仅材质自发光，不新增灯对象 */
   box(3.6,2.75,d/2-.14,1.5,.85,.12,'#17191f');box(3.6,2.75,d/2-.22,.5,.4,.04,'#ffd23c',{emissive:'#ffb61e',emissiveIntensity:.55});
   box(3.6,3.35,d/2-.55,.5,.4,.5,'#20242b');
   /* 门斗：紫色雨棚+暗色侧墙（门外小空间，侧墙带碰撞） */
   box(0,3.45,d/2+.9,3.9,.18,1.7,ms.trim);
   for(const sx of [-1.7,1.7])box(sx,1.65,d/2+.95,.16,3.3,.16,'#2a2d35',true);
 }
 // An unobstructed entry apron is shared by player walking and map destinations.
 box(0,-.005,d/2+1.3,3,.05,2.6,'#d3c9b5');group.userData.colliders=colliders;for(const [color,points] of lines)group.add(new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(points,3)),new T.LineBasicMaterial({color})));return batchFacility(group);}
export function disposeGroup(g){const gs=new Set(),ms=new Set(),ts=new Set();g.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){ms.add(m);if(m.map)ts.add(m.map);}});gs.forEach(x=>x.dispose());ts.forEach(x=>x.dispose());ms.forEach(x=>x.dispose());g.clear();}
