import * as pc from 'playcanvas';

// ขนาดสนามต้องตรงกับ server/minigames.js
export const ARENA = { minX: -20, maxX: 20, minZ: -24, maxZ: 4 };   // สนามแข่ง (แท่นคำตอบอยู่กลางสนาม z=-10)
export const HALL = { minX: -20, maxX: 20, minZ: 9, maxZ: 24 };     // ห้องรอ / ที่นั่งชม
export const ALL = { minX: -20, maxX: 20, minZ: -24, maxZ: 24 };
export const PAD_COLORS = ['#fa5252', '#339af0', '#40c057', '#fcc419', '#cc5de8', '#22b8cf', '#ff922b', '#94d82d', '#f783ac'];

export const WARDROBE = { x: -14, z: 20, r: 2.7 };   // จุดเปลี่ยนชุดในห้องรอ

export function buildRoom(app, factory) {
  const { mk, mkg } = factory;
  mk('box', '#e9ecef', [0, -0.5, 0], [46, 1, 56]);                 // พื้นฐาน
  mk('box', '#ced4da', [0, -0.45, -10], [40, 1, 28]);              // สนามแข่ง
  mk('box', '#d0ebff', [0, -0.45, 16.5], [40, 1, 15]);             // ห้องรอ
  for (let i = -19; i <= 19; i += 2) for (let j = -23; j <= 3; j += 2) if ((i + j) % 4 === 0) mk('box', '#c5ccd3', [i, -0.44, j], [2, 1, 2]);   // ลายตาราง
  mk('box', '#fa5252', [0, -0.4, 3.6], [40, 1, 0.5]);              // เส้นสตาร์ท
  for (const [x, z, w, d] of [[0, -25.2, 46, 0.8], [0, 25.2, 46, 0.8], [-23.2, 0, 0.8, 52], [23.2, 0, 0.8, 52]]) {
    mk('box', '#74c0fc', [x, 0.6, z], [w, 1.2, d]);
  }
  // โมเลกุลตกแต่งในห้องรอ
  for (const [x, z] of [[-17, 22], [17, 22], [-17, 11], [17, 11]]) {
    mk('cylinder', '#495057', [x, 0.5, z], [0.5, 1, 0.5]);
    mk('sphere', '#e03131', [x, 1.5, z], [1, 1, 1]);
    mk('sphere', '#868e96', [x + 0.7, 1.9, z], [0.7, 0.7, 0.7]);
    mk('sphere', '#868e96', [x - 0.7, 1.9, z], [0.7, 0.7, 0.7]);
  }

  // ----- จุดเปลี่ยนชุด (วงม่วง + ราวแขวนเสื้อ) -----
  mkg('cylinder', '#cc5de8', [WARDROBE.x, 0.05, WARDROBE.z], [WARDROBE.r * 2, 0.1, WARDROBE.r * 2], 0.6, 0.9);
  mkg('cylinder', '#f3d9fa', [WARDROBE.x, 0.1, WARDROBE.z], [WARDROBE.r * 1.5, 0.1, WARDROBE.r * 1.5], 0.5, 0.8);
  mk('box', '#7048e8', [WARDROBE.x - 1.6, 1.4, WARDROBE.z + 3.4], [0.15, 2.8, 0.15]);
  mk('box', '#7048e8', [WARDROBE.x + 1.6, 1.4, WARDROBE.z + 3.4], [0.15, 2.8, 0.15]);
  mk('box', '#7048e8', [WARDROBE.x, 2.8, WARDROBE.z + 3.4], [3.4, 0.15, 0.15]);
  ['#fa5252', '#339af0', '#fcc419', '#40c057'].forEach((c, i) => mk('box', c, [WARDROBE.x - 1.2 + i * 0.8, 2.1, WARDROBE.z + 3.4], [0.6, 1.2, 0.12]));
  // ----- รั้วกระจกรอบเขตเล่น (ตรงกับขอบที่เซิร์ฟเวอร์/ไคลเอนต์ล็อกไว้: x ±20, z −24..24) -----
  const FX = 20.4, FZ0 = -24.4, FZ1 = 24.4;
  for (const [x, z, w, d] of [[0, FZ0, 41, 0.15], [0, FZ1, 41, 0.15], [-FX, 0, 0.15, 49], [FX, 0, 0.15, 49]]) mkg('box', '#74c0fc', [x, 1.1, z], [w, 2.2, d], 0.22, 0.5);
  for (let x = -20; x <= 20; x += 4) for (const z of [FZ0, FZ1]) mk('cylinder', '#e9ecef', [x, 1.2, z], [0.28, 2.4, 0.28]);
  for (let z = -24; z <= 24; z += 4) for (const x of [-FX, FX]) mk('cylinder', '#e9ecef', [x, 1.2, z], [0.28, 2.4, 0.28]);
  // ไฟนีออนตามพื้นขอบสนาม
  for (const [x, z, w, d, c] of [[0, -24.1, 40, 0.3, '#f06595'], [0, 24.1, 40, 0.3, '#22b8cf'], [-20.1, 0, 0.3, 48, '#ffd43b'], [20.1, 0, 0.3, 48, '#ffd43b']]) mkg('box', c, [x, 0.06, z], [w, 0.12, d], 1, 1.2);
  // เสาไฟมุมสนาม
  for (const [x, z] of [[-20.4, -24.4], [20.4, -24.4], [-20.4, 24.4], [20.4, 24.4]]) { mk('cylinder', '#343a40', [x, 2, z], [0.7, 4, 0.7]); mkg('sphere', '#ffe066', [x, 4.3, z], [1.1, 1.1, 1.1], 1, 1.3); }

  // ----- กำแพงพลังงาน: ขึ้นเฉพาะตอนมีรอบแข่ง กั้นระหว่างสนามกับห้องรอ (ห้ามข้าม) -----
  const field = [];
  for (const z of [4.5, 8.5]) field.push(mkg('box', '#ff6b6b', [0, 1.6, z], [40.6, 3.2, 0.2], 0.28, 0.9));
  field.push(mkg('box', '#ff6b6b', [0, 0.05, 6.5], [40, 0.1, 4], 0.35, 0.6));
  for (let x = -19; x <= 19; x += 2) field.push(mkg('box', '#ffe066', [x, 0.07, 6.5], [0.7, 0.12, 4.2], 0.55, 0.9)); // ลายเทปเตือน
  field.forEach(e => { e.enabled = false; });

  // ----- ของตกแต่งลอยฟ้า (หมุนช้า ๆ) -----
  const spin = [];
  const molecule = (x, y, z, s) => {
    const root = new pc.Entity(); root.setPosition(x, y, z); app.root.addChild(root);
    const cols = ['#e03131', '#495057', '#1c7ed6', '#f08c00'];
    const pts = [[0, 0, 0], [1.6, 0.6, 0], [-1.5, 0.7, 0.4], [0.2, -1.5, 0.5], [0.4, 1.4, -1.2]];
    pts.forEach((p, i) => { if (i) { const e = mk('cylinder', '#ced4da', [p[0] / 2, p[1] / 2, p[2] / 2], [0.18, Math.hypot(...p), 0.18], root); e.lookAt(root.getPosition().x + p[0], root.getPosition().y + p[1], root.getPosition().z + p[2]); e.rotateLocal(-90, 0, 0); } mk('sphere', cols[i % 4], p, [1.1, 1.1, 1.1], root); });
    root.setLocalScale(s, s, s); spin.push(root);
  };
  molecule(-44, 8, -22, 2.4); molecule(44, 9, -6, 2.6); molecule(-42, 6, 20, 2); molecule(42, 7, 22, 2.2); molecule(0, 26, -52, 4);
  return { field, spin };
}
