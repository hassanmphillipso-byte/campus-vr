import {campusMusic} from '../campus_music.js';
import {VENUE_CAST} from './activities.js';
export const PROGRAMMES={
 music:{title:'音乐社 · 排练开放日',copy:'舞台上是钢琴社、合唱社和音乐老师。可以坐到真钢琴前自由弹奏，听同学弹一首公版钢琴曲，或跟随亮起的拍点参加8拍节奏练习。',items:[['piano','到钢琴前弹奏'],['listen','听同学弹钢琴曲'],['performance','观看钢琴排练'],['rhythm','参加8拍节奏练习']]},
 gym:{title:'体育社 · 热身训练',copy:'同学正在三个训练垫上做拉伸，老师在旁指导。选择训练项目后，进入已有的正式体育玩法；训练读数可回到考核室学习。',items:[['training','参加体育训练']]},
 pool:{title:'泳队 · 更衣与出发准备',copy:'这里是游泳馆的更衣扩建和下水前热身区。泳队与指导老师在此准备；自由泳、蛙泳同学和救生员在旁边主泳池。点击前往主泳池，在计时起点按 E 参加真实游泳训练。',items:[['swim','前往主泳池训练']]},
 basketball:{title:'篮球队 · 投篮训练',copy:'队员练习控球，记录员核对成绩，教练指导动作。你可以参加已有的蓄力投篮训练；队员练习球不计入你的成绩。',items:[['basketball','开始篮球训练']]},
 classroom:{title:'自习组 · 编程复习',copy:'同学阅读和核对练习，老师提供答疑指导。前往学习中心继续课程、考试或重考，原学习记录保留。',items:[['study','前往学习中心']]},
 tennis:{title:'网球社 · 赛前准备',copy:'同学在场边拉伸，老师核对器材。本馆目前提供场地参观和赛前准备，尚无可玩的网球比赛。',items:[['tennis','查看球场使用说明']]},
};
const node=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
export class VenueProgrammes{
 constructor(a){this.a=a;this.playing=false;this.oscillators=new Set();this.scheduleInfo=null;this.dialog=node('dialog');this.dialog.className='venueProgramme';this.dialog.setAttribute('aria-labelledby','venueTitle');document.body.append(this.dialog);this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.close();});this.dialog.addEventListener('pointerdown',e=>e.stopPropagation());this.dialog.addEventListener('click',e=>{if(e.target===this.dialog)this.close();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.playing){this.stop();if(this.feedback)this.feedback.textContent='页面已隐藏，演奏已停止；可以重新开始。';}});}
 get open(){return this.dialog.open;}
 button(label,fn,parent=this.actions){const b=node('button',label);b.type='button';b.onclick=fn;parent.append(b);return b;}
 show(v){
  this.stop();this.v=v;this.a.cancelInput();const info=PROGRAMMES[v.id];this.dialog.replaceChildren();const header=node('header'),title=node('h2',info.title);title.id='venueTitle';header.append(title);this.button('关闭',()=>this.close(),header).ariaLabel='关闭场馆活动';this.dialog.append(header,node('p',info.copy));
  const roster=node('ul');roster.className='venueRoster';for(const s of VENUE_CAST[v.id])roster.append(node('li',`${s[0]} · ${s[1]}`));this.dialog.append(roster);
  if(v.id==='music'&&this.scheduleInfo){const s=this.scheduleInfo();if(s&&s.nodeType===1)this.dialog.append(s);}
  this.actions=node('div');this.actions.className='venueActions';this.dialog.append(this.actions);for(const [id,label] of info.items)this.button(label,()=>this.dispatch(id));
  this.feedback=node('p','自由社团活动不授星、不发金币，不影响考试记录。');this.feedback.setAttribute('role','status');this.dialog.append(this.feedback);
  if(v.id==='music'){this.beats=node('div');this.beats.className='venueBeats';this.beats.setAttribute('aria-label','8拍练习进度');for(let i=0;i<8;i++)this.beats.append(node('span',String(i+1)));this.dialog.append(this.beats);this.tap=this.button('跟拍 · 点击这里',e=>{if(e.detail===0)this.hit(e.timeStamp);});this.tap.onpointerdown=e=>{e.preventDefault();this.hit(e.timeStamp);};this.tap.disabled=true;this.button('停止演奏',()=>{this.stop();this.feedback.textContent='已停止；可以重新演奏或练习。';});this.dialog.append(node('p','节奏音量跟随配乐设置；静音时仍可看拍点。旋律为本项目程序合成的练习曲。'));const credit=node('p','钢琴采样：Salamander Grand Piano V3（CC-BY · Alexander Holm）· 曲目：Mutopia Project 公版乐谱');credit.style.cssText='margin:2px 0 0;font-size:11.5px;opacity:.62';this.dialog.append(credit);}
  this.dialog.showModal();header.querySelector('button').focus();
 }
 dispatch(id){ // piano/listen 走真钢琴模块（window 注入，避免建设系统硬依赖 piano.js），其余沿用原链路
  if(id==='piano'){const p=window.__campusPiano;if(!p?.enterPlayMode){this.a.notice?.('钢琴模块加载中，请稍后再试');return;}this.close();p.enterPlayMode();return;}
  if(id==='listen'){this.showSongList();return;}
  if(id==='performance'||id==='rhythm')return this.start(id);
  this.launch(id);
 }
 showSongList(){ // 曲目点歌台：公版曲目列表 → 点选即交给 CampusPiano 演奏
  const p=window.__campusPiano;
  if(!p?.playSong){this.a.notice?.('钢琴模块加载中，请稍后再试');return;}
  const list=typeof p.songs==='function'?p.songs():[];
  if(!list.length){this.a.notice?.('曲目清单暂不可用，请稍后再试');return;}
  this.stop();this.dialog.replaceChildren();
  const header=node('header'),title=node('h2','钢琴曲 · 点歌台');title.id='venueTitle';header.append(title);this.button('关闭',()=>this.close(),header).ariaLabel='关闭曲目列表';this.dialog.append(header);
  this.dialog.append(node('p','钢琴社同学准备了四首公版钢琴曲，点一首坐下来听。'));
  const roster=node('ul');roster.className='venueRoster';
  for(const s of list){const li=node('li');const b=this.button(`《${s.title}》— ${s.composer}`,()=>{this.close();p.playSong(s.id);},li);b.style.cssText='font:inherit;background:transparent;color:inherit;padding:0;text-decoration:underline';li.append(node('span',' · Mutopia Project 公版乐谱'));roster.append(li);}
  this.dialog.append(roster);
  const credit=node('p','钢琴采样：Salamander Grand Piano V3（CC-BY · Alexander Holm）· 曲目：Mutopia Project 公版乐谱');credit.style.cssText='margin:2px 0 0;font-size:11.5px;opacity:.62';this.dialog.append(credit);
 }
 launch(action){this.close();setTimeout(()=>this.a.action(action),0);}   // 延后一拍：dialog toggle 事件先递减 _dialogsOpen，再开面板（新 Chrome toggle 异步派发，同步链路会被 available() 拦）
 async start(mode){
  this.stop();const token=++this.token;this.mode=mode;this.dialog.dataset.mode=mode;this.dialog.dataset.beat='-2';this.dialog.dataset.phase='0';this.hitLog=[];this.hits=Array(8).fill(null);this.playing=true;this.started=performance.now()+1200;this.lastBeat=-1;this.feedback.textContent='预备两拍，跟随亮点。'+(mode==='rhythm'?'亮点出现后轻点一次，留有跟拍反应时间。':'正在观看钢琴社练习。');this.tap.disabled=mode!=='rhythm';this.beats.children&&[...this.beats.children].forEach(e=>e.className='');
  campusMusic.duck('venue-performance',true);
  try{this.audio??=new (window.AudioContext||window.webkitAudioContext)();await this.audio.resume();if(token!==this.token)return;}catch{this.feedback.textContent='声音暂不可用，仍可看亮点完成练习。';}
  this.frame=requestAnimationFrame(()=>this.tick());
 }
 tone(index,accent=false){
  if(!this.audio||this.audio.state!=='running'||!campusMusic.enabled||!campusMusic.masterOn)return;
  const melody=[60,64,67,64,62,65,69,67,64,67,72,71,69,67,64,60],pitch=this.mode==='performance'?melody[index%melody.length]:accent?79:72;
  const o=this.audio.createOscillator(),g=this.audio.createGain(),t=this.audio.currentTime;o.type='triangle';o.frequency.value=440*2**((pitch-69)/12);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,.15*campusMusic.volume),t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.48);o.connect(g);g.connect(this.audio.destination);this.oscillators.add(o);o.onended=()=>{this.oscillators.delete(o);o.disconnect();g.disconnect();};o.start(t);o.stop(t+.5);
 }
 tick(){
  if(!this.playing)return;const elapsed=performance.now()-this.started,beat=Math.floor(elapsed/600),limit=this.mode==='performance'?16:8;
  this.dialog.dataset.beat=String(beat);this.dialog.dataset.phase=String((elapsed%600)/600);
  if(beat>=limit){const hits=this.hits.filter(Boolean).length;const mode=this.mode;this.stop();this.feedback.textContent=mode==='rhythm'?`练习完成：${hits} / 8 拍跟上。可重玩；不计考试成绩或金币。`:'钢琴练习结束；可重播或参加节奏练习。';return;}
  if(beat>=0&&beat!==this.lastBeat){this.lastBeat=beat;this.cueAt=performance.now();this.tone(beat,beat%4===0);[...this.beats.children].forEach((e,i)=>e.classList.toggle('active',i===beat%8));this.feedback.textContent=this.mode==='rhythm'?`第 ${beat+1} / 8 拍 · 亮点出现时点“跟拍”`:`钢琴社练习 · 第 ${beat+1} / 16 拍`;}
  this.frame=requestAnimationFrame(()=>this.tick());
 }
 hit(timestamp=performance.now()){
  if(!this.playing||this.mode!=='rhythm')return;const index=this.lastBeat,error=timestamp-this.cueAt;this.hitLog.push({index,error,accepted:index>=0&&index<8&&error>=0&&error<=420&&this.hits[index]===null});
  if(index<0||index>=8||error<0||error>420){this.feedback.textContent='再跟亮点试一次，不用连续乱点。';return;}
  if(this.hits[index]!==null){this.feedback.textContent='这拍已经记录，等下一拍。';return;}
  this.hits[index]=true;this.beats.children[index].classList.add('hit');this.feedback.textContent=`第 ${index+1} 拍跟上了！`;
 }
 stop(){this.token=(this.token||0)+1;this.playing=false;this.dialog.dataset.mode='';cancelAnimationFrame(this.frame);for(const o of this.oscillators)try{o.stop();}catch{}if(this.tap)this.tap.disabled=true;campusMusic.duck('venue-performance',false);}
 close(){this.stop();this.dialog.close();this.a.cancelInput();document.getElementById('constructionEntry')?.focus();}
 state(){return {open:this.open,venue:this.v?.id,playing:this.playing,mode:this.mode,beat:this.lastBeat,hits:this.hits?.filter(Boolean).length||0,hitLog:this.hitLog||[]};}
}
