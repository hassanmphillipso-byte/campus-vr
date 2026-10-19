import * as T from 'three';
import {clone as skeletonClone} from 'three/addons/utils/SkeletonUtils.js';
import {taskSceneData,taskSceneResult} from './task_stage_data.js';
import {taskExplanation,actionFrame,actionPlaybackText} from './task_explanation.js';
import {replayFrames} from './task_practice.js';
import {PracticePanel} from './task_practice_ui.js';

const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};

// A task-specific observation space; shares the campus WebGL renderer.
export class TaskStage{
 constructor({room,levels,renderer,environment,characters}){
  Object.assign(this,{room,renderer,characters});this.data=taskSceneData(room,levels);this.resources=new Set();this.labels=[];this.time=0;this.result=null;this.paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.root=make('section',undefined,'taskStage');this.root.id='taskStage';this.root.setAttribute('aria-label','本题三维观察区');
  const head=make('div',undefined,'taskStageHead');this.givenLabel=make('span',this.data.given);head.append(make('strong',this.data.title),this.givenLabel);
  const tools=make('div',undefined,'taskStageTools');
  const btn=(id,text,fn)=>{const b=make('button',text);b.id=id;b.type='button';b.onclick=fn;tools.append(b);return b;};
  this.pauseButton=btn('stagePause',this.paused?'播放':'暂停',()=>{this.paused=!this.paused;this.pauseButton.textContent=this.paused?'播放':'暂停';});
  btn('stageReplay','重播实际记录',()=>{if(this.result){this.practicePanel?.setPhase('playback');this.time=0;this.manualIndex=-1;this.paused=false;this.pauseButton.textContent='暂停';}});
  this.stepButton=btn('stageStep','逐步查看',()=>this.step());
  btn('stageReset','还原视角',()=>{this.angle=.08;this.elevation=.4;this.zoom=1;});
  this.expandButton=btn('stageExpand','放大模型',()=>this.expand(!this.expanded));
  this.viewport=make('div',undefined,'taskViewport');this.viewport.id='taskViewport';this.viewport.setAttribute('aria-label','可拖动旋转的实时三维模型');
  this.caption=make('p',undefined,'taskStageCaption');this.caption.id='taskStageCaption';
  /* 老师反馈（截图5）：『这个模型说明什么』模块重复、不需要——已不再插入侧栏；explanation 仅作屏内状态文本更新 */this.guide=make('section',undefined,'taskGuide');this.guide.hidden=true;
  this.explanation=make('p');this.explanation.id='taskExplanation';this.explanation.setAttribute('aria-live','polite');this.guide.append(this.explanation);
  this.root.append(this.viewport,head,tools,this.caption);document.querySelector('.workHead').after(this.root);
  this.originalStyle=renderer.domElement.getAttribute('style');this.viewport.append(renderer.domElement);
  document.getElementById('workstation').classList.add('task-mode');document.body.classList.add('taskActive');
  this.onKey=e=>{if(e.code==='Escape'&&this.expanded){e.preventDefault();e.stopImmediatePropagation();this.expand(false);this.expandButton.focus();}};
  window.addEventListener('keydown',this.onKey,true);
  this.scene=new T.Scene();this.scene.background=new T.Color(room.lv===1?0xd9e9ed:room.lv===2?0xdfe7ed:0xe8e2d5);this.scene.environment=environment;this.scene.environmentIntensity=.4;
  this.scene.add(new T.HemisphereLight(0xf7fbff,0x66715d,1.7));const sun=new T.DirectionalLight(0xfff5e0,2.5);sun.position.set(-4,9,5);this.scene.add(sun);
  this.camera=new T.PerspectiveCamera(36,1,.1,100);this.angle=.08;this.elevation=.4;this.zoom=1;
  this.content=new T.Group();this.scene.add(this.content);this.build();this.setResult(null);this.practicePanel=new PracticePanel(this);this.updatePractice();
  let drag=null;
  this.viewport.onpointerdown=e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};this.viewport.setPointerCapture(e.pointerId);};
  this.viewport.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;this.angle-=(e.clientX-drag.x)*.006;this.elevation=T.MathUtils.clamp(this.elevation+(e.clientY-drag.y)*.004,.3,1.2);drag.x=e.clientX;drag.y=e.clientY;};
  this.viewport.onpointerup=e=>{if(drag&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<7)this.pickPractice(e);drag=null;};this.viewport.onpointercancel=this.viewport.onlostpointercapture=()=>drag=null;
  this.viewport.addEventListener('wheel',e=>{e.preventDefault();this.zoom=T.MathUtils.clamp(this.zoom+e.deltaY*.001,.75,1.4);},{passive:false});
 }
 own(r){this.resources.add(r);return r;}
 material(color,extra={}){return this.own(new T.MeshStandardMaterial({color,roughness:.55,metalness:.12,...extra}));}
 shape(geometry,color,x,y,z,parent=this.content,extra){const m=new T.Mesh(this.own(geometry),this.material(color,extra));m.position.set(x,y,z);parent.add(m);return m;}
 box(x,y,z,w,h,d,color,parent=this.content,extra){return this.shape(new T.BoxGeometry(w,h,d),color,x,y,z,parent,extra);}
 sphere(x,y,z,r,color,parent=this.content){return this.shape(new T.SphereGeometry(r,20,12),color,x,y,z,parent);}
 bar(a,b,r,color,parent=this.content){const d=new T.Vector3().subVectors(b,a);const m=this.shape(new T.CylinderGeometry(r,r,d.length(),12),color,...a.clone().add(b).multiplyScalar(.5).toArray(),parent);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;}
 label(text,x,y,z,width=2.5,color='#173d44'){
  // WebGL allocates immutable texture storage. Keep the canvas dimensions fixed
  // when the caption changes; crop with UVs instead of resizing its source.
  const cv=document.createElement('canvas');cv.width=1024;cv.height=110;const c=cv.getContext('2d');
  const texture=this.own(new T.CanvasTexture(cv));texture.colorSpace=T.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=T.LinearFilter;
  const material=this.own(new T.SpriteMaterial({map:texture,depthTest:false,toneMapped:false})),sprite=new T.Sprite(material);sprite.position.set(x,y,z);this.content.add(sprite);
  const font='600 62px "PingFang SC","Microsoft YaHei",sans-serif';
  const item={sprite,last:null,write(value,tint=color){if(item.last===value+'|'+tint)return;item.last=value+'|'+tint;c.font=font;const crop=Math.min(1024,Math.max(100,Math.ceil(c.measureText(value).width)+36));c.clearRect(0,0,1024,110);c.fillStyle=tint;c.textAlign='center';c.textBaseline='middle';c.fillText(value,512,55,988);texture.repeat.set(crop/1024,1);texture.offset.set((1-crop/1024)/2,0);const w=Math.min(width,crop/110*.48);sprite.scale.set(w,w*110/crop,1);texture.needsUpdate=true;}};item.write(text);this.labels.push(item);return item;
 }
 board(x,y,z,title){
  this.box(x,y,z,3.3,1.28,.15,0x243c43);this.box(x,y,z+.09,3.05,1.05,.035,0x102b32);
  this.label(title,x,y+.27,z+.12,2.5,'#a9d3cc');return this.label('等待运行',x,y-.18,z+.15,2.65,'#fff0b5');
 }
 athlete(){
  const asset=this.characters.Boy_A,obj=skeletonClone(asset.scene),bounds=new T.Box3().setFromObject(obj),scale=1.65/(bounds.max.y-bounds.min.y);
  obj.scale.setScalar(scale);obj.position.y=-bounds.min.y*scale;obj.traverse(n=>{if(n.isMesh)n.frustumCulled=false;});
  const g=new T.Group();g.add(obj);this.content.add(g);const mixer=new T.AnimationMixer(obj);
  const actions=Object.fromEntries(['Man_Run','Man_Jump','Man_Idle'].map(name=>[name,mixer.clipAction(asset.clips[name])])),actor={g,obj,mixer,actions,current:null};
  actor.pose=(name,time)=>{if(actor.current!==name){mixer.stopAllAction();actions[name].play();actor.current=name;}const action=actions[name];action.time=time%action.getClip().duration;mixer.update(0);};
  return actor;
 }
 build(){
  const kind=this.data.kind,green=0x327969;
  this.box(0,-.34,0,12.6,.48,6.6,0xc8d1c9);this.box(0,-.07,0,12.3,.12,6.3,0xf4f2e8);
  for(const x of [-6,6])for(const z of [-3,3])this.box(x,-.58,z,.18,.5,.18,0x64756e);
  // A quiet built environment frames the working instrument without a second canvas.
  this.box(0,-.75,0,200,.12,200,0xcbd7d3);this.box(0,.9,-3.22,12.5,1.9,.12,0xf2f1e8);
  for(let x=-5.7;x<6;x+=1.4){this.box(x,1,-3.11,1.28,1.35,.035,0xadcbd0);this.box(x,1.02,-3.06,.028,1.4,.025,0xe5e9df);}
  if(kind==='rank'){                                  // 102 整数商观察台：跑道模型保留
   this.box(-.4,.03,.8,10.6,.1,2.95,0xbd7560);
   for(const z of [-.5,.35,1.2,2.05])this.box(-.4,.093,z,10.5,.01,.04,0xfff9e5);
   for(const x of [-5.2,4.6]){this.box(x,.1,.8,.05,.02,2.7,0xfff9e5);for(const z of [-.65,2.22])this.box(x,.78,z,.06,1.45,.06,green);}
   this.label('起点 0 m',-4.75,.25,2.7,2);this.label(`终点 ${this.data.distance} m`,4.25,.25,2.7,2.25);
   this.runner=this.athlete();this.runner.g.position.set(-4.9,.12,.8);this.runner.g.rotation.y=Math.PI/2;
   this.timer=this.label(`0.0 / ${this.data.time} s`,-.4,2.12,-1.55,3.2);
   this.display=this.board(3.1,.95,-1.8,'向下取整读数（非排名）');
   this.label(`已知距离 ${this.data.distance} 米`,-3.4,1.65,-2.05,3.2);
  }else if(kind==='run'){                             // 101 跳绳测频：原地跳 + 计数（2026-10-16 题面改跳绳，不再用跑道）
   this.box(-.4,.03,.8,10.6,.1,2.95,0x9fbb9f);
   for(const z of [-.5,2.05])this.box(-.4,.093,z,10.5,.01,.04,0xfff9e5);
   for(const x of [-5.2,4.6])this.box(x,.1,.8,.05,.02,2.7,0xfff9e5);
   this.runner=this.athlete();this.runner.g.position.set(-.4,.12,.8);this.runner.g.rotation.y=Math.PI/2;
   this.timer=this.label(`0.0 / ${this.data.time} s`,-1.9,2.12,-1.55,2.6);
   this.count=this.label(`0 / ${this.data.distance} 下`,1.1,2.12,-1.55,2.6);
   this.display=this.board(3.1,.95,-1.8,'每秒跳绳频率计分牌');
   this.label(`已知总数 ${this.data.distance} 下`,-3.4,1.65,-2.05,3.2);
  }else if(kind==='swim'){
   this.box(0,-.01,.2,10.7,.13,4.6,0x1b8aab);
  }
  if(kind==='swim'){
   this.water=this.box(0,.075,.2,10.5,.035,4.4,0x37b6cc,this.content,{transparent:true,opacity:.83,roughness:.19,metalness:.3});
   for(const z of [-1.5,.15,1.8])for(let j=0;j<36;j++)this.sphere(-5.05+j*.29,.14,z,.053,j%4<2?0xf6d456:0xf7f5ea);
   this.label('本趟起点',-5,.4,2.8,1.4);this.label(`本趟终点 ${this.data.pool} m`,4.5,.4,2.8,2.4);this.label(`完整段 ${Math.floor(this.data.swim/this.data.pool)} × ${this.data.pool} m`,-2.8,1.65,-2.45,3.7);
   this.swimmer=new T.Group();this.content.add(this.swimmer);this.box(0,.1,0,.85,.2,.42,0x244854,this.swimmer);this.sphere(.6,.15,0,.18,0xf3c870,this.swimmer);this.box(-.68,.12,0,.65,.13,.26,0xe2b595,this.swimmer);
   this.swimArms=[-1,1].map(side=>{const a=this.box(.22,.15,side*.36,.58,.09,.13,0xe2b595,this.swimmer);return a;});
   this.swimmer.position.set(-5+10*(this.data.swim%this.data.pool)/this.data.pool,.17,.9);this.display=this.board(2.6,1.15,-2.4,'本趟已游 · 你的输出');
   const remainder=this.data.swim%this.data.pool,left=(this.data.pool-remainder)%this.data.pool,doneWidth=10*remainder/this.data.pool,leftWidth=10*left/this.data.pool;
   this.swimProgress=this.box(-5+doneWidth/2,.16,1.9,Math.max(.001,doneWidth),.04,.22,0xc6ad4a);this.swimProgress.visible=false;
   this.swimRemaining=this.box(5-leftWidth/2,.16,1.9,Math.max(.001,leftWidth),.04,.22,0x247d57);this.swimRemaining.visible=false;
   this.swimMark=this.box(5,.38,1.9,.06,.5,.35,0xcc7834);this.swimMark.visible=false;
   this.swimLabels=[this.label(`本趟已游 ${remainder} m`,-5+doneWidth/2,.7,1.9,3),this.label(`还差 ${left} m`,5-leftWidth/2,.7,1.9,2.1)];this.swimLabels.forEach(x=>x.sprite.visible=false);
  }else if(kind==='power'){
   this.powerLayers=[];
   for(let round=0;round<=this.data.rounds;round++){
    const layer=new T.Group();this.content.add(layer);const x=-4.8+round*9.6/Math.max(1,this.data.rounds),count=this.data.choices**round,shown=Math.min(128,count);
    for(let i=0;i<shown;i++){
     const z=-2.25+(i+.5)/shown*4.5;this.sphere(x,.4,z,round<4?.1:.06,round===this.data.rounds?0xd09b45:0x36766a,layer);
     if(round){const parentZ=-2.25+(Math.floor(i/this.data.choices)+.5)/(shown/this.data.choices)*4.5;this.bar(new T.Vector3(x-9.6/Math.max(1,this.data.rounds),.4,parentZ),new T.Vector3(x,.4,z),.013,0x82a49a,layer);}
    }
    this.label(`${round} 轮`,x,.23,2.9,1.3);const countLabel=this.label(`${count} 条`,x,.85,0,1.3);this.powerLayers.push({layer,label:countLabel});
   }
   this.display=this.label('等待运行路线程序',0,2.2,-2.1,5.5);
  }else if(kind==='gate'){
   this.box(0,.04,.55,9,.13,2.6,0xd3dfd6);
   for(const x of [-2.1,2.1]){this.box(x,1,.3,.3,2,.45,green);this.sphere(x,2.15,.3,.14,0xebc362);}
   this.gate=this.box(0,1.12,.3,4,.15,.18,0xc2a25d);
   this.gateLabels=[this.label(this.data.conds?.[0]?.expr||`score ≥ ${this.data.minScore}`,-3.8,1.55,.3,2.8),this.label(this.data.conds?.[1]?.expr||`speed > ${this.data.minSpeed}`,3.8,1.55,.3,2.8)];
   this.display=this.board(0,1.45,-2.1,'你的分组判定');
  }else if(this.data.scores.length){
   const {scores}=this.data;this.bars=[];
   for(let i=0;i<scores.length;i++){
    const x=scores.length===1?0:-4.65+i*9.3/(scores.length-1),h=.35+Math.max(0,scores[i])/Math.max(1,...scores)*1.7;const bar=this.box(x,h/2,0,.84,h,1,0x518696);this.bars.push(bar);this.box(x,.035,.94,1.03,.065,.73,0xf8f5e6);
    this.label(String(scores[i]),x,h+.24,0,1.15);this.label(String(i+1)+'号',x,.26,1.12,1.08);
   }
   this.display=this.label('等待运行你的程序',0,2.6,-1.5,6.7);
   this.label(kind==='condition'?`逐个检查 scores[i] ≥ ${this.data.threshold}`:'原始成绩 · 与下方 scores 一致',0,.34,2.55,5);
   if(kind==='average'){this.averageLine=this.box(0,.15,0,10.5,.035,.04,0xe1ae44);this.averageLine.visible=false;}
  }else if(kind==='route'){
   this.routeStations=[];const n=this.data.count;
   this.box(0,.05,.55,10.8,.12,1.5,0x90aaa3);
   for(let i=1;i<=n;i++){const x=n===1?0:-4.6+(i-1)*9.2/(n-1);const marker=this.shape(new T.CylinderGeometry(.46,.55,.3,24),0x527987,x,.22,.55);this.routeStations.push(marker);this.label(`第 ${i} 站`,x,.78,.55,1.6);}
   this.runner=this.athlete();this.runner.g.position.set(-4.6,.4,.55);this.routeReadout=this.label('按顺序点击训练站',0,2.35,-1.3,5.8);this.display=this.board(0,1.2,-2,'train 指令记录');
  }else if(['loop','accumulate','debug'].includes(kind)){
   this.box(-1.6,.05,.5,5.8,.15,4.5,0x719c91);
   for(let i=0;i<Math.min(20,this.data.count||Math.ceil(this.data.target/this.data.perRound)||1);i++)this.box(-4.15+i*.5,.14,2.22,.34,.035,.26,0xf8efcc);
   this.runner=this.athlete(0xcb824c);this.runner.g.position.set(-1.5,.16,.65);
   this.box(2.2,.53,.1,2.6,1.05,2.2,0xb49b72);this.box(2.2,1.1,.1,2.75,.14,2.35,0x354e50);
   this.display=this.board(2.2,2.05,-.35,'动作记录');
   this.loopReadout=this.label('等待 jump() 指令',-1.5,2.25,-1.3,3.8);
   this.label('条件 → 执行 → 更新',-1.5,.35,2.9,4);
  }
 }
 pickPractice(event){
  if(this.practicePanel?.phase!=='practice')return;const targets=this.routeStations||this.bars;if(!targets)return;
  const box=this.viewport.getBoundingClientRect(),pointer=new T.Vector2((event.clientX-box.left)/box.width*2-1,-(event.clientY-box.top)/box.height*2+1),ray=new T.Raycaster();ray.setFromCamera(pointer,this.camera);const hit=ray.intersectObjects(targets)[0];if(!hit)return;const index=targets.indexOf(hit.object),kind=this.data.kind;
  if(kind==='route')this.practicePanel.act('station',index+1);
  else if(['sum','count','average'].includes(kind))this.practicePanel.act('card',index);
  else if(kind==='extremes')this.practicePanel.act(this.practicePanel.state.selectedMax===null?'pickMax':'pickMin',index);
 }
 beginCoding({focus=false}={}){
  this.practicePanel?.setPhase('coding');this.result=null;this.frames=[];this.time=0;this.manualIndex=-1;this.root.dataset.result='none';this.root.dataset.partial='false';
  const observation=this.data.kind==='condition';this.display?.write(observation?'查看本室学习总结':'等待运行你的代码');this.explanation.textContent=taskExplanation(this.data,null);this.caption.textContent=observation?'本室不用写代码；阅读下方总结，理解后完成本室任务。':'编程阶段：下方运行代码后，模型显示真实记录。';this.stepButton.disabled=true;
  if(focus){const target=document.getElementById(observation?'special':'code');target?.scrollIntoView({block:'nearest'});(observation?target?.querySelector('button'):target)?.focus({preventScroll:true});}
 }
 updatePractice(){
  const panel=this.practicePanel;if(!panel)return;const s=panel.state,d=this.data,active=panel.phase==='practice';
  this.givenLabel.textContent=active&&d.kind==='accumulate'?`演练目标 ${s.target} · 每轮 ${d.perRound}（编程题仍为 ${d.target}）`:d.given;
  if(!active)return;
  this.time=0;this.stepButton.disabled=true;this.root.dataset.result='none';this.root.dataset.partial='false';this.caption.textContent=d.kind==='condition'?'模型演练 · 当前操作不计成绩。完成后继续本室学习。':'模型演练 · 当前操作不计成绩。完成后在下方用代码复现。';
  const text=s.message||'等待你动手操作';this.explanation.textContent=text;
  if(['sum','count','average','graduate','condition'].includes(d.kind))this.display?.write(d.kind==='condition'?`已查 ${s.index} 张 · 达标 ${s.good} 人`:d.kind==='count'?`人数 ${s.selected.length}`:`total = ${s.total}${s.average===null?'':` · avg = ${Number(s.average.toFixed(3))}`}`);
  else if(d.kind==='extremes')this.display?.write(`最高 ${s.selectedMax===null?'待选':d.scores[s.selectedMax]} · 最低 ${s.selectedMin===null?'待选':d.scores[s.selectedMin]}`);
  else if(d.kind==='run')this.display?.write(s.complete?`/ ${Number((d.distance/s.time).toFixed(4))} 下/秒`:'启动计时后显示频率');
  else if(d.kind==='rank')this.display?.write(s.complete?`// ${Math.floor(d.distance/s.time)}`:'启动计时后显示整数商');
  else if(d.kind==='gate')this.display?.write(s.complete?s.phase==='open'?'True · 正好分完':'False · 还有剩余':'分别核对两个条件');
  else if(d.kind==='power')this.display?.write(`第 ${s.round} 轮 · ${d.choices**s.round} 条路线`);
  else if(d.kind==='swim')this.display?.write(s.index===2?`演练：还差 ${(d.pool-d.swim%d.pool)%d.pool} 米（剩余量）`:'先区分完整段和本趟');
  else this.display?.write(d.kind==='accumulate'?`演练目标 ${s.target} · total ${s.total} · ${s.actions.length} 轮`:`演练动作 ${s.actions.length}`);
  if(this.bars)this.bars.forEach((b,i)=>b.material.color.setHex(d.kind==='graduate'?(i===s.index?0xe2b044:i<s.index?0x367963:0x518696):s.selected.includes(i)?0x367963:i===s.selectedMax||i===s.selectedMin?0xe2b044:d.kind==='condition'&&i===s.index?0xe2b044:0x518696));
  if(this.averageLine){this.averageLine.visible=s.average!==null;this.averageLine.position.y=.35+(s.average||0)/Math.max(1,...d.scores)*1.7;}
  if(this.swimProgress){this.swimProgress.visible=s.index>0;this.swimRemaining.visible=s.index>1;this.swimMark.visible=false;this.swimLabels.forEach((x,i)=>x.sprite.visible=s.index>i);}
 }
 setResult(raw){
  this.result=taskSceneResult(raw);this.frames=replayFrames(this.data,this.result);this.time=0;this.manualIndex=-1;
  const r=this.result;if(r)this.practicePanel?.setPhase('playback');else if(this.practicePanel?.phase==='playback')this.practicePanel.setPhase('coding');
  const palette=this.bars||this.data.kind==='power'?['#294e59','#185a39','#925120']:['#e9dca7','#c9f4bc','#fbd3a4'];
  this.display?.write(!r?'等待运行':r.partial?`执行未完成 · ${r.actions.length} 条已记录`:r.error?(r.timeout?'已安全终止':'代码未完成'):r.actions.length?`共 ${r.actions.length} 次指令`:r.text.replace(/\n/g,'  ').slice(0,58)||'没有打印输出',palette[!r?0:r.pass?1:2]);
  this.caption.textContent=!r?'先动手操作模型，再在下方编程。':r.error?r.error:r.actions.length?`本次程序产生 ${r.actions.length} 次 ${this.data.kind==='route'?'train':'jump'} 指令，按顺序回放。`:`本次输出：${r.text||'无'}。${r.pass?'已通过本室校验。':'尚未通过，请对照题目修改。'}`;
  this.root.dataset.result=!r?'none':r.pass?'pass':'retry';this.root.dataset.partial=String(!!r?.partial);this.explanation.textContent=taskExplanation(this.data,r);this.stepButton.disabled=!r||!this.frames.length;
  if(this.swimRemaining){const show=!!r&&!r.error;this.swimProgress.visible=this.swimRemaining.visible=show;this.swimLabels.forEach(x=>x.sprite.visible=show);this.swimMark.visible=show&&r.values.length===1&&r.values[0]>=0&&r.values[0]<=this.data.pool;this.swimMark.position.x=-5+(r?.values[0]||0)/this.data.pool*10;}
  if(this.averageLine){this.averageLine.visible=!!r&&Number.isFinite(r.values[0]);this.averageLine.position.y=.35+(r?.values[0]||0)/Math.max(1,...this.data.scores)*1.7;}
  if(this.bars)for(let i=0;i<this.bars.length;i++)this.bars[i].material.color.setHex(r&&this.data.kind==='extremes'&&r.values.includes(this.data.scores[i])?0xd59e3f:0x518696);
 }
 step(){
  const count=this.frames?.length||0;if(!count)return;
  const current=this.manualIndex>=0?this.manualIndex:-1;this.manualIndex=current>=count?-1:current+1;this.time=(Math.max(0,this.manualIndex)+.4)*.75;
  this.paused=true;this.pauseButton.textContent='播放';
 }
 expand(value){this.expanded=value;this.root.classList.toggle('stage-expanded',value);this.expandButton.textContent=value?'返回答题':'放大模型';}
 render(dt){
  if(!this.paused&&!document.hidden)this.time+=Math.min(dt,.08);
  const kind=this.data.kind,practice=this.practicePanel?.phase==='practice',p=practice?this.practicePanel.state:null,r=practice?null:this.result,t=this.time,d=this.data;
  if(this.powerLayers){const round=p?p.round:r&&!r.error?d.rounds:0;this.powerLayers.forEach((layer,i)=>{layer.layer.visible=i<=round;layer.label.sprite.visible=i<=round;});}
  if(this.runner){
   if(kind==='rank'){
    const limit=p?p.time:d.time,elapsed=p?.complete?Math.min(limit,t*limit/2.5):r?Math.min(limit,t*limit/2.5):0;
    this.runner.g.position.x=-4.9+9.5*Math.min(1,elapsed/limit);this.timer.write(`${elapsed.toFixed(1)} / ${limit} s`);this.runner.pose(elapsed>0&&elapsed<limit?'Man_Run':'Man_Idle',t);
   }else if(kind==='run'){
    const limit=p?p.time:d.time,elapsed=p?.complete?Math.min(limit,t*limit/2.5):r?Math.min(limit,t*limit/2.5):0,active=elapsed>0&&elapsed<limit;
    this.timer.write(`${elapsed.toFixed(1)} / ${limit} s`);this.count?.write(`${Math.round(d.distance*Math.min(1,elapsed/limit))} / ${d.distance} 下`);
    this.runner.pose(active?'Man_Jump':'Man_Idle',active?(t/.75%1)*this.runner.actions.Man_Jump.getClip().duration:0);
   }else{
    const a=p?p.actions:r?.actions||[],n=a.length,idx=p?Math.max(0,n-1):Math.min(n,Math.floor(t/.75)),phase=p?Math.min(1,t/.75):t/.75%1;
    const moving=p?n>0&&t<.75:idx<n;
    this.runner.pose(moving?'Man_Jump':'Man_Idle',moving?phase*this.runner.actions.Man_Jump.getClip().duration:0);
    if(kind==='route'){
     const current=p?a.at(-1):a[Math.min(idx,n-1)],valid=Number.isInteger(current)&&current>=1&&current<=d.count;
     if(valid)this.runner.g.position.x=d.count===1?0:-4.6+(current-1)*9.2/(d.count-1);
     else this.runner.g.position.x=-5.4;
     const shown=p?a:a.slice(0,Math.min(n,idx+1));this.routeStations.forEach((m,i)=>m.material.color.setHex(shown.includes(i+1)?0xc5a044:0x527987));
     this.routeReadout.write(n?(idx<n?`${p?'演练':'实际'}顺序 ${idx+1}/${n}：train(${current})${valid?'':'（超出站点）'}`:r?.partial?`部分记录已到末尾 · ${n} 条`:`已回放 ${n} 条 train 指令`):'等待按顺序访问站点');
    }else this.loopReadout.write(n?(p?`演练第 ${n} 次 · jump(${a.at(-1)})`:idx<n?`第 ${idx+1} 次 · jump(${a[idx]})`:r?.partial?`部分记录已到末尾 · ${n} 条`:`已回放 ${n} 次指令`):r?.timeout?'终止后等待修复':'等待 jump() 指令');
    if(!p&&n){const f=actionFrame(r,idx),command=kind==='route'?'train':'jump';const actual=this.frames?.[Math.min(idx,n-1)];if(kind==='accumulate'&&Number.isFinite(actual?.values?.total))this.display.write(`第 ${Math.min(idx+1,n)} 轮 · total = ${actual.values.total}`);this.caption.textContent=actionPlaybackText(d,r,idx);}
   }
  }
  if(!p&&r&&this.frames?.length){
   const idx=Math.min(this.frames.length-1,Math.floor(t/.75)),f=this.frames[idx];
   if(kind==='graduate'){
    this.bars?.forEach((b,i)=>b.material.color.setHex(i===f.index?0xe2b044:0x518696));this.display?.write(`i=${f.index} · ${f.before} + ${f.value} = ${f.after}`);
    this.caption.textContent=`真实累加 ${idx+1}/${this.frames.length}：第 ${f.line} 行，${f.variable} 从 ${f.before} 变成 ${f.after}；取用 scores[${f.index}] = ${f.value}。${r.partial?'仅为部分记录，执行未完成。':r.pass?'本题通过。':'本题尚未通过。'}`;
   }else if(!r.actions.length){this.caption.textContent=(r.partial?'部分记录（执行未完成）：':'')+(f.type==='output'?`真实打印：${String(f.text).trim()}`:`真实执行第 ${f.line} 行：${Object.entries(f.values||{}).filter(([k])=>!['ACTS','scores'].includes(k)).map(([k,v])=>`${k} = ${v}`).join(' · ')}`);}
  }
  if(this.swimmer){this.swimmer.rotation.z=Math.sin(t*1.8)*.035;this.swimArms.forEach((a,i)=>a.rotation.y=Math.sin(t*2+i*Math.PI)*.7);this.water.material.opacity=.82+Math.sin(t*1.6)*.025;}
  if(this.gate)this.gate.position.y=(p?p.complete&&p.phase==='open':/True\s*$/.test(r?.text||''))?1.12+Math.min(t,1)*1.25:1.12;
  const bounds=this.viewport.getBoundingClientRect(),w=bounds.width,h=bounds.height;if(w<1||h<1)return;
  const size=this.renderer.getSize(this.size??=new T.Vector2());if(size.x!==w||size.y!==h)this.renderer.setSize(w,h);
  this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
  const c=Math.abs(Math.cos(this.angle)),s=Math.abs(Math.sin(this.angle));
  const fitWidth=13*c+6.7*s,fitHeight=(13*s+6.7*c)*Math.sin(this.elevation)+3*Math.cos(this.elevation)+.6;
  const dist=Math.max(fitHeight,fitWidth/this.camera.aspect)/(2*Math.tan(T.MathUtils.degToRad(18)))*this.zoom;
  this.camera.position.set(Math.sin(this.angle)*Math.cos(this.elevation)*dist,.65+Math.sin(this.elevation)*dist,Math.cos(this.angle)*Math.cos(this.elevation)*dist);this.camera.lookAt(0,.65,0);
  this.renderer.render(this.scene,this.camera);
 }
 state(){return {practice:this.practicePanel?{...structuredClone(this.practicePanel.state),operationPhase:this.practicePanel.state.phase,phase:this.practicePanel.phase}:null,replayCount:this.frames?.length||0,room:this.room.id,kind:this.data.kind,scores:[...this.data.scores],time:this.time,paused:this.paused,result:this.result?structuredClone(this.result):null,frame:actionFrame(this.result,Math.floor(this.time/.75)),round:this.powerLayers?(this.practicePanel?.phase==='practice'?this.practicePanel.state.round:this.result?this.data.rounds:0):null,camera:[this.angle,this.elevation,this.zoom]};}
 dispose(){
  this.practicePanel?.dispose();window.removeEventListener('keydown',this.onKey,true);document.body.prepend(this.renderer.domElement);this.renderer.domElement.setAttribute('style',this.originalStyle||'');this.renderer.setSize(innerWidth,innerHeight);
  this.root.remove();this.guide.remove();document.getElementById('workstation').classList.remove('task-mode');document.body.classList.remove('taskActive');
  if(this.runner){this.runner.mixer.stopAllAction();this.runner.mixer.uncacheRoot(this.runner.obj);this.runner.obj.traverse(n=>{if(n.isSkinnedMesh)n.skeleton.dispose();});}
  for(const r of this.resources)r.dispose();this.resources.clear();
 }
}
