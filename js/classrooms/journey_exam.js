// Keep progress integration outside the independently maintained exam scene.
export function attachExamJourney(exam,journey,onExit,onProgress){
 const render=exam.render.bind(exam),store=exam.store.bind(exam);
 // 结算面板按钮收敛（老师反馈：6 个去向太多）——主按钮只留 3 个：
 // 返回走廊并查看下一站 / 查看奖励收藏 / 重玩与记录；其余收成一行弱化小按钮。
 function tidySettlement(panel){
  if(panel.querySelector('.examMore'))return;
  const redundant=[...panel.querySelectorAll('button')].filter(b=>['返回开始页','返回教室','进入基地冒险'].includes(b.textContent.trim()));
  if(!redundant.length)return;
  const more=document.createElement('div');more.className='examMore';
  redundant.forEach(b=>more.append(b));panel.append(more);
 }
 function decorate(){
  const panel=exam.root.querySelector('.examResults')||(exam.phase==='result'||exam.phase==='home'&&exam.save.submitted[exam.lv]?exam.root.querySelector('.examQuestion'):null);
  if(!panel)return;
  journey.examSettlement(panel);
  if(exam.save.quiz[exam.lv]>=0&&!exam.save.submitted[exam.lv]&&!panel.querySelector('.teacherSubmit'))exam.button('向'+exam.teacher+'提交作业',()=>{if(exam.store()){exam.onSubmit();exam.render();}},'examPrimary teacherSubmit',panel);
  if(exam.save.submitted[exam.lv])exam.button('返回走廊并查看下一站',()=>{if(exam.store())onExit();},'examPrimary',panel);
  tidySettlement(panel);
 }
 exam.render=()=>{render();decorate();};
 exam.store=()=>{const ok=store();if(ok)onProgress();return ok;};
 decorate();return exam;
}
