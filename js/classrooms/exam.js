import {archiveAttempt} from '../replay_store.js';
import {mountGuide,examGuideId} from './voice_guide.js';
import {EXAM_SPORTS,DIFFICULTIES,createMission,getMission,missionURL,sportSummary} from '../sports_exam.js';
import {questions} from './exam_data.js';
import {drawAttempt,answerFirst,correctAttempt,gradeAttemptV2,isCorrect,validAttemptV2 as validAttempt,outputMatches,gradeExamCode,ATTEMPT_SIZE} from './question_bank.js';
import {classicBestByVer} from './progress.js';
import {runExamCode,fullwidthHint} from './exam_py.js';
import {ExamModels} from './exam_models.js';

const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
export class ExamRoom {
  constructor({host,renderer,environment,lv,save,persist,record,onClose,onSubmit,teacher}){
    Object.assign(this,{host,renderer,lv,save,persist,record,onClose,onSubmit,teacher});
    for(const k of ['exams','examBest','examBestTotal','examBestByVer','examFullMark','examMissions','examTier','examDrafts'])if(!save[k]||typeof save[k]!=='object'||Array.isArray(save[k]))save[k]={};
    this.pruneDrafts();
    const query=new URLSearchParams(location.search);
    this.tier=Number(query.get('exam'))===lv?Number(query.get('difficulty')):save.examTier[lv];
    if(![1,2,3].includes(this.tier))this.tier=1;
    this.phase='home';this.selected=null;this.taskOpen=false;this.error='';this.codeDrafts={};
    this.root=node('div',undefined,'examRoot exam-'+lv);host.append(this.root);host.classList.add('exam-mode');document.body.classList.add('examActive');
    this.model=new ExamModels(lv,environment);this.originalStyle=renderer.domElement.getAttribute('style');
    // Capture before the classroom handler: Escape must not bypass the record screen.
    this.onKey=e=>{
      if(e.code!=='Escape')return;
      e.preventDefault();e.stopImmediatePropagation();
      if(e.repeat)return;
      if(this.taskOpen){this.taskOpen=false;this.render();this.root.querySelector('.examTaskOpen')?.focus();}
      else if(this.phase==='result')this.close();
      else this.exit();
    };
    window.addEventListener('keydown',this.onKey,true);
    this.loadTier();this.render();
  }
  get key(){return `${this.lv}:${this.tier}`;}
  loadTier(){
    this.mission=getMission(this.save.examMissions[this.key]);
    this.attempt=this.save.exams[this.key];if(!validAttempt(this.attempt))this.attempt=null;
    this.save.examTier[this.lv]=this.tier;
    if(!this.persist())this.error='记录未保存成功，请重试；离开或刷新可能丢失进度。';
  }
  button(label,fn,cls='',parent=this.root){
    const b=node('button',label,cls);b.type='button';b.onclick=fn;parent.append(b);return b;
  }
  message(text){
    this.error=text;
    if(this.status){
      this.status.textContent=text;this.status.hidden=!text;
      const retry=this.root.querySelector('.examSaveRetry');
      if(!text)retry?.remove();
      else if(!retry)this.button('重试保存',()=>{if(this.store())this.render();},'examSaveRetry',this.status.parentElement);
    }
  }
  store(){
    if(this.attempt)this.save.exams[this.key]=this.attempt;
    const ok=this.persist();
    this.message(ok?'':'记录未保存成功，请重试；离开或刷新可能丢失进度。');
    return ok;
  }
  // 考试草稿：按场次 id + 题号存进存档并防抖持久化——未提交时刷新/离开，代码不再回模板（流程优化）。
  pruneDrafts(){
    const drafts=this.save.examDrafts;if(!drafts||typeof drafts!=='object')return;
    const alive=new Set([...Object.values(this.save.exams||{}),...(Array.isArray(this.save.examHistory)?this.save.examHistory.map(v=>v.attempt):[])].filter(Boolean).map(a=>a.id).filter(Boolean));
    for(const id of Object.keys(drafts))if(!alive.has(id))delete drafts[id];
  }
  draftOf(slot,fallback){
    const id=this.attempt?.id;
    return this.codeDrafts[slot]??this.save.examDrafts?.[id]?.[slot]??fallback;
  }
  setDraft(slot,value){
    this.codeDrafts[slot]=value;
    const id=this.attempt?.id;if(!id)return;
    ((this.save.examDrafts??={})[id]??={})[slot]=value;
    clearTimeout(this.draftTimer);this.draftTimer=setTimeout(()=>{this.draftTimer=null;this.persist();},700);
  }
  start(fresh=false){
    if(fresh||!this.attempt||this.attempt.finished){
      if(!this.store())return;
      archiveAttempt(this.save,this.key,this.attempt);
      if(this.attempt?.id)delete this.save.examDrafts?.[this.attempt.id]; // 旧场次草稿随归档清理
      if(!this.persist()){this.message('历史记录保存失败，未开始新考核。');return;}
      const result=this.mission?.status==='complete'?this.mission.result:null;
      // 每场从"当日题库"随机抽 4 题：同一天重考换题不换库，第二天自动换库。
      const drawn=drawAttempt(this.lv,this.tier,result,Math.random,undefined,new Set(Object.keys(this.save.tasks||{})));
      this.attempt={version:2,id:crypto.randomUUID(),questions:drawn.questions,dailyKey:drawn.dailyKey,source:result?'本人实测':'课堂示例',missionId:result?this.mission.id:null,sport:result?structuredClone(result):null,answers:[],index:0,started:Date.now()};
      this.codeDrafts={};
    }
    this.phase='question';this.selected=null;this.taskOpen=false;this.render();this.store();
    // 中途刷新保护：场次进行中把恢复参数写进 URL，刷新后直接回考核室（main.js resumeExam 分支）
    const u=new URL(location.href);u.searchParams.set('resumeExam','1');u.searchParams.set('exam',String(this.lv));history.replaceState(null,'',u);
  }
  exit(){
    this.taskOpen=false;this.phase='result';this.render();this.store();
    this.root.querySelector('.examResults h1')?.focus();
  }
  close(){if(this.store())this.onClose();}
  depart(){
    if(!this.store())return;
    try{
      const m=createMission(this.lv,this.tier);this.save.examMissions[this.key]=m.id;
      if(!this.persist())throw Error('无法保存考核室返回记录');
      location.href=missionURL(m);
    }catch(e){this.message('暂时无法开始实测：'+e.message);}
  }
  answer(payload){
    if(this.phase!=='question'||this.attempt.answers[this.attempt.index])return;
    if(!answerFirst(this.attempt,this.attempt.index,payload))return;
    this.selected=null;this.taskOpen=false;
    if(this.attempt.index===this.attempt.questions.length-1)this.finish();
    else{this.render();this.store();this.root.querySelector('.examNext')?.focus();}
  }
  finish(){
    if(!this.attempt.questions.every((_,i)=>this.attempt.answers[i]))return;
    if(!this.attempt.finished){
      this.attempt.finished=Date.now();const score=gradeAttemptV2(this.attempt),total=this.attempt.questions.length;
      this.save.quiz[this.lv]=Math.max(Number(this.save.quiz[this.lv])||0,score);
      const prev=Number(this.save.examBest[this.key])||0;
      // legacy 字段成对推进（新高分才动），避免旧3/3 + 新2/4 拼出 3/4；正式展示走 examBestByVer。
      if(score>prev){this.save.examBest[this.key]=score;this.save.examBestTotal[this.key]=total;}
      // 版本化最高记录（R04）：旧3题卷与现行4题卷各自的 score/total 绑定保存。
      const version=this.attempt.version===1?1:2,byVer=classicBestByVer(this.save,this.key),rec=byVer['v'+version];
      this.save.examBestByVer[this.key]={...byVer,['v'+version]:{score:Math.max(rec?.score??-1,score),total}};
      if(score===total)this.save.examFullMark[this.key]=true;
      this.record('exam',{lv:this.lv,tier:this.tier,score,source:this.attempt.source,missionId:this.attempt.missionId});
    }
    // Completing the scene does not expose scores; only the player's exit does.
    this.phase='complete';this.taskOpen=false;this.render();this.store();
    // 完成后不再需要刷新恢复，摘掉参数避免下次打开直接进考场
    const u=new URL(location.href);if(u.searchParams.has('resumeExam')){u.searchParams.delete('resumeExam');history.replaceState(null,'',u);}
    this.root.querySelector('.examExit')?.focus();
  }
  next(){
    if(!this.attempt.answers[this.attempt.index])return;
    if(this.attempt.index===this.attempt.questions.length-1){this.finish();return;}
    this.attempt.index++;this.selected=null;this.taskOpen=false;this.phase='question';this.render();this.store();
    this.root.querySelector('.examTaskOpen')?.focus();
  }
  setTier(tier){
    if(!this.store())return;
    this.tier=tier;this.selected=null;this.taskOpen=false;
    const url=new URL(location.href);url.searchParams.set('difficulty',tier);url.searchParams.set('exam',this.lv);history.replaceState(null,'',url);
    this.loadTier();this.render();
  }
  renderHome(){
    const classic=this.classic!==false,attempt=classic?this.attempt:this.run;
    const panel=node('section',undefined,'examLobby');panel.setAttribute('aria-label','选择考核难度');
    // 2026-10-17 老师修改意见（C1）：基地冒险模式（信号台/能源桥/飞机巡检小游戏）已下线，考核只保留经典形式。
    panel.append(node('small',`${this.lv}09 · ${['运算','数据','循环'][this.lv-1]}考核室`),node('h1','经典考核'),node('p','独立答 4 道题：选择、判断、填空、上机编程随机抽取，每天换一批新题；也可先体育实测，再用自己的数据答题。完成本场后，可向老师提交。','examHint'));
    panel.append(node('p','想用真实成绩答题？先去体育场馆做一次实测，考核题目就会代入你自己的数据；不测也能用课堂示例作答。','examAppliedPath'));
    panel.append(node('h2','选择难度'));
    const levels=node('div',undefined,'examLevels');levels.setAttribute('aria-label','考核难度');
    DIFFICULTIES.forEach((name,i)=>{const b=this.button(`${i+1} 级 · ${name}`,()=>classic?this.setTier(i+1):this.setAdventureTier(i+1),this.tier===i+1?'selected':'',levels);b.setAttribute('aria-pressed',String(this.tier===i+1));});panel.append(levels);
    panel.append(node('p',`当前：经典考核 · ${this.tier} 级 ${DIFFICULTIES[this.tier-1]} · ${attempt&&!attempt.finished?attempt.source:this.mission?.status==='complete'?'本人实测':'课堂示例'}`,'examCurrent'));
    const ongoing=attempt&&!attempt.finished;
    panel.append(node('p',ongoing?`本场已完成 ${classic?attempt.answers.filter(Boolean).length:Object.keys(attempt.answers).length} / ${classic?(attempt.questions?.length||ATTEMPT_SIZE):3} 项，继续时保留首答。`:attempt?.finished?'本级已有成绩；再次开始会保留旧场记录，最高分不降低。':'尚未开始；可以先调整形式和难度。','examHint'));
    this.button(ongoing?'继续本场考核':'开始本场考核',()=>this.start(),'examPrimary examStart',panel);
    if(classic){
      const cfg=EXAM_SPORTS[this.lv];panel.append(node('p',sportSummary(this.mission),'examSportRecord'));
      this.button('前往'+cfg.name+'实测',()=>this.depart(),'sportLaunch',panel);
      panel.append(node('p','实测可选。成绩回流后开始新一场经典考核；进行中的题目保持原数据。','examHint'));
    }
    this.button('查看记录 / 退出',()=>this.exit(),'examExit',panel);this.root.append(panel);
  }
  render(){
    this.voiceGuide?.dispose();this.voiceGuide=null;
    const a=this.attempt,q=this.phase==='home'?questions(this.lv,this.tier)[0]:a?.questions[a.index]||questions(this.lv,this.tier)[0];
    this.root.replaceChildren();this.root.dataset.phase=this.phase;
    const backdrop=node('div',undefined,'examScene');
    this.viewport=node('div',undefined,'examViewport');this.viewport.setAttribute('aria-label','考核场景');
    backdrop.append(this.viewport);this.viewport.append(this.renderer.domElement);this.root.append(backdrop);
    const revealed=this.phase!=='home'&&!!a?.answers[a.index];
    this.model.show(q,revealed);this.model.setImmersive(this.phase==='home'||this.phase==='complete');
    if(this.phase==='home'){
      this.renderHome();
    }else if(this.phase==='question'){
      this.button('退出',()=>this.exit(),'examExit examCorner');
      const controls=node('div',undefined,'examSceneActions');
      if(a.answers[a.index]){
        this.button('继续',()=>this.next(),'examPrimary examNext',controls);
        this.button('▶',()=>this.model.step(),'examStep',controls).setAttribute('aria-label','单步观察场景');
      }else{
        this.button('查看任务',()=>{this.taskOpen=true;this.render();this.root.querySelector('.examTask h2')?.focus();},'examPrimary examTaskOpen',controls);
      }
      this.root.append(controls);
      if(this.taskOpen)this.renderTask(q);
    }else if(this.phase==='complete'){
      const menu=node('nav',undefined,'examMenu');
      this.button('退出',()=>this.exit(),'examPrimary examExit',menu);this.root.append(menu);
    }else this.renderResults();
    this.status=node('p',this.error,'examSaveStatus');this.status.setAttribute('role','alert');this.status.hidden=!this.error;(this.root.querySelector('.examLobby,.examResults')||this.root).append(this.status);
    if(this.error)this.button('重试保存',()=>{if(this.store())this.render();},'examSaveRetry',this.status.parentElement);
  }
  renderTask(q){
    const overlay=node('div',undefined,'examTaskShade'),panel=node('section',undefined,'examTask');
    panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','exam-task-title');
    const close=this.button('×',()=>{this.taskOpen=false;this.render();this.root.querySelector('.examTaskOpen')?.focus();},'examTaskClose',panel);close.setAttribute('aria-label','收起任务');
    const title=node('h2',q.title);title.id='exam-task-title';title.tabIndex=-1;panel.append(title);
    const qt=q.type||'choice';
    if(qt==='code')panel.append(node('p',q.task,'examHint'));
    else panel.append(node('pre',q.code,'examCode'));
    if(qt!=='code'&&qt!=='blank'&&q.opts.some(text=>/\d\.\d{7,}/.test(text)))panel.append(node('p','长小数是 Python 直接输出的精度，不需要手算全部位数；先判断运算和数量级。只有题目明确使用 round 时才按要求舍入。','examHint examFloatNote'));
    const gid=examGuideId(q);
    if(gid)this.voiceGuide=mountGuide(panel,[gid],{title:'读题与操作提示'});
    if(qt==='code')this.renderCodeTask(q,panel);
    else if(qt==='blank')this.renderBlankTask(q,panel);
    else{
      const choices=node('div',undefined,'examChoices');panel.append(choices);
      q.opts.forEach((text,i)=>{
        const b=this.button(text,()=>{
          this.selected=i;
          for(const [j,c] of [...choices.children].entries()){c.classList.toggle('picked',j===i);c.setAttribute('aria-pressed',String(j===i));}
          submit.disabled=false;
        },'examChoice',choices);
        b.dataset.option=String(i);b.classList.toggle('picked',this.selected===i);b.setAttribute('aria-pressed',String(this.selected===i));
      });
      const submit=this.button('提交',()=>this.answer(this.selected),'examPrimary examAnswer',panel);submit.disabled=this.selected===null;
    }
    // Keep Tab inside the task; the background exit cannot receive accidental input.
    panel.addEventListener('keydown',e=>{
      if(e.key!=='Tab')return;
      const focusables=[...panel.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea,select')],first=focusables[0],last=focusables.at(-1);
      if(e.shiftKey&&(document.activeElement===first||document.activeElement===title)){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    });
    overlay.append(panel);this.root.append(overlay);
  }
  renderBlankTask(q,panel){
    const wrap=node('label',undefined,'examBlankWrap');
    wrap.append(node('span','把答案填进输入框','examBlankLabel'));
    const input=document.createElement('input');input.className='examBlankInput';input.type='text';input.setAttribute('autocomplete','off');
    input.setAttribute('aria-label','填空答案');
    input.setAttribute('placeholder','只填答案本身，不要带单位（如 次、个）');
    input.value=this.draftOf('blank:'+this.attempt.index,'');
    wrap.append(input);panel.append(wrap);
    const submit=()=>{const text=input.value;if(!text.trim())return;this.answer(text);};
    const go=this.button('提交',submit,'examPrimary examAnswer',panel);go.disabled=!input.value.trim();
    input.oninput=()=>{this.setDraft('blank:'+this.attempt.index,input.value);go.disabled=!input.value.trim();};
    input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();submit();}};
    setTimeout(()=>input.focus(),0);
  }
  renderCodeTask(q,panel){
    // 模拟电脑：显示器外框 + 行号编辑器 + 控制台，像坐在机房电脑前编程。
    const computer=node('div',undefined,'examComputer');
    const bar=node('div',undefined,'examPcBar');
    const dots=node('span',undefined,'examPcDots');
    for(const c of ['#ff5f57','#febc2e','#28c840']){const d=node('i');d.style.background=c;dots.append(d);}
    bar.append(dots,node('span','Python 训练机 · student.py','examPcTitle'));computer.append(bar);
    const wrap=node('div',undefined,'examEditorWrap');
    const gutter=node('div',undefined,'examGutter');gutter.setAttribute('aria-hidden','true');
    const ta=document.createElement('textarea');ta.className='examEditor';ta.spellcheck=false;ta.setAttribute('autocapitalize','off');
    ta.setAttribute('aria-label','代码编辑区：在这里写 Python 代码');
    ta.value=this.draftOf('code:'+this.attempt.index,q.starter);
    const sync=()=>{const lines=ta.value.split('\n').length;gutter.textContent=Array.from({length:Math.max(lines,3)},(_,i)=>i+1).join('\n');gutter.scrollTop=ta.scrollTop;};
    ta.oninput=()=>{this.setDraft('code:'+this.attempt.index,ta.value);sync();};
    ta.onscroll=()=>{gutter.scrollTop=ta.scrollTop;};
    wrap.append(gutter,ta);computer.append(wrap);
    const consoleBox=node('div',undefined,'examConsole');consoleBox.setAttribute('role','status');
    consoleBox.append(node('span','▶ 点「运行」查看输出，可以反复调试；确认后点「提交答案」。','examConsoleHint'));
    computer.append(consoleBox);panel.append(computer);
    const show=(text,cls)=>{consoleBox.replaceChildren(node('pre',text,'examConsoleOut'+(cls?' '+cls:'')));consoleBox.scrollTop=consoleBox.scrollHeight;};
    const actions=node('div',undefined,'examCodeActions');
    const run=this.button('▶ 运行',async()=>{
      if(run.disabled)return;run.disabled=true;run.textContent='运行中…';
      const hint=fullwidthHint(ta.value);
      const result=hint?{ok:false,err:hint}:await runExamCode(ta.value);
      run.disabled=false;run.textContent='▶ 运行';
      show(result.ok?(result.out.trim()||'（没有输出。要用 print 把结果显示出来。）'):'✕ '+(result.err||'运行失败'),result.ok?'ok':'err');
    },'examCodeRun',actions);
    const submit=this.button('提交答案',async()=>{
      if(submit.disabled)return;submit.disabled=true;run.disabled=true;submit.textContent='判分中…';
      if(this.attempt.answers[this.attempt.index]){
        show('这道题的首答已经提交，之后修改不再改变成绩；结算页可以练习纠正。');
        submit.disabled=false;run.disabled=false;submit.textContent='提交答案';return;
      }
      const hint=fullwidthHint(ta.value);
      if(hint){show('✕ '+hint,'err');submit.disabled=false;run.disabled=false;submit.textContent='提交答案';return;}
      const verdict=await gradeExamCode(q,ta.value,runExamCode);
      if(!verdict.ok){
        show('✕ '+(verdict.error||'运行失败')+'\n—— 修改并成功运行后再提交；能运行的提交才算首答。','err');
        submit.disabled=false;run.disabled=false;submit.textContent='提交答案';return;
      }
      const pass=verdict.pass;
      const headline=pass?'已提交：通过 ✓':'已提交：未通过；结算页可练习纠正。';
      show(`${(verdict.out||'').trim()||'（无输出）'}\n—— ${headline}${verdict.message?'\n'+verdict.message:''}`,pass?'ok':'err');
      this.answer({code:ta.value,out:verdict.out||'',ok:true,pass});
    },'examPrimary examAnswer',actions);
    panel.append(actions);sync();setTimeout(()=>ta.focus(),0);
  }
  renderResults(){
    const a=this.attempt,cfg=EXAM_SPORTS[this.lv],panel=node('section',undefined,'examResults');
    const heading=node('h1','经典考核记录');heading.tabIndex=-1;panel.append(heading);
    const count=a?a.answers.filter(Boolean).length:0;
    panel.append(node('p',`${this.lv}09 · ${DIFFICULTIES[this.tier-1]} · ${a?.source||'尚未开始'}`,'examResultMeta'));
    if(a){
      const score=gradeAttemptV2(a);
      if(a.finished){
        const stamp=node('div',undefined,'examStamp');stamp.append(node('strong',`${score} / ${a.questions.length}`),node('span','本次首答成绩'));panel.append(stamp);
      }else panel.append(node('p',`未完成 · 已作答 ${count} / ${a.questions.length} 题，已答对 ${score} 题。尚无本场最终成绩。`,'examPartial'));
      if(count){
        const review=node('details',undefined,'examReview');review.append(node('summary','查看作答与解析'));
        a.questions.forEach((q,i)=>{
          const answer=a.answers[i];if(!answer)return;
          const qt=q.type||'choice',ok=isCorrect(q,answer);
          const item=node('article');item.append(node('h2',q.title));
          const correction=node('details',undefined,'examCorrection');correction.append(node('summary',answer.corrected?'已纠正 · 首答分不变':'练习纠正'));
          const feedback=node('p',answer.corrected?'已经完成纠正，原首答成绩保留。':'按提示再练一次，纠正不会改变首答成绩。');feedback.setAttribute('role','status');
          if(qt==='code'){
            item.append(node('pre',(answer.first?.code||'').trim(),'examCode'));
            item.append(node('p',`${ok?'正确':'需要复习'} · 你的输出：${(answer.first?.out||'').trim()||'（无输出）'}${ok?'':' · 期望输出：'+q.expect.split('\n').join(' / ')}`),node('p',q.ex));
            correction.querySelector('summary').textContent='查看参考解答';
            correction.append(node('pre',q.solve,'examCode'),node('p','对照参考解答修改自己的代码；首答成绩保持不变。'));
          }else if(qt==='blank'){
            item.append(node('p',`${ok?'正确':'需要复习'} · 你填的答案：${answer.first} · 正确答案：${q.answer}`),node('p',q.ex));
            const input=document.createElement('input');input.type='text';input.className='examBlankInput examCorrectionInput';
            input.setAttribute('aria-label','重新填写答案');input.value=answer.first;
            const again=this.button('检查纠正',()=>{const hit=correctAttempt(a,i,input.value);this.store();
              feedback.textContent=hit?'已纠正 · 首答分不变。':'再对照解析想一想。';
              correction.querySelector('summary').textContent=hit?'已纠正 · 首答分不变':'练习纠正';
            },'examCorrectionChoice',correction);
            correction.prepend(input,again);
          }else{
            item.append(node('p',`${ok?'正确':'需要复习'} · 你的选择：${q.opts[answer.first]}`),node('p',q.ex));
            q.opts.forEach((text,choice)=>this.button(text,()=>{
              const hit=correctAttempt(a,i,choice);this.store();
              feedback.textContent=hit?'已纠正 · 首答分不变。':'还需要再想一想。';
              correction.querySelector('summary').textContent=hit?'已纠正 · 首答分不变':'练习纠正';
            },'examCorrectionChoice',correction));
          }
          if(qt==='code')item.append(correction);
          else if(!ok){correction.append(feedback);item.append(correction);}
          review.append(item);
        });panel.append(review);
      }
      if(!a.finished)this.button('继续游戏',()=>this.start(),'examPrimary examResume',panel);
      else this.button('保留记录重考',()=>this.start(true),'examPrimary examRestart',panel);
    }else panel.append(node('p','尚未开始，没有本场成绩。'));
    const settings=node('details',undefined,'examSettings');settings.append(node('summary','难度与体育实测'));
    const levels=node('div',undefined,'examLevels');levels.setAttribute('aria-label','考核难度');
    DIFFICULTIES.forEach((name,i)=>{const b=this.button(name,()=>this.setTier(i+1),this.tier===i+1?'selected':'',levels);b.setAttribute('aria-pressed',String(this.tier===i+1));});
    settings.append(levels,node('p',cfg.lesson));
    settings.append(node('p',sportSummary(this.mission),'examSportRecord'));
    this.button('前往'+cfg.name+'实测',()=>this.depart(),'sportLaunch',settings);
    settings.append(node('p','未实测时采用课堂示例；实测记录会用于新一场游戏的题目。','examHint'));
    const byVer=classicBestByVer(this.save,this.key),bestParts=[];
    if(byVer.v1)bestParts.push(`旧版最高 ${byVer.v1.score} / ${byVer.v1.total}`);
    if(byVer.v2)bestParts.push(`新版最高 ${byVer.v2.score} / ${byVer.v2.total}`);
    if(bestParts.length)settings.append(node('p',`本级历史最高：${bestParts.join('；')}（两版题量不同，各自保留）`,'examBest'));
    panel.append(settings);
    if(this.save.quiz[this.lv]>=0&&!this.save.submitted[this.lv])this.button('向'+this.teacher+'提交作业',()=>{if(this.store()){this.onSubmit();this.render();}},'teacherSubmit',panel);
    if(this.save.submitted[this.lv])panel.append(node('p','已向老师提交','submitted'));
    this.button('返回开始页',()=>{this.phase='home';this.render();},'examHome',panel);
    this.button('返回教室',()=>this.close(),'examClose',panel);
    this.root.append(panel);
  }
  render3D(){this.model.render(this.renderer,this.viewport);}
  state(){return {lv:this.lv,tier:this.tier,phase:this.phase,index:this.attempt?.index,score:this.attempt?gradeAttemptV2(this.attempt):null,source:this.attempt?.source,model:this.model.q?.model,step:this.model.stepIndex,missionId:this.mission?.id};}
  dispose(){
    this.voiceGuide?.dispose();this.voiceGuide=null;
    clearTimeout(this.draftTimer);this.draftTimer=null;this.persist(); // 冲刷未落盘的考试草稿
    window.removeEventListener('keydown',this.onKey,true);
    const u=new URL(location.href);if(u.searchParams.has('resumeExam')){u.searchParams.delete('resumeExam');history.replaceState(null,'',u);}
    this.model.dispose();document.body.prepend(this.renderer.domElement);this.renderer.domElement.setAttribute('style',this.originalStyle||'');this.renderer.setSize(innerWidth,innerHeight);
    this.root.remove();this.host.classList.remove('exam-mode');document.body.classList.remove('examActive');
  }
}
