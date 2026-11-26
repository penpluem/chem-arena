// ตารางชื่อ + ตัวสร้างข้อความชื่อสาร (อังกฤษ/ไทย) + ตัวตรวจคำตอบ
// *** ถ้าตำราของครูสะกดชื่อไทยต่างจากนี้ แก้/เพิ่มคำสะกดได้ที่ตาราง TH_* ด้านล่าง ***

export const STEM_EN = ['', 'meth', 'eth', 'prop', 'but', 'pent', 'hex', 'hept', 'oct', 'non', 'dec'];
export const SUB_EN = { 1: 'methyl', 2: 'ethyl', 3: 'propyl' };
export const SUB_SIZE = { methyl: 1, ethyl: 2, propyl: 3 };
const MULT_EN = ['', '', 'di', 'tri', 'tetra'];

// ชื่อไทย: แต่ละช่องเป็นลิสต์ของคำสะกดที่ยอมรับ (ตัวแรก = ตัวที่ใช้แสดงเฉลย)
const TH_STEM = {
  ane: [null, ['มีเทน'], ['อีเทน', 'เอเทน'], ['โพรเพน', 'พรอเพน'], ['บิวเทน'], ['เพนเทน'], ['เฮกเซน'], ['เฮปเทน', 'เฮพเทน'], ['ออกเทน'], ['โนเนน'], ['เดเคน']],
  ene: [null, null, ['อีทีน', 'เอทีน'], ['โพรพีน'], ['บิวทีน'], ['เพนทีน'], ['เฮกซีน'], ['เฮปทีน', 'เฮพทีน'], ['ออกทีน'], ['โนนีน'], ['เดซีน']],
  yne: [null, null, ['อีไทน์', 'เอไทน์'], ['โพรไพน์'], ['บิวไทน์'], ['เพนไทน์'], ['เฮกไซน์'], ['เฮปไทน์', 'เฮพไทน์'], ['ออกไทน์'], ['โนไนน์'], ['เดไซน์']]
};
const TH_SUB = { methyl: ['เมทิล', 'เมธิล'], ethyl: ['เอทิล', 'เอธิล'], propyl: ['โพรพิล', 'โพรปิล'] };
const MULT_TH = ['', '', 'ได', 'ไตร', 'เตตระ'];

function groups(parts) {
  // เรียงตามตัวอักษรอังกฤษของชื่อหมู่แทนที่ (ไม่นับ di/tri)
  return parts.subs.slice().sort((a, b) => (a.name < b.name ? -1 : 1));
}

// คืนค่า [แบบเก่า "2-methyl-2-butene", แบบใหม่ "2-methylbut-2-ene"] (แอลเคนมีแบบเดียว)
export function englishNames(parts) {
  const pre = groups(parts).map(s => `${s.locs.join(',')}-${MULT_EN[s.locs.length]}${s.name}`).join('-');
  const stem = STEM_EN[parts.len];
  if (parts.kind === 'ane') return [pre + stem + 'ane'];
  const suf = parts.kind;
  return [
    (pre ? pre + '-' : '') + parts.bondLoc + '-' + stem + suf,
    pre + stem + '-' + parts.bondLoc + '-' + suf
  ];
}

function cart(arrs) {
  return arrs.reduce((acc, a) => acc.flatMap(x => a.map(y => x.concat([y]))), [[]]);
}

// คืนค่าทุกแบบการสะกดที่ยอมรับ (ตัวแรกคือแบบหลัก)
export function thaiNames(parts) {
  const g = groups(parts);
  const preOpts = g.map(s => TH_SUB[s.name].map(v => `${s.locs.join(',')}-${MULT_TH[s.locs.length]}${v}`));
  const stems = TH_STEM[parts.kind][parts.len];
  const out = [];
  for (const combo of cart(preOpts)) {
    const pre = combo.join('-');
    for (const st of stems) {
      out.push(parts.kind === 'ane' ? pre + st : (pre ? pre + '-' : '') + parts.bondLoc + '-' + st);
    }
  }
  return out;
}

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
// ทำให้คำตอบเทียบกันได้: ตัวพิมพ์เล็ก, ตัดช่องว่าง/ขีด, เลขไทย->อารบิก, ตัดการันต์
export function norm(s) {
  return String(s)
    .normalize('NFC')
    .toLowerCase()
    .replace(/[๐-๙]/g, d => THAI_DIGITS.indexOf(d))
    .replace(/[\s​-‍﻿\-‐‑‒–—―_]/g, '')
    .replace(/์/g, '');
}

export function buildAccept(parts, mode) {
  const set = new Set();
  const en = englishNames(parts), th = thaiNames(parts);
  if (mode !== 'th') en.forEach(n => set.add(norm(n)));
  if (mode !== 'en') th.forEach(n => set.add(norm(n)));
  return set;
}

// ข้อความเฉลยที่แสดงให้ผู้เล่น
export function displayName(parts, mode) {
  const en = englishNames(parts), th = thaiNames(parts);
  const enTxt = en.length > 1 ? `${en[0]}  (หรือ ${en[1]})` : en[0];
  if (mode === 'en') return enTxt;
  if (mode === 'th') return th[0];
  return `${enTxt}  /  ${th[0]}`;
}
