/* 实时天气（2026-10-17）：Open-Meteo current → 晴/多云/雨 三态，经 Weather.live() 驱动
 * 数据源 https://open-meteo.com（CC-BY 4.0，免 key，CORS 开放）；默认坐标南昌 28.682,115.8579（?lat=/?lon= 可覆盖）。
 * 开关优先级：?live=on|off 显式 > ?weather= 手动强制（禁用 live，手动优先）> 自动化（navigator.webdriver）默认关不打外网 > 真浏览器默认开。
 * 红线：网络只是锦上添花——fetch 全 try/catch + 8s 超时，任何故障只降级天气（释放回本地模拟），绝不影响校园加载；无常驻 UI（仅 toast）。 */

const CACHE_KEY='campus.weather.live.v1',CACHE_TTL=30*60e3; // 缓存 30 分钟：开页先用上次天气立即生效，再后台刷新
const FETCH_MS=8e3,POLL_MS=20*60e3;                         // 单次请求 8s 超时；每 20 分钟刷新一次
const ZH={sunny:'晴',cloudy:'多云',rain:'雨'};
const API=(lat,lon)=>`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
 +`&current=weather_code,temperature_2m,precipitation,cloud_cover,wind_speed_10m&timezone=Asia%2FShanghai`;
// WMO weather code → 三态：0-1 晴；2-3/45/48 多云（含雾/雾凇）；51+ 一律雨（毛雨/雨/雪/阵雨/雷暴——南方少雪简化）
const wmoToMode=c=>typeof c==='number'&&Number.isFinite(c)?(c<=1?'sunny':c<=48?'cloudy':'rain'):null;

export class WeatherLive{
 constructor({weather=null,toast=()=>{}}={}){
  this.weather=weather;this.toast=toast;
  this.mode=null;this.tempC=null;this.code=null;this.at=null;this.ok=false;this.lastError=null;
  this.started=false;this.timer=null;this.helloToasted=false;this.fallbackToasted=false;
  const q=new URLSearchParams(location.search);
  const la=parseFloat(q.get('lat')),lo=parseFloat(q.get('lon')); // ?lat=/?lon= 覆盖坐标（默认南昌）
  this.lat=Number.isFinite(la)?la:28.682;this.lon=Number.isFinite(lo)?lo:115.8579;
  const lv=q.get('live');
  this.enabled=!q.get('weather')&&(lv===null?!navigator.webdriver:lv!=='off'); // ?weather= 手动强制优先（一律让位）；再 ?live=on|off；自动化默认不打外网
  window.__weatherLive={state:()=>this.state()}; // 调试/验收手柄（禁用态也挂，供探 enabled）
  if(this.enabled){ // 30 分钟内的缓存先立即生效：开页即上次天气，网络结果稍后覆盖
   const c=this.readCache();
   if(c){this.apply(c.mode,c.tempC,c.code,c.at);this.ok=true;}
  }
 }
 start(){ // 立即拉一次 + 每 20 分钟轮转刷新；幂等
  if(!this.enabled||this.started)return this;
  this.started=true;
  this.refresh();
  this.timer=setInterval(()=>this.refresh(),POLL_MS);
  return this;
 }
 stop(){if(this.timer!==null){clearInterval(this.timer);this.timer=null;}this.started=false;}
 async refresh(){ // 网络路径全程 try/catch：任何故障只降级天气模式，不抛出到页面
  const ac=new AbortController(),kill=setTimeout(()=>ac.abort(),FETCH_MS);
  try{
   const res=await fetch(API(this.lat,this.lon),{signal:ac.signal,cache:'no-store'});
   if(!res.ok)throw Error('HTTP '+res.status);
   const cur=(await res.json()).current||{};
   const mode=wmoToMode(cur.weather_code);
   if(!mode)throw Error('响应缺少 current.weather_code');
   this.apply(mode,cur.temperature_2m,cur.weather_code,Date.now());
   this.writeCache({mode:this.mode,tempC:this.tempC,code:this.code,at:this.at});
   this.ok=true;this.lastError=null;
   if(!this.helloToasted){this.helloToasted=true; // 首次接入播报一次
    this.toast(`天气已接入江西实时：${ZH[mode]}${this.tempC==null?'':' '+Math.round(this.tempC)+'°C'}（来自 Open-Meteo）`);}
  }catch(e){
   this.lastError=(e&&e.message)||String(e);
   let live=null;try{live=this.weather?.state?.().live||null;}catch{}
   if(live){ // 正处 live 驱动 → 释放回本地模拟（自动轮转接管）
    try{this.weather.live(null);}catch{}
    this.mode=null;this.tempC=null;this.code=null;this.at=null;this.ok=false;
   }
   if(!this.fallbackToasted){this.fallbackToasted=true; // 会话内最多提示一次
    this.toast('实时天气暂不可用，已回到本地天气模拟');}
  }finally{clearTimeout(kill);}
 }
 apply(mode,tempC,code,at){ // 写入自身状态并驱动 Weather（weather 未接线/无 live 方法时静默跳过）
  try{this.weather?.live?.(mode);}catch{}
  this.mode=mode;
  this.tempC=typeof tempC==='number'&&Number.isFinite(tempC)?tempC:null;
  this.code=typeof code==='number'&&Number.isFinite(code)?code:null;
  this.at=at||null;
 }
 readCache(){try{const v=JSON.parse(localStorage.getItem(CACHE_KEY));
  if(v&&ZH[v.mode]&&v.at&&Date.now()-v.at<CACHE_TTL)return v;}catch{}return null;}
 writeCache(v){try{localStorage.setItem(CACHE_KEY,JSON.stringify(v));}catch{}}
 state(){return {enabled:this.enabled,mode:this.mode,tempC:this.tempC,code:this.code,at:this.at,ok:this.ok,lastError:this.lastError};}
}
