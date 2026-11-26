// เซิร์ฟเวอร์ Chem Arena แบบหลายห้อง (Node) — ใช้รันในเครื่อง/Render
// ลอจิกเกมอยู่ใน room.js (ตัวเดียวกับที่ใช้บน Cloudflare Workers)
import http from 'http';
import { WebSocketServer } from 'ws';
import { log, hl } from './log.js';
// Node 18 ยังไม่มี globalThis.crypto -> เติมให้ก่อนโหลด room.js (Cloudflare/Node 20+ มีอยู่แล้ว)
if (!globalThis.crypto) globalThis.crypto = (await import('node:crypto')).webcrypto;
const { createRoom, hashPw, randSalt } = await import('./room.js');

const PORT = +process.env.PORT || 8080;
const MAX_ROOMS = +process.env.MAX_ROOMS || 40;
const config = {
  maxPlayers: +process.env.MAX_PLAYERS || 12,
  countdownMs: +process.env.COUNTDOWN_MS || 15000,
  introMs: +process.env.INTRO_MS || 4000,
  gapMs: +process.env.GAP_MS || 5000,
  padMs: +process.env.PAD_MS || 15000,
  typeMs: +process.env.TYPE_MS || 25000,
  floorMs: +process.env.FLOOR_MS || 18000,
  debugReveal: process.env.DEBUG_REVEAL === '1'
};

const rooms = new Map();   // id -> { room, created, emptySince }
const roomLog = name => (k, m) => log(k, m.replace(/^/, ''));

export const cleanRoomName = s => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24);

async function createNewRoom(name, password) {
  name = cleanRoomName(name);
  if (!name) throw new Error('ใส่ชื่อห้องก่อน');
  if (rooms.size >= MAX_ROOMS) throw new Error('ตอนนี้มีห้องเต็มแล้ว ลองใหม่ภายหลัง');
  let id; do id = Math.random().toString(36).slice(2, 7); while (rooms.has(id));
  const pw = typeof password === 'string' ? password.slice(0, 20) : '';
  const salt = randSalt();
  const room = createRoom({ id, name, salt, pwHash: pw ? await hashPw(pw, salt) : '', config, log });
  rooms.set(id, { room, created: Date.now(), emptySince: Date.now() });
  log('server', `สร้างห้อง "${hl(name)}" (${id})${pw ? ' 🔒' : ''} · ทั้งหมด ${rooms.size} ห้อง`);
  return id;
}

const listRooms = () => [...rooms.values()].map(r => r.room.info())
  .filter(i => i.count > 0 || Date.now() - rooms.get(i.id).created < 60000)
  .sort((a, b) => b.count - a.count);

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const json = (res, code, o) => { res.writeHead(code, { 'content-type': 'application/json', ...CORS }); res.end(JSON.stringify(o)); };

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (url === '/api/rooms' && req.method === 'GET') return json(res, 200, { rooms: listRooms() });
  if (url === '/api/rooms' && req.method === 'POST') {
    let body = '';
    for await (const ch of req) { body += ch; if (body.length > 2000) return json(res, 413, { error: 'too large' }); }
    try { const m = JSON.parse(body || '{}'); return json(res, 200, { id: await createNewRoom(m.name, m.password) }); }
    catch (e) { return json(res, 400, { error: e.message }); }
  }
  res.writeHead(200, { 'content-type': 'text/plain', ...CORS }); res.end('chem-arena ok');
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 16384 });
server.on('upgrade', (req, socket, head) => {
  const m = /^\/ws\/([a-z0-9]{1,12})/.exec(req.url.split('?')[0]);
  const r = m && rooms.get(m[1]);
  if (!r) { socket.write('HTTP/1.1 404 Not Found\r\n\r\n'); return socket.destroy(); }
  wss.handleUpgrade(req, socket, head, ws => {
    ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
    const conn = { send: s => { if (ws.readyState === 1) ws.send(s); }, close: () => { try { ws.close(); } catch { /* */ } }, ip: req.socket.remoteAddress };
    ws.on('message', (d, bin) => r.room.message(conn, bin ? d.toString() : d.toString()));
    ws.on('close', () => r.room.leave(conn));
    ws.on('error', () => {});
  });
});

setInterval(() => {   // ตัดการเชื่อมต่อที่ค้าง + ลบห้องที่ว่างเกิน 2 นาที
  for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); }
  for (const [id, r] of rooms) {
    if (r.room.count() > 0) { r.emptySince = 0; continue; }
    if (!r.emptySince) r.emptySince = Date.now();
    if (Date.now() - r.emptySince > 120000) { r.room.destroy(); rooms.delete(id); log('server', `ลบห้องว่าง ${id}`); }
  }
}, 30000);

server.listen(PORT, () => log('server', 'Chem Arena server (หลายห้อง) พร้อมแล้ว ที่พอร์ต ' + PORT));
