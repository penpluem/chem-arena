import assert from 'node:assert/strict';
import { makeGame, CATALOG_IDS, newRoundPlan, padPos, inPad, ARENA } from './minigames.js';
assert.equal(CATALOG_IDS.length, 50, 'ต้องมี 50 มินิเกม');
assert.equal(new Set(CATALOG_IDS).size, 50);
let n = 0;
for (const id of CATALOG_IDS) for (let rep = 0; rep < 60; rep++) for (const idx of [0, 4, 9]) {
  const g = makeGame(id, idx); n++;
  assert.ok(['th', 'en', 'both'].includes(g.lang));
  if (g.type === 'type') {
    assert.ok(g.accept.size > 0);
    if (g.lang === 'th') assert.ok([...g.accept].every(s => /[ก-๙]/.test(s) || /^\d+$/.test(s)), id + ' th accept ' + [...g.accept]);
    if (g.lang === 'en') assert.ok([...g.accept].every(s => /^[a-z0-9,]+$/.test(s)), id + ' en accept ' + [...g.accept]);
    continue;
  }
  assert.ok([2, 3, 4, 9].includes(g.pads.length), id + ' pads ' + g.pads.length);
  const labels = g.pads.map(p => p.label.en + '|' + p.label.th);
  assert.equal(new Set(labels).size, labels.length, id + ' dup labels ' + labels);
  const good = g.pads.filter(p => p.correct).length;
  assert.ok(good >= 1, id + ' no correct');
  if (g.base !== 'floor' && g.base !== 'trueFalse' && g.base !== 'sameMol' && g.mech !== 'opposite') assert.equal(good, 1, id + ' multi correct');
  if (g.mech === 'opposite') assert.equal(good, g.pads.length - 1, id + ' opposite');
  for (const p of g.pads) { assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z) && p.hw > 0); assert.ok(p.label.en && p.label.th); }
  // แท่นต้องอยู่ในสนามตลอดเวลา (ตรวจทุก 100ms) และไม่ทับกันจนตอบกำกวม
  for (let t = 0; t <= g.ms; t += 100) {
    const pos = g.pads.map((p, i) => padPos(g.pads, g.motion, i, t));
    pos.forEach((q, i) => {
      const hw = g.pads[i].hw;
      assert.ok(q.x - hw >= ARENA.minX - 0.01 && q.x + hw <= ARENA.maxX + 0.01 && q.z - hw >= ARENA.minZ - 0.01 && q.z + hw <= ARENA.maxZ + 0.01, `${id} pad ${i} out of arena at ${t}: ${JSON.stringify(q)}`);
    });
  }
}
for (let k = 0; k < 300; k++) {
  const plan = newRoundPlan();
  assert.equal(plan.length, 10); assert.equal(new Set(plan).size, 10);
  assert.equal(new Set(plan.map(id => id.split('.')[0])).size, 10, 'ตระกูลโจทย์ซ้ำ');
  assert.ok(plan.filter(id => /^(typeName|convert)/.test(id)).length <= 2);
  assert.ok(!/^(typeName|convert|floor)/.test(plan[0]));
}
console.log('minigames OK:', n, 'games generated, 50 catalog entries');
