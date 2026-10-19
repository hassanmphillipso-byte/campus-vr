// 真实时间昼夜系统：跟随设备时钟（或 ?t=HH:MM 虚拟时钟）按 24h 时间线插值灯光/雾/背景/曝光并驱动路灯。
// 约束：sun/dynLight 位置固定（静态阴影图已首帧烘焙冻结），本模块只写 color/intensity，绝不碰 position 与 shadow 设置。
import * as T from '../vendor/three/build/three.module.js';
const ss=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);}; // smootherstep 过渡
const lerp=(a,b,t)=>a+(b-a)*t;
// 四段光照预设；day 与场景初始值一致，保证接管无缝
const P={
 night:{sunColor:new T.Color(0x8fa8d8),sunIntensity:.22,hemiSky:new T.Color(0x1c2c4a),hemiGround:new T.Color(0x141c22),hemiIntensity:.38,fogColor:new T.Color(0x0c1626),fogNear:55,fogFar:170,bgIntensity:.16,envIntensity:.12,exposure:.82},
 dawn:{sunColor:new T.Color(0xffb27a),sunIntensity:1.5,hemiSky:new T.Color(0x7f9fd0),hemiGround:new T.Color(0x3a4636),hemiIntensity:.75,fogColor:new T.Color(0xf2b98c),fogNear:70,fogFar:200,bgIntensity:.75,envIntensity:.6,exposure:1},
 day:{sunColor:new T.Color(0xfff4e0),sunIntensity:2.6,hemiSky:new T.Color(0xbcd7ff),hemiGround:new T.Color(0x4a5b3a),hemiIntensity:.9,fogColor:new T.Color(0x9ec7ee),fogNear:90,fogFar:220,bgIntensity:1,envIntensity:1,exposure:1.05},
 dusk:{sunColor:new T.Color(0xff9a5c),sunIntensity:1.2,hemiSky:new T.Color(0x5e6fa8),hemiGround:new T.Color(0x40342e),hemiIntensity:.6,fogColor:new T.Color(0xc98a6a),fogNear:65,fogFar:185,bgIntensity:.5,envIntensity:.4,exposure:.95}
};
// 24h 时间线边界（小时十进制）：night / night→dawn / dawn→day / day / day→dusk / dusk→night / night；倒数预计算，tick 零分配
const T1=5,T2=6.5,T3=8,T4=17,T5=18.5,T6=20,I12=1/(T2-T1),I23=1/(T3-T2),I45=1/(T5-T4),I56=1/(T6-T5);
const LAMP_SPOTS=[[-48,-53.2],[8,-53.2],[48,-53.2],[-28.4,-30],[-28.4,30],[30,86.6]]; // 主干道/球场路灯点位
const pad=n=>String(n).padStart(2,'0');
export class DayCycle{
 constructor({scene,renderer,sun,dynLight,hemi,override=null}){
  this.scene=scene;this.renderer=renderer;this.sun=sun;this.dynLight=dynLight;this.hemi=hemi;this.modifier=null;
  this.virtual=!!override;
  this.time=((Number(override?.hour)||0)%24+(Number(override?.minute)||0)/60)%24; // 虚拟时钟起点，此后按真实秒数推进
  this.base={sunColor:new T.Color(),sunIntensity:0,hemiSky:new T.Color(),hemiGround:new T.Color(),hemiIntensity:0,fogColor:new T.Color(),fogNear:0,fogFar:0,bgIntensity:0,envIntensity:0,exposure:1.05,lamp:1}; // tick 全程复用零分配；lamp 供天气乘法调制，默认 1
  this.cur=this.base;this.lampLevel=0;this.hour=this.time;
  this.buildLamps();this.tick(0); // 构造即应用一次，接管时画面无缝
  if(typeof window!=='undefined')window.__dayCycle={snapshot:()=>this.snapshot()}; // 只读诊断，无测试专用控制；无 window 环境安全
 }
 buildLamps(){
  const poleGeo=new T.CylinderGeometry(.09,.11,4.6,10),armGeo=new T.BoxGeometry(.06,.06,.9),headGeo=new T.SphereGeometry(.16,12,10);
  const metal=new T.MeshStandardMaterial({color:0x3d4650,roughness:.9});
  const group=new T.Group();group.name='campus-daycycle-lamps';this.lamps=[];
  for(const [x,z] of LAMP_SPOTS){
   const pole=new T.Mesh(poleGeo,metal);pole.position.set(x,2.3,z);
   const arm=new T.Mesh(armGeo,metal);arm.position.set(x+.4,4.52,z);
   const mat=new T.MeshStandardMaterial({color:0x2a2f36,emissive:0xffd9a0,emissiveIntensity:0}); // 每盏灯头独立材质，emissiveIntensity 随夜色动画 0~2.2
   const head=new T.Mesh(headGeo,mat);head.position.set(x+.82,4.4,z);
   for(const m of [pole,arm,head]){m.castShadow=false;m.receiveShadow=false;} // 阴影图冻结，不参与烘焙
   const light=new T.PointLight(0xffd9a0,0,22,2);light.position.set(x+.82,4.35,z);
   group.add(pole,arm,head,light);this.lamps.push({light,mat});
  }
  this.scene.add(group);
 }
 setModifier(fn){this.modifier=fn||null;}
 tick(dt){
  const h=this.virtual?(this.time=(this.time+(Number.isFinite(dt)?Math.max(0,dt):0)/3600)%24):new Date().getHours()+new Date().getMinutes()/60+new Date().getSeconds()/3600+new Date().getMilliseconds()/36e5;
  this.hour=h;
  let A,B,t; // 时间线取值：纯段直接用预设，过渡段 smootherstep 混合
  if(h<T1||h>=T6){A=P.night;B=A;t=0;}
  else if(h<T2){A=P.night;B=P.dawn;t=ss((h-T1)*I12);}
  else if(h<T3){A=P.dawn;B=P.day;t=ss((h-T2)*I23);}
  else if(h<T4){A=P.day;B=A;t=0;}
  else if(h<T5){A=P.day;B=P.dusk;t=ss((h-T4)*I45);}
  else{A=P.dusk;B=P.night;t=ss((h-T5)*I56);}
  const b=this.base;
  b.sunColor.lerpColors(A.sunColor,B.sunColor,t);b.hemiSky.lerpColors(A.hemiSky,B.hemiSky,t);b.hemiGround.lerpColors(A.hemiGround,B.hemiGround,t);b.fogColor.lerpColors(A.fogColor,B.fogColor,t);
  b.sunIntensity=lerp(A.sunIntensity,B.sunIntensity,t);b.hemiIntensity=lerp(A.hemiIntensity,B.hemiIntensity,t);
  b.fogNear=lerp(A.fogNear,B.fogNear,t);b.fogFar=lerp(A.fogFar,B.fogFar,t);
  b.bgIntensity=lerp(A.bgIntensity,B.bgIntensity,t);b.envIntensity=lerp(A.envIntensity,B.envIntensity,t);b.exposure=lerp(A.exposure,B.exposure,t);b.lamp=1;
  const c=this.modifier?this.modifier(b)||b:b;this.cur=c; // 天气等 modifier 乘法叠加，改完的对象直接用
  this.sun.color.copy(c.sunColor);this.sun.intensity=c.sunIntensity; // 只写颜色/强度，位置与 shadow 不动
  this.dynLight.color.copy(c.sunColor);this.dynLight.intensity=c.sunIntensity*.35;
  this.hemi.color.copy(c.hemiSky);this.hemi.groundColor.copy(c.hemiGround);this.hemi.intensity=c.hemiIntensity;
  const fog=this.scene.fog;if(fog){fog.color.copy(c.fogColor);fog.near=c.fogNear;fog.far=c.fogFar;}
  const bg=this.scene.background;
  if(bg){if(bg.isTexture)this.scene.backgroundIntensity=c.bgIntensity;else if(bg.isColor)bg.copy(c.fogColor);} // HDR→写强度；纯色兜底→与雾同源同色
  if(this.scene.environment)this.scene.environmentIntensity=c.envIntensity;
  this.renderer.toneMappingExposure=c.exposure;
  this.lampLevel=h>=T6||h<T1?1:h<T2?1-ss((h-T1)*I12):h>=T5?ss((h-T5)*I56):0; // 夜晚权重：黄昏渐亮至 1、深夜全亮、清晨渐灭回 0、白天全灭
  const li=2.4*this.lampLevel*c.lamp,on=li>.02;
  for(const L of this.lamps){L.light.intensity=li;L.light.visible=on;L.mat.emissiveIntensity=2.2*this.lampLevel;}
 }
 snapshot(){
  const h=this.hour,H=Math.floor(h)%24,M=Math.floor(h*60)%60,S=Math.floor(h*3600)%60;
  return {clock:pad(H)+':'+pad(M),hour:H,minute:M,second:S,phase:h<T1||h>=T6?'night':h<T3?'dawn':h<T4?'day':'dusk',
   phaseLabel:h<T1||h>=T6?'夜晚':h<8?'清晨':h<11?'上午':h<13?'中午':h<17?'下午':'傍晚',
   virtual:this.virtual,exposure:this.cur.exposure,lampLevel:this.lampLevel,bgIntensity:this.cur.bgIntensity};
 }
}
