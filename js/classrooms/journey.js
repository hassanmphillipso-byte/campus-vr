import {renderReplay} from './replay.js';
import {createConstructionStore} from '../construction/store.js';
import {rewardBudget} from './reward_budget.js';
import {roomStatus,nextObjective,awardCatalog,syncAwards,wingSummary,courseSummary,GRADUATION_ID,WING_NAMES,awardDate} from './progress.js';
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn,cls)=>{const b=node('button',text,cls);b.type='button';b.onclick=fn;return b;};
const nextText=n=>n.id?`${n.number} ${n.title}`:n.title;

export class LearningJourney{
 constructor({rooms,save,persist,context,guide,pause,prepareReplay}){
  Object.assign(this,{rooms,save,persist,context,guide,pause,prepareReplay});this.fresh=[];this.tab='tasks';
  this.hud=node('aside',undefined,'journeyHud');this.hud.id='journeyHud';
  this.place=node('small');this.title=node('h2');this.count=node('p',undefined,'journeyCount');this.goal=node('strong');this.instruction=node('p',undefined,'journeyInstruction');
  const row=node('div',undefined,'journeyActions');this.guideButton=button('显示路线',()=>this.guide(this.objective));this.guideButton.id='guideBtn';row.append(this.guideButton,button('任务与奖励',()=>this.open()));
  this.hud.append(this.place,this.title,this.count,this.goal,this.instruction,row);document.body.append(this.hud);
  this.dialog=node('dialog');this.dialog.id='journeyDialog';this.dialog.setAttribute('aria-label','学习地图与奖励');
  const head=node('div',undefined,'journeyHead');head.append(node('h2','我的校园学习手册'));const close=button('×',()=>this.dialog.close());close.id='journeyClose';close.setAttribute('aria-label','关闭学习手册');head.append(close);
  const tabs=node('div',undefined,'journeyTabs');this.tasksButton=button('学习地图',()=>{this.tab='tasks';this.render();});this.tasksButton.id='journeyTasksTab';this.awardsButton=button('奖励收藏',()=>{this.tab='awards';this.render();});this.awardsButton.id='journeyAwardsTab';this.replayButton=button('重玩与记录',()=>this.open('replay'));this.replayButton.id='journeyReplayTab';tabs.append(this.tasksButton,this.awardsButton,this.replayButton);
  this.body=node('div',undefined,'journeyBody');this.dialog.append(head,tabs,this.body);document.body.append(this.dialog);
  window.addEventListener('keydown',e=>{if(this.dialog.open&&e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.dialog.close();}},true);
  document.getElementById('journeyBtn').onclick=()=>this.open();
  document.getElementById('progressBadge').onclick=()=>this.open();
 }
 refresh(){
  const previous={...this.save.learningAwards},added=syncAwards(this.rooms,this.save);this.saved=this.persist();
  if(!this.saved)this.save.learningAwards=previous;else this.fresh.push(...added);
  const {room,wing,target}=this.context(),summary=wingSummary(this.rooms,this.save,wing);this.objective=nextObjective(this.rooms,this.save,wing);const destination=target||this.objective;
  this.place.textContent=WING_NAMES[wing-1];this.title.textContent=room?`${room.number} ${room.title}`:'学习走廊';
  this.count.textContent=`本区课程 ${summary.completed} / ${summary.total}　${summary.submitted?'✓ 已提交':'考核尚未提交'}`;
  this.goal.textContent=(target?'正在前往：':'下一站：')+nextText(destination);this.instruction.textContent=this.saved?(destination.reason||roomStatus(destination,this.save).detail):'记录保存失败，请导出学习记录后再离开。';
  this.guideButton.textContent=destination.id?'显示路线':'查看结业奖励';this.guideButton.onclick=()=>destination.id?this.guide(destination):this.open('awards');
  if(this.dialog.open)this.render();
  return added;
 }
 open(tab='tasks'){if(tab==='replay')this.prepareReplay?.();this.pause();this.tab=tab;this.refresh();this.render();if(!this.dialog.open)this.dialog.showModal();}
 render(){
  this.body.classList.remove('replayBody');this.body.replaceChildren();this.replayButton.setAttribute('aria-pressed',String(this.tab==='replay'));this.tasksButton.setAttribute('aria-pressed',String(this.tab==='tasks'));this.awardsButton.setAttribute('aria-pressed',String(this.tab==='awards'));
  if(this.tab==='replay'){renderReplay(this.body,this);return;}
  if(this.tab==='awards'){this.renderAwards();return;}
  const course=courseSummary(this.rooms,this.save),sub=[1,2,3].filter(lv=>this.save.submitted[lv]).length;
  this.body.append(node('p',`课程 ${course.completed} / ${course.total}　区域提交 ${sub} / 3`,'journeyTotal'),node('p','绿色勾表示已完成；最高星级另列。新增课程可继续补学，原成绩、金币和历史奖励保留。选择地点后沿箭头步行前往。','journeyHelp'));
  for(const lv of [1,2,3]){
   const section=node('section',undefined,'journeyWing'),s=wingSummary(this.rooms,this.save,lv);section.append(node('h3',`${WING_NAMES[lv-1]}　${s.completed}/${s.total}`));
   const list=node('div',undefined,'journeyRooms');
   for(const r of this.rooms.filter(r=>r.lv===lv).sort((a,b)=>a.number.localeCompare(b.number))){
    const status=roomStatus(r,this.save),b=button('',()=>{if(status.locked){this.message(status.locked);return;}this.dialog.close();this.guide({...r,reason:status.detail});},'journeyRoom');b.dataset.room=r.id;b.dataset.status=status.key;
    b.append(node('b',r.number),node('strong',r.title),node('span',status.label,'journeyState'));if(r.kind!=='exam')b.append(node('small',status.detail));
    if(r.id===this.objective.id){b.classList.add('recommended');b.append(node('em','下一站'));}if(r.kind==='exam'){const wrap=node('div',undefined,'journeyRoomWrap'),detail=node('details',undefined,'journeyExamDetails');detail.append(node('summary','查看分级考核记录'),node('small',status.detail));wrap.append(b,detail);list.append(wrap);}else list.append(b);
   }
   section.append(list);this.body.append(section);
  }
  this.status=node('p','','journeySave');this.status.setAttribute('role','status');this.body.append(this.status);
 }
 message(text){if(this.status)this.status.textContent=text;}
 renderAwards(){
  const awards=awardCatalog(this.rooms,this.save),n=awards.filter(a=>a.earned).length;
  this.body.append(node('p',`已获得 ${n} / ${awards.length} 项奖励`,'journeyTotal'),node('p','达到条件自动获得，只发一次。完成章记录学习经历；掌握章记录首答满分。','journeyHelp'));
  const budget=node('section',undefined,'journeyBudget');budget.setAttribute('aria-label','金币与场馆预算');
  budget.append(node('h3','金币用在哪里'));
  try{
   const b=rewardBudget(createConstructionStore().getConstructionState(),this.save);
   budget.append(node('strong',`可用 ${b.available} 币 · 已获 ${b.earned} · 已花 ${b.spent}`),node('p',`建完剩余场馆还差 ${b.shortfall} 币；尚未领取的学习奖励合计 ${b.remaining} 币，其中二、三星共 ${b.higherStars} 档。`));
   if(b.pending)budget.append(node('p',`${b.pending} 币正在同步；稍后重新打开手册查看入账。`));
   const list=node('ul');for(const f of b.facilities)list.append(node('li',`${f.name} ${f.cost} 币 · ${f.built?'✓ 已建设':f.gap?`还差 ${f.gap} 币`:'当前余额可建设'}`));budget.append(list);
  }catch(e){budget.append(node('p','暂时无法读取金币账本：'+e.message));}
  budget.append(node('p','一星 100 币；二、三星各追加 50 币；每区首次向老师提交 300 币。每项只领一次，重考和新一轮不重复发币。'),node('p','返回校园后打开“校园建设”选择场馆。完成一星即可继续学习，冲星可积累更多建设金币。'));this.body.append(budget);
  const grid=node('div',undefined,'journeyAwards');
  for(const a of awards){
   const card=node('article',undefined,'journeyAward');card.dataset.award=a.id;card.dataset.earned=String(a.earned);
   card.append(node('span',a.icon,'awardSeal'),node('h3',a.name),node('p',a.rule),node('strong',a.earned?'✓ 已获得':'尚未获得'));
   if(a.earnedAt)card.append(node('small','获得于 '+awardDate(a.earnedAt)));
   if((a.id===GRADUATION_ID||a.id==='graduation')&&a.earned){const download=button(a.historical?'保存历史纪念卡':'保存新版结业纪念卡',()=>this.certificate(a.id));download.id=a.historical?'downloadLegacyCertificate':'downloadCertificate';card.append(download);}
   grid.append(card);
  }
  this.body.append(grid);this.status=node('p',this.saved?'奖励已保存在当前浏览器。':'保存失败，请先导出学习记录。','journeySave');this.status.setAttribute('role','status');this.body.append(this.status);
 }
 settlement(room){
  this.refresh();let panel=document.getElementById('journeySettlement');if(!panel){panel=node('section',undefined,'journeySettlement');panel.id='journeySettlement';document.getElementById('successActions').before(panel);}panel.hidden=false;panel.replaceChildren();
  const status=roomStatus(room,this.save),summary=wingSummary(this.rooms,this.save,room.lv);
  panel.append(node('strong',`✓ ${room.number} 本室任务已完成`),node('p',`${status.detail}　｜　本区 ${summary.completed} / ${summary.total} 项已完成`));
  if(this.fresh.length)panel.append(node('p','新获得：'+this.fresh.map(a=>a.name).join('、'),'journeyRewardLine'));
  panel.append(node('p','下一站：'+nextText(this.objective)),node('small',this.saved?'成绩与草稿已保存。可看演示、复习，或返回走廊继续。':'保存失败，请导出学习记录，暂勿刷新。'));
  this.fresh=[];
 }
 clearSettlement(){const panel=document.getElementById('journeySettlement');if(panel)panel.hidden=true;}
 examSettlement(host){
  this.refresh();const wrap=node('section',undefined,'examJourneyResult'),status=roomStatus(this.rooms.find(r=>r.id===`exam-${this.context().wing}`),this.save);
  wrap.append(node('strong',status.label),node('p','下一站：'+nextText(this.objective)),node('p',this.objective.reason));
  if(this.fresh.length)wrap.append(node('p','新获得：'+this.fresh.map(a=>a.name).join('、'),'journeyRewardLine'));
  const awards=button('查看奖励收藏',()=>this.open('awards'));wrap.append(awards,button('重玩与记录',()=>this.open('replay')));host.append(wrap);this.fresh=[];
 }
 certificate(id=GRADUATION_ID){
  const a=awardCatalog(this.rooms,this.save).find(a=>a.id===id);if(!a?.earned)return;
  const total=a.historical?this.rooms.filter(r=>r.task&&r.id!=='3-5').length:courseSummary(this.rooms,this.save).total;
  const edition=a.historical?'历史课程纪念':'新版课程纪念 · 含 for 巡回训练';
  const date=awardDate(a.earnedAt).replace(/[^0-9-]/g,'');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900"><rect width="1400" height="900" fill="#edf3ed"/><rect x="45" y="45" width="1310" height="810" rx="12" fill="#fff" stroke="#256a53" stroke-width="5"/><g fill="#163f30" font-family="PingFang SC,Microsoft YaHei,sans-serif" text-anchor="middle"><text x="700" y="165" font-size="32">阳光中学 · 校园学习手册</text><text x="700" y="320" font-size="76" font-weight="bold">探索学习 · 结业纪念</text><text x="700" y="450" font-size="38">运算教学区　✓　数据教学区　✓　循环教学区　✓</text><text x="700" y="555" font-size="30">${total} 项课程完成 · 3 个区域已向老师提交</text><text x="700" y="660" font-size="25">${edition}</text><text x="700" y="770" font-size="23">${date}　｜　校园互动学习纪念，非学历证书</text></g></svg>`;
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),link=document.createElement('a');link.href=url;link.download=a.historical?'阳光中学-历史结业纪念卡.svg':'阳光中学-新版结业纪念卡.svg';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
 }
}
