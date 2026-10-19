import {assertSaveCurrent} from './save_session.js';
import * as T from 'three';
import {RopeRound,ballisticVelocity,goalCross,predictIntercept,clamp,ShotEvidence,CHARGE_SECONDS,SPORTS_RULE_VERSION} from './sports_play_core.js';

const MODES={basketball:{name:'篮球 · 五球投篮',help:'先瞄准，再按住空格 / E 蓄力，绿色区间松手。球结束后自动备球，可关闭自动继续。'},layup:{name:'篮球 · 三步上篮',help:'按住空格 / E 或「起步」自动运球推进，进入地面彩色弧区（距篮 4~5.6 米）按空格起跳，默数 1-2-跳，在最高点附近松开（或再按）空格放球打板。'},football:{name:'足球 · 五轮点球',help:'拖动画面对准球门空档，上下环视控制射门高度。按住空格 / E 蓄力，松手射门。方向按钮微调瞄准。'},freefootball:{name:'足球 · 自由射门',help:'走近足球 1.2 米内自动带球，拖动画面瞄准任意角度，按住空格 / E 蓄力松手射门。守门员扑救可开关，球出界或进门后 1.6 秒自动回到点球点。'},rope:{name:'跳绳 · 30 秒节奏',help:'黄条进入绿色区间时按一次空格 / E 起跳。每次过绳才计数，绊绳后可继续。按住不会连续跳。'},freerope:{name:'跳绳 · 自由节奏',help:'拖动滑条选择绳速（60~160 转/分），黄条进入绿色区间按一次空格 / E 起跳。自由练习不计成绩，Esc 退出。'}};
const LEVELS=[{name:'入门',range:3.8,rpm:80,reaction:.34,keeperSpeed:2.5},{name:'标准',range:4.8,rpm:105,reaction:.23,keeperSpeed:3.4},{name:'挑战',range:6.9,rpm:130,reaction:.15,keeperSpeed:4.2}];
const ROPES=new Set(['rope','freerope']),FREE_TYPES=new Set(['freefootball','freerope']),AIM_TYPES=new Set(['basketball','football','freefootball']);
// 三步上篮手感参数（调数值不动结构）：窗口/节拍/跳起弧线/推进速度按难度分档，打板点与出手误差独立可调。
const LAYUP={win:[[4.0,5.9],[4.2,5.6],[4.4,5.3]],beat:[.50,.42,.36],jump:[.68,.62,.56],speed:[4.2,4.5,4.9],start:6.5,side:1,peak:.85,stepAdvance:.55,jumpAdvance:1.7,dribbleHz:2.3,dribbleH:.62,early:-.18,late:.35,under:3.2};
const STEPS={rope:['看绳子接近脚底，黄条接近绿色区域。','按一次空格 / E 或「起跳」。按住不会连跳。','看早跳 / 晚跳提示，再调整下一次。'],layup:['按住空格 / E 或「起步」，自动运球向篮下推进。','黄条进入绿色区间（地面彩色弧区）按空格起跳，默数 1-2-跳。','跳到最高点附近松开（或再按）空格放球打板。'],freefootball:['走近足球自动带球，可带到任意位置再射。','拖动画面瞄准，按住空格 / E 蓄力，松手射门。','球出界或进门后 1.6 秒自动回到点球点。'],freerope:['拖动滑条选择绳速（60~160 转/分）。','黄条进入绿色区间按一次空格 / E 起跳。','自由练习不计成绩，Esc 随时退出。'],default:['拖动画面或用方向按钮，把准星对准目标。','按住空格 / E 或大按钮蓄力，松手出手。','看真实落点反馈，再投下一球。']};

export class SportsPlay{
  constructor(adapter){
    this.a=adapter;this.active=false;this.open=false;this.phase='menu';this.round=0;this.results=[];this.type='basketball';this.level=0;this.heldInput=false;
    try{const saved=JSON.parse(localStorage.getItem('campus.training.v2')||'{}');this.records=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};}catch{this.records={};}
    try{this.legacy=JSON.parse(localStorage.getItem('campus.training.v1')||'{}');}catch{this.legacy={};}
    this.autoNext=true;this.options={};this.freeRpm=90;this.stumbleT=0;this.ropeMisses=0;this.layupTune={angle:1.12,offX:.05,offY:.55,speed:1};
    const link=document.createElement('link');link.rel='stylesheet';link.href='js/sports_play.css';document.head.append(link);
    this.launch=document.createElement('button');this.launch.id='sportsLaunch';this.launch.textContent='体育训练 · 九项运动';this.launch.onclick=()=>this.menu();document.body.append(this.launch);
    this.panel=document.createElement('section');this.panel.id='sportsPlay';this.panel.hidden=true;this.panel.setAttribute('aria-label','体育训练');document.body.append(this.panel);
    this.cross=document.createElement('div');this.cross.id='sportsCrosshair';this.cross.hidden=true;document.body.append(this.cross);
    for(const event of ['pointerdown','pointerup','click'])this.panel.addEventListener(event,e=>e.stopPropagation());
    addEventListener('keydown',e=>this.key(e,true),true);addEventListener('keyup',e=>this.key(e,false),true);
    addEventListener('blur',()=>this.pause());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();});
    addEventListener('campus-save-invalidated',()=>this.pause());
    this.makeVisuals();window.__sportsPlay={state:()=>this.state(),tune:o=>Object.assign(this.layupTune,o)};
  }
  // 自由射门需要真实走位带球：仅该模式解冻移动（蓄力与暂停时仍冻结）。
  get freezeMovement(){return this.open||(this.active&&(FREE_TYPES.has(this.type)?this.paused||this.charging:true));}
  makeVisuals(){
    this.visual=new T.Group();this.visual.visible=false;this.a.scene.add(this.visual);
    // 跳绳升级为弧形管绳（半径 .012 橙色），端点数学与旧 Line 完全一致，见 afterAvatar()。
    this.rope=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(Array.from({length:65},()=>new T.Vector3())),64,.012,6),new T.MeshStandardMaterial({color:0xff9a3c,roughness:.65}));this.rope.frustumCulled=false;this.visual.add(this.rope);
    // 地面绳影：半透明黑色椭圆随绳相位在脚下扫动（表现层，无物理）。
    this.ropeShadow=new T.Group();const sm=new T.Mesh(new T.CircleGeometry(.34,20),new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.15,depthWrite:false}));sm.rotation.x=-Math.PI/2;sm.scale.set(.5,1.45,1);this.ropeShadow.add(sm);this.ropeShadow.visible=false;this.visual.add(this.ropeShadow);
    this.preview=new T.Points(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(new Float32Array(48*3),3)),new T.PointsMaterial({color:0x82eac6,size:.055}));this.preview.frustumCulled=false;this.visual.add(this.preview);
    this.spot=new T.Mesh(new T.RingGeometry(.44,.48,48),new T.MeshBasicMaterial({color:0x83e6c5,side:T.DoubleSide}));this.spot.rotation.x=-Math.PI/2;this.visual.add(this.spot);
    // 三步上篮起跳窗口：以篮筐为圆心的彩色弧带（4.2~5.6 米按难度重建），进入窗口时加亮。
    this.mark=new T.Mesh(new T.RingGeometry(4.2,5.6,40,1,Math.PI/4-.8,1.6),new T.MeshBasicMaterial({color:0x8ef0be,transparent:true,opacity:.35,side:T.DoubleSide,depthWrite:false}));this.mark.rotation.x=-Math.PI/2;this.mark.visible=false;this.visual.add(this.mark);
    this.handles=['L','R'].map(()=>{const m=new T.Mesh(new T.CylinderGeometry(.022,.028,.15,8),new T.MeshStandardMaterial({color:0x162b39,roughness:.7}));this.visual.add(m);return m;});
  }
  button(text,fn,cls=''){const b=document.createElement('button');b.textContent=text;b.className=cls;b.onclick=()=>{fn();b.blur();};return b;}
  menu(){
    if(!this.a.available()){this.a.notice('请先退出当前考试或比赛，再进入体育训练');return;}
    this.a.cancelInput();this.open=true;this.launch.hidden=true;this.panel.hidden=false;delete this.panel.dataset.sport;this.panel.innerHTML='<div class="eyebrow">校园体育训练</div><h2>选一项，开始练习</h2><p>在真实场地练习。每轮有规则、反馈和个人纪录。</p>';
    const label=document.createElement('label');label.textContent='训练项目';const select=document.createElement('select');select.id='trainingSport';for(const [id,mode] of Object.entries({...MODES,run:{name:'跑步 · 跑道竞速'},swim:{name:'游泳 · 泳道折返'},ping:{name:'乒乓 · 连续回球'}})){const o=document.createElement('option');o.value=id;o.textContent=mode.name;select.append(o);}select.value=this.type;label.append(select);
    const levelLabel=document.createElement('label');levelLabel.textContent='难度';const levels=document.createElement('select');levels.id='trainingLevel';LEVELS.forEach((l,i)=>{const o=document.createElement('option');o.value=i;o.textContent=l.name;levels.append(o);});levels.value=this.level;levelLabel.append(levels);this.panel.append(label,levelLabel);
    const row=document.createElement('div');row.className='row';row.append(this.button('前往场地并开始',()=>this.start(select.value,Number(levels.value)),'primary'),this.button('返回校园',()=>this.close(),'quiet'));this.panel.append(row);
  }
  start(type,level,options={}){
    if(!MODES[type]){this.close();this.a.openCourse(type,level);return;}
    if(this.active)this.a.cleanup(this.ball);else this.home=this.a.position();
    this.options=options;this.total=options.count||5;this.practice=!!options.practice;this.feedbackTime=0;this.saveError='';
    this.type=type;this.level=clamp(level,0,2);this.config=LEVELS[this.level];this.results=[];this.round=1;this.elapsed=0;this.charge=0;this.heldInput=false;this.active=true;this.open=false;this.phase='ready';this.paused=false;this.ball=null;this.lastResult='';this.stumbleT=0;this.ropeMisses=0;this.layupState=null;this.step=null;this.layupErr=0;this.layupY=0;this.dribbleT=0;this.dribbling=false;this.freeShots=0;this.freeGoals=0;this.keeperOn=true;
    this.a.prepare(type);this.visual.visible=true;const ropeLike=ROPES.has(type);
    this.cross.hidden=ropeLike||type==='layup';this.rope.visible=ropeLike;this.ropeShadow.visible=ropeLike;this.preview.visible=!ropeLike&&type!=='layup'&&level<2;this.handles.forEach(h=>h.visible=ropeLike);this.mark.visible=type==='layup';
    if(ropeLike){this.a.place({x:48,z:17},0,-.68);this.ropeBase=type==='freerope'?this.freeRpm:this.practice?60:this.config.rpm;this.ropeRound=new RopeRound({rpm:this.ropeBase,duration:type==='freerope'?1e9:this.practice?10:30});this.phase='countdown';this.countdown=3;this.lastResult='准备 · 3 秒后开始';}
    else if(type==='freefootball')this.setupFreeFootball();
    else this.nextBall();
    if(!options.skipIntro){this.resumePhase=this.phase;this.phase='intro';}
    this.render();
  }
  nextBall(){
    this.a.cancelInput();this.heldInput=false;this.charge=0;this.phase='ready';this.flight=0;this.goal=false;this.round=this.results.length+1;
    if(this.type==='basketball'){
      this.hoop=this.a.hoops().find(h=>h.x<25&&h.z>90);const h=this.hoop;
      const inward=Math.sign(h.board.z-h.z)*-1;this.spotPosition={x:h.x,z:h.z+inward*this.config.range};
      this.a.place(this.spotPosition,inward<0?Math.PI:0,Math.atan2(h.y-1.65,this.config.range));
      this.ball=this.a.takeBall('basketball',this.ball);this.lastResult=`第 ${this.round}/${this.total} 球 · 距离 ${this.config.range.toFixed(1)} 米 · 绿色区间松手`;
    }else if(this.type==='layup'){
      // 三步上篮：侧翼 45°、距筐 6.5 米起步，面向篮筐；球先持手中，起步后转运球弹跳。
      this.hoop=this.a.hoops().find(h=>h.x<25&&h.z>90);const h=this.hoop,q=Math.SQRT1_2,side=LAYUP.side;
      this.layupApproach={x:-side*q,z:q};this.layupStart={x:h.x+side*LAYUP.start*q,z:h.z-LAYUP.start*q};
      this.layupYaw=Math.atan2(side*q,-q);this.layupPitch=Math.atan2(h.y-1.65,LAYUP.start)*.6;this.layupState={d:LAYUP.start,win:LAYUP.win[this.level],inWin:false};
      this.a.place(this.layupStart,this.layupYaw,this.layupPitch);
      this.ball=this.a.takeBall('basketball',this.ball);this.lastResult=`第 ${this.round}/${this.total} 球 · 按住空格 / E 起步`;
      const [rin,rout]=this.layupState.win;this.mark.geometry.dispose();this.mark.geometry=new T.RingGeometry(rin,rout,40,1,Math.PI/4-.8,1.6);this.mark.position.set(h.x,.02,h.z);this.mark.material.opacity=.35;
      this.spotPosition=this.layupStart;
    }else{
      this.spotPosition={x:38,z:-19.1};this.a.place(this.spotPosition,0,-.055);this.ball=this.a.takeBall('football',this.ball);
      this.a.resetBall(this.ball,{x:38,y:this.ball.r+.025,z:-20});this.lastResult=`第 ${this.round}/${this.total} 球 · 瞄准球门空档`;
      this.keeper={x:38,y:1,age:0,target:null,defending:false};this.a.keeper(this.keeper);
    }
    this.previous={...this.ball.body.translation()};this.spot.position.set(this.spotPosition.x,.025,this.spotPosition.z);this.render();
  }
  // 足球自由练习：无限球不计成绩，球回点球点，守门员扑救可开关。first=开局摆人也回位；回收只回球不动玩家。
  setupFreeFootball(first=true){
    this.a.cancelInput();this.phase='ready';this.flight=0;this.cancelCharge();this.spotPosition={x:38,z:-20};
    if(first)this.a.place({x:38,z:-16.5},0,-.05);
    this.ball=this.a.takeBall('football',this.ball);this.a.resetBall(this.ball,{x:38,y:this.ball.r+.02,z:-20});
    this.keeper={x:38,y:1,age:0,target:null,defending:false};this.a.keeper(this.keeper);this.dribbling=false;this.freeSettle=0;this.lastResult='走近足球自动带球 · 自由练习不计成绩';
    this.previous={...this.ball.body.translation()};this.spot.position.set(38,.025,-20);
  }
  render(){
    if(this.active&&this.phase==='intro'){
      this.panel.hidden=false;this.panel.dataset.sport=this.type;this.panel.innerHTML=`<div class="eyebrow">${this.options.exam?'正式实测':'先学操作 · 可跳过'}</div><h2>${MODES[this.type].name}</h2><ol class="sportSteps">${(STEPS[this.type]||STEPS.default).map(x=>'<li>'+x+'</li>').join('')}</ol><p>练习不发金币；实测保留真实表现，再回教室用自己的数据答题。</p>`;
      // 说明面板期间玩家仍可把训练球扔走：开赛时重新发球并归位，保证回合完整。
      const begin=()=>{this.paused=false;this.phase=this.resumePhase;if(ROPES.has(this.type)){if(this.type==='freerope')this.ropeRound.rpm=this.freeRpm;}else if(this.type==='freefootball')this.setupFreeFootball();else if(this.phase==='ready')this.nextBall();this.render();};
      this.panel.append(this.button('开始'+(this.options.exam?'实测':'练习'),begin,'primary'),this.button('跳过说明',begin,'quiet'));
      if(!this.options.exam&&!FREE_TYPES.has(this.type))this.panel.append(this.button(this.type==='rope'?'先慢速试 10 秒':'先试一轮 · 不记成绩',()=>this.start(this.type,this.level,{practice:true,skipIntro:true}),'quiet'));
      this.panel.append(this.button('返回',()=>this.exit(),'quiet'));return;
    }
    if(!this.active)return;const m=MODES[this.type];this.panel.dataset.sport=this.type;this.panel.hidden=false;this.panel.innerHTML=`<div class="eyebrow">${this.config.name}训练 · ${ROPES.has(this.type)?'稳定节奏':'5 次机会'}</div><h2>${m.name}</h2><div class="score" id="trainingScore"></div><p>${m.help}</p><div class="history"></div><div class="meter"><div class="zone"></div><div class="fill"></div></div><div class="notice" id="trainingNotice" role="status"></div>`;
    this.panel.querySelector('.eyebrow').textContent=`${this.level+1}级${this.config.name} · ${this.practice?'操作演练 · 不记成绩':this.options.exam?'体育实测':FREE_TYPES.has(this.type)?'自由练习 · 不计成绩':ROPES.has(this.type)?'30 秒训练':this.total+' 次机会'}`;
    if(this.type==='basketball')this.panel.querySelector('h2').textContent=`篮球 · ${this.total} 球投篮`;
    this.score=this.panel.querySelector('.score');this.notice=this.panel.querySelector('.notice');this.fill=this.panel.querySelector('.fill');this.zone=this.panel.querySelector('.zone');
    this.results.forEach(r=>{const s=document.createElement('span');s.className=r.hit?'hit':'miss';s.textContent=r.hit?'✓':'×';s.title=r.message;this.panel.querySelector('.history').append(s);});
    if(ROPES.has(this.type)){const timing=1-.22*this.ropeRound.rpm/60;this.zone.style.left=((timing-.07)*100)+'%';this.zone.style.width='14%';}
    else if(this.type==='basketball'){
      this.zone.style.left=this.level===0?'55%':'67%';this.zone.style.width=this.level===0?'19%':'4%';
      const note=document.createElement('small');note.textContent=this.level===0?'入门：绿色区间提供出手力度辅助，仍需自行瞄准。':'标准 / 挑战：无力度辅助，控制松手时机。';this.panel.append(note);
    }else if(this.type==='layup'){
      // 量表映射距筐距离（黄条向左缩短），绿色区间即地面弧区对应的起跳窗口。
      const [w0,w1]=this.layupState.win,lo=LAYUP.under,hi=LAYUP.start;this.zone.style.left=((1-(w1-lo)/(hi-lo))*100)+'%';this.zone.style.width=((w1-w0)/(hi-lo)*100)+'%';
      const note=document.createElement('small');note.textContent='黄条缩进绿色区间（地面彩色弧区）时按空格起跳，1-2-跳后最高点附近出手。';this.panel.append(note);
    }
    this.action=this.button(this.type==='layup'?'起步 · 空格 / E':ROPES.has(this.type)?'点击起跳 · 空格 / E':'按住蓄力，松手出手',()=>{},'primary action');
    this.action.onpointerdown=e=>{e.preventDefault();this.action.setPointerCapture(e.pointerId);this.press();};
    this.action.onpointerup=e=>{e.preventDefault();this.release();};this.action.onpointercancel=()=>this.cancelCharge();this.action.onlostpointercapture=()=>{if(this.charging)this.cancelCharge();};this.panel.append(this.action);
    if(ROPES.has(this.type)&&this.type==='freerope'){
      const row=document.createElement('label');row.className='rpmRow';row.textContent='绳速 ';const slider=document.createElement('input');slider.type='range';slider.min=60;slider.max=160;slider.step=1;slider.value=this.freeRpm;const val=document.createElement('span');val.textContent=this.freeRpm+' 转/分';
      slider.oninput=()=>{this.freeRpm=Number(slider.value);val.textContent=this.freeRpm+' 转/分';this.ropeRound.rpm=this.freeRpm;};row.append(slider,val);this.panel.append(row);
    }
    if(this.type==='freefootball'){
      this.panel.append(this.button(this.keeperOn?'守门员扑救：开（点击关闭）':'守门员扑救：关（点击开启）',()=>{this.keeperOn=!this.keeperOn;if(!this.keeperOn){this.keeper.defending=false;this.keeper.target=null;}this.render();},'quiet'));
    }
    if(AIM_TYPES.has(this.type)&&this.phase==='ready'){
      const aim=document.createElement('div');aim.className='aimControls';aim.setAttribute('aria-label','微调瞄准');
      for(const [text,key] of [['←','ArrowLeft'],['↑','ArrowUp'],['↓','ArrowDown'],['→','ArrowRight']]){const b=this.button(text,()=>{if(!this.charging&&!this.paused)this.a.aim(key);});b.setAttribute('aria-label','瞄准'+text);aim.append(b);}this.panel.append(aim);
    }
    const row=document.createElement('div');row.className='row';
    if(this.phase==='feedback'&&this.type!=='freefootball')row.append(this.button(this.results.length===this.total?'查看成绩':'下一球',()=>this.results.length===this.total?this.finish():this.nextBall(),'primary'));
    if(this.phase==='complete'&&!this.options.exam)row.append(this.button(this.practice?'进入正式训练':'再练一轮',()=>this.start(this.type,this.level,{skipIntro:true}),'primary'));
    if(this.paused)row.append(this.button('继续训练',()=>{this.paused=false;this.render();},'primary'));
    if(!this.paused&&this.phase!=='complete')row.append(this.button('暂停',()=>this.pause(),'quiet'));
    row.append(this.button(this.options.exam?'退出实测，返回考核室':FREE_TYPES.has(this.type)?'退出练习':'退出训练',()=>this.exit(),'quiet'));this.panel.append(row);
    if(this.phase==='complete'&&this.type==='basketball'&&!this.practice)this.panel.append(this.button('去考核室参加体育实测',()=>{location.href='classrooms.html?wing=2&exam=2';},'quiet'));
    if(!ROPES.has(this.type)&&this.type!=='freefootball'){const label=document.createElement('label');label.className='autoNext';const box=document.createElement('input');box.type='checkbox';box.checked=this.autoNext;box.onchange=()=>{this.autoNext=box.checked;};label.append(box,' 球结束后自动继续');this.panel.append(label);}
    const best=document.createElement('p');best.className='best';best.textContent=this.practice||FREE_TYPES.has(this.type)?(FREE_TYPES.has(this.type)?'自由练习，不写入纪录。':'本轮只熟悉操作，不写入纪录。'):`本规则个人最佳（${this.config.name}${this.type==='basketball'&&this.level===0?' · 力度辅助':''}）：${this.records[this.type+'-'+this.level]??0}${this.type==='rope'?' 次':' 分'}${this.legacy?.[this.type+'-'+this.level]!=null?' · 旧版纪录 '+this.legacy[this.type+'-'+this.level]+' 已保留':''}`;this.panel.append(best);this.updateReadout();
  }
  key(e,down){
    if(!this.active)return;
    if(['Space','KeyE','Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)){
      e.preventDefault();e.stopImmediatePropagation();
      if(e.code==='Escape'){if(down&&!e.repeat){if(FREE_TYPES.has(this.type))this.exit();else this.pause();}return;}
      if(e.code.startsWith('Arrow')){if(down&&!this.paused&&!this.charging&&this.phase==='ready'&&AIM_TYPES.has(this.type))this.a.aim(e.code);return;}
      if(down&&!e.repeat)this.press();else if(!down)this.release();
    }
  }
  press(){
    if(this.paused||!this.active)return;
    if(ROPES.has(this.type)){if(this.heldInput)return;this.heldInput=true;if(this.phase==='running')this.ropeRound.jump();return;}
    if(this.type==='layup'){this.heldInput=true;
      if(this.phase==='ready')this.startDrive();
      else if(this.phase==='drive')this.tryJump();
      else if(this.phase==='steps'&&this.step?.jumping)this.shoot();
      return;}
    if(this.heldInput)return;this.heldInput=true;
    if(this.phase!=='ready')return;this.charging=true;this.charge=0;
  }
  release(){
    this.heldInput=false;
    if(this.type==='layup'){if(this.phase==='steps'&&this.step?.jumping)this.shoot();return;}
    if(!this.charging)return;this.charging=false;if(this.paused||this.phase!=='ready')return;this.shoot();
  }
  cancelCharge(){this.charging=false;this.heldInput=false;this.charge=0;}
  // 三步上篮：起步进入自动运球推进。
  startDrive(){this.phase='drive';this.dribbleT=0;this.lastResult='运球推进 · 进入彩色弧区按空格起跳';this.render();}
  tryJump(){
    const [w0,w1]=this.layupState.win;
    if(this.layupState.d<w0||this.layupState.d>w1){this.lastResult='节奏乱了，在彩色标记区起跳';if(this.notice)this.notice.textContent=this.lastResult;return;}
    this.step={t:0,beat:0,jumping:false};this.phase='steps';this.lastResult='1';this.render();
  }
  // 窗口外/冲过头的回合失败（非飞行态），与 resolve 保持同一份记录结构。
  failAttempt(message){this.results.push({hit:false,points:0,message,power:0,ruleVersion:SPORTS_RULE_VERSION});this.phase='feedback';this.feedbackTime=0;this.lastResult=message;this.render();}
  velocity(power=this.charge){
    const p=this.ball.body.translation(),dir=this.a.direction();
    if(this.type==='basketball'){
      const d=Math.hypot(this.hoop.x-p.x,this.hoop.z-p.z),n=Math.hypot(dir.x,dir.z)||1;
      if(this.level===0&&power>=.55&&power<=.74)power=.69+(power-.645)*.04;
      return ballisticVelocity(p,{x:p.x+dir.x/n*d,y:this.hoop.y,z:p.z+dir.z/n*d},.90+Math.asin(clamp(dir.y,-1,1))*.4,power);
    }
    // 足球：把视线与球门平面求交解算弹道；自由练习可背对球门射，射线过长时截断避免横向速度爆炸。
    const denominator=Math.min(-.08,dir.z);let ray=( -31-this.a.eye().z)/denominator;
    if(this.type==='freefootball')ray=Math.min(ray,60);
    const eye=this.a.eye(),target={x:eye.x+dir.x*ray,y:eye.y+dir.y*ray,z:-31.3};
    const time=Math.abs(target.z-p.z)/(12+12*power);
    return {x:(target.x-p.x)/time,y:(target.y-p.y+4.905*time*time)/time,z:(target.z-p.z)/time};
  }
  // 三步上篮出手：真实弹道打向篮板打板点，出手时机误差同时改变力度与横向打板点（早=偏短偏内，晚=发力过头偏外）。
  layupVelocity(){
    const p=this.ball.body.translation(),h=this.hoop,t=this.layupTune,err=this.layupErr;
    const target={x:h.x+LAYUP.side*(t.offX+err*.22),y:h.y+t.offY,z:h.z+(h.board.z-h.z)*.18};   // 瞄筐心略偏板：轻擦板入筐，误差只改横向落点
    const power=clamp(.64+err*.36,0,1),v=ballisticVelocity(p,target,t.angle,power);
    return {x:v.x*t.speed,y:v.y*t.speed,z:v.z*t.speed};
  }
  shoot(){
    if(this.type==='layup')return this.shootLayup();
    if(this.type==='freefootball')return this.shootFree();
    const velocity=this.velocity();this.phase='flight';this.flight=0;this.previous={...this.ball.body.translation()};this.lastResult='球在飞行中…';
    this.evidence=new ShotEvidence(this.previous,this.type==='basketball'?this.hoop:null);this.goalPlane=null;this.keeperTouched=this.frameTouched=false;
    this.a.release(this.ball,velocity,this.type,this.charge);if(this.keeper){this.keeper.age=0;this.keeper.target=null;}this.updateReadout();
  }
  shootLayup(){
    const velocity=this.layupVelocity();this.phase='flight';this.flight=0;this.previous={...this.ball.body.translation()};this.lastResult='球在飞行中…';
    this.evidence=new ShotEvidence(this.previous,this.hoop);this.keeperTouched=this.frameTouched=false;
    this.a.release(this.ball,velocity,'layup',clamp(.64+this.layupErr*.36,0,1));
    // 出手后落回地面，结束跳起姿态。
    this.layupY=0;const p=this.a.position();this.a.place({x:p.x,z:p.z},this.layupYaw,this.layupPitch);this.updateReadout();
  }
  shootFree(){
    const velocity=this.velocity();this.phase='flight';this.flight=0;this.previous={...this.ball.body.translation()};this.freeShots++;this.dribbling=false;this.freeSettle=0;this.lastResult='球在飞行中…';
    this.keeperTouched=this.frameTouched=false;this.a.release(this.ball,velocity,this.type,this.charge);this.keeper.age=0;this.keeper.target=null;this.updateReadout();
  }
  basket(ball,hoop,points){if(this.active&&(this.type==='basketball'||this.type==='layup')&&this.phase==='flight'&&ball===this.ball&&hoop===this.hoop){this.goal=true;this.resolve(true,points,this.type==='layup'?'打板命中！':'命中！');}}
  resolve(hit,points,message){if(this.phase!=='flight')return;this.results.push({hit,points,message,power:this.charge,ruleVersion:SPORTS_RULE_VERSION});this.phase='feedback';this.feedbackTime=0;this.lastResult=message;this.render();}
  finish(){
    this.phase='complete';this.cancelCharge();const score=this.type==='rope'?this.ropeRound.count:this.results.reduce((n,r)=>n+r.points,0),key=this.type+'-'+this.level;
    if(this.options.exam){this.options.onComplete?.(this.results.map(r=>r.points));return;}
    this.saveError='';if(!this.practice){try{assertSaveCurrent();const saved=JSON.parse(localStorage.getItem('campus.training.v2')||'{}');const next={...saved,[key]:Math.max(score,Number(saved[key])||0)};localStorage.setItem('campus.training.v2',JSON.stringify(next));this.records=next;}catch{this.saveError='纪录未保存，请保持此页并重试。';}}
    this.lastResult=this.type==='rope'?`完成！连续最多 ${this.ropeRound.best} 次 · 绊绳 ${this.ropeRound.misses} 次`:`训练完成 · ${this.results.filter(r=>r.hit).length}/${this.total} 命中 · 命中率 ${Math.round(this.results.filter(r=>r.hit).length/this.total*100)}%`;
    this.render();if(this.saveError){this.notice.textContent=this.saveError;this.panel.append(this.button('重试保存',()=>this.finish(),'primary'));}
  }
  exit(){const leave=this.options.onExit;this.close();leave?.();}
  pause(){if(this.active&&!this.paused&&this.phase!=='complete'){this.paused=true;this.cancelCharge();this.a.cancelInput();this.render();}}
  close(){
    this.a.cancelInput();if(this.active){this.a.cleanup(this.ball);if(this.home)this.a.place(this.home,this.home.yaw,this.home.pitch);}if(this.active&&(this.type==='football'||this.type==='freefootball'))this.a.keeper({x:38,y:1,defending:false});this.active=this.open=this.paused=false;this.phase='menu';this.cancelCharge();this.panel.hidden=true;this.visual.visible=false;this.cross.hidden=true;this.launch.hidden=false;this.a.ropePose(null);
  }
  tick(dt){
    this.launch.hidden=this.open||this.active||!this.a.available();if(!this.active)return;
    if(this.a.modal())this.pause();
    if(this.paused){this.updateReadout();return;}
    this.elapsed+=dt;if(this.stumbleT>0)this.stumbleT-=dt;
    if(this.phase==='intro')return;
    if(this.phase==='feedback'&&this.type!=='freefootball'&&this.autoNext){this.feedbackTime+=dt;if(this.feedbackTime>=1.4){if(this.results.length===this.total)this.finish();else this.nextBall();}}
    if(this.phase==='feedback'&&this.type==='freefootball'){this.feedbackTime+=dt;if(this.feedbackTime>=1.6)this.setupFreeFootball(false);}
    if(this.charging)this.charge=clamp(this.charge+dt/CHARGE_SECONDS,0,1);
    if(ROPES.has(this.type)){
      if(this.phase==='countdown'){this.countdown-=dt;this.lastResult=`准备 · ${Math.max(1,Math.ceil(this.countdown))}`;if(this.countdown<=0){this.phase='running';this.lastResult='看绿色区间，按一次跳一次';}}
      if(this.phase==='running'){
        const before={phase:this.ropeRound.phase,y:this.ropeRound.y};
        this.ropeRound.update(dt);
        // 表现层钩子：过绳瞬间与落地各响一声（adapter 无 AU 时从 window.__sportsAU 取可选钩子）。
        if(this.ropeRound.phase<before.phase)this.sportsAU('ropeWhoosh');
        if(before.y>0&&this.ropeRound.y===0)this.sportsAU('land');
        if(this.ropeRound.misses>this.ropeMisses){this.ropeMisses=this.ropeRound.misses;this.stumbleT=.6;}   // 绊绳：绳随冻结停摆 + 前倾提示 0.6s
        // 连跳节奏漂移：仅操作演练档（practice 10 秒慢速）连跳≥8 后每 5 跳 +3 转/分（封顶 +18）；
        // 正式 30 秒训练保持定速（legacy 计时套件按 80 转定速输入），考核口径恒定。
        if(this.type==='rope'&&this.practice){const s=this.ropeRound.streak;this.ropeRound.rpm=this.ropeBase+(s>=8?Math.min(18,3*Math.floor((s-3)/5)):0);}
        if(this.type==='rope'&&this.ropeRound.done)this.finish();
      }
    }else if(this.type==='layup')this.tickLayup(dt);
    else if(this.type==='freefootball')this.tickFreeFootball(dt);
    else if(this.phase==='flight'){
      this.flight+=dt;const p={...this.ball.body.translation()},v=this.ball.body.linvel();this.evidence?.update(p,dt);
      if(this.type==='football'){
        if(this.a.keeperContact?.(this.ball))this.keeperTouched=true;
        if(this.a.frameContact?.(this.ball))this.frameTouched=true;
        this.keeper.age+=dt;
        if(!this.keeper.target&&this.keeper.age>=this.config.reaction)this.keeper.target=predictIntercept(p,v,-29.5);
        if(this.keeper.target){this.keeper.defending=true;const dx=clamp(this.keeper.target.x,34.65,41.35)-this.keeper.x;this.keeper.x+=clamp(dx,-this.config.keeperSpeed*dt,this.config.keeperSpeed*dt);this.keeper.y=1+clamp(this.keeper.target.y-1.35,0,.45);}
        this.a.keeper(this.keeper);
        if(goalCross(this.previous,p,{},this.ball.r)){this.a.cheer();this.resolve(true,1,'进球！整球越过门线');}
        else if(this.flight>4||p.z<-33.5||(this.flight>.6&&v.z>1))this.resolve(false,0,this.keeperTouched?'被守门员扑出 · 换个空档再射':this.frameTouched?'碰到门框后未进 · 向球门内微调':v.z>1?'碰撞后被挡回 · 换个空档再射':p.z<-31&&p.y>2.44?'越过横梁 · 压低瞄准':p.z<-31&&Math.abs(p.x-38)>3.55?'偏出门柱 · 向球门内微调':'未越过有效门线 · 看落点再调整');
      }else if(this.evidence.ended(p,this.ball.r))this.resolve(false,0,this.evidence.message(this.ball.shot));
      this.previous=p;
    }
    this.updateReadout();this.drawPreview();
  }
  sportsAU(name){try{window.__sportsAU?.[name]?.();}catch{}}   // 空安全：主线接 AU 合成，缺省静默
  // 三步上篮阶段机：drive 自动运球推进 → steps 1-2-跳 → flight 真实弹道。
  tickLayup(dt){
    const st=this.layupState,h=this.hoop,ap=this.layupApproach;
    const put=d=>this.a.place({x:h.x-d*ap.x,z:h.z-d*ap.z,y:this.layupY||0},this.layupYaw,this.layupPitch); // d=玩家距筐距离（沿起步线摆位）
    if(this.phase==='drive'){
      const speed=LAYUP.speed[this.level],p=this.a.position();
      const d=Math.hypot(h.x-p.x,h.z-p.z),nd=Math.max(LAYUP.under-1,d-speed*dt);
      put(nd);const np=this.a.position();st.d=Math.hypot(h.x-np.x,h.z-np.z);this.dribble(dt,st.d);
      const [w0,w1]=st.win,inWin=st.d>=w0&&st.d<=w1;
      this.mark.material.opacity=inWin?.85:.35;this.mark.material.color.setHex(inWin?0xbdf7d2:0x8ef0be);
      if(inWin&&!st.inWin)this.lastResult='到彩色弧区了 · 按空格起跳！';
      st.inWin=inWin;
      if(st.d<=LAYUP.under)this.failAttempt('冲过头了，起跳再果断些');
    }else if(this.phase==='steps'){
      const s=this.step,bd=LAYUP.beat[this.level],TJ=LAYUP.jump[this.level],d0=s.d0??(s.d0=st.d);
      s.t+=dt;
      if(!s.jumping){
        const beat=Math.min(2,Math.floor(s.t/bd));
        if(beat!==s.beat){s.beat=beat;this.lastResult=beat===0?'1':beat===1?'2':'跳';}
        put(Math.max(2.6,d0-2*LAYUP.stepAdvance*(s.t/(2*bd))));this.dribble(dt,st.d);
        if(s.t>=2*bd){s.jumping=true;s.beat=2;this.layupErr=-1;this.a.takeBall('basketball',this.ball);this.lastResult='跳！最高点附近松开 / 再按空格出手';this.sportsAU('layupJump');}
      }else{
        const jt=clamp((s.t-2*bd)/TJ,0,1.2);
        this.layupErr=clamp((jt-.5)*2,-1,1);this.layupY=LAYUP.peak*Math.sin(Math.PI*Math.min(1,jt));
        put(Math.max(2.2,d0-2*LAYUP.stepAdvance-LAYUP.jumpAdvance*jt));
        if(jt>=1){this.layupErr=1;this.shootLayup();}   // 落地仍未出手：按最晚误差强制放球
      }
      st.d=s.jumping?d0-2*LAYUP.stepAdvance-LAYUP.jumpAdvance*clamp((s.t-2*bd)/TJ,0,1):Math.max(2.6,d0-2*LAYUP.stepAdvance*(s.t/(2*bd)));
    }else if(this.phase==='flight'){
      this.flight+=dt;const p={...this.ball.body.translation()};this.evidence?.update(p,dt);
      if(!this.layupCross){const c=this.evidence.cross;if(c)this.layupCross={dx:+(c.x-h.x).toFixed(3),dz:+(c.z-h.z).toFixed(3)};}   // 过筐平面交点（QA 断言弹道与调参用）
      if(this.evidence.ended(p,this.ball.r)||this.flight>6){
        let msg=this.evidence.message(this.ball.shot);
        if(this.layupErr>LAYUP.late)msg='冲过头了，起跳再果断些';else if(this.layupErr<LAYUP.early)msg='出手点低了，跳到最高点再放球';
        this.resolve(false,0,msg);
      }
      this.previous=p;
    }
  }
  // 运球弹跳视觉：球贴玩家前侧方做 |sin| 弹跳（puppet 物理体，出手前不影响判定）。
  dribble(dt,d){
    this.dribbleT+=dt;const p=this.a.position(),f=this.layupApproach,b=Math.abs(Math.sin(this.dribbleT*Math.PI*LAYUP.dribbleHz));
    const x=p.x+f.x*.45-f.z*.22,z=p.z+f.z*.45+f.x*.22,y=this.ball.r+.02+b*LAYUP.dribbleH;
    this.a.resetBall(this.ball,{x,y,z});
  }
  // 足球自由练习阶段机：ready 带球/蓄力 → flight 守门员+判定 → feedback 1.6s 自动回球。
  tickFreeFootball(dt){
    const p0={...this.ball.body.translation()};
    if(this.phase==='ready'){
      const pp=this.a.position(),d=Math.hypot(pp.x-p0.x,pp.z-p0.z),v=this.ball.body.linvel();
      if(!this.dribbling&&d<1.2&&Math.hypot(v.x,v.y,v.z)<1.2){this.dribbling=true;this.lastResult='带球中 · 拖动画面瞄准，按住空格 / E 蓄力射门';}
      if(this.dribbling){const f=this.a.direction();f.y=0;if(f.lengthSq()<.01)f.set(0,0,-1);f.normalize();this.a.resetBall(this.ball,{x:pp.x+f.x*.6,y:this.ball.r+.02,z:pp.z+f.z*.6});}
    }else if(this.phase==='flight'){
      this.flight+=dt;const p={...this.ball.body.translation()},v=this.ball.body.linvel();
      if(this.a.keeperContact?.(this.ball))this.keeperTouched=true;
      if(this.a.frameContact?.(this.ball))this.frameTouched=true;
      this.keeper.age+=dt;
      if(this.keeperOn){
        if(!this.keeper.target&&this.keeper.age>=this.config.reaction)this.keeper.target=predictIntercept(p,v,-29.5);
        if(this.keeper.target){this.keeper.defending=true;const dx=clamp(this.keeper.target.x,34.65,41.35)-this.keeper.x;this.keeper.x+=clamp(dx,-this.config.keeperSpeed*dt,this.config.keeperSpeed*dt);this.keeper.y=1+clamp(this.keeper.target.y-1.35,0,.45);}
      }
      this.a.keeper(this.keeper);
      const speed=Math.hypot(v.x,v.y,v.z);
      if(this.flight>1.2&&speed<.4&&p0.y<this.ball.r*2+.05)this.freeSettle+=dt;else this.freeSettle=0;
      if(goalCross(this.previous,p,{},this.ball.r)){this.freeGoals++;this.a.cheer();this.phase='feedback';this.feedbackTime=0;this.lastResult='进球！· 1.6 秒后自动回球';this.render();}
      else if(p.z<-33.5||p.z>-14||Math.abs(p.x-38)>12||this.flight>8||(this.freeSettle>.5)){
        this.phase='feedback';this.feedbackTime=0;this.lastResult=this.keeperTouched?'被守门员扑出 · 换个空档再射':this.frameTouched?'碰到门框未进 · 向门内微调':p.z<-31?'射偏了 · 再试一次':'球停了 · 1.6 秒后自动回球';this.render();
      }
      this.previous=p;
    }
  }
  drawPreview(){
    this.preview.visible=this.active&&this.type!=='layup'&&!ROPES.has(this.type)&&this.phase==='ready'&&this.level===0;
    if(!this.preview.visible)return;let p={...this.ball.body.translation()},v=this.velocity(this.charging?this.charge:.64);const positions=this.preview.geometry.attributes.position;
    for(let i=0;i<48;i++){const h=.04;v.y-=9.81*h;const damping=1/(1+.05*h);v={x:v.x*damping,y:v.y*damping,z:v.z*damping};p={x:p.x+v.x*h,y:p.y+v.y*h,z:p.z+v.z*h};positions.setXYZ(i,p.x,Math.max(.03,p.y),p.z);}positions.needsUpdate=true;
  }
  pose(){
    if(!this.active)return;
    if(ROPES.has(this.type)){this.a.height(this.ropeRound.y);this.a.ropePose({phase:this.ropeRound.phase*Math.PI*2,active:this.phase==='running'&&!this.paused,stumble:this.stumbleT>0});}
    else if(this.type==='layup'&&this.phase==='steps'&&this.step?.jumping)this.a.height(this.layupY||0);   // 跳起弧线抬升身体
  }
  afterAvatar(){
    if(!this.active||!ROPES.has(this.type))return;
    const hands=this.a.grips();if(!hands)return;
    const phase=this.ropeRound.phase*Math.PI*2,forward=this.a.direction();forward.y=0;forward.normalize();
    const ends=hands.map((hand,i)=>{this.handles[i].position.copy(hand);this.handles[i].rotation.set(.15,0,i?.12:-.12);return hand.clone().add(new T.Vector3(0,.055,0));});
    const pts=[];
    for(let i=0;i<=64;i++){
      const f=i/64,arc=Math.sin(f*Math.PI)*1.10,p=ends[0].clone().lerp(ends[1],f).addScaledVector(forward,arc*Math.sin(phase));
      p.y-=arc*Math.cos(phase);pts.push(p);
    }
    // 弧形管绳：与旧 Line 相同的端点数学，仅把折线升级为半径 .012 的管体。
    this.rope.geometry.dispose();this.rope.geometry=new T.TubeGeometry(new T.CatmullRomCurve3(pts),64,.012,6);
    // 绳影随绳相位在脚下前后扫动。
    this.ropeShadow.position.set(ends[0].x+(ends[1].x-ends[0].x)/2+forward.x*Math.sin(phase)*.9,.015,ends[0].z+(ends[1].z-ends[0].z)/2+forward.z*Math.sin(phase)*.9);
    this.ropeShadow.rotation.y=Math.atan2(forward.x,forward.z);
    const p=this.a.position();this.spot.position.set(p.x,.025,p.z);
  }
  updateReadout(){
    // 面板可能处于说明/结算等无读数布局：所有节点先判存在，避免暂停期间每帧报错。
    if(!this.score||!this.score.isConnected)return;const r=this.ropeRound;
    if(ROPES.has(this.type))this.score.textContent=this.type==='freerope'?`${r.count} 次 · 绳速 ${Math.round(r.rpm)} · ${(r.count*.35).toFixed(1)} 千卡`:`${r.count} 次 · 剩 ${Math.max(0,Math.ceil(r.duration-r.time))} 秒 · 绳速 ${Math.round(r.rpm)}`;
    else if(this.type==='freefootball')this.score.textContent=`${this.freeGoals} 进球 / ${this.freeShots} 射门`;
    else if(this.type==='layup')this.score.textContent=`${this.results.filter(r=>r.hit).length} 命中 / ${this.results.length} 上篮`;
    else this.score.textContent=`${this.results.filter(r=>r.hit).length} 命中 / ${this.results.length} 出手`;
    if(this.notice)this.notice.textContent=this.paused?'训练已暂停 · 点击继续训练':this.saveError||(ROPES.has(this.type)&&this.phase==='running'?`${r.phase>1-.22*r.rpm/60-.07&&r.phase<1-.22*r.rpm/60+.07?'现在起跳！ · ':''}${r.last} · 连续 ${r.streak} 次`:this.lastResult);
    if(this.action)this.action.hidden=this.phase==='complete';const meter=this.panel.querySelector('.meter');if(meter)meter.hidden=this.phase==='complete';
    if(ROPES.has(this.type)&&this.zone){const timing=1-.22*r.rpm/60;this.zone.style.left=((timing-.07)*100)+'%';}   // 绳速漂移/滑条后绿区随实际 rpm 移动
    if(this.fill)this.fill.style.width=(ROPES.has(this.type)?r.phase*100:this.type==='layup'?(this.layupState?clamp((1-(this.layupState.d-LAYUP.under)/(LAYUP.start-LAYUP.under)),0,1)*100:0):this.charge*100)+'%';
    if(this.action){
      const allowed=this.paused?[]:ROPES.has(this.type)?['running']:this.type==='layup'?['ready','drive','steps']:this.type==='freefootball'?['ready']:['ready'];
      this.action.disabled=!allowed.includes(this.phase);
      if(this.type==='layup')this.action.textContent=this.phase==='ready'?'起步 · 空格 / E':this.phase==='drive'?(this.layupState.inWin?'起跳！ · 空格 / E':'起跳（进彩色弧区）· 空格'):this.phase==='steps'?(this.step?.jumping?'出手！ · 松开 / 再按空格':'1-2-跳…'):'球在飞行中…';
      else if(ROPES.has(this.type))this.action.textContent='点击起跳 · 空格 / E';
      else this.action.textContent=this.charging?`蓄力 ${Math.round(this.charge*100)}% · 松手${this.type==='freefootball'?'射门':'出手'}`:this.type==='freefootball'?'按住蓄力，松手射门':'按住蓄力，松手出手';
    }
  }
  state(){return {active:this.active,open:this.open,type:this.type,level:this.level,phase:this.phase,paused:this.paused,charge:this.charge,round:this.round,results:this.results.map(r=>({...r})),rope:this.type==='rope'&&this.ropeRound?{...this.ropeRound}:this.type==='freerope'&&this.ropeRound?{...this.ropeRound}:null,layup:this.type==='layup'?{d:this.layupState?.d,win:this.layupState?.win,inWin:this.layupState?.inWin,err:this.layupErr,step:this.step?{t:this.step.t,beat:this.step.beat,jumping:this.step.jumping,d0:this.step.d0}:null,tune:{...this.layupTune}}:null,free:this.type==='freefootball'?{shots:this.freeShots,goals:this.freeGoals,dribbling:!!this.dribbling,keeperOn:!!this.keeperOn}:null,gripError:this.active&&ROPES.has(this.type)?this.a.grips()?.map((p,i)=>p.distanceTo(this.handles[i].position)):null,keeper:this.keeper?{...this.keeper}:null,ball:this.ball?{position:{...this.ball.body.translation()},velocity:{...this.ball.body.linvel()},radius:this.ball.r}:null,records:{...this.records}};}
}
