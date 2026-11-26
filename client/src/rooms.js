// หน้าเลือกห้อง: ดูรายชื่อห้องออนไลน์ / สร้างห้อง / ใส่รหัสห้องที่ล็อก
// ที่อยู่เซิร์ฟเวอร์: ตั้ง VITE_API_URL ตอน build (เช่น https://chem-arena.ชื่อคุณ.workers.dev) — ดู README
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// มี 2 ระบบให้ผู้เล่นเลือก:
//   ☁️ Cloudflare (VITE_API_URL)  — ไม่หลับ ไม่มีใครดูแล แต่มีโควตาฟรีรายวัน
//   🖥 เซิร์ฟเวอร์สำรอง (VITE_API_URL2, เช่น Render) — ไม่มีโควตารายวันแบบเดียวกัน แต่แผนฟรีอาจหลับ/ตื่นช้า
// ไม่ได้ตั้งค่าอะไรเลย: dev/LAN ใช้เซิร์ฟเวอร์เครื่องเดียวกัน (พอร์ต 8080)
const local = location.protocol === 'http:' ? `http://${location.hostname}:8080` : import.meta.env.DEV ? location.origin : '';
export const SERVERS = [
  { key: 'cf', label: '☁️ Cloudflare', url: import.meta.env.VITE_API_URL || '', cf: true },
  { key: 'alt', label: '🖥 เซิร์ฟเวอร์สำรอง', url: import.meta.env.VITE_API_URL2 || '' }
].filter(x => x.url).map(x => ({ ...x, url: x.url.replace(/\/$/, '') }));
if (!SERVERS.length && local) SERVERS.push({ key: 'local', label: '🖥 เซิร์ฟเวอร์', url: local });
let cur = SERVERS[0];
try { cur = SERVERS.find(x => x.key === localStorage.getItem('ca_server')) || cur; } catch { /* */ }
export const hasServer = () => !!cur;
export const currentServer = () => cur;
export const wsUrl = id => cur.url.replace(/^http/, 'ws') + '/ws/' + id;
// โควตา Cloudflare เต็มจะรีเซ็ต 00:00 UTC = 07:00 น. เวลาไทย
export const QUOTA_MSG = '⚠️ โควตาฟรีของ Cloudflare วันนี้เต็มแล้ว — จะกลับมาใช้ได้อีกครั้งเวลา 07:00 น. (เวลาไทย) ของวันพรุ่งนี้' + (SERVERS.some(x => !x.cf) ? ' · ระหว่างนี้เลือก “เซิร์ฟเวอร์สำรอง” ด้านบนได้' : '');

// Cloudflare ตอบ error/ไม่ใช่ JSON เมื่อเกินโควตา (429/5xx/หน้า error 1xxx) -> แปลเป็นข้อความโควตา
async function api(path, body) {
  if (!cur) throw new Error('ยังไม่ได้ตั้งค่าที่อยู่เซิร์ฟเวอร์ (VITE_API_URL) ดูวิธีใน README');
  let r;
  try { r = await fetch(cur.url + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}); }
  catch { throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (เซิร์ฟเวอร์ฟรีอาจกำลังตื่น รอสักครู่แล้วกด ⟳)'); }
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) {
    if (cur.cf && (j?.error === 'quota' || [429, 500, 502, 503, 1015, 1027].includes(r.status) || !j)) throw new Error(QUOTA_MSG);
    throw new Error(j?.error || 'เซิร์ฟเวอร์ตอบกลับผิดปกติ');
  }
  return j;
}

export function createBrowser({ onJoin, onBack, toast }) {
  const sel = $('serverSel');
  if (SERVERS.length > 1) {
    sel.hidden = false;
    sel.innerHTML = SERVERS.map(x => `<button data-k="${x.key}" class="${x === cur ? 'on' : ''}">${x.label}</button>`).join('');
    sel.onclick = e => { const x = SERVERS.find(v => v.key === e.target.dataset.k); if (!x) return; cur = x; try { localStorage.setItem('ca_server', x.key); } catch { /* */ } [...sel.children].forEach(c => c.classList.toggle('on', c.dataset.k === x.key)); list.innerHTML = ''; status('กำลังโหลดรายชื่อห้อง…'); refresh(); };
  }
  let timer = 0, open = false, askId = null, busy = false, sticky = 0;
  const panel = $('rooms'), list = $('roomList');
  const status = (msg, bad) => { const s = $('roomStatus'); s.textContent = msg || ''; s.className = bad ? 'bad' : ''; };

  async function refresh() {
    if (!open) return;
    try {
      const { rooms } = await api('/api/rooms');
      if (!open) return;
      if (Date.now() > sticky) status('');
      list.innerHTML = rooms.length ? rooms.map(r => `
        <button class="room" data-id="${esc(r.id)}" data-lock="${r.locked ? 1 : 0}" data-name="${esc(r.name)}">
          <span class="rn">${r.locked ? '🔒 ' : ''}${esc(r.name)}</span>
          <span class="rm">👑 ${esc(r.owner || '—')} · 👥 ${r.count}/${r.playMax ? Math.max(r.playMax, 12) : 12}${r.running ? ' · 🎮 กำลังแข่ง' : ' · ⏳ รอเริ่ม'}</span>
        </button>`).join('') : '<p class="empty">ยังไม่มีห้องออนไลน์ — กด “＋ สร้างห้อง” เพื่อเปิดห้องของคุณเอง</p>';
    } catch (e) { list.innerHTML = ''; status(e.message, true); }
  }
  const setAsk = (id, name) => {
    askId = id; $('pwAsk').hidden = !id;
    if (id) { $('pwAskName').textContent = '🔒 ' + name; $('pwIn').value = ''; setTimeout(() => $('pwIn').focus(), 50); }
  };
  const submitAsk = () => { const id = askId; setAsk(null); onJoin(id, $('pwIn').value); };

  list.addEventListener('click', e => {
    const b = e.target.closest('.room'); if (!b) return;
    if (b.dataset.lock === '1') setAsk(b.dataset.id, b.dataset.name); else onJoin(b.dataset.id, '');
  });
  $('pwOk').onclick = submitAsk;
  $('pwCancel').onclick = () => setAsk(null);
  $('pwIn').onkeydown = e => { if (e.key === 'Enter') submitAsk(); e.stopPropagation(); };
  $('roomRefresh').onclick = refresh;
  $('roomBack').onclick = () => { hide(); onBack(); };
  $('roomNew').onclick = () => { $('newBox').hidden = !$('newBox').hidden; if (!$('newBox').hidden) $('newName').focus(); };
  $('newName').onkeydown = $('newPw').onkeydown = e => { if (e.key === 'Enter') $('newGo').click(); e.stopPropagation(); };
  $('newGo').onclick = async () => {
    if (busy) return;
    const name = $('newName').value.trim();
    if (!name) return toast('ตั้งชื่อห้องก่อนนะ');
    busy = true; $('newGo').disabled = true; status('กำลังสร้างห้อง…');
    try { const { id } = await api('/api/rooms', { name, password: $('newPw').value }); $('newBox').hidden = true; onJoin(id, $('newPw').value); }
    catch (e) { status(e.message, true); }
    busy = false; $('newGo').disabled = false;
  };

  function show(msg) {
    open = true; panel.hidden = false; setAsk(null); $('newBox').hidden = true;
    sticky = msg ? Date.now() + 6000 : 0;
    if (msg) status(msg, true); else status('กำลังโหลดรายชื่อห้อง…');
    refresh(); clearInterval(timer); timer = setInterval(refresh, 5000);
  }
  function hide() { open = false; panel.hidden = true; clearInterval(timer); }
  return { show, hide, status };
}
