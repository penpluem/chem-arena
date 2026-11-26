import * as pc from 'playcanvas';

// ป้ายกระดานเศรษฐี (ตั้งในห้องรอ): อันดับเหรียญของผู้เล่นที่ออนไลน์ — วาดลง canvas แล้วแปะบนแผ่นป้าย 3D
const W = 640, H = 800;
const MEDAL = ['🥇', '🥈', '🥉', '4', '5'];
const COL = ['#ffd43b', '#dee2e6', '#f4a261', '#adb5bd', '#adb5bd'];

export function createBoard(app, factory, pos) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const tex = new pc.Texture(app.graphicsDevice, { width: W, height: H, format: pc.PIXELFORMAT_SRGBA8, mipmaps: false, minFilter: pc.FILTER_LINEAR, magFilter: pc.FILTER_LINEAR, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE });
  tex.setSource(cv);
  const SW = 4.4, SH = SW * H / W, root = new pc.Entity('board'); root.setPosition(pos[0], pos[1], pos[2]); app.root.addChild(root);
  factory.mk('box', '#0b1020', [0, 0, -0.1], [SW + 0.7, SH + 0.7, 0.3], root);
  factory.mkg('box', '#ffd43b', [0, 0, -0.18], [SW + 1.0, SH + 1.0, 0.2], 1, 1.1, root);
  const plane = new pc.Entity(); plane.addComponent('render', { type: 'plane' });
  const m = new pc.StandardMaterial(); m.diffuse = new pc.Color(0, 0, 0); m.emissive = new pc.Color(1, 1, 1); m.emissiveMap = tex; m.useLighting = false; m.cull = pc.CULLFACE_NONE; m.update();
  plane.render.meshInstances[0].material = m; plane.render.castShadows = false;
  plane.setLocalPosition(0, 0, 0.08); plane.setLocalEulerAngles(90, 0, 0); plane.setLocalScale(SW, 1, SH); root.addChild(plane);
  for (const x of [-1.9, 1.9]) factory.mk('box', '#343a40', [x, -SH / 2 - pos[1] / 2 + 0.2, -0.15], [0.35, pos[1] + 0.4, 0.35], root);

  function draw(top, myId) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b1f4b'); g.addColorStop(1, '#3b1f5e'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    ctx.font = '800 54px "Noto Sans Thai",system-ui,sans-serif'; ctx.fillStyle = '#ffd43b'; ctx.fillText('🏆 เศรษฐีประจำเซิร์ฟ', W / 2, 80);
    ctx.font = '600 28px "Noto Sans Thai",system-ui,sans-serif'; ctx.fillStyle = '#d0bfff'; ctx.fillText('ผู้เล่นที่ออนไลน์ เรียงตามเหรียญ 🪙', W / 2, 124);
    if (!top.length) { ctx.font = '700 36px "Noto Sans Thai",system-ui,sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('ยังไม่มีใครมีเหรียญ', W / 2, 360); }
    top.forEach((e, i) => {
      const y = 160 + i * 96;
      ctx.fillStyle = i < 3 ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.roundRect(34, y, W - 68, 82, 18); ctx.fill();
      if (e.id === myId) { ctx.strokeStyle = '#69db7c'; ctx.lineWidth = 4; ctx.stroke(); }
      ctx.textAlign = 'left'; ctx.font = '800 44px "Noto Sans Thai",system-ui,sans-serif'; ctx.fillStyle = COL[i]; ctx.fillText(MEDAL[i], 56, y + 58);
      ctx.font = '700 38px "Noto Sans Thai",system-ui,sans-serif'; ctx.fillStyle = '#fff';
      let nm = e.name; while (ctx.measureText(nm).width > 270 && nm.length > 2) nm = nm.slice(0, -1);
      ctx.fillText(nm, 126, y + 56);
      ctx.textAlign = 'right'; ctx.fillStyle = COL[i]; ctx.fillText(String(e.coins), W - 56, y + 56);
    });
    ctx.textAlign = 'center'; ctx.font = '700 30px "Noto Sans Thai",system-ui,sans-serif'; ctx.fillStyle = '#ffe066';
    ctx.fillText('Top 3 ใช้ท่าพิเศษได้ ✨', W / 2, 700); ctx.font = '600 24px "Noto Sans Thai",system-ui,sans-serif'; ctx.fillStyle = '#d0bfff'; ctx.fillText('(เปิดเมนู 🕺 ท่าเต้น)', W / 2, 740);
    tex.upload();
  }
  draw([], 0);
  return { draw };
}
