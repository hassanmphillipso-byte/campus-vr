// Presentation-only budget: never changes simulation time, actors or scoring.
export class RenderBudget {
 constructor({dpr=1,touch=false,mode='auto',onChange=()=>{}}={}){this.dpr=Math.max(1,Number(dpr)||1);this.touch=touch;this.onChange=onChange;this.setMode(mode);}
 state(){const ratio=this.mode==='detail'?Math.min(this.dpr,2):this.mode==='smooth'||this.touch?1:Math.min(this.dpr,[1.5,1.25,1][this.level]);return {mode:this.mode,level:this.level,ratio,ao:this.mode==='detail'||this.mode==='auto'&&!this.touch&&this.level===0};}
 setMode(mode){if(!['auto','detail','smooth'].includes(mode))throw Error('未知画质模式');this.mode=mode;this.level=0;this.frames=[];this.elapsed=0;this.onChange(this.state());}
 sample(ms){if(this.mode!=='auto'||!Number.isFinite(ms)||ms<=0||ms>250)return;this.frames.push(ms);this.elapsed+=ms;if(this.elapsed<2500)return;const frames=this.frames.sort((a,b)=>a-b),slow=frames[Math.floor(frames.length*.75)]>24;this.frames=[];this.elapsed=0;if(slow&&this.level<2){this.level++;this.onChange(this.state());}}
}
export function installRenderBudget({renderer,button,touch=matchMedia('(pointer:coarse)').matches,onChange=()=>{}}){
 const key='campus.graphics.v1';let mode='auto';try{const stored=localStorage.getItem(key);if(['auto','detail','smooth'].includes(stored))mode=stored;}catch{}
 const labels={auto:'画质 · 自动',detail:'画质 · 精细',smooth:'画质 · 流畅'};
 const budget=new RenderBudget({dpr:devicePixelRatio,touch,mode,onChange:s=>{renderer.setPixelRatio(s.ratio);onChange(s);if(button){button.textContent=labels[s.mode];button.title='自动适配设备；精细保留高画质；流畅减少渲染负担。点击切换';button.setAttribute('aria-label',labels[s.mode]);}}});
 if(button)button.onclick=()=>{const modes=['auto','detail','smooth'];budget.setMode(modes[(modes.indexOf(budget.mode)+1)%modes.length]);try{localStorage.setItem(key,budget.mode);}catch{}};
 window.__renderBudget={state:()=>({...budget.state(),width:renderer.domElement.width,height:renderer.domElement.height})};return budget;
}
