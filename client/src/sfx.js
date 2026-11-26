// เสียงเอฟเฟกต์สังเคราะห์ด้วย WebAudio (ไม่ต้องโหลดไฟล์เสียง)
let ctx = null, muted = false;
function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
function tone(freq, dur, { type = 'sine', vol = 0.18, delay = 0, slide = 0 } = {}) {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
}
export const sfx = {
  setMuted(m) { muted = m; },
  unlock() { ac(); },
  tick() { tone(880, 0.07, { type: 'square', vol: 0.08 }); },
  tickHi() { tone(1320, 0.09, { type: 'square', vol: 0.1 }); },
  start() { [523, 659, 784].forEach((f, i) => tone(f, 0.16, { type: 'triangle', delay: i * 0.1 })); },
  go() { tone(784, 0.35, { type: 'triangle', vol: 0.22 }); tone(1175, 0.4, { type: 'triangle', vol: 0.18, delay: 0.1 }); },
  newGame() { tone(660, 0.12, { type: 'triangle' }); tone(880, 0.16, { type: 'triangle', delay: 0.1 }); },
  ok() { tone(660, 0.12, { type: 'triangle' }); tone(990, 0.22, { type: 'triangle', delay: 0.09 }); },
  out() { tone(330, 0.5, { type: 'sawtooth', vol: 0.14, slide: -230 }); },
  win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.2, { type: 'triangle', delay: i * 0.12, vol: 0.2 })); },
  pop() { tone(500, 0.12, { type: 'sine', slide: 500, vol: 0.12 }); },
  chat() { tone(1000, 0.06, { vol: 0.06 }); }
};
