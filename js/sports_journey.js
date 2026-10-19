import {assertSaveCurrent} from './save_session.js';
import {strokeHUD,setStrokeLive} from './swim_strokes.js';

const NAMES={run:'跑步 · 跑道竞速',swim:'游泳 · 泳道折返',ping:'乒乓 · 连续回球'};
const HELP={run:['按住 W 或「前进」，跟随跑道箭头。','按住 Shift 或「冲刺」加速；松开恢复体力。','到达目标后看成绩，也可以再练一次。'],swim:['按住 W 或「划水」，沿泳道向前。','接近池壁，点击「转身」后继续划水。','看剩余米数；顶着池壁不会增加距离。','按 1-4 或点左下角切换泳姿：自由泳/蛙泳/仰泳/蝶泳——只影响手感，到达米数判定不变。'],ping:['按空格 / E 或「发球」，把球送到对面。','A / D 左右移动，让球进入击球圈。','来球到身前时按一次「挥拍」，回球后准备下一拍。']};
// A single input/lifecycle shell for existing campus physics. It never sets scores.
export class SportsJourney {
  constructor(adapter){
    this.a=adapter;this.active=false;this.forward=false;this.sprint=false;this.steer=0;
    this.panel=document.createElement('section');this.panel.id='sportsJourney';this.panel.hidden=true;this.panel.setAttribute('aria-label','运动控制');document.body.append(this.panel);
    for(const e of ['pointerdown','pointerup','click'])this.panel.addEventListener(e,event=>event.stopPropagation());
    addEventListener('keydown',e=>this.key(e,true),true);addEventListener('keyup',e=>this.key(e,false),true);
    addEventListener('blur',()=>this.pause());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();});
    addEventListener('campus-save-invalidated',()=>this.pause());
    window.__sportsJourney={state:()=>this.state()};
  }
  get freezeMovement(){return this.active&&(this.paused||this.phase!=='running'||this.a.state(this.type).phase==='count');}
  button(label,fn,cls=''){const b=document.createElement('button');b.textContent=label;b.className=cls;b.onclick=()=>{fn();b.blur();};return b;}
  hold(button,down,up){button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);if(!this.paused)down();};button.onpointerup=e=>{e.preventDefault();up();};button.onpointercancel=button.onlostpointercapture=up;}
  open(type,level=0,options={}){
    if(this.active)this.close();this.type=type;this.level=level;this.options=options;this.home=this.a.position();this.active=true;this.phase='intro';this.paused=false;this.assist=level===0;this.stable=true;this.saveError='';this.result=null;this.forward=this.sprint=false;this.steer=0;
    this.target=options.target||({run:[30,60,100],swim:[10,25,50],ping:[3,5,8]}[type][level]);
    this.a.prepare(type,this.target);this.panel.hidden=false;this.render();
    this.strokeHudStart();   // 泳姿 HUD/参数层只在「非考核的游泳训练」激活；考核与其余项目一律收起
  }
  strokeHudStart(){const on=this.type==='swim'&&!this.options.exam;if(on)strokeHUD.show();setStrokeLive(on);}   // setStrokeLive(false) 会顺带 hide，单一出口防漏
  strokeHudStop(){setStrokeLive(false);}
  start(){this.a.cancelInput();this.forward=this.sprint=false;this.steer=0;this.phase='running';this.paused=false;this.elapsed=0;this.a.start(this.type,this.target);this.render();}
  render(){
    const isIntro=this.phase==='intro';this.panel.replaceChildren();this.panel.dataset.sport=this.type;
    const title=document.createElement('h2');title.textContent=NAMES[this.type];this.panel.append(title);
    const stage=document.createElement('p');stage.className='journeyMode';stage.textContent=`${this.level+1}级 · ${this.options.exam?'体育实测':'自由训练'} · ${this.assist?(this.type==='ping'?'入门击球范围':'方向辅助开启'):'独立操作'}`;this.panel.append(stage);
    if(isIntro){
      const steps=document.createElement('ol');for(const text of HELP[this.type]){const li=document.createElement('li');li.textContent=text;steps.append(li);}this.panel.append(steps);
      if(this.type==='swim'&&!this.options.exam){const note=document.createElement('p');note.style.cssText='color:#93ebcc;margin:2px 0 8px';note.textContent='江浪练自由泳、沈小鱼练蛙泳——试试不同泳姿的手感';this.panel.append(note);}
      if(this.level===0&&this.type!=='ping')this.toggle('开启方向辅助',this.assist,v=>{this.assist=v;},'directionAssist');
      if(this.type==='swim')this.toggle('稳定水面镜头',this.stable,v=>{this.stable=v;},'stableWater');
      this.panel.append(this.button('开始'+(this.options.exam?'实测':'训练'),()=>this.start(),'primary'),this.button('跳过说明并开始',()=>this.start(),'quiet'));
    }else{
      this.readout=document.createElement('strong');this.readout.className='journeyReadout';this.panel.append(this.readout);
      this.hint=document.createElement('p');this.hint.className='journeyHint';this.hint.setAttribute('role','status');this.panel.append(this.hint);
      if(this.phase==='running'){
        this.primary=this.button(this.type==='ping'?'发球 / 挥拍':'按住'+(this.type==='swim'?'划水':'前进'),()=>{},'primary journeyAction');
        if(this.type==='ping')this.primary.onclick=()=>{if(!this.paused)this.a.pingAction();};
        else this.hold(this.primary,()=>{this.forward=true;},()=>{this.forward=false;});this.panel.append(this.primary);
        const row=document.createElement('div');row.className='journeyControls';
        for(const [label,dir] of [['向左',-1],['向右',1]]){const b=this.button(label,()=>{});this.hold(b,()=>{this.steer=dir;},()=>{this.steer=0;});row.append(b);}
        if(this.type!=='ping'){const boost=this.button(this.type==='run'?'按住冲刺':'按住加快划水',()=>{});this.hold(boost,()=>{this.sprint=true;},()=>{this.sprint=false;});row.append(boost);}
        if(this.type==='swim'){this.turn=this.button('转身',()=>this.a.turn());row.append(this.turn);}this.panel.append(row);
        this.panel.append(this.button(this.paused?'继续训练':'暂停',()=>this.paused?this.resume():this.pause(),'quiet'));
      }else if(this.result){
        this.readout.textContent=this.type==='ping'?`连续回球 ${this.result.rallies} 次`:`${this.result.distance} 米 · ${this.result.seconds.toFixed(1)} 秒`;
        this.hint.textContent=this.saveError||`本次已保存 · 本档最佳 ${this.best??''}${this.type==='ping'?' 次':' 秒'}。重练不重复发金币。`;
        if(this.saveError)this.panel.append(this.button('重试保存',()=>this.finish(this.result),'primary'));
        this.panel.append(this.button('再练一次',()=>{const t=this.type,l=this.level;this.close();this.open(t,l);},'primary'));
        if(this.type!=='ping')this.panel.append(this.button('去考核室学习与答题',()=>{location.href=`classrooms.html?wing=${this.type==='run'?1:3}`;},'quiet'));
      }
    }
    this.panel.append(this.button(this.options.exam?'退出实测，返回考核室':'返回校园',()=>this.exit(),'quiet'));
  }
  toggle(label,value,set,id){const row=document.createElement('label');const box=document.createElement('input');box.type='checkbox';box.id=id;box.checked=value;box.onchange=()=>set(box.checked);row.append(box,' '+label);this.panel.append(row);}
  key(e,down){
    if(!this.active||!['Space','KeyE','Escape','KeyT'].includes(e.code))return;
    if(e.target instanceof HTMLInputElement)return;
    e.preventDefault();e.stopImmediatePropagation();if(!down||e.repeat)return;
    if(e.code==='Escape'){this.paused?this.resume():this.pause();return;}
    if(this.paused)return;
    if(this.phase==='intro'){this.start();return;}
    if(this.phase!=='running')return;
    if(this.type==='ping')this.a.pingAction();else if(this.type==='swim')this.a.turn();
  }
  pause(){if(!this.active||this.paused||this.phase!=='running')return;this.paused=true;this.pauseAt=performance.now();this.forward=this.sprint=false;this.steer=0;this.a.cancelInput();this.render();}
  resume(){if(!this.paused)return;this.a.resume(performance.now()-this.pauseAt);this.paused=false;this.render();}
  tick(dt){
    if(!this.active)return;
    if(this.a.modal())this.pause();
    const s=this.a.state(this.type);this.a.guidance(this.type,this.active&&this.phase==='running',this.assist&&!this.paused,dt);
    if(this.type==='swim'&&this.phase!=='complete')strokeHUD.setDisabled(this.paused);   // tick 同步：暂停时泳姿按钮禁用（intro/running 均可切）
    if(this.phase!=='running')return;
    this.primary.disabled=this.paused||s.phase==='count';if(this.turn)this.turn.disabled=this.paused||!s.atWall||s.phase==='count';
    if(this.paused){this.hint.textContent='已暂停 · 计时、运动和操作已停止';return;}
    this.elapsed+=dt;
    if(this.type==='ping'){
      this.readout.textContent=`连续回球 ${s.rallies} / ${this.target} 次`;
      this.primary.textContent=s.canServe?'发球':'挥拍';
      this.hint.textContent=s.hint||'按一次发球，等待来球到击球圈再挥拍';
      if(s.rallies>=this.target)this.finish({rallies:s.rallies,seconds:this.elapsed});
    }else{
      this.readout.textContent=`${Math.min(s.distance,this.target).toFixed(1)} / ${this.target} 米 · ${s.seconds.toFixed(1)} 秒`;
      this.hint.textContent=s.phase==='count'?'各就位… 发令后出发':this.type==='run'?`沿箭头前进 · 体力 ${Math.round(s.stamina)}% · ${s.exhausted?'体力不足，请松开冲刺恢复':s.sprinting?'正在冲刺':'正常跑，体力恢复'}`:s.atWall?'到池壁了 · 点「转身」或按 T，再继续划水':`还剩 ${Math.max(0,this.target-s.distance).toFixed(1)} 米 · 按住 W 划水`;
      if(!s.phase&&this.elapsed>1)this.hint.textContent='已离开运动区域，本轮未完成。返回校园后可重新开始。';
    }
  }
  finish(result){
    if(!this.active)return;this.result=result;this.phase='complete';this.forward=this.sprint=false;this.steer=0;this.a.stop();this.a.guidance(this.type,false,false,0);this.strokeHudStop();   // 结束即收起泳姿 HUD 并停用参数层
    if(this.options.exam){const cb=this.options.onComplete,control={ruleVersion:2,assisted:this.assist};this.close(false);cb({...result,control});return;}
    this.saveError='';try{
      assertSaveCurrent();const records=JSON.parse(localStorage.getItem('campus.training.v2')||'{}'),key=`${this.type}-${this.level}-${this.assist?'assisted':'independent'}`,old=records[key];
      const value=this.type==='ping'?result.rallies:result.seconds;
      records[key]=typeof old==='number'?(this.type==='ping'?Math.max(old,value):Math.min(old,value)):value;
      this.best=this.type==='ping'?records[key]:records[key].toFixed(1);
      localStorage.setItem('campus.training.v2',JSON.stringify(records));
    }catch{this.saveError='纪录未保存，请保持此页并重试。';}this.render();
  }
  exit(){const cb=this.options.onExit;this.close();cb?.();}
  close(restore=true){this.a.stop();this.a.cancelInput();this.a.guidance(this.type,false,false,0);this.strokeHudStop();this.active=false;this.paused=false;this.forward=this.sprint=false;this.steer=0;this.panel.hidden=true;if(restore&&this.home)this.a.restore(this.home);}
  state(){return {active:this.active,type:this.type,level:this.level,phase:this.phase,paused:this.paused,assist:this.assist,stable:this.stable,target:this.target,result:this.result,...this.active?{motion:this.a.state(this.type)}:{}};}
}
