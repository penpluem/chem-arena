// ข้อมูลร้านแต่งตัว + เซฟในเครื่อง (localStorage)
// แต่ละไอเทม: v = รหัส, n = ชื่อ, p = ราคา (0 = ฟรี), i = ไอคอน (emoji), c = สีที่โชว์บนการ์ด
const KEY = 'chem_arena_save_v1';
const I = (v, n, p, i, c) => ({ v, n, p, i, c });

export const COLORS = [
  I('#ffdbac', 'ผิวสว่าง', 0, '', '#ffdbac'), I('#e0ac69', 'ผิวแทนอ่อน', 0, '', '#e0ac69'), I('#c68642', 'ผิวแทน', 0, '', '#c68642'),
  I('#8d5524', 'ผิวเข้ม', 0, '', '#8d5524'), I('#ff8c42', 'ส้ม', 0, '', '#ff8c42'), I('#4dabf7', 'ฟ้า', 0, '', '#4dabf7'),
  I('#69db7c', 'เขียว', 0, '', '#69db7c'), I('#f783ac', 'ชมพู', 0, '', '#f783ac'), I('#ffd43b', 'เหลือง', 30, '', '#ffd43b'),
  I('#b197fc', 'ม่วง', 30, '', '#b197fc'), I('#e03131', 'แดง', 40, '', '#e03131'), I('#20c997', 'มิ้นต์', 40, '', '#20c997'),
  I('#adb5bd', 'เทาหุ่นยนต์', 50, '', '#adb5bd'), I('#212529', 'ดำ', 60, '', '#212529')
];
export const HAIRCOLORS = [
  I('#2b2118', 'ดำ', 0, '', '#2b2118'), I('#6b4226', 'น้ำตาล', 0, '', '#6b4226'), I('#e9c46a', 'บลอนด์', 30, '', '#e9c46a'),
  I('#c2571a', 'แดงส้ม', 30, '', '#c2571a'), I('#e9ecef', 'ขาว', 30, '', '#e9ecef'), I('#f06595', 'ชมพู', 40, '', '#f06595'),
  I('#339af0', 'ฟ้า', 40, '', '#339af0'), I('#51cf66', 'เขียว', 40, '', '#51cf66'), I('#9775fa', 'ม่วง', 40, '', '#9775fa'),
  I('#e03131', 'แดง', 40, '', '#e03131')
];
export const HAIRS = [
  I('none', 'หัวโล้น', 0, '🥚'), I('short', 'ผมสั้น', 0, '💇'), I('spiky', 'ผมตั้ง', 30, '⚡'), I('long', 'ผมยาว', 40, '🧜'),
  I('ponytail', 'ผมหางม้า', 40, '🎀'), I('bun', 'ผมมวย', 40, '🍡'), I('pigtails', 'ผมแกละ', 50, '🍭'),
  I('afro', 'ผมแอฟโฟร', 60, '🦁'), I('mohawk', 'ผมโมฮอว์ก', 70, '🦜')
];
export const HATS = [
  I('none', 'ไม่ใส่', 0, '🚫'), I('cap', 'หมวกแก๊ป', 40, '🧢'), I('beanie', 'หมวกไหมพรม', 40, '🧶'), I('helmet', 'หมวกนิรภัย', 50, '⛑️'),
  I('chef', 'หมวกเชฟ', 70, '👨‍🍳'), I('grad', 'หมวกรับปริญญา', 90, '🎓'), I('wizard', 'หมวกพ่อมด', 100, '🧙'),
  I('tophat', 'หมวกทรงสูง', 120, '🎩'), I('crown', 'มงกุฎ', 200, '👑')
];
export const FACES = [
  I('smile', 'ยิ้ม', 0, '🙂'), I('happy', 'ดีใจ', 20, '😆'), I('cool', 'เท่', 30, '😎'), I('wink', 'ขยิบตา', 30, '😉'),
  I('angry', 'หน้างอ', 30, '😠'), I('surprised', 'ตกใจ', 30, '😮'), I('cat', 'แมวเหมียว', 50, '😺'), I('sleepy', 'ง่วงนอน', 40, '😴')
];
export const MASKS = [
  I('none', 'ไม่ใส่', 0, '🚫'), I('round', 'แว่นกลม', 50, '👓'), I('shades', 'แว่นดำ', 80, '🕶️'), I('heart', 'แว่นหัวใจ', 80, '💗'),
  I('goggles', 'แว่นกันสารเคมี', 90, '🥽'), I('surgical', 'หน้ากากอนามัย', 60, '😷'), I('masquerade', 'หน้ากากงานเต้นรำ', 110, '🎭'),
  I('ninja', 'หน้ากากนินจา', 130, '🥷')
];
// เสื้อ: t = สีตัวเสื้อ, sl = แขน (s สั้น / l ยาว), d = ลายพิเศษ
export const SHIRTS = [
  { ...I('none', 'ไม่ใส่', 0, '🚫') },
  { ...I('tee_white', 'เสื้อยืดขาว', 0, '👕', '#f1f3f5'), t: '#f1f3f5', sl: 's' },
  { ...I('tee_red', 'เสื้อยืดแดง', 30, '👕', '#e03131'), t: '#e03131', sl: 's' },
  { ...I('tee_green', 'เสื้อยืดเขียว', 30, '👕', '#37b24d'), t: '#37b24d', sl: 's' },
  { ...I('tee_blue', 'เสื้อยืดฟ้า', 30, '👕', '#228be6'), t: '#228be6', sl: 's' },
  { ...I('stripe', 'เสื้อลายขวาง', 50, '🦓', '#f8f9fa'), t: '#f8f9fa', sl: 's', d: 'stripe', c2: '#1c7ed6' },
  { ...I('flask', 'เสื้อขวดแก้ว', 70, '⚗️', '#ffd43b'), t: '#fff3bf', sl: 's', d: 'flask' },
  { ...I('hoodie', 'ฮู้ดดี้', 90, '🧥', '#845ef7'), t: '#845ef7', sl: 'l', d: 'hoodie' },
  { ...I('lab', 'เสื้อกาวน์', 120, '🥼', '#f8f9fa'), t: '#f8f9fa', sl: 'l', d: 'lab' }
];
// กางเกง: c = สี, len = long/short, shoe = สีรองเท้า
export const PANTS = [
  { ...I('none', 'ไม่ใส่', 0, '🚫') },
  { ...I('jeans', 'ยีนส์', 0, '👖', '#3b5bdb'), c: '#3b5bdb', len: 'long', shoe: '#f1f3f5' },
  { ...I('black', 'กางเกงดำ', 30, '👖', '#343a40'), c: '#343a40', len: 'long', shoe: '#212529' },
  { ...I('khaki', 'กางเกงสีกากี', 30, '👖', '#c9a66b'), c: '#c9a66b', len: 'long', shoe: '#5c4033' },
  { ...I('red', 'กางเกงแดง', 40, '👖', '#c92a2a'), c: '#c92a2a', len: 'long', shoe: '#f1f3f5' },
  { ...I('galaxy', 'กางเกงกาแล็กซี', 80, '🌌', '#5f3dc4'), c: '#5f3dc4', len: 'long', shoe: '#ffd43b' },
  { ...I('shorts', 'ขาสั้นยีนส์', 40, '🩳', '#4c6ef5'), c: '#4c6ef5', len: 'short', shoe: '#f1f3f5' },
  { ...I('shorts_g', 'ขาสั้นเขียว', 40, '🩳', '#2f9e44'), c: '#2f9e44', len: 'short', shoe: '#f1f3f5' }
];

// ลำดับแท็บในร้าน (k = ชื่อฟิลด์ใน outfit)
export const CAT_LIST = [
  { k: 'color', n: 'สีตัว', items: COLORS, sw: true }, { k: 'hair', n: 'ผม', items: HAIRS },
  { k: 'hairColor', n: 'สีผม', items: HAIRCOLORS, sw: true }, { k: 'hat', n: 'หมวก', items: HATS },
  { k: 'face', n: 'หน้า', items: FACES }, { k: 'mask', n: 'หน้ากาก/แว่น', items: MASKS },
  { k: 'shirt', n: 'เสื้อ', items: SHIRTS }, { k: 'pants', n: 'กางเกง', items: PANTS }
];
export const CATS = Object.fromEntries(CAT_LIST.map(c => [c.k, c.items]));
export const find = (k, v) => CATS[k]?.find(x => x.v === v);

export const DEFAULT_OUTFIT = {
  color: '#ffdbac', hair: 'short', hairColor: '#6b4226', hat: 'none', face: 'smile', mask: 'none', shirt: 'tee_white', pants: 'jeans'
};

export function loadSave() {
  const def = { name: '', coins: 100, owned: [], skills: {}, outfit: { ...DEFAULT_OUTFIT } };
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.outfit) {
      const o = { ...def.outfit, ...s.outfit };
      if (s.outfit.glasses && !s.outfit.mask) o.mask = s.outfit.glasses;   // เซฟรุ่นเก่า
      delete o.glasses;
      const owned = (s.owned || []).map(x => x.replace(/^glasses:/, 'mask:'));
      return { ...def, ...s, owned, skills: s.skills && typeof s.skills === 'object' ? s.skills : {}, outfit: o };
    }
  } catch { /* ใช้ค่าเริ่มต้น */ }
  return def;
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }
export const isOwned = (s, cat, item) => item.p === 0 || s.owned.includes(cat + ':' + item.v);
