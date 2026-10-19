import * as T from 'three';

// Explicit role assignments. A name's seed changes timing, never its profession.
export const CAST = {
  '熊雨桐':['ropeTeam','skipping'], '万子轩':['ropeTeam','skipping'],
  '罗晨曦':['ropeTeam','rope-record'], '谌之涵':['ropeTeam','rope-setup'],
  '李泽宇':['ropeTeam','rope-setup'], '涂欣然':['ropeTeam','rope-count'],
  '熊梓豪':['main','commute'], '邓芊羽':['plaza','chat'],
  '胡子航':['colA','hall-study'], '欧阳朵朵':['bench','bench-read'],
  '刘一帆':['grass','nature-notes'], '万梓萱':['spine','commute'],
  '李昊然':['footField','football'], '陈雨欣':['ew','hall-study'],
  '王浩宇':['track','runner'], '张若溪':['track','runner'],
  '徐子谦':['goalie','goalkeeper'], '黄悦':['bench','bench-rest'],
  '胡博文':['gate','gate-duty'], '孙梦洁':['grass','outdoor-read'],
  '邹亮':['rostrum','rope-coach'], '万老师':['colA','teacher-patrol'],
  '李老师':['colB','teacher-patrol'], '胡老师':['ew','teacher-patrol'],
  '杨校医':['spine','medic'], '张守安':['gate','security'],
  '孙桂芳':['main','cleaner'], '李师傅':['colB','delivery'],
  '邓老师':['plaza','lesson-prep'], '陈阿姨':['admin','librarian'],
  '季小满':['exercise','warmup-lead'], '唐堂':['exercise','warmup'],
  '宁小苒':['exercise','warmup'], '石头':['exercise','warmup'],
  '江浪':['swim','freestyle'], '沈小鱼':['swim','breaststroke'],
  '方瑞':['ping1','table-a'], '康小桥':['ping1','table-b'],
  '毛豆豆':['ping2','serve-practice'], '温书言':['ping2','referee'],
  '袁野':['footField','football'], '鲁水生':['poolDeck','lifeguard'],
  '白教练':['poolDeck','swim-coach'], '高教练':['gymCourt','basketball-coach'],
  '范子骞':['gymCourt','set-shot'], '尹歆玥':['gymCourt','dribble'],
  '林小雨':['main','guide'],
};

export const PLANS = {
  'pianist':[['piano-practice',16],['rest',3]],
  'choir-lead':[['conduct',12],['coach',5]],
  'choir':[['sing',12],['rest',4]],
  'pool-prep':[['timing',8],['coach',6]],
  'commute':[['walk',7],['check-notes',4],['rest',3]],
  'chat':[['walk',5],['chat',6],['rest',3]],
  'hall-study':[['walk',6],['read',7],['rest',3]],
  'bench-read':[['read',15],['look',4],['rest',3]],
  'bench-rest':[['rest',11],['read',6],['look',4]],
  'nature-notes':[['observe',6],['write-notes',7],['rest',4]],
  'outdoor-read':[['read',12],['look',4],['rest',3]],
  'teacher-patrol':[['patrol',7],['check-notes',7],['look',4]],
  'gate-duty':[['patrol',5],['checkpoint',8],['rest',4]],
  'security':[['checkpoint',9],['patrol',5],['look',4]],
  'cleaner':[['walk',5],['sweep',9],['rest',4]],
  'delivery':[['deliver',9],['check-tray',5],['rest',4]],
  'librarian':[['walk',6],['sort-books',7],['read',6]],
  'medic':[['patrol',6],['check-kit',7],['rest',4]],
  'lesson-prep':[['write-notes',9],['read',6],['rest',4]],
  'rope-coach':[['timing',9],['coach',4],['rest',5]],
  'rope-record':[['write-notes',9],['timing',6],['rest',5]],
  'rope-count':[['timing',8],['write-notes',6],['rest',5]],
  'rope-setup':[['check-rope',6],['skip',6],['rest',7]],
  'skipping':[['skip',8],['rest',6],['check-rope',5]],
  'warmup':[['stretch',7],['rest',6],['look',3]],
  'warmup-lead':[['stretch',8],['coach',4],['rest',5]],
  'runner':[['run',17],['rest',7],['stretch',5]],
  'football':[['walk',5],['pass-ready',7],['rest',4]],
  'goalkeeper':[['guard',8],['side-step',4],['rest',4]],
  'dribble':[['dribble',9],['hold-ball',4],['rest',6]],
  'set-shot':[['shoot',6],['hold-ball',4],['rest',7]],
  'basketball-coach':[['check-notes',7],['coach',4],['look',6]],
  'freestyle':[['swim-free',14],['float-rest',6]],
  'breaststroke':[['swim-breast',13],['float-rest',7]],
  'table-a':[['table-ready',3],['table-hit',7],['rest',4]],
  'table-b':[['table-ready',3],['table-hit',7],['rest',4]],
  'serve-practice':[['serve',7],['rest',5]],
  'referee':[['scorecard',9],['look',5]],
  'lifeguard':[['watch-pool',10],['patrol',5],['look',4]],
  'swim-coach':[['patrol',6],['timing',7],['coach',4]],
  'guide':[['guide',1]],
  'lab-timer':[['timing',9],['write-notes',6],['look',4]],
  'reviewer':[['check-notes',9],['write-notes',6],['look',3]],
  'analyst':[['tablet',10],['write-notes',5],['look',4]],
  'registrar':[['check-notes',8],['write-notes',7],['rest',4]],
  'lab-measure':[['measure',8],['write-notes',5],['look',4]],
  'technician':[['inspect-tool',8],['check-notes',6],['look',4]],
  'programmer':[['tablet',10],['check-notes',6],['look',4]],
  'archivist':[['sort-books',8],['check-notes',6],['rest',4]],
};

const LABELS = {
  walk:'步行通行', patrol:'巡视', rest:'短暂休息', look:'观察周围',
  read:'阅读', 'check-notes':'核对资料', 'write-notes':'记录', chat:'课间交流',
  observe:'观察草坪', checkpoint:'检查出入', sweep:'清扫地面', deliver:'运送餐盘',
  'check-tray':'检查餐盘', 'sort-books':'整理书册', 'check-kit':'检查医药箱',
  timing:'计时记录', coach:'示范讲解', 'check-rope':'整理跳绳', skip:'跳绳练习',
  stretch:'热身拉伸', run:'跑道慢跑', 'pass-ready':'接球回传', guard:'守门观察',
  'side-step':'门线移动', dribble:'原地运球', 'hold-ball':'持球准备', shoot:'定点投篮',
  'swim-free':'自由泳练习', 'swim-breast':'蛙泳练习', 'float-rest':'水面休息',
  'table-ready':'持拍准备', 'table-hit':'乒乓对练', serve:'发球练习', scorecard:'记分观察',
  'watch-pool':'巡视泳道', guide:'带路与讲解', tablet:'核对屏幕', measure:'测量记录',
  'inspect-tool':'检查工具', 'piano-practice':'钢琴排练',conduct:'指挥排练',sing:'合唱排练',
};
const MOVING = new Set(['walk','patrol','deliver','run']);
const q = new T.Quaternion(), q2 = new T.Quaternion(), q3 = new T.Quaternion();
const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), direction = new T.Vector3();
const axes = {x:new T.Vector3(1,0,0),y:new T.Vector3(0,1,0)};
function hash(s){let h=2166136261;for(const ch of s)h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;return h;}

export function characterBones(obj){
  const B={};obj.traverse(o=>{if(!o.isBone)return;const n=o.name.toLowerCase();
    if(/^(control|ik|heel|knee|elbow|handik|toe)/.test(n))return;
    const side=/l$/.test(n)?'l':/r$/.test(n)?'r':null;
    if(/lowerarm|forearm/.test(n)&&side)B[side+'Fore']=o;
    else if(/upperarm|^arm/.test(n)&&side)B[side+'Arm']=o;
    else if(/^hand|palm/.test(n)&&side)B[side+'Hand']=o;
    else if(/upperleg|thigh/.test(n)&&side)B[side+'Thigh']=o;
    else if(/lowerleg|shin|calf/.test(n)&&side)B[side+'Shin']=o;
    else if(/^hips|pelvis/.test(n))B.hips=o;
    else if(/head/.test(n))B.head ||= o;
    else if(/torso|chest|spine/.test(n))B.torso ||= o;
  });return B;
}

export function initSceneActivity(npc,parent,override){
  if(npc.activity?.interject)I_ACTIVE--;               // 重建活动时清理插曲并发计数
  IREG.add(npc);                                       // 微动作插曲注册表（force/雷击广播用）
  const entry=override || CAST[npc.n];
  if(!entry || !PLANS[entry[1]])throw Error('未分配人物场景行为：'+npc.n);
  const seed=hash(npc.n),plan=PLANS[entry[1]],total=plan.reduce((v,x)=>v+x[1],0);
  npc.activity={scene:entry[0],profile:entry[1],plan,clock:(seed%1009)/1009*total,
    kind:'rest',label:'短暂休息',localTime:0,index:0,moving:false,talking:false,
    weight:0,base:new Map(),props:{},owned:[],parent,home:npc.obj.position.clone(),
    height:npc.height||1.65,handError:0,transitions:0,lastKind:null};
}

export function restoreSceneActivity(npc){
  const s=npc.activity;if(!s)return;
  for(const [bone,v] of s.base)bone.quaternion.copy(v);
}

export function advanceSceneActivity(npc,dt,talking=false){
  const s=npc.activity;if(!s)return;
  s.talking=talking;
  iFrame();                                            // 时钟/雷击缓存刷新（内部节流，非 talking 专属）
  if(!talking)s.clock+=dt;
  const total=s.plan.reduce((n,p)=>n+p[1],0);let ph=s.clock%total;
  for(let i=0;i<s.plan.length;i++){
    if(ph<s.plan[i][1]){s.index=i;s.localTime=ph;s.kind=s.plan[i][0];break;}
    ph-=s.plan[i][1];
  }
  if(s.kind!==s.lastKind){s.transitions++;s.lastKind=s.kind;maybeInterject(npc);} // 相位切换=插曲插入时机
  s.moving=!talking && MOVING.has(s.kind);
  s.label=talking?'停下交谈':LABELS[s.kind]||s.kind;
  if(s.interject&&!talking){                          // talking 冻结在播插曲计时（与相位时钟同语义）
    s.interject.t+=dt;if(s.interject.t>=s.interject.dur)endInterject(s);}
  if(s.skyAt!==undefined){                            // 雷击「看天空」：错峰到点即插，窗口外作废
    const now=performance.now();
    if(now>=s.skyUntil){delete s.skyAt;delete s.skyUntil;}
    else if(now>=s.skyAt&&!s.interject&&!talking&&!iBusy()){
      delete s.skyAt;delete s.skyUntil;startInterject(npc,'look-up-sky');}}
}

// Metre-space points relative to the hips, following the actor's full orientation.
function point(n,x,y,z){
  // VRoid shoulders sit higher above the hips than the old rig. Read notes at
  // lower-chest height instead of reusing the old rig's high wrist targets.
  if(n.cast&&y>0){y*=.48;z*=1.1;}
  const h=n.activity.height,hip=n.B.hips?.getWorldPosition(new T.Vector3())||n.obj.position.clone();
  return new T.Vector3(x*h,y*h,z*h).applyQuaternion(n.obj.quaternion).add(hip);
}
function remember(n,bone){if(!bone)return;const m=n.activity.base;if(!m.has(bone))m.set(bone,bone.quaternion.clone());else m.get(bone).copy(bone.quaternion);}
function rotate(n,bone,axis,angle){
 if(!bone)return;
 if(n.cast){
  const worldAxis=axes[axis].clone().applyQuaternion(n.obj.getWorldQuaternion(new T.Quaternion()));
  worldAxis.applyQuaternion(bone.getWorldQuaternion(new T.Quaternion()).invert());
  bone.quaternion.multiply(q.setFromAxisAngle(worldAxis,angle*n.activity.weight));
 }else bone.quaternion.multiply(q.setFromAxisAngle(axes[axis],angle*n.activity.weight));
}
function alignBone(bone,child,target){
  bone.getWorldPosition(a);child.getWorldPosition(b);direction.copy(b).sub(a).normalize();
  c.copy(target).sub(a).normalize();q.setFromUnitVectors(direction,c);
  bone.getWorldQuaternion(q2);q.multiply(q2);bone.parent.getWorldQuaternion(q3).invert();
  bone.quaternion.copy(q3.multiply(q));bone.updateWorldMatrix(false,true);
}

// Two-bone IK, constrained to the measured upper/forearm lengths. The elbow
// pole stays lateral and below the shoulder, avoiding flipped/locked elbows.
function arm(n,side,target){
  const B=n.B,U=B[side+'Arm'],F=B[side+'Fore'],H=B[side+'Hand'];if(!U||!F||!H)return;
  n.obj.updateWorldMatrix(true,true);
  const shoulder=U.getWorldPosition(new T.Vector3()),elbow=F.getWorldPosition(new T.Vector3()),hand=H.getWorldPosition(new T.Vector3());
  const desired=hand.clone().lerp(target,n.activity.weight),l1=shoulder.distanceTo(elbow),l2=elbow.distanceTo(hand);
  const D=desired.clone().sub(shoulder),raw=D.length(),dist=T.MathUtils.clamp(raw,Math.abs(l1-l2)+.001,l1+l2-.005);D.normalize();
  const pole=point(n,side==='l'?.32:-.32,-.13,.025).sub(shoulder);
  pole.addScaledVector(D,-pole.dot(D));if(pole.lengthSq()<1e-8)pole.set(0,0,1);pole.normalize();
  const along=(l1*l1-l2*l2+dist*dist)/(2*dist),lift=Math.sqrt(Math.max(0,l1*l1-along*along));
  const goalElbow=shoulder.clone().addScaledVector(D,along).addScaledVector(pole,lift);
  alignBone(U,F,goalElbow);alignBone(F,H,shoulder.clone().addScaledVector(D,dist));
  n.activity.handError=Math.max(n.activity.handError,H.getWorldPosition(new T.Vector3()).distanceTo(desired));
  (n.activity.armDetails ||= {})[side]={shoulder:shoulder.toArray(),target:desired.toArray(),hand:H.getWorldPosition(new T.Vector3()).toArray(),length:l1+l2,reach:raw};
}

/* ================== 微动作插曲（interjection）· 总案 §3.3-B P0 ==================
 * 一次性插曲：看表 / 伸懒腰 / 理书包 / 雷击看天。不改 PLANS——在 advanceSceneActivity
 * 的相位切换时机按「时段+天气+角色」小概率插入（默认 2%/相位·人；?interject=0.xx 覆盖，
 * =1 表示符合条件的相位切换必插，供验收）。姿态在 applySceneActivity 里叠加在原相位姿态
 * 之后，只调现有 rotate/arm 助手；每帧先 restore+remember 基准再绝对设置，插曲结束下一帧
 * 即被原相位姿态自然覆盖，无残留。位置红线：只动骨骼姿态，不写 pos.x/z，零新模型/光源。
 * 冻结语义：talking 时既不新插（等聊完）也不推进在播插曲计时；体育/考核接管期不插
 * （iBusy 读现有 __sportsExam / __sportsPlay / __campus.sports 探针，0.5s 节流缓存）。
 * 小时来源：__dayCycle.snapshot()（回退 __campus.state().clock），0.5s 节流缓存，拿不到
 * hour 则时间类插曲全部不触发（防御式）。雷击：轮询 __weather.state().lightning.active
 * 上升沿（0.15s 节流，0.45s 闪光窗必命中），事件驱动、非概率，姓名哈希错峰 0–2.6s，
 * 5s 窗口后作废——weather.js 与 index.html 零改动。 */
const INTERJECTS={
  'check-watch':{dur:1.2,label:'看表'},'stretch-yawn':{dur:1.6,label:'伸懒腰'},
  'fix-bag':{dur:1.3,label:'理书包'},'look-up-sky':{dur:1.5,label:'看天空'}};
// 看表限教师/教练岗位（万/李/胡老师=teacher-patrol、邓老师=lesson-prep、邹亮=rope-coach、
// 白教练=swim-coach、高教练=basketball-coach、温书言=referee）
const WATCH_PROFILES=new Set(['teacher-patrol','lesson-prep','rope-coach','swim-coach','basketball-coach','referee']);
// 理书包限通学类学生（通勤/课间交流/走廊自习/长椅读写/草坪观察阅读——背包走读集合）
const BAG_PROFILES=new Set(['commute','chat','hall-study','bench-read','bench-rest','nature-notes','outdoor-read']);
const BELL_MIN=[470,575,655,840,935]; // 上课铃 07:50/09:35/10:55/14:00/15:35（分钟数）
const I_COOLDOWN=8000,I_CAP=6,SKY_WINDOW=5000;
let I_RATE=.02;
try{const iv=parseFloat(new URLSearchParams(location.search).get('interject'));
  if(Number.isFinite(iv)&&iv>=0&&iv<=1)I_RATE=iv;}catch(e){}
const ISTATS={count:0,byKind:{},last:null};
const IREG=new Set();let I_ACTIVE=0;
const ICLOCK={at:-1,hour:-1,minute:-1};let I_LN_AT=-1,I_LN_ON=false,I_BUSY={at:-1,v:false};
function iFrame(){iRefreshClock();iPollLightning();}   // 每帧入口（内部各自节流，实际 ~2Hz/~7Hz）
function iRefreshClock(){
  const now=performance.now();if(now-ICLOCK.at<500)return;ICLOCK.at=now;
  let snap=null;try{snap=window.__dayCycle?.snapshot?.()||window.__campus?.state?.()?.clock||null;}catch(e){}
  if(snap&&Number.isFinite(snap.hour)){ICLOCK.hour=snap.hour;ICLOCK.minute=snap.minute||0;}
  else{ICLOCK.hour=-1;ICLOCK.minute=-1;}
}
function iBusy(){
  const now=performance.now();if(now-I_BUSY.at<500)return I_BUSY.v;
  let v=false;
  try{
    if(window.__sportsExam?.state?.().id)v=true;                    // 考核接管
    else{const sp=window.__sportsPlay?.state?.();if(sp&&(sp.active||sp.open))v=true;}
    if(!v){const s=window.__campus?.sports?.();                    // 竞速/点球/乒乓/冲刺等
      if(s)v=!!(s.raceRun?.phase||s.raceSwim?.phase||s.penalty?.active||s.ping?.active||s.charge?.active);}
  }catch(e){}
  I_BUSY={at:now,v};return v;
}
function iPollLightning(){
  const now=performance.now();if(now-I_LN_AT<150)return;I_LN_AT=now;
  let on=false;try{on=!!window.__weather?.state?.().lightning?.active;}catch(e){}
  if(on&&!I_LN_ON){ // 上升沿：在岗且无插曲者挂起一次「看天空」，姓名哈希错峰 0–2.6s
    for(const n of IREG){const s=n.activity;if(!s||s.interject)continue;
      if(now-(s.seenAt||0)>1500)continue;
      s.skyAt=now+(hash(n.n)%100)/100*2600;s.skyUntil=now+SKY_WINDOW;}
  }
  I_LN_ON=on;
}
function iEligible(s){
  if(ICLOCK.hour<0)return[];
  const m=ICLOCK.hour*60+ICLOCK.minute,out=[];
  if(WATCH_PROFILES.has(s.profile)&&(BELL_MIN.some(b=>m>=b-12&&m<b)||m>=980&&m<1020))out.push('check-watch'); // 课前12分钟或放学 16:20–17:00
  if(m>=780&&m<840)out.push('stretch-yawn');      // 午后困时段 13:00–14:00，任意在岗者
  if(BAG_PROFILES.has(s.profile))out.push('fix-bag'); // 通学学生，不限时段
  return out;
}
function startInterject(npc,kind,forced=false){
  const s=npc.activity,K=INTERJECTS[kind];if(!s||!K||s.interject)return false;
  s.interject={kind,t:0,dur:K.dur,label:K.label,env:0};I_ACTIVE++;
  ISTATS.count++;ISTATS.byKind[kind]=(ISTATS.byKind[kind]||0)+1;
  ISTATS.last={kind,name:npc.n,forced:!!forced,at:+(performance.now()/1000).toFixed(2),
    clock:ICLOCK.hour>=0?String(ICLOCK.hour).padStart(2,'0')+':'+String(ICLOCK.minute).padStart(2,'0'):null};
  return true;
}
function endInterject(s){if(!s.interject)return;s.interject=null;I_ACTIVE--;}
function maybeInterject(npc){
  const s=npc.activity;
  if(!s||s.interject||s.talking||iBusy())return;
  const now=performance.now();
  if(now-(s.seenAt||0)>1500)return;                 // 仅对仍在行为渲染管线的在岗者（导师/竞速接管/离场者除外）
  if(s.skyAt!==undefined)return;                    // 雷击插曲待触发时不占位
  if(now-(s.lastInterjectAt||0)<I_COOLDOWN)return;  // 同人 8s 冷却
  if(I_ACTIVE>=I_CAP)return;                        // 全场并发 ≤6（四元数预算护栏）
  const pool=iEligible(s);if(!pool.length)return;
  if(Math.random()>=I_RATE)return;
  s.lastInterjectAt=now;
  startInterject(npc,pool[(hash(npc.n)+s.transitions)%pool.length]); // 姓名哈希挑 kind，多条件时去同步
}
// 每种插曲 ≤4 次 rotate/arm 原语（≈8–14 次四元数运算，红线内）；包络 tri(抬,放) 乘姿态权重。
function applyInterjectPose(n,inj){
  const s=n.activity,p=Math.min(1,inj.t/inj.dur);
  const tri=(up,down)=>Math.max(0,Math.min(1,p/up,(1-p)/down))*s.weight;
  let env=0;
  if(inj.kind==='check-watch'){env=tri(.28,.28);           // 抬腕→低头看表→放腕
    if(env>.02){arm(n,'r',point(n,-.095,.235,.165));rotate(n,n.B.head,'x',.2*env);}
  }else if(inj.kind==='stretch-yawn'){env=tri(.3,.42);     // 双臂上举过头+头后仰（旋转式，省预算）
    rotate(n,n.B.lArm,'x',-1.95*env);rotate(n,n.B.rArm,'x',-1.95*env);
    rotate(n,n.B.head,'x',-.24*env);rotate(n,n.B.torso,'x',-.07*env);
  }else if(inj.kind==='fix-bag'){env=tri(.3,.42);          // 双手摆向身后摸书包带
    rotate(n,n.B.lArm,'x',.85*env);rotate(n,n.B.rArm,'x',.85*env);
    rotate(n,n.B.lFore,'x',.5*env);rotate(n,n.B.rFore,'x',.5*env);
  }else if(inj.kind==='look-up-sky'){env=tri(.2,.3);       // 抬头看天
    rotate(n,n.B.head,'x',-.55*env);rotate(n,n.B.torso,'x',-.08*env);
  }
  inj.env=env; // 验收读数：当前包络幅度 0–1
}
if(typeof window!=='undefined')window.__npcInterject={ // 可观测性（验收依赖）
  get count(){return ISTATS.count;},
  get byKind(){return {...ISTATS.byKind};},
  get last(){return ISTATS.last;},
  get rate(){return I_RATE;},set rate(v){if(Number.isFinite(v)&&v>=0&&v<=1)I_RATE=v;},
  force(kind){ // 测试确定性入口：随机一名在岗（≈2s 内仍在渲染）NPC 立即插入指定 kind
    if(!INTERJECTS[kind])return{ok:false,err:'unknown kind'};
    const now=performance.now(),pool=[...IREG].filter(n=>n.activity&&now-(n.activity.seenAt||0)<2000);
    if(!pool.length)return{ok:false,err:'no on-duty npc'};
    let c=pool.filter(n=>!n.activity.interject&&!n.activity.talking);
    if(!c.length)c=pool;                               // 兜底：替换现有插曲（同一 NPC 仍最多 1 个）
    const npc=c[(Math.random()*c.length)|0];
    endInterject(npc.activity);startInterject(npc,kind,true);
    return{ok:true,npc:npc.n,kind};
  },
  debug(){return{rate:I_RATE,active:I_ACTIVE,hour:ICLOCK.hour,registry:IREG.size};},
};

function mesh(n,geometry,color,rough=.65){
  const s=n.activity,mat=new T.MeshStandardMaterial({color,roughness:rough});s.owned.push(geometry,mat);
  const m=new T.Mesh(geometry,mat);m.castShadow=m.receiveShadow=true;return m;
}
function box(n,w,h,d,col){return mesh(n,new T.BoxGeometry(w,h,d),col);}
function prop(n,type){
  const s=n.activity;if(s.props[type])return s.props[type];
  const g=new T.Group();g.name='activity-prop-'+type;s.parent.add(g);
  if(['book','clipboard','tablet','folder','scorecard'].includes(type)){
    const cover=box(n,.27,.016,.19,type==='tablet'?'#263c45':type==='scorecard'?'#ebdd9d':'#315f7d');g.add(cover);
    const page=box(n,.25,.005,.175,type==='tablet'?'#88b2b0':'#f4f0de');page.position.y=.011;g.add(page);
    for(let i=0;i<4;i++){const line=box(n,.16,.002,.003,'#82909a');line.position.set(0,.015,-.055+i*.03);g.add(line);}
    if(type==='clipboard'||type==='scorecard'){const clip=box(n,.07,.015,.025,'#a5aba7');clip.position.set(0,.02,-.084);g.add(clip);}
  }else if(type==='tray'){
    g.add(box(n,.38,.025,.25,'#a7b4b8'));for(const x of [-.11,.11]){const bowl=mesh(n,new T.CylinderGeometry(.07,.055,.055,16),'#f0eee5');bowl.position.set(x,.035,0);g.add(bowl);}
  }else if(type==='kit'){
    g.add(box(n,.26,.18,.14,'#f5f1e5'));for(const [w,h] of [[.07,.02],[.02,.07]]){const red=box(n,w,h,.003,'#b54e40');red.position.z=.072;g.add(red);}
    const handle=box(n,.09,.025,.04,'#676f73');handle.position.y=.102;g.add(handle);
  }else if(type==='paddle'){
    const blade=mesh(n,new T.CylinderGeometry(.077,.077,.016,18),'#b24c3c');blade.rotation.x=Math.PI/2;blade.position.y=.06;g.add(blade);
    const handle=box(n,.025,.11,.025,'#b49c6d');handle.position.y=-.04;g.add(handle);
  }else if(type==='broom'){
    const shaft=mesh(n,new T.CylinderGeometry(.013,.013,1.20,10),'#ac8b58');shaft.position.y=.665;g.add(shaft);
    const brush=box(n,.28,.07,.075,'#59684c');brush.position.y=.065;g.add(brush);
  }else if(type==='stopwatch'){
    const face=mesh(n,new T.CylinderGeometry(.037,.037,.012,18),'#a9b0a8');face.rotation.x=Math.PI/2;g.add(face);
    const button=box(n,.011,.015,.008,'#496250');button.position.y=.044;g.add(button);
  }else if(type==='pen'){
    const pen=mesh(n,new T.CylinderGeometry(.004,.005,.115,8),'#2d536a');pen.rotation.z=-.35;g.add(pen);
  }else if(type==='ruler'||type==='tool'){
    g.add(box(n,type==='ruler'?.34:.22,.015,.035,type==='ruler'?'#c8b178':'#879195'));
    if(type==='tool'){const head=mesh(n,new T.TorusGeometry(.033,.012,6,12,Math.PI*1.5),'#879195');head.position.x=.115;g.add(head);}
  }else if(type==='rope'){
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(new Float32Array(33*3),3));
    const mat=new T.LineBasicMaterial({color:'#bd5747'});s.owned.push(geo,mat);g.add(new T.Line(geo,mat));
    for(const x of [-.5,.5]){const grip=mesh(n,new T.CylinderGeometry(.016,.016,.1,8),'#2f5a6c');g.add(grip);}
  }else if(type==='ball'){
    g.add(mesh(n,new T.SphereGeometry(.12,20,14),'#cc7c39',.8));
    for(const axis of ['x','z']){const seam=mesh(n,new T.TorusGeometry(.121,.003,4,36),'#4d3927');seam.rotation[axis]=Math.PI/2;g.add(seam);}
  }else if(type==='ping-ball'){
    g.add(mesh(n,new T.SphereGeometry(.02,10,8),'#f5f4ee'));
  }
  s.props[type]=g;return g;
}
export function activityProp(n,type){return prop(n,type);}
function place(n,p,position,pitch=0){p.position.copy(position);p.quaternion.copy(n.obj.quaternion).multiply(q.setFromAxisAngle(axes.x,pitch));p.visible=true;}

function settlePose(n,dt){
  const s=n.activity,previous=s.previousPose ||= new Map(),alpha=1-Math.exp(-dt*12);
  for(const bone of s.base.keys()){
    const last=previous.get(bone);
    if(last){last.slerp(bone.quaternion,alpha);bone.quaternion.copy(last);}
    else previous.set(bone,bone.quaternion.clone());
  }
  n.obj.updateWorldMatrix(true,true);
  // Held objects follow the blended hands, including during preparation.
  const l=n.B.lHand?.getWorldPosition(new T.Vector3()),r=n.B.rHand?.getWorldPosition(new T.Vector3());
  if(!l||!r)return;
  const middle=l.clone().lerp(r,.5),front=new T.Vector3(0,0,.025).applyQuaternion(n.obj.quaternion);
  for(const type of ['book','tablet','folder','scorecard','tray','ruler','tool']){
    const p=s.props[type];if(p?.visible)p.position.copy(middle).add(front);
  }
  if(s.props.clipboard?.visible){
    const centre=['coach','timing','patrol'].includes(s.kind)?l:middle;
    s.props.clipboard.position.copy(centre).add(front);
  }
  for(const type of ['paddle','pen','stopwatch'])if(s.props[type]?.visible)s.props[type].position.copy(r);
  if(s.props.kit?.visible)s.props.kit.position.copy(l).add(new T.Vector3(0,-.105,0));
  if(s.props.rope?.visible)updateRope(n,s.props.rope,s.localTime*9,s.kind==='skip');
  if(s.kind==='serve'&&s.props['ping-ball']?.visible){
    const ph=s.localTime%2.8,ball=s.props['ping-ball'];
    if(ph<1.1){ball.position.copy(l).add(new T.Vector3(0,.05,0));
      const flight=Math.max(0,ph-.5);ball.position.y+=Math.max(0,2.6*flight-4.9*flight*flight);
    }else{
      const flight=ph-1.1,start=r.clone().add(new T.Vector3(0,.06,0));
      ball.position.copy(start).add(new T.Vector3(0,0,Math.min(flight,1)*1.3).applyQuaternion(n.obj.quaternion));
      ball.position.y=.82+Math.abs(Math.sin(flight*Math.PI*2))*.18;ball.visible=flight<1.1;
    }
  }
}

export function applySceneActivity(n,dt,ctx={}){
  const s=n.activity;if(!s)return;s.seenAt=performance.now(); // 在岗心跳（force()/雷击广播的在岗判据）
  s.weight+=(s.talking?0:1-s.weight)*Math.min(1,dt*7);
  if(s.talking)s.weight=Math.max(0,s.weight-dt*7);
  s.handError=0;
  s.armDetails={};
  for(const bone of Object.values(n.B||{}))remember(n,bone);
  for(const p of Object.values(s.props))p.visible=false;
  if(s.weight<.01 || s.talking || n.b==='mocap'){if(s.interject)s.interject.env=0;settlePose(n,dt);return;}
  const k=s.kind,tt=s.localTime,wave=Math.sin(tt*2.4),h=s.height;
  const seated=n.b==='sitChair',moving=s.moving;
  const left=(x,y,z)=>arm(n,'l',point(n,x,y,z)),right=(x,y,z)=>arm(n,'r',point(n,x,y,z));
  const item=(type,x,y,z,pitch=0)=>{const p=prop(n,type);place(n,p,point(n,x,y,z),pitch);return p;};
  if(['read','check-notes','write-notes','sort-books','tablet','checkpoint','scorecard'].includes(k)){
    const type=k==='tablet'?'tablet':k==='scorecard'?'scorecard':k==='read'?'book':k==='sort-books'?'folder':'clipboard';
    left(.075,.22,.17);right(-.075,.22+(k==='write-notes'?wave*.007:0),.17);
    item(type,0,.22,.19,-.18);rotate(n,n.B.head,'x',.15);rotate(n,n.B.torso,'x',seated?.025:.015);
    if(k==='write-notes'){const hand=n.B.rHand?.getWorldPosition(new T.Vector3());if(hand){const pen=prop(n,'pen');place(n,pen,hand);}}
  }else if(k==='piano-practice'){
    const key=ctx.pianoKeys;if(key){const rate=typeof ctx.musicRate==='number'&&ctx.musicRate>0?ctx.musicRate:(ctx.music?8:3);const phase=ctx.time*rate;arm(n,'l',key.clone().add(new T.Vector3(.16,.014*Math.sin(phase),0)));arm(n,'r',key.clone().add(new T.Vector3(-.16,.014*Math.sin(phase+1.7),0)));rotate(n,n.B.head,'x',.07);}
  }else if(k==='conduct'){
    const energy=.55+.45*(ctx.beat||0);const phase=tt*(ctx.music?5:2.5)*energy;left(.16,.24+.035*Math.sin(phase),.14);right(-.16,.24+.035*Math.sin(phase+1),.14);
  }else if(k==='sing'){
    const beat=ctx.beat||0;left(.09,.21+.022*beat,.16);right(-.09,.21+.022*beat,.16);item('folder',0,.21,.18);rotate(n,n.B.head,'x',.025+.05*beat);rotate(n,n.B.torso,'y',Math.sin(ctx.time*2.1)*.045*(.35+beat));
  }else if(k==='check-rope'){
    left(.16,.14,.12);right(-.16,.14,.12);rotate(n,n.B.head,'x',.10);
    const rope=prop(n,'rope');rope.visible=true;updateRope(n,rope,0,false);
  }else if(k==='timing'||k==='coach'){
    left(.1,.22,.14);item('clipboard',.07,.22,.16,-.2);
    right(-.18,k==='coach'?.27:.22,.14+(k==='coach'?.05*Math.sin(tt*Math.PI/4):0));
    if(k==='timing')item('stopwatch',-.18,.22,.145);
  }else if(k==='sweep'){
    const dx=Math.sin(tt*1.7)*.1,brush=point(n,dx,-.5,.26);brush.y=.025;
    const broom=prop(n,'broom');place(n,broom,brush,-.17);
    const handle=brush.clone().add(new T.Vector3(0,1.265,0).applyQuaternion(broom.quaternion));
    arm(n,'l',brush.clone().lerp(handle,.89));arm(n,'r',brush.clone().lerp(handle,.77));rotate(n,n.B.torso,'x',.07);
  }else if(k==='deliver'||k==='check-tray'){
    left(.11,.16,.14);right(-.11,.16,.14);item('tray',0,.145,.17);
  }else if(k==='check-kit'){
    left(.13,.16,.1);right(-.10,.18,.14);item('kit',.13,.08,.13);rotate(n,n.B.head,'x',.09);
  }else if(k==='measure'||k==='inspect-tool'){
    left(.1,.22,.14);right(-.1,.22+.015*wave,.14);item(k==='measure'?'ruler':'tool',0,.23,.16);rotate(n,n.B.head,'x',.13);
  }else if(k==='stretch'){
    const spread=.15+Math.sin(tt/7*Math.PI)**2*.14;
    left(spread,.19,.035);right(-spread,.19,.035);rotate(n,n.B.head,'y',Math.sin(tt*.6)*.035);
  }else if(k==='skip'){
    left(.22,.14,.02);right(-.22,.14,.02);
    const rope=prop(n,'rope');rope.visible=true;updateRope(n,rope,tt*9,true);
  }else if(k==='guard'||k==='side-step'){
    left(.17,.14,.10);right(-.17,.14,.10);
  }else if(k==='swim-free'||k==='swim-breast'||k==='float-rest'){
    if(k==='swim-free'){
      const v=tt*2.7;
      left(.13,.29+Math.cos(v)*.15,.02+Math.sin(v)*.14);
      right(-.13,.29-Math.cos(v)*.15,.02-Math.sin(v)*.14);
      rotate(n,n.B.lShin,'x',Math.sin(v*2)*.12);rotate(n,n.B.rShin,'x',-Math.sin(v*2)*.12);
    }else if(k==='swim-breast'){
      const ph=(tt%1.8)/1.8,spread=Math.sin(ph*Math.PI)*.16;
      left(.09+spread,.36-spread,.03);right(-.09-spread,.36-spread,.03);
      rotate(n,n.B.lShin,'x',Math.sin(ph*Math.PI)*.18);rotate(n,n.B.rShin,'x',Math.sin(ph*Math.PI)*.18);
    }else{left(.20,.14,0);right(-.20,.14,0);}
  }else if(['table-ready','table-hit','serve'].includes(k)){
    const isA=s.profile==='table-a',hit=ctx.ping?.side===(isA?'A':'B'),since=ctx.ping?ctx.time-ctx.ping.time:100;
    const stroke=k==='serve'?Math.max(0,Math.sin(tt*2.2)):hit&&since<.5?Math.sin(since/.5*Math.PI):0;
    right(-.10,.21,.16+stroke*.055);left(.13,.14,.08);
    const hand=n.B.rHand?.getWorldPosition(new T.Vector3());if(hand){const paddle=prop(n,'paddle');place(n,paddle,hand,-.6);}
    if(k==='serve')prop(n,'ping-ball').visible=true;
  }else if(['shoot','hold-ball','dribble'].includes(k)){
    let bp;
    if(k==='dribble' && ctx.practiceBall){bp=ctx.practiceBall(n,k,tt);if(bp){const target=bp.clone().add(new T.Vector3(0,.13,0));target.y=Math.max(point(n,0,.13,0).y,target.y);arm(n,'r',target);left(.16,.14,.08);}}
    else{
      const lift=k==='shoot'?Math.sin(Math.min(tt,1.6)/1.6*Math.PI/2)*.29*Math.max(0,1-Math.max(0,tt-2)):0;
      bp=point(n,0,.18+lift,.16);
      if(k!=='shoot'||tt<3){arm(n,'l',bp.clone().add(new T.Vector3(.08,0,0).applyQuaternion(n.obj.quaternion)));arm(n,'r',bp.clone().add(new T.Vector3(-.08,0,0).applyQuaternion(n.obj.quaternion)));}
      if(ctx.practiceBall)bp=ctx.practiceBall(n,k,tt,bp);
    }
    if(!ctx.practiceBall && bp){const ball=prop(n,'ball');place(n,ball,bp);}
  }else if(k==='pass-ready' && n.kickAnim>0){
    rotate(n,n.B.rThigh,'x',-.40*Math.sin(n.kickAnim/.28*Math.PI));
  }else if(k==='observe'){
    rotate(n,n.B.head,'x',.11);rotate(n,n.B.torso,'x',.035);
  }else if(k==='chat'){
    right(-.13,.15,.10+.02*wave);
  }else if(k==='watch-pool'||k==='look'){
    rotate(n,n.B.head,'y',Math.sin(tt*.45)*.10);
  }
  if(moving && ['teacher-patrol','security','gate-duty','medic','librarian','swim-coach'].includes(s.profile)){
    left(.13,.13,.06);item(s.profile==='medic'?'kit':s.profile==='librarian'?'book':'clipboard',.13,.10,.07,-.1);
  }
  if(s.interject&&s.weight>=.01&&!s.talking&&n.b!=='mocap')applyInterjectPose(n,s.interject); // 微动作插曲叠加在原相位姿态之后
  settlePose(n,dt);
}

function updateRope(n,g,phase,spinning){
  n.obj.updateWorldMatrix(true,true);
  const l=n.B.lHand.getWorldPosition(new T.Vector3()),r=n.B.rHand.getWorldPosition(new T.Vector3());
  // Geometry uses world coordinates; the group remains at the parent origin.
  g.position.set(0,0,0);g.quaternion.identity();
  const arr=g.children[0].geometry.attributes.position.array;
  for(let i=0;i<=32;i++){
    const k=i/32,v=l.clone().lerp(r,k),s=Math.sin(k*Math.PI);
    const cosine=Math.cos(phase),radius=cosine>=0?(l.y+r.y)/2-.02:Math.max(.6,n.activity.height*.98-(l.y+r.y)/2);
    const off=new T.Vector3(0,-cosine*s*radius,Math.sin(phase)*s*.78).applyQuaternion(n.obj.quaternion);
    v.add(off);if(!spinning)v.y=Math.max(.04,v.y);v.toArray(arr,i*3);
  }
  g.children[0].geometry.attributes.position.needsUpdate=true;g.children[0].geometry.computeBoundingSphere();
  g.children[1].position.copy(l);g.children[2].position.copy(r);
}

const _eProbe=new T.Euler();
function bonePitch(bone,obj){ // 验收探针：骨骼相对人物朝向的俯仰角（rad，正=低头）
  if(!bone||!obj)return null;
  bone.getWorldQuaternion(q);obj.getWorldQuaternion(q2);q.premultiply(q2.invert());
  _eProbe.setFromQuaternion(q,'YXZ');return +_eProbe.x.toFixed(3);
}
export function sceneActivityState(n){
  const s=n.activity;if(!s)return null;
  return {name:n.n,scene:s.scene,profile:s.profile,action:s.kind,label:s.label,talking:s.talking,
    moving:s.moving,phase:+s.localTime.toFixed(3),transitions:s.transitions,handError:+s.handError.toFixed(4),
    interject:s.interject?{kind:s.interject.kind,label:s.interject.label,t:+s.interject.t.toFixed(2),
      dur:s.interject.dur,env:+(s.interject.env||0).toFixed(3),
      headPitch:bonePitch(n.B?.head,n.obj),armPitchL:bonePitch(n.B?.lArm,n.obj),armPitchR:bonePitch(n.B?.rArm,n.obj)}:null,
    props:Object.entries(s.props).filter(([,p])=>p.visible).map(([key])=>key),
    position:n.obj.position.toArray(),pitch:n.obj.rotation.x,yaw:n.obj.rotation.y,arms:s.armDetails||{},
    hands:{left:n.B.lHand?.getWorldPosition(new T.Vector3()).toArray(),right:n.B.rHand?.getWorldPosition(new T.Vector3()).toArray()},
    propPositions:Object.fromEntries(Object.entries(s.props).filter(([,p])=>p.visible).map(([key,p])=>[key,p.position.toArray()])),
    finitePose:Object.values(n.B).every(b=>b.quaternion.toArray().every(Number.isFinite)&&Math.abs(b.quaternion.length()-1)<.015)};
}

export function disposeSceneActivity(n){
  const s=n.activity;if(!s)return;
  IREG.delete(n);endInterject(s);                     // 微动作插曲注册表退注
  for(const p of Object.values(s.props))p.removeFromParent();
  for(const o of s.owned)o.dispose();n.mixer?.stopAllAction();
}
