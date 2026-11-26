// WebSocket client: เชื่อมต่อพร้อมลองใหม่ (เซิร์ฟเวอร์ฟรีอาจต้องใช้เวลาตื่น)
export class Net {
  constructor(url) { this.url = url; this.ws = null; this.h = {}; this.ka = 0; }
  // ปิดการเชื่อมต่อเอง (ไม่ส่งเหตุการณ์ 'close')
  leave() { clearInterval(this.ka); const w = this.ws; this.ws = null; if (w) { w.onclose = null; w.onmessage = null; try { w.close(); } catch { /* */ } } }
  on(t, fn) { (this.h[t] ||= []).push(fn); }
  emit(t, d) { (this.h[t] || []).forEach(f => f(d)); }
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }

  async connect(onAttempt, maxMs = 90000) {
    const end = Date.now() + maxMs;
    let n = 0;
    while (Date.now() < end) {
      onAttempt?.(++n);
      try { await this._open(); return; } catch { await new Promise(r => setTimeout(r, 2500)); }
    }
    throw new Error('connect timeout');
  }

  _open() {
    return new Promise((resolve, reject) => {
      let opened = false;
      const ws = new WebSocket(this.url);
      const to = setTimeout(() => { try { ws.close(); } catch { /* */ } reject(new Error('timeout')); }, 15000);
      ws.onopen = () => { opened = true; clearTimeout(to); this.ws = ws; clearInterval(this.ka); this.ka = setInterval(() => this.send({ t: 'ping' }), 25000); resolve(); };
      ws.onerror = () => { if (!opened) { clearTimeout(to); reject(new Error('error')); } };
      ws.onclose = () => { if (opened) { clearInterval(this.ka); this.emit('close'); } else { clearTimeout(to); reject(new Error('closed')); } };
      ws.onmessage = e => { try { const m = JSON.parse(e.data); this.emit(m.t, m); } catch { /* ignore */ } };
    });
  }
}
