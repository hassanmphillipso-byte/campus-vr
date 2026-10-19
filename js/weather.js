import * as T from '../vendor/three/build/three.module.js';

// 天气系统：晴⇄多云⇄雨 黏性轮转 + 雨粒子（单个 LineSegments）+ 雷雨彩蛋。
// 与昼夜系统乘法叠加：daycycle 每帧调 factors() 拿乘数，本模块不直接改任何灯。
const FACTORS={ // 三种天气的目标乘数，全 1 即无影响
 sunny:{sun:1,hemi:1,env:1,bg:1,fogNear:1,fogFar:1,exposure:1,lamp:1},
 cloudy:{sun:.5,hemi:.82,env:.68,bg:.72,fogNear:.9,fogFar:.78,exposure:.97,lamp:1.15},
 rain:{sun:.3,hemi:.66,env:.42,bg:.4,fogNear:.7,fogFar:.52,exposure:.9,lamp:1.3},
};
const NAMES=['sunny','cloudy','rain'];
const DROPS=1200,LOW_DROPS=500; // 预建雨丝总数与降档后保留数
const WIND=2.2; // 水平风（x 正向）
const rand=(a,b)=>a+Math.random()*(b-a);
const OUT={sun:1,hemi:1,env:1,bg:1,fogNear:1,fogFar:1,exposure:1,lamp:1}; // factors() 复用输出，调用方当帧取值，勿持有
// 0.45s 雷电双峰衰减包络：快闪→微灭→再亮→衰减（分段线性，无函数调用外的开销）
function flicker(t){
 if(t<=0||t>=.45)return 0;
 if(t<.18)return 1-.9*(t/.18);            // 快闪：1 → .1
 if(t<.24)return .1-.04*((t-.18)/.06);    // 微灭：.1 → .06
 if(t<.33)return .06+.66*((t-.24)/.09);   // 再亮：.06 → .72
 return .72*(1-(t-.33)/.12);              // 衰减：.72 → 0
}
export class Weather{
 constructor({scene=null,audio={rain(){},thunder(){}},budget=()=>({mode:'auto',level:0}),onWeatherChange=null,onThunderStart=null}={}){
  this.audio=audio;this.budget=budget;this.onWeatherChange=onWeatherChange;this.onThunderStart=onThunderStart;
  this.weather='sunny';this.target='sunny';this.blend=1;this.blendDur=rand(8,10); // blend=1 表示已稳定在 current
  this.hold=rand(120,300);this.forced=null;this.liveMode=null;this.rainAmount=0;this.rainReported=0;
  this.boltIn=0;this.flashT=1;this.thunderIn=0;this.pendingThunder=false; // boltIn<=0 表示雷击未武装
  this.particleCount=DROPS;this.budgetIn=0;
  // 雨粒子：单个 LineSegments，几何直接存世界坐标（对象本体不动），体积随玩家靠触地重生跟随
  const pos=new Float32Array(DROPS*6),speed=new Float32Array(DROPS);
  for(let i=0;i<DROPS;i++){
   const a=Math.random()*6.2832,r=16*Math.sqrt(Math.random()),x=Math.cos(a)*r,z=Math.sin(a)*r,y=rand(12,14),j=i*6;
   pos[j]=x;pos[j+1]=y;pos[j+2]=z;pos[j+3]=x;pos[j+4]=y-.55;pos[j+5]=z; // 0.55m 短竖线，两点共享同一数组
   speed[i]=rand(18,26);
  }
  const geo=new T.BufferGeometry();
  this.rainAttr=new T.BufferAttribute(pos,3);geo.setAttribute('position',this.rainAttr);
  this.rainMat=new T.LineBasicMaterial({color:0xa8c0d8,transparent:true,opacity:0,depthWrite:false});
  this.rainLines=new T.LineSegments(geo,this.rainMat);
  this.rainLines.frustumCulled=false;this.rainLines.matrixAutoUpdate=false;this.rainLines.visible=false;
  this.rainPos=pos;this.rainSpeed=speed;
  if(scene)scene.add(this.rainLines);
 }
 tick(dt,px=0,pz=0){ // 所有计时都用 dt 累积推进，不依赖墙钟；帧内零对象分配
  // 轮转：稳定态持有 120-300s（黏性），到点换目标且避开当前；锁定/live 驱动后不再自动轮转
  if(!this.forced&&!this.liveMode&&this.weather===this.target){
   this.hold-=dt;
   if(this.hold<=0){
    this.setTarget(NAMES[(NAMES.indexOf(this.weather)+1+(Math.random()*(NAMES.length-1)|0))%NAMES.length]);
    this.hold=rand(120,300);
   }
  }
  // 过渡：blend 以随机 8-10s 时长线性推进 0→1，完成后 current=target
  if(this.weather!==this.target){
   this.blend+=dt/this.blendDur;
   if(this.blend>=1){this.weather=this.target;this.blend=1;}
  }
  // 雨量 = 「目标为雨」的混合权重
  const ra=this.rainAmount=this.target==='rain'?this.blend:this.weather==='rain'?1-this.blend:0;
  // 雨声回调节流：变化 >0.04 或跨越 0 才上报
  if((ra===0)!==(this.rainReported===0)||Math.abs(ra-this.rainReported)>.04){this.audio.rain(ra);this.rainReported=ra;}
  // 雷电：仅大雨（>0.75）且未 force 到非雨时武装倒计时 25-60s；已开始的闪光/雷声不受此门限制
  if(ra>.75&&(!this.forced||this.forced==='rain')){
   if(this.boltIn<=0)this.boltIn=rand(25,60);
   this.boltIn-=dt;
   if(this.boltIn<=0)this.strike();
  }
  if(this.flashT<.45)this.flashT+=dt;
  if(this.pendingThunder){this.thunderIn-=dt;if(this.thunderIn<=0){this.pendingThunder=false;this.audio.thunder();}}
  // 预算降档（0.5s 节流查询）：只影响画多少条，运动始终全量更新，恢复画质时不跳变
  this.budgetIn-=dt;
  if(this.budgetIn<=0){
   this.budgetIn=.5;
   const b=this.budget()||{};
   this.particleCount=b.mode==='smooth'||b.level>=2?LOW_DROPS:DROPS;
   this.rainLines.geometry.setDrawRange(0,this.particleCount*2);
  }
  const vis=ra>.02;
  this.rainLines.visible=vis;this.rainMat.opacity=.34*ra;
  if(vis){
   const p=this.rainPos,sp=this.rainSpeed;
   for(let i=0;i<DROPS;i++){
    const j=i*6;
    let x=p[j]+WIND*dt,y=p[j+1]-sp[i]*dt;
    if(y<0){ // 触地重生：玩家周围半径 16m、高度 12-14m（初始化时按原点生成）
     const a=Math.random()*6.2832,r=16*Math.sqrt(Math.random());
     x=px+Math.cos(a)*r;y=rand(12,14);
     p[j+2]=pz+Math.sin(a)*r;p[j+5]=p[j+2];
    }
    p[j]=x;p[j+1]=y;p[j+3]=x;p[j+4]=y-.55;
   }
   this.rainAttr.needsUpdate=true;
  }
 }
 setTarget(name){ // 切换目标并从头开始过渡；仅此路径触发 onWeatherChange（一次）
  if(this.target===name)return;
  this.target=name;this.blend=0;this.blendDur=rand(8,10);
  this.onWeatherChange?.(name);
 }
 factors(){ // 当前值向目标值按 blend 线性插值；雷电期间曝光再乘 (1+2.2*flicker)
  const f=FACTORS[this.weather],t=FACTORS[this.target],b=this.blend;
  OUT.sun=f.sun+(t.sun-f.sun)*b;OUT.hemi=f.hemi+(t.hemi-f.hemi)*b;OUT.env=f.env+(t.env-f.env)*b;
  OUT.bg=f.bg+(t.bg-f.bg)*b;OUT.fogNear=f.fogNear+(t.fogNear-f.fogNear)*b;OUT.fogFar=f.fogFar+(t.fogFar-f.fogFar)*b;
  OUT.lamp=f.lamp+(t.lamp-f.lamp)*b;
  OUT.exposure=(f.exposure+(t.exposure-f.exposure)*b)*(1+2.2*flicker(this.flashT));
  return OUT;
 }
 force(name){ // ?weather= 验收用：锁定天气（过渡到目标后保持），锁定后不再自动轮转；手动强制优先于 live
  if(!FACTORS[name])throw Error('未知天气：'+name);
  this.forced=name;this.liveMode=null;this.setTarget(name);
 }
 live(mode){ // 实时天气驱动（weather_live.js）：三态接管目标但不置 forced；null 释放回自动轮转
  if(mode===null){this.liveMode=null;return;}
  if(!FACTORS[mode])throw Error('未知天气：'+mode);
  this.forced=null;this.liveMode=mode;this.setTarget(mode);
 }
 isRaining(){return this.rainAmount>.6;}
 strike(){ // 雷击：闪光计时开始，0.5-2.0s 随机延迟后雷声（延迟由 tick 时间轴推进，不用 setTimeout）
  this.flashT=0;this.thunderIn=rand(.5,2);this.pendingThunder=true;
  this.onThunderStart?.();
 }
 state(){
  return {weather:this.weather,target:this.target,blend:this.blend,rainAmount:this.rainAmount,
   lightning:{active:this.flashT<.45,pendingThunder:this.pendingThunder},forced:this.forced,particles:this.particleCount,
   live:this.liveMode||null,source:this.forced?'forced':this.liveMode?'live':'auto'};
 }
}
