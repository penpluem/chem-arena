import * as pc from 'playcanvas';
import DATA from './character-data.json';
import { find } from './shop.js';

// ตัวละคร R15 (โมเดลจาก Roblox Studio) แบ่งเป็น 15 ชิ้นแข็ง ต่อกันด้วยข้อต่อ (เหมือน Motor6D)
// โครงข้อต่อ: pelvis -> spine -> head / ไหล่ -> ศอก -> ข้อมือ ; pelvis -> สะโพก -> เข่า -> ข้อเท้า
// ทุกชิ้นหมุนรอบแกน X ของข้อต่อ (หมุนบวก = แกว่งไปข้างหน้า เพราะตัวละครหันหน้าไป -Z)

export const SCALE = 0.34;            // 1 stud = 0.34 หน่วยเกม (ตัวสูง ~1.73)
const ORIGIN = [-1, 2, 42];           // จุดกลางเท้าของโมเดลในไฟล์ (x, พื้น y, z)
const SEAT_DROP = -0.08;              // ลดตัวลงเมื่อนั่งบนเก้าอี้ (ที่นั่งสูง ~0.56)

const LEG = ['rHip', 'rKnee', 'rAnkle', 'lHip', 'lKnee', 'lAnkle'];
const BASE_JOINTS = ['pelvis', 'spine', 'head', 'rShoulder', 'rElbow', 'rWrist', 'lShoulder', 'lElbow', 'lWrist', ...LEG];

let meshCache = null;
function getMeshes(device) {
  if (meshCache) return meshCache;
  meshCache = {};
  for (const name of DATA.order) {
    const d = DATA.parts[name], m = new pc.Mesh(device);
    m.setPositions(d.pos); m.setNormals(d.nrm); m.setIndices(d.idx); m.update();
    meshCache[name] = m;
  }
  return meshCache;
}

// ปรับสีให้เข้ม/จางลงตามตัวคูณ (ใช้ทำสีขา)
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * k))));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

// f = { mk, mat } จาก createFactory
export function createAvatar(app, f, outfit) {
  const root = new pc.Entity('avatar'); app.root.addChild(root);
  const off = new pc.Entity('offset'); root.addChild(off);
  const model = new pc.Entity('model'); off.addChild(model);
  model.setLocalScale(SCALE, SCALE, SCALE);
  model.setLocalPosition(-SCALE * ORIGIN[0], -SCALE * ORIGIN[1], -SCALE * ORIGIN[2]);

  const meshes = getMeshes(app.graphicsDevice), j = {};
  for (const name of DATA.order) {
    const d = DATA.parts[name], e = new pc.Entity(name);
    const pp = d.parent ? DATA.parts[d.parent].pivot : [0, 0, 0];
    e.setLocalPosition(d.pivot[0] - pp[0], d.pivot[1] - pp[1], d.pivot[2] - pp[2]);
    (d.parent ? j[d.parent] : model).addChild(e);
    const mi = new pc.MeshInstance(meshes[name], f.mat('#ff8c42'));
    e.addComponent('render', { meshInstances: [mi], castShadows: true, receiveShadows: true });
    j[name] = e;
  }
  
  const ang = {}; for (const n of BASE_JOINTS) ang[n] = 0;
  const av = { root, off, model, j, deco: [], ang, seated: false, emote: null, et: 0, phase: 0, t: Math.random() * 10, spd: 0, color: null };
  setOutfit(av, f, outfit);
  setSeated(av, false);
  return av;
}

export function setSeated(av, seated) { av.seated = seated; }

// ---------- แต่งตัว ----------
// พิกัดของที่สวมใส่อยู่ในหน่วย stud ของข้อต่อนั้น ๆ  (หัว: กลางหน้า x=0, คอ y=0, หน้าสุด z≈-0.6, ยอดหัว y≈1.15)
//                                            (ลำตัว spine: x ±1, y 0..1.6, หน้า z=-0.5)
export function setOutfit(av, f, o) {
  for (const c of av.deco || []) c.destroy();
  av.deco = [];
  const mk = (joint, t, hex, p, s, rot) => {
    const e = f.mk(t, hex, p, s, av.j[joint]); av.deco.push(e);
    if (rot) e.setLocalEulerAngles(rot[0], rot[1], rot[2]);
    return e;
  };
  const H = (t, hex, p, s, rot) => mk('head', t, hex, p, s, rot);
  const T = (t, hex, p, s, rot) => mk('spine', t, hex, p, s, rot);

  // ----- สีชิ้นส่วนร่างกาย: ผิว / เสื้อ / กางเกง -----
  const skin = o.color || '#ffdbac';
  const sh = find('shirt', o.shirt), pa = find('pants', o.pants);
  const shirt = sh && sh.t ? sh : null, pants = pa && pa.c ? pa : null;
  const col = {
    pelvis: pants ? pants.c : shirt ? shirt.t : skin, spine: shirt ? shirt.t : skin, head: skin,
    rShoulder: shirt ? shirt.t : skin, lShoulder: shirt ? shirt.t : skin,
    rElbow: shirt && shirt.sl === 'l' ? shirt.t : skin, lElbow: shirt && shirt.sl === 'l' ? shirt.t : skin,
    rWrist: skin, lWrist: skin,
    rHip: pants ? pants.c : skin, lHip: pants ? pants.c : skin,
    rKnee: pants && pants.len === 'long' ? pants.c : skin, lKnee: pants && pants.len === 'long' ? pants.c : skin,
    rAnkle: pants ? pants.shoe : skin, lAnkle: pants ? pants.shoe : skin
  };
  for (const n of DATA.order) av.j[n].render.meshInstances[0].material = f.mat(col[n]);
  av.color = skin;

  // ----- ลายเสื้อ -----
  if (shirt?.d === 'stripe') for (const y of [0.3, 0.8, 1.3]) T('box', shirt.c2, [0, y, 0], [2.02, 0.2, 1.04]);
  if (shirt?.d === 'flask') {
    T('cone', '#40c057', [0, 0.7, -0.52], [0.8, 0.85, 0.06]);
    T('box', '#dee2e6', [0, 1.2, -0.52], [0.2, 0.4, 0.06]);
  }
  if (shirt?.d === 'lab') {
    T('box', '#ced4da', [0, 0.8, -0.52], [0.06, 1.5, 0.04]);
    T('box', '#e9ecef', [0.5, 0.5, -0.52], [0.46, 0.42, 0.05]);
    T('box', '#228be6', [0.6, 0.78, -0.55], [0.07, 0.25, 0.05]);
    for (const y of [0.35, 0.75, 1.15]) T('sphere', '#adb5bd', [-0.12, y, -0.54], [0.1, 0.1, 0.08]);
  }
  if (shirt?.d === 'hoodie') {
    T('box', '#7048e8', [0, 0.35, -0.52], [1.2, 0.48, 0.05]);
    T('box', '#7048e8', [0, 1.55, 0.2], [1.3, 0.35, 0.95]);
    for (const x of [-0.18, 0.18]) T('box', '#f1f3f5', [x, 1.15, -0.53], [0.05, 0.5, 0.04]);
  }

  // ----- หน้า (ตา ปาก) -----
  const dot = (x, y, w, h, hex, z = -0.6) => H('sphere', hex, [x, y, z], [w, h, 0.07]);
  const bar = (x, y, w, h, hex, rz = 0, z = -0.61) => H('box', hex, [x, y, z], [w, h, 0.05], [0, 0, rz]);
  const smile = (k, y0, hex) => { for (const x of [-0.2, -0.1, 0, 0.1, 0.2]) dot(x, y0 + k * (x / 0.2) ** 2 * 0.1, 0.07, 0.07, hex); };
  const eyes = () => { for (const sx of [-0.25, 0.25]) dot(sx, 0.62, 0.14, 0.22, '#111111'); };
  const face = o.face || 'smile';
  if (face === 'smile') { for (const sx of [-0.25, 0.25]) { dot(sx, 0.62, 0.24, 0.3, '#ffffff', -0.6); dot(sx, 0.62, 0.13, 0.19, '#111111', -0.64); } smile(1, 0.27, '#111111'); }
  else if (face === 'happy') {
    for (const sx of [-0.25, 0.25]) { bar(sx - 0.07, 0.62, 0.17, 0.05, '#111111', 40); bar(sx + 0.07, 0.62, 0.17, 0.05, '#111111', -40); }
    dot(0, 0.3, 0.34, 0.22, '#5c1d1d'); dot(0, 0.24, 0.2, 0.1, '#ff8787', -0.61);
  } else if (face === 'cool') {
    for (const sx of [-0.25, 0.25]) bar(sx, 0.62, 0.24, 0.08, '#111111');
    smile(1, 0.28, '#111111');
  } else if (face === 'wink') {
    dot(-0.25, 0.62, 0.14, 0.22, '#111111'); bar(0.25, 0.62, 0.22, 0.05, '#111111');
    smile(1, 0.27, '#111111');
  } else if (face === 'angry') {
    eyes(); bar(-0.25, 0.8, 0.28, 0.06, '#111111', -25); bar(0.25, 0.8, 0.28, 0.06, '#111111', 25);
    smile(-1, 0.32, '#111111');
  } else if (face === 'surprised') {
    for (const sx of [-0.25, 0.25]) { dot(sx, 0.62, 0.26, 0.32, '#ffffff', -0.6); dot(sx, 0.62, 0.1, 0.14, '#111111', -0.64); }
    dot(0, 0.28, 0.14, 0.2, '#3b1010');
  } else if (face === 'cat') {
    eyes();
    for (const [x, y] of [[-0.14, 0.33], [-0.07, 0.27], [0, 0.33], [0.07, 0.27], [0.14, 0.33]]) dot(x, y, 0.06, 0.06, '#111111');
    for (const sx of [-0.42, 0.42]) dot(sx, 0.42, 0.18, 0.1, '#ff8fa3', -0.58);
  } else if (face === 'sleepy') {
    for (const sx of [-0.25, 0.25]) bar(sx, 0.6, 0.22, 0.05, '#111111');
    dot(0, 0.28, 0.1, 0.1, '#333333');
    for (const sx of [-0.42, 0.42]) dot(sx, 0.42, 0.18, 0.1, '#ff8fa3', -0.58);
  }

  // ----- หมวก -----
  const hat = o.hat || 'none', hatOn = hat !== 'none';
  if (hat === 'cap') {
    H('sphere', '#e03131', [0, 0.95, 0.02], [1.36, 0.9, 1.36]);
    H('box', '#c92a2a', [0, 0.86, -0.72], [0.95, 0.1, 0.6]);
  } else if (hat === 'chef') {
    H('cylinder', '#ffffff', [0, 1.45, 0], [1.0, 0.8, 1.0]);
    H('sphere', '#ffffff', [0, 2.0, 0], [1.45, 0.9, 1.45]);
  } else if (hat === 'wizard') {
    H('cone', '#5f3dc4', [0, 2.05, 0], [1.1, 1.9, 1.1]);
    H('cylinder', '#5f3dc4', [0, 1.15, 0], [1.9, 0.1, 1.9]);
  } else if (hat === 'crown') {
    H('cylinder', '#ffd43b', [0, 1.35, 0], [1.05, 0.45, 1.05]);
    for (const [x, z] of [[0.38, 0.38], [-0.38, 0.38], [0.38, -0.38], [-0.38, -0.38]]) H('cone', '#ffd43b', [x, 1.78, z], [0.3, 0.45, 0.3]);
  } else if (hat === 'beanie') {
    H('sphere', '#339af0', [0, 0.98, 0.02], [1.36, 0.9, 1.36]);
    H('cylinder', '#1c7ed6', [0, 0.8, 0], [1.34, 0.22, 1.34]);
    H('sphere', '#f1f3f5', [0, 1.5, 0], [0.34, 0.34, 0.34]);
  } else if (hat === 'helmet') {
    H('sphere', '#fcc419', [0, 0.95, 0.02], [1.36, 0.95, 1.36]);
    H('cylinder', '#f59f00', [0, 0.84, 0], [1.6, 0.08, 1.6]);
    H('box', '#f59f00', [0, 1.4, 0], [0.18, 0.1, 0.9]);
  } else if (hat === 'grad') {
    H('box', '#212529', [0, 1.2, 0], [1.1, 0.25, 1.1]);
    H('box', '#212529', [0, 1.36, 0], [1.7, 0.08, 1.7]);
    H('box', '#fcc419', [0.7, 1.15, 0.6], [0.04, 0.4, 0.04]);
    H('sphere', '#fcc419', [0.7, 0.93, 0.6], [0.12, 0.12, 0.12]);
  } else if (hat === 'tophat') {
    H('cylinder', '#212529', [0, 1.18, 0], [1.7, 0.1, 1.7]);
    H('cylinder', '#212529', [0, 1.7, 0], [1.1, 1.0, 1.1]);
    H('cylinder', '#e03131', [0, 1.36, 0], [1.12, 0.16, 1.12]);
  }

  // ----- ผม (ถ้าใส่หมวก แสดงเฉพาะส่วนที่ห้อยลงมา) -----
  const hair = o.hair || 'none', hc = o.hairColor || '#6b4226', top = !hatOn;
  const cap = () => { if (top) H('sphere', hc, [0, 0.93, 0.06], [1.32, 0.82, 1.32]); };
  if (hair === 'short') cap();
  else if (hair === 'spiky') {
    cap();
    if (top) for (const [x, z, rx, rz] of [[0, 0, 0, 0], [0.4, 0, 0, -30], [-0.4, 0, 0, 30], [0, -0.4, -30, 0], [0, 0.4, 30, 0], [0.3, 0.3, 20, -20], [-0.3, 0.3, 20, 20]])
      H('cone', hc, [x, 1.38, z], [0.32, 0.6, 0.32], [rx, 0, rz]);
  } else if (hair === 'long') {
    cap();
    H('box', hc, [0, 0.4, 0.5], [1.3, 1.1, 0.34]);
    for (const sx of [-0.6, 0.6]) H('box', hc, [sx, 0.5, 0.2], [0.14, 0.9, 0.6]);
  } else if (hair === 'ponytail') {
    cap();
    H('sphere', '#f06595', [0, 0.85, 0.66], [0.22, 0.22, 0.22]);
    H('cylinder', hc, [0, 0.4, 0.78], [0.3, 0.9, 0.3]);
  } else if (hair === 'bun') {
    cap(); if (top) H('sphere', hc, [0, 1.5, 0.1], [0.55, 0.55, 0.55]);
  } else if (hair === 'pigtails') {
    cap();
    for (const sx of [-0.72, 0.72]) { H('sphere', hc, [sx, 0.75, 0.2], [0.38, 0.38, 0.38]); H('cylinder', hc, [sx, 0.3, 0.2], [0.22, 0.8, 0.22]); }
  } else if (hair === 'afro') {
    if (top) H('sphere', hc, [0, 0.95, 0.36], [1.8, 1.5, 1.5]);
  } else if (hair === 'mohawk') {
    if (top) [[-0.45, 0.4], [-0.2, 0.55], [0.05, 0.6], [0.3, 0.55], [0.55, 0.4]].forEach(([z, h]) => H('box', hc, [0, 1.1 + h / 2, z], [0.16, h, 0.28]));
  }

  // ----- หน้ากาก / แว่น (วางหน้าใบหน้า z ≈ -0.64) -----
  const mask = o.mask || 'none';
  const ring = (sx, hex, d = 0.44, lens = '#e7f5ff') => { H('cylinder', hex, [sx, 0.62, -0.63], [d, 0.06, d], [90, 0, 0]); H('cylinder', lens, [sx, 0.62, -0.665], [d * 0.78, 0.05, d * 0.78], [90, 0, 0]); };
  if (mask === 'shades') {
    for (const sx of [-0.25, 0.25]) H('box', '#111111', [sx, 0.62, -0.64], [0.4, 0.26, 0.08]);
    H('box', '#111111', [0, 0.68, -0.64], [0.2, 0.05, 0.08]);
    for (const sx of [-0.6, 0.6]) H('box', '#111111', [sx, 0.66, -0.3], [0.05, 0.05, 0.6]);
  } else if (mask === 'round') {
    for (const sx of [-0.25, 0.25]) ring(sx, '#222222', 0.46);
    H('box', '#222222', [0, 0.68, -0.64], [0.14, 0.04, 0.05]);
    for (const sx of [-0.6, 0.6]) H('box', '#222222', [sx, 0.66, -0.3], [0.04, 0.04, 0.6]);
  } else if (mask === 'heart') {
    for (const sx of [-0.27, 0.27]) H('sphere', '#f06595', [sx, 0.62, -0.65], [0.42, 0.38, 0.08]);
    H('box', '#f06595', [0, 0.66, -0.64], [0.16, 0.05, 0.06]);
  } else if (mask === 'goggles') {
    H('box', '#495057', [0, 0.64, 0], [1.28, 0.22, 1.28]);
    for (const sx of [-0.28, 0.28]) ring(sx, '#868e96', 0.5, '#a5d8ff');
  } else if (mask === 'surgical') {
    H('box', '#a5d8ff', [0, 0.2, -0.62], [1.0, 0.46, 0.1]);
    H('box', '#74c0fc', [0, 0.2, -0.68], [0.9, 0.03, 0.02]);
    for (const sx of [-0.6, 0.6]) H('box', '#dee2e6', [sx, 0.35, -0.3], [0.04, 0.05, 0.6]);
  } else if (mask === 'ninja') {
    H('box', '#212529', [0, 0.2, 0], [1.26, 0.56, 1.26]);
    H('box', '#e03131', [0, 0.98, 0], [1.3, 0.2, 1.3]);
    H('box', '#e03131', [0.15, 0.9, 0.75], [0.2, 0.12, 0.5], [0, 15, 0]); H('box', '#e03131', [-0.15, 0.78, 0.75], [0.2, 0.12, 0.5], [0, -15, 0]);
  } else if (mask === 'masquerade') {
    H('box', '#fcc419', [0, 0.64, -0.63], [1.0, 0.32, 0.08]);
    for (const sx of [-0.25, 0.25]) dot(sx, 0.62, 0.2, 0.12, '#111111', -0.69);
    H('box', '#e03131', [0.56, 0.95, -0.55], [0.08, 0.5, 0.05], [0, 0, -25]);
  }
}

const POSE = {
  seated: { pelvis: 0, spine: 0, head: 0, rHip: 1.5, lHip: 1.5, rKnee: -1.5, lKnee: -1.5, rAnkle: 0, lAnkle: 0, rShoulder: 0.45, lShoulder: 0.45, rElbow: 1.1, lElbow: 1.1, rWrist: 0, lWrist: 0 },   // ท่อนแขนล่างขนานพื้น วางบนโต๊ะ
  air:    { pelvis: 0, spine: 0, head: -0.1, rHip: 0.55, lHip: -0.25, rKnee: -0.7, lKnee: -0.35, rAnkle: 0, lAnkle: 0.2, rShoulder: 2.5, lShoulder: 2.5, rElbow: 0.25, lElbow: 0.25, rWrist: 0, lWrist: 0 }
};

// เรียกทุกเฟรม: speed = ความเร็วเดินแนวราบ (หน่วยเกม/วินาที), airborne = ลอยอยู่กลางอากาศ
// ---------- ท่าเต้น / อีโมจิ (คำนวณเป็นสูตรตามเวลา t วินาที) ----------
// คีย์ในท่า: ชื่อข้อต่อ = หมุนแกน X (ก้ม/แกว่งหน้า-หลัง), ชื่อ+'_z' = กางออกด้านข้าง/เอียง, ชื่อ+'_y' = บิดตัว
// แขนขวา: _z บวก = กางออก, แขนซ้าย: _z ลบ = กางออก
export const EMOTES = [
  { v: 'wave', n: 'โบกมือ', i: '👋' }, { v: 'bow', n: 'โค้งคำนับ', i: '🙇' }, { v: 'disco', n: 'ดิสโก้', i: '🕺' },
  { v: 'robot', n: 'หุ่นยนต์', i: '🤖' }, { v: 'cheer', n: 'ฮึบ!', i: '🙌' }, { v: 'twist', n: 'ส่ายสะโพก', i: '💃' }, { v: 'floss', n: 'ฟลอส', i: '🌀' }
];
// ท่าพิเศษ: ใช้ได้เฉพาะผู้เล่นที่รวยที่สุด 3 อันดับแรก (เซิร์ฟเวอร์ตรวจสิทธิ์)
export const SPECIAL_EMOTES = [
  { v: 'trophy', n: 'ชูถ้วย', i: '🏆' }, { v: 'royal', n: 'ราชา', i: '👑' }, { v: 'spin', n: 'หมุนสตาร์', i: '🌟' }
];
export const isSpecial = n => SPECIAL_EMOTES.some(e => e.v === n);
export function setEmote(av, name) { av.emote = EMOTES.some(e => e.v === name) || isSpecial(name) ? name : null; av.et = 0; }

function emotePose(name, t) {
  const S = Math.sin;
  const T = { pelvis: 0, spine: 0, head: 0, rHip: 0, lHip: 0, rKnee: 0, lKnee: 0, rAnkle: 0, lAnkle: 0, rShoulder: 0.05, lShoulder: 0.05, rElbow: 0.1, lElbow: 0.1, rWrist: 0, lWrist: 0 };
  let bob = 0;
  if (name === 'wave') {
    T.rShoulder_z = 2.5; T.rElbow_z = 0.35 + 0.55 * S(t * 10); T.head_z = 0.12; T.spine_z = -0.05;
  } else if (name === 'bow') {
    const k = 0.5 - 0.5 * Math.cos(Math.min(t, 1e9) * 2.2);       // ก้ม-เงยเป็นจังหวะ
    T.spine = -0.9 * k; T.head = -0.25 * k; T.rShoulder = 0.2 + 0.4 * k; T.lShoulder = 0.2 + 0.4 * k;
  } else if (name === 'disco') {
    const s = S(t * 6);
    T.rShoulder_z = 0.3 + 2.2 * Math.max(0, s); T.lShoulder_z = -(0.3 + 2.2 * Math.max(0, -s));
    T.pelvis_z = 0.12 * s; T.spine_z = -0.14 * s; T.head_z = 0.1 * s;
    T.rKnee = -0.5 * Math.max(0, s); T.lKnee = -0.5 * Math.max(0, -s); T.rHip = 0.25 * Math.max(0, s); T.lHip = 0.25 * Math.max(0, -s);
    bob = -0.04 - 0.04 * Math.abs(S(t * 6));
  } else if (name === 'robot') {
    const st = Math.floor(t * 2.6) % 4;
    if (st === 0) { T.rShoulder_z = 1.57; T.lShoulder_z = 0; }
    else if (st === 1) { T.rShoulder_z = 0; T.lShoulder_z = -1.57; }
    else if (st === 2) { T.rShoulder = 1.57; T.lShoulder = 1.57; T.rElbow = 0; T.lElbow = 0; }
    else { T.rShoulder_z = 1.57; T.lShoulder_z = -1.57; T.rElbow = 1.57; T.lElbow = 1.57; }
    T.head_y = st % 2 ? 0.6 : -0.6; T.spine_y = st % 2 ? -0.25 : 0.25;
  } else if (name === 'cheer') {
    const a = Math.abs(S(t * 7));
    T.rShoulder_z = 2.6 + 0.2 * S(t * 14); T.lShoulder_z = -(2.6 + 0.2 * S(t * 14 + 1));
    T.rKnee = T.lKnee = -0.6 * (1 - a); T.rHip = T.lHip = 0.3 * (1 - a); T.head = -0.12;
    bob = a * 0.16 - 0.1;
  } else if (name === 'twist') {
    const s = S(t * 7);
    T.pelvis_y = 0.4 * s; T.spine_y = -0.75 * s;
    T.rShoulder = 0.9; T.lShoulder = 0.9; T.rElbow = 1.5; T.lElbow = 1.5;
    T.rKnee = T.lKnee = -0.25; T.rHip = T.lHip = 0.12;
    bob = -0.05 - 0.04 * Math.abs(S(t * 14));
  } else if (name === 'trophy') {          // ชูถ้วยสองมือ กระโดดเบา ๆ
    const a2 = Math.abs(S(t * 5));
    T.rShoulder_z = 2.9; T.lShoulder_z = -2.9; T.rElbow = 0.2; T.lElbow = 0.2; T.head = -0.3; T.spine = 0.12;
    T.rKnee = T.lKnee = -0.35 * (1 - a2); T.rHip = T.lHip = 0.18 * (1 - a2); bob = a2 * 0.2 - 0.06;
  } else if (name === 'royal') {           // เชิดหน้า โบกมือช้า ๆ แบบราชา
    T.spine = 0.12; T.head = -0.2; T.head_y = 0.15 * S(t * 1.5);
    T.rShoulder_z = 1.2 + 0.25 * S(t * 3); T.rElbow_z = 0.9 + 0.5 * S(t * 3); T.lShoulder = -0.1; T.lShoulder_z = -0.35;
  } else if (name === 'spin') {            // กางแขนหมุนตัวเหมือนดาว
    T.pelvis_y = t * 7; T.rShoulder_z = 1.57; T.lShoulder_z = -1.57; T.rElbow = 0; T.lElbow = 0; T.head = -0.15;
    T.rKnee = T.lKnee = -0.2; T.rHip = T.lHip = 0.1; bob = 0.12 + 0.06 * S(t * 8);
  } else if (name === 'floss') {
    const s = S(t * 8);
    T.rShoulder = 0.7; T.lShoulder = 0.7; T.rShoulder_z = 0.5 + 0.9 * s; T.lShoulder_z = -0.5 + 0.9 * s;
    T.pelvis_z = -0.22 * s; T.spine_z = 0.1 * s; T.rKnee = T.lKnee = -0.3; T.rHip = T.lHip = 0.15;
    bob = -0.05;
  }
  return { T, bob };
}

export function animateAvatar(av, dt, speed, airborne) {
  av.t += dt;
  av.spd += (speed - av.spd) * Math.min(1, 10 * dt);            // ทำให้ความเร็วเปลี่ยนนุ่มนวล
  const sp = Math.min(1, av.spd / 6.5), moving = av.spd > 0.4;
  let T, bob = 0, fast = false;
  if (av.seated) {
    T = { ...POSE.seated }; const br = Math.sin(av.t * 1.8) * 0.03; T.rShoulder += br; T.lShoulder += br;
  } else if (airborne) {
    T = { ...POSE.air };
  } else if (moving) {
    av.phase += dt * (4 + av.spd * 2.4);                           // ยิ่งเร็ว ก้าวถี่ขึ้น (ให้เท้าไม่ไถลมาก)
    const p = av.phase, s = Math.sin(p), c = Math.cos(p), amp = 0.25 + 0.4 * sp, flex = 0.4 + 0.5 * sp;
    T = {
      pelvis: 0, spine: 0.06 * sp, head: -0.03 * sp,
      rHip: s * amp, lHip: -s * amp,
      rKnee: -Math.max(0, c) * 1.0 * flex, lKnee: -Math.max(0, -c) * 1.0 * flex,    // งอเข่าตอนแกว่งขาไปหน้า
      rAnkle: Math.max(0, c) * 0.3, lAnkle: Math.max(0, -c) * 0.3,
      rShoulder: -s * amp * 0.8, lShoulder: s * amp * 0.8,                          // แขนแกว่งสวนกับขา
      rElbow: 0.2 + 0.35 * sp * Math.max(0, -s), lElbow: 0.2 + 0.35 * sp * Math.max(0, s),
      rWrist: 0, lWrist: 0,
      spine_y: Math.sin(p) * 0.087 * sp                              // บิดลำตัวเล็กน้อยตามจังหวะก้าว
    };
    bob = -Math.abs(s) * 0.03 * sp;                                  // ตัวต่ำลงตอนขาแยกกว้าง
  } else if (av.emote) {
    av.et += dt;
    ({ T, bob } = emotePose(av.emote, av.et)); fast = av.emote === 'robot';
  } else {
    const br = Math.sin(av.t * 1.6) * 0.04;                       // ยืนนิ่ง: หายใจเบาๆ
    T = { pelvis: 0, spine: 0, head: br * 0.5, rHip: 0, lHip: 0, rKnee: 0, lKnee: 0, rAnkle: 0, lAnkle: 0, rShoulder: br, lShoulder: -br, rElbow: 0.1, lElbow: 0.1, rWrist: 0, lWrist: 0 };
  }
  const k = Math.min(1, (fast ? 34 : 16) * dt);
  for (const n of BASE_JOINTS) {
    for (const key of [n, n + '_z', n + '_y']) av.ang[key] = (av.ang[key] ?? 0) + ((T[key] ?? 0) - (av.ang[key] ?? 0)) * k;
    av.j[n].setLocalEulerAngles(av.ang[n] * 57.29578, (av.ang[n + '_y'] ?? 0) * 57.29578, (av.ang[n + '_z'] ?? 0) * 57.29578);
  }
  const targetY = (av.seated ? SEAT_DROP : 0) + bob;
  const cur = av.off.getLocalPosition().y;
  av.off.setLocalPosition(0, cur + (targetY - cur) * Math.min(1, 14 * dt), 0);
}
