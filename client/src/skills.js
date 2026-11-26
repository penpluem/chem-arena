// สกิลฝั่งผู้เล่น: ชื่อ/คำอธิบาย/ราคา (ตัวเลข uses/dur ต้องตรงกับ server/skills.js — เซิร์ฟเวอร์เป็นคนตัดสินจริง)
// cost[i] = ราคาซื้อ Lv1 / อัปเป็น Lv2 / อัปเป็น Lv3
export const SKILL_LIST = [
  { id: 'peek', icon: '👁', name: 'ส่องตา', key: 'Z', desc: 'เห็นผู้เล่นคนอื่นชั่วคราว ในช่วงที่ทุกคนถูกซ่อน', cost: [120, 200, 320], uses: [1, 2, 3], dur: [4, 5, 6], unit: 'วิ' },
  { id: 'dash', icon: '⚡', name: 'พุ่ง', key: 'X', desc: 'วิ่งเร็วขึ้น 50% ช่วงสั้น ๆ', cost: [100, 160, 260], uses: [1, 2, 3], dur: [5, 6, 8], unit: 'วิ' },
  { id: 'shield', icon: '🛡', name: 'โล่', key: 'C', desc: 'กันสกิลแกล้งที่โดนครั้งต่อไป 1 ครั้ง', cost: [150, 240, 360], uses: [1, 1, 2], dur: [0, 0, 0], unit: '' },
  { id: 'hint', icon: '💡', name: 'ใบ้', key: 'V', desc: 'ขีดฆ่าแท่นที่ผิด 1 แท่น (ไม่ใช้กับเกมพิมพ์)', cost: [300, 450, 650], uses: [1, 1, 2], dur: [0, 0, 0], unit: '' },
  { id: 'freeze', icon: '🧊', name: 'แช่แข็ง', key: 'B', desc: 'เป้าหมายที่เลือกขยับไม่ได้ชั่วคราว', cost: [200, 320, 480], uses: [1, 1, 2], dur: [2, 3, 4], unit: 'วิ', atk: true },
  { id: 'reverse', icon: '🙃', name: 'กลับทิศ', key: 'N', desc: 'ปุ่มเดินของเป้าหมายกลับด้านชั่วคราว', cost: [160, 260, 400], uses: [1, 2, 2], dur: [3, 4, 5], unit: 'วิ', atk: true },
  { id: 'gust', icon: '💨', name: 'ลมพัด', key: 'H', desc: 'ผลักเป้าหมายไปทางสุ่ม', cost: [220, 340, 520], uses: [1, 1, 2], dur: [0, 0, 0], unit: '', atk: true }
];
export const SKILL = Object.fromEntries(SKILL_LIST.map(s => [s.id, s]));
export const skillLv = (save, id) => Math.min(3, Math.max(0, save.skills?.[id] | 0));
