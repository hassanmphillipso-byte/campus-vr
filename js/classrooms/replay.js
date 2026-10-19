import {readReplay,snapshot,switchReplay} from '../replay_store.js';
import {canAccessExam,lockReason,WING_NAMES,awardCatalog} from './progress.js';
import {isCorrect} from './question_bank.js';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn,cls)=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;};
const date=v=>v?new Date(v).toLocaleString('zh-CN',{hour12:false}):'旧记录';
function download(data,name){const a=el('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),10000);}
// 按题型展示首答：选择题显示选项文本，填空显示所填内容，编程显示代码输出（E19）。
function firstAnswerText(q,answer){
 const qt=q.type||'choice';
 if(qt==='blank')return `你填的：${answer.first}`;
 if(qt==='code')return `你的代码输出：${String(answer.first?.out??'').trim()||'（无输出）'}`;
 return `你的选择：${Array.isArray(q.opts)&&q.opts[answer.first]!==undefined?q.opts[answer.first]:'（记录缺失）'}`;
}
function attemptCard(key,a){
 const d=el('details',undefined,'replayRecord');
 try{
  const adv=key.startsWith('adventure:'),parts=key.split(':'),lv=Number(parts.at(-2)),tier=parts.at(-1);
  let score,total;
  if(adv){score=Object.values(a.answers||{}).filter(v=>v?.pass).length;total=3;}
  else{const qs=a.questions||[];total=qs.length||3;score=qs.reduce((n,q,i)=>n+(isCorrect(q,a.answers?.[i])?1:0),0);}
  d.append(el('summary',`${WING_NAMES[lv-1]||'考核'} · ${tier} 级 · ${adv?'冒险':'经典'} · ${a.finished?score+' / '+total:'未完成'} · ${date(a.started||a.created||a.finished)}`));
  if(adv){for(const [k,v] of Object.entries(a.answers||{}))d.append(el('p',`${{basic:'信号台',blocks:'能源桥',fighter:'设备巡检'}[k]||k}：${v.pass?'正确':'需要复习'}`));}
  else for(const [i,q] of (a.questions||[]).entries()){const answer=a.answers?.[i];d.append(el('p',`${i+1}. ${q.title}　${answer?firstAnswerText(q,answer):'尚未作答'}`));if(answer)d.append(el('p',`${isCorrect(q,answer)?'✓ 正确':'× 需要复习'} · ${q.ex}`));}
  d.append(el('small',`题目来源：${a.source||'冒险场景'}。首答记录保留，纠正练习不改首答分。`));
 }catch(e){
  // 单条旧格式记录异常不拖垮整页历史；导出文件仍含原始数据。
  d.append(el('p','这一条历史记录格式较旧，无法详细展示；完整原始数据保留在导出文件里。'));
 }
 return d;
}
export function renderReplay(host,{rooms,save,persist,certificate}){
 let meta;try{meta=readReplay();}catch(e){host.append(el('p',e.message));return;}
 host.classList.add('replayBody');host.append(el('p',`第 ${meta.round||1} 轮学习 · 重玩与记录`,'journeyTotal'),el('p','重考保留最高成绩，重复完成已奖励的任务不会再发金币。记录保存在此浏览器；切换前可先导出。','journeyHelp'));
 const grid=el('div',undefined,'replayCards'),retake=el('section'),round=el('section'),reset=el('section');
 retake.append(el('h3','保留记录重考'),el('p','只重新开始选中的考核，旧答题记录归入历史。保留课程、最高分、金币、场馆和证书；已有体育实测仍可使用。'));
 function select(label,id,items){const wrap=el('label',label),s=el('select');s.id=id;for(const [value,text,disabled] of items){const o=el('option',text);o.value=value;o.disabled=!!disabled;s.append(o);}wrap.append(s);retake.append(wrap);return s;}
 const accessible=lv=>canAccessExam(rooms,save,lv)&&!lockReason({lv,kind:'exam'},save);
 const region=select('教学区','replayRegion',[1,2,3].map(lv=>[lv,WING_NAMES[lv-1]+(accessible(lv)?'':'（'+(lockReason({lv,kind:'exam'},save)||'先完成本区课程')+'）'),!accessible(lv)]));
 const available=[1,2,3].find(accessible);if(available)region.value=available;
 const tier=select('难度','replayTier',[[1,'1 级 · 入门'],[2,'2 级 · 应用'],[3,'3 级 · 挑战']]);
  // 2026-10-17 老师修改意见（C1）：基地冒险已下线，重考只提供经典考核；上方历史记录仍展示旧冒险场次（只读）。
  const kind=select('形式','replayKind',[['classic','经典考核']]);
  const retry=button('选择这场重考',()=>confirm('retake',`重新开始${WING_NAMES[+region.value-1]} ${tier.value} 级经典考核。上一场包括未完成的答案会保留在历史里。`));retry.id='replayRetake';retry.disabled=!available;retake.append(retry);
 if(!available)retake.append(el('small','当前轮还没有解锁考核，先从学习地图完成课程。'));
 round.append(el('h3','新一轮学习'),el('p','课程、当前考核和体育进度从头开始。旧成绩与证书存入历史；金币和已建场馆保留，已发过的任务奖励不重复发。'),button('开启新一轮',()=>confirm('round','旧课程、草稿、考试和体育记录将归档。本轮进度归零，金币和已建场馆保留。')));
 reset.append(el('h3','从零重置'),el('p','清空当前课程、考试、体育、金币与已建场馆。音乐、音量和人物外观设置保留。原记录与历史只保留在最近一次恢复备份中。'),button('重置所有游戏进度',()=>confirm('reset','课程、考试、体育成绩、金币、建设和历史列表都会清空。操作前自动留一份恢复备份；建议同时导出完整记录。'),'replayDanger'));
 grid.append(retake,round,reset);host.append(grid);
 const status=el('p','','journeySave');status.setAttribute('role','status');const confirmHost=el('div');host.append(confirmHost,status);
 const utilities=el('div',undefined,'replayUtilities');utilities.append(button('导出完整记录与备份',()=>{try{if(!persist())throw Error('保存失败，请重新载入后再导出');download({version:1,exportedAt:new Date().toISOString(),current:snapshot(),history:readReplay()},'阳光校园-完整学习记录.json');status.textContent='已生成完整记录文件。';}catch(e){status.textContent=e.message;}}));
 if(meta.backup)utilities.append(button('恢复上次切换前的存档',()=>confirm('restore',`恢复 ${date(meta.backup.savedAt)} 切换前的全部进度、金币与场馆。当前进度会交换到恢复备份里，不会与旧分数相加。`)));
 host.append(utilities);
 function confirm(mode,text){
  const selection={lv:+region.value,tier:+tier.value,kind:kind.value};
  confirmHost.replaceChildren();const box=el('section',undefined,'replayConfirm');box.setAttribute('aria-label','确认重玩选项');box.append(el('h3','确认本次操作'),el('p',text));
  const label=el('label',mode==='reset'?'输入“从零开始”确认：':'我已了解本次记录如何处理 '),input=el('input');input.type=mode==='reset'?'text':'checkbox';input.autocomplete='off';input.id='replayAcknowledge';label.append(input);box.append(label);
  const go=button('确认并继续',async()=>{
   go.disabled=true;cancel.disabled=true;input.disabled=true;status.textContent='正在保存备份并切换，请稍候…';
   try{
    if(!persist())throw Error('当前记录未保存成功，未切换存档');
    const {lv,tier:t,kind:k}=selection;if(mode==='retake'&&!accessible(lv))throw Error('请先完成本区课程');
    await switchReplay(mode,{lv,tier:t,kind:k});
    const url=new URL(location.href);for(const k of ['exam','difficulty','mission','examMode','resumeExam'])url.searchParams.delete(k);
    url.searchParams.set('wing',mode==='retake'?lv:1);
    if(mode==='retake'){url.searchParams.set('exam',lv);url.searchParams.set('difficulty',t);url.searchParams.set('examMode',k);url.searchParams.set('resumeExam','1');}
    location.assign(url.href);
   }catch(e){status.textContent=e.message;cancel.disabled=false;input.disabled=false;go.disabled=false;status.append(button('重新载入并检查记录',()=>location.reload()));}
  },'primary');go.id='replayConfirm';go.disabled=true;
  input.oninput=()=>{go.disabled=mode==='reset'?input.value!=='从零开始':!input.checked;};
  const cancel=button('取消',()=>{confirmHost.replaceChildren();status.textContent='已取消，记录没有改变。';retry.focus();});cancel.id='replayCancel';box.append(go,cancel);confirmHost.append(box);box.scrollIntoView({block:'nearest'});input.focus();
 }
 const records=el('section',undefined,'replayHistory');records.append(el('h3','考试与学习历史'));
 const attempts=[...Object.entries(save.exams||{}).map(([key,attempt])=>({key,attempt})),...(save.examHistory||[])].sort((a,b)=>Number(b.attempt.started||b.attempt.finished||0)-Number(a.attempt.started||a.attempt.finished||0));
 records.append(el('p',`本轮共有 ${attempts.length} 场记录。下方展示最近 20 场，导出文件包含全部题目、首答、解析和过程记录。`));
 attempts.slice(0,20).forEach(({key,attempt})=>records.append(attemptCard(key,attempt)));
 if(!attempts.length)records.append(el('p','本轮还没有考试记录。完成课程后即可进入考核。'));
 for(const r of meta.rounds.slice().reverse()){
  const d=el('details',undefined,'replayRecord'),old=JSON.parse(r.snapshot.campusPy1||'{}');
  d.append(el('summary',`第 ${r.number} 轮 · ${Object.values(old.tasks||{}).filter(v=>v>=1).length} 项课程 · 归档于 ${date(r.endedAt)}`));
  d.append(el('p',`区域提交：${Object.values(old.submitted||{}).filter(Boolean).length} / 3。此处是历史记录，不计入当前轮的完成状态。`));
  const awards=awardCatalog(rooms,old).filter(a=>a.earned);d.append(el('p',`保留 ${awards.length} 项历史奖励。`));
  for(const a of awards){d.append(el('p',`${a.name} · ${date(a.earnedAt)}`));if(a.id.startsWith('graduation')&&certificate)d.append(button('保存这一轮结业纪念卡',()=>certificate.call({rooms,save:old},a.id)));}
  for(const [key,a] of Object.entries(old.exams||{}))d.append(attemptCard(key,a));
  for(const a of old.examHistory||[])d.append(attemptCard(a.key,a.attempt));
  d.append(button('导出这一轮完整记录',()=>download(r,`阳光校园-第${r.number}轮.json`)));records.append(d);
 }
 host.append(records);
}
