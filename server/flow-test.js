// ทดสอบการเล่นจริงผ่าน WebSocket: 3 คนเข้ารอบ, Bob ผิดเกม 1 ตกรอบ, Alice+Cat รอดครบ 10 เกม + ทดสอบเล่นคนเดียว + พิมพ์ชื่อ
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { padPos } from './minigames.js';

const PORT = 8099;
const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT, COUNTDOWN_MS: '800', INTRO_MS: '300', GAP_MS: '300', PAD_MS: '1200', FLOOR_MS: '1200', TYPE_MS: '2000', DEBUG_REVEAL: '1', NO_COLOR: '1' }, stdio: 'inherit' });
const kill = () => srv.kill();
process.on('exit', kill); process.on('uncaughtException', e => { console.error(e); kill(); process.exit(1); });
setTimeout(() => { console.error('TIMEOUT'); kill(); process.exit(1); }, 90000);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const api = (path, body) => fetch('http://localhost:' + PORT + path, body ? { method: 'POST', body: JSON.stringify(body) } : {}).then(r => r.json());
async function newRoom(name, password) { return (await api('/api/rooms', { name, password })).id; }
let ROOM = null;
function client(name, brain, room = ROOM, pw) {
  return new Promise(res => {
    const ws = new WebSocket('ws://localhost:' + PORT + '/ws/' + room);
    const c = { name, ws, id: null, games: [], reveals: [], ends: [], kicked: false, lobby: null, acks: [] };
    ws.on('open', () => ws.send(JSON.stringify({ t: 'join', name, pw })));
    ws.on('message', raw => {
      const m = JSON.parse(raw);
      if (m.t === 'welcome') { c.id = m.id; res(c); }
      if (m.t === 'lobby') c.lobby = m;
      if (m.t === 'game') { c.games.push(m); brain?.(c, m); }
      if (m.t === 'reveal') c.reveals.push(m);
      if (m.t === 'roundEnd') c.ends.push(m);
      if (m.t === 'ack') c.acks.push(m);
    });
    c.send = o => ws.send(JSON.stringify(o));
  });
}
const goto = (c, g, i) => {   // ไปยืนที่ตำแหน่งแท่นตอนหมดเวลา (แท่นอาจเคลื่อนที่)
  const q = padPos(g.pads, g.motion, i, g.ms);
  setTimeout(() => c.send({ t: 'move', x: q.x, z: q.z, ry: 0 }), Math.max(20, g.ms - 250 - (g.elapsed || 0)));
};
const goodBrain = (c, g) => {
  if (g.type === 'type') return c.send({ t: 'answer', text: g.debug.answer });
  goto(c, g, g.debug.correct[0]);
};
const wrongBrain = (c, g) => {
  if (g.type === 'type') return c.send({ t: 'answer', text: 'zzz' });
  const bad = g.pads.findIndex((_, i) => !g.debug.correct.includes(i));
  goto(c, g, bad);
};

// ----- รอบที่ 1: 3 คน -----
await sleep(500);
ROOM = await newRoom('ทดสอบ');
const A = await client('Alice', goodBrain), B = await client('Bob', (c, g) => (g.idx === 1 ? wrongBrain(c, g) : goodBrain(c, g))), C = await client('Cat', goodBrain);
for (const c of [A, B, C]) c.send({ t: 'queue', on: true });
const t0 = Date.now();
while (!A.ends.length && Date.now() - t0 < 80000) await sleep(100);
assert.ok(A.ends.length, 'round ended');
const end = A.ends[0];
console.log('round1 games', A.games.map(g => g.kind).join(','));
console.log('scores', end.scores, 'winners', end.winners, 'rewards', end.rewards);
assert.equal(A.games.length, 10, 'ten games');
assert.equal(A.reveals.length, 10);
assert.ok(B.games.length === 10, 'Bob ไม่ถูกคัดออก ยังเล่นครบ 10 เกม');
assert.ok(!A.reveals[0].ok.includes(B.id), 'Bob พลาดเกม 1 ไม่ได้แต้ม');
assert.ok(A.reveals.every(r => r.out.length === 0), 'ไม่มีใครตกรอบ');
assert.ok(end.scores[A.id] >= 100 && end.scores[C.id] >= 100, 'Alice/Cat ได้ 10+ ต่อเกม');
assert.ok(end.scores[B.id] < end.scores[A.id], 'Bob แต้มน้อยกว่า');
assert.ok(end.winners.length >= 1 && end.winners.every(id => id === A.id || id === C.id), 'ผู้ชนะคือ Alice/Cat');
assert.ok(A.reveals[0].gain[A.id] >= 10 && Object.values(A.reveals[0].gain).some(v => v > 10), 'มีโบนัสคนเข้าก่อน');
assert.equal(new Set(A.games.map(g => g.kind.split('.')[0])).size, 10, '10 distinct families');
assert.ok(A.games.every(g => ['th', 'en', 'both'].includes(g.lang)), 'lang per game');
assert.ok(!('correct' in A.games[0].pads[0]), 'no answer leak');
assert.ok(A.games[3].spawn[A.id], 'เกมส่งจุดเกิดมาให้');
console.log('round1 OK');

// ----- รอบที่ 2: เล่นคนเดียว พลาดทุกเกม = เล่นต่อจนครบ 10 เกม แต่ไม่ได้แต้ม ไม่มีผู้ชนะ -----
await sleep(300);
const S = await client('Solo', wrongBrain);
S.send({ t: 'queue', on: true });
const t1 = Date.now();
while (!S.ends.length && Date.now() - t1 < 40000) await sleep(100);
assert.ok(S.ends.length, 'solo round ended');
assert.equal(S.ends[0].winners.length, 0, 'solo failed -> no winner');
assert.equal(S.games.length, 10, 'solo ไม่จบกลางคัน');
assert.equal(S.ends[0].scores[S.id], 0);
console.log('solo fail OK');

// ----- รอบที่ 3: คนเดียวรอดครบ 10 เกม -----
const S2 = await client('Solo2', goodBrain);
S2.send({ t: 'queue', on: true });
const t2 = Date.now();
while (!S2.ends.length && Date.now() - t2 < 40000) await sleep(100);
assert.deepEqual(S2.ends[0].winners, [S2.id]);
assert.ok(S2.ends[0].scores[S2.id] >= 100);
assert.equal(S2.games.length, 10);
console.log('solo win OK, reward', S2.ends[0].rewards[S2.id]);
// ----- กระดานเศรษฐี + ท่าพิเศษเฉพาะ top 3 -----
const rich = [];
for (const [name, coins] of [['R1', 500], ['R2', 300], ['R3', 200], ['R4', 100]]) {
  const ws = new WebSocket('ws://localhost:' + PORT + '/ws/' + ROOM), o = { name, ws, board: null, emotes: [] };
  ws.on('message', raw => { const m = JSON.parse(raw); if (m.t === 'board') o.board = m.top; if (m.t === 'welcome') { o.id = m.id; o.board = m.board; } if (m.t === 'emote') o.emotes.push(m); });
  await new Promise(r => ws.on('open', r)); ws.send(JSON.stringify({ t: 'join', name, coins })); rich.push(o); await sleep(150);
}
await sleep(300);
const top = rich[0].board;
assert.deepEqual(top.slice(0, 4).map(e => e.name), ['R1', 'R2', 'R3', 'R4'], 'อันดับเหรียญ');
rich[3].ws.send(JSON.stringify({ t: 'emote', e: 'trophy' }));   // อันดับ 4 ใช้ท่าพิเศษไม่ได้
rich[0].ws.send(JSON.stringify({ t: 'emote', e: 'trophy' }));   // อันดับ 1 ใช้ได้
await sleep(300);
assert.ok(rich[1].emotes.some(m => m.id === rich[0].id && m.e === 'trophy'), 'top1 ใช้ท่าพิเศษได้');
assert.ok(!rich[1].emotes.some(m => m.id === rich[3].id), 'อันดับ 4 ใช้ไม่ได้');
rich[3].ws.send(JSON.stringify({ t: 'coins', coins: 900 })); await sleep(300);
assert.equal(rich[0].board[0].name, 'R4', 'อัปเดตอันดับเมื่อเหรียญเปลี่ยน');
rich[3].ws.send(JSON.stringify({ t: 'emote', e: 'spin' })); await sleep(300);
assert.ok(rich[0].emotes.some(m => m.id === rich[3].id && m.e === 'spin'), 'ขึ้น top1 แล้วใช้ได้');
console.log('board OK');
rich.forEach(o => o.ws.close());

// ----- หลายห้อง: รหัสผ่าน, เจ้าของห้อง, เตะ, รายชื่อห้อง -----
const raw = (room, name, pw) => new Promise(res => {
  const ws = new WebSocket('ws://localhost:' + PORT + '/ws/' + room);
  const o = { ws, msgs: [], closed: false };
  ws.on('open', () => ws.send(JSON.stringify({ t: 'join', name, pw })));
  ws.on('message', d => { const m = JSON.parse(d); o.msgs.push(m); if (m.t === 'welcome') o.id = m.id; });
  ws.on('close', () => { o.closed = true; });
  setTimeout(() => res(o), 500);
});
const locked = await newRoom('ห้องลับ', 'abc123');
let list = (await api('/api/rooms')).rooms;
assert.ok(list.find(r => r.id === locked && r.locked && r.count === 0), 'ห้องล็อกขึ้นในรายการ');
const bad = await raw(locked, 'Eve', 'wrong');
assert.ok(bad.msgs.some(m => m.t === 'denied' && m.reason === 'password') && !bad.id, 'รหัสผิดเข้าไม่ได้');
const own = await raw(locked, 'Owner', 'abc123'), guy = await raw(locked, 'Guy', 'abc123');
assert.ok(own.id && guy.id, 'รหัสถูกเข้าได้');
assert.equal(own.msgs.find(m => m.t === 'welcome').owner, own.id, 'คนแรกเป็นเจ้าของห้อง');
guy.ws.send(JSON.stringify({ t: 'kick', id: own.id })); await sleep(300);
assert.ok(!own.closed, 'ผู้เล่นทั่วไปเตะเจ้าของไม่ได้');
own.ws.send(JSON.stringify({ t: 'kick', id: guy.id })); await sleep(400);
assert.ok(guy.closed && guy.msgs.some(m => m.t === 'removed'), 'เจ้าของเตะได้');
const g2 = await raw(locked, 'Gal', 'abc123');
own.ws.close(); await sleep(400);
assert.ok(g2.msgs.some(m => m.t === 'owner' && m.id === g2.id), 'เจ้าของออก -> ส่งต่อให้คนถัดไป');
list = (await api('/api/rooms')).rooms;
assert.equal(list.find(r => r.id === locked).count, 1);
assert.ok(!list.find(r => r.id === ROOM && r.name !== 'ทดสอบ'), 'รายการห้องถูกต้อง');
const other = await newRoom('อีกห้อง'); const lone = await raw(other, 'Solo');
assert.ok(!lone.msgs.some(m => m.t === 'board' && m.top?.some(x => x.name === 'Gal')), 'ห้องแยกกัน ไม่ปนกัน');
g2.ws.close(); lone.ws.close();
console.log('rooms OK');
for (const c of [A, B, C, S, S2]) c.ws.close();
await sleep(300);
console.log('flow OK');
kill(); process.exit(0);
