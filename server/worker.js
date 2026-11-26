// Cloudflare Workers + Durable Objects: เซิร์ฟเวอร์หลายห้องที่ไม่ต้องมีใครดูแล
//   Worker (ทางเข้า)  /api/rooms (GET รายการ, POST สร้างห้อง)  /ws/<id> (WebSocket เข้าห้อง)
//   RoomDO       = 1 ห้อง 1 ตัว (ใช้ room.js ตัวเดียวกับ Node)
//   DirectoryDO  = สมุดรายชื่อห้องกลาง (ตัวเดียว)
import { createRoom, hashPw, randSalt } from './room.js';

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const json = (o, code = 200) => new Response(JSON.stringify(o), { status: code, headers: { 'content-type': 'application/json', ...CORS } });
const MAX_ROOMS = 40;
const cleanRoomName = s => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try { return await route(req, env, url); }
    catch (e) { return json({ error: 'quota', detail: String(e?.message || e).slice(0, 120) }, 503); }   // DO เกินโควตา/ล่ม -> ให้ผู้เล่นเห็นข้อความรอรีเซ็ต
  }
};

async function route(req, env, url) {
    const dir = env.DIRECTORY.get(env.DIRECTORY.idFromName('main'));

    if (url.pathname === '/api/rooms' && req.method === 'GET') {
      const r = await dir.fetch('https://dir/list');
      return new Response(r.body, { headers: { 'content-type': 'application/json', ...CORS } });
    }
    if (url.pathname === '/api/rooms' && req.method === 'POST') {
      let m; try { m = await req.json(); } catch { m = {}; }
      const name = cleanRoomName(m.name);
      if (!name) return json({ error: 'ใส่ชื่อห้องก่อน' }, 400);
      const password = typeof m.password === 'string' ? m.password.slice(0, 20) : '';
      const id = Math.random().toString(36).slice(2, 7);
      const ok = await dir.fetch('https://dir/register', { method: 'POST', body: JSON.stringify({ id, name, locked: !!password }) });
      if (!ok.ok) return json({ error: 'ตอนนี้มีห้องเต็มแล้ว ลองใหม่ภายหลัง' }, 429);
      const room = env.ROOM.get(env.ROOM.idFromName(id));
      await room.fetch('https://room/init', { method: 'POST', body: JSON.stringify({ id, name, password }) });
      return json({ id });
    }
    const m = /^\/ws\/([a-z0-9]{1,12})$/.exec(url.pathname);
    if (m) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426, headers: CORS });
      return env.ROOM.get(env.ROOM.idFromName(m[1])).fetch(req);
    }
    return new Response('chem-arena ok', { headers: CORS });
}

// ---------- สมุดรายชื่อห้อง (เก็บในหน่วยความจำ ห้องจะรายงานตัวเองซ้ำทุก ~30 วินาที) ----------
export class DirectoryDO {
  constructor() { this.rooms = new Map(); }
  live() {
    const now = Date.now();
    for (const [id, r] of this.rooms) {
      const stale = now - r.seen > 90000;                       // ไม่รายงานเกิน 90 วินาที = ปิดไปแล้ว
      const emptyOld = r.count === 0 && now - r.created > 60000; // ห้องว่างเกิน 1 นาที = ซ่อน
      if (stale || emptyOld) this.rooms.delete(id);
    }
  }
  async fetch(req) {
    const url = new URL(req.url);
    this.live();
    if (url.pathname === '/list') {
      return new Response(JSON.stringify({ rooms: [...this.rooms.values()].map(({ seen, created, ...i }) => i).sort((a, b) => b.count - a.count) }));
    }
    const m = await req.json();
    if (url.pathname === '/register') {
      if (this.rooms.size >= MAX_ROOMS) return new Response('full', { status: 429 });
      this.rooms.set(m.id, { id: m.id, name: m.name, locked: m.locked, count: 0, max: 60, playMax: 12, running: false, idx: 0, owner: '', seen: Date.now(), created: Date.now() });
    } else if (url.pathname === '/report') {
      const old = this.rooms.get(m.id);
      this.rooms.set(m.id, { ...m, seen: Date.now(), created: old?.created ?? Date.now() });
    }
    return new Response('ok');
  }
}

// ---------- 1 ห้อง = 1 Durable Object ----------
export class RoomDO {
  constructor(state, env) {
    this.state = state; this.env = env; this.room = null; this.cfg = null; this.lastReport = 0;
    state.blockConcurrencyWhile(async () => { this.cfg = (await state.storage.get('cfg')) || null; });
  }
  report(info) {
    const dir = this.env.DIRECTORY.get(this.env.DIRECTORY.idFromName('main'));
    return dir.fetch('https://dir/report', { method: 'POST', body: JSON.stringify(info) }).catch(() => {});
  }
  ensureRoom() {
    if (this.room || !this.cfg) return;
    const log = (k, m) => console.log(`[${k}] ${m}`);
    this.room = createRoom({
      ...this.cfg, config: {}, log,
      onChange: info => {     // รายงานสมุดรายชื่อห้อง ไม่ถี่เกิน 5 วินาที (ประหยัดโควตา request)
        const wait = this.lastReport + 5000 - Date.now();
        if (wait <= 0) { this.lastReport = Date.now(); this.state.waitUntil(this.report(info)); }
        else if (!this.pending) this.pending = setTimeout(() => { this.pending = null; this.lastReport = Date.now(); this.report(this.room?.info() ?? info); }, wait);
        if (info.count === 0) this.idleSoon();
      }
    });
    this.beat = setInterval(() => { if (this.room) this.report(this.room.info()); }, 30000);
  }
  idleSoon() {   // ห้องว่าง -> ปิดตัวเองเพื่อให้ DO หยุดคิดเวลา
    clearTimeout(this.idle);
    this.idle = setTimeout(() => {
      if (this.room && this.room.count() === 0) { this.room.destroy(); this.room = null; clearInterval(this.beat); }
    }, 20000);
  }
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/init') {
      const m = await req.json();
      const salt = randSalt();
      this.cfg = { id: m.id, name: m.name, salt, pwHash: m.password ? await hashPw(m.password, salt) : '' };
      await this.state.storage.put('cfg', this.cfg);
      return new Response('ok');
    }
    if (!this.cfg) return new Response('no such room', { status: 404, headers: CORS });
    this.ensureRoom(); clearTimeout(this.idle);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const conn = { send: s => { try { server.send(s); } catch { /* */ } }, close: () => { try { server.close(1000, 'bye'); } catch { /* */ } }, ip: req.headers.get('cf-connecting-ip') || '?' };
    server.addEventListener('message', e => this.room?.message(conn, e.data));
    const gone = () => { this.room?.leave(conn); if (this.room && this.room.count() === 0) this.idleSoon(); };
    server.addEventListener('close', gone); server.addEventListener('error', gone);
    return new Response(null, { status: 101, webSocket: client });
  }
}
