import * as pc from 'playcanvas';
// อนุภาคเรียบ ๆ: ลูกบาศก์เล็กลอยตามแรงโน้มถ่วง ใช้ซ้ำจากพูล (ควันตอนตกรอบ / กระดาษสีตอนชนะ)
export function createFx(app, factory) {
  const list = [], pool = [];
  const COLORS = ['#fa5252', '#fcc419', '#40c057', '#339af0', '#cc5de8', '#ff922b', '#f783ac', '#22b8cf'];
  function get() {
    const e = pool.pop() || factory.mk('box', '#ffffff', [0, -50, 0], [0.3, 0.3, 0.3]);
    e.enabled = true; return e;
  }
  function burst(x, y, z, { n = 16, colors = ['#f1f3f5', '#ced4da'], speed = 4, up = 4, life = 0.8, size = 0.3, grav = 9 } = {}) {
    for (let i = 0; i < n; i++) {
      const e = get(), a = Math.random() * Math.PI * 2, sp = speed * (0.3 + Math.random());
      e.render.meshInstances[0].material = factory.mat(colors[i % colors.length]);
      const s = size * (0.6 + Math.random() * 0.8); e.setLocalScale(s, s, s); e.setPosition(x, y, z);
      list.push({ e, vx: Math.cos(a) * sp, vy: up * (0.4 + Math.random()), vz: Math.sin(a) * sp, life, t: 0, grav, rx: Math.random() * 360, rv: (Math.random() - 0.5) * 600 });
    }
  }
  return {
    poof(x, z) { burst(x, 1, z, { n: 18, speed: 3, up: 3, life: 0.7, size: 0.45, grav: 4 }); },
    confetti(x, z) { burst(x, 3, z, { n: 40, colors: COLORS, speed: 7, up: 11, life: 2.4, size: 0.28, grav: 11 }); },
    sparkle(x, z) { burst(x, 0.6, z, { n: 10, colors: ['#ffe066', '#fff3bf'], speed: 2.5, up: 4, life: 0.7, size: 0.22, grav: 5 }); },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i]; p.t += dt;
        if (p.t >= p.life) { p.e.enabled = false; pool.push(p.e); list.splice(i, 1); continue; }
        p.vy -= p.grav * dt;
        const q = p.e.getPosition(); p.e.setPosition(q.x + p.vx * dt, Math.max(0.05, q.y + p.vy * dt), q.z + p.vz * dt);
        p.rx += p.rv * dt; p.e.setEulerAngles(p.rx, p.rx * 0.7, 0);
        const k = 1 - Math.max(0, (p.t / p.life - 0.6) / 0.4); const s = p.e.getLocalScale(); if (k < 1) p.e.setLocalScale(s.x * (0.5 + 0.5 * k), s.y * (0.5 + 0.5 * k), s.z * (0.5 + 0.5 * k));
      }
    }
  };
}
