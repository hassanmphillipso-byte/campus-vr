import {installRenderBudget} from '../render_budget.js';
import {PlayerAvatar} from '../player_avatar.js';
import {PlayerFoley} from '../player_foley.js';
import {campusMusic,classroomMusicScene} from '../campus_music.js';
import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import RAPIER from '../../vendor/rapier/rapier.es.js';
import {loadAssets,buildEnvironment} from './environment.js';
import {levels,rooms,save,persist,record,locked,done,examAccessible,draft,setDraft,run,cancel} from './learning.js';
import {ExamRoom} from './exam_entry.js';
import {mountGuide,lessonGuideIds,stopGuideVoice} from './voice_guide.js';
import {TaskStage} from './task_stage.js';
import {lessonProgress} from './lesson_tasks.js';
import {LearningJourney} from './journey.js';
import {attachExamJourney} from './journey_exam.js';
import {roomStatus,nextObjective,wingSummary,WING_NAMES,walkingRoute,courseSummary} from './progress.js';
import {getMission} from '../sports_exam.js';
campusMusic.mount(document.getElementById('musicBtn'));
const playerFoley=new PlayerFoley({enabled:()=>campusMusic.masterOn});playerFoley.mount();
window.__playerFoley={state:()=>playerFoley.state()};
for(const event of ['pointerdown','keydown'])addEventListener(event,()=>campusMusic.unlock(),{once:true});
const $=id=>document.getElementById(id),wingNames=['运算教学区','数据教学区','循环教学区'];
let playerAvatar=null;
let examUI=null,taskStage=null,lessonGuide=null;
let room=null,wing=1,environment,world,body,collider,controller,ballBody,assets,yaw=0,pitch=0,modal=false,running=false,tier=0,result=null,selected=null,transition=false;
const keys=new Set(),movement={x:0,z:0};let near=null,noticeTimer,view=0;
// 打开中的 dialog 计数：由 toggle 事件维护，替代渲染循环里每帧一次的全文档 querySelector（流畅度）。
let dialogOpenCount=0;
document.addEventListener('toggle',e=>{if(e.target?.tagName==='DIALOG')dialogOpenCount=Math.max(0,dialogOpenCount+(e.target.open?1:-1));},true);
const dialogOpen=()=>dialogOpenCount>0;
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.outputColorSpace=T.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.xr.enabled=true;document.body.prepend(renderer.domElement);
const scene=new T.Scene(),rig=new T.Group();scene.add(rig);const camera=new T.PerspectiveCamera(60,innerWidth/innerHeight,.06,100);camera.rotation.order='YXZ';camera.position.y=1.64;rig.add(camera);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const ao=new GTAOPass(scene,camera,innerWidth,innerHeight);ao.blendIntensity=.6;ao.updateGtaoMaterial({radius:.35,thickness:.8,scale:1.1});composer.addPass(ao);composer.addPass(new OutputPass());ao.setSize(Math.round(innerWidth*.8),Math.round(innerHeight*.8));renderer.info.autoReset=false;
const journey=new LearningJourney({rooms,save,persist,context:()=>({room,wing,target:routeEnabled&&!(room&&selected===room.id&&roomStatus(room,save).key==='done')?rooms.find(r=>r.id===selected):null}),guide:guideTo,pause:resetMovementInput,prepareReplay:()=>{closeWork();resetMovementInput();}});
// B1（2026-10-17 老师反馈）：完成当前房间后，学习地图不再"正在前往"刚做完的这间——目标视为已完成时回落到下一站；
// 出门时的自动推进本就在 enterRoom（done → nextObjective），这里补齐"人在室内就已做完"的显示口径。
let routeEnabled=false,routeTick=0,routeEnvironment=null,routeKey='',routeBuilds=0;
const continueNavigation=save.navigation?{...save.navigation}:null;
addEventListener('campus-save-invalidated',()=>{cancel();stopGuideVoice();resetMovementInput();});
function toast(text){$('notice').textContent=text;$('notice').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').classList.remove('visible'),4200);}
function getWingRooms(){return rooms.filter(r=>r.lv===wing).sort((a,b)=>a.number.localeCompare(b.number));}
function buildWorld(){
 if(world)world.free();world=new RAPIER.World({x:0,y:-9.81,z:0});
 for(const c of environment.colliders)world.createCollider(RAPIER.ColliderDesc.cuboid(c.w/2,c.h/2,c.d/2).setTranslation(c.x,c.y,c.z));
 body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(environment.spawn.x,.83,environment.spawn.z));
 collider=world.createCollider(RAPIER.ColliderDesc.capsule(.55,.26),body);controller=world.createCharacterController(.015);controller.enableAutostep(environment.stairwell ? .21 : .15,.2,true);controller.enableSnapToGround(environment.stairwell ? .24 : .2);
 ballBody=null;if(environment.ball){const p=environment.ball.position;ballBody=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x,p.y,p.z).setLinearDamping(.12));world.createCollider(RAPIER.ColliderDesc.ball(.052).setRestitution(.2).setFriction(.02),ballBody);}
 world.step();
}
async function enterRoom(next,returning=false){
 if(transition)return;transition=true;closeWork();view++;keys.clear();movement.x=movement.z=0;
 if(next){$('loadText').textContent='正在进入 '+next.number+' '+next.title+'…';$('loading').hidden=false;try{await assets.loadSpace(next.id);}catch(e){transition=false;$('loading').hidden=true;toast('房间模型加载失败，请重试：'+e.message);return;}}
 const previous=room;room=next;if(room)wing=room.lv;campusMusic.setScene(classroomMusicScene(room));
 if(room)selected=room.id;
 else if(returning&&previous&&(!selected||selected===previous.id))selected=roomStatus(previous,save).key==='done'?nextObjective(rooms,save,wing).id:previous.id;
 else if(!selected||rooms.find(r=>r.id===selected)?.lv!==wing)selected=nextObjective(rooms,save,wing).id;
 routeEnabled=!!selected;
 if(environment){scene.remove(environment.group);environment.dispose();}
 environment=buildEnvironment(assets,room,getWingRooms());scene.add(environment.group);buildWorld();
 if(returning&&previous){const door=environment.interactions.find(x=>x.id===previous.id);if(door){body.setTranslation({x:door.x>0?1.7:-1.7,y:.83,z:door.z},true);environment.spawn.yaw=door.x>0?Math.PI/2:-Math.PI/2;}}
 yaw=environment.spawn.yaw;pitch=room?-.075:-.16;rig.position.set(body.translation().x,0,body.translation().z);camera.rotation.set(pitch,yaw,0);$('returnWork').hidden=true;
 $('wingName').textContent=wingNames[wing-1];$('roomName').textContent=room?room.number+' '+room.title:'教学走廊';$('roomTag').textContent=room?`ROOM ${room.number} / 独立学习空间`:`LEARNING SPACES / 0${wing}`;
 $('spaceTitle').textContent=room?.title||wingNames[wing-1];$('spaceDesc').textContent=room?.task?.teach?.replace('NPC','训练模型')||(room?.kind==='archive'?'在资料柜整理三份运动会成绩，完成后前往数据教室。':room?.kind==='exam'?'完成本区任务后，在教师工作台参加小测并提交作业。':'每间教室对应一项任务。走近门牌，按 E / 空格 进入。');
 if(room)$('spaceDesc').textContent+=' 沿中央过道前往右前方电脑，按 E / 空格 开始。';else $('spaceDesc').textContent+=' 回校园：沿入口处绿色出口指示下楼，到首层玻璃门按 E / 空格。';
 document.documentElement.style.setProperty('--accent',['#256a53','#38627c','#806847'][wing-1]);updateProgress();near=null;transition=false;$('loading').hidden=true;
 save.navigation={page:'classrooms',wing,room:room?.id||null};persist();refreshRoute();
 if(!room)maybeShowNextHint();   // D1：带已完成档进走廊时补查一次（只弹一次）
 if(returning&&previous)toast(`已离开 ${previous.number}，现在位于走廊。沿走廊前往其他教室，或按绿色出口指示下楼。`);
}
function updateProgress(){const course=courseSummary(rooms,save);$('progressBadge').textContent=`${course.completed} / ${course.total} 课程 · ${[1,2,3].filter(lv=>save.submitted[lv]).length} / 3 提交`;const summary=wingSummary(rooms,save,wing);$('spaceProgress').textContent=`本区 ${summary.completed} / ${summary.total} 项完成`;if(modal&&room?.task&&save.tasks[room.id])$('taskStatus').textContent=`本室已获 ${save.tasks[room.id]} 星，成绩已保存。`;environment?.setProgress(Object.fromEntries(rooms.map(r=>[r.id,roomStatus(r,save)])));journey.refresh();}
function guideTo(target){if(!target?.id){journey.open('awards');return;}selected=target.id;routeEnabled=true;journey.refresh();refreshRoute();}
function refreshRoute(){
 if(!body||!environment)return;const p=body.translation(),target=rooms.find(r=>r.id===selected);
 const key=[room?.id,selected,routeEnabled,wing,Math.floor(p.x/.15),Math.floor(p.y/.15),Math.floor(p.z/.15)].join('|');
 if(routeEnvironment===environment&&routeKey===key)return;routeEnvironment=environment;routeKey=key;routeBuilds++;if(!routeEnabled||!target){environment.setRoute([]);$('routeHint').hidden=true;return;}
 let points=[{x:p.x,z:p.z}],hint='';
 if(room){if(room.id===target.id){points.push({x:0,z:p.z},{x:0,z:-1.46},{x:1.25,z:-1.46});hint='沿绿色引导线到工作台，按 E / 空格 开始。';}else{points.push({x:0,z:p.z},{x:0,z:4.08});hint=`先从后门按 E / 空格 返回走廊，再前往 ${target.number}。`;}}
 else if(target.lv!==wing){if(p.y<.5){points=[];hint='先沿楼梯上楼，回到入口导览牌。';}else{points.push({x:0,z:p.z},{x:0,z:2.8});hint=`前往入口导览牌，按 E / 空格 选择${WING_NAMES[target.lv-1]}。`;}}
 else {const d=environment.interactions.find(x=>x.id===target.id);if(p.y<.5){points=[];hint='先沿楼梯上楼，再沿走廊前往教室。';}else if(d){points.push({x:0,z:p.z},{x:0,z:d.z},{x:d.x>0?1.7:-1.7,z:d.z});hint=`沿绿色引导线前往${d.x<0?'左':'右'}侧 ${target.number} ${target.title}，面向房门按 E / 空格。`;}}
 const route=walkingRoute(points,environment.colliders);if(points.length&&!route.length)hint='当前位置靠近障碍物，请先走回中央过道，再沿箭头前往目标。';environment.setRoute(route);$('routeHint').textContent=hint;$('routeHint').hidden=false;
}
async function finishAndGuide(){selected=null;await enterRoom(null,true);const next=nextObjective(rooms,save,wing);if(next.id)guideTo(next);else{routeEnabled=false;refreshRoute();}}
// D1（2026-10-17 老师修改意见）：三区全部提交后，一次性全屏提示"下一个任务：回校园建设场馆"。
// save.nextHintShown 防重复；工作台/弹窗打开时不弹，留到回走廊时再查。
function maybeShowNextHint(){
 if(save.nextHintShown||![1,2,3].every(i=>save.submitted[i])||modal||dialogOpen()||transition)return;
 save.nextHintShown=true;if(!persist())return;
 const dlg=document.createElement('dialog');dlg.id='nextHintPanel';
 dlg.innerHTML='<div class="dialogHead"><div><span class="eyebrow">ALL REGIONS CLEAR</span><h2>🎉 三区闯关全部完成</h2></div><button data-close aria-label="关闭提示">×</button></div><p class="nextHintBody">下一个任务：回到校园广场，打开建设菜单，用金币建造体育馆、音乐馆等场馆，经营你的阳光中学！</p><div class="nextHintActions"><button id="nextHintCampus" class="primary">回到校园</button><button data-close>知道了</button></div>';
 document.body.append(dlg);
 dlg.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dlg.close());
 dlg.querySelector('#nextHintCampus').onclick=()=>{dlg.close();returnToCampus();};
 // 注意：关闭后不能立刻 remove()——toggle(false) 是排队任务，元素先被摘走会导致 dialogOpen 计数卡 1、
 // 永久拦掉移动和互动。关闭的面板留在 DOM（closed）不影响任何行为。
 dlg.showModal();campusMusic.setScene('celebration');
}

function directory(){keys.clear();$('directory').showModal();renderDirectory();}
function renderDirectory(){
 const tabs=$('directory').querySelector('.wingTabs');tabs.replaceChildren();
 wingNames.forEach((name,i)=>{const b=document.createElement('button');b.textContent=name;b.classList.toggle('active',wing===i+1);b.onclick=()=>{if(i+1===wing)return;if(room){toast('请先从本室出口返回走廊，再换教学区。');return;}const p=body.translation();if(Math.hypot(p.x,p.z-2.9)>1.7){toast('请沿走廊回到入口导览牌，再换教学区。');return;}if(i===2&&!(save.submitted[1]&&save.submitted[2])){toast('先在第一、二关考核室完成提交，再进入循环教学区。');return;}wing=i+1;enterRoom(null);renderDirectory();};tabs.append(b);});
 $('roomList').replaceChildren();for(const r of getWingRooms()){
  const b=document.createElement('button'),num=document.createElement('b'),title=document.createElement('span'),status=document.createElement('small');num.textContent=r.number;title.textContent=r.title;const state=roomStatus(r,save);b.dataset.status=state.key;status.textContent=state.label+' · '+(r.kind==='exam'?'查看本室考核记录':state.detail);status.title=state.detail;b.append(num,title,status);
  b.onclick=()=>{if(room){toast('从本室出口返回走廊，即可前往其他房间。');return;}selected=r.id;$('directory').close();guideTo(r);};$('roomList').append(b);
 }
}
function openWork(){
 if(!room)return;stopGuideVoice();lessonGuide?.dispose();lessonGuide=null;journey.clearSettlement();keys.clear();movement.x=movement.z=0;modal=true;campusMusic.duck('reading',true);view++;$('returnWork').hidden=true;$('workstation').hidden=false;$('roomInfo').hidden=true;result=null;
 $('taskRoom').textContent=`${room.number} / ${room.title}`;$('taskTitle').textContent=room.task?.title||room.title;$('brief').textContent=room.task?.brief||'在本室工作台完成操作，记录将保存到当前浏览器。';$('knowledge').textContent=room.task?.teach||(room.kind==='exam'?'逐题作答后查看解析，完成小测再提交。':'每张成绩单都会保存，下次进入无需重复收集。');$('knowledgeCard').textContent=levels[room.lv-1].card;$('knowledgeCard').hidden=true;$('feedback').textContent='';$('taskStatus').textContent='';$('special').replaceChildren();$('coding').hidden=room.kind!=='task'||room.task.type==='narrative';$('successActions').hidden=true;
 $('knowledgeCard').textContent=room.task?.card||levels[room.lv-1].card;
 document.getElementById('lessonNav')?.remove();
 if(room.steps&&room.steps.length>1){const nav=document.createElement('div');nav.id='lessonNav';nav.setAttribute('aria-label','独立教学步骤');room.steps.forEach((t,i)=>{const b=button(`${i+1}. ${t.step==='swim'?'泳道取余':'路线乘方'}`,()=>selectTaskStep(i));b.dataset.step=t.step;b.classList.toggle('active',room.task.step===t.step);b.setAttribute('aria-pressed',String(room.task.step===t.step));nav.append(b);});document.querySelector('.workBody>aside').prepend(nav);}
 if(room.kind==='task')taskStage=new TaskStage({room,levels,renderer,environment:assets.env,characters:assets.characters});
 if(room.kind==='task'&&room.task.type!=='narrative'){tier=0;renderEditor();}else if(room.kind==='archive')renderArchive();else if(room.kind==='exam')renderExam();else renderNarrative();
}
function selectTaskStep(i){if(running||!room.steps)return;closeWork();room={...room,task:room.steps[i]};openWork();}
function taskStatusText(){if(save.tasks[room.id])return `本室已通过，拿到 ${save.tasks[room.id]} 星。可以回低难度再刷星，也可以直接去下一间教室。`;if(!room.steps)return '完成任务后，前往下一间教室。';const p=lessonProgress(save,room.id);return `独立步骤 ${p.completed}/${p.total}。步骤通过后完成本室。`;}
function taskSuccessActions(){
 document.getElementById('nextLessonStep')?.remove();$('watchBtn').hidden=!!room.steps;$('leaveTask').hidden=!!room.steps&&!save.tasks[room.id];
 if(room.steps){const next=room.steps.findIndex(t=>!save.taskSteps?.[room.id]?.[t.step]);if(next>=0){const b=button(`继续：${next?'路线乘方':'泳道取余'}`,()=>selectTaskStep(next),'primary');b.id='nextLessonStep';$('successActions').prepend(b);}}
}
function closeWork(){lessonGuide?.dispose();lessonGuide=null;stopGuideVoice();if(room?.task&&room.task.type!=='narrative'&&modal)setDraft(room,tier,$('code').value);examUI?.dispose();examUI=null;taskStage?.dispose();taskStage=null;cancel();modal=false;campusMusic.duck('reading',false);view++;running=false;$('workstation').hidden=true;$('roomInfo').hidden=false;keys.clear();if(environment)updateProgress();}
function renderEditor(){
 lessonGuide?.dispose();lessonGuide=mountGuide(document.querySelector('.workBody>aside'),lessonGuideIds(room,tier),{before:$('brief')});
 journey.clearSettlement();taskStage?.setResult(null);result=null;
 $('tiers').replaceChildren();['1级 · 填空','2级 · 补全','3级 · 独立编程'].forEach((text,i)=>{const b=document.createElement('button');b.textContent=text;b.classList.toggle('active',i===tier);b.onclick=()=>{if(running)return;setDraft(room,tier,$('code').value);tier=i;renderEditor();};$('tiers').append(b);});
 $('preamble').textContent=room.task.displayPre||(room.task.pre?.startsWith('ACTS')?'已提供 jump(n) 教学指令，可用它驱动训练模型。':room.task.pre||'Python 3');$('code').value=draft(room,tier);document.getElementById('stepHint')?.remove();$('operators').replaceChildren();for(const op of room.task.ops||[]){const b=document.createElement('button');b.textContent=op;b.onclick=()=>{if(running)return;const code=$('code'),i=code.value.indexOf('___');if(i>=0)code.setRangeText(op,i,i+3,'end');else code.setRangeText(op,code.selectionStart,code.selectionEnd,'end');setDraft(room,tier,code.value);};$('operators').append(b);}
 if(tier===2){const hints=document.createElement('section');hints.id='stepHint';const guidance=document.createElement('p');guidance.setAttribute('role','status');let step=0;const lines=['先确定输入变量和要输出的结果。'+room.task.teach,'把任务拆成初始化、计算或判断、最后输出；循环题还要更新变量。','可参考结构（空位仍需自己完成）：\n'+room.task.tiers[1]];const hint=button('提示一步',()=>{guidance.textContent=lines[Math.min(step++,lines.length-1)];hint.textContent=step<lines.length?'再提示一步':'重新查看提示';});hints.append(hint,guidance);$('operators').after(hints);}
 $('output').textContent='等待运行。';$('runStatus').textContent='三级题意与判定一致，仅代码提示量不同';$('feedback').textContent='';$('successActions').hidden=true;$('taskStatus').textContent=taskStatusText();taskSuccessActions();lockControls(false);
}
function lockControls(value){for(const b of document.querySelectorAll('#runBtn,#resetBtn,#operators button,#tiers button,#lessonNav button,#stepHint button'))b.disabled=value;$('code').readOnly=value;}
async function runCode(){
 if(running||!room?.task)return;stopGuideVoice();journey.clearSettlement();taskStage?.setResult(null);taskStage?.beginCoding?.();const token=view,active=room;running=true;lockControls(true);$('runStatus').textContent='Python 运行中…';$('output').textContent='';$('feedback').textContent='';$('successActions').hidden=true;
 try{const res=await run(active,tier,$('code').value);if(token!==view||res.cancelled)return;result=res;taskStage?.setResult(res);$('output').textContent=res.out|| (res.error?'没有输出。':'程序没有打印输出。');$('feedback').className=res.pass?'pass':'';$('feedback').textContent=res.pass?(room.steps?'当前步骤通过。可在上方观察模型，两个步骤分别保存。':'任务完成。上方模型已收到本次结果，也可观看房内演示。'):res.error||res.hint||'结果尚未通过，请修改再运行。';$('successActions').hidden=!res.pass;$('runStatus').textContent=res.pass?'运行完成 · 进度已保存':res.timeout?'已安全终止':'请检查代码';taskSuccessActions();if(res.pass){if(res.step!=='power')environment.animate(res);updateProgress();if(!room.steps||lessonProgress(save,room.id).completed>=lessonProgress(save,room.id).total)journey.settlement(room);}$('taskStatus').textContent=taskStatusText();}
 catch(e){if(token===view){taskStage?.setResult({error:e.message});$('feedback').textContent='运行失败：'+e.message;$('runStatus').textContent='可修改后重试';}}
 finally{if(token===view){running=false;lockControls(false);}}
}
function button(text,fn,style=''){const b=document.createElement('button');b.textContent=text;b.className=style;b.onclick=fn;return b;}
function specialText(title,description){$('special').replaceChildren();const h=document.createElement('h3'),p=document.createElement('p');h.textContent=title;p.textContent=description;$('special').append(h,p);}
function renderArchive(){specialText('三份成绩资料','整理纸质成绩单，让后续统计任务读取完整数据。');for(let i=0;i<3;i++){$('special').append(button(save.papers[`2-${i}`]?`成绩单 ${i+1} · 已归档`:`归档成绩单 ${i+1}`,()=>{save.papers[`2-${i}`]=true;record('paper',`2-${i}`);updateProgress();renderArchive();environment.display('成绩资料已整理',`${[0,1,2].filter(j=>save.papers['2-'+j]).length} / 3 份已归档`);},'choice'));}if([0,1,2].every(i=>save.papers['2-'+i]))$('special').append(button('整理完成，返回走廊',finishAndGuide,'primary'));}
function renderNarrative(){lessonGuide?.dispose();lessonGuide=mountGuide(document.querySelector('.workBody>aside'),lessonGuideIds(room),{before:$('brief')});const text='八份成绩，需要逐个检查 scores[i] 是否达到180。如果名单变成80人、800人，还要手写这么多次判断吗？重复的判断可以交给循环。完成本区小测并提交后，进入循环教学区学习 while。';$('brief').textContent='观察上方八份成绩，逐个判断是否达到 180，思考怎样自动重复相同的检查。';specialText('衔接任务 · 从逐个判断走向自动循环',text);$('special').append(button('我理解了，完成本室任务',()=>{save.tasks[room.id]=3;record('pass',room.id);updateProgress();specialText('衔接任务完成','请从出口返回走廊，前往本区209考核室。完成小测和提交后，即可进入循环教学区。');environment.display('下一步：用 while 自动统计');$('special').append(button('完成并返回走廊',finishAndGuide,'primary'));},'primary'));}
function renderExam(){
 const lv=room.lv;if(!examAccessible(lv)){const todo=levels[lv-1].tasks.filter(t=>!save.tasks[t.id]);specialText('完成本区任务后开始小测','尚需完成：'+todo.map(t=>t.title).join('、'));const first=rooms.find(r=>r.lv===lv&&!save.tasks[r.id]);if(first)$('special').append(button(`前往补学 ${first.number} ${first.title}`,()=>{closeWork();guideTo(first);toast(`已为你规划前往 ${first.number} 的路线，沿绿色引导线走。`);},'primary'));return;}
 examUI=new ExamRoom({host:$('workstation'),renderer,environment:assets.env,lv,save,persist,record,teacher:levels[lv-1].teacher,onClose:closeWork,onSubmit:()=>{
   save.submitted[lv]=true;record('submit',lv);updateProgress();const all=[1,2,3].every(i=>save.submitted[i]&&done(i));environment.display(all?'新版课程全部完成':'本关作业已提交',all?'含 for 的全部课程已完成':'按学习地图继续完成剩余课程');toast(all?'新版课程全部完成，学习记录已保存。':save.submitted[3]&&!done(3)?'原考核记录已保留，请前往305补学新增 for 课程。':'作业提交成功，按学习地图继续。');if(all)campusMusic.setScene('celebration');maybeShowNextHint();
 }});
 attachExamJourney(examUI,journey,finishAndGuide,updateProgress);
}
async function returnToCampus(){
 if(transition)return;
 if(!persist()){toast('学习记录暂未保存成功，请导出记录后再返回校园。');return;}
 transition=true;keys.clear();movement.x=movement.z=0;
 if(renderer.xr.isPresenting){try{await renderer.xr.getSession().end();}catch{transition=false;toast('请退出头显预览后再推门。');return;}}
 location.href='./?from=classrooms&wing='+wing;
}
function interactionTarget(){
 if(!body||!environment)return null;
 const p=body.translation();let target=null,dist=1.65;
 for(const candidate of environment.interactions){
  if(candidate.y!==undefined&&Math.abs(p.y-.825-candidate.y)>.65)continue;
  const dx=candidate.x-p.x,dz=candidate.z-p.z,d=Math.hypot(dx,dz);
  if(d>=Math.min(dist,candidate.radius??1.65))continue;
  // A doorway behind the player must not undo the transition just completed.
  const aimX=(candidate.faceX??candidate.x)-p.x,aimZ=(candidate.faceZ??candidate.z)-p.z,aimDistance=Math.hypot(aimX,aimZ);
  if(['door','exit'].includes(candidate.type)&&aimDistance>.05&&(-Math.sin(yaw)*aimX-Math.cos(yaw)*aimZ)/aimDistance<.25)continue;
  target=candidate;dist=d;
 }
 return target;
}
function interact(){if(transition||modal||dialogOpen())return;near=interactionTarget();if(!near){toast(room?'请走到教室后门并面向出口，按 E / 空格 返回走廊。':'请走近并面向房门，再按 E / 空格 进入；回校园请沿绿色出口指示下楼。');return;}if(near.type==='door'){const r=rooms.find(r=>r.id===near.id),reason=locked(r);if(reason){toast(reason);return;}enterRoom(r);}else if(near.type==='exit')enterRoom(null,true);else if(near.type==='wing')directory();else if(near.type==='campus')returnToCampus();else openWork();}
$('interactBtn').onclick=interact;$('directoryBtn').onclick=directory;$('helpBtn').onclick=()=>{keys.clear();$('help').showModal();};$('closeWork').onclick=closeWork;$('runBtn').onclick=runCode;$('resetBtn').onclick=()=>{if(!running){$('code').value=room.task.tiers[tier];setDraft(room,tier,$('code').value);renderEditor();}};
// 快速传送：从教学楼直达校园任意目的地（先保存学习记录，再带 ?dest= 返回校园）。
const CAMPUS_DESTS=['校门','门内广场','教学楼·北楼','教学楼·中楼','综合楼','田径场','篮球场','游泳馆','篮球馆','食堂'];   // 与 index.html DESTS 保持同步
let teleportPanel=null;
function openTeleport(){
 keys.clear();
 if(!teleportPanel){
  teleportPanel=document.createElement('dialog');teleportPanel.id='teleportPanel';
  teleportPanel.innerHTML='<div class="dialogHead"><div><span class="eyebrow">CAMPUS TELEPORT</span><h2>快速传送 · 校园各地</h2></div><button data-close aria-label="关闭快速传送">×</button></div><p class="muted">选择地点后返回校园并直接到达；学习记录自动保留。</p><div id="teleportList" style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px"></div>';
  teleportPanel.querySelector('[data-close]').onclick=()=>teleportPanel.close();
  teleportPanel.addEventListener('click',e=>{
   const b=e.target.closest('[data-dest]');if(!b)return;
   if(!persist()){toast('学习记录暂未保存成功，请导出记录后再传送。');return;}
   location.href='./?dest='+encodeURIComponent(b.dataset.dest);
  });
  const list=teleportPanel.querySelector('#teleportList');
  for(const name of CAMPUS_DESTS){const b=document.createElement('button');b.dataset.dest=name;b.textContent=name;list.append(b);}
  document.body.append(teleportPanel);
 }
 teleportPanel.showModal();
}
$('teleportBtn').onclick=openTeleport;
$('cardBtn').onclick=()=>{const fold=$('knowledgeFold');fold.hidden=!fold.hidden;$('knowledgeCard').hidden=false;$('cardBtn').textContent=fold.hidden?'知识提示与知识卡（点开）':'收起知识提示';$('cardBtn').setAttribute('aria-expanded',String(!fold.hidden));};$('leaveTask').textContent='完成并返回走廊';$('leaveTask').onclick=finishAndGuide;
$('watchBtn').onclick=()=>{if(!result){toast('先点「运行代码并回放」生成结果，再观看房内演示。');return;}const res=result;closeWork();environment.animate(res);if(ballBody){ballBody.setTranslation({x:-2.35,y:.97,z:-2.25},true);ballBody.setLinvel({x:room.id==='1-2'?.14:.154,y:0,z:0},true);}body.setTranslation({x:0,y:.83,z:2.2},true);yaw=0;pitch=-.01;$('returnWork').hidden=false;};
$('returnWork').onclick=()=>{modal=true;campusMusic.duck('reading',true);view++;$('workstation').hidden=false;$('roomInfo').hidden=true;$('returnWork').hidden=true;keys.clear();if(room?.kind==='task'){taskStage=new TaskStage({room,levels,renderer,environment:assets.env,characters:assets.characters});taskStage.setResult(result);lessonGuide?.dispose();lessonGuide=mountGuide(document.querySelector('.workBody>aside'),lessonGuideIds(room,tier),{before:$('brief')});}};
$('exportBtn').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(save,null,2)],{type:'application/json'}));a.download='阳光中学-学习记录.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$('code').addEventListener('input',()=>{if(room?.task)setDraft(room,tier,$('code').value);});$('code').addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();e.target.setRangeText('    ',e.target.selectionStart,e.target.selectionEnd,'end');setDraft(room,tier,e.target.value);}});
addEventListener('keydown',e=>{if(e.code==='Escape'){if(modal)closeWork();else $('returnWork').hidden=true;return;}if(modal||dialogOpen()||e.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;if(['KeyE','Space'].includes(e.code)){e.preventDefault();if(!e.repeat)interact();return;}if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();keys.add(e.code);}});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',resetMovementInput);addEventListener('visibilitychange',()=>{if(document.hidden)resetMovementInput();});
function resetMovementInput(){keys.clear();movement.x=movement.z=0;look=joy=null;stick.firstElementChild.style.transform='';}
let look=null;
renderer.domElement.addEventListener('pointerdown',e=>{if(modal)return;look={id:e.pointerId,x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{if(!look||look.id!==e.pointerId)return;yaw-=(e.clientX-look.x)*.003;pitch=T.MathUtils.clamp(pitch-(e.clientY-look.y)*.003,-1.25,1.25);look.x=e.clientX;look.y=e.clientY;});
for(const type of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(type,()=>look=null);
let joy=null;const stick=$('touchMove');stick.addEventListener('pointerdown',e=>{joy={id:e.pointerId,x:e.clientX,y:e.clientY};stick.setPointerCapture(e.pointerId);});stick.addEventListener('pointermove',e=>{if(!joy||joy.id!==e.pointerId)return;movement.x=T.MathUtils.clamp((e.clientX-joy.x)/35,-1,1);movement.z=T.MathUtils.clamp((e.clientY-joy.y)/35,-1,1);stick.firstElementChild.style.transform=`translate(${movement.x*27}px,${movement.z*27}px)`;});for(const type of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(type,()=>{joy=null;movement.x=movement.z=0;stick.firstElementChild.style.transform='';});
let quality=true;const renderBudget=installRenderBudget({renderer,button:$('qualityBtn'),onChange:s=>{quality=s.ao;composer.setPixelRatio(s.ratio);ao.setSize(Math.round(innerWidth*.8),Math.round(innerHeight*.8));}});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);ao.setSize(Math.round(innerWidth*.8),Math.round(innerHeight*.8));});
let prev=0,frames=0,acc=0,fps=0,xrTurnReady=true;
renderer.setAnimationLoop(now=>{
 if(document.hidden&&!renderer.xr.isPresenting){prev=now;return;}
 if(!environment||!world)return;renderBudget.sample(prev?now-prev:16.7);const elapsed=prev?Math.min(1,(now-prev)/1000):.016;const dt=Math.min(.045,elapsed);prev=now;
 const blocked=transition||modal||dialogOpen();let x=0,z=0;
 if(!blocked){x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+movement.x;z=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+movement.z;}
 if(renderer.xr.isPresenting){for(const source of renderer.xr.getSession().inputSources){const axes=source.gamepad?.axes;if(!axes)continue;if(source.handedness==='left'){x=axes[2]||0;z=axes[3]||0;}else{const a=axes[2]||0;if(Math.abs(a)<.2)xrTurnReady=true;else if(Math.abs(a)>.7&&xrTurnReady){yaw-=Math.sign(a)*Math.PI/6;xrTurnReady=false;}}}rig.rotation.y=yaw;camera.rotation.set(0,0,0);}else{rig.rotation.y=0;camera.rotation.set(pitch,yaw,0);}
 const len=Math.max(1,Math.hypot(x,z)),speed=((keys.has('ShiftLeft')||keys.has('ShiftRight'))?3.8:2.8)*dt;
 // A constant downward displacement overwhelms stair ascent at high frame rates.
 const dx=(Math.cos(yaw)*x+Math.sin(yaw)*z)/len*speed,dz=(-Math.sin(yaw)*x+Math.cos(yaw)*z)/len*speed,pos=body.translation();
 // Downhill travel needs the stair's vertical distance as well as ground adhesion.
 // The character controller still resolves each solid tread; there is no ramp collider.
 const down=environment.stairwell?-1.2*dt-environment.stairwell.downwardTravel(pos.z,pos.z+dz):-.1;
 controller.computeColliderMovement(collider,{x:dx,y:down,z:dz});const move=controller.computedMovement();body.setNextKinematicTranslation({x:pos.x+move.x,y:pos.y+move.y,z:pos.z+move.z});world.timestep=dt;world.step();const p=body.translation();rig.position.set(p.x,p.y-.825,p.z);
 if(ballBody&&environment.ball){const b=ballBody.translation(),q=ballBody.rotation();environment.ball.position.set(b.x,b.y,b.z);environment.ball.quaternion.set(q.x,q.y,q.z,q.w);}
 if(!examUI&&!taskStage)environment.tick(now);near=interactionTarget();if(now-routeTick>250){refreshRoute();routeTick=now;}
 if(!room&&environment.stairwell)$('roomName').textContent=environment.stairwell.location(p);
 $('interactBtn').hidden=!near||blocked;if(near)$('interactBtn').lastElementChild.textContent=near.label;
 playerAvatar?.setEnabled(!renderer.xr.isPresenting);
 playerAvatar?.update({dt,position:rig.position,yaw,pitch,running:(keys.has('ShiftLeft')||keys.has('ShiftRight')),blocked,groundHeight:environment.stairwell?.groundHeight||(()=>rig.position.y)});
 renderer.info.reset();if(examUI)examUI.render3D();else if(taskStage)taskStage.render(dt);else if(quality&&!renderer.xr.isPresenting)composer.render(dt);else renderer.render(scene,camera);frames++;acc+=elapsed;if(acc>=1){fps=Math.round(frames/acc);frames=0;acc=0;}
});
window.__playerAvatar={state:()=>playerAvatar?.state()??{ready:false}};
window.__exam={state:()=>examUI?.state()||null};
window.__classroom={state:()=>({room:room?.id||null,wing,pos:{x:body?.translation().x,y:body?body.translation().y-.825:undefined,z:body?.translation().z,yaw:yaw*180/Math.PI},location:environment?.stairwell?.location(body?.translation())||room?.title,near:near?.id||near?.type||null,modal,running,fps,save:JSON.parse(JSON.stringify(save)),roomCount:rooms.length,taskStage:taskStage?.state()||null,journey:{...environment?.journeyState(),target:selected,routeBuilds},physicsColliders:world?.colliders.len(),actors:environment?.actors.state()||[],independentModel:environment?.model?{id:environment.model.id,file:environment.model.file,features:environment.model.features,sha256:environment.model.sha256}:null,render:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles},result,interactions:environment?.interactions.map(x=>({...x}))})};
try{
 await RAPIER.init();assets=await loadAssets(renderer);scene.environment=assets.env;scene.environmentIntensity=.42;scene.background=assets.hdr;scene.backgroundBlurriness=.4;
 try{playerAvatar=await PlayerAvatar.load({scene,camera,onFootstep:event=>playerFoley.step(event)});}catch(e){console.warn('[player] 身体模型加载失败',e);}
 await enterRoom(null);$('loading').hidden=true;
 const requested=new URLSearchParams(location.search).get('wing');if(['1','2','3'].includes(requested)){const w=+requested;if(w!==3||save.submitted[1]&&save.submitted[2]){wing=w;await enterRoom(null);}}
 const query=new URLSearchParams(location.search),mission=getMission(query.get('mission'));
 if(query.get('continue')==='1'&&continueNavigation?.page==='classrooms'){
  const target=rooms.find(r=>r.id===continueNavigation.room);if(target&&!locked(target))await enterRoom(target);
  query.delete('continue');history.replaceState(null,'',location.pathname+'?'+query);
 }
 if(mission&&save.examMissions?.[`${mission.lv}:${mission.tier}`]===mission.id&&String(mission.lv)===query.get('exam')){const exam=rooms.find(r=>r.id===`exam-${mission.lv}`);if(exam&&!locked(exam)&&examAccessible(exam.lv)){await enterRoom(exam);openWork();}}
 if(query.get('resumeExam')==='1'){const target=rooms.find(r=>r.id===`exam-${query.get('exam')}`);if(target&&!locked(target)&&examAccessible(target.lv)){await enterRoom(target);openWork();}query.delete('resumeExam');history.replaceState(null,'',location.pathname+'?'+query);}
 if(query.get('handbook')==='1'){journey.open();query.delete('handbook');history.replaceState(null,'',location.pathname+'?'+query);}
 if(navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr')){$('vrBtn').hidden=false;$('vrBtn').onclick=async()=>{try{closeWork();for(const d of document.querySelectorAll('dialog[open]'))d.close();const session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor']});await renderer.xr.setSession(session);}catch(e){toast('无法进入头显预览：'+e.message);}};}
}catch(e){console.error(e);$('loadText').textContent='教室加载失败：'+e.message+'。请刷新重试。';}
