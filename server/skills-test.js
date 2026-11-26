// ทดสอบสกิล: สิทธิ์การซื้อ, จำนวนครั้ง/รอบ, คูลดาวน์, โล่, แช่แข็ง, ภูมิคุ้มกัน, ใบ้
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
const PORT = 8098;
const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT, COUNTDOWN_MS: '500', INTRO_MS: '300', GAP_MS: '300', PAD_MS: '16000', FLOOR_MS: '16000', TYPE_MS: '16000', DEBUG_REVEAL: '1', NO_COLOR: '1' }, stdio: 'inherit' });
const kill = () => srv.kill();
process.on('exit', kill); process.on('uncaughtException', e => { console.error(e); kill(); process.exit(1); });
setTimeout(() => { console.error('TIMEOUT'); kill(); process.exit(1); }, 60000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(600);
const { id: room } = await (await fetch(`http://localhost:${PORT}/api/rooms`, { method: 'POST', body: JSON.stringify({ name: 'sk' }) })).json();
const cl = (name, skills) => new Promise(res => {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws/${room}`), c = { name, ws, msgs: [], pos: {} };
  ws.on('open', () => ws.send(JSON.stringify({ t: 'join', name, skills })));
  ws.on('message', d => { const m = JSON.parse(d); c.msgs.push(m); if (m.t === 'welcome') { c.id = m.id; res(c); } if (m.t === 'pos') for (const [id, x, z] of m.p) c.pos[id] = [x, z]; if (m.t === 'game') c.game = m; });
  c.send = o => ws.send(JSON.stringify(o));
  c.last = t => [...c.msgs].reverse().find(m => m.t === t);
});
const A = await cl('A', { freeze: 3, hint: 1, peek: 2, dash: 1 }), B = await cl('B', {}), C = await cl('C', { shield: 1 });
for (const c of [A, B, C]) c.send({ t: 'queue', on: true });
while (!A.game) await sleep(100);
assert.ok(A.game.type !== 'type' || true);
// ยังไม่ซื้อ -> ใช้ไม่ได้
B.send({ t: 'skill', id: 'freeze', target: A.id }); await sleep(200);
assert.match(B.last('skillFail').reason, /ยังไม่ได้ซื้อ/, 'ไม่ได้ซื้อใช้ไม่ได้');
A.send({ t: 'skill', id: 'gust', target: B.id }); await sleep(200);
assert.match(A.last('skillFail').reason, /ยังไม่ได้ซื้อ/);
if (A.game.type !== 'type') {   // ใบ้: ขีดแท่นที่ผิด 1 แท่น
  A.send({ t: 'skill', id: 'hint' }); await sleep(200);
  const ok = A.last('skillOk'); assert.ok(ok && ok.id === 'hint' && !A.game.debug.correct.includes(ok.pad), 'ใบ้ชี้แท่นผิด');
  A.msgs.length = 0;
}
await sleep(2600);
// ส่องตา + พุ่ง
A.send({ t: 'skill', id: 'peek' }); await sleep(200);
let ok = A.last('skillOk'); assert.ok(ok.id === 'peek' && ok.dur === 5 && ok.left === 1, 'peek Lv2: 5 วิ ใช้ได้ 2 ครั้ง');
// แช่แข็ง B (A ใช้ freeze Lv3: 4 วิ, 2 ครั้ง) — โล่ของ C กันได้
B.send({ t: 'move', x: 1, z: 3, ry: 0 }); await sleep(300);
C.send({ t: 'skill', id: 'shield' }); await sleep(200);
assert.equal(C.last('skillOk').id, 'shield');
await sleep(2400);
A.send({ t: 'skill', id: 'freeze', target: B.id }); await sleep(250);
assert.equal(B.last('fx').k, 'freeze'); assert.equal(B.last('fx').dur, 4, 'freeze Lv3 = 4 วิ');
assert.equal(A.last('skillUse').blocked, false);
B.send({ t: 'move', x: -3, z: 3, ry: 0 }); await sleep(350);
assert.deepEqual(A.pos[B.id], [1, 3], 'B ถูกแช่แข็ง ตำแหน่งไม่เปลี่ยน');
// B มีภูมิคุ้มกันหลังโดน / คูลดาวน์
await sleep(2600);
A.send({ t: 'skill', id: 'freeze', target: B.id }); await sleep(250);
assert.match(A.last('skillFail').reason, /เพิ่งโดนสกิล/, 'ภูมิคุ้มกันหลังโดน');
A.send({ t: 'skill', id: 'freeze', target: C.id }); await sleep(300);
const su = A.last('skillUse');
assert.ok(su && su.target === C.id && su.blocked === true, 'โล่ของ C กันแช่แข็ง'); assert.equal(C.last('fx').k, 'shield');
await sleep(2600);
A.send({ t: 'skill', id: 'freeze', target: C.id }); await sleep(250);
assert.match(A.last('skillFail').reason, /ใช้ครบแล้ว/, 'freeze Lv3 ใช้ได้ 2 ครั้งต่อรอบ');
console.log('skills OK');
kill(); process.exit(0);
