import * as T from 'three';

/* ============================================================
 * 校园生态联动（2026-10-15）：让昼夜与天气真实作用于校园
 *  · 作息清场 —— 夜晚（≥20:48 / <06:05，出夜带 5 分钟滞回）同学老师错峰淡出「回寝」，只剩保安夜值
 *  · 雨天撑伞 —— 雨量≥0.4 时户外 NPC 原地撑伞留在岗位（不再消失），暴雨(>0.8)按姓名哈希 30% 淡出避雨；
 *                 有顶区/馆内照常「檐下避雨」，保安张守安保留专属雨伞（buildUmbrella）
 *  · 夜间动物 —— 橘猫（目光跟随玩家）· 门卫犬（蜷睡呼吸）· 三簇萤火虫；白天偶发鸟鸣
 *  · 夜间声景 —— 蛐蛐/蛙鸣随夜色渐起（蛙声近泳池增强），偶发猫头鹰/犬吠/猫叫（按距离衰减）
 *  · 雨天地表 —— 8 处水洼随雨量渐现，路面颜色加深出「湿感」
 * 红线约束：NPC 位置一律不动（静态阴影烘焙）；不新增灯位、不碰 shadow 设置；
 *          全部音效走 AU 合成，零新增素材文件。?life=off 可整体关闭。
 * ============================================================ */

const CURFEW_OUT = 20.8;              // 宵禁开始（20:48，晚于音乐馆 20:00 场散场）
const CURFEW_IN = 6.0;                // 清晨返校（06:00 晨读前）
const DAWN_IN = CURFEW_IN + 5 / 60;   // 拂晓出夜阈值（06:05）：夜→昼翻转抬高 5 分钟滞回带，时钟在 06:00 边界徘徊不再来回翻转
const RAIN_SHOW = 0.3, RAIN_HIDE = 0.38;   // 动物出没的雨量滞回带：转晴 rain<0.30 才复现，雨大 rain>=0.38 才隐去（0.3 附近徘徊不抖）
const RAIN_UMB = 0.4, RAIN_UMB_OFF = 0.36; // NPC 开伞阈值 + 收伞滞回下沿（雨量在 0.36-0.40 间徘徊不抖）
const RAIN_STORM = 0.8;                    // 暴雨：户外仍有 30%（姓名哈希排序取前 30%）淡出回室内避雨
const UMB_OPEN_T = 0.45;                   // 撑开/收拢动画时长（秒，ease-out）
const UMB_STAGGER_MIN = 1.5, UMB_STAGGER_SPAN = 4.5;   // 雨起后错峰开伞窗口 1.5-6s（按姓名哈希确定性）
const UMB_COLORS = ['#2e4a66', '#7a3b4e', '#3e5f4a', '#6b5a2e', '#4a3f66'];   // 伞面调色板（5 色，姓名哈希确定性选色）
const FADE = 2.8;                     // 单人淡入/淡出时长（秒）
const STAGGER_OUT = 25, STAGGER_IN = 20;   // 离场/返回错峰窗口（秒）
const NIGHT_KEEP = new Set(['张守安']);     // 夜班在岗（保安值夜，雨夜撑伞）
// 有顶/馆内岗位：雨天照常在岗（走廊有顶、两馆室内、乒乓球区在檐下）
const SHELTER = new Set(['colA', 'colB', 'ew', 'gymCourt', 'swim', 'poolDeck', 'ping1', 'ping2']);
const POOL = { x: -18, z: 64 };       // 蛙声参考点（游泳馆泳池）
const GATE = { x: -75, z: -57 };      // 犬吠参考点（校门门岗）

const rand = (a, b) => a + Math.random() * (b - a);
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const smoother = (a, b, t) => a + (b - a) * (t * t * (3 - 2 * t));
// FNV-1a 姓名哈希（与 npc_activities 同式）：伞色 / 错峰延迟 / 暴雨 30% 名单全部确定性，同昼夜同雨况结果可复现
const hash = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; };

export class CampusLife {
  constructor({ scene, npcs, daycycle, weather, player, ambience, owl, bark, meow, chirp,
    toast = () => {}, pave = null, busy = () => false, talking = () => false } = {}) {
    this.scene = scene; this.npcs = npcs || []; this.daycycle = daycycle || null; this.weather = weather || null;
    this.player = player; this.ambience = ambience || (() => {}); this.owl = owl || (() => {});
    this.bark = bark || (() => {}); this.meow = meow || (() => {}); this.chirp = chirp || (() => {});
    this.toast = toast; this.busy = busy; this.talking = talking;
    // 开关：?life=on|off 显式指定；默认真人浏览器开启。自动化/无头（Playwright 等
    // navigator.webdriver=true）默认关闭——夜间跑既有验收套件不因清场回归，生态套件用 ?life=on 显式开。
    const lifeParam = new URLSearchParams(location.search).get('life');
    this.enabled = (lifeParam === null ? !navigator.webdriver : lifeParam !== 'off');
    this.hold = false; this.wasNight = false; this.toastNight = 0; this.toastDawn = 0;
    this.hour = 12; this.lamp = 0; this.rain = 0; this.night = false; this.raining = false;
    this.catRainOk = true; this.flyRainOk = true;   // 雨量滞回记忆（干态起步；页面加载时雨量必为 0）
    this.catOn = false; this.flyOn = false;         // 动物开关当前意图（state() 只读暴露，供滞回探针）
    this.snd = { owl: rand(25, 70), bark: rand(40, 110), meow: rand(70, 160), chirp: rand(8, 22) };
    this.crick = 0; this.frog = 0;
    this.catA = 0; this.dogA = 0; this.flyA = 0; this.puddleA = 0; this.paveWet = 0;   // 禁用路径也要有完整 state()
    this.umbRainOn = false; this.umbStart = 0;          // 全员开伞窗口（雨起上升沿计时）；NPC 伞体系见 tickUmbrellas
    this.umbMats = null; this.umbShaftMat = null;       // 伞面 5 色共享材质 + 伞柄共享材质（伞不淡出，可共享）
    this.umbHolders = 0; this.umbOpenN = 0; this._stormSet = null;   // state() 读数（禁用路径恒 0）
    this._uv = new T.Vector3();                         // 伞定位复用向量（每帧 28 次 worldToLocal 零分配）
    if (!this.enabled) { window.__campusLife = { state: () => this.state() }; return; }
    if (scene) {
      this.buildAnimals(); this.buildPuddles();
      this.guard = (this.npcs.find(n => n.n === '张守安')) || null;
      this.buildUmbrella();
    }
    this.paveBase = pave ? pave.color.clone() : null;   // 路面干色快照（湿感插值基准）
    this.paveMat = pave || null; this.paveWet = 0;
    window.__campusLife = { state: () => this.state() };
  }

  /* ---------- ⑤ 雨天地表 ---------- */
  buildPuddles() {
    // 路径/广场/球场便道上的水洼（y 微错开防叠面闪烁）
    const spots = [[-41, -57, 2.2], [-24, -57, 1.8], [-32, -20, 1.5], [-32, 20, 1.5],
      [41.5, -57, 2.0], [-25.5, -28, 1.4], [-25.5, 38, 1.4], [30, 83.5, 1.2]];
    this.puddles = spots.map(([x, z, r], i) => {
      const m = new T.Mesh(new T.CircleGeometry(r, 24),
        new T.MeshStandardMaterial({ color: 0x2b3a46, roughness: .12, metalness: .85, transparent: true, opacity: 0, envMapIntensity: 1.5 }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, .012 + i * 7e-4, z);
      m.receiveShadow = false; m.castShadow = false; m.visible = false;
      this.scene.add(m); return m;
    });
    this.puddleA = 0;
  }

  /* ---------- ③ 夜间动物 ---------- */
  buildAnimals() {
    const mat = (c, r = .95) => new T.MeshStandardMaterial({ color: c, roughness: r, transparent: true });
    { // 橘猫：中央绿带长椅旁蹲坐，目光跟随玩家
      const g = new T.Group(); g.name = 'campus-life-cat';
      const fur = mat(0xcf8a4d), dark = mat(0xa96a35), cream = mat(0xf2e7d8);
      const eye = new T.MeshStandardMaterial({ color: 0x1d2a14, roughness: .35, emissive: 0xa8f078, emissiveIntensity: 0, transparent: true });
      const mats = [fur, dark, cream, eye]; this.catMats = mats;
      const add = (geo, m, x, y, z, p = g) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); p.add(o); return o; };
      const body = add(new T.SphereGeometry(.115, 16, 12), fur, 0, .205, 0); body.scale.set(1, 1.38, .95); body.rotation.x = -.1;
      add(new T.SphereGeometry(.072, 12, 10), cream, 0, .17, .058);                       // 白胸
      const head = new T.Group(); head.position.set(0, .345, .022); g.add(head);
      add(new T.SphereGeometry(.077, 14, 11), fur, 0, 0, 0, head);
      add(new T.SphereGeometry(.03, 10, 8), cream, 0, -.014, .064, head);                 // 口鼻
      const eL = add(new T.ConeGeometry(.024, .05, 4), dark, -.041, .064, 0, head); eL.rotation.z = .3;
      const eR = add(new T.ConeGeometry(.024, .05, 4), dark, .041, .064, 0, head); eR.rotation.z = -.3;
      add(new T.SphereGeometry(.0105, 8, 6), eye, -.027, .013, .062, head);               // 猫眼（夜里反光）
      add(new T.SphereGeometry(.0105, 8, 6), eye, .027, .013, .062, head);
      for (const s of [-1, 1]) {                                                          // 前腿
        const leg = add(new T.CylinderGeometry(.0155, .0145, .17, 8), dark, .028 * s, .1, .062);
        leg.rotation.x = .12;
        add(new T.SphereGeometry(.018, 8, 6), cream, .028 * s, .016, .075);               // 前爪
      }
      const tail = new T.Group(); tail.position.set(0, .055, -.085); g.add(tail);         // 尾巴三节上卷
      let parent = tail, ty = 0, tz = 0;
      for (let i = 0; i < 3; i++) {
        const seg = new T.Mesh(new T.CylinderGeometry(.0135 - i * .002, .012 - i * .002, .085, 8), i < 2 ? dark : fur);
        seg.position.set(0, ty + .04, tz); seg.rotation.x = -.55 - i * .35; parent.add(seg); parent = seg;
        ty += .05; tz -= .028;
      }
      g.position.set(-30.4, 0, 6.6); g.rotation.y = -Math.PI / 2;                          // 面向中央主路
      g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      g.visible = false; this.scene.add(g);
      this.cat = { g, head, tail, earL: eL, earR: eR, eye, alpha: 0, earT: rand(4, 9), baseYaw: -Math.PI / 2 };
    }
    { // 门卫犬：校门岗哨旁蜷睡
      const g = new T.Group(); g.name = 'campus-life-dog';
      const fur = mat(0x7a5f44), dark = mat(0x57432f), nose = mat(0x241d16, .5);
      const mats = [fur, dark, nose]; this.dogMats = mats;
      const add = (geo, m, x, y, z, p = g) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); p.add(o); return o; };
      const body = add(new T.SphereGeometry(.135, 16, 12), fur, 0, .105, 0); body.scale.set(1.8, .82, 1.05);
      add(new T.SphereGeometry(.088, 12, 10), fur, .16, .1, .09);                          // 枕在身侧的头
      add(new T.BoxGeometry(.055, .045, .06), dark, .225, .09, .1);                        // 吻部
      add(new T.SphereGeometry(.016, 8, 6), nose, .252, .098, .1);                         // 鼻头
      const eL = add(new T.ConeGeometry(.024, .055, 4), dark, .14, .16, .05); eL.rotation.set(.9, 0, .5);
      const eR = add(new T.ConeGeometry(.024, .055, 4), dark, .19, .16, .135); eR.rotation.set(.9, 0, -.5);
      const tail = new T.Group(); tail.position.set(-.21, .05, .05); g.add(tail);          // 卷尾贴身
      const t1 = new T.Mesh(new T.CylinderGeometry(.014, .011, .13, 8), dark); t1.rotation.z = 1.35; tail.add(t1);
      const t2 = new T.Mesh(new T.CylinderGeometry(.011, .009, .1, 8), dark); t2.position.set(.05, .045, 0); t2.rotation.z = 2.2; tail.add(t2);
      g.position.set(-70.6, 0, -55.0); g.rotation.y = .8;
      g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      g.visible = false; this.scene.add(g);
      this.dog = { g, body, earL: eL, earR: eR, tail, alpha: 0, earT: rand(6, 14) };
    }
    { // 萤火虫：东草坪 / 绿篱 / 中央绿带 三簇点粒子（加色混合、各自漂移闪烁）
      const clusters = [[64, 0, 9, 16], [-39, -8, 6, 13], [-30, 4, 5, 13]];
      let n = 0; for (const c of clusters) n += c[3];
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), meta = [];
      let i = 0;
      for (const [cx, cz, r, cnt] of clusters) for (let k = 0; k < cnt; k++) {
        const a = Math.random() * 6.2832, rr = r * Math.sqrt(Math.random());
        meta.push({ bx: cx + Math.cos(a) * rr, bz: cz + Math.sin(a) * rr, ph: Math.random() * 6.2832, sp: rand(.25, .6), rad: rand(1, 2.6), blink: rand(1.6, 3.4) });
        pos[i * 3] = meta[i].bx; pos[i * 3 + 1] = rand(.6, 1.5); pos[i * 3 + 2] = meta[i].bz; i++;
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      geo.setAttribute('color', new T.BufferAttribute(col, 3));
      const m = new T.PointsMaterial({ size: .08, vertexColors: true, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
      const pts = new T.Points(geo, m); pts.frustumCulled = false; pts.visible = false;
      this.scene.add(pts);
      this.fireflies = { pts, pos, col, meta, n, alpha: 0 };
    }
    this.catA = 0; this.dogA = 0; this.flyA = 0;
  }

  /* ---------- ② 保安雨伞 ---------- */
  buildUmbrella() {
    if (!this.guard) return;
    const g = new T.Group(); g.name = 'campus-life-umbrella';
    const shaft = new T.Mesh(new T.CylinderGeometry(.014, .014, 1.18, 8), new T.MeshStandardMaterial({ color: 0x8a7a5a, roughness: .8 }));
    shaft.position.y = .59;
    const canopy = new T.Mesh(new T.ConeGeometry(.62, .3, 10), new T.MeshStandardMaterial({ color: 0x2e4a66, roughness: .7, side: T.DoubleSide }));
    canopy.position.y = 1.16;
    const tip = new T.Mesh(new T.SphereGeometry(.02, 8, 6), canopy.material); tip.position.y = 1.32;
    g.add(shaft, canopy, tip);
    g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    g.visible = false; this.guard.obj.add(g);
    this.umbrella = g; this.umbrellaOn = false;
  }

  /* ---------- ① ② 存在度调度 ---------- */
  npcActive(npc) { if (!this.enabled) return true; const l = npc._life; return !l || l.alpha > .3; }   // 淡出过半即冻结行为/气泡（与 away 判定同阈值，消除窗口）

  hideProps(npc) { const s = npc.activity; if (s) for (const p of Object.values(s.props)) p.visible = false; }

  applyFade(npc) {
    const l = npc._life, key = npc.cast ? 'cast:' + npc.cast.variant : 'base';
    let rec = l.fade;
    if (!rec || rec.key !== key) {                       // 首次淡入淡出或 cast 换装：克隆材质转可透明
      const list = [];
      npc.obj.traverse(o => {
        if (!o.isMesh) return;
        const multi = Array.isArray(o.material);
        const src = multi ? o.material : [o.material];
        const clones = src.map(m => { const c = m.clone(); c.transparent = true; return c; });
        o.material = multi ? clones : clones[0];
        list.push(clones);
      });
      rec = l.fade = { key, list };
    }
    const a = l.alpha;
    for (const mats of rec.list) for (const m of mats) {
      m.opacity = a;
      if (a < 1 && !m.transparent) { m.transparent = true; m.needsUpdate = true; }
      if (a >= 1 && m.transparent) { m.transparent = false; m.needsUpdate = true; }   // 回满即恢复不透明（省排序）
    }
  }

  /* 猫/犬材质透明惯例（与 applyFade 同一套）：alpha<1 才 transparent，回满恢复不透明省排序。
   * 修复前 catMats/dogMats 恒 transparent:true，满可见时身体部件互相透、与水洼/地面排序不稳。 */
  setMatAlpha(mats, a) {
    for (const m of mats) {
      m.opacity = a;
      if (a < 1 && !m.transparent) { m.transparent = true; m.needsUpdate = true; }
      if (a >= 1 && m.transparent) { m.transparent = false; m.needsUpdate = true; }
    }
  }

  tickPresence(dt, t) {
    const npcs = this.npcs;
    // 暴雨 30% 避雨名单：户外（非 SHELTER、非夜班）按姓名哈希升序取前 30%（向上取整）——确定性，名单见 state().umbrella.stormAway
    const storm = this.rain > RAIN_STORM ? this.stormAwaySet() : null;
    for (const npc of npcs) {
      const l = npc._life ||= { target: 1, phase: 1, alpha: 1, goAt: -1, fade: null };
      if (!this.hold) {                                  // 体育/考核接管期间冻结调度
        let want = 1;
        const sheltered = SHELTER.has(npc.activity?.scene);
        if (this.night && !NIGHT_KEEP.has(npc.n)) want = 0;                 // 宵禁最优先：夜间照旧淡出回寝（优先于雨伞）
        else if (!sheltered && !NIGHT_KEEP.has(npc.n) && this.rain > RAIN_UMB && storm?.has(npc.n)) want = 0;   // 暴雨：户外 30% 淡出避雨
        // 其余雨况（rain>0.4 户外）：原地撑伞留在岗位（tickUmbrellas），不再 want=0 淡出
        if (want === 0 && this.talking(npc)) want = 1;   // 交谈中的 NPC 等聊完再走
        if (want !== l.target) { l.target = want; l.goAt = t + (want ? rand(0, STAGGER_IN) : rand(0, STAGGER_OUT)); }
      }
      if (l.goAt >= 0 && t >= l.goAt && l.phase !== l.target) {
        l.phase = l.target; l.goAt = -1;
        if (l.phase === 0) { this.hideProps(npc); npc.bubble.visible = false; npc.bubbleOn = false; }
        else npc.obj.visible = true;                     // 返回：先显形再淡入
      }
      const tgt = l.phase;
      if (l.alpha !== tgt) {
        l.alpha = clamp01(l.alpha + Math.sign(tgt - l.alpha) * dt / FADE);
        this.applyFade(npc);
        npc.obj.visible = l.alpha > 0;
      }
    }
  }

  /* ---------- ④ 声景 ---------- */
  tickSounds(dt, t) {
    const p = this.player ? this.player.position : { x: 0, z: 0 };
    // 蛐蛐：21Hz 脉冲突发（叫 0.55s 歇 0.6s）× 宏周期（9.3s 里唱 6.8s）；蛙鸣：泳池越近越响
    const nightAmt = this.night ? Math.max(.35, this.lamp) * (1 - clamp01(this.rain * 1.4)) : 0;
    const cGate = (t % 1.15) < .55 ? (Math.sin(t * 131.9) > 0 ? 1 : .18) : .06;
    const cMacro = (t % 9.3) < 6.8 ? 1 : .22;
    this.crick = nightAmt * .05 * cGate * cMacro;
    const dPool = Math.hypot(p.x - POOL.x, p.z - POOL.z);
    const prox = clamp01(1 - dPool / 52);
    const fGate = (t % 3.6) < 1.15 ? (Math.sin(t * 81.7) > 0 ? 1 : .25) : 0;
    this.frog = nightAmt * prox * (1 - clamp01(this.rain * .6)) * .06 * fGate;
    this.ambience(this.crick, this.frog);
    // 偶发一次声
    const S = this.snd;
    if (this.night) {
      S.owl -= dt; S.bark -= dt; S.meow -= dt;
      if (S.owl <= 0) { this.owl(.05); S.owl = rand(35, 110); }
      if (S.bark <= 0) {
        const v = .15 * clamp01(1 - Math.hypot(p.x - GATE.x, p.z - GATE.z) / 130);
        if (v > .03) this.bark(v); S.bark = rand(45, 150);
      }
      if (S.meow <= 0) {
        const dCat = this.cat ? Math.hypot(p.x - this.cat.g.position.x, p.z - this.cat.g.position.z) : 99;
        if (this.catA > .6 && dCat < 34) { this.meow(.055 * clamp01(1 - dCat / 42)); S.meow = rand(80, 220); }
        else S.meow = rand(20, 50);
      }
    }
    if (!this.night && this.rain < .35) {                // 白天鸟鸣（晴天更密）
      S.chirp -= dt;
      if (S.chirp <= 0) { this.chirp(.032 * (this.weather?.target === 'sunny' ? 1 : .55)); S.chirp = rand(this.weather?.target === 'sunny' ? 9 : 18, 34); }
    }
  }

  /* ---------- 主 tick ---------- */
  tick(dt, t = 0) {
    if (!this.enabled) return;
    const dc = this.daycycle, w = this.weather;
    this.hour = dc ? dc.hour : new Date().getHours() + new Date().getMinutes() / 60;
    this.lamp = dc ? dc.lampLevel : 0;
    this.rain = w ? w.rainAmount : 0;
    // 夜标志粘性布尔（滞回）：入夜维持 20:48，出夜抬高到 06:05——时钟在 06:00 边界徘徊不再来回翻转。
    // 出夜窗口限定 [06:05, 20:48)，避免深夜 21 点误判出夜；入夜分支保留凌晨段且上沿抬到 06:05，
    // 保证午夜回绕后 00:00–06:05 一律视为夜（新加载页面落在带内也按夜起步）。
    if (this.night) { if (this.hour >= DAWN_IN && this.hour < CURFEW_OUT) this.night = false; }
    else if (this.hour >= CURFEW_OUT || this.hour < DAWN_IN) this.night = true;
    this.raining = this.rain > RAIN_UMB;                 // 生态意义上的「下雨中」与开伞阈值对齐（0.4）
    const busy = this.busy();
    if (busy && !this.prevHold) {                        // 体育/考核开场（busy 上升沿）：离场者立即召回（雨夜开训练不缺守门员）
      for (const n of this.npcs) { const l = n._life; if (l && l.target === 0) { l.target = 1; l.goAt = t; } }
    }
    this.prevHold = busy; this.hold = busy;
    // 宵禁/清晨 toast（每半场最多一次）
    if (this.night && !this.wasNight && t - this.toastNight > 60) { this.toastNight = t; this.toast('晚自习结束，同学们陆续回寝休息了'); }
    if (!this.night && this.wasNight && t - this.toastDawn > 60) { this.toastDawn = t; this.toast('天亮了，同学们陆续回到校园'); }
    this.wasNight = this.night;
    this.tickPresence(dt, t);
    this.tickAnimals(dt, t);
    this.tickSounds(dt, t);
    this.tickGround(dt);
    this.tickUmbrella(t);
    this.tickUmbrellas(dt, t);                            // 全员 NPC 雨伞（雨天撑伞留在岗位）
  }

  tickAnimals(dt, t) {
    const p = this.player ? this.player.position : { x: 0, z: 0 };
    // 猫：夜晚且无雨（雨量滞回：干态记到 rain>=0.38 才收，收后等 rain<0.30 才还）；头跟随玩家（±66°）、尾巴慢摆、耳朵偶发抽动、猫眼随夜色反光
    if (this.catRainOk) { if (this.rain >= RAIN_HIDE) this.catRainOk = false; }
    else if (this.rain < RAIN_SHOW) this.catRainOk = true;
    this.catOn = this.night && this.catRainOk;
    this.catA = clamp01(this.catA + (this.catOn ? dt / 3 : -dt / 2));
    if (this.cat) {
      const C = this.cat, g = C.g;
      g.visible = this.catA > .01;
      this.setMatAlpha(this.catMats, this.catA);
      C.eye.emissiveIntensity = 1.9 * this.lamp;
      if (g.visible) {
        C.tail.rotation.y = Math.sin(t * 1.05) * .55;
        C.earT -= dt;
        const tw = C.earT < .35 ? Math.sin(C.earT / .35 * Math.PI) * .5 : 0;
        C.earL.rotation.z = .3 + tw; C.earR.rotation.z = -.3 - tw;
        if (C.earT <= 0) C.earT = rand(4, 11);
        const dx = p.x - g.position.x, dz = p.z - g.position.z, d = Math.hypot(dx, dz);
        let want = Math.sin(t * .5) * .3;                // 平时缓慢环视
        if (d < 14) {                                     // 玩家靠近：目光跟随（相对身体的头转角，限 ±66°）
          want = Math.max(-1.15, Math.min(1.15, Math.atan2(Math.sin(Math.atan2(dx, dz) - g.rotation.y), Math.cos(Math.atan2(dx, dz) - g.rotation.y))));
          C.tracking = true;
        } else C.tracking = false;
        C.head.rotation.y += (want - C.head.rotation.y) * Math.min(1, dt * 4);
        const br = 1 + Math.sin(t * 2.2) * .012;          // 轻微呼吸
        g.scale.setScalar(br * (0.96 + .04 * this.catA));
      }
    }
    // 犬：夜晚蜷睡；呼吸起伏、耳朵偶抖、玩家贴近尾巴轻拍
    const dogOn = this.night;
    this.dogA = clamp01(this.dogA + (dogOn ? dt / 3 : -dt / 2));
    if (this.dog) {
      const D = this.dog, g = D.g;
      g.visible = this.dogA > .01;
      this.setMatAlpha(this.dogMats, this.dogA);
      if (g.visible) {
        const d = Math.hypot(p.x - g.position.x, p.z - g.position.z);
        D.body.scale.y = .82 * (1 + Math.sin(t * 1.9) * (d < 6 ? .028 : .045));   // 贴近时呼吸更明显（浅睡）
        D.earT -= dt;
        const tw = D.earT < .3 ? Math.sin(D.earT / .3 * Math.PI) * .45 : 0;
        D.earL.rotation.z = .5 + tw; D.earR.rotation.z = -.5 - tw;
        if (D.earT <= 0) D.earT = rand(6, 16);
        D.tail.rotation.y = d < 3.5 ? Math.sin(t * 7) * .5 : 0;    // 尾巴轻拍
      }
    }
    // 萤火虫：夜深（灯权重过半）且无雨（雨量滞回带同猫：>=0.38 收，<0.30 还）；CPU 漂移 + 闪烁（点数少，全量更新）
    if (this.flyRainOk) { if (this.rain >= RAIN_HIDE) this.flyRainOk = false; }
    else if (this.rain < RAIN_SHOW) this.flyRainOk = true;
    this.flyOn = this.lamp > .55 && this.flyRainOk;
    this.flyA = clamp01(this.flyA + (this.flyOn ? dt / 4 : -dt / 3));
    const F = this.fireflies;
    F.pts.visible = this.flyA > .01;
    F.pts.material.opacity = .95 * this.flyA;
    if (F.pts.visible) {
      const pos = this.fireflies.pos, col = this.fireflies.col, meta = this.fireflies.meta;
      for (let i = 0; i < F.n; i++) {
        const M = meta[i], j = i * 3;
        pos[j] = M.bx + Math.sin(t * M.sp + M.ph) * M.rad;
        pos[j + 1] = .9 + Math.sin(t * M.sp * .7 + M.ph * 2) * .5 + .25;
        pos[j + 2] = M.bz + Math.cos(t * M.sp * .8 + M.ph) * M.rad;
        const b = Math.pow(Math.max(0, Math.sin(t * M.blink + M.ph)), 3) * this.flyA;
        col[j] = b; col[j + 1] = b * .92; col[j + 2] = b * .38;
      }
      F.pts.geometry.attributes.position.needsUpdate = true;
      F.pts.geometry.attributes.color.needsUpdate = true;
    }
  }

  tickGround(dt) {
    // 水洼不透明度随雨量渐变（0.3 起洼，1.0 最深 0.85）；路面颜色同步加深出湿感
    const tgt = clamp01((this.rain - .3) / .5) * .85;
    this.puddleA += (tgt - this.puddleA) * Math.min(1, dt * .35);
    for (const m of this.puddles) { m.visible = this.puddleA > .01; m.material.opacity = this.puddleA; }
    if (this.paveMat && this.paveBase) {
      const k = clamp01(this.rain * 1.35) * .5;
      this.paveWet += (k - this.paveWet) * Math.min(1, dt * .5);
      this.paveMat.color.copy(this.paveBase).multiplyScalar(1 - .42 * this.paveWet);
    }
  }

  tickUmbrella(t) {
    if (!this.umbrella || !this.guard) return;
    const on = this.rain > .4 && this.guard._life && this.guard._life.alpha > .5;
    this.umbrellaOn = on;
    this.umbrella.visible = on;
    if (!on) return;
    const g = this.guard;
    const head = g.B?.head?.getWorldPosition(new T.Vector3());
    const top = (head || g.obj.position.clone().setY(g.height || 1.7)); top.y += .2;
    this.umbrella.position.copy(g.obj.worldToLocal(top));
    this.umbrella.rotation.set(Math.sin(t * 1.6) * .05, 0, 0);   // 手持微晃
  }

  /* ---------- ② 全员雨伞（2026-10-17 雨天撑伞改造） ----------
   * 雨量≥0.4 且非宵禁：户外（非 SHELTER）在岗 NPC 懒建程序化伞挂到头顶，错峰 1.5-6s 渐开；
   * 暴雨(>0.8) 30% 淡出者与夜间/离场者收伞；雨停（滞回 <0.36）全员收拢隐藏。
   * 伞面/伞柄材质全局共享（不淡出无需克隆）；attach 到 npc.obj，定位法同保安 tickUmbrella。 */
  stormAwaySet() {
    if (this._stormSet) return this._stormSet;
    const outdoor = this.npcs
      .filter(n => !NIGHT_KEEP.has(n.n) && !SHELTER.has(n.activity?.scene))
      .map(n => n.n).sort((a, b) => hash(a) - hash(b) || (a < b ? -1 : 1));   // 姓名哈希升序，并列按字典序稳定
    const k = Math.ceil(outdoor.length * .3);
    return this._stormSet = new Set(outdoor.slice(0, k));
  }

  buildNpcUmbrella(npc) {
    if (!this.umbMats) {                                  // 首次建伞：5 色伞面 + 伞柄共享材质（伞不淡出）
      this.umbMats = UMB_COLORS.map(c => new T.MeshStandardMaterial({ color: c, roughness: .7, side: T.DoubleSide }));
      this.umbShaftMat = new T.MeshStandardMaterial({ color: 0x8a7a5a, roughness: .8 });
    }
    const g = new T.Group(); g.name = 'campus-life-umb-' + npc.n;
    // 组原点=伞面中心：定位锚在头顶 +0.45（伞沿距头顶 ~0.32m 遮雨，伞柄下垂至手侧 ~0.8m）
    const shaft = new T.Mesh(new T.CylinderGeometry(.013, .013, 1.0, 8), this.umbShaftMat); shaft.position.y = -.63;
    const canopy = new T.Mesh(new T.ConeGeometry(.55, .27, 10), this.umbMats[hash(npc.n) % UMB_COLORS.length]); canopy.position.y = 0;
    const tip = new T.Mesh(new T.SphereGeometry(.018, 8, 6), canopy.material); tip.position.y = .15;
    g.add(shaft, canopy, tip);
    g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    g.visible = false;
    npc.obj.add(g);                                       // 头顶 worldToLocal 定位（父级缩放反除保持世界尺寸）
    const sizeK = (npc.height || 1.65) / 1.68 / (npc.obj.scale.x || 1);
    return { g, color: UMB_COLORS[hash(npc.n) % UMB_COLORS.length], open: 0, target: 0, openAt: -1, k: sizeK };
  }

  tickUmbrellas(dt, t) {
    const wantRain = this.rain >= RAIN_UMB && !this.night && !this.hold;   // 体育/考核接管期（hold）收伞：被召回者由赛事动画驱动
    if (wantRain && !this.umbRainOn) {                    // 雨起上升沿：错峰开伞计时原点 + 重锚每人 openAt
      this.umbRainOn = true; this.umbStart = t;
      for (const n of this.npcs) if (n._umb) n._umb.openAt = -1;
    } else if (!wantRain && this.rain < RAIN_UMB_OFF) this.umbRainOn = false;   // 雨停滞回收伞
    const storm = wantRain && this.rain > RAIN_STORM ? this.stormAwaySet() : null;
    let holders = 0, openN = 0;
    for (const npc of this.npcs) {
      if (NIGHT_KEEP.has(npc.n)) continue;                // 保安张守安用专属 buildUmbrella，不进全员体系
      const l = npc._life; if (!l) continue;
      const on = this.umbRainOn && !SHELTER.has(npc.activity?.scene) && l.alpha > .3 && !(storm && storm.has(npc.n));
      let u = npc._umb;
      if (on) {
        if (!u) u = npc._umb = this.buildNpcUmbrella(npc);
        if (u.openAt < 0) u.openAt = this.umbStart + UMB_STAGGER_MIN + (hash(npc.n) % 1000) / 1000 * UMB_STAGGER_SPAN;   // 1.5-6s 确定性错峰
        u.target = t >= u.openAt ? 1 : 0;
      } else if (u) u.target = 0;
      if (!u) continue;
      if (u.open !== u.target) {
        u.open = clamp01(u.open + Math.sign(u.target - u.open) * dt / UMB_OPEN_T);
        const k = 1 - (1 - u.open) * (1 - u.open);        // ease-out 渐开（scale 0→1）
        u.g.scale.setScalar(u.k * k);
      }
      u.g.visible = u.open > 0;
      if (u.open > .15) {                                 // state() 读数：举伞中(>0.15) / 完全撑开(>0.95)
        holders++; if (u.open > .95) openN++;
        const top = this._uv;
        if (npc.B?.head) npc.B.head.getWorldPosition(top); else top.copy(npc.obj.position).setY(npc.height || 1.65);
        top.y += .45;                                     // 锚=伞面中心：头顶 +0.45（buildNpcUmbrella 组原点注释）
        u.g.position.copy(npc.obj.worldToLocal(top));
        u.g.rotation.set(Math.sin(t * 1.7 + hash(npc.n) % 7) * .05, 0, 0);   // 手持微晃（相位按姓名哈希错开）
      }
    }
    this.umbHolders = holders; this.umbOpenN = openN;
  }

  /* ---------- ② 标签覆写（雨/夜在岗语境） ---------- */
  annotate(npc) {
    if (!this.enabled) return;
    const s = npc.activity; if (!s) return;
    if (NIGHT_KEEP.has(npc.n)) { if (this.rain > .45) s.label = '雨中值守'; else if (this.night) s.label = '夜间值守'; }
    else if (this.rain > .45 && SHELTER.has(s.scene)) s.label = '檐下避雨';
    else if (this.rain > RAIN_UMB && !SHELTER.has(s.scene) && npc._umb?.open > .3) s.label = '雨中撑伞';   // 户外撑伞在岗（主循环 annotate 先于本 tick，读上一帧开度）
  }

  /* ---------- 只读快照 ---------- */
  state() {
    const away = [], present = [];
    if (this.enabled) for (const n of this.npcs) (n._life && n._life.alpha < .3 ? away : present).push(n.n);
    return {
      enabled: this.enabled, hour: +this.hour.toFixed(2), night: this.night, rain: +this.rain.toFixed(2), raining: this.raining, hold: this.hold,
      curfew: { out: CURFEW_OUT, in: CURFEW_IN, dawnIn: DAWN_IN, keep: [...NIGHT_KEEP] },
      presence: { total: this.npcs.length, awayN: away.length, presentN: present.length, away: away.slice(0, 60), guardOnDuty: present.includes('张守安') },
      sheltered: [...SHELTER],
      animals: {
        cat: this.cat ? { visible: this.catA > .5, alpha: +this.catA.toFixed(2), on: !!this.catOn, tracking: !!this.cat.tracking, eyeGlow: +(1.9 * this.lamp).toFixed(2) } : null,
        dog: this.dog ? { visible: this.dogA > .5, alpha: +this.dogA.toFixed(2) } : null,
        fireflies: { visible: this.flyA > .5, alpha: +this.flyA.toFixed(2), on: !!this.flyOn, count: this.fireflies ? this.fireflies.n : 0 },
      },
      ambience: { cricket: +this.crick.toFixed(4), frog: +this.frog.toFixed(4) },
      wet: { puddleOpacity: +(this.puddleA || 0).toFixed(2), paveWet: +(this.paveWet || 0).toFixed(2) },
      umbrella: {
        on: !!this.umbrellaOn,                            // 保安张守安专属伞（原有字段保留）
        holders: this.umbHolders || 0, openN: this.umbOpenN || 0, colors: UMB_COLORS.length,
        stormAwayN: this.rain > RAIN_STORM && this._stormSet ? this._stormSet.size : 0,
        stormAway: this.rain > RAIN_STORM && this._stormSet ? [...this._stormSet] : [],   // 暴雨 30% 避雨名单（确定性）
      },
    };
  }
}
