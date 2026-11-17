import { Texture } from 'pixi.js';
import { mulberry32 } from './util.js';

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return Texture.from(c);
}

/** Procedural effect textures: glows, smoke, sparks, rings, shadows, arrows, rocks. */
export function makeFxTextures() {
  const rng = mulberry32(42);
  const T = {};
  T.glow = canvas(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    r.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  });
  T.core = canvas(64, 64, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  });
  T.smoke = canvas(160, 160, (g, w) => {
    for (let i = 0; i < 26; i++) {
      const x = w / 2 + (rng() - 0.5) * w * 0.45, y = w / 2 + (rng() - 0.5) * w * 0.45;
      const rad = w * (0.12 + rng() * 0.2);
      const r = g.createRadialGradient(x, y, 0, x, y, rad);
      r.addColorStop(0, `rgba(255,255,255,${0.18 + rng() * 0.12})`);
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    }
  });
  T.spark = canvas(64, 12, (g, w, h) => {
    const r = g.createLinearGradient(0, 0, w, 0);
    r.addColorStop(0, 'rgba(255,255,255,0)');
    r.addColorStop(0.7, 'rgba(255,255,255,0.9)');
    r.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = r;
    g.beginPath();
    g.ellipse(w / 2, h / 2, w / 2, h / 2.6, 0, 0, Math.PI * 2);
    g.fill();
  });
  T.ring = canvas(256, 256, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, w * 0.36, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,0)');
    r.addColorStop(0.55, 'rgba(255,255,255,0.9)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  });
  T.shadow = canvas(128, 40, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(0,0,0,0.75)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    g.setTransform(1, 0, 0, h / w, 0, 0);
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  });
  T.scorch = canvas(256, 96, (g, w, h) => {
    g.setTransform(1, 0, 0, h / w, 0, 0);
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(20,10,5,0.85)');
    r.addColorStop(0.6, 'rgba(30,15,8,0.45)');
    r.addColorStop(1, 'rgba(30,15,8,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  });
  T.pillar = canvas(96, 512, (g, w, h) => {
    const v = g.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, 'rgba(255,255,255,0)');
    v.addColorStop(0.55, 'rgba(255,255,255,0.65)');
    v.addColorStop(0.92, 'rgba(255,255,255,1)');
    v.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    const hz = g.createLinearGradient(0, 0, w, 0);
    hz.addColorStop(0, 'rgba(0,0,0,0)');
    hz.addColorStop(0.5, 'rgba(0,0,0,1)');
    hz.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = hz;
    g.fillRect(0, 0, w, h);
  });
  T.arrow = canvas(72, 12, (g, w, h) => {
    g.strokeStyle = '#5b3a1e';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(6, h / 2);
    g.lineTo(w - 12, h / 2);
    g.stroke();
    g.fillStyle = '#d9d9d9';
    g.beginPath();
    g.moveTo(w, h / 2);
    g.lineTo(w - 14, 1);
    g.lineTo(w - 14, h - 1);
    g.fill();
    g.fillStyle = '#f2f2f2';
    g.beginPath();
    g.moveTo(0, 1);
    g.lineTo(12, h / 2);
    g.lineTo(0, h - 1);
    g.fill();
  });
  T.rock = canvas(96, 96, (g, w) => {
    g.translate(w / 2, w / 2);
    g.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, rr = w * (0.34 + rng() * 0.1);
      i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
    const r = g.createRadialGradient(-10, -10, 4, 0, 0, w * 0.45);
    r.addColorStop(0, '#ffcf7a');
    r.addColorStop(0.35, '#a33b12');
    r.addColorStop(1, '#2a120a');
    g.fillStyle = r;
    g.fill();
    g.strokeStyle = 'rgba(255,180,60,0.9)';
    g.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo((rng() - 0.5) * 40, (rng() - 0.5) * 40);
      g.lineTo((rng() - 0.5) * 40, (rng() - 0.5) * 40);
      g.stroke();
    }
  });
  T.debris = canvas(24, 24, (g) => {
    g.fillStyle = '#6b5a48';
    g.beginPath();
    g.moveTo(3, 6); g.lineTo(18, 2); g.lineTo(22, 15); g.lineTo(8, 21);
    g.fill();
  });
  T.feather = canvas(40, 14, (g, w, h) => {
    g.fillStyle = '#f4f1ea';
    g.beginPath();
    g.ellipse(w / 2, h / 2, w / 2, h / 3, 0, 0, Math.PI * 2);
    g.fill();
  });
  return T;
}
