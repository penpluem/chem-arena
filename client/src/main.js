import * as pc from 'playcanvas';
import './style.css';
import { createFactory, lbl } from './utils.js';
import { createMonitor } from './monitor.js';
import { createFx } from './fx.js';
import { sfx } from './sfx.js';
import { createVoice } from './voice.js';
import { padPos } from './pads.js';
import { createInput, isTouch } from './input.js';
import { createAvatar, setOutfit, setEmote, animateAvatar, EMOTES, SPECIAL_EMOTES, isSpecial } from './avatar.js';
import { createBoard } from './board.js';
import { buildRoom, ARENA, HALL, ALL, PAD_COLORS, WARDROBE } from './scene.js';
import { Net } from './net.js';
import { loadSave, writeSave } from './shop.js';
import * as ui from './ui.js';
import { SKILL_LIST, SKILL, skillLv } from './skills.js';
import { createBrowser, wsUrl, hasServer, currentServer, QUOTA_MSG } from './rooms.js';

const $ = id => document.getElementById(id);
const D2R = Math.PI / 180;

// ที่อยู่เซิร์ฟเวอร์ดูใน rooms.js (VITE_API_URL) — เชื่อมต่อทีละห้องที่ /ws/<รหัสห้อง>


// ---------- กันซูมหน้าเว็บบนมือถือ (iOS Safari ไม่เชื่อ user-scalable=no) ----------
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => { if (e.touches.length > 1 || (e.scale && e.scale !== 1)) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', e => e.preventDefault());

// ---------- App / ฉาก ----------
const canvas = $('c');
const app = new pc.Application(canvas, { graphicsDeviceOptions: { antialias: true } });
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2); // ลดภาระเครื่องมือถือ
window.addEventListener('resize', () => { app.resizeCanvas(); fitCamera(); });
window.addEventListener('orientationchange', () => setTimeout(() => { app.resizeCanvas(); fitCamera(); }, 250));
app.scene.ambientLight = new pc.Color(0.5, 0.52, 0.58);
const factory = createFactory(app);
const { mk } = factory;

const camE = new pc.Entity();
camE.addComponent('camera', { clearColor: new pc.Color(0.53, 0.78, 0.96), fov: 60, farClip: 400 });
app.root.addChild(camE);
// จอแนวตั้ง: ใช้มุมมองแนวนอนคงที่ เพื่อให้ยังเห็นสนามซ้าย-ขวา
function fitCamera() {
  const portrait = window.innerHeight > window.innerWidth;
  camE.camera.horizontalFov = portrait;
  camE.camera.fov = portrait ? 60 : 60;
}
fitCamera();
const sun = new pc.Entity();
sun.addComponent('light', {
  type: 'directional', color: new pc.Color(1, 0.97, 0.9), intensity: 1.15, castShadows: true,
  shadowDistance: 90, shadowResolution: isTouch ? 1024 : 2048, shadowBias: 0.2, normalOffsetBias: 0.05
});
sun.setEulerAngles(50, 30, 0);
app.root.addChild(sun);

const room = buildRoom(app, factory);
const mon = createMonitor(app, factory);
const fx = createFx(app, factory);
const board = createBoard(app, factory, [12.5, 3.2, 9.7]);   // ป้ายเศรษฐีในห้องรอ
mk('cylinder', '#dee2e6', [200, -0.1, 0], [3, 0.2, 3]); // แท่นโชว์ตัวละครตอนแต่งตัว

// ---------- สถานะ ----------
const save = loadSave();
const net = new Net('');
let phase = 'menu', myId = null, camYaw = 0, camPitchL = 0.5, camZoomL = 1, specId = 0, spin = 0, sendT = 0, lastSent = '';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// สถานะจอมอนิเตอร์ใน 3D
const scr = { mode: 'idle', msg: null, deadline: 0, total: 1, aliveN: 0, reveal: null, cd: null, queued: 0, max: 12, count: 0, winners: '', win: false };
let lastSec = -1, coinT = 0, fxT = 0, lastCoins = -1;
const me = { x: 0, y: 0, z: 16, vx: 0, vz: 0, vy: 0, face: 0, fall: 0 };
const meAv = createAvatar(app, factory, save.outfit);
const others = new Map();
const nameOf = id => (id === myId ? save.name : others.get(id)?.info.name || '???');
// สถานะรอบแข่ง (ตามที่เซิร์ฟเวอร์บอก)
const R = { running: false, ids: [], alive: new Set(), idx: 0, queue: new Set(), max: 12, cdEnd: 0 };
const spectating = () => specId > 0;
const amPart = () => R.running && R.ids.includes(myId);
const amAlive = () => R.running && R.alive.has(myId);
let pads = [];

const canSocial = () => phase === 'lobby' && !me.fall;
const input = createInput(canvas, code => {
  if (phase !== 'lobby') return;
  if (code === 'KeyM') return pttStart();
  if (!canSocial()) return;
  const sk = SKILL_LIST.find(s => s.key === code.replace('Key', ''));
  if (sk && R.running && amPart() && skillLv(save, sk.id)) return trySkill(sk.id);
  if (code === 'Enter') return openChat(true);
  if (code === 'KeyM') return pttStart();
  if (/^Digit[1-7]$/.test(code)) return doEmote(EMOTES[+code.slice(5) - 1].v);
  if (/^Digit[89]$|^Digit0$/.test(code) && isTop3()) { const sp = SPECIAL_EMOTES[code === 'Digit0' ? 2 : +code.slice(5) - 8]; if (sp) return doEmote(sp.v); }
});

// ---------- ป้ายชื่อ (DOM ลอยตามตัวละคร) ----------
function makeTag(text, cls) {
  const d = document.createElement('div'); d.className = 'tag ' + (cls || ''); d.textContent = text;
  $('tags').appendChild(d); return d;
}
const tmpV = new pc.Vec3(), outV = new pc.Vec3();
function placeTag(tag, x, y, z) {
  tmpV.set(x, y, z);
  camE.camera.worldToScreen(tmpV, outV);
  if (outV.z <= 0) { tag.style.display = 'none'; return; }
  tag.style.display = ''; tag.style.left = outV.x + 'px'; tag.style.top = outV.y + 'px';
}
const meTag = makeTag('', '');
meTag.style.color = '#8ce99a'; meTag.style.whiteSpace = 'pre';

// ---------- แชท + ท่าเต้น ----------
const bubbles = new Map();   // id -> { el, until }
function sysLine(text) {
  const log = $('chatLog'), d = document.createElement('div'); d.textContent = text; d.style.color = '#ffd43b'; log.appendChild(d);
  while (log.children.length > 8) log.firstChild.remove();
  setTimeout(() => d.classList.add('old'), 9000);
}
function addChatLine(id, name, text) {
  const log = $('chatLog'), d = document.createElement('div'), b = document.createElement('b');
  b.textContent = name + ':'; if (id === myId) b.className = 'me';
  d.append(b, document.createTextNode(text)); log.appendChild(d);
  while (log.children.length > 8) log.firstChild.remove();
  setTimeout(() => d.classList.add('old'), 12000);
  const old = bubbles.get(id); if (old) old.el.remove();
  const el = makeTag(text, 'bubble'); bubbles.set(id, { el, until: performance.now() + 5000 });
}
function openChat(on) {
  $('chatRow').hidden = !on; $('chatLog').classList.toggle('open', on);
  if (on) { input.reset(); $('emotes').hidden = true; $('chatIn').focus(); } else $('chatIn').blur();
}
function sendChat() {
  const t = $('chatIn').value.trim(); $('chatIn').value = '';
  if (t) net.send({ t: 'chat', text: t.slice(0, 80) });
  openChat(false);
}
$('btnChat').onclick = () => openChat($('chatRow').hidden);
$('chatSend').onclick = sendChat;
$('chatIn').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); sendChat(); }
  else if (e.key === 'Escape') openChat(false);
});
let topIds = [];
const isTop3 = () => topIds.includes(myId);
const RANK_PRE = ['🥇 ', '🥈 ', '🥉 '];
const rankPre = id => RANK_PRE[topIds.indexOf(id)] || '';
function renderEmotes() {
  $('emotes').innerHTML = EMOTES.map((e, i) => `<button data-e="${e.v}"><span>${e.i}</span>${e.n}${isTouch ? '' : ` (${i + 1})`}</button>`).join('')
    + (isTop3() ? SPECIAL_EMOTES.map((e, i) => `<button class="vip" data-e="${e.v}"><span>${e.i}</span>${e.n}${isTouch ? '' : ` (${i + 8 === 10 ? 0 : i + 8})`}</button>`).join('') : '');
}
renderEmotes();
net.on('board', m => applyBoard(m.top));
function applyBoard(top) {
  const was = isTop3(); topIds = top.slice(0, 3).map(e => e.id); board.draw(top, myId);
  if (was !== isTop3()) { renderEmotes(); if (!isTop3() && isSpecial(meAv.emote)) stopEmote(); ui.toast(isTop3() ? '👑 คุณติด Top 3 เศรษฐี! ปลดล็อกท่าพิเศษในเมนู 🕺 แล้ว' : 'หลุด Top 3 แล้ว ท่าพิเศษถูกล็อก'); }
}
$('btnEmote').onclick = () => { $('emotes').hidden = !$('emotes').hidden; };
$('emotes').onclick = e => { const b = e.target.closest('button'); if (b) doEmote(b.dataset.e); };
function doEmote(name) {
  if (!canSocial()) return;
  if (isSpecial(name) && !isTop3()) return ui.toast('ท่านี้สำหรับ Top 3 เศรษฐีเท่านั้น');
  setEmote(meAv, name); net.send({ t: 'emote', e: name }); $('emotes').hidden = true;
}
function stopEmote() { if (meAv.emote) { setEmote(meAv, null); net.send({ t: 'emote', e: null }); } }
let socialShown = null;
function updateSocial() {
  const on = phase === 'lobby';
  if (on !== socialShown) { socialShown = on; $('social').hidden = !on; if (!on) { openChat(false); $('emotes').hidden = true; } }
  const now = performance.now();
  for (const [id, b] of bubbles) {
    if (now > b.until || (id !== myId && !others.has(id)) || !on) { b.el.remove(); bubbles.delete(id); continue; }
    const e = id === myId ? me : others.get(id);
    placeTag(b.el, e.x, (id === myId ? me.y : 0) + 2.6, e.z);
  }
}

// ---------- เสียง / ไมค์ / กล้อง ----------
const speak = new Map();   // id -> ระดับเสียงที่กำลังพูด 0..1
const voice = createVoice({ net, getIds: () => [...others.keys()], toast: ui.toast, onLevel: (id, l) => { if (id) speak.set(id, l); } });
voice.setVolumeFn(id => { const e = others.get(id); if (!e || R.running) return 1; return clamp(1.3 - Math.hypot(e.x - me.x, e.z - me.z) / 60, 0.6, 1); });
// กดค้างเพื่อพูด (ปุ่ม 🎤 หรือคีย์ M) ปล่อยแล้วหยุด
let wantTalk = false, hintedMic = false;
async function pttStart() {
  wantTalk = true; sfx.unlock();
  if (!voice.on) { if (!(await voice.arm())) { wantTalk = false; return; } if (!hintedMic) { hintedMic = true; ui.toast('🎤 กดปุ่มค้างไว้เพื่อพูด ปล่อยเพื่อหยุด'); } }
  voice.setTalking(wantTalk); $('btnMic').classList.toggle('on', wantTalk);
}
function pttStop() { wantTalk = false; voice.setTalking(false); $('btnMic').classList.remove('on'); }
const mb = $('btnMic');
mb.addEventListener('pointerdown', e => { e.preventDefault(); try { mb.setPointerCapture(e.pointerId); } catch { /* */ } pttStart(); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) mb.addEventListener(ev, pttStop);
mb.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keyup', e => { if (e.code === 'KeyM') pttStop(); });
window.addEventListener('blur', pttStop);
let soundOff = !!save.mute;
function applySound() { sfx.setMuted(soundOff); if (voice.deaf !== soundOff) voice.toggleDeaf(); $('btnSnd').firstElementChild.textContent = soundOff ? '🔇' : '🔊'; $('btnSnd').classList.toggle('off', soundOff); }
$('btnSnd').onclick = () => { soundOff = !soundOff; save.mute = soundOff; writeSave(save); applySound(); sfx.unlock(); ui.toast(soundOff ? '🔇 ปิดเสียงเกมและเสียงผู้เล่นอื่น' : '🔊 เปิดเสียงแล้ว'); };
function syncField() { for (const e of room.field) e.enabled = R.running; }
function flash(html) { const f = $('flash'); f.innerHTML = html; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }


// ---------- สกิล ----------
const SK = { left: {}, cdUntil: 0, peekUntil: 0, dashUntil: 0, freezeUntil: 0, revUntil: 0, shield: false };
const skReset = () => { Object.assign(SK, { left: Object.fromEntries(SKILL_LIST.map(s => [s.id, skillLv(save, s.id) ? s.uses[skillLv(save, s.id) - 1] : 0])), cdUntil: 0, peekUntil: 0, dashUntil: 0, freezeUntil: 0, revUntil: 0, shield: false }); renderSkills(true); };
const skOwned = () => SKILL_LIST.filter(s => skillLv(save, s.id));
let skHtml = '';
function renderSkills(force) {
  const bar = $('skillBar'), fxb = $('fxBar'), now = performance.now();
  const on = R.running && amPart() && !me.fall;
  const owned = skOwned();
  bar.hidden = !on || !owned.length;
  const st = [];
  if (on) {
    if (now < SK.freezeUntil) st.push(`🧊 แช่แข็ง ${Math.ceil((SK.freezeUntil - now) / 1000)}`);
    if (now < SK.revUntil) st.push(`🙃 กลับทิศ ${Math.ceil((SK.revUntil - now) / 1000)}`);
    if (now < SK.dashUntil) st.push(`⚡ พุ่ง ${Math.ceil((SK.dashUntil - now) / 1000)}`);
    if (now < SK.peekUntil) st.push(`👁 ส่องตา ${Math.ceil((SK.peekUntil - now) / 1000)}`);
    if (SK.shield) st.push('🛡 มีโล่');
  }
  const sh = st.join('  ·  '); if (fxb.textContent !== sh) fxb.textContent = sh; fxb.hidden = !sh;
  if (!on) return;
  const cd = now < SK.cdUntil;
  const html = owned.map(s => `<button data-skill="${s.id}" class="${s.atk ? 'atk' : ''}" ${SK.left[s.id] > 0 && !cd ? '' : 'disabled'} title="${s.name} (${s.key})"><span>${s.icon}</span><em>${s.name}</em><b>${SK.left[s.id] || 0}</b><kbd>${s.key}</kbd></button>`).join('');
  if (force || html !== skHtml) { skHtml = html; bar.innerHTML = html; }
}
function pickTarget(id) {
  const list = R.ids.filter(i => i !== myId && R.alive.has(i) && others.has(i));
  const box = $('targetPick');
  if (!list.length) return ui.toast('ไม่มีเป้าหมายให้ใช้');
  box.innerHTML = `<div class="tt">${SKILL[id].icon} ${SKILL[id].name} — เลือกเป้าหมาย</div>` + list.map(i => `<button data-t="${i}" data-s="${id}">${nameOf(i).replace(/[<>&]/g, '')}</button>`).join('') + '<button data-t="0" class="ghost">ยกเลิก</button>';
  box.hidden = false;
}
function trySkill(id) {
  const s = SKILL[id]; if (!s || !R.running || !amPart()) return;
  if (!SK.left[id]) return ui.toast('ใช้ครบแล้วในรอบนี้');
  if (performance.now() < SK.cdUntil) return;
  if (s.atk) return pickTarget(id);
  net.send({ t: 'skill', id });
}
$('skillBar').addEventListener('click', e => { const b = e.target.closest('[data-skill]'); if (b) trySkill(b.dataset.skill); });
$('targetPick').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $('targetPick').hidden = true;
  if (b.dataset.t !== '0') net.send({ t: 'skill', id: b.dataset.s, target: +b.dataset.t });
});
net.on('skillOk', m => {
  const s = SKILL[m.id]; SK.left[m.id] = m.left; SK.cdUntil = performance.now() + 2500; renderSkills(true);
  if (m.id === 'peek') { SK.peekUntil = performance.now() + m.dur * 1000; ui.toast(`👁 ส่องตา! เห็นทุกคน ${m.dur} วินาที`); sfx.ok(); }
  else if (m.id === 'dash') { SK.dashUntil = performance.now() + m.dur * 1000; ui.toast(`⚡ พุ่ง! ${m.dur} วินาที`); sfx.ok(); }
  else if (m.id === 'shield') { SK.shield = true; ui.toast('🛡 โล่พร้อมแล้ว กันสกิลแกล้งได้ 1 ครั้ง'); sfx.ok(); }
  else if (m.id === 'hint') { const p = pads[m.pad]; if (p) { p.tag.classList.add('struck'); p.struck = true; } ui.toast('💡 ขีดฆ่าแท่นที่ผิดให้ 1 แท่น'); sfx.ok(); }
  else ui.toast(`${s.icon} ใช้ ${s.name} แล้ว`);
});
net.on('skillFail', m => { ui.toast('⚠️ ' + m.reason); sfx.pop(); });
net.on('fx', m => {
  const now = performance.now();
  if (m.k === 'freeze') { SK.freezeUntil = now + m.dur * 1000; me.vx = me.vz = 0; ui.toast(`🧊 ${nameOf(m.by)} แช่แข็งคุณ ${m.dur} วินาที!`); fx.poof(me.x, me.z); }
  else if (m.k === 'reverse') { SK.revUntil = now + m.dur * 1000; ui.toast(`🙃 ${nameOf(m.by)} กลับทิศปุ่มเดินคุณ ${m.dur} วินาที!`); }
  else if (m.k === 'gust') { teleport(m.x, m.z); ui.toast(`💨 ${nameOf(m.by)} เป่าลมใส่คุณ!`); fx.poof(m.x, m.z); }
  else if (m.k === 'shield') { SK.shield = false; ui.toast('🛡 โล่ของคุณกันสกิลแกล้งไว้ได้!'); sfx.ok(); }
  renderSkills(true);
});
net.on('skillUse', m => {   // ประกาศให้ทุกคนในห้องรู้ (ขำ ๆ)
  const s = SKILL[m.id]; if (!s) return;
  sysLine(`${s.icon} ${nameOf(m.by)} ใช้ ${s.name} ใส่ ${nameOf(m.target)}${m.blocked ? ' — 🛡 โดนโล่กัน!' : ''}`);
});
setInterval(() => renderSkills(false), 250);

// ---------- ผู้เล่นคนอื่น ----------
function addOther(info) {
  const e = { info, av: createAvatar(app, factory, info.outfit), px: info.x, pz: info.z, x: info.x, z: info.z, ry: info.ry, tx: info.x, tz: info.z, tr: info.ry, tag: makeTag(info.name), fall: 0 };
  e.tag.style.whiteSpace = 'pre';
  setEmote(e.av, info.emote);
  others.set(info.id, e); updateOnline();
}
function removeOther(id) {
  const e = others.get(id); if (!e) return;
  e.av.root.destroy(); e.tag.remove(); others.delete(id); updateOnline();
}
const updateOnline = () => { $('online').textContent = others.size + 1; if (!$('plist').hidden) renderPlist(); };
const angLerp = (a, b, k) => a + ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) * k;

// ---------- แท่นคำตอบ 3D ----------
let cur = null;   // เกมปัจจุบัน { msg, start, ms, frozen }
const tNow = () => (cur ? (cur.frozen ? cur.ms : Math.min(cur.ms, performance.now() - cur.start)) : 0);
function clearPads() { for (const p of pads) { p.e.destroy(); p.tag.remove(); } pads = []; cur = null; }
function paintPad(p, hidden) {
  if (hidden) { p.tag.textContent = '❓'; p.tag.classList.add('hid'); return; }
  p.tag.classList.remove('hid');
  if (p.label?.view) p.tag.innerHTML = ui.structureSVG(p.label.view); else p.tag.textContent = lbl(p.label, cur?.msg.lang || 'both');
}
function buildPads(list, m) {
  clearPads();
  cur = { msg: m, start: performance.now() - (m.elapsed || 0), ms: m.ms, frozen: false, hidden: false };
  pads = list.map((d, i) => {
    const c = PAD_COLORS[i % PAD_COLORS.length];
    const e = mk('box', c, [d.x, 0.02, d.z], [d.hw * 2 - 0.3, 0.14, d.hw * 2 - 0.3]);
    const tag = makeTag('', list.length >= 9 ? 'pad sm' : 'pad'); tag.style.borderColor = c;
    const p = { e, tag, label: d.label, x: d.x, z: d.z, hw: d.hw, color: c, sink: 0, dead: false, good: false, pulse: 0 };
    paintPad(p, false); return p;
  });
}
function updatePads(dt) {
  if (!cur) return;
  const t = tNow(), m = cur.msg;
  if (m.hide?.what === 'pads' && !cur.frozen && !cur.hidden && t >= m.hide.at) { cur.hidden = true; pads.forEach(p => paintPad(p, true)); sfx.pop(); }
  pads.forEach((p, i) => {
    if (m.motion) { const q = padPos(m.pads, m.motion, i, t); p.x = q.x; p.z = q.z; }
    if (p.dead) return;
    let w = p.hw * 2 - 0.3, y = 0.02 - p.sink * 2.5;
    if (p.good) { p.pulse += dt; w *= 1 + 0.035 * Math.sin(p.pulse * 9); }
    p.e.setLocalScale(w, 0.14, w); p.e.setLocalPosition(p.x, y, p.z);
  });
}
function revealPads(correct) {
  if (cur) { cur.frozen = true; cur.hidden = false; }
  pads.forEach((p, i) => {
    const good = correct.includes(i);
    paintPad(p, false);
    p.e.render.meshInstances[0].material = factory.mat(good ? '#2f9e44' : '#c92a2a');
    p.tag.classList.add(good ? 'good' : 'bad'); p.good = good;
    if (!good) p.sink = 0.001;
  });
}

// ---------- เชื่อมต่อ ----------
let roomInfo = null, ownerId = 0, leaving = false, joinGuard = 0;
async function enterRoom(id, pw) {
  if (!hasServer()) return ui.conn('ยังไม่ได้ตั้งค่าที่อยู่เซิร์ฟเวอร์ (VITE_API_URL) ดูวิธีใน README', true);
  const my = ++joinGuard;
  browser.hide(); ui.conn('กำลังเข้าห้อง...');
  net.leave(); net.url = wsUrl(id);
  try { await net.connect(n => ui.conn(n === 1 ? 'กำลังเข้าห้อง...' : `กำลังเชื่อมต่อ (เซิร์ฟเวอร์ฟรีอาจใช้เวลาตื่น ~1 นาที)  ครั้งที่ ${n}`), 45000); }
  catch { ui.conn(null); return browser.show(currentServer().cf ? QUOTA_MSG.replace('⚠️ ', '⚠️ เข้าห้องไม่สำเร็จ — ห้องอาจถูกปิด หรือ ') : 'เข้าห้องไม่สำเร็จ — ห้องอาจถูกปิดไปแล้ว'); }
  if (my !== joinGuard) return;
  net.send({ t: 'join', name: save.name, outfit: save.outfit, coins: save.coins, skills: save.skills, pw });
}
const browser = createBrowser({ onJoin: enterRoom, onBack: () => { phase = 'menu'; $('menu').hidden = false; }, toast: ui.toast });
// กลับไปหน้าเลือกห้อง: รีโหลดหน้า (ล้างฉากทั้งหมดให้สะอาด) แล้วเปิดหน้าเลือกห้องทันที
function goRooms(why) {
  try { sessionStorage.setItem('ca_rooms', why || '1'); } catch { /* */ }
  location.reload();
}
net.on('denied', m => {
  net.leave(); ui.conn(null);
  browser.show(m.reason === 'password' ? 'รหัสผ่านไม่ถูกต้อง' : 'ห้องนี้เต็มแล้ว');
});
net.on('removed', () => { leaving = true; voice.close(); ui.conn('เจ้าของห้องเชิญคุณออกจากห้อง', true); });
net.on('owner', m => { ownerId = m.id; renderPlist(); });
function renderPlist() {
  const el = $('plist'); if (el.hidden) return;
  const rows = [[myId, save.name + ' (คุณ)'], ...[...others].map(([id, e]) => [id, e.info.name])];
  el.innerHTML = rows.map(([id, nm]) => `<div class="pr"><span>${id === ownerId ? '👑 ' : ''}${nm.replace(/[<>&]/g, '')}</span>${ownerId === myId && id !== myId ? `<button data-kick="${id}">เตะ</button>` : ''}</div>`).join('');
}
$('onlineBtn').onclick = () => { $('plist').hidden = !$('plist').hidden; renderPlist(); };
$('plist').addEventListener('click', e => { const k = e.target.dataset.kick; if (k) { net.send({ t: 'kick', id: +k }); setTimeout(renderPlist, 400); } });
$('leaveRoom').onclick = () => { net.leave(); goRooms(); };

function applyLobby(m) {
  R.queue = new Set(m.joined); R.max = m.max;
  R.cdEnd = m.cd === null ? 0 : performance.now() + m.cd;
  if (m.running) { R.running = true; R.ids = m.running.ids; R.alive = new Set(m.running.alive); R.idx = m.running.idx; }
  else { R.running = false; }
  syncField(); renderJoin();
}
function teleport(x, z) { me.x = x; me.z = z; me.vx = me.vz = 0; me.y = 0; me.vy = 0; sendPos(true); }
const hallSpot = () => teleport((Math.random() - 0.5) * 16, 12 + Math.random() * 8);
function startFall(id) {
  if (id === myId) { if (!me.fall) { me.fall = 0.001; stopEmote(); fx.poof(me.x, me.z); } }
  else { const e = others.get(id); if (e && !e.fall) { e.fall = 0.001; fx.poof(e.x, e.z); } }
}

net.on('welcome', m => {
  myId = m.id; ownerId = m.owner; phase = 'lobby'; ui.conn(null);
  $('roomName').textContent = '🏠 ' + (m.room?.name || ''); $('plist').hidden = true;
  $('menu').hidden = true; $('hud').hidden = false; $('hudName').textContent = save.name;
  Object.assign(me, { x: m.x, y: 0, z: m.z, face: 0, vx: 0, vz: 0, vy: 0, fall: 0 });
  m.players.forEach(addOther);
  $('chatLog').innerHTML = '';
  updateOnline(); ui.setCoins(save.coins);
  applyLobby(m.lobby);
  if (m.game) {   // เข้ามากลางรอบ: ดูเป็นผู้ชม
    ui.roundStart(myId, false); buildPads(m.game.pads, m.game); ui.showGame(m.game, false, false);
    Object.assign(scr, { mode: 'game', msg: m.game, deadline: performance.now() + m.game.ms - m.game.elapsed, total: m.game.ms, myScore: null });
  }
  applySound(); syncField(); applyBoard(m.board || []);
});
net.on('lobby', applyLobby);
net.on('join', m => addOther(m.p));
net.on('chat', m => { addChatLine(m.id, m.name, m.text); if (m.id !== myId) sfx.chat(); });
net.on('emote', m => { const e = others.get(m.id); if (e) setEmote(e.av, m.e); });
net.on('leave', m => removeOther(m.id));
net.on('outfit', m => { const e = others.get(m.id); if (e) { e.info.outfit = m.outfit; setOutfit(e.av, factory, m.outfit); } });
net.on('pos', m => {
  for (const [id, x, z, ry] of m.p) {
    const e = others.get(id); if (!e) continue;
    if (Math.hypot(x - e.tx, z - e.tz) > 6) { e.x = x; e.z = z; e.px = x; e.pz = z; }   // วาร์ป (เริ่มรอบ/กลับห้องรอ)
    e.tx = x; e.tz = z; e.tr = ry;
  }
});

// ---------- รอบมินิเกม ----------
let introTimers = [];
net.on('roundStart', m => {
  R.running = true; R.ids = m.ids; R.alive = new Set(m.ids); R.idx = 0;
  const part = m.ids.includes(myId);
  if (part) closeWardrobe();
  clearPads(); meAv.root.setLocalScale(1, 1, 1);
  if (part) { const s = m.spawn[myId]; teleport(s[0], s[1]); stopEmote(); }
  else if (me.z < HALL.minZ) hallSpot();
  specId = 0; skReset(); $('targetPick').hidden = true;
  openChat(false);
  Object.assign(scr, { mode: 'intro', msg: null, count: m.ids.length });
  ui.roundStart(myId, part); renderJoin(); syncField();
  introTimers.forEach(clearTimeout); introTimers = [];
  if (part) { sfx.start(); flash('🏁<small>เตรียมตัว!</small>'); }
  for (const k of [3, 2, 1]) if (m.intro - k * 1000 > 200) introTimers.push(setTimeout(() => { if (amPart()) { flash(String(k)); sfx.tick(); } }, m.intro - k * 1000));
});
net.on('game', m => {
  R.alive = new Set(m.alive); R.idx = m.idx; R.running = true; ui.setScore(m.scores?.[myId] || 0);
  if (amPart() && m.spawn?.[myId] && !me.fall) { const sp = m.spawn[myId]; teleport(sp[0], sp[1]); stopEmote(); }   // เกมใหม่: กลับไปเกิดที่จุดเริ่มต้น
  buildPads(m.pads, m); ui.showGame(m, amPart(), amAlive());
  Object.assign(scr, { mode: 'game', msg: m, deadline: performance.now() + m.ms - (m.elapsed || 0), total: m.ms, myScore: amPart() ? (m.scores?.[myId] || 0) : null }); lastSec = -1;
  syncField();
  if (amPart() || spectating()) { sfx.newGame(); flash(`${m.icon}<small>${m.title}${m.mechTag ? ' · ' + m.mechTag : ''}</small>`); }
  if (m.debug && import.meta.env.DEV) window.__dbgGame = m;
});
net.on('ack', m => { ui.showAck(m); if (m.ok) sfx.ok(); else sfx.pop(); });
net.on('reveal', m => {
  revealPads(m.correct);
  const part = amPart(), got = part && m.ok.includes(myId), gain = m.gain[myId] || 0;
  ui.showReveal(m, !part ? null : got ? 'ok' : 'miss', gain, m.scores[myId] || 0);
  ui.setScore(m.scores[myId] || 0); scr.myScore = part ? (m.scores[myId] || 0) : null;
  const board = Object.entries(m.scores).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, sc]) => ({ name: nameOf(+id), score: sc, me: +id === myId }));
  const txt = m.answerText || lbl(m.answer, scr.msg?.lang || 'both').replace('\n', '  /  ');
  Object.assign(scr, { mode: 'reveal', reveal: { text: txt, ok: m.ok.length, total: R.alive.size, board, first: m.ok[0] != null ? nameOf(m.ok[0]) : null } });
  for (const id of m.ok) { const p = id === myId ? me : others.get(id); if (p) fx.sparkle(p.x, p.z); }
  if (got) sfx.ok(); else if (part) sfx.out();
});
net.on('kicked', () => { startFall(myId); R.alive.delete(myId); ui.setAlive(false); });
net.on('roundEnd', m => {
  const part = m.ids.includes(myId), reward = part ? (m.rewards[myId] || 0) : 0;
  R.running = false; specId = 0; clearPads(); skReset(); $('targetPick').hidden = true; syncField();
  save.coins += reward; writeSave(save); ui.setCoins(save.coins);
  if (!me.fall && me.z < HALL.minZ) hallSpot();
  const win = m.winners.includes(myId);
  Object.assign(scr, { mode: 'end', msg: null, win, winners: m.winners.map(nameOf).join(', '), board: Object.entries(m.scores).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, sc]) => ({ name: nameOf(+id), score: sc, me: +id === myId })) });
  for (const id of m.winners) { const p = id === myId ? me : others.get(id); if (p) fx.confetti(p.x, p.z); }
  if (win) sfx.win(); else if (part) sfx.out();
  ui.showEnd(m, myId, reward, nameOf, () => { scr.mode = 'idle'; renderJoin(); });
  setTimeout(() => { if (scr.mode === 'end') scr.mode = 'idle'; }, 12000);
  renderJoin();
});
net.on('close', () => { voice.close(); if (!leaving) ui.conn(currentServer().cf ? 'หลุดการเชื่อมต่อ — ถ้าเป็นช่วงที่โควตา Cloudflare เต็ม จะกลับมาใช้ได้ 07:00 น. (เวลาไทย) ของวันถัดไป หรือเลือกเซิร์ฟเวอร์สำรอง' : 'หลุดการเชื่อมต่อจากเซิร์ฟเวอร์', true); });
ui.bindGame(text => net.send({ t: 'answer', text }), () => net.send({ t: 'leaveRound' }));
$('reloadBtn').onclick = () => goRooms();

// ---------- แผงห้องรอ (เข้าคิวรอบถัดไป) ----------
let joinHtml = '';
function renderJoin() {
  const p = $('joinPanel');
  if (phase !== 'lobby' || amPart()) { p.hidden = true; return; }
  const queued = R.queue.has(myId);
  const cd = R.cdEnd ? Math.max(0, Math.ceil((R.cdEnd - performance.now()) / 1000)) : null;
  if (specId && !specList().includes(specId)) specId = 0;
  const status = spectating() ? `👁 กำลังส่อง: ${nameOf(specId).replace(/[<>&]/g, '')}`
    : R.running ? `กำลังแข่ง · เกม ${R.idx}/10`
    : R.queue.size ? `เริ่มใน ${cd ?? '…'} วิ · ${R.queue.size}/${R.max} คน` : 'กดเพื่อเริ่มรอบใหม่';
  const html = `<div class="st">${status}</div><div class="btns">` + (spectating()
    ? `<button id="prevBtn" class="ghost" title="คนก่อนหน้า">◀</button><button id="nextBtn" class="ghost" title="คนถัดไป">▶</button><button id="watchBtn" class="ghost">✕ เลิกดู</button>`
    : `<button id="queueBtn" class="${queued ? 'stand' : ''}">${queued ? 'ยกเลิก' : R.running ? 'เข้ารอบหน้า' : '▶ เริ่มเกม'}</button>
    ${R.running ? `<button id="watchBtn" class="ghost">👁 ส่อง</button>` : ''}`) + '</div>';
  if (html === joinHtml) return;
  joinHtml = html; p.hidden = false; p.innerHTML = html;
}
$('joinPanel').addEventListener('click', e => {
  if (e.target.id === 'queueBtn') net.send({ t: 'queue', on: !R.queue.has(myId) });
  else if (e.target.id === 'watchBtn') { if (spectating()) { specId = 0; renderJoin(); } else cycleSpec(1); }
  else if (e.target.id === 'prevBtn') cycleSpec(-1);
  else if (e.target.id === 'nextBtn') cycleSpec(1);
});
setInterval(renderJoin, 400);

// ---------- เมนู ----------
if (isTouch) document.querySelector('#hud .small').textContent = 'ลากซ้ายล่าง = เดิน · ลากที่อื่น = หมุนกล้อง · ถ่างสองนิ้ว = ซูม';
$('nameIn').value = save.name;
const menuApi = ui.renderMenu(save, o => setOutfit(meAv, factory, o || save.outfit), () => net.send({ t: 'skills', skills: save.skills }));
// ---------- จุดเปลี่ยนชุดในห้องรอ: เดินเข้าวงม่วงเพื่อเปิดร้านแต่งตัว ----------
const wTag = makeTag('👕 เปลี่ยนชุด', ''); wTag.style.color = '#e599f7';
let wardArmed = true, outfitBefore = '';
function openWardrobe() {
  if (phase !== 'lobby') return;
  stopEmote(); input.reset(); openChat(false); $('emotes').hidden = true;
  outfitBefore = JSON.stringify(save.outfit);
  phase = 'wardrobe'; me.vx = me.vz = 0; wardArmed = false;
  $('menu').classList.add('wardrobe'); $('menu').hidden = false; $('hud').hidden = true;
  $('playBtn').textContent = '✔ เสร็จ'; $('tags').style.display = 'none'; document.querySelector('#menu h1').textContent = '👕 เปลี่ยนชุด'; ui.setCoins(save.coins);
}
function closeWardrobe() {
  if (phase !== 'wardrobe') return;
  menuApi.revert();
  phase = 'lobby'; $('menu').hidden = true; $('menu').classList.remove('wardrobe'); $('hud').hidden = false;
  $('playBtn').textContent = '▶ เริ่มเกม'; $('tags').style.display = ''; document.querySelector('#menu h1').textContent = '⚗️ Chem Arena';
  if (JSON.stringify(save.outfit) !== outfitBefore) net.send({ t: 'outfit', outfit: save.outfit });
  touchShown = null;
}
$('playBtn').onclick = () => {
  if (phase === 'wardrobe') return closeWardrobe();
  const n = $('nameIn').value.replace(/[<>&"'`]/g, '').trim().slice(0, 14);
  if (!n) return ui.toast('ใส่ชื่อก่อนนะ');
  save.name = n; writeSave(save); menuApi.revert();
  $('menu').hidden = true; phase = 'rooms'; browser.show();
};

// ---------- ลูปเกม ----------
function sendPos(force) {
  const s = [me.x.toFixed(2), me.z.toFixed(2), me.face.toFixed(2)].join();
  if (force || s !== lastSent) { lastSent = s; net.send({ t: 'move', x: me.x, z: me.z, ry: me.face }); }
}
const boundsNow = () => (!R.running ? ALL : amAlive() ? ARENA : HALL);

function stepMe(dt) {
  if (me.fall) { me.vx = me.vz = 0; return; }        // กำลังตกรอบ: ควบคุมไม่ได้
  const nowT = performance.now(), frozen = nowT < SK.freezeUntil;
  let ax = spectating() || frozen ? { x: 0, y: 0 } : input.axis();
  if (nowT < SK.revUntil) ax = { x: -ax.x, y: -ax.y };
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  const dx = fx * ax.y + rx * ax.x, dz = fz * ax.y + rz * ax.x; // ขนาด 0..1 (จอยสติ๊กดันเบา = เดินช้า)
  if (Math.hypot(dx, dz) > 0.05) me.face = Math.atan2(-dx, -dz);
  const a = Math.min(1, 12 * dt);
  const spd = nowT < SK.dashUntil ? 9.75 : 6.5;
  me.vx += (dx * spd - me.vx) * a; me.vz += (dz * spd - me.vz) * a;
  me.x += me.vx * dt; me.z += me.vz * dt;
  if (me.y <= 0 && !spectating() && !frozen && input.down('Space')) me.vy = 7.5;
  me.vy -= 22 * dt; me.y += me.vy * dt;
  if (me.y < 0) { me.y = 0; me.vy = 0; }
  const B = boundsNow();
  me.x = Math.max(B.minX, Math.min(B.maxX, me.x));
  me.z = Math.max(B.minZ, Math.min(B.maxZ, me.z));
}

let touchShown = null;
function updateTouchUI() {
  if (!isTouch) return;
  const show = phase === 'lobby' && !me.fall;
  if (show !== touchShown) { touchShown = show; $('touch').hidden = !show; }
}

function updateTags() {
  meTag.style.display = ''; meTag.textContent = rankPre(myId) + save.name; meTag.classList.toggle('speaking', (speak.get(myId) || 0) > 0.06 && voice.talking);
  placeTag(meTag, me.x, me.y + 2.1, me.z);
  const hideO = hideOthers();
  for (const [, e] of others) {
    if (hideO) { e.tag.style.display = 'none'; continue; }
    e.tag.textContent = rankPre(e.info.id) + e.info.name; e.tag.classList.toggle('speaking', (speak.get(e.info.id) || 0) > 0.06);
    placeTag(e.tag, e.x, 2.1, e.z);
  }
  for (const p of pads) {
    placeTag(p.tag, p.x, 1.6 - p.sink * 3, p.z);
    // ขนาดป้ายตามความกว้างของแท่นบนหน้าจอ (กันป้ายทับกันบนจอเล็ก)
    tmpV.set(p.x - p.hw, 0, p.z); camE.camera.worldToScreen(tmpV, outV); const x1 = outV.x;
    tmpV.set(p.x + p.hw, 0, p.z); camE.camera.worldToScreen(tmpV, outV);
    const w = Math.abs(outV.x - x1);
    p.tag.style.maxWidth = Math.max(44, w * 0.96) + 'px'; p.tag.style.fontSize = clamp(w / 9.5, 8, 18) + 'px'; p.tag.style.setProperty('--sw', Math.max(30, w * 0.7) + 'px');
  }
}

// ตกรอบ: ตัวละครหมุนแล้วหดหายไป จากนั้นวาร์ปไปห้องรอ
function animFall(dt, av, owner) {
  owner.fall += dt;
  const k = Math.max(0, 1 - owner.fall / 0.9);
  av.root.setLocalScale(k, k, k);
  av.root.rotate(0, 720 * dt, 0);
  if (owner.fall >= 0.9) {
    owner.fall = 0; av.root.setLocalScale(1, 1, 1);
    if (owner === me) hallSpot();
  }
}

const cam = { x: 0, y: 8, z: 24, lx: 0, ly: 1, lz: 16 };

// ระหว่างเล่นมินิเกม ผู้เล่นคนอื่นจะ "ล่องหน" (กันลอกคำตอบ) แล้วค่อยปรากฏตอนหมดเวลา — ผู้ชมที่ไม่ได้เล่นเห็นปกติ
const hideOthers = () => amPart() && scr.mode === 'game' && performance.now() < scr.deadline && performance.now() >= SK.peekUntil;
// ---------- ส่องผู้เล่น (สำหรับคนที่ไม่ได้เข้ารอบ) ----------
const specList = () => (R.running ? R.ids.filter(id => id !== myId && others.has(id)) : []);
function cycleSpec(dir) {
  const l = specList();
  if (!l.length) { specId = 0; renderJoin(); return; }
  const i = l.indexOf(specId);
  specId = l[(i < 0 ? (dir > 0 ? 0 : l.length - 1) : (i + dir + l.length) % l.length)];
  renderJoin();
}
// จอถ่ายทอด: คัดลอกภาพจากจอมอนิเตอร์ใหญ่ มาแสดงเล็ก ๆ บน UI (กล้องปกติจะได้ไม่ต้องหันไปหาจอ)
const mir = $('mirror'), mirCtx = mir.getContext('2d'); let mirT = 0;
function drawMirror(now) {
  const show = R.running && (amPart() || spectating()) && (scr.mode === 'game' || scr.mode === 'reveal' || scr.mode === 'intro');
  if (mir.hidden === show) mir.hidden = !show;
  if (!show || now - mirT < 90) return;
  mirT = now; mirCtx.drawImage(mon.canvas, 0, 0, mir.width, mir.height);
}
app.on('update', raw => {
  const dt = Math.min(raw, 1 / 30);
  ui.tick();
  if (phase === 'menu' || phase === 'wardrobe' || phase === 'rooms') {
    spin += dt * 40;
    const dbg = import.meta.env.DEV ? window.__dbg : null;
    meAv.root.setPosition(200, 0, 0); meAv.root.setEulerAngles(0, dbg?.spin ?? spin, 0);
    if (dbg && dbg.menuEmote !== undefined && meAv.emote !== dbg.menuEmote) setEmote(meAv, dbg.menuEmote);
    if (dbg?.menuPhase !== undefined) meAv.phase = dbg.menuPhase;
    animateAvatar(meAv, dt, dbg?.menuSpeed || 0, !!dbg?.menuAir);
    const H = window.innerHeight, port = window.innerWidth <= 720 && H > window.innerWidth;
    if (port) { // แผงเมนูอยู่ล่าง: เลื่อนมุมกล้องให้ตัวละครอยู่กึ่งกลางพื้นที่เหนือแผง
      const c = camE.camera, tanV = Math.tan(c.fov * D2R / 2) / (c.horizontalFov ? window.innerWidth / H : 1);
      const f = Math.min(0.8, $('menu').offsetHeight / H);
      const pitch = Math.atan2(0.8 - 1.3, 4.5) - Math.atan(f * tanV);
      camE.setPosition(200, 1.3, 4.5); camE.lookAt(200, 1.3 + 4.5 * Math.tan(pitch), 0);
    } else { camE.setPosition(198.9, 1.3, 4.4); camE.lookAt(198.9, 1.0, 0); }
    meTag.style.display = 'none';
    return;
  }
  if (input.down('KeyQ')) camYaw += 1.8 * dt;
  if (input.down('KeyE')) camYaw -= 1.8 * dt;
  camYaw += input.takeYaw();
  const dPitch = input.takePitch(), zoomK = input.takeZoom();
  camPitchL = clamp(camPitchL + dPitch, 0.04, 1.5); camZoomL = clamp(camZoomL * zoomK, 0.3, 2.6);

  stepMe(dt);
  if (meAv.emote && (me.y > 0.05 || Math.hypot(me.vx, me.vz) > 0.8)) stopEmote();
  animateAvatar(meAv, dt, Math.hypot(me.vx, me.vz), me.y > 0.06);
  meAv.root.setPosition(me.x, me.y, me.z);
  if (me.fall) animFall(dt, meAv, me); else meAv.root.setEulerAngles(0, me.face / D2R, 0);

  const hideO = hideOthers();
  for (const e of others.values()) {
    e.av.root.enabled = !hideO;
    const k = Math.min(1, 12 * dt);
    e.x += (e.tx - e.x) * k; e.z += (e.tz - e.z) * k; e.ry = angLerp(e.ry, e.tr, k);
    const sp = Math.hypot(e.x - e.px, e.z - e.pz) / Math.max(dt, 1e-3); e.px = e.x; e.pz = e.z;
    if (e.av.emote && sp > 0.8) setEmote(e.av, null);
    animateAvatar(e.av, dt, Math.min(sp, 8), false);
    e.av.root.setPosition(e.x, 0, e.z);
    if (e.fall) animFall(dt, e.av, e); else e.av.root.setEulerAngles(0, e.ry / D2R, 0);
  }

  // แท่นที่ตอบผิดจะจมหายไป
  for (const p of pads) if (p.sink > 0 && !p.dead) {
    p.sink += dt * 0.9; p.e.setLocalPosition(p.x, 0.02 - p.sink * 2.5, p.z);
    if (p.sink > 1.2) { p.dead = true; p.e.enabled = false; p.tag.style.opacity = '0.25'; }
  }

  sendT += dt;
  if (sendT > 0.2) { sendT = 0; sendPos(false); }

  // กล้องปกติตลอด (หมุน/เอียง/ซูมอิสระ): ตามตัวเอง หรือตามผู้เล่นที่กำลังส่องอยู่
  if (specId && !others.has(specId)) cycleSpec(1);
  const T = specId ? others.get(specId) : null;
  const fx_ = T ? T.x : me.x, fy_ = T ? 0 : me.y, fz_ = T ? T.z : me.z;
  {
    const d = 9.5 * camZoomL, p = camPitchL, ty = fy_ + 1.1;
    const tgt = { x: fx_ + Math.sin(camYaw) * Math.cos(p) * d, y: ty + Math.sin(p) * d, z: fz_ + Math.cos(camYaw) * Math.cos(p) * d, lx: fx_, ly: ty, lz: fz_ };
    const kc = T ? Math.min(1, 8 * dt) : 1;
    for (const k of ['x', 'y', 'z', 'lx', 'ly', 'lz']) cam[k] += (tgt[k] - cam[k]) * kc;
  }
  camE.setPosition(cam.x, Math.max(0.4, cam.y), cam.z); camE.lookAt(cam.lx, cam.ly, cam.lz);

  coinT += dt;
  if (coinT > 1) { coinT = 0; if (save.coins !== lastCoins) { lastCoins = save.coins; net.send({ t: 'coins', coins: save.coins }); } }
  fxT += dt;
  if (fxT > 0.18) { fxT = 0; if (isSpecial(meAv.emote)) fx.sparkle(me.x, me.z); if (!hideOthers()) for (const e of others.values()) if (isSpecial(e.av.emote)) fx.sparkle(e.x, e.z); }
  updatePads(dt); fx.update(dt); voice.update(myId);
  room.spin.forEach((r, i) => r.rotate(0, (i % 2 ? 9 : -7) * dt, 0));
  // จอมอนิเตอร์ + เสียงนับถอยหลัง
  scr.cd = R.cdEnd ? Math.max(0, Math.ceil((R.cdEnd - performance.now()) / 1000)) : null; scr.queued = R.queue.size; scr.max = R.max;
  mon.render(scr, performance.now());
  document.body.classList.toggle('watchoff', R.running && !amPart() && !spectating());
  drawMirror(performance.now());
  if (scr.mode === 'game' && amAlive()) {
    const sec = Math.ceil((scr.deadline - performance.now()) / 1000);
    if (sec !== lastSec) { lastSec = sec; if (sec > 0 && sec <= 3) sfx.tickHi(); else if (sec > 0 && sec <= 5) sfx.tick(); }
  }
  { // จุดเปลี่ยนชุด
    const d = Math.hypot(me.x - WARDROBE.x, me.z - WARDROBE.z), usable = phase === 'lobby' && !me.fall && !amPart();
    if (d > WARDROBE.r + 1) wardArmed = true;
    if (usable && wardArmed && d < WARDROBE.r) openWardrobe();
    placeTag(wTag, WARDROBE.x, 3.2, WARDROBE.z); wTag.style.display = phase === 'lobby' ? wTag.style.display : 'none';
  }
  updateTouchUI(); updateTags(); updateSocial();
});

// ตัวช่วยทดสอบ: มีเฉพาะตอน npm run dev (ถูกตัดออกจาก build จริง)
if (import.meta.env.DEV) window.__dbg = { voice, scr, get cur() { return cur; }, room, me, R, meAv, camE, others, get pads() { return pads; }, get phase() { return phase; }, get myId() { return myId; } };

applySound();
// กลับมาจาก “ออกจากห้อง/ถูกเตะ/หลุด”: เปิดหน้าเลือกห้องเลย ไม่ต้องกดเริ่มเกมซ้ำ
try {
  if (sessionStorage.getItem('ca_rooms') && save.name) { sessionStorage.removeItem('ca_rooms'); $('menu').hidden = true; phase = 'rooms'; browser.show(); }
} catch { /* */ }
app.start();
