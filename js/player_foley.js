/** Local, gesture-unlocked shoe contact sounds. No network audio or camera motion. */
export class PlayerFoley {
  constructor({enabled=()=>true}={}) {
    this.allowed=enabled;this.enabled=true;this.played=0;this.lastAt=-Infinity;this.active=new Set();
    try{this.enabled=localStorage.getItem('campus-footsteps')!=='off';}catch{}
    this.unlock=()=>{
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
      if(!this.ctx){
        try{this.ctx=new Audio();}catch{return;}this.bus=this.ctx.createGain();this.analyser=this.ctx.createAnalyser();this.analyser.fftSize=256;
        this.bus.connect(this.analyser);this.analyser.connect(this.ctx.destination);
        this.noise=this.ctx.createBuffer(1,Math.ceil(this.ctx.sampleRate*.13),this.ctx.sampleRate);
        const a=this.noise.getChannelData(0);let seed=813;for(let i=0;i<a.length;i++){seed=(1664525*seed+1013904223)>>>0;a[i]=(seed/4294967296*2-1)*Math.exp(-i/a.length*4);}
      }
      if(!document.hidden)this.ctx.resume().catch(()=>{});
    };
    for(const e of ['pointerdown','keydown'])addEventListener(e,this.unlock,{passive:true});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.silence();this.ctx?.suspend().catch(()=>{});}});
  }
  mount(){
    const actions=document.querySelector('#musicPanel .music-actions');if(!actions||this.button)return;
    actions.style.flexWrap='wrap';
    const b=document.createElement('button');b.id='footstepToggle';actions.append(b);this.button=b;this.render();
    b.onclick=()=>{this.enabled=!this.enabled;try{localStorage.setItem('campus-footsteps',this.enabled?'on':'off');}catch{}if(!this.enabled)this.silence();else this.unlock();this.render();};
  }
  render(){if(this.button){this.button.textContent=this.enabled?'关闭脚步声':'开启脚步声';this.button.setAttribute('aria-pressed',String(this.enabled));}}
  silence(){for(const s of this.active){try{s.stop();}catch{}}this.active.clear();}
  step(event){
    if(!this.enabled||!this.allowed()||document.hidden||this.ctx?.state!=='running')return;
    const t=this.ctx.currentTime;if(t-this.lastAt<.12)return;this.lastAt=t;
    const source=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),gain=this.ctx.createGain();
    source.buffer=this.noise;source.playbackRate.value=event.side==='L'?.97:1.035;filter.type='lowpass';filter.frequency.value=event.running?900:680;
    const level=event.running?.21:.13;gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(level,t+.006);gain.gain.exponentialRampToValueAtTime(.0001,t+.12);
    source.connect(filter);filter.connect(gain);gain.connect(this.bus);source.onended=()=>{this.active.delete(source);source.disconnect();filter.disconnect();gain.disconnect();};
    this.active.add(source);source.start(t);source.stop(t+.14);this.played++;this.lastSide=event.side;
  }
  state(){
    let rms=0;if(this.analyser){const a=new Float32Array(this.analyser.fftSize);this.analyser.getFloatTimeDomainData(a);rms=Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length);}
    return {enabled:this.enabled,allowed:!!this.allowed(),context:this.ctx?.state||'locked',played:this.played,lastSide:this.lastSide||null,active:this.active.size,rms};
  }
}
