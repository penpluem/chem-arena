// แกนกลางของ "ห้อง" 1 ห้อง: ห้องรอ + รอบมินิเกม 10 เกม (ระบบคะแนน) — ไม่ผูกกับ ws หรือ Cloudflare
// ตัวเชื่อมต่อ (Node ws / Cloudflare Durable Object) ส่ง conn = { send(string), close() } เข้ามา
import { norm } from './chem.js';
import { ARENA, HALL, ALL, TOTAL, makeGame, newRoundPlan, inPad, padPos } from './minigames.js';
import { SKILLS, SKILL_COOLDOWN_MS, ATK_LOCK_MS, IMMUNE_MS, cleanSkills } from './skills.js';

const subtle = globalThis.crypto.subtle;   // Node 20+ และ Cloudflare Workers มีให้
export async function hashPw(pw, salt) {
  const buf = await subtle.digest('SHA-256', new TextEncoder().encode(salt + '|' + pw));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export const randSalt = () => [...(globalThis.crypto?.getRandomValues ? globalThis.crypto.getRandomValues(new Uint8Array(8)) : Array.from({ length: 8 }, () => Math.floor(Math.random() * 256)))].map(b => b.toString(16).padStart(2, '0')).join('');

export const DEFAULT_CONFIG = { maxPlayers: 12, countdownMs: 15000, introMs: 4000, gapMs: 5000, padMs: 15000, typeMs: 25000, floorMs: 18000, debugReveal: false };

// opts: { id, name, pwHash, salt, config, log(kind,msg), onChange(info) }
export function createRoom(opts) {
  const cfg = { ...DEFAULT_CONFIG, ...(opts.config || {}) };
  const MAX_PLAYERS = cfg.maxPlayers, COUNTDOWN_MS = cfg.countdownMs, INTRO_MS = cfg.introMs, GAP_MS = cfg.gapMs;
  const GAME_MS = { pad: cfg.padMs, type: cfg.typeMs, floor: cfg.floorMs };
  const DEBUG_REVEAL = cfg.debugReveal, MAX_TRIES = 3;
  const roomLog = opts.log || (() => {});
  const hl = s => s;
  const log = (k, msg) => roomLog(k, msg);

  const players = new Map();
  let nextId = 1, ownerId = 0, destroyed = false;
  const joined = new Set();       // คิวสำหรับรอบถัดไป
  let countdownEnd = 0, countdownTimer = null;
  let round = null;               // รอบที่กำลังแข่ง
  const conns = new Set();

  const send = (p, o) => { try { p.conn.send(JSON.stringify(o)); } catch { /* ปิดไปแล้ว */ } };
  const broadcast = (o, except) => { const s = JSON.stringify(o); for (const p of players.values()) if (p !== except) { try { p.conn.send(s); } catch { /* */ } } };
  const pub = p => ({ id: p.id, name: p.name, outfit: p.outfit, emote: p.emote, voice: !!p.voice, x: p.x, z: p.z, ry: p.ry });
  const who = id => { const q = players.get(id); return q ? q.name + ` (#${id})` : `#${id}`; };
  const rand = (a, b) => a + Math.random() * (b - a);
  const info = () => ({ id: opts.id, name: opts.name, locked: !!opts.pwHash, count: players.size, max: 60, playMax: MAX_PLAYERS, running: !!round, idx: round ? round.idx + 1 : 0, owner: players.get(ownerId)?.name || '' });
  let infoT = null;
  const notify = () => { if (infoT || !opts.onChange) return; infoT = setTimeout(() => { infoT = null; opts.onChange(info()); }, 400); };

  // ---------- สถานะห้องรอ ----------
  function lobbySnap() {
    return {
      t: 'lobby', joined: [...joined], max: MAX_PLAYERS,
      cd: countdownTimer ? Math.max(0, countdownEnd - Date.now()) : null,
      running: round ? { idx: round.idx + 1, total: TOTAL, alive: [...round.alive], ids: round.ids } : null
    };
  }
  const pushLobby = () => { broadcast(lobbySnap()); notify(); };

  function refreshCountdown() {
    if (round) { clearTimeout(countdownTimer); countdownTimer = null; return; }
    if (joined.size === 0) { clearTimeout(countdownTimer); countdownTimer = null; return; }
    if (!countdownTimer) {
      countdownEnd = Date.now() + COUNTDOWN_MS;
      countdownTimer = setTimeout(startRound, COUNTDOWN_MS);
    }
    if (joined.size >= MAX_PLAYERS && countdownEnd - Date.now() > 3000) {   // เต็มแล้วเริ่มเร็วขึ้น
      clearTimeout(countdownTimer); countdownEnd = Date.now() + 3000; countdownTimer = setTimeout(startRound, 3000);
    }
  }

  // ---------- รอบแข่ง ----------
  function startRound() {
    countdownTimer = null;
    const ids = [...joined].filter(id => players.has(id)); joined.clear();
    if (!ids.length) return pushLobby();
    round = { ids, alive: new Set(ids), idx: -1, plan: newRoundPlan(), game: null, timer: null, score: Object.fromEntries(ids.map(id => [id, 0])), spawn: {}, phase: 'intro' };
    // วางตำแหน่งเริ่มต้นเรียงหน้ากระดานที่ปลายสนาม
    const spawn = {};
    ids.forEach((id, i) => {
      const p = players.get(id), x = ids.length === 1 ? 0 : -16 + (32 * i) / (ids.length - 1);
      p.x = x; p.z = 2.5; p.ry = 0; p.emote = null; spawn[id] = [x, 2.5];
      p.used = {}; p.shield = false; p.frozenUntil = 0; p.immuneUntil = 0; p.skillCd = 0;
    });
    round.spawn = spawn;
    for (const p of players.values()) if (!round.alive.has(p.id)) { p.z = Math.max(HALL.minZ, p.z); }   // คนดู -> ห้องรอ
    broadcast({ t: 'roundStart', ids, total: TOTAL, spawn, intro: INTRO_MS });
    pushLobby();
    round.timer = setTimeout(nextGame, INTRO_MS);
  }

  function nextGame() {
    const r = round; if (!r) return;
    r.idx++;
    if (r.idx >= TOTAL || r.alive.size === 0) return endRound();
    // จบเกมก่อนหน้า -> ทุกคนกลับไปเกิดที่จุดเริ่มต้นของรอบ (เส้นสตาร์ท)
    for (const id of r.alive) { const p = players.get(id), sp = r.spawn[id]; if (p && sp) { p.x = sp[0]; p.z = sp[1]; p.ry = 0; p.emote = null; } }
    const g = makeGame(r.plan[r.idx], r.idx, GAME_MS);
    g.answered = new Map(); g.entered = new Map(); g.start = Date.now();
    r.game = g; r.phase = 'playing';
    const msg = {
      t: 'game', idx: r.idx + 1, total: TOTAL, kind: g.kind, type: g.type, title: g.title, icon: g.icon, rule: g.rule,
      view: g.view || null, name: g.name || null, ms: g.ms, alive: [...r.alive], spawn: r.spawn, scores: r.score,
      lang: g.lang, langRandom: !!g.langRandom, mech: g.mech, mechTag: g.mechTag, motion: g.motion || null, hide: g.hide || null, elapsed: 0,
      pads: g.pads.map(p => ({ x: p.x, z: p.z, hw: p.hw, label: p.label }))
    };
    if (DEBUG_REVEAL) msg.debug = { correct: g.pads.map((p, i) => p.correct ? i : -1).filter(i => i >= 0), answer: g.type === 'type' ? [...g.accept][0] : g.answer.en, accept: g.type === 'type' ? [...g.accept] : undefined };
    r.msg = msg; broadcast(msg); pushLobby();
    r.timer = setTimeout(resolveGame, g.ms);
  }

  const BASE_PTS = 10, BONUS = [5, 3, 1];   // ตอบถูก +10, เข้าวง/ตอบถูกก่อนได้โบนัส 5/3/1
  const inCorrect = (g, p, t) => g.pads.some((pad, i) => pad.correct && inPad(p, { ...padPos(g.pads, g.motion, i, t), hw: pad.hw }));

  function resolveGame() {
    const r = round, g = r?.game; if (!r || !g || r.phase !== 'playing') return;
    clearTimeout(r.timer); r.phase = 'reveal';
    const t = Math.min(g.ms, Date.now() - g.start), ok = [];
    for (const id of r.alive) {
      const p = players.get(id); if (!p) continue;
      if (g.type === 'type' ? g.answered.get(id)?.ok : inCorrect(g, p, t)) { ok.push(id); if (!g.entered.has(id)) g.entered.set(id, g.ms); }
    }
    ok.sort((a, b) => g.entered.get(a) - g.entered.get(b));
    const gain = {};
    ok.forEach((id, i) => { gain[id] = BASE_PTS + (BONUS[i] || 0); r.score[id] += gain[id]; });
    const reveal = {
      t: 'reveal', idx: r.idx + 1, correct: g.pads.map((p, i) => p.correct ? i : -1).filter(i => i >= 0),
      answer: g.answer, answerText: g.answerText || null, ok, gain, scores: r.score, out: [], alive: [...r.alive], spared: false
    };
    r.msg = null; broadcast(reveal); pushLobby();
    r.timer = setTimeout(nextGame, GAP_MS);
  }

  function endRound() {
    const r = round; if (!r) return;
    clearTimeout(r.timer);
    const top = Math.max(0, ...r.ids.map(id => r.score[id] || 0));
    const winners = top > 0 ? r.ids.filter(id => (r.score[id] || 0) === top) : [];
    const rewards = {};
    for (const id of r.ids) rewards[id] = (r.score[id] || 0) + (winners.includes(id) ? 25 : 0);
    log('end', `ผู้ชนะ: ${winners.length ? winners.map(who).join(', ') + ` (${top} แต้ม)` : 'ไม่มี'} · ผู้เล่น ${r.ids.length} คน`);
    broadcast({ t: 'roundEnd', winners, ids: r.ids, rewards, scores: r.score });
    round = null;
    for (const p of players.values()) { p.z = Math.max(HALL.minZ, Math.min(HALL.maxZ, p.z)); }
    pushLobby(); refreshCountdown(); pushLobby();
  }

  function dropFromRound(id) {
    const r = round; if (!r || !r.alive.has(id)) return;
    r.alive.delete(id);
    if (r.phase === 'playing' && r.alive.size === 0) resolveGame();   // ไม่เหลือใครแล้ว: ปิดเกมนี้ทันที
    pushLobby();
  }

  // ---------- รับข้อความจากผู้เล่น ----------
  const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
  const cleanName = (s, id) => String(s ?? '').replace(/[\u0000-\u001f<>&"'`]/g, '').trim().slice(0, 14) || 'ผู้เล่น' + id;
  const OUTFIT_DEF = { color: '#ffdbac', hair: 'short', hairColor: '#6b4226', hat: 'none', face: 'smile', mask: 'none', shirt: 'tee_white', pants: 'jeans' };
  const cleanOutfit = o => {
    const r = {};
    for (const [k, d] of Object.entries(OUTFIT_DEF)) {
      const v = o?.[k], hex = k === 'color' || k === 'hairColor';
      r[k] = typeof v === 'string' && (hex ? /^#[0-9a-f]{6}$/i.test(v) : /^[a-z0-9_]{1,16}$/.test(v)) ? v : d;
    }
    return r;
  };
  const EMOTES = ['wave', 'bow', 'disco', 'robot', 'cheer', 'twist', 'floss'];
  const SPECIAL_EMOTES = ['trophy', 'royal', 'spin'];   // ท่าพิเศษ: เฉพาะผู้เล่นที่รวยที่สุด 3 อันดับแรก
  // ---------- กระดานเศรษฐี: อันดับเหรียญของผู้เล่นที่ออนไลน์ (ค่าเหรียญมาจากไคลเอนต์ — ไม่ใช่ข้อมูลที่เชื่อถือได้ 100%) ----------
  const cleanCoins = v => Math.max(0, Math.min(9999999, Math.floor(num(v))));
  function boardTop() {
    return [...players.values()].filter(p => p.coins > 0).sort((a, b) => b.coins - a.coins || a.id - b.id).slice(0, 5).map(p => ({ id: p.id, name: p.name, coins: p.coins }));
  }
  let lastBoard = '';
  function pushBoard(force) {
    const top = boardTop(), k = JSON.stringify(top);
    if (!force && k === lastBoard) return;
    lastBoard = k; broadcast({ t: 'board', top });
  }
  const isTop3 = id => boardTop().slice(0, 3).some(e => e.id === id);
  const cleanChat = s => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  const boundsFor = p => (round ? (round.alive.has(p.id) ? ARENA : HALL) : ALL);

  const dirty = new Set();

  // บันทึกเวลาที่เข้าแท่นที่ถูกเป็นครั้งแรก (ใช้ให้โบนัสคนที่เข้าก่อน)
  function track(p) {
    const g = round?.game;
    if (g && round.phase === 'playing' && g.type !== 'type' && round.alive.has(p.id)) {
      const t = Math.min(g.ms, Date.now() - g.start);
      if (inCorrect(g, p, t)) { if (!g.entered.has(p.id)) g.entered.set(p.id, t); } else g.entered.delete(p.id);
    }
  }

  // ---------- สกิล ----------
  function useSkill(p, m) {
    const def = SKILLS[m.id], lv = def && p.skills[m.id];
    const fail = reason => send(p, { t: 'skillFail', id: m.id, reason });
    if (!def || !lv) return fail('ยังไม่ได้ซื้อสกิลนี้');
    const g = round?.game, now = Date.now();
    if (!g || round.phase !== 'playing' || !round.alive.has(p.id)) return fail('ใช้ได้ตอนกำลังเล่นเกมเท่านั้น');
    if (now < p.skillCd) return fail('รอสักครู่ (คูลดาวน์)');
    const used = p.used[m.id] || 0, cap = def.uses[lv - 1];
    if (used >= cap) return fail('ใช้ครบแล้วในรอบนี้');
    if (def.atk && g.ms - (now - g.start) < ATK_LOCK_MS) return fail('ช่วง 3 วินาทีสุดท้ายห้ามแกล้ง');
    let q = null, hintPad = -1;
    if (def.atk) {
      q = players.get(num(m.target));
      if (!q || q === p || !round.alive.has(q.id)) return fail('เลือกเป้าหมายก่อน');
      if (q.immuneUntil > now) return fail(`${q.name} เพิ่งโดนสกิล รอสักครู่`);
    }
    if (m.id === 'shield' && p.shield) return fail('มีโล่อยู่แล้ว');
    if (m.id === 'hint') {
      if (g.type === 'type') return fail('ใช้ไม่ได้ในเกมพิมพ์');
      g.hinted ||= new Map(); const done = g.hinted.get(p.id) || new Set();
      const wrong = g.pads.map((pd, i) => (pd.correct || done.has(i) ? -1 : i)).filter(i => i >= 0);
      if (wrong.length <= 1) return fail('ไม่มีตัวเลือกให้ขีดแล้ว');
      hintPad = wrong[Math.floor(Math.random() * wrong.length)]; done.add(hintPad); g.hinted.set(p.id, done);
    }
    p.used[m.id] = used + 1; p.skillCd = now + SKILL_COOLDOWN_MS;
    const ok = { t: 'skillOk', id: m.id, left: cap - p.used[m.id], dur: def.dur[lv - 1] };
    if (m.id === 'shield') p.shield = true;
    if (hintPad >= 0) ok.pad = hintPad;
    let blocked = false;
    if (q) {
      if (q.shield) { q.shield = false; blocked = true; send(q, { t: 'fx', k: 'shield' }); }
      else {
        q.immuneUntil = now + IMMUNE_MS;
        if (m.id === 'freeze') { q.frozenUntil = now + def.dur[lv - 1] * 1000; send(q, { t: 'fx', k: 'freeze', dur: def.dur[lv - 1], by: p.id }); }
        else if (m.id === 'reverse') send(q, { t: 'fx', k: 'reverse', dur: def.dur[lv - 1], by: p.id });
        else if (m.id === 'gust') {
          const a = Math.random() * Math.PI * 2, d = def.dist[lv - 1], B = boundsFor(q);
          q.x = Math.max(B.minX, Math.min(B.maxX, q.x + Math.cos(a) * d)); q.z = Math.max(B.minZ, Math.min(B.maxZ, q.z + Math.sin(a) * d));
          track(q); dirty.add(q.id); send(q, { t: 'fx', k: 'gust', x: q.x, z: q.z, by: p.id });
        }
      }
    }
    send(p, ok);
    if (def.atk) { broadcast({ t: 'skillUse', id: m.id, by: p.id, target: q.id, blocked }); log('turn', `${who(p.id)} ใช้สกิล ${m.id} ใส่ ${who(q.id)}${blocked ? ' (โดนโล่กัน)' : ''}`); }
  }

  // ---------- ห้อง: ผู้เล่นเข้า/ออก/ส่งข้อความ ----------
  const setOwner = () => {
    if (players.has(ownerId)) return;
    ownerId = players.size ? Math.min(...players.keys()) : 0;
    if (ownerId) broadcast({ t: 'owner', id: ownerId });
  };

  async function join(conn, m, ip) {
    if (destroyed || conn.p) return;
    if (players.size >= 60) { conn.send(JSON.stringify({ t: 'denied', reason: 'full' })); conn.close(); return; }
    if (opts.pwHash && (typeof m.pw !== 'string' || (await hashPw(m.pw.slice(0, 40), opts.salt)) !== opts.pwHash)) {
      conn.send(JSON.stringify({ t: 'denied', reason: 'password' })); conn.close(); return;
    }
    if (conn.p) return;
    const id = nextId++;
    const p = { id, conn, name: cleanName(m.name, id), outfit: cleanOutfit(m.outfit), emote: null, coins: cleanCoins(m.coins), skills: cleanSkills(m.skills), used: {}, skillCd: 0, shield: false, frozenUntil: 0, immuneUntil: 0, lastChat: 0, x: rand(-8, 8), z: rand(14, 20), ry: 0, t0: Date.now(), ip };
    conn.p = p; players.set(id, p); conns.add(conn);
    if (!ownerId || !players.has(ownerId)) ownerId = id;
    log('join', `${who(id)} · ห้อง "${opts.name}" · ออนไลน์ ${players.size} คน`);
    send(p, { t: 'welcome', id, owner: ownerId, room: { id: opts.id, name: opts.name }, players: [...players.values()].filter(q => q !== p).map(pub), lobby: lobbySnap(), game: round?.msg ? { ...round.msg, elapsed: Date.now() - round.game.start } : null, board: boardTop(), x: p.x, z: p.z });
    broadcast({ t: 'join', p: pub(p) }, p); pushBoard(); notify();
  }

  function message(conn, raw) {
    let m;
    if (typeof raw !== 'string') { try { raw = new TextDecoder().decode(raw); } catch { return; } }
    if (raw.length > 16384) return conn.close();
    if (!conn.msgCount) conn.msgCount = 0;
    if (++conn.msgCount > 150) return conn.close();
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'join') return join(conn, m, conn.ip || '?');
    const p = conn.p; if (!p) return;

    if (m.t === 'ping') { send(p, { t: 'pong' }); return; }
    if (m.t === 'move') {
      if (p.frozenUntil > Date.now()) { dirty.add(p.id); return; }   // โดนแช่แข็ง: ไม่รับตำแหน่งใหม่
      const B = boundsFor(p);
      const nx = Math.max(B.minX, Math.min(B.maxX, num(m.x))), nz = Math.max(B.minZ, Math.min(B.maxZ, num(m.z)));
      if (p.emote && Math.hypot(nx - p.x, nz - p.z) > 0.05) p.emote = null;   // ขยับตัว = เลิกเต้น
      p.x = nx; p.z = nz; p.ry = num(m.ry);
      track(p);
      dirty.add(p.id);
    } else if (m.t === 'queue') {            // เข้า/ออกคิวรอบถัดไป
      if (m.on) { if (joined.size < MAX_PLAYERS) joined.add(p.id); } else joined.delete(p.id);
      refreshCountdown(); pushLobby();
    } else if (m.t === 'leaveRound') {       // ออกจากรอบ
      if (round?.alive.has(p.id)) {
        send(p, { t: 'kicked' });
        dropFromRound(p.id);
        p.z = Math.max(HALL.minZ, p.z);
      }
    } else if (m.t === 'answer') {           // มินิเกมพิมพ์ชื่อ
      const g = round?.game;
      if (!g || g.type !== 'type' || round.phase !== 'playing' || !round.alive.has(p.id) || typeof m.text !== 'string') return;
      const a = g.answered.get(p.id) || { ok: false, tries: 0 };
      if (a.ok || a.tries >= MAX_TRIES) return;
      a.tries++; a.ok = g.accept.has(norm(m.text.slice(0, 80)));
      if (a.ok) g.entered.set(p.id, Date.now() - g.start);
      g.answered.set(p.id, a);
      send(p, { t: 'ack', ok: a.ok, left: MAX_TRIES - a.tries });
    } else if (m.t === 'chat') {
      const now = Date.now(), text = cleanChat(m.text);
      if (!text || now - p.lastChat < 700) return;          // กันสแปม: 1 ข้อความ/0.7 วินาที
      p.lastChat = now;
      broadcast({ t: 'chat', id: p.id, name: p.name, text });
    } else if (m.t === 'outfit') {            // เปลี่ยนชุดในห้องรอ -> ให้คนอื่นเห็นด้วย
      p.outfit = cleanOutfit(m.outfit); broadcast({ t: 'outfit', id: p.id, outfit: p.outfit }, p);
    } else if (m.t === 'voice') {             // เปิด/ปิดไมค์ (แค่ประกาศสถานะ เสียงวิ่งตรงระหว่างผู้เล่นผ่าน WebRTC)
      p.voice = !!m.on; broadcast({ t: 'voice', id: p.id, on: p.voice }, p);
    } else if (m.t === 'rtc') {               // ส่งต่อข้อความ signaling ของ WebRTC ให้ผู้เล่นปลายทาง
      const q = players.get(num(m.to));
      if (!q || q === p || !m.data || typeof m.data !== 'object' || JSON.stringify(m.data).length > 12000) return;
      send(q, { t: 'rtc', from: p.id, data: m.data });
    } else if (m.t === 'skills') {            // ประกาศสกิลที่มี (เลเวล 1-3) หลังซื้อ/อัป
      p.skills = cleanSkills(m.skills);
    } else if (m.t === 'skill') {
      useSkill(p, m);
    } else if (m.t === 'coins') {
      p.coins = cleanCoins(m.coins); pushBoard();
    } else if (m.t === 'kick') {              // เจ้าของห้องเตะผู้เล่น
      const q = players.get(num(m.id));
      if (p.id !== ownerId || !q || q === p) return;
      send(q, { t: 'removed' }); log('leave', `เจ้าของห้องเตะ ${who(q.id)}`);
      try { q.conn.close(); } catch { /* */ } leave(q.conn);
    } else if (m.t === 'emote') {
      const e = m.e === null ? null : EMOTES.includes(m.e) ? m.e : SPECIAL_EMOTES.includes(m.e) && isTop3(p.id) ? m.e : undefined;
      if (e === undefined) return;
      p.emote = e; broadcast({ t: 'emote', id: p.id, e }, p);
    }
  }

  function leave(conn) {
    conns.delete(conn);
    const p = conn.p; if (!p || !players.has(p.id)) return;
    players.delete(p.id); dirty.delete(p.id);
    joined.delete(p.id); dropFromRound(p.id);
    if (round && round.ids.every(i => !players.has(i))) endRound();
    refreshCountdown();
    const sec = Math.round((Date.now() - p.t0) / 1000);
    log('leave', `${p.name} (#${p.id}) · ห้อง "${opts.name}" · อยู่ ${Math.floor(sec / 60)} นาที ${sec % 60} วินาที · เหลือ ${players.size} คน`);
    broadcast({ t: 'leave', id: p.id }); setOwner(); pushLobby(); pushBoard();
  }

  // ส่งตำแหน่งผู้เล่น 10 ครั้ง/วินาที + ล้างตัวนับอัตราส่งข้อความ
  const posTimer = setInterval(() => {
    if (!dirty.size) return;
    const arr = [...dirty].map(id => players.get(id)).filter(Boolean).map(q => [q.id, +q.x.toFixed(2), +q.z.toFixed(2), +q.ry.toFixed(2)]);
    dirty.clear();
    if (arr.length) broadcast({ t: 'pos', p: arr });
  }, 100);
  const rateTimer = setInterval(() => { for (const c of conns) c.msgCount = 0; }, 1000);

  function destroy() {
    destroyed = true; clearInterval(posTimer); clearInterval(rateTimer); clearTimeout(infoT);
    clearTimeout(countdownTimer); if (round) clearTimeout(round.timer); round = null;
    for (const c of [...conns]) { try { c.close(); } catch { /* */ } }
  }
  return { join, message, leave, destroy, info, count: () => players.size, _players: players };
}
