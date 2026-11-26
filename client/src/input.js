// คีย์บอร์ด + เมาส์/ทัช: ลากหมุนกล้อง, จอยสติ๊กลอย, ปุ่มกระโดด/นั่ง
const typing = el => el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);

// เครื่องที่ใช้นิ้วเป็นหลัก (มือถือ/แท็บเล็ต) -> แสดงปุ่มควบคุมบนจอ
export const isTouch = (() => {
  try {
    if (matchMedia('(pointer: coarse)').matches) return true;
    return 'ontouchstart' in window && !matchMedia('(pointer: fine)').matches;
  } catch { return false; }
})();

export function createInput(canvas, onKey) {
  const keys = {};
  let yawDelta = 0;
  const joy = { x: 0, y: 0 }; // x: ขวา+  y: หน้า+  (ขนาด 0..1)

  // ----- คีย์บอร์ด -----
  window.addEventListener('keydown', e => {
    if (typing(e.target)) return;
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!e.repeat) onKey(e.code);
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; joy.x = joy.y = 0; });

  // ----- กล้องแบบ Roblox: ลาก = หมุนรอบตัว (ซ้าย-ขวา + เงยก้ม), ล้อเมาส์/ถ่างสองนิ้ว = ซูม -----
  const ptrs = new Map();   // pointerId -> {x,y}
  let pinch = 0, zoomMul = 1, pitchDelta = 0;
  const dist2 = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  canvas.addEventListener('pointerdown', e => {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (ptrs.size === 2) pinch = dist2();
  });
  canvas.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size >= 2) {
      const d = dist2(); if (pinch > 0 && d > 0) zoomMul *= pinch / d; pinch = d;
    } else {
      const k = e.pointerType === 'touch' ? 0.0075 : 0.005;
      yawDelta -= dx * k; pitchDelta += dy * k;
    }
  });
  const endCam = e => { ptrs.delete(e.pointerId); pinch = 0; };
  canvas.addEventListener('pointerup', endCam);
  canvas.addEventListener('pointercancel', endCam);
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoomMul *= Math.exp(Math.sign(e.deltaY) * Math.min(1, Math.abs(e.deltaY) / 100) * 0.12); }, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // ----- จอยสติ๊กลอย: แตะตรงไหนในโซนซ้ายล่าง จอยจะโผล่ตรงนั้น -----
  const zone = document.getElementById('joyZone'), base = document.getElementById('joyBase'), knob = document.getElementById('joyKnob');
  const R = 50;
  const home = () => { base.style.left = '84px'; base.style.top = Math.max(110, window.innerHeight - 96) + 'px'; };
  home(); window.addEventListener('resize', () => { if (!base.classList.contains('on')) home(); });
  let jp = null, cx = 0, cy = 0;
  const reset = () => { jp = null; joy.x = joy.y = 0; base.classList.remove('on'); knob.style.transform = 'translate(-50%,-50%)'; home(); };
  zone.addEventListener('pointerdown', e => {
    if (jp !== null) return;
    jp = e.pointerId; cx = e.clientX; cy = e.clientY;
    try { zone.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    base.classList.add('on'); base.style.left = cx + 'px'; base.style.top = cy + 'px';
  });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId !== jp) return;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const ux = dx / R, uy = dy / R, m = Math.hypot(ux, uy);
    if (m < 0.15) { joy.x = joy.y = 0; } else { joy.x = ux; joy.y = -uy; }
  });
  const jend = e => { if (e.pointerId === jp) reset(); };
  zone.addEventListener('pointerup', jend);
  zone.addEventListener('pointercancel', jend);

  // ----- ปุ่มกระโดด / นั่ง -----
  const bj = document.getElementById('btnJump');
  bj.addEventListener('pointerdown', e => { e.preventDefault(); keys.Space = true; });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) bj.addEventListener(ev, () => { keys.Space = false; });

  return {
    reset() { for (const k in keys) keys[k] = false; },
    down: (...c) => c.some(k => keys[k]),
    takeYaw() { const d = yawDelta; yawDelta = 0; return d; },
    takePitch() { const d = pitchDelta; pitchDelta = 0; return d; },
    takeZoom() { const z = zoomMul; zoomMul = 1; return z; },
    // ทิศเดิน (ขวา+, หน้า+) รวมคีย์บอร์ดและจอยสติ๊ก ขนาดไม่เกิน 1
    axis() {
      const x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      const y = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      if (x || y) { const l = Math.hypot(x, y); return { x: x / l, y: y / l }; }
      return { x: joy.x, y: joy.y };
    }
  };
}
