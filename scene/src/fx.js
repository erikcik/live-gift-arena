import { Container, Sprite } from 'pixi.js';
import { mulberry32 } from './util.js';

/**
 * Pooled sprite particles. Two layers: `normal` (smoke, dust, debris) and `add` (fire, sparks, glows).
 * Everything is stepped with the simulation clock, so the demo render is deterministic.
 */
export class Particles {
  constructor(T, seed = 9) {
    this.T = T;
    this.rng = mulberry32(seed);
    this.normal = new Container();
    this.add = new Container();
    this.list = [];
    this.pool = [];
  }

  r(a = 0, b = 1) { return a + (b - a) * this.rng(); }

  spawn(o) {
    const sp = this.pool.pop() || new Sprite();
    sp.texture = this.T[o.tex || 'glow'];
    sp.anchor.set(0.5);
    sp.blendMode = o.add ? 'add' : 'normal';
    sp.tint = o.color ?? 0xffffff;
    sp.visible = true;
    (o.add ? this.add : this.normal).addChild(sp);
    const p = {
      sp, x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || 0,
      life: o.life || 1, age: 0,
      s0: o.size ?? 1, s1: o.size1 ?? o.size ?? 1,
      a0: o.alpha ?? 1, rot: o.rot ?? 0, vr: o.vr || 0,
      g: o.gravity || 0, drag: o.drag || 0,
      fadeIn: o.fadeIn ?? 0.05, stretch: o.stretch || 0,
      ground: o.ground ?? null, sx: o.sx ?? 1,
      add: !!o.add,
    };
    this.list.push(p);
    return p;
  }

  step(dt) {
    const keep = [];
    for (const p of this.list) {
      p.age += dt;
      if (p.age >= p.life) {
        p.sp.visible = false;
        p.sp.parent?.removeChild(p.sp);
        this.pool.push(p.sp);
        continue;
      }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.ground !== null && p.y > p.ground) { p.y = p.ground; p.vy *= -0.25; p.vx *= 0.5; }
      p.rot += p.vr * dt;
      keep.push(p);
    }
    this.list = keep;
  }

  sync() {
    for (const p of this.list) {
      const t = p.age / p.life;
      const s = p.s0 + (p.s1 - p.s0) * t;
      const a = p.a0 * Math.min(1, p.age / Math.max(0.001, p.fadeIn)) * (1 - t * t);
      const sp = p.sp;
      sp.x = p.x;
      sp.y = p.y;
      sp.alpha = Math.max(0, a);
      if (p.stretch) {
        const sp2 = Math.hypot(p.vx, p.vy);
        sp.rotation = Math.atan2(p.vy, p.vx);
        sp.scale.set(s * (1 + sp2 * p.stretch), s);
      } else {
        sp.rotation = p.rot;
        sp.scale.set(s * p.sx, s);
      }
    }
  }

  // ---------- presets ----------

  explosion(x, y, power = 1) {
    const r = (a, b) => this.r(a, b);
    this.spawn({ tex: 'core', x, y: y - 30 * power, add: true, size: 1.8 * power, size1: 2.6 * power, life: 0.12, color: 0xffe9b0, alpha: 0.8 });
    this.spawn({ tex: 'glow', x, y: y - 30 * power, add: true, size: 1.6 * power, size1: 3.0 * power, life: 0.16, color: 0xffb35c, alpha: 0.55 });
    this.spawn({ tex: 'glow', x, y: y - 26 * power, add: true, size: 1.2 * power, size1: 2.0 * power, life: 0.45, color: 0xff7a24, alpha: 0.5 });
    this.spawn({ tex: 'ring', x, y: y - 6, add: true, size: 0.2, size1: 1.9 * power, life: 0.4, color: 0xff9a40, alpha: 0.55, sx: 1.7 });
    for (let i = 0; i < 18 * power; i++) {
      const a = r(Math.PI, Math.PI * 2), v = r(120, 380) * power;
      this.spawn({ tex: 'glow', x: x + r(-20, 20), y: y - r(0, 30), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.9, add: true, size: r(0.4, 0.8) * power, size1: 0.1, life: r(0.3, 0.7), drag: 3, color: [0xffb04a, 0xff7a24, 0xe8480f][i % 3], alpha: 0.55 });
    }
    for (let i = 0; i < 16 * power; i++) {
      const a = r(Math.PI * 1.05, Math.PI * 1.95), v = r(60, 200) * power;
      this.spawn({ tex: 'smoke', x: x + r(-30, 30), y: y - r(10, 50), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, size: r(0.4, 0.7) * power, size1: r(1.1, 1.6) * power, life: r(0.7, 1.0), drag: 2.2, color: [0xe8d5b0, 0xc9ae86, 0x8a6e4e][i % 3], alpha: 0.55, vr: r(-1, 1), fadeIn: 0.08 });
    }
    for (let i = 0; i < 16 * power; i++) {
      const a = r(Math.PI * 1.1, Math.PI * 1.9), v = r(300, 650) * power;
      this.spawn({ tex: 'spark', x, y: y - 20, vx: Math.cos(a) * v, vy: Math.sin(a) * v, add: true, size: r(0.35, 0.7), life: r(0.3, 0.6), gravity: 900, drag: 1.5, color: 0xffc070, alpha: 0.6, stretch: 0.002 });
    }
    for (let i = 0; i < 12 * power; i++) {
      const a = r(Math.PI * 1.15, Math.PI * 1.85), v = r(200, 480) * power;
      this.spawn({ tex: 'debris', x, y: y - 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: r(0.7, 1.3), life: r(0.8, 1.4), gravity: 1400, vr: r(-12, 12), ground: y + r(0, 30) });
    }
  }

  hit(x, y, color = 0xffe2b0) {
    this.spawn({ tex: 'glow', x, y, add: true, size: 0.3, size1: 0.55, life: 0.12, color, alpha: 0.35 });
    for (let k = 0; k < 4; k++) this.spawn({ tex: 'spark', x, y, add: true, size: 0.5, size1: 0.2, life: 0.14, color: 0xfff1d0, alpha: 0.7, rot: (k * Math.PI) / 2 + 0.4, sx: 1.6 });
    for (let i = 0; i < 5; i++) {
      const a = this.r(0, Math.PI * 2), v = this.r(220, 460);
      this.spawn({ tex: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, add: true, size: this.r(0.3, 0.45), life: this.r(0.12, 0.22), drag: 4, color, alpha: 0.55, stretch: 0.0025 });
    }
  }

  poof(x, y, color = 0xe8d5b0, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = this.r(Math.PI * 1.05, Math.PI * 1.95), v = this.r(30, 110);
      this.spawn({ tex: 'smoke', x: x + this.r(-18, 18), y: y + this.r(-8, 4), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5, size: this.r(0.3, 0.5), size1: this.r(0.7, 1.1), life: this.r(0.5, 0.9), drag: 2.5, color, alpha: 0.5, fadeIn: 0.08 });
    }
  }

  summon(x, y, color) {
    this.spawn({ tex: 'ring', x, y: y - 2, add: true, size: 0.3, size1: 1.0, life: 0.3, color, alpha: 0.6, sx: 2.2 });
    for (let i = 0; i < 8; i++) {
      const a = this.r(Math.PI * 1.1, Math.PI * 1.9), v = this.r(120, 260);
      this.spawn({ tex: 'spark', x, y: y - 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, add: true, size: this.r(0.3, 0.5), life: this.r(0.25, 0.45), drag: 3, color, alpha: 0.6, stretch: 0.002 });
    }
    this.poof(x, y, 0xcbb9a0, 5);
  }

  fire(x, y, vx, vy, scale = 1) {
    this.spawn({ tex: 'glow', x, y, vx: vx + this.r(-60, 60), vy: vy + this.r(-60, 60), add: true, size: this.r(0.5, 0.9) * scale, size1: this.r(1.2, 1.9) * scale, life: this.r(0.35, 0.6), drag: 1.2, color: [0xffc060, 0xff8a24, 0xe8480f][Math.floor(this.r(0, 3))], alpha: 0.6 });
  }

  embers(x, y, n = 1) {
    for (let i = 0; i < n; i++) {
      this.spawn({ tex: 'core', x: x + this.r(-30, 30), y, vx: this.r(-20, 20), vy: -this.r(30, 90), add: true, size: this.r(0.08, 0.16), life: this.r(1.5, 3), drag: 0.3, color: 0xffa040, alpha: 0.9 });
    }
  }
}
