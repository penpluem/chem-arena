// แชทเสียง (WebRTC แบบ mesh): คนที่เปิดไมค์ส่งเสียงตรงไปหาผู้เล่นทุกคน ผ่านเซิร์ฟเวอร์ที่ทำหน้าที่ส่งต่อสัญญาณเท่านั้น
// หมายเหตุ: ต้องเปิดผ่าน https หรือ localhost ไมค์ถึงจะทำงาน และไม่มี TURN จึงบางเครือข่ายอาจเชื่อมไม่ติด
const DEFAULT_ICE = [{ urls: 'stun:stun.l.google.com:19302' }];
let ICE = DEFAULT_ICE;
try { if (import.meta.env.VITE_ICE_SERVERS) ICE = JSON.parse(import.meta.env.VITE_ICE_SERVERS); } catch { /* ใช้ค่าเริ่มต้น */ }
const MAX_LISTENERS = 20;

export function createVoice({ net, getIds, toast, onLevel }) {
  let stream = null, on = false, talking = false, deaf = false, volFor = () => 1;
  const sendPeers = new Map();   // id ผู้ฟัง -> RTCPeerConnection (เราเป็นฝ่ายส่ง)
  const recvPeers = new Map();   // id ผู้พูด -> { pc, audio, an, buf }
  let ac = null, localAn = null, localBuf = null;
  const ctx = () => (ac ||= new (window.AudioContext || window.webkitAudioContext)());

  const sig = (to, data) => net.send({ t: 'rtc', to, data });
  const mkPc = () => new RTCPeerConnection({ iceServers: ICE });

  async function connectTo(id) {   // เราพูดอยู่ -> เปิดสายส่งเสียงไปหา id
    if (!on || sendPeers.has(id) || sendPeers.size >= MAX_LISTENERS) return;
    const pc = mkPc(); pc.pendingIce = []; sendPeers.set(id, pc);
    stream.getAudioTracks().forEach(t => pc.addTrack(t, stream));
    pc.onicecandidate = e => { if (e.candidate) sig(id, { k: 'ice', for: 'recv', c: e.candidate }); };
    let t = 0;   // หลุด/ล้มเหลว -> ต่อสายใหม่อัตโนมัติ (ถ้ายังเปิดไมค์และอีกฝั่งยังอยู่)
    pc.onconnectionstatechange = () => {
      clearTimeout(t);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') { dropSend(id); setTimeout(() => { if (on && getIds().includes(id)) connectTo(id); }, 1500); }
      else if (pc.connectionState === 'disconnected') t = setTimeout(() => { if (sendPeers.get(id) === pc) { dropSend(id); if (on && getIds().includes(id)) connectTo(id); } }, 4000);
    };
    try { await pc.setLocalDescription(await pc.createOffer()); sig(id, { k: 'offer', sdp: pc.localDescription.sdp }); } catch { dropSend(id); }
  }
  function dropSend(id) { const pc = sendPeers.get(id); if (pc) { try { pc.close(); } catch { /* */ } sendPeers.delete(id); } }
  function dropRecv(id) {
    const r = recvPeers.get(id); if (!r) return;
    try { r.pc.close(); } catch { /* */ } r.audio.srcObject = null; r.audio.remove(); recvPeers.delete(id); onLevel(id, 0);
  }

  async function onSignal(from, d) {
    if (d.k === 'offer') {          // มีคนจะส่งเสียงมาให้เรา
      dropRecv(from);
      const pc = mkPc(), audio = new Audio(); audio.autoplay = true; audio.playsInline = true; audio.hidden = true; document.body.appendChild(audio);
      const rec = { pc, audio, an: null, buf: null, pending: [] }; recvPeers.set(from, rec);
      pc.onicecandidate = e => { if (e.candidate) sig(from, { k: 'ice', for: 'send', c: e.candidate }); };
      pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) dropRecv(from); };   // ผู้พูดจะเป็นฝ่ายต่อสายใหม่
      pc.ontrack = e => {
        const ms = e.streams[0] || new MediaStream([e.track]);
        audio.srcObject = ms; audio.muted = deaf; audio.play().catch(() => {});
        try { const c = ctx(), src = c.createMediaStreamSource(ms); rec.an = c.createAnalyser(); rec.an.fftSize = 256; rec.buf = new Uint8Array(rec.an.fftSize); src.connect(rec.an); } catch { /* */ }
      };
      try {
        await pc.setRemoteDescription({ type: 'offer', sdp: d.sdp });
        for (const c of rec.pending) await pc.addIceCandidate(c).catch(() => {}); rec.pending = [];
        await pc.setLocalDescription(await pc.createAnswer()); sig(from, { k: 'answer', sdp: pc.localDescription.sdp });
      } catch { dropRecv(from); }
    } else if (d.k === 'answer') {
      const pc = sendPeers.get(from); if (pc && pc.signalingState === 'have-local-offer') {
        try { await pc.setRemoteDescription({ type: 'answer', sdp: d.sdp }); for (const c of pc.pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => {}); } catch { /* */ }
      }
    } else if (d.k === 'ice' && d.c) {
      if (d.for === 'recv') { const r = recvPeers.get(from); if (!r) return; if (r.pc.remoteDescription) r.pc.addIceCandidate(d.c).catch(() => {}); else r.pending.push(d.c); }
      else { const pc = sendPeers.get(from); if (!pc) return; if (pc.remoteDescription) pc.addIceCandidate(d.c).catch(() => {}); else pc.pendingIce.push(d.c); }
    }
  }
  net.on('rtc', m => { if (m.data && typeof m.data === 'object') onSignal(m.from, m.data); });
  net.on('join', m => { if (on) connectTo(m.p.id); });
  net.on('leave', m => { dropSend(m.id); dropRecv(m.id); });

  // เตรียมไมค์ครั้งแรก: ขออนุญาต + ต่อสายหาทุกคนไว้ล่วงหน้า (แทร็กปิดเสียงอยู่) เพื่อให้พูดแล้วได้ยินทันที ไม่ตกหล่นช่วงต้นประโยค
  async function arm() {
    if (on) return true;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { toast('🎤 เบราว์เซอร์บล็อกไมค์เพราะหน้านี้ไม่ใช่ https — เปิดผ่านลิงก์ https://… ที่ start.sh แสดง (หรือ localhost)'); return false; }
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }); }
    catch (e) { toast(e?.name === 'NotAllowedError' ? '🎤 ไม่ได้รับอนุญาตให้ใช้ไมค์ — กดไอคอนแม่กุญแจ/ไมค์ข้างช่อง URL แล้วเลือก อนุญาต (Mac: System Settings → Privacy → Microphone ต้องเปิดให้เบราว์เซอร์ด้วย)' : e?.name === 'NotFoundError' ? '🎤 ไม่พบไมโครโฟนในเครื่อง' : '🎤 ใช้ไมค์ไม่ได้: ' + (e?.name || 'unknown')); return false; }
    stream.getAudioTracks().forEach(t => { t.enabled = false; });
    on = true; talking = false; net.send({ t: 'voice', on: true });
    try { const c = ctx(), src = c.createMediaStreamSource(stream); localAn = c.createAnalyser(); localAn.fftSize = 256; localBuf = new Uint8Array(localAn.fftSize); src.connect(localAn); } catch { /* */ }
    for (const id of getIds()) connectTo(id);
    return true;
  }
  // กดค้างเพื่อพูด / ปล่อยเพื่อหยุด
  function setTalking(v2) {
    if (!on) return;
    talking = !!v2; stream.getAudioTracks().forEach(t => { t.enabled = talking; });
    if (!talking) onLevel(0, 0);
  }
  function disable() {
    if (!on) return; on = false; talking = false;
    stream?.getTracks().forEach(t => t.stop()); stream = null; localAn = null;
    for (const id of [...sendPeers.keys()]) dropSend(id);
    net.send({ t: 'voice', on: false });
  }
  const level = (an, buf) => { if (!an) return 0; an.getByteTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128)); return m / 128; };
  return {
    get on() { return on; }, get talking() { return talking; }, get deaf() { return deaf; },
    arm, setTalking,
    toggleDeaf() { deaf = !deaf; for (const r of recvPeers.values()) r.audio.muted = deaf; return deaf; },
    setVolumeFn(fn) { volFor = fn; },
    // เรียกทุกเฟรม: ปรับเสียงตามระยะ + รายงานระดับเสียงคนที่กำลังพูด
    update(myId) {
      for (const [id, r] of recvPeers) {
        r.audio.volume = Math.max(0, Math.min(1, volFor(id))); onLevel(id, level(r.an, r.buf));
        if (r.audio.srcObject && r.audio.paused && !deaf) r.audio.play().catch(() => {});   // เบราว์เซอร์บางตัวหยุดเสียงเอง -> เล่นต่อ
      }
      if (on) onLevel(myId, talking ? level(localAn, localBuf) : 0);
    },
    stats: () => ({ send: [...sendPeers.values()].map(p => p.connectionState), recv: [...recvPeers.entries()].map(([id, r]) => [id, r.pc.connectionState, !!r.audio.srcObject]) }),
    close() { disable(); for (const id of [...recvPeers.keys()]) dropRecv(id); }
  };
}
