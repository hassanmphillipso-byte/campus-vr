import {createPractice,practiceAction,practicePrompt} from './task_practice.js';
import {mountGuide} from './voice_guide.js';
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export class PracticePanel{
 constructor(stage){
  this.stage=stage;this.data=stage.data;this.state=createPractice(this.data);this.phase='practice';
  this.root=make('section',undefined,'taskPractice');this.root.id='taskPractice';this.root.setAttribute('aria-label','不计成绩的模型演练');
  this.head=make('div',undefined,'practiceHead');this.phaseText=make('strong');this.phaseText.id='practicePhase';this.head.append(this.phaseText,make('span','不限时 · 不计成绩 · 不发金币','practicePolicy'));
  this.prompt=make('p',undefined,'practicePrompt');this.prompt.id='practicePrompt';this.prompt.setAttribute('aria-live','polite');
  this.controls=make('div',undefined,'practiceControls');this.controls.id='practiceControls';
  this.readout=make('p',undefined,'practiceReadout');this.readout.id='practiceReadout';this.readout.setAttribute('aria-live','polite');
  this.nav=make('div',undefined,'practiceNav');
  const button=(id,text,fn)=>{const b=make('button',text);b.type='button';b.id=id;b.onclick=fn;this.nav.append(b);return b;};
  this.reset=button('practiceReset','重新演练',()=>this.act('reset'));
  this.start=button('practiceStart',this.data.kind==='condition'?'继续本室学习':'开始编程',()=>stage.beginCoding({focus:true}));
  this.skip=button('practiceSkip',this.data.kind==='condition'?'直接查看学习总结':'跳过演练',()=>stage.beginCoding({focus:true}));
  this.returnButton=button('practiceReturn','返回模型演练',()=>this.setPhase('practice'));
  this.root.append(this.head,this.prompt,this.controls,this.readout,this.nav);stage.root.append(this.root);
  this.setPhase('practice');
  this.resizeObserver=new ResizeObserver(()=>{const bottom=Math.ceil(this.root.getBoundingClientRect().height)+20;this.stage.viewport.style.bottom=`${bottom}px`;this.stage.caption.style.bottom=`${bottom+3}px`;});this.resizeObserver.observe(this.root);
 }
 button(label,action,value,disabled=false){const b=make('button',label);b.type='button';b.dataset.practiceAction=action;if(value!==undefined)b.dataset.value=String(value);b.disabled=disabled;b.onclick=()=>this.act(action,value);this.controls.append(b);return b;}
 act(action,value){this.state=practiceAction(this.data,this.state,action,value);this.stage.time=0;this.stage.practiceFrame=-1;this.render();this.stage.updatePractice();}
 setPhase(phase){this.phase=phase;this.voice?.dispose();this.voice=null;this.stage.root.dataset.phase=phase;this.root.dataset.phase=phase;
  this.phaseText.textContent=({practice:'① 现在：动手操作模型',coding:this.data.kind==='condition'?'② 现在：查看本室学习总结':'② 现在：用代码复现',playback:this.stage.result?.partial?'③ 现在：查看未完成执行的部分记录':'③ 现在：查看实际执行回放'})[phase];
  this.controls.hidden=this.reset.hidden=phase!=='practice';this.start.hidden=this.skip.hidden=phase!=='practice';this.returnButton.hidden=phase==='practice';
  this.root.querySelector('.practicePolicy').hidden=phase!=='practice';
  this.stage.practiceVoiceHost??=make('div',undefined,'practiceVoiceHost');if(!this.stage.practiceVoiceHost.isConnected)this.stage.guide.append(this.stage.practiceVoiceHost);
  if(phase!=='coding')this.voice=mountGuide(this.stage.practiceVoiceHost,[phase==='practice'?(this.data.kind==='condition'?'g205':'practiceIntro'):'playbackGuide'],{title:phase==='practice'?'模型演练说明':'真实回放说明'});
  this.render();this.stage.updatePractice();if(phase==='playback')this.stage.stepButton.disabled=!this.stage.frames?.length;
 }
 render(){
  const d=this.data,s=this.state,kind=d.kind,isPractice=this.phase==='practice';
  this.root.dataset.complete=String(s.complete);this.stage.root.dataset.practiceComplete=String(s.complete);
  this.prompt.textContent=isPractice?practicePrompt(d,s):this.phase==='coding'?(kind==='condition'?'本室先学习逐张判断；下方继续学习后进入循环课程。':'在下方补全或编写代码，再点“运行代码并回放”；修改后可以反复运行。'):this.stage.result?.partial?'执行异常或记录已截断；这里只回放已收到的真实部分，不能代表程序正常结束。请修复后重新运行。':'模型依据本次实际输出和执行记录回放；点“逐步查看”逐条核对，修改代码后再运行。';
  this.readout.textContent=isPractice?s.message:'';this.readout.hidden=!isPractice||!s.message;this.controls.replaceChildren();
  if(!isPractice)return;
  if(['run','rank'].includes(kind)){
   this.button('启动计时比较','race');
   // 2026-10-17 老师反馈（截图圈红）：删去「本题 X 秒」「比较 X 秒」两个计时切换按钮；'time' action 处理器保留（无入口，兼容不删）。
  }else if(kind==='swim')this.button(s.index===0?'移开完整段':'标出剩余段','segment',undefined,s.complete);
  else if(kind==='power')this.button(`增加一轮分支（${s.round}/${d.rounds}）`,'branch',undefined,s.complete);
  else if(kind==='gate'){
   this.button(`核对组数条件${s.gateChecks.includes('score')?' ✓':''}`,'checkScore');this.button(`核对剩余条件${s.gateChecks.includes('speed')?' ✓':''}`,'checkSpeed');this.button('用 and 合并','gate');
   // 2026-10-16 老师反馈：删去「本题数据/只改成绩未达标/只改速度未达标」三个数据切换按钮；practiceAction 的 gateCase 分支保留（node 单测直测 action，不经 UI）。
  }else if(['sum','count','average'].includes(kind)){
   d.scores.forEach((score,i)=>this.button(`${i+1}号 ${score}${s.selected.includes(i)?' ✓':''}`,'card',i,s.selected.includes(i)));
   if(kind==='average')this.button('平均分给每人','share',undefined,s.selected.length!==d.scores.length);
  }else if(kind==='extremes'){
   const pick=s.selectedMax===null?'pickMax':'pickMin';const mode=make('span',pick==='pickMax'?'先选最高：':'再选最低：','practiceChoiceLabel');this.controls.append(mode);
   d.scores.forEach((score,i)=>{const b=this.button(`${i+1}号 ${score}` ,pick,i);if(i===s.selectedMax||i===s.selectedMin)b.classList.add('practicePicked');});
   if(s.selectedMax!==null)this.button('重选最高','reset');
  }else if(kind==='condition'){this.button(`达到 ${d.threshold}`,'judge','yes',s.complete);this.button(`未达到 ${d.threshold}`,'judge','no',s.complete);}
  else if(['loop','accumulate'].includes(kind)){
   this.button(s.complete?'条件不成立，已停止':'执行一轮','round',undefined,s.complete);
   if(kind==='accumulate')for(const target of [...new Set([d.target,Math.floor(d.target/d.perRound)*d.perRound,0])]){
    const b=this.button(`演练目标 ${target}`,'target',target);b.setAttribute('aria-pressed',String(s.target===target));
   }
  }
  else if(kind==='debug'){
   if(!s.debugFixed){this.button(`错误示例下一步（${s.debugSteps}/6）`,'bug',undefined,s.debugSteps>=6);this.button('补上更新 i += 1','fix');}
   else this.button('修复后执行一步','fixedStep',undefined,s.complete);
  }else if(kind==='graduate'){
   this.button('取一项','take',undefined,s.held!==null||s.index>=d.scores.length);this.button('加入 total','add',undefined,s.held===null||s.added);this.button('移动到下一项','move',undefined,!s.added);this.button('汇总','summary',undefined,s.index!==d.scores.length);
  }else if(kind==='route')for(let i=1;i<=d.count;i++)this.button(`第 ${i} 站${s.actions.includes(i)?' ✓':''}`,'station',i,s.actions.includes(i));
 }
 dispose(){this.resizeObserver?.disconnect();this.voice?.dispose();this.stage.practiceVoiceHost?.remove();this.root.remove();}
}
