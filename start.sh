#!/bin/bash
# เริ่ม Chem Arena ใน terminal เดียว: ปิด server เก่าที่ค้างพอร์ต 8080 → เปิด server ใหม่ (log โชว์ที่นี่) → เปิดหน้าเว็บ (https เพื่อให้ใช้ไมค์ได้)
# วิธีใช้:  bash /Users/pp/Desktop/chem-arena/start.sh      (กด Ctrl+C เพื่อปิดทั้งหมด)
cd "$(dirname "$0")"
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null)
[ -z "$NODE_MAJOR" ] && { echo "❌ ไม่พบ Node.js — ติดตั้งจาก https://nodejs.org (เวอร์ชัน 20 ขึ้นไป)"; exit 1; }
[ "$NODE_MAJOR" -lt 18 ] && { echo "❌ Node.js เก่าเกินไป (v$NODE_MAJOR) ต้องใช้ 18 ขึ้นไป (แนะนำ 20+)"; exit 1; }
OLD=$(lsof -ti :8080)
[ -n "$OLD" ] && { echo "ปิด server เก่าที่ค้างอยู่ (pid $OLD)"; kill $OLD; sleep 1; }
(cd server && npm install --silent)
(cd client && npm install --silent)
node server/server.js &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT INT TERM
sleep 1
kill -0 $SRV 2>/dev/null || { echo "❌ เซิร์ฟเวอร์เกมเปิดไม่ติด (ดูข้อความ error ด้านบน)"; exit 1; }
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
echo ""
echo "👉 เครื่องนี้:        https://localhost:5173"
[ -n "$IP" ] && echo "👉 เครื่องอื่น (Wi-Fi เดียวกัน): https://$IP:5173"
echo "   ครั้งแรกเบราว์เซอร์เตือน 'ไม่ปลอดภัย' → ขั้นสูง → ดำเนินการต่อ (ต้องเป็น https ไมค์ถึงจะใช้ได้)"
echo "   ถ้าเครื่องอื่นเข้าไม่ได้: ต้องอยู่ Wi-Fi เดียวกัน, macOS ถาม firewall ให้กด Allow, และอย่าลืม https:// นำหน้า"
echo ""
cd client && npm run dev -- --host
