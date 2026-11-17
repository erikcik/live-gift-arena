import * as THREE from 'three';

const cache = new Map();
export function mat(color, o = {}) {
  const k = color + '|' + JSON.stringify(o);
  let m = cache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...o });
    cache.set(k, m);
  }
  return m;
}
export const gold = () => mat('#e7b545', { metalness: 0.85, roughness: 0.3, emissive: '#5c3a00', emissiveIntensity: 0.55 });
export const velvet = () => mat('#8f1428', { roughness: 0.6, emissive: '#2a0008', emissiveIntensity: 0.4 });

export const G = {
  leg: new THREE.CylinderGeometry(0.072, 0.062, 0.8, 10).translate(0, -0.4, 0),
  salvar: new THREE.CylinderGeometry(0.135, 0.085, 0.78, 12).translate(0, -0.39, 0),
  foot: new THREE.BoxGeometry(0.12, 0.07, 0.25),
  torso: new THREE.CylinderGeometry(0.19, 0.225, 0.6, 16).translate(0, 0.3, 0),
  vest: new THREE.CylinderGeometry(0.203, 0.24, 0.48, 16, 1, true).translate(0, 0.32, 0),
  trim: new THREE.TorusGeometry(0.24, 0.018, 6, 24).rotateX(Math.PI / 2),
  trimTop: new THREE.TorusGeometry(0.205, 0.018, 6, 24).rotateX(Math.PI / 2),
  sash: new THREE.CylinderGeometry(0.232, 0.232, 0.09, 16),
  dress: new THREE.CylinderGeometry(0.215, 0.47, 0.86, 18, 1, true).translate(0, -0.43, 0),
  hem: new THREE.TorusGeometry(0.47, 0.024, 6, 28).rotateX(Math.PI / 2),
  neck: new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8),
  head: new THREE.SphereGeometry(0.16, 22, 16),
  eye: new THREE.SphereGeometry(0.022, 8, 6),
  brow: new THREE.BoxGeometry(0.05, 0.012, 0.012),
  mustache: new THREE.BoxGeometry(0.13, 0.032, 0.035),
  cap: new THREE.CylinderGeometry(0.168, 0.172, 0.075, 18),
  brim: new THREE.BoxGeometry(0.2, 0.02, 0.11),
  hair: new THREE.SphereGeometry(0.169, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.6),
  scarf: new THREE.SphereGeometry(0.185, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.64),
  scarfTail: new THREE.ConeGeometry(0.16, 0.34, 12, 1, true),
  coin: new THREE.CylinderGeometry(0.028, 0.028, 0.008, 12).rotateX(Math.PI / 2),
  arm: new THREE.CylinderGeometry(0.05, 0.044, 1, 8).translate(0, 0.5, 0),
  hand: new THREE.SphereGeometry(0.05, 10, 8),
  localArm: new THREE.CylinderGeometry(0.05, 0.044, 0.58, 8).translate(0, -0.29, 0),
};

const SKINS = ['#f2c9a6', '#e3b08c', '#cf956d', '#b67f58', '#f5d6bd', '#dca47c'];
const DRESS = ['#7b2d8e', '#1f6f8b', '#b8323f', '#2e7d4f', '#d4682a', '#3a4fb0', '#a8326e', '#0f766e', '#c2410c'];
const SHIRT = ['#f4efe3', '#ece3cf', '#e2e8ef', '#f2e6d8'];
const SALVAR = ['#1f2233', '#2b2f45', '#3a2a22', '#1d3a2f', '#262626'];
const VEST = ['#3b2a20', '#202a44', '#4a1f22', '#2d3b2a', '#1c1c1c', '#3d2f5a'];
const SCARF = ['#e8d05a', '#f4f1ea', '#d94f6b', '#5bb3d9', '#f29b38', '#9ad36a', '#c792ea', '#ff7f50'];
const SASH = ['#c62e3a', '#2f7d4a', '#d9a227', '#3b5bb5', '#7c3aed'];
const HAIR = ['#1e1611', '#2b1d14', '#3b2a1a', '#111111', '#4a3526'];

function add(parent, geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/**
 * A stylised villager. Forward is +z in local space, so the dancer's right is -x.
 * Arms of line dancers live outside the figure (the line links them hand to hand);
 * musicians get local arms (opts.localArms).
 */
export function createDancer(rng, opts = {}) {
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const female = opts.female ?? rng() < 0.5;
  const skin = opts.skin ?? pick(SKINS);
  const d = { female, skin, costume: 0, parts: {} };
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  d.root = root;
  d.body = body;

  const shoe = mat('#2a1a12');
  const legMat = female ? mat('#2b2224') : mat(pick(SALVAR));
  d.legL = new THREE.Group();
  d.legR = new THREE.Group();
  d.legL.position.set(0.1, 0.9, 0);
  d.legR.position.set(-0.1, 0.9, 0);
  for (const leg of [d.legL, d.legR]) {
    body.add(leg);
    add(leg, female ? G.leg : G.salvar, legMat);
    add(leg, G.foot, shoe, 0, -0.8, 0.05);
  }

  d.torso = new THREE.Group();
  d.torso.position.set(0, 0.9, 0);
  body.add(d.torso);
  const dressColor = pick(DRESS);
  const shirt = female ? mat(dressColor) : mat(pick(SHIRT));
  d.shirtMat = shirt;
  d.torsoMesh = add(d.torso, G.torso, shirt);

  if (female) {
    d.dress = new THREE.Group();
    d.dress.position.set(0, 0.97, 0);
    body.add(d.dress);
    d.dressMesh = add(d.dress, G.dress, mat(dressColor, { side: THREE.DoubleSide }));
    d.hem = add(d.dress, G.hem, mat(pick(SASH)), 0, -0.85, 0);
  }
  d.vest = add(d.torso, G.vest, mat(female ? pick(SASH) : pick(VEST), { side: THREE.DoubleSide }));
  d.vest.visible = !female;
  d.trimA = add(d.torso, G.trim, gold(), 0, 0.09, 0);
  d.trimB = add(d.torso, G.trimTop, gold(), 0, 0.555, 0);
  d.trimA.visible = d.trimB.visible = false;
  d.sash = add(d.torso, G.sash, mat(pick(SASH)), 0, 0.06, 0);

  add(d.torso, G.neck, mat(skin), 0, 0.64, 0);
  d.head = new THREE.Group();
  d.head.position.set(0, 0.79, 0);
  d.torso.add(d.head);
  add(d.head, G.head, mat(skin));
  const eyeMat = mat('#1a1410', { roughness: 0.3 });
  add(d.head, G.eye, eyeMat, -0.056, 0.025, 0.142);
  add(d.head, G.eye, eyeMat, 0.056, 0.025, 0.142);
  if (female) {
    const scarf = mat(pick(SCARF));
    const s = add(d.head, G.scarf, scarf, 0, 0.012, -0.012);
    s.rotation.x = -0.32;
    const tail = add(d.head, G.scarfTail, scarf, 0, -0.12, -0.1);
    tail.rotation.x = 0.25;
    d.coins = [];
    for (let i = -3; i <= 3; i++) {
      const a = (i / 3) * 0.95;
      const c = add(d.head, G.coin, gold(), Math.sin(a) * 0.175, 0.1, Math.cos(a) * 0.152);
      c.rotation.y = a;
      c.visible = false;
      d.coins.push(c);
    }
  } else {
    const hairMat = mat(pick(HAIR));
    add(d.head, G.brow, hairMat, -0.056, 0.07, 0.15);
    add(d.head, G.brow, hairMat, 0.056, 0.07, 0.15);
    if (rng() < 0.7) add(d.head, G.mustache, hairMat, 0, -0.045, 0.152);
    if (rng() < 0.55) {
      const capMat = mat(pick(['#3f3f46', '#57534e', '#44403c', '#1f2937']));
      add(d.head, G.cap, capMat, 0, 0.12, -0.01);
      add(d.head, G.brim, capMat, 0, 0.1, 0.13);
    } else {
      const h = add(d.head, G.hair, hairMat, 0, 0.015, -0.012);
      h.rotation.x = -0.5;
    }
  }

  d.sleeveMat = female ? mat(dressColor) : shirt;
  d.handMat = mat(skin);

  if (opts.localArms) {
    d.armL = new THREE.Group();
    d.armR = new THREE.Group();
    d.armL.position.set(0.25, 0.55, 0);
    d.armR.position.set(-0.25, 0.55, 0);
    for (const a of [d.armL, d.armR]) {
      d.torso.add(a);
      add(a, G.localArm, d.sleeveMat);
      add(a, G.hand, d.handMat, 0, -0.6, 0);
    }
  }
  return d;
}

/** Upgrade to the regional wedding costume (Finger Heart). */
export function applyCostume(d) {
  if (d.costume) return;
  d.costume = 1;
  d.vest.visible = true;
  d.vest.material = velvet();
  d.trimA.visible = d.trimB.visible = true;
  d.sash.material = gold();
  if (d.female) {
    d.dressMesh.material = mat('#5b1a7a', { side: THREE.DoubleSide, roughness: 0.55 });
    d.hem.material = gold();
    d.torsoMesh.material = mat('#5b1a7a', { roughness: 0.55 });
    d.sleeveMat = mat('#5b1a7a', { roughness: 0.55 });
    for (const c of d.coins) c.visible = true;
  }
}

/**
 * Halay footwork on a 4-beat cycle: right step, left crosses behind, right step, left kicks forward.
 * `shimmy` (0..1) adds the fast shoulder shake used when the line squeezes.
 */
export function poseDancer(d, beat, shimmy = 0, energy = 0) {
  const b = Math.floor(beat);
  const f = beat - b;
  const k = ((b % 4) + 4) % 4;
  const lift = Math.max(0, Math.sin(Math.PI * Math.min(1, f / 0.62)));
  d.legL.rotation.set(0, 0, 0);
  d.legR.rotation.set(0, 0, 0);
  const amp = 1 + energy * 0.35;
  if (k === 0 || k === 2) {
    d.legR.rotation.z = -0.2 * lift * amp;
    d.legR.rotation.x = -0.18 * lift;
  } else if (k === 1) {
    d.legL.rotation.z = -0.12 * lift;
    d.legL.rotation.x = 0.22 * lift;
  } else {
    d.legL.rotation.x = -0.75 * lift * amp;
    d.legR.rotation.x = 0.08 * lift;
  }
  const dip = 0.5 + 0.5 * Math.cos(2 * Math.PI * f);
  d.body.position.y = -0.06 * dip * amp + (k === 3 ? 0.03 * lift : 0);
  d.torso.rotation.x = 0.06 + 0.05 * dip + (k === 3 ? -0.06 * lift : 0);
  d.torso.rotation.y = shimmy * 0.16 * Math.sin(beat * Math.PI * 8);
  d.torso.rotation.z = 0.04 * Math.sin(beat * Math.PI) + shimmy * 0.04 * Math.sin(beat * Math.PI * 8 + 1);
  d.head.rotation.x = -0.05 + 0.06 * dip;
  d.head.rotation.z = -d.torso.rotation.z * 0.6;
  if (d.dress) {
    d.dress.rotation.z = 0.05 * Math.sin(beat * Math.PI) + shimmy * 0.04 * Math.sin(beat * Math.PI * 8);
    d.dress.rotation.x = k === 3 ? -0.08 * lift : 0;
  }
}
