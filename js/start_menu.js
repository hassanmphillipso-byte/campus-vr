import {switchReplay,readReplay} from './replay_store.js';

const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function readStartSave(){const save=JSON.parse(localStorage.getItem('campusPy1')||'{}');if(!save||typeof save!=='object'||Array.isArray(save))throw Error('学习记录无法读取，请先保留浏览器数据。');return save;}
export function mountStartMenu({host,continueButton,onContinue,total}){
 host.classList.add('startMenu');continueButton.textContent='继续游戏';continueButton.setAttribute('aria-describedby','startSummary');
 const summary=node('p');summary.id='startSummary';summary.setAttribute('role','status');
 const actions=node('div');actions.className='startActions';continueButton.replaceWith(actions);actions.append(continueButton);
 const restart=node('button','重新开始');restart.id='restartBtn';restart.type='button';actions.append(restart);
 actions.before(summary);
 try{const save=readStartSave(),meta=readReplay();const completed=Object.values(save.tasks||{}).filter(v=>v>=1).length;const has=!!(completed||Object.keys(save.exams||{}).length);continueButton.textContent=has?'继续学习':'开始学习';summary.textContent=has?`第 ${meta.round||1} 轮 · 已完成 ${completed} / ${total} 项课程 · 继续保留成绩与奖励`:'首次进入校园 · 点「开始学习」，跟着绿色引导线走';}
 catch(e){summary.textContent=e.message;}
 const help=node('p','常用操作：WASD 移动 · E / 空格 互动 · Esc 收起面板');help.className='startKeys';actions.after(help);
 const classroomEntry=document.getElementById('fineClassroomEntry');if(classroomEntry)host.append(classroomEntry);
 continueButton.addEventListener('click',()=>{try{onContinue(readStartSave());}catch(e){summary.textContent=e.message;}});
 const dialog=node('dialog');dialog.id='restartDialog';dialog.setAttribute('aria-label','重新开始游戏');
 const title=node('h2','重新开始游戏'),description=node('p','选择怎样重新开始。确认前会保存一份可恢复的备份。');
 const choices=node('div');choices.className='restartChoices';
 const options=[['round','新一轮学习','课程、考试和体育进度从头开始；旧记录归档，金币与已建场馆保留。'],['reset','全部从零开始','课程、考试、体育、金币和场馆归零；原记录保存在最近一次恢复备份中。']];
 for(const [value,label,detail] of options){const row=node('label'),radio=node('input');radio.type='radio';radio.name='restartMode';radio.value=value;radio.checked=value==='round';const text=node('span');text.append(node('strong',label),node('small',detail));row.append(radio,text);choices.append(row);}
 const acknowledge=node('label');acknowledge.className='restartAck';const check=node('input');check.type='checkbox';check.id='restartAcknowledge';acknowledge.append(check,' 我已了解进度与记录的处理方式');
 const phrase=node('label','输入“从零开始”确认全部重置：'),input=node('input');input.type='text';input.id='restartPhrase';input.autocomplete='off';phrase.append(input);phrase.hidden=true;
 const status=node('p');status.className='restartStatus';status.setAttribute('role','status');
 const row=node('div');row.className='restartActions';const cancel=node('button','取消'),go=node('button','确认重新开始');cancel.id='restartCancel';go.id='restartConfirm';go.disabled=true;row.append(cancel,go);
 const mode=()=>dialog.querySelector('input[name=restartMode]:checked').value;
 const sync=()=>{phrase.hidden=mode()!=='reset';go.disabled=!check.checked||(mode()==='reset'&&input.value!=='从零开始');};
 dialog.addEventListener('input',sync);dialog.append(title,description,choices,acknowledge,phrase,status,row);document.body.append(dialog);
 // Editing fields and activating buttons keep their native E/space behavior.
 dialog.addEventListener('keydown',e=>e.stopPropagation());
 restart.onclick=()=>{check.checked=false;input.value='';status.textContent='';sync();dialog.showModal();};cancel.onclick=()=>dialog.close();
 go.onclick=async()=>{const selected=mode();for(const n of dialog.querySelectorAll('button,input'))n.disabled=true;status.textContent='正在保存备份并重新开始…';
  try{await switchReplay(selected);location.assign('./?started=1');}
  catch(e){status.textContent=e.message;for(const n of dialog.querySelectorAll('button,input'))n.disabled=false;sync();}
 };
 return {hide:()=>{host.style.display='none';}};
}
