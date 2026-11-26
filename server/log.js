// log สีใน terminal: [เวลา] [ป้าย] ข้อความ   (ปิดสีด้วย NO_COLOR=1)
const useColor = !process.env.NO_COLOR && (process.stdout.isTTY || process.env.FORCE_COLOR);
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const fmt = new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
  timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
});
const stamp = () => {
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
};
const TAGS = {
  server: ['SERVER', '1;37;44'], join: ['เข้ามา', '1;30;42'], leave: ['ออก', '1;37;41'], seat: ['โต๊ะ', '1;30;46'],
  start: ['เริ่มเกม', '1;37;45'], turn: ['ตา', '1;37;44'], ok: ['ถูก', '1;30;42'], bad: ['ผิด', '1;30;43'],
  end: ['จบเกม', '1;30;47'], warn: ['เตือน', '1;37;41']
};
export function log(kind, msg) {
  const [label, code] = TAGS[kind] || [kind, '1;37;100'];
  console.log(`${c('90', stamp())} ${c(code, ` ${label} `)} ${msg}`);
}
export const B = s => c('1', s);       // ตัวหนา (ใช้กับชื่อผู้เล่น)
export const hl = s => c('1;36', s);   // ไฮไลต์ชื่อ
