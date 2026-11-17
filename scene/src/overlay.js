import * as THREE from 'three';
import { clamp, easeOutBack, easeOutCubic, smooth } from './util.js';

const FONT = '"Avenir Next", "Nunito", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"';
const f = (w, px) => `${w} ${px}px ${FONT}, ${EMOJI}`;
const nf = new Intl.NumberFormat('tr-TR');

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function fitText(g, text, maxW) {
  if (g.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && g.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

const TONES = {
  plain: ['rgba(20,16,32,0.78)', '#ffffff'],
  join: ['rgba(20,16,32,0.78)', '#ffffff'],
  rose: ['rgba(120,10,30,0.85)', '#ffe4ea'],
  gold: ['rgba(110,70,0,0.88)', '#fff3c4'],
  leader: ['rgba(150,20,30,0.92)', '#ffe08a'],
};

/** Everything drawn on top of the 3D scene: names, bubbles, leaderboard, banners. */
export class Overlay {
  constructor(canvas, game, camera, cfg, opts = {}) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.game = game;
    this.camera = camera;
    this.cfg = cfg;
    this.demo = !!opts.demo;
    this.v = new THREE.Vector3();
  }

  project(p) {
    this.v.copy(p).project(this.camera);
    return { x: (this.v.x * 0.5 + 0.5) * this.c.width, y: (-this.v.y * 0.5 + 0.5) * this.c.height, z: this.v.z };
  }

  draw() {
    const g = this.g;
    const W = this.c.width, H = this.c.height;
    const game = this.game;
    const t = game.time;
    g.clearRect(0, 0, W, H);
    g.textBaseline = 'middle';

    this.drawLabels(g, t);
    this.drawTitle(g, W, t);
    this.drawLeaderboard(g, t);
    this.drawHost(g, t);
    this.drawLegend(g, W);
    this.drawTempo(g, W, t);
    this.drawToasts(g, t);
    this.drawBanners(g, W, H, t);
    if (this.demo) this.drawCaptions(g, W, H, t);
    g.font = f(600, 24);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.textAlign = 'left';
    g.fillText('DEMO · simüle izleyiciler', 30, H - 34);
    if (game.endcard) this.drawEndcard(g, W, H, t - game.endcard.t0);
  }

  /**
   * Name tags. A crowded circle can't show every name at once, so tags are ranked
   * (leader, someone talking, just joined, gifted) and placed without overlapping;
   * a plain dancer's tag fades out a few seconds after they join.
   */
  drawLabels(g, t) {
    const game = this.game;
    const items = [];
    for (const d of game.dancers) {
      if (!d.user) continue;
      const age = t - d.joinedAt;
      const isHead = game.dancers[0] === d;
      let pr = 0;
      if (isHead) pr = 100;
      else if (d.bubble) pr = 80;
      else if (age < 5) pr = 60;
      else if (d.mendil || d.costume) pr = 40;
      if (!pr) continue;
      let bg = 'rgba(15,12,28,0.66)', fg = '#ffffff', txt = d.user;
      if (d.mendil) { bg = 'rgba(160,15,40,0.88)'; fg = '#ffe4ea'; }
      if (d.costume) { bg = 'rgba(105,60,0,0.92)'; fg = '#fff3c4'; }
      if (isHead) { bg = 'rgba(214,150,10,0.97)'; fg = '#2b1600'; txt = '👑 ' + d.user; }
      const alpha = pr === 60 ? clamp(age / 0.35, 0, 1) * clamp((5 - age) / 0.5, 0, 1) + (d.mendil || d.costume ? 1 : 0) : 1;
      items.push({ d, pr, txt, bg, fg, alpha: clamp(alpha, 0, 1), p: this.project(d.root.position.clone().setY(d.root.position.y + 2.02)) });
    }
    if (game.drummer) {
      const dav = game.world.davulcu.root.position;
      items.push({ pr: 90, txt: `🥁 ${game.drummer}`, bg: 'rgba(110,70,0,0.92)', fg: '#fff3c4', alpha: 1, p: this.project(dav.clone().setY(2.2)) });
    }
    items.sort((a, b) => b.pr - a.pr || a.p.z - b.p.z);
    const placed = [];
    const hit = (r) => placed.some((q) => r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h);
    const shown = [];
    g.font = f(700, 25);
    for (const it of items) {
      const w = g.measureText(it.txt).width + 26;
      it.p.x = clamp(it.p.x, w / 2 + 14, this.c.width - w / 2 - 14);
      let y = it.p.y;
      let rect = null;
      for (let k = 0; k < 5; k++) {
        const r = { x: it.p.x - w / 2 - 4, y: y - 21, w: w + 8, h: 42 };
        if (!hit(r)) { rect = r; break; }
        y -= 40;
      }
      if (!rect) {
        if (it.pr < 80) continue;
        rect = { x: it.p.x - w / 2, y: y - 21, w, h: 42 };
      }
      placed.push(rect);
      it.y = y;
      if (it.d?.bubble) {
        g.font = f(600, 27);
        const bw = Math.min(330, g.measureText(it.d.bubble.text).width + 30);
        g.font = f(700, 25);
        placed.push({ x: it.p.x - bw / 2, y: y - 92, w: bw, h: 62 });
      }
      shown.push(it);
    }
    shown.sort((a, b) => b.p.z - a.p.z);
    for (const it of shown) {
      g.save();
      g.globalAlpha = it.alpha;
      if (Math.abs(it.y - it.p.y) > 4) {
        g.strokeStyle = 'rgba(255,255,255,0.45)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(it.p.x, it.y + 18);
        g.lineTo(it.p.x, it.p.y + 18);
        g.stroke();
      }
      this.pill(g, it.p.x, it.y, it.txt, it.bg, it.fg, 25);
      g.restore();
      if (it.d?.bubble) this.bubble(g, it.p.x, it.y - 56, it.d.bubble.text, t - it.d.bubble.t0);
    }
  }

  pill(g, x, y, text, bg, fg, px) {
    g.font = f(700, px);
    const w = g.measureText(text).width + 26;
    g.fillStyle = bg;
    rr(g, x - w / 2, y - px * 0.72, w, px * 1.44, px * 0.72);
    g.fill();
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.fillText(text, x, y + 1);
  }

  bubble(g, x, y, text, age) {
    const s = easeOutBack(clamp(age / 0.3, 0, 1));
    const a = clamp((2.8 - age) / 0.4, 0, 1);
    g.save();
    g.globalAlpha = a;
    g.translate(x, y);
    g.scale(s, s);
    g.font = f(600, 27);
    const txt = fitText(g, text, 300);
    const w = g.measureText(txt).width + 30;
    g.fillStyle = 'rgba(255,255,255,0.96)';
    rr(g, -w / 2, -24, w, 48, 20);
    g.fill();
    g.beginPath();
    g.moveTo(-9, 23); g.lineTo(9, 23); g.lineTo(0, 35);
    g.fill();
    g.fillStyle = '#1d1730';
    g.textAlign = 'center';
    g.fillText(txt, 0, 1);
    g.restore();
  }

  drawTitle(g, W, t) {
    g.textAlign = 'center';
    g.font = f(900, 112);
    const grad = g.createLinearGradient(0, 40, 0, 150);
    grad.addColorStop(0, '#fff1b8');
    grad.addColorStop(0.55, '#ffc43d');
    grad.addColorStop(1, '#e8781a');
    g.lineWidth = 12;
    g.strokeStyle = 'rgba(60,10,20,0.85)';
    g.lineJoin = 'round';
    const y = 104 + 3 * Math.sin(t * 2);
    g.strokeText('HALAY', W / 2, y);
    g.fillStyle = grad;
    g.fillText('HALAY', W / 2, y);
    g.font = f(700, 33);
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(20,10,30,0.7)';
    const sub = 'yoruma “halay” yaz, halaya katıl';
    g.strokeText(sub, W / 2, 178);
    g.fillStyle = '#ffffff';
    g.fillText(sub, W / 2, 178);
  }

  drawLeaderboard(g, t) {
    const game = this.game;
    const rows = [...game.points.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const x = 28, y = 300, w = 420;
    const h = 74 + Math.max(1, rows.length) * 50;
    g.fillStyle = 'rgba(18,12,34,0.72)';
    rr(g, x, y, w, h, 26);
    g.fill();
    g.strokeStyle = 'rgba(255,200,80,0.55)';
    g.lineWidth = 2;
    g.stroke();
    g.textAlign = 'left';
    g.font = f(800, 30);
    g.fillStyle = '#ffd56a';
    g.fillText('🏆 HALAY USTALARI', x + 22, y + 38);
    if (!rows.length) {
      g.font = f(500, 25);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillText('ilk hediye seni buraya yazar', x + 22, y + 96);
      return;
    }
    const medals = ['🥇', '🥈', '🥉', '4', '5'];
    rows.forEach(([user, pts], i) => {
      const ry = y + 96 + i * 50;
      const flash = clamp(1 - (t - (game.lbFlash.get(user) ?? -9)) / 1.2, 0, 1);
      if (flash > 0) {
        g.fillStyle = `rgba(255,200,60,${0.35 * flash})`;
        rr(g, x + 10, ry - 22, w - 20, 44, 14);
        g.fill();
      }
      g.font = f(800, 27);
      g.fillStyle = '#ffffff';
      g.textAlign = 'center';
      g.fillText(medals[i], x + 42, ry);
      g.textAlign = 'left';
      g.font = f(700, 27);
      g.fillText(fitText(g, user, 210), x + 76, ry);
      g.textAlign = 'right';
      g.font = f(800, 26);
      g.fillStyle = '#ffd56a';
      g.fillText(nf.format(pts), x + w - 22, ry);
    });
  }

  drawHost(g, t) {
    const cx = 938, cy = 360, r = 112;
    g.save();
    const ring = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    ring.addColorStop(0, '#ffd166');
    ring.addColorStop(1, '#ef476f');
    g.beginPath();
    g.arc(cx, cy, r + 8, 0, Math.PI * 2);
    g.fillStyle = ring;
    g.fill();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    const bg = g.createRadialGradient(cx, cy - 30, 10, cx, cy, r);
    bg.addColorStop(0, '#4b4166');
    bg.addColorStop(1, '#1d1730');
    g.fillStyle = bg;
    g.fill();
    g.clip();
    g.fillStyle = '#8c84a8';
    g.beginPath();
    g.arc(cx, cy - 22, 38, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(cx, cy + 82, 74, 62, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.textAlign = 'center';
    g.font = f(800, 22);
    g.fillStyle = '#ffffff';
    this.pill(g, cx, cy + r + 6, '🎙️ SUNUCU', 'rgba(239,71,111,0.95)', '#ffffff', 22);
  }

  drawLegend(g, W) {
    const rows = this.cfg.legend;
    const x = 752, y = 528, w = 300, rowH = 40;
    const h = 52 + rows.length * rowH;
    g.fillStyle = 'rgba(18,12,34,0.62)';
    rr(g, x, y, w, h, 22);
    g.fill();
    g.textAlign = 'left';
    g.font = f(800, 22);
    g.fillStyle = '#ffd56a';
    g.fillText('HEDİYELER', x + 18, y + 28);
    rows.forEach(([emo, what, effect], i) => {
      const ry = y + 64 + i * rowH;
      g.font = f(600, 22);
      g.fillStyle = '#ffffff';
      g.fillText(emo, x + 16, ry);
      g.font = f(700, 21);
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.fillText(fitText(g, what, 128), x + 50, ry);
      g.fillStyle = '#ffffff';
      g.font = f(800, 21);
      g.textAlign = 'right';
      g.fillText(fitText(g, effect, 118), x + w - 14, ry);
      g.textAlign = 'left';
    });
  }

  drawTempo(g, W, t) {
    const game = this.game;
    const x = 300, y = 222, w = 480, h = 46;
    g.fillStyle = 'rgba(18,12,34,0.72)';
    rr(g, x, y, w, h, 23);
    g.fill();
    const lvl = clamp((game.bpm - game.cfg.tempo.baseBpm) / (game.cfg.tempo.maxBpm + 10 - game.cfg.tempo.baseBpm), 0, 1);
    const bx = x + 150, bw = w - 270;
    g.fillStyle = 'rgba(255,255,255,0.15)';
    rr(g, bx, y + 14, bw, 18, 9);
    g.fill();
    const grad = g.createLinearGradient(bx, 0, bx + bw, 0);
    grad.addColorStop(0, '#ffd166');
    grad.addColorStop(1, '#ef476f');
    g.fillStyle = grad;
    rr(g, bx, y + 14, Math.max(18, bw * lvl), 18, 9);
    g.fill();
    g.textAlign = 'left';
    g.font = f(800, 24);
    g.fillStyle = '#ffffff';
    const pulse = 1 + 0.12 * Math.exp(-((game.beatPos % 1) * 6));
    g.save();
    g.translate(x + 30, y + h / 2);
    g.scale(pulse, pulse);
    g.textAlign = 'center';
    g.fillText('🥁', 0, 1);
    g.restore();
    g.fillText('TEMPO', x + 56, y + h / 2 + 1);
    g.textAlign = 'right';
    g.fillText(`❤️ ${nf.format(game.likesTotal)}`, x + w - 18, y + h / 2 + 1);
  }

  drawToasts(g, t) {
    const list = this.game.toasts.slice(-4);
    const x = 28;
    let y = 300 + 74 + Math.max(1, Math.min(5, this.game.points.size)) * 50 + 24;
    for (const it of list) {
      const age = t - it.t0;
      const inP = easeOutCubic(clamp(age / 0.35, 0, 1));
      const a = clamp((5.5 - age) / 0.6, 0, 1);
      const [bg, fg] = TONES[it.tone] || TONES.plain;
      g.save();
      g.globalAlpha = a;
      g.translate(-460 * (1 - inP), 0);
      g.font = f(700, 25);
      const text = `${it.user} · ${it.text}`;
      const tw = Math.min(560, g.measureText(text).width);
      const w = tw + 86;
      g.fillStyle = bg;
      rr(g, x, y, w, 56, 28);
      g.fill();
      g.font = f(600, 28);
      g.textAlign = 'center';
      g.fillStyle = fg;
      g.fillText(it.emoji, x + 34, y + 29);
      g.textAlign = 'left';
      g.font = f(700, 25);
      g.fillText(fitText(g, text, 560), x + 62, y + 29);
      g.restore();
      y += 66;
    }
  }

  drawBanners(g, W, H, t) {
    for (const b of this.game.banners) {
      const age = t - b.t0;
      if (age < 0) continue;
      const a = clamp((b.dur - age) / 0.5, 0, 1);
      if (b.kind === 'leader') {
        const s = easeOutBack(clamp(age / 0.45, 0, 1));
        g.save();
        g.globalAlpha = a;
        g.translate(W / 2, 760);
        g.scale(s, s);
        const grad = g.createLinearGradient(0, -90, 0, 90);
        grad.addColorStop(0, '#ffe08a');
        grad.addColorStop(1, '#e09a10');
        g.fillStyle = 'rgba(80,10,20,0.92)';
        rr(g, -380, -92, 760, 184, 34);
        g.fill();
        g.lineWidth = 5;
        g.strokeStyle = grad;
        g.stroke();
        g.textAlign = 'center';
        g.font = f(800, 34);
        g.fillStyle = '#ffe08a';
        g.fillText('👑 YENİ HALAY BAŞI 👑', 0, -38);
        g.font = f(900, 66);
        g.fillStyle = '#ffffff';
        g.fillText(fitText(g, b.name, 680), 0, 34);
        g.restore();
      } else if (b.kind === 'sikistir') {
        const s = easeOutBack(clamp(age / 0.35, 0, 1)) * (1 + 0.04 * Math.sin(age * 22));
        const vig = clamp(1 - age / 1.2, 0, 1) * 0.5 + 0.12;
        const rg = g.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
        rg.addColorStop(0, 'rgba(255,40,40,0)');
        rg.addColorStop(1, `rgba(200,0,30,${vig * a})`);
        g.fillStyle = rg;
        g.fillRect(0, 0, W, H);
        g.save();
        g.globalAlpha = a;
        g.translate(W / 2 + 6 * Math.sin(age * 41), 730 + 4 * Math.sin(age * 33));
        g.rotate(-0.06 + 0.02 * Math.sin(age * 9));
        g.scale(s, s);
        g.textAlign = 'center';
        g.font = f(900, 150);
        g.lineJoin = 'round';
        g.lineWidth = 18;
        g.strokeStyle = '#3a0010';
        g.strokeText('SIKIŞTIR!', 0, 0);
        const grad = g.createLinearGradient(0, -70, 0, 70);
        grad.addColorStop(0, '#fff3b0');
        grad.addColorStop(0.5, '#ffb703');
        grad.addColorStop(1, '#fb5607');
        g.fillStyle = grad;
        g.fillText('SIKIŞTIR!', 0, 0);
        g.font = f(800, 36);
        g.lineWidth = 8;
        g.strokeText(`${b.name} sıkıştırdı`, 0, 104);
        g.fillStyle = '#ffffff';
        g.fillText(`${b.name} sıkıştırdı`, 0, 104);
        g.restore();
      }
    }
  }

  drawCaptions(g, W, H, t) {
    const c = this.game.captions[this.game.captions.length - 1];
    if (!c) return;
    const age = t - c.t0;
    const a = Math.min(smooth(age / 0.3), smooth((c.dur - age) / 0.4));
    g.save();
    g.globalAlpha = a;
    g.font = f(700, 36);
    const w = Math.min(W - 80, g.measureText(c.text).width + 64);
    const y = H - 250 + (1 - a) * 20;
    g.fillStyle = 'rgba(255,255,255,0.95)';
    rr(g, (W - w) / 2, y - 38, w, 76, 38);
    g.fill();
    g.fillStyle = '#1d1730';
    g.textAlign = 'center';
    g.fillText(fitText(g, c.text, W - 140), W / 2, y + 1);
    g.restore();
  }

  drawEndcard(g, W, H, age) {
    const a = smooth(age / 0.9);
    g.save();
    g.globalAlpha = a;
    g.fillStyle = 'rgba(12,8,24,0.78)';
    g.fillRect(0, 0, W, H);
    g.textAlign = 'center';
    g.font = f(400, 150);
    g.fillText('💃', W / 2, H / 2 - 230);
    g.font = f(900, 88);
    g.fillStyle = '#ffd56a';
    g.fillText('live-gift-arena', W / 2, H / 2 - 70);
    g.font = f(600, 36);
    g.fillStyle = '#ffffff';
    g.fillText('TikTok LIVE için hediyeye tepki veren sahneler', W / 2, H / 2 + 10);
    g.font = f(700, 34);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fillText('github.com/erikcik/live-gift-arena', W / 2, H / 2 + 90);
    g.restore();
  }
}
