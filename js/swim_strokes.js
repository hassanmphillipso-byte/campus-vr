/* ---------- 游泳四泳姿参数层（swim_strokes.js） ----------
 * 原则：泳姿只改「手感」——划频/每划冲量/极速/纵向水阻/起伏幅度与频率/划水音量，
 * 绝不触碰距离累积与到达判定（dist 口径红线在 index.html，本模块不碰）。
 * 与 index.html 的唯一耦合是 window.__swimStrokes.params()：
 * 游泳训练激活时返回当前泳姿参数；未激活（含考核/自由游）返回 null，
 * index.html 回退到原写死手感，考核口径不受任何影响。 */
export const SWIM_STROKES = {
  freestyle:    {name:'自由泳', cycle:1.2, cycleSprint:0.8, impulse:2.2,  cap:3.0, capSprint:3.5, dragK:0.62, bobAmp:0.05, bobHz:2.1, strokeGain:1.0,  desc:'均衡高效，最快的主流泳姿', tint:''},                              // = 原版手感
  breaststroke: {name:'蛙泳',   cycle:1.8, cycleSprint:1.2, impulse:2.9,  cap:2.6, capSprint:3.0, dragK:0.45, bobAmp:0.09, bobHz:1.4, strokeGain:1.15, desc:'蹬腿猛、滑行远，划一下歇一下', tint:'rgba(46,139,110,.30)'},     // 高冲量低极速低水阻 → 一蹬一滑
  backstroke:   {name:'仰泳',   cycle:1.3, cycleSprint:0.9, impulse:2.1,  cap:2.7, capSprint:3.1, dragK:0.60, bobAmp:0.03, bobHz:2.3, strokeGain:0.8,  desc:'起伏小、身位稳，省力长游', tint:'rgba(120,190,235,.30)'},        // 起伏最小 = 稳
  butterfly:    {name:'蝶泳',   cycle:1.0, cycleSprint:0.7, impulse:2.35, cap:3.4, capSprint:3.8, dragK:0.66, bobAmp:0.13, bobHz:1.1, strokeGain:1.25, desc:'海豚式大起伏，爆发力拉满', tint:'rgba(96,120,220,.32)'},          // 划频最快 + 最大起伏
};
const ORDER = ['freestyle','breaststroke','backstroke','butterfly'];   // 键盘 1-4 / 按钮顺序
let current = 'freestyle';   // 初始自由泳 = 原版手感（考核安全：无 UI 入口时切不走）
let live = false;            // 只有游泳训练激活时 params() 才返回参数
export function setStroke(id){ if(!Object.prototype.hasOwnProperty.call(SWIM_STROKES,id))return false; current=id; strokeHUD.sync(); return true; }
export function setStrokeLive(on){ live=!!on; if(!live)strokeHUD.hide(); strokeHUD.sync(); }   // 关闭参数层时顺手收起 HUD（单一入口防漏）
export function strokeState(){ return {current, live, params: live?SWIM_STROKES[current]:null}; }

/* 轻量 DOM 泳姿条：左下角「当前泳姿 + 特点 + 四选一按钮」，样式全内联不依赖 CSS 文件。
 * 键盘 1-4 仅在可见时生效；带 Ctrl/Meta/Alt 修饰不抢（浏览器标签快捷键不受影响）。 */
export class StrokeHUD{
  constructor(){
    this.visible=false; this.disabled=false;
    this.root=document.createElement('div'); this.root.id='strokeHud';
    this.root.style.cssText='position:fixed;left:18px;bottom:26px;z-index:75;display:none;flex-direction:column;gap:6px;padding:12px 14px;background:#102532f2;border:1px solid #ffffff36;border-radius:14px;color:#eff8fb;font:13px/1.45 system-ui;box-shadow:0 12px 40px #0005;backdrop-filter:blur(10px);max-width:260px';
    for(const ev of ['pointerdown','pointerup','click'])this.root.addEventListener(ev,e=>e.stopPropagation());   // 点按钮不转镜头/不起虚拟摇杆
    this.title=document.createElement('strong'); this.title.style.cssText='color:#93ebcc;font-size:14px'; this.root.append(this.title);
    this.desc=document.createElement('p'); this.desc.style.cssText='margin:0;color:#c2d1d9'; this.root.append(this.desc);
    const row=document.createElement('div'); row.style.cssText='display:flex;gap:6px';
    this.btns=ORDER.map((id,i)=>{const b=document.createElement('button'); b.textContent=(i+1)+' '+SWIM_STROKES[id].name;
      b.style.cssText='flex:1;padding:8px 4px;min-height:40px;border-radius:8px;border:1px solid #ffffff40;background:#223e4c;color:#fff;cursor:pointer;font:inherit;touch-action:none;user-select:none';
      b.onclick=()=>{if(!this.disabled)setStroke(id);b.blur();}; row.append(b); return b;});
    this.root.append(row); document.body.append(this.root);
    this._key=e=>{ if(!this.visible||e.ctrlKey||e.metaKey||e.altKey)return; const m=/^(?:Digit|Numpad)([1-4])$/.exec(e.code); if(!m)return; e.preventDefault(); if(!this.disabled)setStroke(ORDER[m[1]-1]); };
    addEventListener('keydown',this._key,true);
    this.sync();
  }
  show(){ this.visible=true; this.root.style.display='flex'; this.sync(); }
  hide(){ this.visible=false; this.root.style.display='none'; }
  setDisabled(v){ this.disabled=!!v; this.sync(); }
  sync(){   // 刷新当前泳姿名/特点/按钮选中态（模块级 current 变化后调用）
    const p=SWIM_STROKES[current];
    this.title.textContent='当前泳姿 · '+p.name; this.desc.textContent=p.desc;
    this.btns.forEach((b,i)=>{const on=ORDER[i]===current;
      b.style.background=on?'#93ebcc':'#223e4c'; b.style.color=on?'#102c29':'#fff';
      b.style.fontWeight=on?'700':'400'; b.style.borderColor=on?'transparent':'#ffffff40'; b.disabled=this.disabled;});
  }
}
export const strokeHUD=new StrokeHUD();
/* 全局诊断/测试口：params() 未激活恒返回 null（index.html 回退默认值）；all() 供测试枚举四泳姿参数 */
window.__swimStrokes={state:()=>strokeState(), set:id=>setStroke(id), params:()=>live?SWIM_STROKES[current]:null, all:()=>SWIM_STROKES};
