// สร้างโจทย์ 10 มินิเกมของ 1 รอบ: ทุกเกมมี "แท่น/พื้น" ให้ตัวละครวิ่งไปยืน (หรือพิมพ์ตอบ)
// เซิร์ฟเวอร์ถือเฉลย (correct) และตรวจตำแหน่งตอนหมดเวลา
import { randomMol, nameMolecule, layoutMol, canonical, buildFromParts } from './chem.js';
import { englishNames, thaiNames, buildAccept, displayName, STEM_EN } from './names.js';

export const ARENA = { minX: -20, maxX: 20, minZ: -24, maxZ: 4 };   // สนามแข่ง
export const HALL = { minX: -20, maxX: 20, minZ: 9, maxZ: 24 };     // ห้องรอ/ที่นั่งชม
export const ALL = { minX: -20, maxX: 20, minZ: -24, maxZ: 24 };
export const TOTAL = 10;

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[ri(0, a.length - 1)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = ri(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const nameOf = parts => ({ en: englishNames(parts)[0], th: thaiNames(parts)[0] });
const KIND_TH = { ane: ['alkane', 'อัลเคน'], ene: ['alkene', 'อัลคีน'], yne: ['alkyne', 'อัลไคน์'] };
const kindLabel = k => ({ en: KIND_TH[k][0], th: KIND_TH[k][1] });
const SUBS = ['methyl', 'ethyl', 'propyl'], SUB_TH = { methyl: 'เมทิล', ethyl: 'เอทิล', propyl: 'โพรพิล' };

function genMol(level, want = () => true) {
  for (let t = 0; t < 500; t++) {
    const mol = randomMol(level);
    if (!mol) continue;
    const nm = nameMolecule(mol);
    if (!nm || nm.parts.len > 10 || !want(nm.parts)) continue;
    const atoms = layoutMol(mol, nm);
    if (!atoms) continue;
    return { mol, parts: nm.parts, atoms, name: nameOf(nm.parts) };
  }
  throw new Error('cannot generate molecule');
}

// ชื่อที่ "ผิด" สำหรับโครงสร้างนี้ (ดัดแปลงชื่อจริงเล็กน้อย แล้วเช็กว่าเป็นคนละโมเลกุลจริง ๆ)
const valenceOk = mol => {
  const v = new Array(mol.n).fill(0);
  for (const [a, b, o] of mol.bonds) { v[a] += o; v[b] += o; }
  return v.every(x => x <= 4);
};
function wrongName(m, used) {
  const canon = canonical(m.mol);
  for (let t = 0; t < 200; t++) {
    const p = JSON.parse(JSON.stringify(m.parts));
    const op = ri(0, 4);
    if (op === 0 && p.kind !== 'ane') p.bondLoc = ri(1, p.len - 1);
    else if (op === 1) p.len += Math.random() < 0.5 ? -1 : 1;
    else if (op === 2 && p.subs.length) { const s = pick(p.subs), i = ri(0, s.locs.length - 1); s.locs[i] += Math.random() < 0.5 ? -1 : 1; }
    else if (op === 3) { p.kind = pick(['ane', 'ene', 'yne']); p.bondLoc = p.kind === 'ane' ? 0 : ri(1, Math.max(1, p.len - 1)); }
    else if (op === 4 && p.subs.length) pick(p.subs).name = pick(SUBS);
    else continue;
    if (p.len < 3 || p.len > 10) continue;
    if (p.kind !== 'ane' && (p.bondLoc < 1 || p.bondLoc > p.len - 1)) continue;
    // รวมหมู่แทนที่ชื่อซ้ำ
    const g = {};
    for (const s of p.subs) (g[s.name] ||= []).push(...s.locs);
    p.subs = Object.entries(g).map(([name, locs]) => ({ name, locs: locs.sort((a, b) => a - b) }));
    const all = p.subs.flatMap(s => s.locs);
    if (all.some(l => l < 2 || l > p.len - 1)) continue;
    const mol2 = buildFromParts(p);
    if (!valenceOk(mol2) || canonical(mol2) === canon) continue;
    const n = nameOf(p);
    if (n.en === m.name.en || used.has(n.en)) continue;
    used.add(n.en); return n;
  }
  throw new Error('cannot make wrong name for ' + JSON.stringify(m.parts) + ' used=' + [...used]);
}

const numLabel = n => ({ en: String(n), th: String(n) });
function numberPads(correct, lo, hi, count = 4) {
  const set = new Set([correct]);
  const pool = [];
  for (let i = lo; i <= hi; i++) if (i !== correct) pool.push(i);
  for (const x of shuffle(pool)) { if (set.size >= count) break; set.add(x); }
  return shuffle([...set]).map(n => ({ label: numLabel(n), correct: n === correct }));
}


// ---------- 25 ตระกูลโจทย์ (ทุกตัวสุ่มภาษา th/en/both ได้ตามค่า g.lang) ----------
const V = m => ({ atoms: m.atoms, bonds: m.mol.bonds });
const SUBSCR = '₀₁₂₃₄₅₆₇₈₉';
const sub = n => String(n).replace(/\d/g, d => SUBSCR[d]);
const nums = n => ({ label: numLabel(n) });
const bondSum = m => m.mol.bonds.reduce((s, b) => s + b[2], 0);
const allLocs = p => [...(p.kind === 'ane' ? [] : [p.bondLoc]), ...p.subs.flatMap(s => s.locs)];
const nAns = (n, extra = '') => ({ en: `${n}${extra}`, th: `${n}${extra}` });
const pickDistinct = (lv, want, count, key) => {   // สร้างสารหลายตัวที่ key() ไม่ซ้ำกัน
  const out = [], seen = new Set();
  for (let t = 0; t < 300 && out.length < count; t++) {
    const m = genMol(lv, want), k = key(m);
    if (seen.has(k)) continue; seen.add(k); out.push(m);
  }
  if (out.length < count) throw new Error('pickDistinct failed');
  return out;
};
const nameKind = k => ({ title: kindLabel(k) });

const FAM = {
  pickName: lv => {
    const m = genMol(lv), used = new Set([m.name.en]);
    const pads = shuffle([{ label: m.name, correct: true }, ...[1, 2, 3].map(() => ({ label: wrongName(m, used), correct: false }))]);
    return { title: 'เลือกชื่อที่ถูก', icon: '🧪', textual: true, rule: 'ดูโครงสร้าง แล้ววิ่งไปยืนบนแท่นที่มีชื่อ IUPAC ถูกต้อง', view: V(m), pads, answer: m.name, flip: 'ยืนบนแท่นที่ชื่อ "ผิด" (ไม่ใช่ชื่อที่ถูกของโครงสร้างนี้)' };
  },
  trueFalse: lv => {
    const m = genMol(lv), real = Math.random() < 0.5;
    const shown = real ? m.name : wrongName(m, new Set([m.name.en]));
    return {
      title: 'จริงหรือเท็จ', icon: '⚖️', textual: true, rule: 'ชื่อนี้ตรงกับโครงสร้างหรือไม่? วิ่งไปยืนฝั่งที่ถูก',
      view: V(m), name: shown,
      pads: [{ label: { en: '✔ TRUE', th: '✔ ใช่' }, correct: real }, { label: { en: '✘ FALSE', th: '✘ ไม่ใช่' }, correct: !real }],
      answer: real ? { en: 'ถูกต้อง: ' + m.name.en, th: 'ถูกต้อง: ' + m.name.th } : { en: 'ชื่อที่ถูกคือ ' + m.name.en, th: 'ชื่อที่ถูกคือ ' + m.name.th }
    };
  },
  countC: lv => {
    const m = genMol(lv), n = m.mol.n;
    return { title: 'นับคาร์บอน', icon: '🔢', rule: 'โครงสร้างนี้มีคาร์บอนทั้งหมดกี่อะตอม (รวมกิ่งด้วย)?', view: V(m), pads: numberPads(n, Math.max(2, n - 3), n + 3), answer: { en: `${n} carbons (${m.name.en})`, th: `${n} อะตอม (${m.name.th})` } };
  },
  countH: lv => {
    const m = genMol(lv), n = m.mol.n, h = 4 * n - 2 * bondSum(m);
    return { title: 'นับไฮโดรเจน', icon: '💧', rule: 'โครงสร้างนี้มีไฮโดรเจนทั้งหมดกี่อะตอม? (คาร์บอนแต่ละตัวต้องมีพันธะครบ 4)', view: V(m), pads: numberPads(h, Math.max(2, h - 6), h + 6), answer: { en: `${h} H (${m.name.en})`, th: `${h} อะตอม (${m.name.th})` } };
  },
  formula: lv => {
    const m = genMol(lv), n = m.mol.n, h = 4 * n - 2 * bondSum(m), f = (c, hh) => `C${sub(c)}H${sub(hh)}`;
    const set = new Map([[f(n, h), true]]);
    for (const [dc, dh] of shuffle([[0, 2], [0, -2], [1, 2], [-1, -2], [1, 0], [-1, 0], [0, 4], [1, -2], [-1, 2], [0, -4]])) {
      if (set.size >= 4) break; if (n + dc < 1 || h + dh < 2) continue; set.set(f(n + dc, h + dh), false);
    }
    return { title: 'สูตรโมเลกุล', icon: '⚗️', rule: 'สูตรโมเลกุลของสารนี้คืออะไร?', view: V(m), pads: shuffle([...set]).map(([s, c]) => ({ label: { en: s, th: s }, correct: c })), answer: { en: f(n, h), th: f(n, h) } };
  },
  hcType: lv => {
    const m = genMol(lv);
    return { title: 'ประเภทไฮโดรคาร์บอน', icon: '🔬', textual: true, rule: 'สารนี้เป็นแอลเคน แอลคีน หรือแอลไคน์?', view: V(m), pads: ['ane', 'ene', 'yne'].map(k => ({ label: kindLabel(k), correct: k === m.parts.kind })), answer: kindLabel(m.parts.kind) };
  },
  bondPos: lv => {
    const m = genMol(Math.max(lv, 1), p => p.kind !== 'ane' && p.len >= 5), p = m.parts;
    const what = p.kind === 'ene' ? 'พันธะคู่' : 'พันธะสาม';
    return { title: 'ตำแหน่งพันธะ', icon: '📍', rule: `${what}เริ่มที่คาร์บอนตัวที่เท่าไรของสายหลัก (เลขตำแหน่งในชื่อ)?`, view: V(m), pads: numberPads(p.bondLoc, 1, p.len - 1), answer: { en: `${p.bondLoc} (${m.name.en})`, th: `${p.bondLoc} (${m.name.th})` }, flip: `ยืนบนเลขที่ "ไม่ใช่" ตำแหน่งพันธะ` };
  },
  branch: lv => {
    const m = genMol(Math.max(lv, 1), p => p.subs.length > 0), p = m.parts;
    const big = p.subs.map(s => s.name).sort((a, b) => SUBS.indexOf(b) - SUBS.indexOf(a))[0];
    return { title: 'ชื่อกิ่ง', icon: '🌿', textual: true, rule: 'กิ่ง (หมู่แทนที่) ที่ยาวที่สุดในโครงสร้างนี้ชื่ออะไร?', view: V(m), pads: SUBS.map(s => ({ label: { en: s, th: SUB_TH[s] }, correct: s === big })), answer: { en: big, th: SUB_TH[big] } };
  },
  branchCount: lv => {
    const m = genMol(Math.max(lv, 1), p => p.subs.length > 0), c = m.parts.subs.reduce((s, x) => s + x.locs.length, 0);
    return { title: 'นับกิ่ง', icon: '🌳', rule: 'โครงสร้างนี้มีกิ่ง (หมู่แทนที่) ทั้งหมดกี่กิ่ง?', view: V(m), pads: numberPads(c, 0, Math.max(4, c + 1)), answer: { en: `${c} (${m.name.en})`, th: `${c} กิ่ง (${m.name.th})` } };
  },
  mainChain: lv => {
    const m = genMol(Math.max(lv, 1), p => p.subs.length > 0), L = m.parts.len;
    return { title: 'สายหลักยาวเท่าไร', icon: '📏', rule: 'สายหลัก (ที่ใช้ตั้งชื่อ) มีคาร์บอนกี่ตัว?', view: V(m), pads: numberPads(L, Math.max(2, L - 3), L + 3), answer: { en: `${L} (${m.name.en})`, th: `${L} ตัว (${m.name.th})` } };
  },
  locSum: lv => {
    const m = genMol(Math.max(lv, 1), p => p.subs.length > 0), s = allLocs(m.parts).reduce((a, b) => a + b, 0);
    return { title: 'ผลรวมเลขตำแหน่ง', icon: '➕', textual: true, rule: 'บวกเลขตำแหน่งทุกตัวในชื่อนี้เข้าด้วยกัน ได้เท่าไร?', name: m.name, pads: numberPads(s, Math.max(1, s - 4), s + 4), answer: { en: `${s} (${m.name.en})`, th: `${s} (${m.name.th})` } };
  },
  nameType: lv => {
    const m = genMol(lv);
    return { title: 'อ่านชื่อบอกประเภท', icon: '📖', textual: true, rule: 'ดูจากชื่อ สารนี้เป็นแอลเคน แอลคีน หรือแอลไคน์?', name: m.name, pads: ['ane', 'ene', 'yne'].map(k => ({ label: kindLabel(k), correct: k === m.parts.kind })), answer: kindLabel(m.parts.kind) };
  },
  stem: () => {
    const n = ri(3, 10), name = k => nameOf({ len: k, kind: 'ane', subs: [], bondLoc: 0 });
    const set = new Set([n]); while (set.size < 4) set.add(ri(3, 10));
    return { title: 'คำนำหน้าสายคาร์บอน', icon: '🔟', textual: true, rule: `แอลเคนสายตรงที่มีคาร์บอน ${n} ตัว ชื่ออะไร?`, name: { en: `C × ${n}`, th: `C × ${n}` }, pads: shuffle([...set]).map(k => ({ label: name(k), correct: k === n })), answer: name(n) };
  },
  stemNum: () => {
    const n = ri(3, 10), nm = nameOf({ len: n, kind: 'ane', subs: [], bondLoc: 0 });
    return { title: 'ชื่อบอกจำนวนคาร์บอน', icon: '🔠', textual: true, rule: 'แอลเคนสายตรงชื่อนี้ มีคาร์บอนกี่ตัว?', name: nm, pads: numberPads(n, 2, 11), answer: { en: `${n} (${nm.en})`, th: `${n} (${nm.th})` } };
  },
  thToEn: lv => {
    const m = genMol(lv), used = new Set([m.name.en]);
    const pads = shuffle([{ label: { en: m.name.en, th: m.name.en }, correct: true }, ...[1, 2, 3].map(() => { const w = wrongName(m, used); return { label: { en: w.en, th: w.en }, correct: false }; })]);
    return { title: 'ไทย → อังกฤษ', icon: '🇹🇭', lang: 'th', rule: 'อ่านชื่อภาษาไทย แล้วยืนบนชื่อภาษาอังกฤษที่ตรงกัน', name: { en: m.name.th, th: m.name.th }, pads, answer: m.name };
  },
  enToTh: lv => {
    const m = genMol(lv), used = new Set([m.name.en]);
    const pads = shuffle([{ label: { en: m.name.th, th: m.name.th }, correct: true }, ...[1, 2, 3].map(() => { const w = wrongName(m, used); return { label: { en: w.th, th: w.th }, correct: false }; })]);
    return { title: 'อังกฤษ → ไทย', icon: '🇬🇧', lang: 'th', rule: 'อ่านชื่อภาษาอังกฤษ แล้วยืนบนชื่อภาษาไทยที่ตรงกัน', name: { en: m.name.en, th: m.name.en }, pads, answer: m.name };
  },
  firstLoc: lv => {
    const m = genMol(Math.max(lv, 1), p => p.subs.length > 0 || p.kind !== 'ane'), mn = Math.min(...allLocs(m.parts));
    return { title: 'เลขตำแหน่งน้อยสุด', icon: '⬇️', textual: true, rule: 'ในชื่อนี้ เลขตำแหน่งที่น้อยที่สุดคือเลขอะไร?', name: m.name, pads: numberPads(mn, 1, Math.max(4, mn + 2)), answer: { en: `${mn} (${m.name.en})`, th: `${mn} (${m.name.th})` } };
  },
  pickStructure: lv => {
    const m = genMol(lv), ms = [m, ...pickDistinct(lv, p => true, 8, x => x.name.en).filter(x => x.name.en !== m.name.en).slice(0, 3)];
    const pads = shuffle(ms.map((x, i) => ({ label: { en: x.name.en, th: x.name.th, view: V(x) }, correct: i === 0 })));
    return { title: 'เลือกโครงสร้าง', icon: '🧬', textual: true, rule: 'อ่านชื่อ แล้ววิ่งไปยืนบนโครงสร้างที่ตรงกับชื่อ', name: m.name, pads, answer: m.name };
  },
  sameMol: lv => {
    const same = Math.random() < 0.5;
    const m = genMol(lv, p => p.kind !== 'ane'), alt = englishNames(m.parts);
    const other = same ? alt[1] : wrongName(m, new Set([m.name.en])).en;
    const txt = `${alt[0]}   ⇄   ${other}`;
    return {
      title: 'ชื่อ 2 แบบ สารเดียวกัน?', icon: '🪞', rule: 'สองชื่อนี้เป็นสารตัวเดียวกันหรือไม่? (เทียบกับชื่อแบบเก่า/ใหม่ของ IUPAC)', name: { en: txt, th: txt },
      pads: [{ label: { en: '✔ SAME', th: '✔ สารเดียวกัน' }, correct: same }, { label: { en: '✘ DIFFERENT', th: '✘ คนละสาร' }, correct: !same }],
      answer: same ? { en: 'เป็นสารเดียวกัน (ชื่อแบบเก่า/ใหม่)', th: 'เป็นสารเดียวกัน (ชื่อแบบเก่า/ใหม่)' } : { en: `คนละสาร — ชื่อแรกคือ ${alt[0]}`, th: `คนละสาร — ชื่อแรกคือ ${alt[0]}` }
    };
  },
  odd: lv => {
    const [X, Y] = shuffle(['ane', 'ene', 'yne']);
    const of = k => genMol(lv, p => p.kind === k && p.len >= 4);
    const used = new Set(), items = [];
    const add = (k, correct) => { for (let i = 0; i < 40; i++) { const m = of(k); if (!used.has(m.name.en)) { used.add(m.name.en); items.push({ label: m.name, correct }); return; } } };
    add(X, false); add(X, false); add(X, false); add(Y, true);
    const o = items.find(i => i.correct);
    return { title: 'ตัวประหลาด', icon: '👽', textual: true, rule: `3 ชื่อเป็น${KIND_TH[X][1]} แต่อีก 1 ชื่อเป็นพวกอื่น วิ่งไปยืนที่ชื่อที่ "ไม่เหมือนพวก"`, pads: shuffle(items), answer: { en: `${o.label.en} (${KIND_TH[Y][0]})`, th: `${o.label.th} (${KIND_TH[Y][1]})` } };
  },
  most: lv => {
    const ms = pickDistinct(Math.max(lv, 1), () => true, 4, x => x.mol.n), top = Math.max(...ms.map(x => x.mol.n));
    return { title: 'คาร์บอนมากสุด', icon: '🏔️', textual: true, rule: 'ชื่อไหนมีคาร์บอนรวม (ทั้งสายหลักและกิ่ง) "มากที่สุด"?', pads: shuffle(ms.map(x => ({ label: x.name, correct: x.mol.n === top }))), answer: (w => ({ en: `${w.name.en} (${top} C)`, th: `${w.name.th} (${top} C)` }))(ms.find(x => x.mol.n === top)) };
  },
  fewest: lv => {
    const ms = pickDistinct(Math.max(lv, 1), () => true, 4, x => x.mol.n), lo = Math.min(...ms.map(x => x.mol.n));
    return { title: 'คาร์บอนน้อยสุด', icon: '🪶', textual: true, rule: 'ชื่อไหนมีคาร์บอนรวม (ทั้งสายหลักและกิ่ง) "น้อยที่สุด"?', pads: shuffle(ms.map(x => ({ label: x.name, correct: x.mol.n === lo }))), answer: (w => ({ en: `${w.name.en} (${lo} C)`, th: `${w.name.th} (${lo} C)` }))(ms.find(x => x.mol.n === lo)) };
  },
  floor: lv => {
    const K = pick(['ane', 'ene', 'yne']), nGood = ri(3, 4), used = new Set(), pads = [];
    const add = (k, correct) => { for (let i = 0; i < 40; i++) { const m = genMol(lv, p => (p.kind === k) === correct && p.len >= 3); if (!used.has(m.name.en)) { used.add(m.name.en); pads.push({ label: m.name, correct }); return; } } };
    for (let i = 0; i < nGood; i++) add(K, true);
    while (pads.length < 9) add(K, false);
    return { title: 'พื้นถล่ม', icon: '💥', textual: true, rule: `ยืนบนพื้นที่เป็น${KIND_TH[K][1]} (ชื่อลงท้าย -${K}) เท่านั้น พื้นอื่นจะถล่มลงไป!`, pads: shuffle(pads), answer: kindLabel(K), ms: 18000 };
  },
  typeName: lv => {
    const m = genMol(lv);
    return { type: 'type', title: 'พิมพ์ชื่อสาร', icon: '⌨️', textual: true, rule: 'พิมพ์ชื่อ IUPAC ของสารนี้ให้ถูก', view: V(m), pads: [], parts: m.parts, answer: m.name };
  },
  convert: lv => {
    const m = genMol(lv), toTh = Math.random() < 0.5;
    return {
      type: 'type', title: toTh ? 'แปลชื่อ → ไทย' : 'แปลชื่อ → อังกฤษ', icon: '🔁', lang: toTh ? 'th' : 'en',
      rule: toTh ? 'อ่านชื่อภาษาอังกฤษ แล้วพิมพ์เป็นชื่อภาษาไทย' : 'อ่านชื่อภาษาไทย แล้วพิมพ์เป็นชื่อภาษาอังกฤษ',
      name: toTh ? { en: m.name.en, th: m.name.en } : { en: m.name.th, th: m.name.th }, pads: [], parts: m.parts, answer: m.name
    };
  }
};

// ---------- กลไกเสริม: ทำให้ 25 ตระกูล กลายเป็น 50 มินิเกม ----------
const MECH = {
  normal: { pre: '' },
  fast: { pre: '⚡ เร็วสุด ๆ! ', tag: 'เร็ว' },
  memory: { pre: '🧠 โจทย์จะหายไปกลางเกม จำให้ได้! ', tag: 'จำ' },
  blind: { pre: '🙈 ชื่อบนแท่นจะหายไปกลางเกม จำตำแหน่งให้ได้! ', tag: 'ปิดตา' },
  opposite: { pre: '🙃 กลับด้าน! ', tag: 'กลับด้าน' },
  tiny: { pre: '🔬 แท่นเล็กจิ๋ว! ', tag: 'แท่นจิ๋ว' },
  slide: { pre: '🛷 แท่นเลื่อนไปมา! ', tag: 'แท่นเลื่อน' },
  orbit: { pre: '🎡 แท่นวนเป็นวงกลม! ', tag: 'แท่นหมุน' },
  swap: { pre: '🔀 แท่นสลับที่กลางเกม! ', tag: 'สลับที่' }
};
// [ตระกูล, กลไก] — 50 รายการ
const CATALOG = [
  ['pickName', 'normal'], ['pickName', 'memory'], ['pickName', 'orbit'], ['pickName', 'fast'], ['pickName', 'opposite'],
  ['trueFalse', 'normal'], ['trueFalse', 'swap'],
  ['countC', 'normal'], ['countC', 'slide'], ['countC', 'memory'],
  ['countH', 'normal'], ['formula', 'normal'], ['formula', 'orbit'],
  ['hcType', 'normal'], ['hcType', 'swap'], ['hcType', 'tiny'],
  ['bondPos', 'normal'], ['bondPos', 'slide'], ['bondPos', 'opposite'],
  ['branch', 'normal'], ['branch', 'memory'], ['branchCount', 'normal'], ['branchCount', 'orbit'],
  ['mainChain', 'normal'], ['mainChain', 'fast'], ['locSum', 'normal'],
  ['nameType', 'normal'], ['nameType', 'swap'], ['stem', 'normal'], ['stem', 'slide'],
  ['stemNum', 'normal'], ['stemNum', 'swap'], ['thToEn', 'normal'], ['thToEn', 'blind'],
  ['enToTh', 'normal'], ['enToTh', 'orbit'], ['firstLoc', 'normal'],
  ['pickStructure', 'normal'], ['pickStructure', 'swap'], ['pickStructure', 'fast'],
  ['sameMol', 'normal'], ['odd', 'normal'], ['odd', 'slide'], ['most', 'normal'], ['fewest', 'normal'],
  ['floor', 'normal'], ['floor', 'blind'], ['typeName', 'normal'], ['typeName', 'fast'], ['convert', 'normal']
].map(([base, mech]) => ({ id: `${base}.${mech}`, base, mech }));
export const CATALOG_IDS = CATALOG.map(c => c.id);
export const KIND_IDS = CATALOG_IDS;
const BY_ID = Object.fromEntries(CATALOG.map(c => [c.id, c]));
const isTyping = id => BY_ID[id].base === 'typeName' || BY_ID[id].base === 'convert';

// จัดตำแหน่งแท่นในสนาม (z กลางสนาม = -10)
function layout(n) {
  if (n === 9) return Array.from({ length: 9 }, (_, i) => ({ x: ((i % 3) - 1) * 8, z: -10 + (Math.floor(i / 3) - 1) * 8, hw: 3.6 }));
  const xs = { 2: [-7, 7], 3: [-11, 0, 11], 4: [-14.25, -4.75, 4.75, 14.25] }[n] || [];
  const hw = { 2: 5.5, 3: 4.6, 4: 4.3 }[n];
  return xs.map(x => ({ x, z: -10, hw }));
}

// ตำแหน่งแท่น i ณ เวลา t (ms นับจากเริ่มเกม) — ต้องเหมือนกับ client/src/pads.js ทุกประการ
const sstep = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
export function padPos(pads, motion, i, t) {
  const p = pads[i], n = pads.length;
  if (!motion) return { x: p.x, z: p.z };
  const s = t / 1000;
  if (motion.type === 'slide') return { x: p.x, z: p.z + 5.5 * Math.sin(0.8 * s + 1.3 * i) };
  if (motion.type === 'orbit') { const a = (2 * Math.PI * i) / n + 0.35 * s + Math.PI / 2; return { x: 10 * Math.cos(a), z: -10 + 8 * Math.sin(a) }; }
  if (motion.type === 'swap') {
    const q = pads[(i + 1) % n], k = sstep((t - motion.at) / 500);
    return { x: p.x + (q.x - p.x) * k, z: p.z + (q.z - p.z) * k };
  }
  return { x: p.x, z: p.z };
}

export const levelFor = idx => (idx < 3 ? 0 : idx < 6 ? 1 : idx < 8 ? 2 : 3);
// สุ่ม 10 เกมจาก 50: ตระกูลโจทย์ไม่ซ้ำกัน, เกมพิมพ์ไม่เกิน 2, เกมแรกไม่ใช่พิมพ์/พื้นถล่ม
export function newRoundPlan() {
  for (let t = 0; t < 200; t++) {
    const order = shuffle(CATALOG_IDS), plan = [], bases = new Set();
    let typing = 0;
    for (const id of order) {
      const c = BY_ID[id];
      if (bases.has(c.base) || (isTyping(id) && typing >= 2)) continue;
      if (!plan.length && (isTyping(id) || c.base === 'floor' || c.mech === 'fast')) continue;
      bases.add(c.base); if (isTyping(id)) typing++; plan.push(id);
      if (plan.length === TOTAL) return plan;
    }
  }
  throw new Error('cannot plan round');
}

export function makeGame(id, idx, ms = {}) {
  const c = BY_ID[id]; if (!c) throw new Error('unknown minigame ' + id);
  const g = FAM[c.base](levelFor(idx));
  g.id = id; g.kind = id; g.base = c.base; g.mech = c.mech; g.type ||= 'pads';
  // ภาษา: สุ่มต่อเกม (th / en / both) ถ้าโจทย์เป็นข้อความ
  if (g.textual) { g.lang = pick(['th', 'en', 'both']); g.langRandom = true; }
  g.lang ||= 'both';
  if (g.type === 'type') {
    g.accept = buildAccept(g.parts, g.lang);
    g.answerText = displayName(g.parts, g.lang);
    g.rule = c.base === 'typeName' ? (g.lang === 'th' ? 'พิมพ์ชื่อ IUPAC ของสารนี้เป็น "ภาษาไทย"' : g.lang === 'en' ? 'พิมพ์ชื่อ IUPAC ของสารนี้เป็น "ภาษาอังกฤษ"' : 'พิมพ์ชื่อ IUPAC ของสารนี้ (ไทยหรืออังกฤษก็ได้)') : g.rule;
    g.rule += ' · ตอบผิดได้ 3 ครั้ง';
    delete g.parts;
  }
  g.ms = g.type === 'type' ? (ms.type ?? 25000) : g.ms ? (ms.floor ?? g.ms) : (ms.pad ?? 15000);
  if (ms.pad && g.type === 'pads' && !g.base.startsWith('floor')) g.ms = ms.pad;
  // วางแท่น
  const pos = layout(g.pads.length);
  g.pads.forEach((p, i) => Object.assign(p, pos[i]));
  // กลไก
  const m = c.mech; let rulePre = MECH[m].pre;
  if (m === 'fast') g.ms = Math.round(g.ms * (g.type === 'type' ? 0.6 : 0.5));
  if (m === 'opposite') { g.pads.forEach(p => { p.correct = !p.correct; }); rulePre += g.flip ? g.flip + ' ' : ''; if (g.flip) g.rule = ''; else g.rule = g.rule + ' — แต่คราวนี้ให้ยืนบนแท่นที่ "ไม่ใช่" คำตอบที่ถูก'; }
  if (m === 'tiny') g.pads.forEach(p => { p.hw = +(p.hw * 0.6).toFixed(2); });
  if (m === 'memory') g.hide = { at: Math.round(g.ms * 0.4), what: 'prompt' };
  if (m === 'blind') g.hide = { at: Math.round(g.ms * 0.4), what: 'pads' };
  if (m === 'slide') g.motion = { type: 'slide' };
  if (m === 'orbit') { g.motion = { type: 'orbit' }; g.pads.forEach((p, i) => Object.assign(p, padPos(g.pads, g.motion, i, 0))); }
  if (m === 'swap') g.motion = { type: 'swap', at: Math.round(g.ms * 0.45) };
  g.mechTag = MECH[m].tag || null;
  g.rule = rulePre + g.rule;
  if (g.mech === 'opposite') g.answer = { en: 'ยืนบนแท่นที่ไม่ใช่: ' + g.answer.en, th: 'ยืนบนแท่นที่ไม่ใช่: ' + g.answer.th };
  return g;
}

export const inPad = (p, pad) => Math.abs(p.x - pad.x) <= pad.hw && Math.abs(p.z - pad.z) <= pad.hw;
