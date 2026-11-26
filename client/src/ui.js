import { CAT_LIST, find, isOwned, writeSave } from './shop.js';
import { SKILL_LIST, SKILL, skillLv } from './skills.js';
import { isTouch } from './input.js';
import { lbl } from './utils.js';
export { lbl };

const $ = id => document.getElementById(id);

// สถานะหน้าจอเกม (ใช้ร่วมกับ main.js เพื่อแสดงหัวใจเหนือหัวผู้เล่น)
export const G = { active: false, order: [], hp: {}, current: null, me: null, nameOf: () => '?', deadline: 0, total: 1 };

let toastTimer = 0;
export function toast(msg) {
  const el = $('toast'); el.textContent = msg; el.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), Math.min(7000, 2200 + msg.length * 40));
}
export function setCoins(n) { $('coinN').textContent = n; $('hudCoins').textContent = n; }
export function conn(msg, retry) {
  $('conn').hidden = !msg; $('connMsg').textContent = msg || ''; $('reloadBtn').hidden = !retry;
}

// ---------- เมนู + ร้านค้า (การ์ดแบบ Roblox) ----------
const narrow = () => matchMedia('(max-width:720px), (max-height:480px)').matches;
export function renderMenu(save, onOutfit, onSkills = () => {}) {
  let tab = narrow() ? 'color' : 'all';
  const trial = {};   // ของที่กำลังลองใส่ (ยังไม่ซื้อ): cat -> value
  const outfitNow = () => ({ ...save.outfit, ...trial });
  const trialItems = () => Object.entries(trial).map(([c, v]) => ({ c, v, it: find(c, v) })).filter(x => x.it);
  const card = (cat, it) => {
    const owned = isOwned(save, cat.k, it), tr = trial[cat.k] === it.v, eq = !tr && !(cat.k in trial) && save.outfit[cat.k] === it.v || (tr && owned);
    const th = cat.sw ? `<div class="th"><span class="sw" style="background:${it.v}"></span></div>`
      : `<div class="th" ${it.c ? `style="background:${it.c}33"` : ''}><span class="ic">${it.i || ''}</span></div>`;
    const price = tr && !owned ? '<small class="eqt">👀 กำลังลองใส่</small>' : eq ? '<small class="eqt">✔ ใส่อยู่</small>' : owned ? '<small>เป็นของคุณ</small>' : `<small class="pr">🪙 ${it.p}</small>`;
    return `<button class="item ${eq || tr ? 'eq' : ''} ${tr && !owned ? 'try' : ''}" data-cat="${cat.k}" data-v="${it.v}">${th}<b>${it.n}</b>${price}</button>`;
  };
  const skRow = s => {
    const lv = skillLv(save, s.id), next = s.cost[lv], pips = [1, 2, 3].map(i => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('');
    const info = lv ? `ใช้ได้ ${s.uses[lv - 1]} ครั้ง/รอบ${s.dur[lv - 1] ? ` · ${s.dur[lv - 1]} ${s.unit}` : ''}` : 'ยังไม่ได้ซื้อ';
    const nxt = lv < 3 ? `<button class="skbuy ${save.coins < next ? 'no' : ''}" data-sk="${s.id}">${lv ? `⬆ อัป Lv${lv + 1}` : 'ซื้อ'} · 🪙 ${next}</button>` : '<button class="skbuy max" disabled>MAX</button>';
    return `<div class="sk ${s.atk ? 'atk' : ''}"><div class="ski">${s.icon}</div><div class="skt"><b>${s.name} <span class="pips">${pips}</span></b><small>${s.desc}</small><small class="skinfo">${info}${lv && lv < 3 ? ` → Lv${lv + 1}: ${s.uses[lv]} ครั้ง${s.dur[lv] ? ` · ${s.dur[lv]} ${s.unit}` : ''}` : ''}</small></div>${nxt}</div>`;
  };
  function renderBar() {
    const t = trialItems().filter(x => !isOwned(save, x.c, x.it)), bar = $('tryBar');
    bar.hidden = !t.length;
    if (!t.length) return;
    const sum = t.reduce((a, x) => a + x.it.p, 0);
    $('tryTxt').textContent = `👀 กำลังลอง ${t.map(x => x.it.n).join(', ')}`;
    $('tryBuy').textContent = `ซื้อ 🪙 ${sum}`; $('tryBuy').classList.toggle('no', save.coins < sum);
  }
  function render() {
    setCoins(save.coins); renderBar();
    $('tabs').innerHTML = [{ k: 'all', n: 'ทั้งหมด' }, ...CAT_LIST, { k: 'skill', n: '⚡ สกิล' }].map(c => `<button data-tab="${c.k}" class="${c.k === tab ? 'on' : ''}">${c.n}</button>`).join('');
    if (tab === 'skill') {
      $('items').className = 'skills';
      $('items').innerHTML = '<p class="skhint">ซื้อแล้วใช้ในรอบแข่งได้ (จำกัดครั้งต่อรอบ) · อัปเลเวลเพื่อใช้ได้มากขึ้น/นานขึ้น · สกิลแกล้งใช้ไม่ได้ 3 วินาทีสุดท้ายของเกม</p>' + SKILL_LIST.map(skRow).join('');
    } else if (tab === 'all') {
      $('items').className = 'all';
      $('items').innerHTML = CAT_LIST.map(c => `<section><div class="sh"><b>${c.n}</b><a data-go="${c.k}">ดูทั้งหมด</a></div><div class="rowscroll">${c.items.map(i => card(c, i)).join('')}</div></section>`).join('');
    } else {
      const c = CAT_LIST.find(x => x.k === tab);
      $('items').className = 'one';
      $('items').innerHTML = c.items.map(i => card(c, i)).join('');
    }
  }
  $('tabs').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    tab = b.dataset.tab; render(); $('items').scrollTop = 0;
  };
  $('items').onclick = e => {
    const sb = e.target.closest('[data-sk]');
    if (sb) {
      const s = SKILL[sb.dataset.sk], lv = skillLv(save, s.id);
      if (!s || lv >= 3) return;
      if (save.coins < s.cost[lv]) return toast('เหรียญไม่พอ');
      save.coins -= s.cost[lv]; (save.skills ||= {})[s.id] = lv + 1; writeSave(save); onSkills();
      toast(lv ? `⬆ ${s.name} เป็น Lv${lv + 1} แล้ว` : `ซื้อสกิล ${s.name} แล้ว`);
      const sc = $('items').scrollTop; render(); $('items').scrollTop = sc; return;
    }
    const go = e.target.closest('[data-go]');
    if (go) { tab = go.dataset.go; render(); $('items').scrollTop = 0; return; }
    const b = e.target.closest('.item'); if (!b) return;
    const cat = b.dataset.cat, it = find(cat, b.dataset.v);
    if (!it) return;
    if (!isOwned(save, cat, it)) {          // ยังไม่ได้ซื้อ: ลองใส่ก่อน (ไม่หักเหรียญ ไม่บันทึก)
      if (trial[cat] === it.v) delete trial[cat]; else trial[cat] = it.v;
      onOutfit(outfitNow());
    } else { delete trial[cat]; save.outfit[cat] = it.v; writeSave(save); onOutfit(outfitNow()); }
    const sc = $('items').scrollTop, rows = [...document.querySelectorAll('.rowscroll')].map(r => r.scrollLeft);
    render(); $('items').scrollTop = sc; document.querySelectorAll('.rowscroll').forEach((r, i) => { r.scrollLeft = rows[i] || 0; });
  };
  $('tryBuy').onclick = () => {
    const t = trialItems().filter(x => !isOwned(save, x.c, x.it)), sum = t.reduce((a, x) => a + x.it.p, 0);
    if (!t.length) return;
    if (save.coins < sum) return toast(`เหรียญไม่พอ (ขาดอีก ${sum - save.coins})`);
    save.coins -= sum; for (const x of t) save.owned.push(x.c + ':' + x.v);
    for (const k of Object.keys(trial)) { save.outfit[k] = trial[k]; delete trial[k]; }
    writeSave(save); onOutfit(save.outfit); toast('ซื้อและใส่แล้ว ✔'); render();
  };
  $('tryCancel').onclick = () => { for (const k of Object.keys(trial)) delete trial[k]; onOutfit(save.outfit); render(); };
  render();
  return { revert() { for (const k of Object.keys(trial)) delete trial[k]; onOutfit(save.outfit); renderBar(); render(); } };
}

// ---------- รูปโครงสร้างสาร (SVG) ----------
export function structureSVG(q) {
  const S = 50, pad = 24;
  const xs = q.atoms.map(a => a[0]), ys = q.atoms.map(a => a[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const w = (Math.max(...xs) - minX) * S + pad * 2, h = (Math.max(...ys) - minY) * S + pad * 2;
  const P = i => [(q.atoms[i][0] - minX) * S + pad, (q.atoms[i][1] - minY) * S + pad];
  let lines = '';
  for (const [a, b, o] of q.bonds) {
    const [x1, y1] = P(a), [x2, y2] = P(b);
    const len = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
    for (const d of o === 1 ? [0] : o === 2 ? [-4.5, 4.5] : [-7, 0, 7]) {
      lines += `<line x1="${(x1 + nx * d).toFixed(1)}" y1="${(y1 + ny * d).toFixed(1)}" x2="${(x2 + nx * d).toFixed(1)}" y2="${(y2 + ny * d).toFixed(1)}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}"><g stroke="#222" stroke-width="3.6" stroke-linecap="round">${lines}</g></svg>`;
}

// ---------- หน้าจอรอบมินิเกม ----------
let onSubmit = () => {}, onQuit = () => {};
export function bindGame(submit, quit) { onSubmit = submit; onQuit = quit; }

let curMsg = null, myState = { part: false, alive: false }, myScore = 0;
export function setScore(n) { myScore = n; if (curMsg) paintCard(); }

export function roundStart(me, part) {
  Object.assign(G, { active: true, me, deadline: 0 });
  curMsg = null; myState = { part, alive: part };
  $('game').hidden = false; $('endBox').hidden = true; $('banner').hidden = true; $('answerRow').hidden = true;
  $('rule').textContent = '';
  $('who').textContent = part ? '🏁 รอบเริ่มแล้ว! เตรียมตัวที่เส้นสตาร์ท' : '👀 กำลังมีรอบแข่ง (คุณเป็นผู้ชม)';
  $('quitBtn').hidden = !part;
  document.body.classList.add('round');
}
function paintCard() {
  const m = curMsg; if (!m) return;
  const st = myState.part ? ` · ⭐ ${myScore} แต้ม` : ' · 👀 ผู้ชม';
  $('who').textContent = `${m.icon} ${m.idx}/${m.total} · ${m.title}${st}`;
  $('rule').textContent = m.rule;
}
export function showGame(m, part, alive) {
  curMsg = m; myState = { part, alive }; G.total = m.ms; G.deadline = performance.now() + m.ms - (m.elapsed || 0);
  $('banner').hidden = true; $('endBox').hidden = true;
  paintCard();
  const typing = m.type === 'type' && part && alive;
  $('answerRow').hidden = !typing;
  $('ans').placeholder = m.lang === 'th' ? 'พิมพ์ชื่อภาษาไทย แล้วกดส่ง' : m.lang === 'en' ? 'type the English name, then send' : 'พิมพ์ชื่อสาร (ไทยหรืออังกฤษ) แล้วกดส่ง';
  if (typing) { const a = $('ans'); a.value = ''; a.disabled = false; $('send').disabled = false; if (!isTouch) a.focus(); }
}
export function setAlive(alive) { myState.alive = alive; if (curMsg) paintCard(); }
export function showAck(m) {
  if (m.ok) { $('answerRow').hidden = true; toast('✅ ตอบถูก! รอดูผลตอนหมดเวลา'); }
  else { toast(m.left > 0 ? `❌ ยังไม่ถูก ลองใหม่ได้อีก ${m.left} ครั้ง` : '❌ ตอบผิดครบ 3 ครั้งแล้ว'); const a = $('ans'); a.disabled = m.left <= 0; $('send').disabled = m.left <= 0; if (m.left > 0) { a.value = ''; a.focus(); } else $('answerRow').hidden = true; }
}
export function showReveal(m, mine, gain, score) {   // mine: 'ok' | 'miss' | null (ผู้ชม)
  G.deadline = 0; $('answerRow').hidden = true; document.activeElement?.blur?.();
  const b = $('banner'); b.hidden = false;
  const ans = m.answerText || lbl(m.answer, curMsg?.lang || 'both').replace('\n', '  /  ');
  const head = mine === 'ok' ? `✅ +${gain} แต้ม${gain > 10 ? ` (โบนัสเข้าก่อน +${gain - 10})` : ''}` : mine === 'miss' ? '❌ ไม่ได้แต้ม — เล่นต่อได้!' : `ตอบถูก ${m.ok.length} คน`;
  b.className = mine === 'miss' ? 'bad' : 'ok';
  b.innerHTML = `${head}<small>เฉลย: ${ans}${mine ? ` · รวม ${score} แต้ม` : ''}</small>`;
}
export function showEnd(m, me, reward, nameOf, onClose) {
  $('banner').hidden = true; $('answerRow').hidden = true; G.deadline = 0;
  const part = m.ids.includes(me), win = m.winners.includes(me);
  const rank = Object.entries(m.scores).sort((a, b) => b[1] - a[1]).map(([id, sc], i) => `<div>${i + 1}. ${nameOf(+id)} — <b>${sc}</b> แต้ม${m.winners.includes(+id) ? ' 🏆' : ''}</div>`).slice(0, 8).join('');
  const title = !part ? '🏁 จบรอบ' : win ? '🏆 คุณชนะ!' : '🏁 จบรอบ';
  $('endBox').hidden = false;
  $('endBox').innerHTML = `<h2>${title}</h2><div class="rank">${rank}</div>${part ? `<p>ได้รับ 🪙 +${reward}${win ? ' (รวมโบนัสผู้ชนะ)' : ''}</p>` : ''}<button id="endOk">กลับห้องรอ</button>`;
  $('endOk').onclick = () => { hideGame(); onClose(); };
}
export function hideGame() { G.active = false; curMsg = null; $('game').hidden = true; document.body.classList.remove('round'); }

export function tick() {
  if (!G.active) return;
  const f = G.deadline ? Math.max(0, (G.deadline - performance.now()) / G.total) : 0;
  const i = document.querySelector('#bar i');
  i.style.width = f * 100 + '%'; i.style.background = f > 0.5 ? '#40c057' : f > 0.2 ? '#fab005' : '#fa5252';
  return f;
}

function submit() {
  const a = $('ans'), text = a.value.trim();
  if (!text || a.disabled) return;
  a.disabled = true; $('send').disabled = true; onSubmit(text);
}
$('send').onclick = submit;
$('ans').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) submit(); });
$('quitBtn').onclick = () => { if (confirm('ออกจากรอบ? คุณจะไม่ได้แต้มที่เหลือ')) onQuit(); };

// มือถือ: แป้นพิมพ์จะย่อพื้นที่ที่มองเห็น ให้หน้าจอเกมตามขนาดนั้นเพื่อไม่ให้ช่องตอบถูกบัง
function fitGame() {
  const vv = window.visualViewport, g = $('game');
  if (!vv) return;
  g.style.top = vv.offsetTop + 'px'; g.style.height = vv.height + 'px';
  g.style.setProperty('--gh', vv.height + 'px');
}
if (window.visualViewport) { window.visualViewport.addEventListener('resize', fitGame); window.visualViewport.addEventListener('scroll', fitGame); }
window.addEventListener('resize', fitGame);
fitGame();
