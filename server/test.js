import assert from 'node:assert/strict';
import { nameMolecule, canonical, buildFromParts, generateQuestion, randomMol, norm } from './chem.js';
import { englishNames, thaiNames, buildAccept } from './names.js';

const mol = bonds => ({ n: bonds.reduce((m, [a, b]) => Math.max(m, a, b), 0) + 1, bonds: bonds.map(b => [b[0], b[1], b[2] || 1]) });
const en = bonds => englishNames(nameMolecule(mol(bonds)).parts)[0];

const cases = [
  ['2-methylbutane', [[0,1],[1,2],[2,3],[1,4]]],
  ['2-methylpropane', [[0,1],[1,2],[1,3]]],
  ['2,2-dimethylpropane', [[1,0],[1,2],[1,3],[1,4]]],
  ['2,3-dimethylbutane', [[0,1],[1,2],[2,3],[1,4],[2,5]]],
  ['2,2,4-trimethylpentane', [[0,1],[1,2],[2,3],[3,4],[1,5],[1,6],[3,7]]],
  ['3-ethylpentane', [[0,1],[1,2],[2,3],[3,4],[2,5],[5,6]]],
  ['3-ethyl-2-methylpentane', [[0,1],[1,2],[2,3],[3,4],[1,5],[2,6],[6,7]]],
  ['4-ethyl-2-methylhexane', [[0,1],[1,2],[2,3],[3,4],[4,5],[1,6],[3,7],[7,8]]],
  ['4-propylheptane', [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[3,7],[7,8],[8,9]]],
  ['3-methyl-1-butene', [[0,1,2],[1,2],[2,3],[2,4]]],
  ['2-methyl-2-butene', [[0,1],[1,2,2],[2,3],[1,4]]],
  ['2,4-dimethyl-2-pentene', [[0,1],[1,2,2],[2,3],[3,4],[1,5],[3,6]]],
  ['2-pentene', [[0,1],[1,2,2],[2,3],[3,4]]],
  ['3-hexyne', [[0,1],[1,2],[2,3,3],[3,4],[4,5]]],
  ['1-hexyne', [[0,1,3],[1,2],[2,3],[3,4],[4,5]]],
  ['4-methyl-2-pentyne', [[0,1],[1,2,3],[2,3],[3,4],[3,5]]],
  ['3,3-dimethyl-1-butyne', [[0,1,3],[1,2],[2,3],[2,4],[2,5]]]
];
for (const [expected, bonds] of cases) assert.equal(en(bonds), expected);
console.log(`naming: ${cases.length} known molecules OK`);

{
  const p = nameMolecule(mol([[0,1],[1,2,2],[2,3],[1,4]])).parts;
  assert.deepEqual(englishNames(p), ['2-methyl-2-butene', '2-methylbut-2-ene']);
  assert.equal(thaiNames(p)[0], '2-เมทิล-2-บิวทีน');
  const a = buildAccept(p, 'both');
  for (const s of ['2-Methyl-2-butene', '2 - methylbut - 2 - ene', '2-เมทิล-2-บิวทีน', '๒-เมทิล-๒-บิวทีน', '2-เมธิล-2-บิวทีน']) assert.ok(a.has(norm(s)), s);
  assert.ok(!buildAccept(p, 'en').has(norm('2-เมทิล-2-บิวทีน')));
  const p2 = nameMolecule(mol([[0,1],[1,2,3],[2,3],[3,4],[3,5]])).parts;
  assert.equal(thaiNames(p2)[0], '4-เมทิล-2-เพนไทน์');
  assert.ok(buildAccept(p2, 'th').has(norm('4-เมทิล-2-เพนไทน')));
  const p3 = nameMolecule(mol([[0,1],[1,2],[2,3],[3,4],[1,5],[2,6],[6,7]])).parts;
  assert.equal(thaiNames(p3)[0], '3-เอทิล-2-เมทิลเพนเทน');
}
console.log('english/thai formats + answer matching OK');

let made = 0, rejected = 0;
const names = new Set();
for (let level = 0; level < 4; level++) for (let i = 0; i < 1500; i++) {
  const m = randomMol(level);
  const r = m && nameMolecule(m);
  if (!r) { rejected++; continue; }
  assert.equal(canonical(buildFromParts(r.parts)), canonical(m), 'name does not round-trip: ' + englishNames(r.parts)[0]);
  made++; names.add(englishNames(r.parts)[0]);
}
console.log(`random: ${made} molecules round-trip OK (${names.size} distinct names, ${rejected} rejected)`);

for (let level = 0; level < 4; level++) {
  for (let i = 0; i < 300; i++) {
    const q = generateQuestion(level, ['en', 'th', 'both'][i % 3]);
    assert.ok(q.accept.size > 0 && q.view.atoms.length > 3);
  }
}
console.log('question generation OK (4 levels x 300)');
