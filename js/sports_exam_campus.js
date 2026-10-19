import {EXAM_SPORTS,DIFFICULTIES,getMission,finishMission,returnURL,sportSummary} from './sports_exam.js';

export class SportsExamCampus {
  constructor(id,adapter){
    this.mission=getMission(id);this.adapter=adapter;this.active=false;this.pending=null;this.shots=[];this.elapsed=0;
    if(!this.mission)return;
    this.active=true;this.phase=this.mission.status==='complete'?'complete':'ready';
    const link=document.createElement('link');link.rel='stylesheet';link.href='js/sports_exam.css';document.head.append(link);
    this.panel=document.createElement('section');this.panel.id='sportsExamPanel';this.panel.setAttribute('aria-label','体育考核');document.body.append(this.panel);
    this.panel.addEventListener('keydown',e=>e.stopPropagation());
    if(this.phase!=='complete')adapter.prepare(this.mission.lv);
    this.render();
    window.__sportsExam={state:()=>{const training=window.__sportsPlay?.state();return {id:this.mission.id,lv:this.mission.lv,tier:this.mission.tier,target:this.mission.target,phase:this.phase,shots:this.mission.result?.shots||((this.mission.lv===2&&training?.active)?training.results.map(r=>r.points):[]),pending:this.mission.lv===2&&training?.phase==='flight',result:this.mission.result||null,control:this.mission.control||null};}};
  }
  get freezeMovement(){return this.active&&this.phase==='running'&&this.adapter.state().phase==='count';}
  button(label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{fn();b.blur();};this.panel.append(b);return b;}
  leave(){this.adapter.stop();location.href=returnURL(this.mission);}
  render(){
    const m=this.mission,s=EXAM_SPORTS[m.lv];this.panel.replaceChildren();
    const h=document.createElement('h2');h.textContent=`${s.name}实测 · ${m.tier}级${DIFFICULTIES[m.tier-1]}`;
    const p=document.createElement('p');p.textContent=this.phase==='complete'?sportSummary(m):s.lesson;
    this.panel.append(h,p);this.readout=document.createElement('strong');this.readout.setAttribute('role','status');this.panel.append(this.readout);
    if(this.phase==='ready'||this.phase==='interrupted'){
      this.readout.textContent=this.error||`本次目标：${s.verb} ${m.target} ${s.unit}。先准备，再开始计时。`;
      this.button(this.phase==='interrupted'?'重新实测':'开始体育实测',()=>this.start());
    }else if(this.phase==='complete'){
      this.readout.textContent='实测已保存。回考核室，用自己的数据作答。';
    }else if(this.phase==='save-error'){this.readout.textContent=this.error;this.button('重试保存成绩',()=>this.finish(this.pendingData));}
    this.button(this.phase==='complete'?'带成绩返回考核室':'退出实测，返回考核室',()=>{this.adapter.stop();location.href=returnURL(this.mission);});
  }
  start(){
    if(this.phase==='running'||this.phase==='complete')return;
    this.adapter.prepare(this.mission.lv);this.shots=[];this.pending=null;this.error='';this.phase='running';
    this.render();this.adapter.start(this.mission.lv,this.mission.target);
  }
  // Actual shot events belong to SportsPlay; this class only persists completed results.
  shot(){}
  basket(){}
  finish(data){
    if(!this.active||!['running','save-error'].includes(this.phase))return;
    this.pendingData=data;this.panel.hidden=false;
    try{this.mission=finishMission(this.mission.id,data);this.phase='complete';this.adapter.stop();this.render();}
    catch(e){this.phase='save-error';this.error='成绩未保存：'+e.message+'。本次数据仍在，可以重试保存。';this.adapter.stop();this.render();}
  }
  interrupt(message){this.adapter.stop();this.pending=null;this.phase='interrupted';this.error=message;this.render();}
  tick(){} // Movement, cancellation, pause and physical completion use the shared controllers.
}
