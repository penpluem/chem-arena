// สุ่มโมเลกุลแอลเคน/แอลคีน/แอลไคน์ ตั้งชื่อตามกฎ IUPAC จากโครงสร้างจริง และคำนวณพิกัดวาด
import { englishNames, buildAccept, displayName, SUB_EN, SUB_SIZE } from './names.js';
export { norm } from './names.js';

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
function pickW(w) {
  const e = Object.entries(w);
  let r = Math.random() * e.reduce((s, [, v]) => s + v, 0);
  for (const [k, v] of e) { if ((r -= v) < 0) return k; }
  return e[0][0];
}
const cmp = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? -1) !== (b[i] ?? -1)) return (a[i] ?? -1) < (b[i] ?? -1) ? -1 : 1;
  }
  return 0;
};

// ---------- ตั้งชื่อจากโครงสร้าง ----------
function analyze(mol) {
  const adj = Array.from({ length: mol.n }, () => []);
  const ord = new Map();
  for (const [a, b, o] of mol.bonds) {
    adj[a].push(b); adj[b].push(a);
    ord.set(a * 100 + b, o); ord.set(b * 100 + a, o);
  }
  return { adj, bo: (a, b) => ord.get(a * 100 + b) };
}

function leafPaths(adj) {
  const n = adj.length, leaves = [], out = [];
  for (let i = 0; i < n; i++) if (adj[i].length === 1) leaves.push(i);
  for (const s of leaves) {
    const par = new Array(n).fill(-2); par[s] = -1;
    const q = [s];
    while (q.length) { const u = q.shift(); for (const v of adj[u]) if (par[v] === -2) { par[v] = u; q.push(v); } }
    for (const t of leaves) if (t > s) {
      const p = []; for (let x = t; x !== -1; x = par[x]) p.push(x);
      out.push(p.reverse());
    }
  }
  return out;
}

function branchInfo(dp, adj, bo) {
  const on = new Set(dp), subs = [];
  let valid = true;
  for (let k = 0; k < dp.length; k++) {
    for (const nb of adj[dp[k]]) {
      if (on.has(nb)) continue;
      let linear = bo(dp[k], nb) === 1;
      const stack = [[nb, dp[k]]];
      while (stack.length) {
        const [u, p] = stack.pop();
        const ch = adj[u].filter(x => x !== p);
        if (ch.length > 1) linear = false;
        for (const c of ch) { if (bo(u, c) !== 1) linear = false; stack.push([c, u]); }
      }
      const atoms = [nb]; let name = null;
      if (linear) {
        let c = nb, p = dp[k];
        for (;;) { const ch = adj[c].filter(x => x !== p); if (!ch.length) break; p = c; c = ch[0]; atoms.push(c); }
        name = SUB_EN[atoms.length] || null;
      }
      if (!name) valid = false;
      subs.push({ k, atoms, name: name || '~' });
    }
  }
  return { subs, valid };
}

export function nameMolecule(mol) {
  const { adj, bo } = analyze(mol);
  const multi = mol.bonds.filter(b => b[2] > 1);
  if (multi.length > 1) return null;
  const kind = multi.length === 0 ? 'ane' : multi[0][2] === 2 ? 'ene' : 'yne';
  let paths = leafPaths(adj);
  if (multi.length) paths = paths.filter(p => p.some((a, i) => i < p.length - 1 && bo(a, p[i + 1]) > 1));
  if (!paths.length) return null;
  const maxLen = Math.max(...paths.map(p => p.length));
  paths = paths.filter(p => p.length === maxLen);

  let best = null;
  for (const p of paths) for (const dp of [p, p.slice().reverse()]) {
    const { subs, valid } = branchInfo(dp, adj, bo);
    let bondLoc = 0;
    if (multi.length) for (let i = 0; i < dp.length - 1; i++) if (bo(dp[i], dp[i + 1]) > 1) bondLoc = i + 1;
    const locs = subs.map(s => s.k + 1).sort((a, b) => a - b);
    const alpha = subs.slice().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.k - b.k)).map(s => s.k + 1);
    // ลำดับกฎ: สายหลักยาวสุด -> หมู่แทนที่มากสุด -> พันธะไม่อิ่มตัวเลขต่ำสุด -> ตำแหน่งหมู่แทนที่ต่ำสุด -> ตัวอักษรก่อนได้เลขต่ำ
    const key = [-subs.length, bondLoc, ...locs, ...alpha];
    if (!best || cmp(key, best.key) < 0) best = { key, dp, subs, bondLoc, valid };
  }
  if (!best || !best.valid) return null;
  const g = {};
  for (const s of best.subs) (g[s.name] ||= []).push(s.k + 1);
  const parts = {
    len: maxLen, kind, bondLoc: best.bondLoc,
    subs: Object.entries(g).map(([name, locs]) => ({ name, locs: locs.sort((a, b) => a - b) }))
  };
  return { parts, dp: best.dp, subs: best.subs };
}

// ---------- ตัวช่วยทดสอบ ----------
export function canonical(mol) {
  const adj = Array.from({ length: mol.n }, () => []);
  for (const [a, b, o] of mol.bonds) { adj[a].push([b, o]); adj[b].push([a, o]); }
  const enc = (u, p) => '(' + adj[u].filter(([v]) => v !== p).map(([v, o]) => o + enc(v, u)).sort().join('') + ')';
  let best = null;
  for (let r = 0; r < mol.n; r++) { const s = enc(r, -1); if (best === null || s < best) best = s; }
  return best;
}
export function buildFromParts(parts) {
  const bonds = []; let n = parts.len;
  for (let i = 0; i < parts.len - 1; i++) bonds.push([i, i + 1, 1]);
  if (parts.kind !== 'ane') bonds[parts.bondLoc - 1][2] = parts.kind === 'ene' ? 2 : 3;
  for (const s of parts.subs) for (const loc of s.locs) {
    let prev = loc - 1;
    for (let j = 0; j < SUB_SIZE[s.name]; j++) { bonds.push([prev, n, 1]); prev = n; n++; }
  }
  return { n, bonds };
}

// ---------- สุ่มโมเลกุล ----------
const LEVELS = [
  { L: [4, 6], n: [0, 1], maxK: 1, w: { ane: 5, ene: 4, yne: 1 } },
  { L: [5, 7], n: [1, 2], maxK: 2, w: { ane: 4, ene: 3.5, yne: 2.5 } },
  { L: [5, 8], n: [2, 3], maxK: 2, w: { ane: 3, ene: 3.5, yne: 3.5 } },
  { L: [6, 9], n: [2, 4], maxK: 3, w: { ane: 3, ene: 3.5, yne: 3.5 } }
];

export function randomMol(level) {
  const cfg = LEVELS[Math.max(0, Math.min(3, level))];
  const kind = pickW(cfg.w), L = ri(cfg.L[0], cfg.L[1]);
  const bonds = [];
  for (let i = 0; i < L - 1; i++) bonds.push([i, i + 1, 1]);
  if (kind !== 'ane') bonds[ri(0, L - 2)][2] = kind === 'ene' ? 2 : 3;
  const used = new Array(L).fill(0);
  for (const [a, b, o] of bonds) { used[a] += o; used[b] += o; }
  let n = L;
  const ns = ri(cfg.n[0], cfg.n[1]);
  for (let s = 0; s < ns; s++) {
    const cand = [];
    for (let p = 1; p < L - 1; p++) if (used[p] < 4) cand.push(p);
    if (!cand.length) break;
    const p = cand[ri(0, cand.length - 1)], k = ri(1, cfg.maxK);
    let prev = p;
    for (let j = 0; j < k; j++) { bonds.push([prev, n, 1]); prev = n; n++; }
    used[p]++;
  }
  return n <= 13 ? { n, bonds } : null;
}

// ---------- พิกัดวาดโครงสร้างแบบเส้น (หน่วย = ความยาวพันธะ) ----------
export function layoutMol(mol, nm) {
  const { dp, subs } = nm, pos = new Array(mol.n);
  dp.forEach((a, k) => { pos[a] = [k * 0.866, k % 2 === 0 ? 0.5 : 0]; });
  const byK = {};
  for (const s of subs) (byK[s.k] ||= []).push(s);
  for (const k of Object.keys(byK)) {
    const low = k % 2 === 0, list = byK[k];
    const specs = list.length === 1
      ? [{ th: low ? 90 : -90, t: low ? -1 : 1 }]
      : low ? [{ th: 60, t: -1 }, { th: 120, t: 1 }] : [{ th: -60, t: 1 }, { th: -120, t: -1 }];
    list.forEach((s, i) => {
      let [x, y] = pos[dp[k]];
      s.atoms.forEach((a, j) => {
        const ang = ((specs[i].th + (j % 2) * specs[i].t * 60) * Math.PI) / 180;
        x += Math.cos(ang); y += Math.sin(ang); pos[a] = [x, y];
      });
    });
  }
  for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
    if (!pos[i] || !pos[j] || Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1]) < 0.75) return null;
  }
  const fx = Math.random() < 0.5 ? -1 : 1, fy = Math.random() < 0.5 ? -1 : 1;
  return pos.map(([x, y]) => [+(x * fx).toFixed(3), +(y * fy).toFixed(3)]);
}

// ---------- สร้างโจทย์ ----------
export function generateQuestion(level, mode, avoid) {
  for (let tries = 0; tries < 300; tries++) {
    const mol = randomMol(level);
    if (!mol) continue;
    const nm = nameMolecule(mol);
    if (!nm || nm.parts.len > 10) continue;
    const key = englishNames(nm.parts)[0];
    if (avoid && avoid.has(key) && tries < 150) continue;
    const atoms = layoutMol(mol, nm);
    if (!atoms) continue;
    return {
      key,
      view: { atoms, bonds: mol.bonds },
      accept: buildAccept(nm.parts, mode),
      display: displayName(nm.parts, mode)
    };
  }
  throw new Error('cannot generate question');
}
