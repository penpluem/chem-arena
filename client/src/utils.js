import * as pc from 'playcanvas';

// ตัวช่วยสร้าง entity ทรงพื้นฐานพร้อมสี
export function createFactory(app) {
  const mats = {};
  function mat(hex) {
    if (!mats[hex]) {
      const m = new pc.StandardMaterial();
      m.diffuse = new pc.Color().fromString(hex);
      m.update();
      mats[hex] = m;
    }
    return mats[hex];
  }
  function mk(type, hex, pos, scale, parent) {
    const e = new pc.Entity();
    e.addComponent('render', { type, material: mat(hex) });
    e.setLocalPosition(pos[0], pos[1], pos[2]);
    e.setLocalScale(scale[0], scale[1], scale[2]);
    (parent || app.root).addChild(e);
    return e;
  }
  // วัสดุโปร่งแสง/เรืองแสง (รั้วกระจก ไฟนีออน)
  const gm = {};
  function glass(hex, opacity = 0.3, glow = 0.6) {
    const k = hex + opacity + glow;
    if (!gm[k]) {
      const m = new pc.StandardMaterial();
      m.diffuse = new pc.Color().fromString(hex);
      m.emissive = new pc.Color().fromString(hex); m.emissiveIntensity = glow;
      m.opacity = opacity; m.blendType = pc.BLEND_NORMAL; m.depthWrite = false; m.cull = pc.CULLFACE_NONE;
      m.update(); gm[k] = m;
    }
    return gm[k];
  }
  function mkg(type, hex, pos, scale, opacity, glow, parent) {
    const e = mk(type, hex, pos, scale, parent);
    e.render.meshInstances[0].material = glass(hex, opacity, glow);
    e.render.castShadows = false;
    return e;
  }
  return { mat, mk, glass, mkg };
}

// ข้อความสองภาษาตามภาษาที่เซิร์ฟเวอร์สุ่มให้เกมนั้น (th / en / both)
export const lbl = (l, lang) => (!l ? '' : typeof l === 'string' ? l : lang === 'en' ? l.en : lang === 'th' ? l.th : l.en === l.th ? l.en : `${l.en}\n${l.th}`);
