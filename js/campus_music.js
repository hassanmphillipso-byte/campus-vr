// Shared scene music for campus and classrooms. Only starts after a user gesture.
const ROOT=new URL('../assets/audio/campus-music/',import.meta.url);
const SETTINGS='campus.music.v1';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const readSettings=()=>{try{return JSON.parse(localStorage.getItem(SETTINGS))||{};}catch{return {};}};
export function campusMusicScene(zone){
 if(/篮球|田径/.test(zone))return 'sports';
 if(/游泳/.test(zone))return 'pool';
 if(/主席台/.test(zone))return 'celebration';
 if(/教学楼|综合楼|行政楼/.test(zone))return 'classroom';
 if(/食堂/.test(zone))return 'corridor';
 return 'campus';
}
export function classroomMusicScene(room){return !room?'corridor':room.kind==='archive'||room.kind==='exam'?'reading':'classroom';}
class SceneMusic {
 constructor(){
  const pref=readSettings();this.enabled=pref.enabled!==false;this.volume=Number.isFinite(pref.volume)?clamp(pref.volume,0,1):.6;
  this.scene='campus';this.sceneWanted='campus';this.unlocked=false;this.masterOn=true;this.ducks=new Set();this.pauses=new Set();this.index={};this.sources=[];this.current=null;this.cache=new Map();this.failed=new Set();this.status='点击进入后播放';this.token=0;this.loading=false;
  this.ready=fetch(new URL('manifest.json',ROOT)).then(r=>{if(!r.ok)throw Error('配乐清单不可用');return r.json();}).then(m=>{this.manifest=m;this.tracks=new Map(m.tracks.map(t=>[t.id,t]));this.render();return m;}).catch(e=>{this.status=e.message;this.render();return null;});
  document.addEventListener('visibilitychange',()=>this.syncPause());
  addEventListener('pagehide',()=>{this.abort?.abort();this.ctx?.suspend();});
  addEventListener('pageshow',()=>this.syncPause());
  addEventListener('storage',e=>{if(e.key===SETTINGS){const s=readSettings();this.enabled=s.enabled!==false;this.volume=Number.isFinite(s.volume)?clamp(s.volume,0,1):.6;this.syncPause();this.gain();this.render();}});
  setInterval(()=>this.tick(),250);
  window.__campusMusic={state:()=>this.state()}; // Read-only diagnostics, no test-only playback controls.
 }
  async unlock(){
  if(!this.ctx){try{this.ctx=new (window.AudioContext||window.webkitAudioContext)({sampleRate:24000});this.master=this.ctx.createGain();this.master.gain.value=0;this.analyser=this.ctx.createAnalyser();this.analyser.fftSize=512;this.lp=this.ctx.createBiquadFilter();this.lp.type='lowpass';this.lp.frequency.value=Math.min(19500,this.ctx.sampleRate/2);this.muffled=false;this.master.connect(this.lp);this.lp.connect(this.analyser);this.analyser.connect(this.ctx.destination);}catch{this.status='此浏览器暂不支持配乐';this.render();return;}}
  this.unlocked=true;
  if(this.enabled&&this.masterOn&&!document.hidden&&!this.pauses.size)this.ctx.resume().catch(()=>{});
  this.gain();this.syncPause();await this.ready;if(!this.manifest)return;
  if(!this.current&&!this.loading&&this.enabled){this.failed.clear();this.change(false);}
  this.render();
 }
 gain(){if(!this.master)return;const p=this.master.gain,t=this.ctx.currentTime;this.targetGain=this.enabled&&this.masterOn?this.volume*(this.manifest?.playlists[this.scene]?.gain??1)*(this.ducks.size ? .23 : 1):0;p.cancelScheduledValues(t);p.setValueAtTime(p.value,t);p.linearRampToValueAtTime(this.targetGain,t+(this.targetGain===0 ? .18 : this.ducks.size ? .25 : .8));}
 save(){try{localStorage.setItem(SETTINGS,JSON.stringify({enabled:this.enabled,volume:this.volume}));}catch{}}
 setEnabled(v){
  const retry=v&&this.status.startsWith('本区配乐暂不可用');
  this.enabled=v;this.save();this.gain();
  if(v){if(retry)this.failed.clear();this.unlock().then(()=>{if(retry&&!this.loading)this.change(false);});}
  this.syncPause();this.render();
 }
 setMasterEnabled(v){this.masterOn=v;this.gain();this.syncPause();this.render();}
 setMuffled(on){ // 水下闷音：master 后串低通（~760Hz），上岸回全频（体育玩法真实化 §3.5）
  if(!this.lp||!this.ctx||this.muffled===!!on)return;this.muffled=!!on;
  const t=this.ctx.currentTime;this.lp.frequency.cancelScheduledValues(t);
  this.lp.frequency.setTargetAtTime(on?760:Math.min(19500,this.ctx.sampleRate/2),t,.12);
 }
 duck(reason,on){const before=this.ducks.size;if(on)this.ducks.add(reason);else this.ducks.delete(reason);if(before!==this.ducks.size)this.gain();}
 setPaused(reason,on){const before=this.pauses.size;if(on)this.pauses.add(reason);else this.pauses.delete(reason);if(before!==this.pauses.size)this.syncPause();}
 syncPause(){clearTimeout(this.pauseTimer);if(!this.ctx)return;if(document.hidden||this.pauses.size||!this.enabled||!this.masterOn){this.pauseTimer=setTimeout(()=>{if(document.hidden||this.pauses.size||!this.enabled||!this.masterOn)this.ctx.suspend().catch(()=>{});},document.hidden||this.pauses.size?0:300);}else if(this.unlocked)this.ctx.resume().catch(()=>{});this.render();}
 setScene(scene,{immediate=false}={}){
  if(this.sceneWanted===scene&&(!immediate||this.scene===scene))return;
  this.sceneWanted=scene;clearTimeout(this.sceneTimer);
  const apply=()=>{if(this.scene===scene)return;this.scene=scene;this.gain();this.change(false);this.render();};
  if(immediate)apply();else this.sceneTimer=setTimeout(apply,1200);
 }
 list(){return this.manifest?.playlists[this.scene]?.tracks||[];}
 async buffer(id,signal){
  if(this.cache.has(id))return this.cache.get(id);
  const r=await fetch(new URL(this.tracks.get(id).file,ROOT),{signal});if(!r.ok)throw Error('音频资源读取失败');
  const bytes=new Uint8Array(await r.arrayBuffer());if(new TextDecoder().decode(bytes.subarray(0,6))!=='CVBGM1')throw Error('音频资源格式不正确');
  const raw=bytes.slice(6);for(let i=0;i<raw.length;i++)raw[i]^=(i*31+167)&255;
  const decoded=await this.ctx.decodeAudioData(raw.buffer);if(signal.aborted)throw new DOMException('Aborted','AbortError');
  this.cache.set(id,decoded);while(this.cache.size>2)this.cache.delete(this.cache.keys().next().value);return decoded;
 }
 async change(advance){
  if(!this.manifest||!this.ctx||!this.unlocked)return;
  const list=this.list();
  if(!list.length){ // 空播放列表=静场（BGMDirector campus-deep 深夜让位自然声景，总案 §4.3）：按既有交叉淡化收掉当前曲
   this.prefetchAbort?.abort();this.prefetchId=null;this.abort?.abort();
   this.token++;this.loading=false;                       // 使在途加载作废（unlock 期 scene 已切到空列表的竞态：晚到的 change 不得再起声）
   if(this.current){
    const now=this.ctx.currentTime,fade=this.manifest.crossfadeSeconds;
    for(const s of [...this.sources]){s.gain.gain.cancelScheduledValues(now);s.gain.gain.setValueAtTime(s.gain.gain.value,now);s.gain.gain.linearRampToValueAtTime(0,now+fade);try{s.node.stop(now+fade+.02);}catch{}}
    this.current=null;
   }
   this.status='本区暂无配乐 · 只余自然声景';this.render();
   return;
  }
  let index=this.index[this.scene]||0;if(advance)index=(index+1)%list.length;
  for(let i=0;i<list.length&&this.failed.has(list[index]);i++)index=(index+1)%list.length;
  if(this.failed.has(list[index])){this.status='本区配乐暂不可用，点击开启重试';this.loading=false;this.render();return;}
  this.index[this.scene]=index;const id=list[index];
  this.prefetchAbort?.abort();this.prefetchId=null;
  this.abort?.abort();const controller=new AbortController();this.abort=controller;const token=++this.token;this.loading=true;this.status='正在准备配乐…';this.render();
  if(!advance&&this.current?.id===id){this.loading=false;this.status='正在播放';this.render();return;}
  const timeout=setTimeout(()=>controller.abort(),20000);
  try{
   const buf=await this.buffer(id,controller.signal);if(token!==this.token)return;
   // At most two live sources during crossfade; old completed transitions are released.
   for(const s of [...this.sources])if(s!==this.current)this.release(s);
   const now=this.ctx.currentTime,fade=this.manifest.crossfadeSeconds;
   const node=this.ctx.createBufferSource(),gain=this.ctx.createGain();node.buffer=buf;node.connect(gain);gain.connect(this.master);
   gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(1,now+fade);
   const old=this.current;if(old){old.gain.gain.cancelScheduledValues(now);old.gain.gain.setValueAtTime(old.gain.gain.value,now);old.gain.gain.linearRampToValueAtTime(0,now+fade);try{old.node.stop(now+fade+.02);}catch{}}
   const item={id,node,gain,start:now,end:now+buf.duration};this.sources.push(item);this.current=item;
   node.onended=()=>{this.release(item);if(this.current===item){this.current=null;if(!this.loading)this.change(true);}};
   node.start(now);this.status='正在播放';this.lastError=null;this.syncPause();
  }catch(e){if(token!==this.token)return;this.failed.add(id);this.lastError=id+': '+e.message;this.status='此曲不可用，正在换下一首';setTimeout(()=>{if(token===this.token)this.change(true);},300);}
  finally{clearTimeout(timeout);if(token===this.token){this.loading=false;this.render();}}
 }
 release(s){s.node.onended=null;try{s.node.stop();}catch{}s.node.disconnect();s.gain.disconnect();s.node.buffer=null;this.sources=this.sources.filter(x=>x!==s);}
 tick(){
  if(!this.ctx||this.ctx.state!=='running'||!this.current||this.loading)return;
  const left=this.current.end-this.ctx.currentTime;
  if(left<12&&!this.prefetchId){const list=this.list(),id=list[((this.index[this.scene]||0)+1)%list.length];this.prefetchId=id;this.prefetchAbort=new AbortController();this.buffer(id,this.prefetchAbort.signal).catch(()=>{});}
  if(left<this.manifest.crossfadeSeconds)this.change(true);
 }
 state(){
  let rms=0;if(this.analyser){const a=new Float32Array(512);this.analyser.getFloatTimeDomainData(a);rms=Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length);}
  return {scene:this.scene,wantedScene:this.sceneWanted,track:this.current?.id||null,title:this.tracks?.get(this.current?.id)?.title||null,status:this.status,loading:this.loading,enabled:this.enabled,masterOn:this.masterOn,volume:this.volume,duckReasons:[...this.ducks],pauseReasons:[...this.pauses],targetGain:this.targetGain||0,context:this.ctx?.state||'locked',currentTime:this.current?Math.max(0,this.ctx.currentTime-this.current.start):0,duration:this.current?this.current.end-this.current.start:0,activeSources:this.sources.length,cacheCount:this.cache.size,rms,lastError:this.lastError||null,failed:[...this.failed]};
 }
 mount(button){
  this.button=button;button.title='配乐设置';button.setAttribute('aria-label','配乐设置');
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./campus_music.css',import.meta.url);document.head.append(css);
  const panel=document.createElement('dialog');panel.id='musicPanel';panel.setAttribute('aria-label','场景配乐');
  panel.innerHTML='<div class="music-head"><div><small>阳光中学 · 场景配乐</small><h2>让声音跟随空间</h2></div><button id="musicClose" aria-label="关闭配乐设置">×</button></div><p id="musicZone"></p><strong id="musicTrack"></strong><p id="musicAuthor"></p><div class="music-actions"><button id="musicToggle"></button><button id="musicNext">本区下一首</button></div><label class="music-volume" for="musicVolume">配乐音量 <output id="musicVolumeText"></output></label><input id="musicVolume" type="range" min="0" max="100" step="1"><p id="musicStatus" role="status"></p><p class="music-note">进入不同区域自动换曲，切换时渐变过渡。讲解和读题时降低配乐音量。</p><details><summary>本区曲目与音乐署名</summary><div id="musicCredits"></div><a href="music-credits.html" target="_blank" rel="noopener">查看全部音乐来源</a></details>';
  document.body.append(panel);this.panel=panel;const $=id=>panel.querySelector('#'+id);
  button.addEventListener('click',()=>{this.unlock();if(!panel.open)panel.showModal();this.render();});$('musicClose').onclick=()=>panel.close();
  $('musicToggle').onclick=()=>this.setEnabled(!this.enabled);$('musicNext').onclick=()=>{this.unlock();if(!this.loading)this.change(true);};
  $('musicVolume').oninput=e=>{this.volume=+e.target.value/100;this.save();this.gain();this.render();};
  panel.addEventListener('keydown',e=>e.stopPropagation());panel.addEventListener('click',e=>e.stopPropagation());this.render();
 }
 render(){
  if(!this.panel)return;const $=id=>this.panel.querySelector('#'+id),t=this.tracks?.get(this.current?.id),playlist=this.manifest?.playlists[this.scene];
  this.button.textContent=this.enabled?'♫':'♪';this.button.setAttribute('aria-pressed',String(this.enabled));
  $('musicZone').textContent=playlist?.label||'场景配乐';$('musicTrack').textContent=t?.title||'准备好后，音乐会自然响起';$('musicAuthor').textContent=t?.author||'';
  $('musicToggle').textContent=this.enabled?'关闭配乐':'开启配乐';$('musicToggle').setAttribute('aria-pressed',String(this.enabled));$('musicNext').disabled=this.loading||!this.enabled||!this.manifest;
  $('musicVolume').value=String(Math.round(this.volume*100));$('musicVolumeText').textContent=Math.round(this.volume*100)+'%';
  $('musicStatus').textContent=!this.enabled?'配乐已关闭':!this.masterOn?'校园总声音已关闭':this.status;
  const credits=$('musicCredits');credits.replaceChildren();for(const id of this.list()){const track=this.tracks.get(id),p=document.createElement('p'),a=document.createElement('a');a.textContent=track.title+' — '+track.author;a.href=track.source;a.target='_blank';a.rel='noopener';p.append(a);credits.append(p);}
 }
}
export const campusMusic=new SceneMusic();
