import * as THREE from 'three';
import { mulberry32 } from './util.js';

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
attribute float aShape;
uniform float uScale;
varying float vAlpha;
varying vec3 vColor;
varying float vShape;
void main() {
  vAlpha = aAlpha; vColor = aColor; vShape = aShape;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
varying float vShape;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float a;
  if (vShape > 0.5) {
    a = step(abs(p.x), 0.42) * step(abs(p.y), 0.24);
  } else {
    float d = length(p);
    a = smoothstep(0.5, 0.05, d);
    a *= a;
  }
  a *= vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}`;

/** A pool of camera-facing particles, simulated on the CPU. */
export class Particles {
  constructor(max, additive, scale) {
    this.max = max;
    this.list = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.alpha = new Float32Array(max);
    this.size = new Float32Array(max);
    this.shape = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aShape', new THREE.BufferAttribute(this.shape, 1));
    g.setDrawRange(0, 0);
    this.geo = g;
    const m = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: scale } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 20 : 10;
  }

  spawn(p) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({
      x: p.x, y: p.y, z: p.z,
      vx: p.vx ?? 0, vy: p.vy ?? 0, vz: p.vz ?? 0,
      life: p.life ?? 1, age: 0,
      size: p.size ?? 0.1,
      r: p.color[0], g: p.color[1], b: p.color[2],
      gravity: p.gravity ?? 0,
      drag: p.drag ?? 0,
      shape: p.shape ?? 0,
      fade: p.fade ?? 0.4,
      twinkle: p.twinkle ?? 0,
      seed: p.seed ?? 0,
      grow: p.grow ?? 0,
    });
  }

  step(dt) {
    const out = [];
    for (const q of this.list) {
      q.age += dt;
      if (q.age >= q.life) continue;
      const k = Math.exp(-q.drag * dt);
      q.vx *= k; q.vy *= k; q.vz *= k;
      q.vy += q.gravity * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.shape > 0.5 && q.y < 0.02) { q.y = 0.02; q.vx = q.vy = q.vz = 0; }
      out.push(q);
    }
    this.list = out;
  }

  sync(time) {
    const n = Math.min(this.list.length, this.max);
    for (let i = 0; i < n; i++) {
      const q = this.list[i];
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
      this.col[i * 3] = q.r; this.col[i * 3 + 1] = q.g; this.col[i * 3 + 2] = q.b;
      const left = q.life - q.age;
      let a = Math.min(1, left / q.fade) * Math.min(1, q.age / 0.05 + 0.2);
      if (q.twinkle) a *= 0.45 + 0.55 * Math.abs(Math.sin(time * 23 + q.seed * 17));
      this.alpha[i] = a;
      this.size[i] = q.size * (1 + q.grow * (q.age / q.life));
      this.shape[i] = q.shape;
    }
    this.geo.setDrawRange(0, n);
    for (const k of ['position', 'aColor', 'aAlpha', 'aSize', 'aShape']) this.geo.attributes[k].needsUpdate = true;
  }
}

const PALETTES = [
  [[3.2, 1.0, 0.5], [3.0, 2.4, 0.9]],
  [[0.6, 1.6, 3.4], [2.6, 2.6, 3.0]],
  [[3.2, 0.6, 1.4], [3.0, 2.2, 0.7]],
  [[0.8, 3.0, 1.2], [3.0, 2.6, 0.8]],
  [[3.4, 2.6, 1.0], [3.4, 1.2, 0.4]],
];

export class FX {
  constructor(scene, pxScale, seed = 11) {
    this.rng = mulberry32(seed);
    this.glow = new Particles(14000, true, pxScale);
    this.solid = new Particles(6000, false, pxScale);
    scene.add(this.glow.points, this.solid.points);
    this.rockets = [];
    this.onSfx = () => {};
  }

  r(a = 0, b = 1) { return a + (b - a) * this.rng(); }

  /** Rockets launch from behind the houses and burst over the square. */
  fireworks(count, big = false) {
    for (let i = 0; i < count; i++) {
      const x = this.r(-7, 7);
      this.rockets.push({
        delay: i * this.r(0.18, 0.42) + (i ? this.r(0, 0.15) : 0),
        x, y: 2.5, z: this.r(-13, -8),
        vx: this.r(-0.6, 0.6),
        vy: this.r(11, 14),
        top: this.r(big ? 9.5 : 8.5, big ? 13.5 : 11.5),
        pal: PALETTES[Math.floor(this.rng() * PALETTES.length)],
        big,
        launched: false,
      });
    }
  }

  burst(rk) {
    const n = rk.big ? 230 : 150;
    const speed = rk.big ? 7.2 : 5.4;
    for (let i = 0; i < n; i++) {
      const u = this.r(-1, 1), th = this.r(0, Math.PI * 2);
      const s = Math.sqrt(1 - u * u);
      const v = speed * this.r(0.82, 1.0);
      const c = rk.pal[i % 2];
      this.glow.spawn({
        x: rk.x, y: rk.y, z: rk.z,
        vx: s * Math.cos(th) * v, vy: u * v, vz: s * Math.sin(th) * v,
        life: this.r(1.5, 2.2), size: rk.big ? 0.32 : 0.26,
        color: c, gravity: -2.4, drag: 1.25, fade: 0.9,
        twinkle: i % 3 === 0 ? 1 : 0, seed: this.rng(),
      });
    }
    this.glow.spawn({ x: rk.x, y: rk.y, z: rk.z, life: 0.35, size: rk.big ? 6 : 4.5, color: [2.5, 2.2, 1.6], fade: 0.3 });
    this.onSfx(rk.big ? 'boom_big' : 'boom');
  }

  step(dt) {
    const keep = [];
    for (const rk of this.rockets) {
      if (rk.delay > 0) { rk.delay -= dt; keep.push(rk); continue; }
      if (!rk.launched) { rk.launched = true; this.onSfx('launch'); }
      rk.x += rk.vx * dt;
      rk.y += rk.vy * dt;
      rk.vy *= Math.exp(-0.35 * dt);
      this.glow.spawn({ x: rk.x, y: rk.y, z: rk.z, vx: this.r(-0.2, 0.2), vy: -0.6, vz: 0, life: 0.45, size: 0.16, color: [2.6, 1.8, 0.9], fade: 0.4 });
      if (rk.y >= rk.top) this.burst(rk);
      else keep.push(rk);
    }
    this.rockets = keep;
    this.glow.step(dt);
    this.solid.step(dt);
  }

  sync(time) {
    this.glow.sync(time);
    this.solid.sync(time);
  }

  petals(p) {
    for (let i = 0; i < 46; i++) {
      const th = this.r(0, Math.PI * 2);
      const v = this.r(1.2, 2.8);
      const red = this.rng() < 0.75;
      this.solid.spawn({
        x: p.x, y: p.y + 0.2, z: p.z,
        vx: Math.cos(th) * v * 0.6, vy: this.r(2.5, 4.5), vz: Math.sin(th) * v * 0.6,
        life: this.r(1.4, 2.2), size: 0.11, shape: 1,
        color: red ? [0.85, 0.05, 0.12] : [0.95, 0.45, 0.6], gravity: -4.5, drag: 1.6, fade: 0.6,
      });
    }
    for (let i = 0; i < 18; i++) {
      this.glow.spawn({ x: p.x + this.r(-0.3, 0.3), y: p.y + this.r(0, 0.4), z: p.z + this.r(-0.3, 0.3), vy: this.r(0.4, 1.2), life: this.r(0.6, 1.0), size: 0.12, color: [2.2, 0.5, 0.7], fade: 0.5, twinkle: 1, seed: this.rng() });
    }
  }

  sparkle(p, n = 60, color = [2.6, 2.0, 0.7]) {
    for (let i = 0; i < n; i++) {
      const th = this.r(0, Math.PI * 2), rad = this.r(0.15, 0.55);
      this.glow.spawn({
        x: p.x + Math.cos(th) * rad, y: p.y + this.r(-0.9, 0.5), z: p.z + Math.sin(th) * rad,
        vx: Math.cos(th) * 0.3, vy: this.r(0.6, 1.8), vz: Math.sin(th) * 0.3,
        life: this.r(0.9, 1.7), size: this.r(0.08, 0.15), color, drag: 0.8, fade: 0.6,
        twinkle: 1, seed: this.rng(),
      });
    }
  }

  pop(p) {
    for (let i = 0; i < 26; i++) {
      const th = this.r(0, Math.PI * 2), v = this.r(0.8, 2.0);
      this.solid.spawn({
        x: p.x, y: this.r(0.1, 0.5), z: p.z,
        vx: Math.cos(th) * v, vy: this.r(0.2, 0.9), vz: Math.sin(th) * v,
        life: this.r(0.5, 0.9), size: this.r(0.18, 0.3), color: [0.85, 0.78, 0.66], drag: 3, fade: 0.5, grow: 1.2,
      });
    }
  }

  confetti(center, radius = 4.5) {
    const cols = [[0.95, 0.2, 0.25], [1, 0.8, 0.15], [0.2, 0.7, 1], [0.3, 0.9, 0.45], [0.95, 0.4, 0.85], [1, 1, 1]];
    for (let i = 0; i < 420; i++) {
      this.solid.spawn({
        x: center.x + this.r(-radius, radius), y: this.r(5.5, 9), z: center.z + this.r(-radius, radius * 0.6),
        vx: this.r(-0.6, 0.6), vy: this.r(-1.5, 0), vz: this.r(-0.4, 0.4),
        life: this.r(3.5, 5.5), size: this.r(0.1, 0.16), shape: 1,
        color: cols[i % cols.length], gravity: -1.1, drag: 1.4, fade: 0.8,
      });
    }
  }

  hearts(p) {
    for (let i = 0; i < 6; i++) {
      this.glow.spawn({ x: p.x + this.r(-0.4, 0.4), y: p.y, z: p.z + this.r(-0.2, 0.2), vy: this.r(0.8, 1.6), life: 1.2, size: 0.14, color: [2.4, 0.4, 0.6], fade: 0.6 });
    }
  }
}
