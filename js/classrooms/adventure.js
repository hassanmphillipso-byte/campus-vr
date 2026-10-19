import {archiveAttempt} from '../replay_store.js';
import {mountGuide} from './voice_guide.js';
import {campusMusic} from '../campus_music.js';
import {ExamRoom as ClassicExam} from './exam.js';
import {DIFFICULTIES} from '../sports_exam.js';
import {AdventureWorld} from './adventure_world.js';
import {restoreQuestionContext,createAdventure,validAdventure,adventureKey,adventureScore,recordAdventureAnswer,judgeFighter} from './adventure_data.js';
import {poolChoices} from './question_bank.js';
import {newBlocks,moveBlock,rotateBlock,dropBlock,dropBlockInLane,tickBlocks,newFlight,tickFlight} from './adventure_sim.js';

const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const NAMES={basic:'信号台',blocks:'能源桥',fighter:'设备巡检'};
export class AdventureExam extends ClassicExam{
 constructor(args){
  super(args);this.adventureReady=true;this.classic=new URLSearchParams(location.search).get('examMode')!=='adventure';
  this.world=new AdventureWorld(args.environment);this.held=new Set();this.paused=false;this.lastFrame=0;this.saveClock=0;this.readRun();
  window.removeEventListener('keydown',this.onKey,true);
  this.onKey=e=>{
   if(document.querySelector('dialog[open]'))return;
   if(e.code==='Escape'){
    e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;
    if(this.classic){if(this.taskOpen){this.taskOpen=false;this.render();}else if(this.phase==='result')this.close();else this.exit();}
    else if(this.paused){this.paused=false;this.lastFrame=0;this.render();}
    else if(this.phase==='result')this.close();else this.exit();return;
   }
   if(this.classic||this.paused||['INPUT','SELECT','TEXTAREA','BUTTON'].includes(e.target.tagName)&&e.code==='Space')return;
   if(this.phase==='blocks'){
    const actions={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'rotate',KeyW:'rotate',Space:'drop',ArrowDown:'drop'};
    if(actions[e.code]){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat||!['drop','rotate'].includes(actions[e.code]))this.blockAction(actions[e.code]);}
   }else if(this.phase==='fighter'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD'].includes(e.code)){e.preventDefault();this.held.add(e.code);}
  };
  this.keyUp=e=>this.held.delete(e.code);
  this.onHidden=()=>{if(!this.classic&&['blocks','fighter'].includes(this.phase)){this.held.clear();this.paused=true;this.store();this.render();}};
  window.addEventListener('keydown',this.onKey,true);window.addEventListener('keyup',this.keyUp);window.addEventListener('blur',this.onHidden);
  this.visibility=()=>{if(document.hidden)this.onHidden();};document.addEventListener('visibilitychange',this.visibility);
  this.phase='home';this.render();
 }
 get adventureKey(){return adventureKey(this.lv,this.tier);}
 readRun(){const a=this.save.exams[this.adventureKey];this.run=validAdventure(a)&&a.lv===this.lv&&a.tier===this.tier?restoreQuestionContext(a):null;}
 store(){
  if(!this.adventureReady||this.classic)return super.store();
  if(this.run)this.save.exams[this.adventureKey]=this.run;
  const ok=this.persist();this.message(ok?'':'记录未保存成功，请重试；离开或刷新可能丢失进度。');return ok;
 }
 start(fresh=false){
  if(this.classic)return super.start(fresh);
  if(fresh||!this.run||this.run.finished){if(!this.store())return;archiveAttempt(this.save,this.adventureKey,this.run);if(!this.persist()){this.message('历史记录保存失败，未开始新考核。');return;}const seed=crypto.getRandomValues(new Uint32Array(1))[0];this.run=createAdventure(this.lv,this.tier,seed,poolChoices(this.lv,new Set(Object.keys(this.save.tasks||{}))));}
  this.paused=false;this.phase=this.run.scene;this.lastFrame=0;this.render();this.store();
 }
 go(phase){this.held.clear();this.paused=false;this.phase=phase;if(this.run)this.run.scene=phase;this.lastFrame=0;this.render();this.store();}
 exit(){if(this.classic)return super.exit();this.held.clear();this.paused=false;this.phase='result';this.render();this.store();this.root.querySelector('h1')?.focus();}
 selectMode(classic){
  if(!this.store())return;this.held.clear();this.classic=classic;this.paused=false;this.phase='home';
  const url=new URL(location.href);url.searchParams.set('examMode',classic?'classic':'adventure');history.replaceState(null,'',url);
  if(classic)super.loadTier();else this.readRun();this.render();
 }
 setAdventureTier(tier){
  if(!this.store())return;this.tier=tier;this.save.examTier[this.lv]=tier;this.readRun();
  const url=new URL(location.href);url.searchParams.set('difficulty',tier);history.replaceState(null,'',url);this.render();this.store();
 }
 recordStation(key,result){
  // 首答一经发送就写入并保存；“继续”只负责推进站点——看解析后刷新不能改写首答（E05）。
  if(!recordAdventureAnswer(this.run,key,result))return false;
  if(this.run.finished){
   const score=adventureScore(this.run);this.save.examBest[this.adventureKey]=Math.max(Number(this.save.examBest[this.adventureKey])||0,score);
   this.save.quiz[this.lv]=Math.max(Number(this.save.quiz[this.lv])||0,score);
   this.record('adventure',{lv:this.lv,tier:this.tier,id:this.run.id,score});
  }
  this.store();return true;
 }
 completeStation(key,result){
  if(!this.recordStation(key,result))return;
  this.go(this.run.scene);
 }
 enterStation(key){
  if(this.run.order[this.run.cursor]!==key)return;
  if(key==='blocks'){
   if(!this.run.drafts.blocks)this.run.drafts.blocks=newBlocks();this.go('blocksBrief');
  }else if(key==='fighter')this.go(this.run.drafts.flight?'fighter':'fighterSetup');
  else this.go('basic');
 }
 blockAction(action,lane){
  if(this.phase!=='blocks'||this.paused)return;
  const s=this.run.drafts.blocks,q=this.run.blocks[s.index];let reason='';
  if(this.blockPreviewUntil&&performance.now()<this.blockPreviewUntil)return;
  if(action==='left')moveBlock(s,-1);if(action==='right')moveBlock(s,1);if(action==='rotate')rotateBlock(s);
  if(action==='drop'||action==='lane'&&this.tier===1){
   const result=action==='lane'?dropBlockInLane(s,q,lane):dropBlock(s,q);if(!result.accepted)reason=result.reason;
   else if(result.done){this.completeStation('blocks',{pass:s.answers.every(a=>a.pass),pieces:structuredClone(s.answers),lines:s.lines});return;}
  }
  if((action==='drop'||action==='lane')&&!reason){this.blockPreviewUntil=performance.now()+500;const next=this.root.querySelector('.advBlockPrompt');next?.classList.remove('advNextPreview');void next?.offsetWidth;next?.classList.add('advNextPreview');}
  this.world.blocks(s,this.run.blocks[s.index]);this.store();
  const prompt=this.root.querySelector('.advBlockPrompt');if(prompt)prompt.textContent=this.run.blocks[s.index].code;
  this.root.querySelectorAll('.advLaneChoice').forEach((b,i)=>{b.textContent=String(this.run.blocks[s.index].lanes[i]);b.setAttribute('aria-label',`投放到${['左','中','右'][i]}侧仓道：${b.textContent}`);});
  if(reason){this.hint.textContent=reason;this.hint.hidden=false;clearTimeout(this.hintTimer);this.hintTimer=setTimeout(()=>{if(this.hint)this.hint.hidden=true;},2400);}
 }
 launch(){
  const task=this.run.fighter,config=this.run.drafts.config;
  if(!config||!(task.lv===3?['op','end','step']:task.lv===2?['kind','join','aggregate']:['kind','join','shield']).every(k=>config[k]!==undefined&&config[k]!==''))return;
  if(!this.run.drafts.flight)this.run.drafts.flight=newFlight(task,config);
  this.go('fighter');
 }
 overlay(title,copy){
  const shade=el('div',undefined,'examTaskShade advShade'),panel=el('section',undefined,'examTask advBrief');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
  const h=el('h2',title);h.tabIndex=-1;panel.append(h);if(copy)panel.append(el('p',copy));shade.append(panel);this.root.append(shade);
  panel.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const controls=[...panel.querySelectorAll('button:not(:disabled),select')],first=controls[0],last=controls.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===h)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}});
  const guide=this.paused?(this.phase==='blocks'?'advBlocks':'advFlight'):({intro:'advIntro',basic:'advBasic',blocksBrief:'advBlocks',fighterSetup:'advSetup'})[this.phase];
  if(guide)this.voiceGuide=mountGuide(panel,[guide],{title:'操作提示 · 可以听一遍'});
  return panel;
 }
 select(panel,label,key,options){
  const wrap=el('label',undefined,'advSelect'),name=el('span',label),select=el('select');select.dataset.field=key;select.setAttribute('aria-label',label);
  const blank=el('option','请选择');blank.value='';select.append(blank);for(const [value,text] of options){const o=el('option',text);o.value=value;select.append(o);}
  select.value=this.run.drafts.config[key]??'';select.onchange=()=>{this.run.drafts.config[key]=select.value;this.store();const fields=this.run.fighter.lv===3?['op','end','step']:this.run.fighter.lv===2?['kind','join','aggregate']:['kind','join','shield'];this.root.querySelector('.advLaunch').disabled=!fields.every(k=>this.run.drafts.config[k]!==undefined&&this.run.drafts.config[k]!=='');};wrap.append(name,select);panel.append(wrap);
 }
 syncMusic(){
  if(!this.adventureReady)return;
  const reading=this.classic||['intro','basic','blocksBrief','fighterSetup','result'].includes(this.phase);
  campusMusic.duck('reading',reading);
  campusMusic.setPaused('adventure',!this.classic&&this.paused);
  const finished=this.run?.finished&&adventureScore(this.run)>0;
  const scene=this.classic?'reading':this.phase==='blocks'?'adventure-blocks':this.phase==='fighter'?'adventure-fighter':finished&&['complete','result'].includes(this.phase)?'celebration':'adventure';
  campusMusic.setScene(scene,{immediate:true});
 }
 render(){
  this.voiceGuide?.dispose();this.voiceGuide=null;
  this.syncMusic();
  if(!this.adventureReady||this.classic){
   this.root?.classList.remove('advRoot');super.render();if(this.adventureReady&&this.phase==='result')this.button('进入基地冒险',()=>this.selectMode(false),'advSwitch',this.root.querySelector('.examResults'));return;
  }
  this.root.replaceChildren();this.root.classList.add('advRoot');this.root.dataset.phase=this.phase;
  const scene=el('div',undefined,'examScene');this.viewport=el('div',undefined,'examViewport advViewport');this.viewport.append(this.renderer.domElement);scene.append(this.viewport);this.root.append(scene);
  const a=this.run;
  if(['blocks','blocksBrief'].includes(this.phase))this.world.blocks(a.drafts.blocks,a.blocks[a.drafts.blocks.index]);
  else if(this.phase==='fighter')this.world.flight(a.drafts.flight,a.fighter);
  else if(this.phase==='fighterSetup')this.world.beginFlight();
  else this.world.map(a,this.phase==='home');
  if(this.phase==='home'){
   this.renderHome();
  }else if(this.phase==='result')this.results();
  else if(this.phase==='complete'){
   const menu=el('nav',undefined,'examMenu');this.button('退出',()=>this.exit(),'examPrimary examExit',menu);this.root.append(menu);
  }else{
   this.button('退出',()=>this.exit(),'examExit examCorner');
   if(this.phase==='intro'){
    const p=this.overlay('浮空基地失联','我是领航员小弧。信号、能源和巡检系统需要你来接管。沿发光航标出发，每座设施都藏着一项知识挑战。');this.button('出发',()=>this.go('map'),'examPrimary advDepart',p);
   }else if(this.phase==='map'){
    for(const [i,key] of a.order.entries()){const b=this.button(`${i+1} · ${{basic:'⌁',blocks:'▦',fighter:'✈'}[key]}`,()=>this.enterStation(key),'advMapNode');b.dataset.node=key;b.setAttribute('aria-label',`第${i+1}站：进入${NAMES[key]}`);b.disabled=a.order[a.cursor]!==key;b.classList.toggle('done',!!a.answers[key]);b.classList.toggle('active',!b.disabled);}
   }else if(this.phase==='basic'){
    const q=a.basic,p=this.overlay(q.title,q.prompt);p.append(el('pre',q.code,'examCode'));const choices=el('div',undefined,'examChoices');p.append(choices);
    q.opts.forEach((text,i)=>{const b=this.button(text,()=>{a.drafts.basic=i;for(const [j,c] of [...choices.children].entries()){c.classList.toggle('picked',i===j);c.setAttribute('aria-pressed',String(i===j));}submit.disabled=false;this.store();},'examChoice',choices);b.classList.toggle('picked',a.drafts.basic===i);b.setAttribute('aria-pressed',String(a.drafts.basic===i));});
    const submit=this.button('发送指令',()=>{
      const first=a.drafts.basic;if(!Number.isInteger(first))return;
      if(p.dataset.feedback)return;
      const pass=first===q.a;
      p.dataset.feedback='1';
      // 即时反馈（老师反馈"做对做错没提示"）：提交后先亮对错与解析，确认再继续。
      // 首答在发送瞬间已持久化：此刻刷新/退出/换标签页都会保留原首答（E05）。
      this.recordStation('basic',{first,pass});
      submit.disabled=true;choices.querySelectorAll('button').forEach(b=>b.disabled=true);
      const fb=el('div',undefined,'advInstantFeedback '+(pass?'ok':'no'));
      fb.append(el('strong',pass?'✓ 回答正确':'✕ 这次的答案不对'),el('p',q.ex,'ex'));
      const next=this.button(pass?'继续下一站':'看过了，继续',()=>this.go(a.scene),'examPrimary',fb);
      p.append(fb);next.focus();
    },'examPrimary advBasicSubmit',p);submit.disabled=!Number.isInteger(a.drafts.basic);
   }else if(this.phase==='blocksBrief'){
    const p=this.overlay('能源桥 · 知识方块','计算当前指令的结果，将整块移到对应数字的仓道，再确认落下。满行会消除。方块落地后等待你确认，不会因为思考慢而扣知识分。');
    let seenTour=false;try{seenTour=!!localStorage.getItem('campus.adventure.blocksTour.v1');}catch{}
    if(!seenTour){ // 首次进站的新手引导（老师反馈"积木要干嘛都不知道"），看过一次不再打扰
      const tour=el('div',undefined,'advBlocksTour');tour.append(el('strong','这关在玩什么 · 三步看懂'));
      const ol=el('ol');['上方有一条算式（例如 100 // 13）——先算出它的答案。','落下的方块上写着一个数字——把它送进「和答案数字相同」的那条仓道。','三条仓道里有两个是干扰数字（比正确答案大 1 或小 1），算错了就会投错。'].forEach(t=>ol.append(el('li',t)));
      tour.append(ol,el('p','算式怎么算，方块就进哪条道——这不是猜数字。','examHint'));p.append(tour);
    }
    p.append(el('p','← → 移动 · ↑ 旋转 · 空格落下；手机使用底部按钮。四块全部放对即可完成校准。','examHint'));this.button('进入能源桥',()=>{try{localStorage.setItem('campus.adventure.blocksTour.v1','1');}catch{}this.go('blocks');},'examPrimary advBeginBlocks',p);
    if(this.tier===1)p.append(el('p','一级简便操作：直接点击仓道数字即可投放，不用先移动方块。选错数字仍计入首次方案；对齐耗时不计知识分。','examHint'));
   }else if(this.phase==='blocks'){
    this.viewport.tabIndex=-1;this.viewport.setAttribute('role','group');this.viewport.setAttribute('aria-label','方块操作区：方向键移动或旋转，空格落下');
    this.root.append(el('pre',a.blocks[a.drafts.blocks.index].code,'advBlockPrompt'));
    if(this.tier===1){
      const assist=el('div',undefined,'advLaneAssist');assist.append(el('span','算出结果 → 点击数字投放（一级）'));
      const lanes=el('div');a.blocks[a.drafts.blocks.index].lanes.forEach((value,i)=>{const b=this.button(String(value),()=>this.blockAction('lane',i),'advLaneChoice',lanes);b.setAttribute('aria-label',`投放到${['左','中','右'][i]}侧仓道：${value}`);});assist.append(lanes);this.root.append(assist);
    }
    const bar=el('div',undefined,'advBlockControls');for(const [action,label,title] of [['left','←','向左移动'],['rotate','↻','旋转方块'],['right','→','向右移动'],['drop','↓','确认落下']]){const b=this.button(label,e=>{this.blockAction(action);if(e.detail>0&&this.phase==='blocks')this.viewport.focus({preventScroll:true});},'advBlockAction',bar);b.dataset.action=action;b.setAttribute('aria-label',title);}
    this.root.append(bar);this.button('?',()=>{this.paused=true;this.held.clear();this.render();},'advHelp').setAttribute('aria-label','暂停与任务说明');
   }else if(this.phase==='fighterSetup'){
    const task=a.fighter,p=this.overlay(task.title,task.goal);a.drafts.config??={};
    if(task.lv===3){
     p.append(el('pre','i = 0\nwhile i ? 目标值:\n    fire()\n    i ?= 1','examCode'));
     this.select(p,'循环条件','op',[['<','小于 <'],['<=','小于等于 <=']]);this.select(p,'目标值','end',[[task.end-1,String(task.end-1)],[task.end,String(task.end)],[task.end+1,String(task.end+1)]]);this.select(p,'每轮更新','step',[['1','i += 1'],['-1','i -= 1']]);
    }else{
     this.select(p,'目标状态','kind',[['enemy','故障设备'],['transport','正常设备']]);this.select(p,'条件关系','join',[['and','并且 and'],['or','或者 or']]);
     if(task.lv===1)this.select(p,'护盾状态','shield',[['1','有护盾'],['0','无护盾']]);else this.select(p,'能量条件','aggregate',[['sum','等于总和 sum'],['min','等于最小值 min'],['max','等于最大值 max']]);
    }
    p.append(el('p','起飞后规则锁定。拖动巡检机或用方向键飞行，系统按你的规则自动发射校准脉冲。躲避橙色干扰弹，金色是正常设备，不要误触；飞行表现与知识分分开。','examHint'));
    const launch=this.button('起飞',()=>this.launch(),'examPrimary advLaunch',p);const fields=task.lv===3?['op','end','step']:task.lv===2?['kind','join','aggregate']:['kind','join','shield'];launch.disabled=!fields.every(k=>a.drafts.config[k]!==undefined&&a.drafts.config[k]!=='');
   }else if(this.phase==='fighter'){
    this.root.append(el('p','躲避、撞击和标记数量不影响知识分；知识分只看本次规则。','advFlightScoreNote'));
    this.button('Ⅱ',()=>{this.paused=true;this.held.clear();this.render();},'advHelp').setAttribute('aria-label','暂停飞行');
    const input=el('div',undefined,'advFlightInput');input.setAttribute('aria-label','拖动驾驶巡检机');
    const move=e=>{if(this.paused||e.buttons===0&&e.type==='pointermove')return;const point=this.world.point(e.clientX,e.clientY,input.getBoundingClientRect());if(point){a.drafts.flight.player.x=Math.max(-4.6,Math.min(4.6,point.x));a.drafts.flight.player.y=Math.max(7,Math.min(14,point.y));}};
    input.onpointerdown=e=>{input.setPointerCapture(e.pointerId);move(e);};input.onpointermove=move;input.onpointerup=()=>this.store();input.onpointercancel=()=>{this.held.clear();this.store();};this.root.prepend(input);
   }
   if(this.paused){
    const p=this.overlay('暂歇一下',this.phase==='blocks'?'把方块放入结果对应的数字仓道；可以移动、旋转，再确认落下。':'方向键或拖动巡检机飞行。青色脉冲是检修信号，橙色干扰弹需要避开。');
    if(this.phase==='blocks')p.append(el('pre',a.blocks[a.drafts.blocks.index].code,'examCode'),el('p','从左到右的仓道数字：'+a.blocks[a.drafts.blocks.index].lanes.join('、')));
    this.button('继续',()=>{this.paused=false;this.lastFrame=0;this.render();},'examPrimary advContinue',p);this.button('退出',()=>this.exit(),'advPauseExit',p);
   }
  }
  this.hint=el('p','', 'advHint');this.hint.hidden=true;this.hint.setAttribute('role','status');this.root.append(this.hint);
  this.status=el('p',this.error,'examSaveStatus');this.status.setAttribute('role','alert');this.status.hidden=!this.error;(this.root.querySelector('.examLobby,.examResults')||this.root).append(this.status);
  if(this.error)this.button('重试保存',()=>{if(this.store())this.render();},'examSaveRetry',this.status.parentElement);
 }
 results(){
  const a=this.run,p=el('section',undefined,'examResults');const h=el('h1','冒险记录');h.tabIndex=-1;p.append(h,el('p',`${this.lv}09 · ${DIFFICULTIES[this.tier-1]} · 浮空基地救援`,'examResultMeta'));
  if(a){
   const n=Object.keys(a.answers).length;
   if(a.finished){const stamp=el('div',undefined,'examStamp');stamp.append(el('strong',`${adventureScore(a)} / 3`),el('span','本场知识任务 · 首次方案'));p.append(stamp);}
   else p.append(el('p',`冒险未完成 · 已处理 ${n} / 3 座设施。进度已保留。`,'examPartial'));
   const review=el('details',undefined,'examReview');review.append(el('summary','查看知识记录与飞行表现'));
   for(const key of a.order){
    const answer=a.answers[key];if(!answer)continue;const item=el('article');item.append(el('h2',`${NAMES[key]} · ${answer.pass?'校准完成':'需要复习'}`));
    if(key==='basic'){
     item.append(el('p',a.basic.prompt),el('pre',a.basic.code,'examCode'),el('p',`你的选择：${a.basic.opts[answer.first]}`),el('p',a.basic.ex));
     if(!answer.pass){
      const correction=el('details',undefined,'examCorrection'),title=el('summary',answer.corrected?'已纠正 · 首答分不变':'练习纠正'),feedback=el('p','选择正确方案练习，原首答和知识分保留。');feedback.setAttribute('role','status');correction.append(title);
      a.basic.opts.forEach((text,i)=>this.button(text,()=>{if(i===a.basic.a){answer.corrected=true;this.store();}feedback.textContent=i===a.basic.a?'已纠正 · 首答分不变':'再对照代码和解析想一想。';title.textContent=answer.corrected?'已纠正 · 首答分不变':'练习纠正';},'examCorrectionChoice',correction));
      correction.append(feedback);item.append(correction);
     }
    }
    else if(key==='blocks'){answer.pieces.forEach((v,i)=>item.append(el('p',`${v.pass?'✓':'×'} ${v.code.replaceAll('\n',' ')} → 你放入 ${v.picked}，正确结果 ${v.expected}。${a.blocks[i].ex}`)));item.append(el('p',`操作表现：消除 ${answer.lines} 行。消行和对齐耗时不计知识分；知识分只看四次首次投放的数字是否正确。`));}
    else item.append(el('p',answer.judgment.ex),el('p',`飞行表现：标记故障设备 ${answer.flight.hits}，误触正常设备 ${answer.flight.friendlyHits}，打到防护罩 ${answer.flight.blocked}，受到撞击 ${answer.flight.damage}。这些操作记录不加减知识分。`));
    review.append(item);
   }
   if(n)p.append(review);this.button(a.finished?'保留记录重考':'继续游戏',()=>this.start(!!a.finished),'examPrimary '+(a.finished?'examRestart':'examResume'),p);
  }else p.append(el('p','尚未开始，没有本场成绩。'));
  const settings=el('details',undefined,'examSettings');settings.append(el('summary','冒险难度与经典考核'));const row=el('div',undefined,'examLevels');
  DIFFICULTIES.forEach((text,i)=>{const b=this.button(text,()=>this.setAdventureTier(i+1),i+1===this.tier?'selected':'',row);b.setAttribute('aria-pressed',String(i+1===this.tier));});settings.append(row);
  const best=this.save.examBest[this.adventureKey];if(best!==undefined)settings.append(el('p',`本级冒险最高 ${best} / 3`));
  settings.append(el('p','基础、能源桥、巡检各占 1 分。能源桥四块均正确、巡检规则通过全部目标核验，才获得对应知识分。旧考核成绩单独保留。','examHint'));
  this.button('进入经典考核与体育实测',()=>this.selectMode(true),'advClassic',settings);p.append(settings);
  if(this.save.quiz[this.lv]>=0&&!this.save.submitted[this.lv])this.button('向'+this.teacher+'提交作业',()=>{if(this.store()){this.onSubmit();this.render();}},'teacherSubmit',p);
  if(this.save.submitted[this.lv])p.append(el('p','已向老师提交','submitted'));
  this.button('返回开始页',()=>{this.phase='home';this.render();},'examHome',p);this.button('返回教室',()=>this.close(),'examClose',p);this.root.append(p);
 }
 render3D(){
  if(!this.adventureReady||this.classic)return super.render3D();
  const now=performance.now(),dt=this.lastFrame?Math.min(.05,(now-this.lastFrame)/1000):0;this.lastFrame=now;
  if(!this.paused&&!document.hidden&&this.run){
   if(this.phase==='blocks'&&!(this.blockPreviewUntil&&now<this.blockPreviewUntil)){tickBlocks(this.run.drafts.blocks,dt);this.world.blocks(this.run.drafts.blocks,this.run.blocks[this.run.drafts.blocks.index]);}
   if(this.phase==='fighter'){
    const s=this.run.drafts.flight,input={x:(this.held.has('KeyD')||this.held.has('ArrowRight')?1:0)-(this.held.has('KeyA')||this.held.has('ArrowLeft')?1:0),y:(this.held.has('KeyS')||this.held.has('ArrowDown')?1:0)-(this.held.has('KeyW')||this.held.has('ArrowUp')?1:0)};
    tickFlight(s,this.run.fighter,dt,input);this.world.flight(s,this.run.fighter);
    if(s.done){const judgment=judgeFighter(this.run.fighter,s.config);this.completeStation('fighter',{pass:judgment.pass,judgment,config:s.config,flight:{hits:s.hits,friendlyHits:s.friendlyHits,blocked:s.blocked,damage:s.damage}});}
   }
   if(['blocks','fighter'].includes(this.phase)){this.saveClock+=dt;if(this.saveClock>2){this.saveClock=0;this.store();}}
  }
  this.world.render(this.renderer,this.viewport);
  if(this.phase==='map')for(const b of this.root.querySelectorAll('.advMapNode')){const pos=this.world.project(b.dataset.node);b.style.left=pos.x*100+'%';b.style.top=pos.y*100+'%';}
 }
 state(){if(!this.adventureReady||this.classic)return {...super.state(),mode:'classic'};return {lv:this.lv,tier:this.tier,phase:this.phase,mode:'adventure',paused:this.paused,id:this.run?.id,order:this.run?.order,cursor:this.run?.cursor,score:this.run?adventureScore(this.run):null,blocks:this.run?.drafts.blocks?{index:this.run.drafts.blocks.index,x:this.run.drafts.blocks.x,y:this.run.drafts.blocks.y,lines:this.run.drafts.blocks.lines}:null,flight:this.run?.drafts.flight?{time:this.run.drafts.flight.time,player:{...this.run.drafts.flight.player},hits:this.run.drafts.flight.hits,damage:this.run.drafts.flight.damage}:null};}
 dispose(){campusMusic.setPaused('adventure',false);campusMusic.duck('reading',true);campusMusic.setScene('reading',{immediate:true});window.removeEventListener('keyup',this.keyUp);window.removeEventListener('blur',this.onHidden);document.removeEventListener('visibilitychange',this.visibility);clearTimeout(this.hintTimer);this.held?.clear();this.world?.dispose();super.dispose();}
}
