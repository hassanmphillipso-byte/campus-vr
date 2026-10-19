import * as T from 'three';
import {loopTrace,statisticReadout} from './exam_data.js';
import {KNOWLEDGE_POINTS} from './question_bank_data.js';
import {createExamStage} from './exam_stage.js';

// Classroom teaching instruments, rendered by the classroom's existing renderer.
export class ExamModels {
  constructor(lv,environment){
    this.lv=lv;this.scene=new T.Scene();this.stage=createExamStage(lv);this.scene.add(this.stage.root);this.scene.background=new T.Color(this.stage.sky);this.scene.fog=new T.Fog(this.stage.sky,28,75);
    this.scene.environment=environment;this.scene.environmentIntensity=.45;
    this.camera=new T.PerspectiveCamera(48,1,.1,120);this.camera.position.set(10,8.5,15);this.camera.lookAt(0,.8,-1);this.camera.zoom=1.14;
    this.scene.add(new T.HemisphereLight(0xffffff,0x455c63,2));const light=new T.DirectionalLight(0xfff4db,3);light.position.set(-3,8,5);this.scene.add(light);
    this.group=new T.Group();this.scene.add(this.group);this.meshes=[];this.stepIndex=0;this.revealed=false;
  }
  material(color){return new T.MeshStandardMaterial({color,roughness:.62,metalness:.06});}
  mesh(geo,color,x,y,z){const m=new T.Mesh(geo,this.material(color));m.position.set(x,y,z);this.group.add(m);this.meshes.push(m);return m;}
  box(x,y,z,w,h,d,color){return this.mesh(new T.BoxGeometry(w,h,d),color,x,y,z);}
  ball(x,y,z,r,color){return this.mesh(new T.SphereGeometry(r,16,12),color,x,y,z);}
  label(text,x,y,z,color='#173e32',scale=1.3){
    const cv=document.createElement('canvas'),c=cv.getContext('2d');c.font='bold 44px sans-serif';cv.width=Math.max(100,Math.ceil(c.measureText(text).width+30));cv.height=90;c.fillStyle=color;c.font='bold 44px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,cv.width/2,45);
    const tx=new T.CanvasTexture(cv);tx.colorSpace=T.SRGBColorSpace;const s=new T.Sprite(new T.SpriteMaterial({map:tx,depthTest:false}));s.position.set(x,y,z);s.scale.set(scale,scale*cv.height/cv.width,1);this.group.add(s);this.meshes.push(s);return s;
  }
  clear(){for(const m of this.meshes){m.geometry?.dispose();m.material.map?.dispose();m.material.dispose();}this.meshes=[];this.group.clear();this.runner=null;}
  show(q,revealed=false){this.q=q;this.revealed=revealed;this.stepIndex=0;this.build();}
  setImmersive(hideLabels){this.hideLabels=hideLabels;for(const m of this.meshes)if(m.isSprite)m.visible=!hideLabels;}
  step(){if(!this.revealed)return;this.stepIndex++;this.build();}
  replay(){this.stepIndex=0;this.build();}
  // 无 3D 演示数据的题（扩充题库）：编程题给一台电脑桌，其余给知识台立牌。
  buildStation(q){
    const kp=KNOWLEDGE_POINTS.find(k=>k.kp===q.kp);
    if(q.type==='code'){
      this.box(0,.5,0,4.8,.12,2.4,0x8a6a4c);
      for(const x of [-2.1,2.1])this.box(x,.1,.9,.14,1,.14,0x5c4a38),this.box(x,.1,-.9,.14,1,.14,0x5c4a38);
      const cv=document.createElement('canvas');cv.width=512;cv.height=320;const c=cv.getContext('2d');
      c.fillStyle='#0d1a17';c.fillRect(0,0,512,320);
      c.fillStyle='#58806f';c.fillRect(0,0,512,44);c.fillStyle='#cfe6d4';c.font='bold 24px Menlo,monospace';c.fillText('Python 训练机 · student.py',18,30);
      const lines=['distance = 0','while distance < 10:','    distance += 5','print(distance)'];
      lines.forEach((l,i)=>{c.fillStyle=i===1?'#ffd479':'#9fd8b8';c.font='26px Menlo,monospace';c.fillText(l,28,92+i*54);});
      c.fillStyle='#4d7263';c.fillText('▶ 运行',28,300);
      const tx=new T.CanvasTexture(cv);tx.colorSpace=T.SRGBColorSpace;
      this.box(0,2.05,-.5,4,2.6,.18,0x223431);
      const screen=new T.Mesh(new T.PlaneGeometry(3.82,2.4),new T.MeshBasicMaterial({map:tx}));
      screen.position.set(0,2.05,-.4);this.group.add(screen);this.meshes.push(screen);
      this.box(0,.95,-.5,.5,.6,.3,0x223431);
      this.box(0,.62,.35,1.7,.06,.5,0x3a4a46);
      this.box(1.3,.62,.35,.28,.05,.4,0xd9e3d4);
      this.label('编程考核站',0,3.6,-.5,'#244e41',1.7);
      this.caption='在电脑上写出代码，运行并让输出与要求一致。';
    }else{
      this.box(0,1,-.7,3.4,2,.16,0xfaf6e6);
      this.box(0,.06,-.7,3.8,.12,.5,0x729185);
      this.label(kp?kp.label:'知识考核',0,1.15,-.6,'#1d453a',2.3);
      this.label(q.type==='tf'?'判断题':q.type==='blank'?'填空题':'选择题',0,1.75,-.6,'#7c8f88',1.1);
      if(this.lv===1)for(let i=0;i<5;i++)this.ball(-1.6+i*.8,.42,.9,.16,i%2?0xd9a847:0x729185);
      else if(this.lv===2)for(let i=0;i<4;i++){const x=-1.8+i*1.2;this.box(x,.35,.9,.7,.7,.08,0xfaf6e8);this.label(String([3,0,5,2][i]),x,.75,.9,'#182f47',1);}
      else{for(let i=0;i<6;i++)this.ball(-2.2+i*.88,.3,.9,.09,i<4?0xf2c362:0xe4d4a8);this.box(1.6,.45,.9,.1,.5,.5,0xe4d4a8);}
      this.caption='先读题，再在任务面板中作答。';
    }
  }
  build(){
    this.clear();const q=this.q,v=q.values;this.box(0,-.27,0,9,.4,6.2,this.lv===3?0x40555b:this.lv===2?0xb58853:0xd9e3d4);
    if(!v)this.buildStation(q);
    else if(q.model==='run'){
      this.box(0,0,0,7.8,.16,2.8,0xaa6954);
      for(const z of [-1.2,0,1.2])this.box(0,.09,z,7.8,.02,.04,0xfaf6e6);
      for(const x of [-3.5,3.5]){this.box(x,1,1.5,.09,2,.09,0x244e41);this.box(x,1,-1.5,.09,2,.09,0x244e41);this.box(x,2,0,.09,.15,3.1,0x244e41);}
      this.label('起点',-3.5,.4,2);this.label(`${v.d} m`,3.5,.4,2);this.label(this.revealed?`${v.t} s  /  ${v.speed} m/s`:'计时门待核验',0,2.7,0,'#244e41',3.5);
      this.runner=new T.Group();this.group.add(this.runner);const parts=[this.ball(0,.95,0,.19,0xe4ba98),this.box(0,.55,0,.34,.48,.25,0x2f7966),this.box(-.1,.2,0,.11,.4,.13,0x273f47),this.box(.1,.2,0,.11,.4,.13,0x273f47)];parts.forEach(p=>this.runner.attach(p));
      this.runner.position.x=this.revealed?-3.3+6.6*(Math.min(this.stepIndex,4)/4):-3.3;
      this.caption=this.revealed?`第 ${Math.min(this.stepIndex,4)} / 4 段 · 用路程除以时间，得到平均速度。`:'提交测算单后，逐段回放计时门。';
    }else if(q.model==='group'){
      for(let g=0;g<13;g++){
        const x=-3.5+(g%5)*1.75,z=-1.8+Math.floor(g/5)*1.8;this.box(x,.02,z,1.45,.12,1.35,this.revealed&&g===this.stepIndex%13?0xd9aa52:0x729185);this.label(String(g+1),x,.4,z+.7,'#193d33',.65);
        if(this.revealed){const each=Math.floor(v.total/v.groups),available=v.left<0?Math.min(v.each,each+(g<v.total%v.groups?1:0)):v.each;for(let j=0;j<available;j++)this.ball(x-.45+j%3*.42,.25,z-.35+Math.floor(j/3)*.38,.13,0xd9a847);if(available<v.each)this.label('缺 1',x,.85,z,'#9c462f',.8);}
      }
      if(this.revealed&&v.left>=0){this.box(1.75,.02,1.8,1.45,.12,1.35,0xb9c7ae);for(let j=0;j<v.left;j++)this.ball(1.3+j%3*.42,.25,1.45+Math.floor(j/3)*.38,.13,0xd9a847);this.label('余球',1.75,.4,2.5,'#193d33',.85);}
      this.label(this.revealed?(v.left>=0?`每组 ${v.each} · 余 ${v.left}`:`计划需 ${v.groups*v.each} · 缺 ${-v.left}`):`${v.total} 个球 / ${v.groups} 组`,0,2.6,0,'#183d32',4);
      this.caption=this.revealed?`正在检查第 ${this.stepIndex%13+1} 组。${v.left>=0?'余球放在单独托盘，不计入每组。':'每组再加 1 个需要 13 个，余球只有 9 个。'}`:'先计算，再打开分组托盘核验。';
    }else if(q.model==='branch'){
      const levels=this.revealed?Math.min(v.rounds,this.stepIndex+1):1;
      for(let l=0;l<=levels;l++)for(let j=0;j<2**l;j++){
        const x=(j+.5)*7/(2**l)-3.5,z=l*1.25-2;this.ball(x,.25,z,.12,0xd4aa52);
        if(l){const parent=(Math.floor(j/2)+.5)*7/(2**(l-1))-3.5;const points=[new T.Vector3(parent,.2,z-1.25),new T.Vector3(x,.2,z)];const line=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:0x38755b}));this.group.add(line);this.meshes.push(line);}
      }
      this.label(this.revealed?`${2**v.rounds} 条${v.divide?' / 每队 '+2**v.rounds/v.divide+' 条':''}`:`每轮 2 条，共 ${v.rounds} 轮`,0,2.2,0,'#244e41',4);
      this.caption=`当前展开 ${levels} 轮、${2**levels} 条。沿连接线观察：每一轮都在上一轮的基础上再分成两条。`;
    }else if(['cards','bars','rank'].includes(q.model)){
      const scores=v.scores,n=scores.length,largest=Math.max(...scores),readout=statisticReadout(q,this.stepIndex%n);let total=0;
      for(let i=0;i<n;i++){
        const x=(i-(n-1)/2)*Math.min(1.35,7.2/n),h=q.model==='bars'?.2+scores[i]*.25:.12;
        const hi=this.revealed&&(readout.metric==='range'?scores[i]===largest||scores[i]===readout.lo:readout.metric==='hitRate'?scores[i]>0:q.model==='rank'?scores[i]===largest:i<=this.stepIndex%n);
        this.box(x,h/2,0,Math.min(1.1,6/n),h,1.5,hi?0xe8ab51:0xfaf6e8);this.label(String(scores[i]),x,h+.28,0,'#182f47',.9);this.label('记录'+(i+1),x,.35,1.4,'#182f47',.85);if(i<=this.stepIndex%n)total+=scores[i];
      }
      if(this.revealed&&readout.metric==='mean')this.box(0,.2+readout.mean*.25,-.88,7.6,.035,.035,0x36796a);
      const caption=readout.formula;
      this.label(this.revealed?caption:'原始积分卡',0,2.6,-1.8,'#172e49',3.4);
      this.caption=this.revealed?`${readout.formula}。当前核对第 ${readout.current}/${n} 条：${scores[readout.current-1]}。${readout.metric==='mean'?'绿线为平均值。':readout.metric==='range'?'同时标亮最大值与最小值。':readout.metric==='hitRate'?'标亮命中的出手，0 分仍在分母内。':'相同分数保留为独立记录。'}`:'这些是题目原始数据。先判断，再盖章核验。';
    }else{
      this.box(0,0,0,7.8,.25,3.9,0x1e829a);
      for(const z of [-1.5,0,1.5])for(let x=-3.6;x<3.8;x+=.3)this.ball(x,.16,z,.055,Math.round(x*10)%2?0xf1d475:0xf4f0dd);
      const trace=loopTrace(v),index=this.revealed?Math.min(this.stepIndex,trace.trace.length-1):0,state=trace.trace[index],max=Math.max(v.end,1);
      const x=-3.4+6.8*Math.min(1,Math.max(0,(state.value-v.start)/(max-v.start||1)));
      this.box(x,.5,-.65,.5,.3,.9,0xe4d4a8);this.ball(x,.52,-1.2,.23,0xf2c362);this.box(x-.4,.4,-.65,.48,.13,.18,0xe4d4a8);this.box(x+.4,.4,-.65,.48,.13,.18,0xe4d4a8);
      this.label(this.revealed?`${state.value} ${v.inclusive?'≤':'<'} ${v.end} → ${state.condition?'真':'假'}`:'判断 → 训练 → 更新',0,2.5,0,'#f4dc96',4);
      this.caption=!this.revealed?'提交后，单步检查循环条件与进度。':!state.condition?'条件为假，正常退出；本步不执行训练。':index===trace.trace.length-1&&!trace.stopped?'演示已安全暂停。条件仍为真，程序没有正常结束。':`条件为真，执行训练；下一步进度${v.step>=0?'加':'减'} ${Math.abs(v.step)}。`;
    }
    for(const m of this.meshes)if(m.isSprite)m.visible=!this.hideLabels;
  }
  render(renderer,element){
    const r=element.getBoundingClientRect();if(r.width<1||r.height<1)return;
    const size=renderer.getSize(this.size??=new T.Vector2());
    if(this.w!==r.width||this.h!==r.height||size.x!==r.width||size.y!==r.height){this.w=r.width;this.h=r.height;renderer.setSize(r.width,r.height);this.camera.aspect=r.width/r.height;this.camera.zoom=1.14*Math.min(1,this.camera.aspect/.95);this.camera.updateProjectionMatrix();}
    renderer.render(this.scene,this.camera);
  }
  dispose(){this.clear();this.stage.dispose();}
}
