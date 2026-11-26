// ตำแหน่งแท่นคำตอบ ณ เวลา t (ms นับจากเริ่มเกม) — ต้องเหมือนกับ padPos ใน server/minigames.js ทุกประการ
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
