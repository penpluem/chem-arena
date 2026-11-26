import basicSsl from '@vitejs/plugin-basic-ssl';

// base './' = deploy ขึ้น GitHub Pages ได้โดยไม่ต้องแก้ชื่อ repo
// ตอน dev: เปิดผ่าน https (ใบรับรองจำลอง) เพื่อให้มือถือ/เครื่องอื่นในวง LAN ใช้ไมค์ได้ — เบราว์เซอร์บล็อกไมค์บน http://192.168.x.x
// และส่งต่อ /api (รายชื่อห้อง) กับ WebSocket ที่ /ws/<ห้อง> ไปยังเซิร์ฟเวอร์เกม (พอร์ต 8080) ผ่าน https เดียวกัน (wss) จึงไม่ติด mixed-content
export default ({ command }) => ({
  base: './',
  plugins: command === 'serve' && process.env.NO_HTTPS !== '1' ? [basicSsl()] : [],
  server: { proxy: { '/ws': { target: 'ws://127.0.0.1:8080', ws: true }, '/api': { target: 'http://127.0.0.1:8080' } } }
});
