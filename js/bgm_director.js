/* BGMDirector（真实校园总案 §4.3/4.4 · P0-2）
 * 薄层选曲：只计算「此刻该用哪个 playlist key」，播放仍由 SceneMusic.setScene 完成
 * （自带 1.2s 去抖 + 2.4s 交叉淡化）。不重写 SceneMusic、不新增音频文件。
 * 优先级链（index.html AU.update）：sportScene（体育/考核）> construction.musicScene()（演出）
 * > bgmDirector.scene(px,pz)。被高优先级接管期间本方法不会被调用，驻留计时自然顺延、
 * 不视为破坏；释放后若仍在 90s 驻留窗口内则维持接管前的 key。
 * 护栏：
 *  ① 同 key 实际变更后最短驻留 90s（期间计算值变了也维持旧 key；首次采纳不受限）；
 *  ② 雨量滞回：>0.45 进入雨带、<0.35 退出（对齐 weather.rainAmount 的 8–10s 线性过渡）；
 *  ③ ?bgm=<key> 强制（验收用，构造即 setScene(key,{immediate:true})）；
 *  ④ window.__bgmDirector.state() 只读诊断（项目惯例：只读诊断、不加测试专用播放控制）。
 * 保守取舍（相对总案 §4.3 表的差异，均按任务口径取保守实现）：
 *  · 教学楼/食堂邻区（原 classroom/corridor）不乘天气轴——口径为「白天维持原 key、
 *    dusk/night/deep-night 落入时间轴 key」，未提天气；楼体邻区有顶，雨天硬切 campus-rain
 *    反而突兀，故只在时间轴上让位。
 *  · deep-night 恒 campus-deep（雨夜只留雨声）：开阔区矩阵里 deep-night 优先于雨轴。
 */
import { campusMusic, campusMusicScene } from './campus_music.js';

const DWELL_MS = 90000;                    // 同 key 最短驻留（总案 §4.4 护栏①）
const RAIN_IN = 0.45, RAIN_OUT = 0.35;     // 雨量滞回进/出门限（护栏②）
const TIME_KEYS = {                        // 时间带 → 开阔区目标 key（§4.3 表：morning/afternoon 共用 campus-day）
  dawn: 'campus-dawn', morning: 'campus-day', noon: 'campus-noon', afternoon: 'campus-day',
  dusk: 'campus-dusk', night: 'campus-night', 'deep-night': 'campus-deep',
};

function bandOf(h) {                       // 带界对齐 §4.3：05:00 / 07:50 / 11:45 / 14:00 / 17:00 / 19:00 / 20:48
  if (h < 5 || h >= 20 + 48 / 60) return 'deep-night';
  if (h < 7 + 50 / 60) return 'dawn';
  if (h < 11 + 45 / 60) return 'morning';
  if (h < 14) return 'noon';
  if (h < 17) return 'afternoon';
  if (h < 19) return 'dusk';
  return 'night';
}

class BGMDirector {
  constructor() {
    this.src = null;                       // {zone(x,z), hour(), rain()} 由 index.html bind 注入
    this.band = 'noon'; this.rainLatched = false; this.rainAmount = 0; this.hourNow = 12;
    this.key = null; this.computed = null; this.forced = null; this.lastChangeAt = -Infinity;
    const q = new URLSearchParams(location.search).get('bgm');
    if (q) { this.forced = q; campusMusic.setScene(q, { immediate: true }); }   // ?bgm= 验收强制链
  }
  bind(src) { this.src = src || null; return this; }
  hour() {                                 // 有 bind 用 bind（daycycle.hour 为十进制小时，?t= 虚拟时钟随之）；未 bind 才退全局只读口
    const h = this.src?.hour?.();
    if (Number.isFinite(h)) return ((h % 24) + 24) % 24;
    if (!this.src && typeof window !== 'undefined') {
      const s = window.__dayCycle ? window.__dayCycle.snapshot() : null;
      if (s) return ((s.hour + s.minute / 60 + s.second / 3600) % 24 + 24) % 24;
      const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    }
    return NaN;                            // 数据源未就绪：scene() 据此维持现状
  }
  rainNow() {
    const r = this.src?.rain?.();
    if (Number.isFinite(r)) return Math.max(0, Math.min(1, r));
    if (!this.src && typeof window !== 'undefined' && window.__weather) return window.__weather.state().rainAmount;
    return 0;
  }
  scene(px, pz) {                          // 每帧由 AU.update 调用；帧内零对象分配
    const h = this.hour();
    if (!Number.isFinite(h)) return this.key || 'campus';   // 四系统未就绪：不驱动切换、不占驻留窗口
    this.hourNow = h; this.band = bandOf(h);
    const amt = this.rainNow(); this.rainAmount = amt;
    if (!this.rainLatched && amt > RAIN_IN) this.rainLatched = true;
    else if (this.rainLatched && amt < RAIN_OUT) this.rainLatched = false;
    let wanted;
    if (this.forced) wanted = this.forced;
    else {
      const zone = this.src?.zone ? this.src.zone(px, pz) : '校园';
      const base = campusMusicScene(zone);                 // 复用既有 zone→key 判定
      if (base === 'pool' || base === 'sports' || base === 'celebration') wanted = base;   // 馆内：不受天气/时间轴
      else if (base === 'classroom' || base === 'corridor')                                 // 教学楼/食堂邻区
        wanted = (this.band === 'dusk' || this.band === 'night' || this.band === 'deep-night') ? TIME_KEYS[this.band] : base;
      else wanted = this.band === 'deep-night' ? 'campus-deep' : this.rainLatched ? 'campus-rain' : TIME_KEYS[this.band];
    }
    this.computed = wanted;
    if (wanted !== this.key) {
      if (this.key === null || performance.now() - this.lastChangeAt >= DWELL_MS) { this.key = wanted; this.lastChangeAt = performance.now(); }
      // 否则 90s 驻留内维持旧 key（防切歌抖动；被体育/演出接管不重置计时，见文件头注释）
    }
    return this.key;
  }
  state() {                                // 只读诊断（验收依赖：band/rain/key/forced/lastChangeAt）
    return { band: this.band, rain: this.rainLatched, rainAmount: +this.rainAmount.toFixed(3), hour: +this.hourNow.toFixed(3),
      key: this.key, computed: this.computed, forced: this.forced, lastChangeAt: this.lastChangeAt };
  }
}
const director = new BGMDirector();
if (typeof window !== 'undefined') window.__bgmDirector = { state: () => director.state() };   // 只读诊断
export default director;
