import * as T from 'three';
import {campusMusic} from './campus_music.js';
import {FACILITIES} from './construction/catalog.js';

/* ============================================================
 * 音乐馆 · 真钢琴（2026-10-17）：程序化立式钢琴 + 采样发声 + 曲目演奏
 *  · 琴体 —— 88 键程序化建模（白键 52 / 黑键 36，各一批 InstancedMesh），
 *           摆在 catalog 音乐馆 pianist 席位（activities.js music cast -1,.7,-4.8），
 *           键面世界锚点即演员手位 v.x-1 / v.z-5.4；馆未建设时隐藏。
 *  · 采样 —— Salamander Grand Piano V3（CC-BY · Alexander Holm），
 *           C2..C6 每 3 半音 × 两档力度按需 fetch→decode 缓存，
 *           最近音级 + playbackRate 半音移调，自然延音不截尾（缺文件逐级回退）。
 *  · 弹奏 —— 键盘双排映射（低排 C4 起 / 高排 C5 起）+ 移动端两排虚拟键，
 *           30 秒录制 / 回放，琴键随奏下沉 0.008。
 *  · 演奏 —— Mutopia Project 公版曲目 JSON，250ms 批量 lookahead 精确调度。
 * 红线：音频仅在用户手势后创建；AudioContext 单例；页面隐藏 suspend。
 * ============================================================ */

const NOTES_ROOT = new URL('../assets/audio/piano/notes/', import.meta.url);
const SONGS_ROOT = new URL('../assets/audio/piano/songs/', import.meta.url);
const STORE_KEY = 'campus.construction.v1';
const isBlack = pc => ![0, 2, 4, 5, 7, 9, 11].includes(pc);
export const PIANO_SONGS = [
	{id:'fur_elise', title:'致爱丽丝', composer:'贝多芬'},
	{id:'clair_de_lune', title:'月光（贝加马斯克组曲）', composer:'德彪西'},
	{id:'goldberg_aria', title:'戈德堡变奏曲 · 咏叹调', composer:'巴赫'},
	{id:'gymnopedie_1', title:'Gymnopédie No.1', composer:'萨蒂'},
];
// 采样音级梯子：C2..C6 每 3 半音（个别文件主线暂缺时按最近音级+回退档位取音）
const LADDER = [];
for (let m = 36; m <= 84; m += 3) LADDER.push(m);
const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B']; // 采样文件名用 Ds/Fs 写法
const octave = midi => Math.floor(midi / 12) - 1;
const sampleName = (midi, tier) => `${FLAT[midi % 12]}${octave(midi)}v${tier}.mp3`;
const noteName = midi => `${SHARP[midi % 12]}${octave(midi)}`;
// 键盘映射：低排 A W S E D F T G Y H U J K = C4..C5；高排 Q 2 3 R 5 6 7 I 9 0 P [ = C5..C6（避开低排已占键）
const LOW_CODES = ['KeyA','KeyW','KeyS','KeyE','KeyD','KeyF','KeyT','KeyG','KeyY','KeyH','KeyU','KeyJ','KeyK'];
const HIGH_CODES = ['KeyQ','Digit2','Digit3','KeyR','Digit5','Digit6','Digit7','KeyI','Digit9','Digit0','KeyP','BracketLeft'];
const KEY_MAP = new Map([...LOW_CODES.map((c, i) => [c, 60 + i]), ...HIGH_CODES.map((c, i) => [c, 72 + i])]);
const keyLabel = code => code.replace('Key', '').replace('Digit', '').replace('BracketLeft', '[');

/* ---------- 采样器：单 AudioContext · 按需解码 · 最近音级移调 ---------- */
class PianoSampler {
	constructor() {
		this.ctx = null; this.buffers = new Map(); this.failed = new Set(); this.pickCache = new Map(); this.live = new Set(); this.unlocked = false;
		this.available = null; // 目录索引解析出的实际存在文件；拿不到时回退整梯子探测
		this.indexReady = this.loadIndex();
	}
	async loadIndex() { // 本地/支持目录索引的静态服务可直接拿到文件清单，避免对缺失采样发 404
		try {
			const res = await fetch(NOTES_ROOT);
			if (!res.ok) return;
			const names = new Set([...(await res.text()).matchAll(/([A-G]s?\dv(?:4|12)\.mp3)/g)].map(m => m[1]));
			if (names.size) this.available = names;
		} catch {}
	}
	context() {
		if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); // 单例；仅用户手势入口后创建
		return this.ctx;
	}
	async unlock() {
		const c = this.context();
		if (c.state !== 'running') { try { await c.resume(); } catch {} }
		this.unlocked = true;
		this.preload(); // 后台预热全音级，首奏零等待
		return c;
	}
	async preload() {
		await this.indexReady;
		for (const tier of [4, 12]) for (const m of LADDER) this.buffer(m, tier).catch(() => {});
	}
	async buffer(midi, tier) {
		const key = `${midi}:${tier}`;
		const cached = this.pickCache.get(key);
		if (cached) return cached.name ? this.buffers.get(cached.name) || null : null;
		await this.indexReady;
		const near = [...LADDER].sort((a, b) => Math.abs(a - midi) - Math.abs(b - midi)); // 最近音级 → 次近
		for (const pitch of near) for (const t of [tier, tier === 4 ? 12 : 4]) { // 首选力度档 → 回退档
			const name = sampleName(pitch, t);
			if (this.available && !this.available.has(name)) continue; // 目录清单确认不存在：直接跳过，不发 404
			if (this.buffers.has(name)) { this.pickCache.set(key, {name, pitch}); return this.buffers.get(name); }
			if (this.failed.has(name)) continue;
			try {
				const res = await fetch(new URL(name, NOTES_ROOT));
				if (!res.ok) throw Error('HTTP ' + res.status);
				const buf = await this.context().decodeAudioData(await res.arrayBuffer());
				this.buffers.set(name, buf);
				this.pickCache.set(key, {name, pitch});
				return buf;
			} catch { this.failed.add(name); }
		}
		this.pickCache.set(key, {name: null}); return null;
	}
	async note(midi, vel01, when = 0) { // 自然延音（不 stop），onended 清理节点
		const c = this.context();
		if (c.state !== 'running') return null;
		const tier = vel01 >= .5 ? 12 : 4;
		const buf = await this.buffer(midi, tier);
		if (!buf) return null;
		const pick = this.pickCache.get(`${midi}:${tier}`) || {pitch: midi};
		const src = c.createBufferSource();
		src.buffer = buf;
		src.playbackRate.value = 2 ** ((midi - pick.pitch) / 12); // 半音移调
		const gain = c.createGain();
		gain.gain.value = .92 * Math.max(.04, Math.min(1, vel01));
		src.connect(gain); gain.connect(c.destination);
		const at = Math.max(c.currentTime + .008, when || 0);
		src.start(at);
		const item = {src, gain, end: at + buf.duration / src.playbackRate.value};
		this.live.add(item);
		src.onended = () => { this.live.delete(item); try { src.disconnect(); gain.disconnect(); } catch {} };
		return item;
	}
	stopAll() { for (const it of [...this.live]) { it.src.onended = null; try { it.src.stop(); } catch {} try { it.src.disconnect(); it.gain.disconnect(); } catch {} } this.live.clear(); }
}

/* ---------- 立式钢琴：88 键程序化建模（局部坐标：+z 为键盘朝向） ---------- */
const WHITE_W = .023, WHITE_LEN = .15, WHITE_N = 52, KEY_Y = .75;
function buildPiano() {
	const root = new T.Group(); root.name = 'campus-piano';
	const mats = {
		body: new T.MeshStandardMaterial({color: '#4a3020', roughness: .72}),
		lid: new T.MeshStandardMaterial({color: '#3c2618', roughness: .58}),
		ivory: new T.MeshStandardMaterial({color: '#f4efe4', roughness: .55}),
		ebony: new T.MeshStandardMaterial({color: '#17191d', roughness: .42}),
		felt: new T.MeshStandardMaterial({color: '#8e2f2f', roughness: .9}),
		wood: new T.MeshStandardMaterial({color: '#5a3b26', roughness: .8}),
		metal: new T.MeshStandardMaterial({color: '#67707a', roughness: .35, metalness: .6}),
	};
	const box = (x, y, z, w, h, d, m) => { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; root.add(o); return o; };
	box(0, .35, -.25, 1.9, .7, 2.0, mats.wood); // 演奏台基（对齐 pianist 席位抬升 .7）
	box(0, .6, -.46, 1.42, 1.2, .62, mats.body); // 琴体
	box(0, 1.23, -.44, 1.5, .05, .72, mats.lid); // 顶盖
	box(0, 1.0, -.16, 1.42, .42, .06, mats.body); // 键盘上方前板
	box(0, .82, -.02, 1.3, .04, .1, mats.lid); // 键盘前檐
	box(0, .698, -.07, 1.46, .06, .2, mats.body); // 键床
	box(0, .7525, -.148, 1.2, .012, .022, mats.felt); // 红呢条
	for (const dx of [-.66, .66]) box(dx, .36, -.05, .07, .72, .07, mats.body); // 前琴腿
	box(0, .47, .42, .55, .06, .34, mats.wood); // 琴凳板
	for (const dx of [-.22, .22]) for (const dz of [-.12, .12]) { const leg = new T.Mesh(new T.CylinderGeometry(.025, .025, .44, 10), mats.metal); leg.position.set(dx, .22, .42 + dz); leg.castShadow = true; root.add(leg); }
	// 88 键：先定白键 x（等宽排列），黑键落在相邻两白键交界上；两批 InstancedMesh
	const whites = new T.InstancedMesh(new T.BoxGeometry(WHITE_W - .0012, .022, WHITE_LEN), mats.ivory, WHITE_N);
	const blacks = new T.InstancedMesh(new T.BoxGeometry(.013, .024, .095), mats.ebony, 36);
	whites.castShadow = blacks.castShadow = true;
	const dummy = new T.Object3D(), keys = new Map(), whiteX = new Map();
	let wi = 0;
	for (let midi = 21; midi <= 108; midi++) if (!isBlack(midi % 12)) { whiteX.set(midi, -WHITE_N * WHITE_W / 2 + WHITE_W / 2 + wi * WHITE_W); wi++; }
	wi = 0; let bi = 0;
	for (let midi = 21; midi <= 108; midi++) {
		if (!isBlack(midi % 12)) {
			const x = whiteX.get(midi);
			dummy.position.set(x, KEY_Y - .011, -WHITE_LEN / 2);
			dummy.updateMatrix(); whites.setMatrixAt(wi, dummy.matrix);
			keys.set(midi, {mesh: whites, idx: wi, x, y: KEY_Y - .011, z: -WHITE_LEN / 2});
			wi++;
		} else {
			const x = (whiteX.get(midi - 1) + whiteX.get(midi + 1)) / 2;
			dummy.position.set(x, KEY_Y + .012, -.0755);
			dummy.updateMatrix(); blacks.setMatrixAt(bi, dummy.matrix);
			keys.set(midi, {mesh: blacks, idx: bi, x, y: KEY_Y + .012, z: -.0755});
			bi++;
		}
	}
	whites.instanceMatrix.needsUpdate = blacks.instanceMatrix.needsUpdate = true;
	root.add(whites, blacks);
	return {root, keys, dummy};
}

/* ---------- 主类 ---------- */
export class CampusPiano {
	constructor({scene, toast} = {}) {
		this.scene = scene; this.toast = msg => toast?.(msg);
		this.sampler = new PianoSampler();
		this.visible = false; this.playMode = false; this.recording = false;
		this.playing = null; this.keysDown = new Set(); this.pressCount = new Map();
		this.timers = new Set(); this.recordingData = null; this.takes = null;
		this.built = false; this.songTimer = null; this.songRaf = 0;
		this.buildPanels();
		document.addEventListener('visibilitychange', () => { // 页面隐藏 suspend / 回台恢复
			if (!this.sampler.ctx) return;
			if (document.hidden) this.sampler.ctx.suspend().catch(() => {});
			else if (this.sampler.unlocked) this.sampler.ctx.resume().catch(() => {});
		});
		window.addEventListener('keydown', e => this.onKeyDown(e));
		window.addEventListener('keyup', e => this.onKeyUp(e));
		window.__campusPiano = { // 诊断口 + 主线/programmes 调用入口（均幂等）
			state: () => this.state(), songs: () => PIANO_SONGS.slice(),
			enterPlayMode: () => this.enterPlayMode(), exitPlayMode: () => this.exitPlayMode(),
			playSong: id => this.playSong(id), stopSong: () => this.stopSong(),
			setVisible: b => this.setVisible(b),
		};
	}
	/* --- 摆放：catalog 音乐馆坐标 + pianist 席位偏移（-1,.7,-4.8，facing 缺省 1） --- */
	attach() {
		if (this.built) return this.state();
		const v = FACILITIES.find(f => f.id === 'music');
		if (!v || !this.scene) return this.state();
		const {root, keys, dummy} = buildPiano();
		const f = v.facing || 1;
		root.position.set(v.x - 1 * f, .7, v.z - 5.15 * f); // 键前缘落在演员手位锚点（v.x-1 / v.z-5.4）
		root.rotation.y = f === -1 ? Math.PI : 0;
		this.root = root; this.keys = keys; this.dummy = dummy; this.built = true;
		this.scene.add(root);
		let purchased = false;
		try { purchased = !!JSON.parse(localStorage.getItem(STORE_KEY))?.purchases?.music; } catch {} // 容错：坏档按未建设处理
		return this.setVisible(purchased);
	}
	setVisible(built) {
		this.visible = !!built;
		if (this.root) this.root.visible = this.visible;
		if (!this.visible) { this.exitPlayMode(); this.stopSong(true); }
		return this.state();
	}
	/* --- 琴键动画：计数式下沉 0.008（弹奏/演奏/回放共用，避免同音重叠时提前抬起） --- */
	pressKey(midi) {
		const k = this.keys?.get(midi); if (!k) return;
		const n = (this.pressCount.get(midi) || 0) + 1;
		this.pressCount.set(midi, n);
		if (n === 1) this.setKeyY(k, k.y - .008);
	}
	liftKey(midi) {
		const k = this.keys?.get(midi); if (!k) return;
		const n = (this.pressCount.get(midi) || 1) - 1;
		if (n <= 0) this.pressCount.delete(midi); else this.pressCount.set(midi, n);
		if (n <= 0) this.setKeyY(k, k.y);
	}
	setKeyY(k, y) { this.dummy.position.set(k.x, y, k.z); this.dummy.updateMatrix(); k.mesh.setMatrixAt(k.idx, this.dummy.matrix); k.mesh.instanceMatrix.needsUpdate = true; }
	animateKey(midi, atCtxTime, durSec) { // 调度演奏的琴键跟随（到点下沉，音末抬起）
		const c = this.sampler.ctx; if (!c) return;
		const delay = Math.max(0, (atCtxTime - c.currentTime) * 1000);
		const id1 = setTimeout(() => this.pressKey(midi), delay);
		const id2 = setTimeout(() => this.liftKey(midi), delay + Math.max(60, durSec * 1000));
		this.timers.add(id1); this.timers.add(id2);
	}
	clearTimers() {
		for (const id of this.timers) clearTimeout(id);
		this.timers.clear();
		for (const midi of [...this.pressCount.keys()]) { this.pressCount.delete(midi); const k = this.keys?.get(midi); if (k) this.setKeyY(k, k.y); }
	}
	syncDuck() { campusMusic.duck('piano', this.playMode || !!this.playing); } // 弹奏/演奏期压低校园配乐
	/* --- 弹奏模式 --- */
	async enterPlayMode() {
		if (this.playing) this.stopSong(true);
		await this.sampler.unlock();
		this.playMode = true;
		this.panel.style.display = 'block';
		this.renderPanel();
		this.syncDuck();
	}
	exitPlayMode() {
		if (!this.playMode) return;
		this.playMode = false;
		this.panel.style.display = 'none';
		this.stopRecording(false);
		this.releaseAll();
		this.syncDuck();
	}
	onKeyDown(e) {
		if (e.code === 'Escape' && this.playMode) { e.preventDefault(); this.exitPlayMode(); return; }
		if (!this.playMode || e.repeat) return;
		const midi = KEY_MAP.get(e.code);
		if (midi === undefined || this.keysDown.has(midi)) return;
		this.noteOn(midi, .8);
	}
	onKeyUp(e) {
		if (!this.playMode) return;
		const midi = KEY_MAP.get(e.code);
		if (midi !== undefined) this.noteOff(midi);
	}
	noteOn(midi, vel01) {
		this.keysDown.add(midi);
		this.pressKey(midi);
		this.sampler.note(midi, vel01);
		if (this.recording && this.recordingData) {
			const c = this.sampler.ctx;
			this.recordingData.events.set(midi, {t: Math.max(0, c.currentTime - this.recordingData.start), midi, vel: vel01});
		}
		this.renderPanel();
	}
	noteOff(midi) {
		if (!this.keysDown.delete(midi)) return;
		this.liftKey(midi);
		if (this.recording && this.recordingData?.events.has(midi)) {
			const ev = this.recordingData.events.get(midi), c = this.sampler.ctx;
			ev.dur = Math.max(.08, c.currentTime - this.recordingData.start - ev.t);
			this.recordingData.done.push(ev);
			this.recordingData.events.delete(midi);
		}
		this.renderPanel();
	}
	releaseAll() { for (const midi of [...this.keysDown]) { this.keysDown.delete(midi); this.liftKey(midi); } }
	/* --- 录制 30 秒 / 回放（回放同样带琴键动画） --- */
	startRecording() {
		if (this.recording) return;
		if (!this.sampler.ctx || this.sampler.ctx.state !== 'running') { this.toast?.('声音还没就绪，稍等一下再录'); return; }
		this.recording = true;
		this.recordingData = {start: this.sampler.ctx.currentTime, events: new Map(), done: []};
		this.timers.add(setTimeout(() => this.stopRecording(true), 30000));
		this.toast?.('已开始录制，最长 30 秒');
		this.renderPanel();
	}
	stopRecording(announce = true) {
		if (!this.recording) return;
		this.recording = false;
		const data = this.recordingData;
		this.recordingData = null;
		if (data) { for (const ev of data.events.values()) { ev.dur = .3; data.done.push(ev); } } // 截止时未松键的音补短尾
		data?.done.sort((a, b) => a.t - b.t);
		if (data?.done.length) this.takes = data.done;
		if (announce) this.toast?.(this.takes?.length ? `录制完成，共 ${this.takes.length} 个音，可回放` : '没有录到音符，先弹几下再录');
		this.renderPanel();
	}
	playRecording() {
		if (!this.takes?.length) { this.toast?.('还没有录音，先录一段吧'); return; }
		this.stopSong(true);
		const c = this.sampler.ctx, base = c.currentTime + .12;
		for (const ev of this.takes) {
			this.sampler.note(ev.midi, ev.vel, base + ev.t);
			this.animateKey(ev.midi, base + ev.t, ev.dur);
		}
		this.toast?.('正在回放你的录音');
	}
	/* --- 曲目演奏：fetch JSON + 250ms 批量 lookahead（每批排未来 500ms） --- */
	async playSong(id) {
		const song = PIANO_SONGS.find(s => s.id === id);
		if (!song) return;
		this.exitPlayMode();
		this.stopSong(true);
		let data = null;
		try {
			const res = await fetch(new URL(id + '.json', SONGS_ROOT));
			if (!res.ok) throw Error('HTTP ' + res.status);
			data = await res.json();
		} catch { this.toast?.('曲目暂时不可用，请稍后再试'); return; }
		if (!Array.isArray(data.notes) || !data.notes.length) { this.toast?.('曲目数据不完整'); return; }
		const c = await this.sampler.unlock();
		this.playing = {id: data.id, title: data.title || song.title, composer: data.composer || song.composer, duration: data.duration, at: 0};
		this.songNotes = data.notes;
		this.songIndex = 0;
		this.startCtxTime = c.currentTime + .18;
		this.syncDuck();
		this.toast?.(`钢琴社同学正在弹奏：《${this.playing.title}》— ${this.playing.composer}`);
		this.renderSongPanel();
		this.scheduleSong();
		this.songTimer = setInterval(() => this.scheduleSong(), 250);
	}
	scheduleSong() {
		const p = this.playing, c = this.sampler.ctx;
		if (!p || !c || !this.songNotes) return;
		const at01 = c.currentTime - this.startCtxTime;
		p.at = Math.max(0, Math.min(p.duration, at01));
		const horizon = at01 + .5;
		while (this.songIndex < this.songNotes.length) {
			const [t, midi, vel, dur] = this.songNotes[this.songIndex];
			if (t > horizon) break;
			const at = Math.max(c.currentTime + .02, this.startCtxTime + t);
			this.sampler.note(midi, vel, at);
			this.animateKey(midi, at, Math.min(dur, 4));
			this.songIndex++;
		}
		if (this.songIndex >= this.songNotes.length && at01 > p.duration + .8) this.finishSong();
	}
	finishSong() {
		this.stopSong(true);
		this.toast?.('曲终 · 掌声');
	}
	stopSong(silent = false) {
		if (this.songTimer) { clearInterval(this.songTimer); this.songTimer = null; }
		cancelAnimationFrame(this.songRaf);
		this.clearTimers();
		this.sampler.stopAll();
		const was = !!this.playing;
		this.playing = null; this.songNotes = null;
		this.songPanel.style.display = 'none';
		this.syncDuck();
		if (was && !silent) this.toast?.('已停止演奏');
	}
	/* --- DOM 面板（样式全内联，不新增 css 文件） --- */
	buildPanels() {
		const css = 'box-sizing:border-box;font:14px/1.6 "PingFang SC","Microsoft YaHei",sans-serif';
		this.panel = document.createElement('div');
		this.panel.setAttribute('role', 'dialog'); this.panel.setAttribute('aria-label', '真钢琴 · 自由弹奏');
		this.panel.style.cssText = `${css};display:none;position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:70;max-width:min(96vw,780px);background:rgba(14,20,34,.92);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:12px 14px;color:#eef2f7;box-shadow:0 10px 30px rgba(0,0,0,.4)`;
		for (const ev of ['pointerdown', 'click']) { this.panel.addEventListener(ev, e => e.stopPropagation()); }
		document.body.append(this.panel);
		this.songPanel = document.createElement('div');
		this.songPanel.setAttribute('role', 'status'); this.songPanel.setAttribute('aria-live', 'polite');
		this.songPanel.style.cssText = `${css};display:none;position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:70;background:rgba(14,20,34,.92);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:12px 16px;color:#eef2f7;align-items:center;gap:14px`;
		this.songPanel.addEventListener('pointerdown', e => e.stopPropagation());
		document.body.append(this.songPanel);
	}
	keyButton(label, midi) {
		const b = document.createElement('button');
		b.type = 'button';
		const black = isBlack(midi % 12);
		b.style.cssText = `min-width:34px;height:46px;padding:0 6px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:${black ? '#22262d' : '#e9e4d6'};color:${black ? '#dfe4ec' : '#23262b'};font:600 12px/1.2 inherit;cursor:pointer;touch-action:none;display:flex;flex-direction:column;gap:2px;align-items:center;justify-content:center`;
		b.innerHTML = `<span>${label}</span><span style="font-weight:400;opacity:.7">${noteName(midi)}</span>`;
		b.addEventListener('pointerdown', e => { e.preventDefault(); this.noteOn(midi, .8); });
		for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => this.noteOff(midi));
		return b;
	}
	renderPanel() {
		if (!this.playMode) return;
		this.panel.replaceChildren();
		const head = document.createElement('div');
		head.style.cssText = 'display:flex;align-items:baseline;gap:10px;margin-bottom:8px;flex-wrap:wrap';
		head.innerHTML = '<strong style="font-size:15px">真钢琴 · 自由弹奏</strong><span style="opacity:.75;font-size:12.5px">低排 C4 起 · 高排 C5 起 · Esc 退出</span>';
		this.panel.append(head);
		for (const [title, codes] of [['低排', LOW_CODES], ['高排', HIGH_CODES]]) {
			const row = document.createElement('div');
			row.style.cssText = 'display:flex;gap:3px;margin:4px 0;flex-wrap:wrap;align-items:center';
			const tag = document.createElement('span');
			tag.textContent = title;
			tag.style.cssText = 'font-size:11px;opacity:.6';
			row.append(tag);
			for (const code of codes) {
				const midi = KEY_MAP.get(code);
				const b = this.keyButton(keyLabel(code), midi);
				if (this.keysDown.has(midi)) b.style.outline = '2px solid #7fb4ff';
				row.append(b);
			}
			this.panel.append(row);
		}
		const actions = document.createElement('div');
		actions.style.cssText = 'display:flex;gap:8px;margin-top:8px;flex-wrap:wrap';
		const btn = (text, fn, primary) => {
			const b = document.createElement('button'); b.type = 'button'; b.textContent = text;
			b.style.cssText = `font:inherit;padding:7px 14px;border-radius:9px;border:none;cursor:pointer;background:${primary ? '#3d7bff' : 'rgba(255,255,255,.14)'};color:#fff`;
			b.onclick = fn; actions.append(b);
		};
		btn(this.recording ? '停止录制' : '录制 30 秒', () => this.recording ? this.stopRecording(true) : this.startRecording(), this.recording);
		btn('回放', () => this.playRecording());
		btn('退出', () => this.exitPlayMode());
		this.panel.append(actions);
		const note = document.createElement('p');
		note.style.cssText = 'margin:8px 0 0;font-size:12px;opacity:.66';
		note.textContent = `采样已加载 ${this.sampler.buffers.size} 个 · 采样：Salamander Grand Piano V3（CC-BY · Alexander Holm）`;
		this.panel.append(note);
	}
	renderSongPanel() {
		const p = this.playing;
		if (!p) { this.songPanel.style.display = 'none'; return; }
		this.songPanel.style.display = 'flex';
		this.songPanel.replaceChildren();
		const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
		const info = document.createElement('div');
		info.style.cssText = 'display:flex;flex-direction:column;gap:3px;min-width:min(46vw,320px)';
		info.innerHTML = `<strong style="font-size:14.5px">正在弹奏 · 《${p.title}》— ${p.composer}</strong><div style="height:6px;border-radius:3px;background:rgba(255,255,255,.16);overflow:hidden"><i style="display:block;height:100%;width:0;background:#7fb4ff"></i></div><small style="opacity:.7">进度 ${fmt(0)} / ${fmt(p.duration)}</small>`;
		this.songPanel.append(info);
		this.songBar = info.querySelector('i'); this.songText = info.querySelector('small');
		const stop = document.createElement('button');
		stop.type = 'button'; stop.textContent = '停止';
		stop.style.cssText = 'font:inherit;padding:8px 18px;border-radius:9px;border:none;cursor:pointer;background:#d95f4b;color:#fff';
		stop.onclick = () => this.stopSong();
		this.songPanel.append(stop);
		const tick = () => {
			if (!this.playing || !this.sampler.ctx) return;
			const at = this.playing.at = Math.max(0, Math.min(this.playing.duration, this.sampler.ctx.currentTime - this.startCtxTime));
			if (this.songBar) this.songBar.style.width = (100 * at / Math.max(1, this.playing.duration)).toFixed(1) + '%';
			if (this.songText) this.songText.textContent = `进度 ${fmt(at)} / ${fmt(this.playing.duration)}`;
			this.songRaf = requestAnimationFrame(tick);
		};
		cancelAnimationFrame(this.songRaf);
		tick();
	}
	state() {
		return {
			visible: this.visible,
			samplesLoaded: this.sampler.buffers.size,
			playMode: this.playMode,
			recording: this.recording,
			playing: this.playing ? {id: this.playing.id, title: this.playing.title, composer: this.playing.composer, at: +this.playing.at.toFixed(2), duration: this.playing.duration} : null,
			keysDown: [...this.keysDown],
		};
	}
}
