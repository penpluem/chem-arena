import * as pc from 'playcanvas';
import { lbl } from './utils.js';

// จอมอนิเตอร์ยักษ์ตั้งที่ขอบสนาม: วาดลง canvas 2D แล้วใช้เป็นพื้นผิวของแผ่นจอใน 3D
const W = 1280, H = 512;
const LANG_TXT = { th: '🌐 ภาษาไทย', en: '🌐 English', both: '🌐 ไทย + EN' };

function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    const toks = para.includes(' ') ? para.split(/(?<= )/) : [...para];
    for (const t of toks) {
      if (ctx.measureText(line + t).width > maxW && line) { out.push(line.trimEnd()); line = t; } else line += t;
    }
    if (line) out.push(line.trimEnd());
  }
  return out;
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

function drawStructure(ctx, v, bx, by, bw, bh) {
  const xs = v.atoms.map(a => a[0]), ys = v.atoms.map(a => a[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys), gw = Math.max(...xs) - minX || 1, gh = Math.max(...ys) - minY || 1;
  const S = Math.min((bw - 40) / gw, (bh - 30) / gh, 92);
  const ox = bx + (bw - gw * S) / 2, oy = by + (bh - gh * S) / 2;
  const P = i => [ox + (v.atoms[i][0] - minX) * S, oy + (v.atoms[i][1] - minY) * S];
  ctx.strokeStyle = '#1c2a4a'; ctx.lineWidth = Math.max(4, S * 0.07); ctx.lineCap = 'round';
  for (const [a, b, o] of v.bonds) {
    const [x1, y1] = P(a), [x2, y2] = P(b), len = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
    for (const d of o === 1 ? [0] : o === 2 ? [-S * 0.09, S * 0.09] : [-S * 0.14, 0, S * 0.14]) {
      ctx.beginPath(); ctx.moveTo(x1 + nx * d, y1 + ny * d); ctx.lineTo(x2 + nx * d, y2 + ny * d); ctx.stroke();
    }
  }
}

export function createMonitor(app, factory) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const tex = new pc.Texture(app.graphicsDevice, { width: W, height: H, format: pc.PIXELFORMAT_SRGBA8, mipmaps: false, minFilter: pc.FILTER_LINEAR, magFilter: pc.FILTER_LINEAR, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE });
  tex.setSource(cv);

  // โครงจอ + แผ่นจอ (เอียงหงายรับสายตาจากกล้องมุมสูง)
  const SW = 31, SH = SW * H / W;
  const pivot = new pc.Entity('monitor'); pivot.setPosition(0, 1.2, -25.4); pivot.setEulerAngles(-30, 0, 0); app.root.addChild(pivot);
  const frame = factory.mk('box', '#0b1020', [0, SH / 2 + 0.2, 0.2], [SW + 1.2, SH + 1.2, 0.6], pivot);
  const neon = factory.mkg('box', '#22d3ee', [0, SH / 2 + 0.2, 0.15], [SW + 1.7, SH + 1.7, 0.5], 1, 1.2, pivot);
  neon.render.meshInstances[0].material = factory.glass('#22d3ee', 1, 1.1);
  const plane = new pc.Entity(); plane.addComponent('render', { type: 'plane' });
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(0, 0, 0); m.emissive = new pc.Color(1, 1, 1); m.emissiveMap = tex; m.emissiveIntensity = 1;
  m.useLighting = false; m.cull = pc.CULLFACE_NONE; m.update();
  plane.render.meshInstances[0].material = m; plane.render.castShadows = false;
  plane.setLocalPosition(0, SH / 2 + 0.2, 0.55); plane.setLocalEulerAngles(90, 0, 0); plane.setLocalScale(SW, 1, SH);
  pivot.addChild(plane);
  // ขาตั้ง
  factory.mk('box', '#1c2541', [-SW / 2 + 3, -0.2, 0.2], [1.2, 2.4, 0.8], pivot);
  factory.mk('box', '#1c2541', [SW / 2 - 3, -0.2, 0.2], [1.2, 2.4, 0.8], pivot);

  let lastKey = '';
  function bg(c1, c2) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  function center(text, y, size, color = '#fff', weight = 800) { ctx.font = `${weight} ${size}px "Noto Sans Thai",system-ui,sans-serif`; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(text, W / 2, y); }
  function grid() { ctx.strokeStyle = 'rgba(120,200,255,.07)'; ctx.lineWidth = 2; for (let x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } }

  function paint(s, now) {
    ctx.textBaseline = 'alphabetic';
    if (s.mode === 'game' && s.msg) return paintGame(s, now);
    if (s.mode === 'reveal' && s.msg) return paintReveal(s);
    bg('#0b1b3a', '#14305f'); grid();
    if (s.mode === 'intro') {
      center('🏁 เตรียมตัว!', 170, 120, '#ffe066'); center(`10 มินิเกม · ตอบถูกได้แต้ม เข้าก่อนได้โบนัส`, 270, 52, '#e7f5ff'); center(`ผู้เข้าแข่ง ${s.count} คน`, 360, 56, '#8ce99a');
    } else if (s.mode === 'end') {
      bg('#2b1a4a', '#5f2a8a'); grid();
      center(s.win ? '🏆 ชนะแล้ว!' : '🏁 จบรอบ', 170, 110, '#ffe066');
      center(s.winners.length ? `ผู้ชนะ: ${s.winners}` : 'ไม่มีใครได้แต้ม', 262, 56, '#fff'); board(s.board || [], 340, 40);
    } else {
      center('⚗️ CHEM ARENA', 170, 130, '#74c0fc'); center('ศึกอ่านชื่อสารอินทรีย์ · 10 มินิเกมต่อรอบ', 260, 50, '#e7f5ff');
      center(s.cd !== null ? `⏳ รอบใหม่เริ่มใน ${s.cd} วินาที · ผู้เข้าร่วม ${s.queued}/${s.max}` : 'กดปุ่ม "เริ่มเกม" เพื่อเริ่มรอบ', 370, 50, '#ffe066');
    }
  }
  function paintGame(s, now) {
    const m = s.msg, left = Math.max(0, s.deadline - now), frac = left / s.total, el = s.total - left;
    const hidePrompt = m.hide?.what === 'prompt' && el >= m.hide.at;
    bg('#0b1b3a', '#142a55'); grid();
    // แถบหัว
    ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(0, 0, W, 84);
    ctx.textAlign = 'left'; ctx.font = '800 46px "Noto Sans Thai",system-ui,sans-serif'; ctx.fillStyle = '#ffe066'; ctx.fillText(`${m.icon} ${m.idx}/${m.total}`, 28, 58);
    center(m.title, 58, 50, '#fff');
    ctx.textAlign = 'right'; ctx.fillStyle = '#8ce99a'; ctx.font = '800 44px "Noto Sans Thai",system-ui,sans-serif'; ctx.fillText(s.myScore == null ? '👀 ผู้ชม' : `⭐ ${s.myScore}`, W - 28, 58);
    // ป้ายภาษา / กลไก
    const badges = [m.langRandom ? LANG_TXT[m.lang] : null, m.mechTag ? '✨ ' + m.mechTag : null].filter(Boolean);
    let bx = 28;
    for (const b of badges) { ctx.font = '700 30px "Noto Sans Thai",system-ui,sans-serif'; const w = ctx.measureText(b).width + 28; ctx.fillStyle = '#7048e8'; rr(ctx, bx, 98, w, 44, 22); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(b, bx + 14, 130); bx += w + 12; }
    // กติกา
    ctx.font = '600 40px "Noto Sans Thai",system-ui,sans-serif'; ctx.fillStyle = '#d0ebff'; ctx.textAlign = 'center';
    const rl = wrap(ctx, m.rule, W - 120).slice(0, 3); rl.forEach((t, i) => ctx.fillText(t, W / 2, 190 + i * 48));
    // โจทย์
    const top = 190 + rl.length * 48 + 6, bh = H - 40 - top;
    if (hidePrompt) { center('❓ โจทย์ถูกซ่อน — จำให้ได้!', top + bh / 2 + 20, 64, '#ffa8a8'); }
    else {
      if (m.view && m.name) { drawPanel(top, bh, W * 0.58); drawStructure(ctx, m.view, 40, top, W * 0.58 - 40, bh); nameBox(lbl(m.name, m.lang), W * 0.58 + 20, top, W * 0.42 - 50, bh); }
      else if (m.view) { ctx.fillStyle = '#fff'; rr(ctx, W / 2 - 330, top, 660, bh, 24); ctx.fill(); drawStructure(ctx, m.view, W / 2 - 330, top, 660, bh); }
      else if (m.name) nameBox(lbl(m.name, m.lang), 60, top, W - 120, bh, true);
      else if (m.type === 'pads') center(m.pads.length >= 9 ? 'ดูชื่อบนพื้น แล้ววิ่งไปยืน!' : 'วิ่งไปยืนบนแท่นที่ถูกต้อง!', top + bh / 2 + 20, 56, '#ffe066');
    }
    // หลอดเวลา
    ctx.fillStyle = 'rgba(255,255,255,.18)'; rr(ctx, 28, H - 30, W - 56, 18, 9); ctx.fill();
    ctx.fillStyle = frac > 0.5 ? '#40c057' : frac > 0.2 ? '#fab005' : '#fa5252'; rr(ctx, 28, H - 30, Math.max(18, (W - 56) * frac), 18, 9); ctx.fill();
    ctx.textAlign = 'right'; ctx.font = '800 36px system-ui,sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(Math.ceil(left / 1000) + 's', W - 30, H - 42);
  }
  function drawPanel(top, bh, w) { ctx.fillStyle = '#fff'; rr(ctx, 28, top, w - 20, bh, 24); ctx.fill(); }
  function nameBox(text, x, y, w, h, wide) {
    ctx.fillStyle = 'rgba(255,255,255,.95)'; rr(ctx, x, y, w, h, 24); ctx.fill();
    let size = wide ? 76 : 60; ctx.textAlign = 'center'; ctx.fillStyle = '#1c2a4a';
    let lines;
    for (; size >= 28; size -= 4) { ctx.font = `800 ${size}px "Noto Sans Thai",system-ui,sans-serif`; lines = text.split('\n').flatMap(t => wrap(ctx, t, w - 36)); if (lines.length * size * 1.2 <= h - 16) break; }
    const y0 = y + h / 2 - ((lines.length - 1) * size * 1.2) / 2 + size * 0.34;
    lines.forEach((t, i) => ctx.fillText(t, x + w / 2, y0 + i * size * 1.2));
  }
  function board(list, y0, size) {
    list.forEach((e, i) => { ctx.textAlign = 'left'; ctx.font = `800 ${size}px "Noto Sans Thai",system-ui,sans-serif`; ctx.fillStyle = e.me ? '#ffe066' : '#fff'; ctx.fillText(`${i + 1}. ${e.name}`, 150, y0 + i * size * 1.3); ctx.textAlign = 'right'; ctx.fillText(`${e.score}`, W - 150, y0 + i * size * 1.3); });
  }
  function paintReveal(s) {
    const r = s.reveal, m = s.msg;
    bg('#0b3d1f', '#146c2e'); grid();
    center(`${m.icon} ${m.title}`, 70, 46, '#fff');
    center(r.ok ? `✅ ตอบถูก ${r.ok}/${r.total} คน${r.first ? ` · เข้าก่อน: ${r.first} 🥇` : ''}` : '❌ ไม่มีใครตอบถูก', 134, 46, '#d3f9d8');
    ctx.fillStyle = 'rgba(255,255,255,.95)'; rr(ctx, 60, 160, W - 120, 150, 28); ctx.fill();
    ctx.font = '700 30px "Noto Sans Thai",system-ui,sans-serif'; ctx.fillStyle = '#2b8a3e'; ctx.textAlign = 'center'; ctx.fillText('เฉลย', W / 2, 196);
    let size = 54, lines; ctx.fillStyle = '#1c2a4a';
    for (; size >= 26; size -= 4) { ctx.font = `800 ${size}px "Noto Sans Thai",system-ui,sans-serif`; lines = wrap(ctx, r.text, W - 200); if (lines.length * size * 1.2 <= 100) break; }
    lines.slice(0, 2).forEach((t, i) => ctx.fillText(t, W / 2, 252 + i * size * 1.15));
    ctx.font = '700 30px "Noto Sans Thai",system-ui,sans-serif'; ctx.fillStyle = '#ffe066'; ctx.textAlign = 'center'; ctx.fillText('⭐ คะแนนรวม', W / 2, 352);
    board(r.board, 400, 36);
  }

  return {
    // s: สถานะจอ; เรียกทุกเฟรม แต่วาดใหม่เฉพาะเมื่อข้อความเปลี่ยน (หรือ ~10 ครั้ง/วินาทีตอนเกมวิ่ง)
    render(s, now) {
      const key = s.mode === 'game' ? `g|${s.msg?.idx}|${Math.floor((s.deadline - now) / 100)}|${s.myScore}` : `${s.mode}|${s.msg?.idx}|${s.cd}|${s.queued}|${s.count}|${s.winners}|${s.reveal?.text}|${s.reveal?.ok}`;
      if (key === lastKey) return; lastKey = key;
      paint(s, now); tex.upload();
    },
    root: pivot,
    canvas: cv
  };
}
