import * as T from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { characterBones } from './npc_activities.js';

/* ============================================================
 * 校园人群生态（2026-10-17）：晴天课间同学 + 食堂就餐同学
 *  · SunnyVisitors —— 晴天白天（非宵禁/非体育接管/无雨）广场·东草坪·绿带长椅旁·路侧
 *    淡入 10 名课间同学：聊天对×2、看手机×2、远眺/伸展/看云；雨天/入夜淡出。
 *  · CanteenEaters —— 食堂 E 楼（-24,96）室内 6 个固定座位：午间 11:00-13:00 全员 6 人，
 *    白天其他时段 3 人，夜间/宵禁 0；坐姿 + 右臂周期抬向嘴的程序化吃饭 + 桌上托盘道具。
 * 红线：不新增灯光；脚影用半透明黑圆片（不投影）；克隆人物 ≤16（访客10+就餐6），
 *      各自持有材质克隆淡入淡出（不碰 campus_life 的 _life/applyFade）；模型缺失静默跳过。
 * 开关：?crowd=on|off；默认真人浏览器开启、自动化（navigator.webdriver）关闭。
 * 接线（主线）：new CampusCrowd({scene, characters: charAssets, toast: showToast})，
 *      主循环 campusCrowd?.tick(dt, t, {daycycle, weather, life: campusLife, player})。
 *      未传 ctx 时内部探 window.__dayCycle/__weather/__campusLife/__campus（0.25s 节流）。
 * 音效钩子：window.__crowdAU?.clink?(0.03)（餐具轻碰，主线 AU 合成接线，仅玩家距食堂<30m）。
 * ============================================================ */

const FADE_V = 1.8;                        // 访客淡入/淡出时长（秒）
const FADE_C = 2.2;                        // 就餐者淡入/淡出时长（秒）
const CANTEEN = { x: -24, z: 96, floor: 0.45 };   // 食堂 E 楼（index.html:366）/ 地台面 F（index.html:583）
const CURFEW_OUT = 20.8, DAWN_IN = 6.05;   // 宵禁阈值同 campus_life（20:48/06:05）；life 关闭时按小时自算
const POSE_BONES = ['head', 'lArm', 'rArm', 'lFore', 'rFore'];   // 每帧叠加姿态的骨骼（characterBones 键名）

const hash = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; };
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const AX = new T.Vector3(1, 0, 0), AY = new T.Vector3(0, 1, 0);
const _q = new T.Quaternion(), _v = new T.Vector3();

/* 晴天课间同学（10 人，固定点位；聊天对两人面对面，其余看手机/远眺/伸展/看云）。
 * 坐标避让既有 46 NPC 区：广场边缘（跳绳盘在东侧操场、领操队在 z=-68.5 北缘）、
 * 东草坪 x>71（跑道东外沿 70.5 之外）、绿带长椅旁、南北主轴/主路路侧。 */
const VISITOR_SPOTS = [
  { n: '沈知夏', g: '女', m: 'Girl_A', h: 1.58, pose: 'chat',   x: -14.2, z: -57.0, yaw: Math.PI / 2 },      // 广场东缘·聊天对A
  { n: '顾一帆', g: '男', m: 'Boy_A',  h: 1.70, pose: 'chat',   x: -12.6, z: -57.8, yaw: -Math.PI / 2 },     // 广场东缘·聊天对A（对面）
  { n: '温可唯', g: '女', m: 'Girl_B', h: 1.62, pose: 'chat',   x: 72.0,  z: -22.6, yaw: Math.PI / 2 },      // 东草坪·聊天对B
  { n: '邵一诺', g: '男', m: 'Boy_C',  h: 1.66, pose: 'chat',   x: 73.6,  z: -21.8, yaw: -Math.PI / 2 },     // 东草坪·聊天对B（对面）
  { n: '苏晓棠', g: '女', m: 'Girl_A', h: 1.56, pose: 'phone',  x: -28.0, z: 4.4,   yaw: -Math.PI / 2 },     // 绿带长椅（-29.5,5）旁看手机
  { n: '程亦凡', g: '男', m: 'Boy_B',  h: 1.72, pose: 'phone',  x: -28.2, z: 26.5,  yaw: -Math.PI / 2 },     // 南北主轴路侧看手机
  { n: '林悦然', g: '女', m: 'Girl_B', h: 1.60, pose: 'gaze',   x: -16.5, z: -66.5, yaw: 0 },                // 广场南缘远眺（朝南）
  { n: '方雨橙', g: '女', m: 'Girl_A', h: 1.57, pose: 'gaze',   x: -41.0, z: -51.5, yaw: 0 },                // 主路北侧远眺（朝南望广场）
  { n: '韩沐阳', g: '男', m: 'Boy_A',  h: 1.74, pose: 'stretch', x: 73.5, z: 6.0,   yaw: -Math.PI / 2 },     // 东草坪伸展（朝西望跑道）
  { n: '陆星辰', g: '男', m: 'Boy_C',  h: 1.68, pose: 'clouds', x: 72.0,  z: -45.0, yaw: -Math.PI / 2 },     // 东草坪北段看云
];
const VISITOR_ROLE = '课间散步的同学';
const EATER_ROLE = '在食堂吃饭的同学';

/* 食堂 6 座位 —— 坐标提取自 index.html buildCanteenInterior（581-678 行），E 楼 cfg={x:-24,z:96,w:22,d:13}、地台 F=0.45：
 *  · 方桌 4 张（L626）[[x-7,z-1.5],[x+7,z-1.5],[x-7,z+2],[x+7,z+2]] → (-31,94.5)/(-17,94.5)/(-31,98)/(-17,98)，
 *    桌面 F+0.76=1.21；凳（L630）在 tx±1.25 东西两侧、凳面顶 F+0.45=0.90 → 坐姿 hips 目标 0.99（凳面+0.09，
 *    对齐 index.html:1694 坐椅基准 0.58=长椅凳面 0.49+0.09）。
 *  · 圆桌 2 张（L632）[[x-3.8,z+0.5],[x+3.8,z+0.5]] → (-27.8,96.5)/(-20.2,96.5)；凳（L636）a=i*2π/3+0.5、半径 0.95。
 *  yaw 使人物面朝桌心（模型脸朝本地 +z：facing=(sin yaw, cos yaw)）。tray 为托盘距座位距离（沿面朝方向）。
 *  白天非饭点只出前 3 座（方桌A西/方桌B西/圆桌1，三桌各一）。 */
const SEAT_SPOTS = [
  { n: '周子墨', g: '男', m: 'Boy_A',  h: 1.70, x: -32.25, z: 94.5,  yaw: Math.PI / 2,  tray: .55 },  // 方桌A西凳（-31,94.5 的 tx-1.25），面 +x
  { n: '何静怡', g: '女', m: 'Girl_A', h: 1.58, x: -18.25, z: 98.0,  yaw: Math.PI / 2,  tray: .55 },  // 方桌B西凳（-17,98 的 tx-1.25），面 +x
  { n: '罗一鸣', g: '男', m: 'Boy_C',  h: 1.65, x: -26.97, z: 96.96, yaw: -2.0714,      tray: .68 },  // 圆桌1 a=0.5 凳：桌心+(cos.5,sin.5)*0.95，面朝桌心
  { n: '宋雨桐', g: '女', m: 'Girl_B', h: 1.63, x: -29.75, z: 94.5,  yaw: -Math.PI / 2, tray: .55 },  // 方桌A东凳（tx+1.25），面 -x
  { n: '高梓豪', g: '男', m: 'Boy_B',  h: 1.52, x: -27.82, z: 95.55, yaw: 0.0222,       tray: .68 },  // 圆桌1 a=4.6888 凳（南位），面朝桌心
  { n: '叶知秋', g: '女', m: 'Girl_A', h: 1.68, x: -15.75, z: 98.0,  yaw: -Math.PI / 2, tray: .55 },  // 方桌B东凳（tx+1.25），面 -x
];

export class CampusCrowd {
  constructor({ scene, characters, toast } = {}) {
    this.scene = scene || null;
    this.assets = characters && Object.keys(characters).length ? characters : null;   // 主线传 charAssets；缺省走 ensureAssets 自助加载
    this.toast = toast || (() => {});
    // 开关：?crowd=on|off 显式指定；默认真人开、自动化关（与 campus_life 的 ?life 同款约定）
    const p = new URLSearchParams(location.search).get('crowd');
    this.enabled = p === null ? !navigator.webdriver : p !== 'off';
    this.vis = { people: [], alpha: 0, target: 0, built: false };
    this.eaters = [];
    this.mealWindow = false; this.clinkN = 0; this._clinkT = 3;
    this._probeAt = -1; this._probe = null;                                       // window 探针 0.25s 节流缓存
    window.__campusCrowd = { state: () => this.state() };
  }

  /* ---------- 只读快照（验收/调试） ---------- */
  state() {
    return {
      enabled: this.enabled,
      visitors: { visible: this.vis.alpha > .55 ? this.vis.people.length : 0, total: this.vis.people.length },
      canteen: { seated: this.eaters.filter(p => p.alpha > .5).length, mealWindow: !!this.mealWindow, clinkN: this.clinkN },
    };
  }

  /* ---------- ctx 容错：主线传实例优先，未传时探 window 只读接口（0.25s 节流） ---------- */
  probe(t) {
    if (t - this._probeAt < .25 && this._probe) return this._probe;
    let rain = 0, target = 'sunny';
    try { const w = window.__weather?.state?.(); if (w) { rain = w.rainAmount || 0; target = w.target || 'sunny'; } } catch (e) {}
    let hour = 12;
    try { const h = window.__dayCycle?.snapshot?.()?.hour; if (Number.isFinite(h)) hour = h; } catch (e) {}
    let life = null;
    try { life = window.__campusLife?.state?.() || null; } catch (e) {}
    let px = 0, pz = 0;
    try { const p = window.__campus?.pos?.(); if (p) { px = p.x; pz = p.z; } } catch (e) {}
    this._probe = { rain, target, hour, life, px, pz }; this._probeAt = t;
    return this._probe;
  }
  nightFromHour(h) { return h >= CURFEW_OUT || h < DAWN_IN; }   // 宵禁同款阈值（campus_life 20:48/06:05）

  env(ctx, t) {
    const c = ctx || {}, pr = this.probe(t);
    const hour = Number.isFinite(c.daycycle?.hour) ? c.daycycle.hour : pr.hour;
    const rain = Number.isFinite(c.weather?.rainAmount) ? c.weather.rainAmount : pr.rain;
    const target = c.weather?.target || pr.target;
    // life 优先：启用时读实例标志；未传/被关闭时按小时自算（关闭的 life 实例 .night 恒 false，不能信）
    const night = c.life && c.life.enabled !== false ? !!c.life.night : (pr.life?.enabled ? !!pr.life.night : this.nightFromHour(hour));
    const hold = c.life && c.life.enabled !== false ? !!c.life.hold : (pr.life?.enabled ? !!pr.life.hold : false);
    const px = c.player?.position ? c.player.position.x : pr.px;
    const pz = c.player?.position ? c.player.position.z : pr.pz;
    return { hour, rain, target, night, hold, px, pz };
  }

  /* ---------- 资产：主线传 charAssets；独立运行（验收注入）时自助加载 Quaternius 学生模型 ---------- */
  ensureAssets() {
    if (this.assets || this._assetsFail) return;
    if (!this._assetsP) this._assetsP = (async () => {
      const loader = new GLTFLoader(), out = {};
      await Promise.all(['Boy_A', 'Boy_B', 'Boy_C', 'Girl_A', 'Girl_B'].map(async name => {
        try {
          const g = await loader.loadAsync('assets/characters_hs/' + name + '.glb');
          out[name] = { scene: g.scene, clips: Object.fromEntries(g.animations.map(c => [c.name, c])) };
        } catch (e) { console.warn('[campus-crowd] 模型缺失，静默跳过：', name); }
      }));
      if (!Object.keys(out).length) throw Error('no character assets');
      this.assets = out;
    })().catch(e => { this._assetsFail = true; console.warn('[campus-crowd] 自助加载角色失败：', e.message); });
    void this._assetsP;
  }

  /* ---------- 人物克隆（参考 construction/activities.js VenueActors：骨架克隆→身高缩放→材质克隆→idle/sit clip） ---------- */
  makePerson(spec, { sit = false, shadow = false } = {}) {
    const asset = this.assets[spec.m];
    if (!asset?.scene) return null;                       // 某模型缺失：静默跳过不报错（总人数相应减少）
    let clip = Object.values(asset.clips).find(c => sit ? /Sit/i.test(c.name) : /Idle/i.test(c.name));
    if (!clip) return null;
    if (sit) clip = asset.clips.Natural_Seated ||= T.AnimationUtils.subclip(clip, clip.name + '_Rest',
      Math.floor(clip.duration * .62 * 30), Math.floor(clip.duration * .95 * 30), 30);   // Sitting 全片是「坐下」过渡：截取 62%-95% 已坐定段（VenueActors 同法），否则 hips 随播放下沉穿凳
    const obj = cloneSkeleton(asset.scene);
    const bb = new T.Box3().setFromObject(obj), hh = bb.max.y - bb.min.y || 1.7;
    obj.scale.setScalar((spec.h || 1.65) / hh);
    const mats = [];
    obj.traverse(o => {
      if (!o.isMesh) return;
      const src = Array.isArray(o.material) ? o.material : [o.material];
      const clones = src.map(m => { const k = m.clone(); k.transparent = true; return k; });   // 克隆材质转可透明（自带淡入淡出）
      o.material = Array.isArray(o.material) ? clones : clones[0];
      mats.push(...clones);
      o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false;   // 不投影（脚影另配黑圆片）；skinned 关剔除防闪
    });
    const root = new T.Group(); root.name = 'campus-crowd-' + spec.n;
    root.position.set(spec.x, 0, spec.z); root.rotation.y = spec.yaw || 0;
    root.add(obj);
    const p = { n: spec.n, g: spec.g, m: spec.m, h: spec.h || 1.65, root, obj, mats, alpha: 0,
      B: characterBones(obj), mixer: new T.AnimationMixer(obj), pose: spec.pose || null,
      ph: (hash(spec.n) % 628) / 100, period: 1.7 + (hash(spec.n) % 900) / 900 * .9,
      sit, shadowMat: null, phone: null, tray: null };
    p.mixer.clipAction(clip).play();
    if (sit) {                                            // 坐姿落座：hips 提到凳面+0.09（VenueActors/index:1691 同法）
      p.mixer.update(0); obj.updateMatrixWorld(true);
      const hips = p.B.hips?.getWorldPosition(new T.Vector3());
      if (hips) obj.position.y += (CANTEEN.floor + .45 + .09) - hips.y;
      else obj.position.y = CANTEEN.floor;
    } else obj.position.y = 0;
    if (shadow) {                                         // 半透明黑圆片脚影（不投影、不写深度）
      const sm = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false });
      const disc = new T.Mesh(new T.CircleGeometry(.3, 20), sm);
      disc.rotation.x = -Math.PI / 2; disc.position.y = .02; disc.renderOrder = 1;
      root.add(disc); p.shadowMat = sm;
    }
    if (p.pose === 'phone' && p.B.rHand) {                // 看手机道具：小黑屏一块，逐帧贴右手
      const ph = new T.Mesh(new T.BoxGeometry(.075, .145, .014),
        new T.MeshStandardMaterial({ color: 0x14181e, roughness: .35, transparent: true }));
      ph.castShadow = false; this.scene.add(ph); p.phone = ph; p.mats.push(ph.material);
    }
    this.scene.add(root);
    return p;
  }

  setPersonAlpha(p, a) {
    for (const m of p.mats) m.opacity = a;
    if (p.shadowMat) p.shadowMat.opacity = .32 * a;
    p.alpha = a;
    p.root.visible = a > .01;
    if (p.phone) p.phone.visible = a > .5;
    if (p.tray && (a > .02) !== p.tray.visible) p.tray.visible = a > .02;
    if (p.tray?.visible) p.tray.traverse(o => { if (o.isMesh) o.material.opacity = a; });
  }

  rot(p, key, axis, ang) {                                // 本地轴姿态叠加（npc_activities 非_cast 路径同式）
    if (!ang) return;
    const b = p.B[key]; if (!b) return;
    b.quaternion.multiply(_q.setFromAxisAngle(axis, ang));
  }

  /* ---------- 晴天课间同学 ---------- */
  buildVisitors() {
    for (const spec of VISITOR_SPOTS) {
      const p = this.makePerson(spec, { shadow: true });
      if (p) this.vis.people.push(p);
    }
    this.vis.built = true;
  }
  tickVisitors(dt, t, env) {
    // 触发：非夜 + 目标晴天 + 无雨 + 非体育/考核接管（hold）
    const on = env.target === 'sunny' && env.rain < .2 && !env.night && !env.hold;
    this.vis.target = on ? 1 : 0;
    if (on && !this.vis.built) this.buildVisitors();
    this.vis.alpha = clamp01(this.vis.alpha + Math.sign(this.vis.target - this.vis.alpha) * dt / FADE_V);
    const a = this.vis.alpha;
    for (const p of this.vis.people) {
      if (a <= .01) { if (p.root.visible) this.setPersonAlpha(p, 0); continue; }
      p.mixer.update(dt);
      this.setPersonAlpha(p, a);
      this.applyVisitorPose(p, t);
      if (p.phone) {                                      // 手机贴右手，沿面朝方向略向脸侧抬起
        const yaw = p.root.rotation.y;
        p.B.rHand.getWorldPosition(_v);
        _v.y += .03; _v.x += Math.sin(yaw) * .06; _v.z += Math.cos(yaw) * .06;
        p.phone.position.copy(_v);
        p.phone.rotation.y = yaw;
      }
    }
  }
  applyVisitorPose(p, t) {
    const ph = p.ph;
    if (p.pose === 'chat') {                              // 聊天对：轻微点头 + 手部小幅比划 + 偶发抬手
      this.rot(p, 'head', AY, Math.sin(t * 1.9 + ph) * .09);
      this.rot(p, 'rFore', AX, -.3 + Math.sin(t * 2.7 + ph) * .16);
      this.rot(p, 'rArm', AX, -.5 * Math.pow(Math.max(0, Math.sin(t * .45 + ph)), 10));
    } else if (p.pose === 'phone') {                      // 看手机：右臂屈举 + 低头
      this.rot(p, 'rArm', AX, -.5); this.rot(p, 'rFore', AX, -1.2);
      this.rot(p, 'head', AX, .24 + Math.sin(t * 1.2 + ph) * .03);
      this.rot(p, 'head', AY, Math.sin(t * .6 + ph) * .05);
    } else if (p.pose === 'gaze') {                       // 远眺：缓慢左右环视 + 背手
      this.rot(p, 'head', AY, Math.sin(t * .25 + ph) * .42);
      this.rot(p, 'lArm', AX, .45); this.rot(p, 'rArm', AX, .45);
    } else if (p.pose === 'stretch') {                    // 伸展：每 8-12s 双臂上举过头 1.6s
      const k = (t + ph) % (8 + (hash(p.n) % 4));
      const e = k < 1.6 ? Math.max(0, Math.min(k / .3, (1.6 - k) / .3)) : 0;
      this.rot(p, 'lArm', AX, -1.9 * e); this.rot(p, 'rArm', AX, -1.9 * e);
      this.rot(p, 'head', AX, -.22 * e + (e < .02 ? Math.sin(t * .4 + ph) * .05 : 0));
    } else {                                              // clouds 看云：仰头 + 缓慢偏移
      this.rot(p, 'head', AX, -.42); this.rot(p, 'head', AY, Math.sin(t * .13 + ph) * .15);
    }
  }

  /* ---------- 食堂就餐 ---------- */
  buildCanteen() {
    for (const spec of SEAT_SPOTS) {
      const p = this.makePerson(spec, { sit: true });
      if (!p) continue;
      // 托盘道具（一人一份）：Box 托盘 + 2 小碗 Cylinder，程序化；摆在身前面前的桌面上（桌面 F+0.76+0.03=1.24）
      const g = new T.Group(); g.name = 'campus-crowd-tray-' + spec.n;
      const trayMat = new T.MeshStandardMaterial({ color: 0xa7b4b8, roughness: .6, transparent: true });
      const bowlMat = new T.MeshStandardMaterial({ color: 0xf0eee5, roughness: .5, transparent: true });
      const tray = new T.Mesh(new T.BoxGeometry(.34, .02, .24), trayMat);
      g.add(tray);
      for (const bx of [-.09, .09]) {
        const bowl = new T.Mesh(new T.CylinderGeometry(.052, .042, .05, 14), bowlMat);
        bowl.position.set(bx, .033, 0); g.add(bowl);
      }
      g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      const dx = Math.sin(spec.yaw), dz = Math.cos(spec.yaw);
      g.position.set(spec.x + dx * spec.tray, 1.252, spec.z + dz * spec.tray);
      g.rotation.y = spec.yaw;
      this.scene.add(g);
      p.tray = g;
      this.eaters.push(p);
    }
    this.canteenBuilt = true;
  }
  tickCanteen(dt, t, env) {
    const meal = env.hour >= 11 && env.hour < 13;
    this.mealWindow = meal && !env.night;
    if (!this.canteenBuilt) { if (!this._assetsFail) this.buildCanteen(); }
    // 在场人数：午间饭点全员 6 人；白天其他时段 3 人；夜间/宵禁 0（各自淡出）
    const want = env.night ? 0 : meal ? SEAT_SPOTS.length : 3;
    for (let i = 0; i < this.eaters.length; i++) {
      const p = this.eaters[i], tgt = i < want ? 1 : 0;
      const a = clamp01(p.alpha + Math.sign(tgt - p.alpha) * dt / FADE_C);
      if (a <= .01) { if (p.root.visible) this.setPersonAlpha(p, 0); continue; }
      p.mixer.update(dt);
      this.setPersonAlpha(p, a);
      this.applyEaterPose(p, t);
    }
    // 餐具轻碰音效钩子：每 4-9s 随机一人，仅玩家距食堂 <30m（主线 AU 合成接线 window.__crowdAU.clink）
    this._clinkT -= dt;
    if (this._clinkT <= 0) {
      this._clinkT = 4 + Math.random() * 5;
      if (this.eaters.some(p => p.alpha > .5) && Math.hypot(env.px - CANTEEN.x, env.pz - CANTEEN.z) < 30) {
        try { window.__crowdAU?.clink?.(.03); this.clinkN++; } catch (e) {}
      }
    }
  }
  applyEaterPose(p, t) {                                  // 坐姿吃饭：左臂搭桌，右臂周期抬向嘴（1.7-2.6s 相位错开）
    this.rot(p, 'lArm', AX, -.5); this.rot(p, 'lFore', AX, -.75);
    const k = ((t + p.ph * 2.7) % p.period) / p.period;
    const e = k < .8 ? Math.pow(Math.sin(Math.min(k / .8, 1) * Math.PI), 1.2) : 0;   // 抬手→入口→放下
    this.rot(p, 'rArm', AX, -.18 - .5 * e); this.rot(p, 'rFore', AX, -.25 - 1.05 * e);
    this.rot(p, 'head', AX, .12 + .1 * e);
  }

  /* ---------- 主 tick（主线在 rAF 循环里调；独立运行时可由测试 setInterval 驱动） ---------- */
  tick(dt, t = performance.now() / 1000, ctx) {
    if (!this.enabled || !this.scene) return;
    if (!this.assets) { this.ensureAssets(); if (!this.assets) return; }   // 资产就绪前不出场（缺模型静默降级）
    const env = this.env(ctx, t);
    this.tickVisitors(dt, t, env);
    this.tickCanteen(dt, t, env);
  }
}
