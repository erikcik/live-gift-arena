import { clamp, easeOutBack, easeOutCubic, easeInOut, smooth, mulberry32 } from './util.js';
import { depth } from './battle.js';

const D = '"Lilita One", "Avenir Next", Impact, sans-serif';
const U = '"Rubik", "Avenir Next", "Segoe UI", Arial, sans-serif';
const EMO = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"';
const fd = (px) => `${px}px ${D}, ${EMO}`;
const fu = (w, px) => `${w} ${px}px ${U}, ${EMO}`;
const nf = new Intl.NumberFormat('en-US');

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
function fit(g, s, w) {
  if (g.measureText(s).width <= w) return s;
  while (s.length > 1 && g.measureText(s + '…').width > w) s = s.slice(0, -1);
  return s + '…';
}
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function stroked(g, text, x, y, fill, stroke = '#160a03', width = 8) {
  g.lineJoin = 'round';
  if (width > 0) {
    g.lineWidth = width;
    g.strokeStyle = stroke;
    g.strokeText(text, x, y);
  }
  g.fillStyle = fill;
  g.fillText(text, x, y);
}

const flagCache = new Map();
function flagCanvas(code, w, h) {
  const key = `${code}:${w}x${h}`;
  if (flagCache.has(key)) return flagCache.get(key);
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const o = off.getContext('2d');
  if (code === 'us') {
    for (let i = 0; i < 13; i++) {
      o.fillStyle = i % 2 ? '#ffffff' : '#b22234';
      o.fillRect(0, (h / 13) * i, w, h / 13 + 0.5);
    }
    o.fillStyle = '#3c3b6e';
    o.fillRect(0, 0, w * 0.42, h * 0.54);
    o.fillStyle = '#ffffff';
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
      o.beginPath();
      o.arc(4 + c * (w * 0.42 - 8) / 4.2 + (r % 2 ? 2 : 0) + 2, 4 + r * (h * 0.54 - 8) / 3.2 + 2, Math.max(1.3, w / 60), 0, Math.PI * 2);
      o.fill();
    }
  } else {
    o.fillStyle = '#ff9933'; o.fillRect(0, 0, w, h / 3 + 0.5);
    o.fillStyle = '#ffffff'; o.fillRect(0, h / 3, w, h / 3 + 0.5);
    o.fillStyle = '#138808'; o.fillRect(0, (2 * h) / 3, w, h / 3 + 0.5);
    o.strokeStyle = '#000080';
    o.lineWidth = Math.max(1.3, w / 50);
    o.beginPath();
    o.arc(w / 2, h / 2, h / 7.5, 0, Math.PI * 2);
    o.stroke();
    for (let i = 0; i < 24; i += 2) {
      const a = (i / 24) * Math.PI * 2;
      o.beginPath();
      o.moveTo(w / 2, h / 2);
      o.lineTo(w / 2 + Math.cos(a) * h / 7.5, h / 2 + Math.sin(a) * h / 7.5);
      o.stroke();
    }
  }
  flagCache.set(key, off);
  return off;
}
function flag(g, code, x, y, w, h, wave = 0, t = 0) {
  const off = flagCanvas(code, w, h);
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = 10;
  g.fillStyle = '#ffffff';
  const b = Math.max(2, w / 30);
  rr(g, x - b, y - b, w + b * 2, h + b * 2, 6);
  g.fill();
  g.restore();
  const strips = 24;
  for (let i = 0; i < strips; i++) {
    const sx = (w / strips) * i;
    const dy = wave ? Math.sin(t * 5 + i * 0.5) * wave * (i / strips) : 0;
    g.drawImage(off, sx, 0, w / strips + 0.6, h, x + sx, y + dy, w / strips + 0.6, h);
  }
}

/** The 2D layer over the battle: HUD, name tags, numbers, feeds, banners, victory. */
export class Hud {
  constructor(canvas, battle, cfg, icons, opts = {}) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.b = battle;
    this.cfg = cfg;
    this.icons = icons;
    this.demo = !!opts.demo;
    this.lastBannerEnd = -9;
  }

  icon(g, kind, team, x, y, h) {
    const tm = this.b.teams[team];
    const art = kind === 'warrior' || kind === 'recruit' ? tm.art.warrior : tm.art[kind];
    const im = art && this.icons[art];
    if (im) {
      const w = (im.width / im.height) * h;
      g.drawImage(im, x - w / 2, y - h / 2, w, h);
      return w;
    }
    const rg = g.createRadialGradient(x, y, 1, x, y, h / 2);
    rg.addColorStop(0, '#fff0b0');
    rg.addColorStop(0.45, kind === 'meteor' ? '#ff5a14' : '#ff9a2e');
    rg.addColorStop(1, 'rgba(255,90,20,0)');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(x, y, h / 2, 0, Math.PI * 2);
    g.fill();
    if (kind === 'meteor') {
      g.fillStyle = '#3a1a0c';
      g.beginPath();
      g.arc(x + h * 0.08, y + h * 0.05, h * 0.2, 0, Math.PI * 2);
      g.fill();
    }
    return h;
  }

  draw() {
    const g = this.g, W = this.c.width, H = this.c.height, b = this.b, t = b.time, ck = b.clock;
    g.clearRect(0, 0, W, H);
    g.textBaseline = 'middle';
    const vicAge = b.victory ? ck - b.victory.c0 : -1;
    const vic = vicAge > 0 ? clamp((vicAge - 2.6) / 0.4, 0, 1) : 0;
    const shot = b.killShot ? clamp(1 - Math.abs(ck - b.killShot.c0 - 1.1) / 1.3, 0, 1) : 0;
    if (b.banners.length) this.lastBannerEnd = ck;

    const v = g.createRadialGradient(W / 2, H * 0.58, H * 0.32, W / 2, H * 0.58, H * 0.8);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(6,3,14,0.35)');
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
    const top = g.createLinearGradient(0, 0, 0, 600);
    top.addColorStop(0, 'rgba(8,5,20,0.62)');
    top.addColorStop(1, 'rgba(8,5,20,0)');
    g.fillStyle = top;
    g.fillRect(0, 0, W, 600);

    const hero = b.flyers.some((f) => f.kind === 'dragon') || b.major?.kind === 'meteor';
    g.save();
    g.globalAlpha = (1 - vic) * (1 - shot);
    this.tags(g, t, hero ? 0.35 : 1);
    this.numbers(g, t);
    this.heroPlates(g, t);
    g.restore();
    if (b.flash > 0) {
      g.fillStyle = `rgba(255,224,170,${b.flash * 0.45})`;
      g.fillRect(0, 0, W, H);
    }
    if (b.whiteFlash > 0) {
      g.fillStyle = `rgba(255,255,255,${b.whiteFlash})`;
      g.fillRect(0, 0, W, H);
    }
    g.save();
    g.globalAlpha = (1 - vic) * (1 - 0.85 * shot);
    this.header(g, W, t);
    this.host(g, ck);
    if (!b.banners.length) {
      this.feed(g, t);
      this.giftCard(g, ck);
      this.topGifters(g, W);
    }
    g.restore();
    g.save();
    g.globalAlpha = 1 - vic;
    this.banner(g, W, t);
    g.restore();
    if (b.stamp) this.stampDraw(g, W, ck - b.stamp.c0);
    if (b.logo) this.logoSlam(g, W, ck - b.logo.c0);
    if (this.demo && !b.endcard && !b.victory) this.caption(g, W, H, t, ck);
    if (vicAge > 2.6) this.victory(g, W, H, vicAge - 2.6);
    g.font = fu(600, 21);
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.textAlign = 'left';
    g.fillText('DEMO · simulated viewers', 26, H - 28);
    if (b.endcard) this.endcard(g, W, H, ck - b.endcard.c0);
  }

  // ----- world-anchored -----

  tags(g, t, fade) {
    const b = this.b;
    const placed = [];
    const hit = (r) => placed.some((q) => r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h);
    // Big plates: whoever just gifted, and the top 3 gifters, on their squad's front unit.
    const top3 = new Set([...b.points.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([u]) => u));
    const squads = new Map();
    for (const u of b.units) {
      if (!u.owner || u.state === 'dead' || u.state === 'spawn') continue;
      const key = `${u.team}:${u.owner}`;
      const dir = b.teams[u.team].dir;
      const s = squads.get(key);
      if (!s) squads.set(key, { lead: u, n: 1 });
      else {
        s.n++;
        if (u.x * dir > s.lead.x * dir) s.lead = u;
      }
    }
    const plates = [];
    for (const s of squads.values()) {
      const owner = s.lead.owner;
      const recent = t - (b.lastGift.get(owner) ?? -9);
      if (recent > 2.5 && !top3.has(owner)) continue;
      plates.push({ ...s, pr: (top3.has(owner) ? 2 : 0) + (recent < 2.5 ? 3 - recent : 0), a: recent < 2.5 ? clamp((2.5 - recent) / 0.3, 0, 1) : 1 });
    }
    plates.sort((x, y) => y.pr - x.pr);
    const out = [];
    g.font = fu(700, 24);
    for (const s of plates) {
      const u = s.lead;
      const p = b.toScreen(u.x, u.y - u.stats.height * depth(u.y) - 20);
      const label = u.owner.length > 14 ? u.owner.slice(0, 13) + '…' : u.owner;
      const badge = s.n > 1 ? `x${s.n}` : '';
      const w = g.measureText(label).width + 30 + (badge ? 40 : 0);
      const x = clamp(p.x, w / 2 + 10, this.c.width - w / 2 - 10);
      const r = { x: x - w / 2, y: p.y - 19, w, h: 38 };
      if (hit(r)) continue;
      placed.push(r);
      out.push({ u, x, y: p.y, w, label, badge, a: s.a });
    }
    // Small names under every fighter's feet.
    const feet = [];
    g.font = fu(700, 18);
    for (const u of b.units) {
      if (!u.owner || u.state === 'dead' || u.state === 'spawn') continue;
      const p = b.toScreen(u.x, u.y + 20);
      const w = g.measureText(u.owner).width + 6;
      const r = { x: p.x - w / 2, y: p.y - 10, w, h: 20 };
      if (hit(r)) continue;
      placed.push(r);
      feet.push({ u, p });
    }
    g.save();
    g.globalAlpha *= fade;
    g.textAlign = 'center';
    g.font = fu(700, 18);
    for (const { u, p } of feet) stroked(g, u.owner, p.x, p.y, b.teams[u.team].light, 'rgba(10,6,16,0.9)', 3.5);
    for (const { u, x, y, w, label, badge, a } of out) {
      const team = b.teams[u.team];
      g.save();
      g.globalAlpha *= a;
      g.fillStyle = rgba(team.dark, 0.92);
      rr(g, x - w / 2, y - 18, w, 36, 12);
      g.fill();
      g.lineWidth = 2.5;
      g.strokeStyle = team.color;
      g.stroke();
      const hp = clamp(u.hp / u.maxHp, 0, 1);
      g.fillStyle = 'rgba(0,0,0,0.5)';
      rr(g, x - w / 2 + 8, y + 9, w - 16, 5, 2.5);
      g.fill();
      g.fillStyle = hp > 0.5 ? '#7be37b' : hp > 0.25 ? '#ffc23d' : '#ff5a4a';
      rr(g, x - w / 2 + 8, y + 9, (w - 16) * hp, 5, 2.5);
      g.fill();
      g.textAlign = 'left';
      g.fillStyle = '#ffffff';
      g.font = fu(700, 24);
      g.fillText(label, x - w / 2 + 14, y - 3);
      if (badge) {
        g.fillStyle = team.color;
        rr(g, x + w / 2 - 42, y - 14, 36, 22, 8);
        g.fill();
        g.font = fu(800, 16);
        g.textAlign = 'center';
        g.fillStyle = '#ffffff';
        g.fillText(badge, x + w / 2 - 24, y - 2);
      }
      g.restore();
    }
    g.restore();
  }

  plate(g, x, y, name, sub, team) {
    g.font = fd(34);
    const w = Math.max(g.measureText(name).width, 120) + 92;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = 14;
    g.fillStyle = rgba(team.dark, 0.95);
    rr(g, x - w / 2, y - 30, w, 60, 18);
    g.fill();
    g.restore();
    g.lineWidth = 3;
    g.strokeStyle = '#f5c451';
    rr(g, x - w / 2, y - 30, w, 60, 18);
    g.stroke();
    g.font = fu(400, 30);
    g.textAlign = 'center';
    g.fillText('👑', x - w / 2 + 30, y);
    g.font = fd(34);
    g.textAlign = 'left';
    stroked(g, name, x - w / 2 + 56, y - 2, '#ffffff', 'rgba(0,0,0,0.5)', 5);
    if (sub) {
      g.font = fu(800, 16);
      g.textAlign = 'center';
      g.fillStyle = '#ffe08a';
      g.fillText(sub, x, y + 44);
    }
  }

  heroPlates(g, t) {
    const b = this.b;
    for (const f of b.flyers) {
      if (f.kind !== 'dragon' || !f.owner || f.hx === undefined) continue;
      const p = b.toScreen(f.hx, f.hy);
      const x = clamp(p.x, 170, this.c.width - 170);
      g.save();
      g.globalAlpha *= f.sp.alpha;
      this.plate(g, x, p.y, f.owner, '', b.teams[f.team]);
      g.restore();
    }
    if (b.major?.kind === 'meteor' && b.major.owner && !b.banners.length) {
      const a = b.majorK();
      g.save();
      g.globalAlpha *= a;
      this.plate(g, this.c.width / 2, 650, b.major.owner, '☄  METEOR STORM', b.teams[b.major.team]);
      g.restore();
    }
  }

  numbers(g, t) {
    const b = this.b;
    g.textAlign = 'center';
    if (b.killShot) return;
    for (const d of b.damageNums.slice(-4)) {
      const age = t - d.t0;
      const castle = d.kind === 'castle';
      const p = b.toScreen(d.x, d.y - age * (castle ? 40 : 60));
      const s = easeOutBack(clamp(age / 0.2, 0, 1));
      g.save();
      g.globalAlpha = clamp(((castle ? 1.4 : 0.8) - age) / 0.3, 0, 1);
      g.translate(clamp(p.x, 90, this.c.width - 90), p.y);
      g.scale(s, s);
      g.font = fd(castle ? 84 : 40);
      stroked(g, d.v, 0, 0, castle ? '#ff5a3c' : '#ffd23d', '#1a0806', castle ? 12 : 7);
      g.restore();
    }
  }

  // ----- header -----

  header(g, W, t) {
    const b = this.b;
    const lead = b.teams[0].coins === b.teams[1].coins ? -1 : b.teams[0].coins > b.teams[1].coins ? 0 : 1;
    b.teams.forEach((team, i) => this.panel(g, team, i === 0 ? 16 : W - 16 - 450, 192, 450, 138, i, t, lead === i));
    const cx = W / 2, cy = 260;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 18;
    const vg = g.createRadialGradient(cx, cy - 18, 6, cx, cy, 56);
    vg.addColorStop(0, '#6a4618');
    vg.addColorStop(1, '#1d1208');
    g.fillStyle = vg;
    g.beginPath();
    g.arc(cx, cy, 50, 0, Math.PI * 2);
    g.fill();
    g.restore();
    const ring = g.createLinearGradient(cx - 55, cy - 55, cx + 55, cy + 55);
    ring.addColorStop(0, '#ffe39a');
    ring.addColorStop(1, '#a8650f');
    g.lineWidth = 6;
    g.strokeStyle = ring;
    g.beginPath();
    g.arc(cx, cy, 50, 0, Math.PI * 2);
    g.stroke();
    g.textAlign = 'center';
    g.font = fd(44);
    stroked(g, 'VS', cx, cy + 3, '#ffd56a', '#1a0c02', 8);
    if (!b.logo || this.b.clock - b.logo.c0 > 1.9) {
      g.font = fd(24);
      stroked(g, this.cfg.title, cx, 180, '#ffe7a6', '#1a0c02', 6);
    }
  }

  panel(g, team, x, y, w, h, i, t, leading) {
    const b = this.b;
    const right = i === 1;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = 20;
    g.shadowOffsetY = 6;
    const bg = g.createLinearGradient(x, y, x, y + h);
    bg.addColorStop(0, i === 0 ? '#1d3e9e' : '#8a3a0e');
    bg.addColorStop(1, i === 0 ? '#0d1b4d' : '#3d1806');
    g.fillStyle = bg;
    rr(g, x, y, w, h, 20);
    g.fill();
    g.restore();
    g.lineWidth = 4;
    g.strokeStyle = '#0a0c14';
    rr(g, x, y, w, h, 20);
    g.stroke();
    g.lineWidth = 2.5;
    g.strokeStyle = leading ? '#f5c451' : rgba(team.light, 0.5);
    rr(g, x + 3, y + 3, w - 6, h - 6, 17);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.12)';
    rr(g, x + 8, y + 6, w - 16, 3, 2);
    g.fill();

    // Row 1: flag, name, live unit count, join badge.
    const fx = right ? x + w - 16 - 60 : x + 16;
    flag(g, team.flag, fx, y + 16, 60, 40);
    g.textAlign = right ? 'right' : 'left';
    g.font = fd(40);
    const nx = right ? fx - 14 : fx + 60 + 14;
    stroked(g, team.name, nx, y + 37, '#ffffff', 'rgba(0,0,0,0.55)', 6);
    const nw = g.measureText(team.name).width;
    const units = b.units.filter((u) => u.team === i && u.state !== 'dead').length;
    g.font = fu(700, 19);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    const ux = right ? nx - nw - 14 : nx + nw + 14;
    g.fillText(`⚔ ${units}`, ux, y + 38);
    if (leading) {
      const cw = g.measureText(`⚔ ${units}`).width + 22;
      g.font = fu(400, 24);
      g.textAlign = 'center';
      g.fillText('👑', right ? ux - cw : ux + cw, y + 36);
    }
    const bx0 = right ? x + 14 : x + w - 14 - 48;
    g.fillStyle = team.color;
    rr(g, bx0, y + 12, 48, 44, 12);
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.stroke();
    g.font = fd(32);
    g.textAlign = 'center';
    stroked(g, String(i + 1), bx0 + 24, y + 35, '#ffffff', 'rgba(0,0,0,0.4)', 4);
    g.font = fu(800, 10);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillText('COMMENT', bx0 + 24, y + 63);

    // Row 2: castle HP, the main bar.
    const bx = x + 16, bw = w - 32, by = y + 70, bh = 28;
    const hp = team.hp / team.maxHp;
    g.fillStyle = 'rgba(0,0,0,0.55)';
    rr(g, bx, by, bw, bh, 10);
    g.fill();
    const hitT = t - team.hitT < 0.12;
    const hg = g.createLinearGradient(0, by, 0, by + bh);
    hg.addColorStop(0, hitT ? '#ffffff' : team.light);
    hg.addColorStop(1, team.color);
    g.fillStyle = hg;
    const fw = bw * hp;
    rr(g, right ? bx + bw - fw : bx, by, Math.max(0, fw), bh, 10);
    g.fill();
    g.font = fu(800, 17);
    g.textAlign = 'center';
    stroked(g, `CASTLE  ${Math.ceil(hp * 100)}%`, bx + bw / 2, by + bh / 2 + 1, '#ffffff', 'rgba(0,0,0,0.6)', 4);

    // Row 3: gift goal → ultimate, a thin gold strip.
    const gy = y + 112;
    const ready = team.charges > 0;
    let goal = clamp(team.goal / team.ultimate.goal, 0, 1);
    if (team.drainT !== undefined && t - team.drainT < 0.4) goal = 1 - (1 - goal) * easeOutCubic((t - team.drainT) / 0.4);
    if (ready) goal = 1;
    g.font = fd(17);
    g.textAlign = right ? 'right' : 'left';
    const label = `⚡ ${team.ultimate.name}${ready ? '  READY' : ''}`;
    stroked(g, label, right ? bx + bw : bx, gy, ready ? '#fff2b0' : '#ffe08a', 'rgba(0,0,0,0.6)', 4);
    g.textAlign = right ? 'left' : 'right';
    g.font = fu(800, 15);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fillText(`${nf.format(Math.floor(team.goal))} / ${nf.format(team.ultimate.goal)}`, right ? bx : bx + bw, gy);
    g.fillStyle = 'rgba(0,0,0,0.55)';
    rr(g, bx, gy + 10, bw, 10, 5);
    g.fill();
    const pulse = ready ? 0.5 + 0.5 * Math.sin(t * 12) : goal >= 0.8 ? 0.3 + 0.3 * Math.sin(t * 9) : 0;
    g.save();
    g.shadowColor = `rgba(255,210,90,${pulse})`;
    g.shadowBlur = 18 * pulse;
    const gg = g.createLinearGradient(bx, 0, bx + bw, 0);
    gg.addColorStop(0, '#ffe7a0');
    gg.addColorStop(1, '#ff9a1f');
    g.fillStyle = gg;
    const gw = bw * goal;
    rr(g, right ? bx + bw - gw : bx, gy + 10, Math.max(goal > 0 ? 10 : 0, gw), 10, 5);
    g.fill();
    g.restore();
  }

  host(g, ck) {
    const x = 430, y = 344, w = 220, h = 220;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 18;
    const bg = g.createLinearGradient(0, y, 0, y + h);
    bg.addColorStop(0, '#2a2140');
    bg.addColorStop(1, '#120d20');
    g.fillStyle = bg;
    rr(g, x, y, w, h, 22);
    g.fill();
    g.restore();
    g.save();
    rr(g, x, y, w, h, 22);
    g.clip();
    g.fillStyle = '#4a4068';
    g.beginPath();
    g.arc(x + w / 2, y + 96, 40, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(x + w / 2, y + 214, 84, 70, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.lineWidth = 3;
    const ring = g.createLinearGradient(x, y, x + w, y + h);
    ring.addColorStop(0, '#f5c451');
    ring.addColorStop(1, '#b0651a');
    g.strokeStyle = ring;
    rr(g, x, y, w, h, 22);
    g.stroke();
    g.fillStyle = `rgba(255,59,59,${0.6 + 0.4 * Math.sin(ck * 5)})`;
    g.beginPath();
    g.arc(x + 22, y + 22, 7, 0, Math.PI * 2);
    g.fill();
    g.font = fu(800, 15);
    g.textAlign = 'left';
    g.fillStyle = '#ffffff';
    g.fillText('HOST CAM', x + 36, y + 23);
  }

  feed(g, t) {
    const b = this.b;
    let y = 344;
    for (const it of b.feed.slice(-3)) {
      const age = t - it.t0;
      const a = clamp((4.3 - (t - it.t1)) / 0.3, 0, 1);
      const inP = easeOutCubic(clamp(age / 0.14, 0, 1));
      const bump = 1 + 0.15 * clamp(1 - (t - it.bump) / 0.2, 0, 1);
      const team = b.teams[it.team];
      g.save();
      g.globalAlpha *= a;
      g.translate(-260 * (1 - inP), 0);
      g.font = fu(800, 23);
      const name = fit(g, it.user, 190);
      const nw = g.measureText(name).width;
      const w = Math.min(398, 52 + nw + 14 + 56 + 46);
      g.fillStyle = 'rgba(10,7,22,0.8)';
      rr(g, 16, y, w, 44, 22);
      g.fill();
      g.fillStyle = team.color;
      rr(g, 16, y, 6, 44, 3);
      g.fill();
      g.font = fu(400, 26);
      g.textAlign = 'center';
      g.fillStyle = '#ffffff';
      g.fillText(it.emoji, 44, y + 23);
      g.font = fu(800, 23);
      g.textAlign = 'left';
      g.fillStyle = team.light;
      g.fillText(name, 66, y + 23);
      const ix = 66 + nw + 36;
      if (it.unit === 'joined') flag(g, team.flag, ix - 20, y + 10, 36, 24);
      else this.icon(g, it.unit, it.team, ix, y + 22, it.unit === 'knight' || it.unit === 'dragon' ? 26 : 38);
      if (it.n > 1) {
        g.save();
        g.translate(ix + 44, y + 23);
        g.scale(bump, bump);
        g.font = fd(24);
        g.textAlign = 'center';
        stroked(g, `x${it.n}`, 0, 0, '#ffd56a', '#1a0c02', 5);
        g.restore();
      }
      g.restore();
      y += 50;
    }
  }

  giftCard(g, ck) {
    const items = this.cfg.legend;
    const n = items.length;
    const idx = Math.floor(ck / 3) % n;
    const f = (ck / 3) % 1;
    const [emo, gift, unit] = items[idx];
    const x = 16, y = 498, w = 398, h = 80;
    const slide = f < 0.08 ? (1 - easeOutCubic(f / 0.08)) * 40 : 0;
    g.save();
    g.globalAlpha *= f > 0.94 ? (1 - f) / 0.06 : 1;
    g.fillStyle = 'rgba(10,7,22,0.82)';
    rr(g, x, y, w, h, 18);
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(245,196,81,0.7)';
    g.stroke();
    g.translate(slide, 0);
    g.font = fu(400, 40);
    g.textAlign = 'center';
    g.fillText(emo, x + 44, y + h / 2 + 2);
    g.font = fd(28);
    g.textAlign = 'left';
    stroked(g, gift.toUpperCase(), x + 80, y + 28, '#ffffff', 'rgba(0,0,0,0.5)', 4);
    stroked(g, `→ ${unit.toUpperCase()}`, x + 80, y + 58, '#ffd24a', 'rgba(0,0,0,0.5)', 4);
    this.icon(g, unit, idx % 2, x + w - 62, y + h / 2, unit === 'knight' || unit === 'dragon' ? 50 : 70);
    g.restore();
  }

  topGifters(g, W) {
    const b = this.b;
    const top = [...b.points.entries()].sort((x, z) => z[1] - x[1]).slice(0, 3);
    if (!top.length) return;
    const x = W - 16 - 398, y = 344;
    g.fillStyle = 'rgba(10,7,22,0.78)';
    rr(g, x, y, 398, 44 + top.length * 42, 18);
    g.fill();
    g.font = fd(22);
    g.textAlign = 'left';
    stroked(g, 'TOP GIFTERS', x + 18, y + 24, '#ffd56a', 'rgba(0,0,0,0.5)', 4);
    top.forEach(([u, pts], k) => {
      const ry = y + 66 + k * 42;
      const tm = b.teams[b.users.get(u) ?? 0];
      g.fillStyle = ['#f5c451', '#d7dbe3', '#d08a4f'][k];
      g.beginPath();
      g.arc(x + 30, ry, 13, 0, Math.PI * 2);
      g.fill();
      g.font = fd(18);
      g.textAlign = 'center';
      stroked(g, String(k + 1), x + 30, ry + 1, '#1a0f08', '', 0);
      g.font = fu(800, 23);
      g.fillStyle = tm.light;
      g.textAlign = 'left';
      g.fillText(fit(g, u, 210), x + 54, ry + 1);
      g.textAlign = 'right';
      g.fillStyle = '#ffd56a';
      g.fillText(nf.format(pts), x + 380, ry + 1);
    });
  }

  banner(g, W, t) {
    const bn = this.b.banners[this.b.banners.length - 1];
    if (!bn) return;
    const age = t - bn.t0;
    const team = this.b.teams[bn.team];
    const inP = easeOutCubic(clamp(age / 0.16, 0, 1));
    const out = clamp((bn.dur - age) / 0.2, 0, 1);
    const punch = 1 + 0.1 * (1 - easeOutCubic(clamp(age / 0.25, 0, 1)));
    const from = bn.team === 1 ? 1 : -1;
    const cx = W / 2 + from * (1 - inP) * 700, cy = 664;
    const w = 880, h = 150;
    g.save();
    g.globalAlpha *= out;
    g.translate(cx, cy);
    g.scale(punch, punch);
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 24;
    const rib = g.createLinearGradient(0, -h / 2, 0, h / 2);
    rib.addColorStop(0, team ? (bn.team === 0 ? '#2b5bd7' : '#f08a24') : '#c27a12');
    rib.addColorStop(1, team ? (bn.team === 0 ? '#16307a' : '#9a3d0a') : '#6a3a06');
    g.fillStyle = rib;
    const c = 34;
    g.beginPath();
    g.moveTo(-w / 2, -h / 2);
    g.lineTo(w / 2, -h / 2);
    g.lineTo(w / 2 - c, 0);
    g.lineTo(w / 2, h / 2);
    g.lineTo(-w / 2, h / 2);
    g.lineTo(-w / 2 + c, 0);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#f5c451';
    g.fillRect(-w / 2 + 6, -h / 2, w - 12, 4);
    g.fillRect(-w / 2 + 6, h / 2 - 4, w - 12, 4);
    g.textAlign = 'center';
    if (bn.icon) {
      g.font = fu(400, 58);
      g.fillText(bn.icon, -w / 2 + 96, 0);
    }
    const tx = bn.icon ? 40 : 0;
    g.font = fd(bn.name.length > 10 ? 68 : 82);
    stroked(g, fit(g, bn.name, 600), tx, -16, '#ffffff', '#140a04', 10);
    if (bn.line) {
      g.font = fd(36);
      stroked(g, bn.line, tx, 44, bn.ult ? '#ffe08a' : team ? team.light : '#ffe08a', '#140a04', 7);
    }
    g.restore();
  }

  stampDraw(g, W, age) {
    if (age < 0.1 || age > 2.5) return;
    const st = this.b.stamp;
    const team = this.b.teams[st.team];
    const s = easeOutBack(clamp((age - 0.1) / 0.25, 0, 1)) * (1 + 0.6 * (1 - clamp((age - 0.1) / 0.12, 0, 1)));
    const a = clamp((2.5 - age) / 0.3, 0, 1);
    g.save();
    g.globalAlpha = a;
    g.translate(W / 2, 760);
    g.rotate(-0.05);
    g.scale(s, s);
    g.textAlign = 'center';
    g.font = fd(92);
    const [l1, ...rest] = st.text.split(' ');
    stroked(g, l1, 0, -60, team.light, '#140a04', 14);
    stroked(g, rest.join(' '), 0, 40, '#ffffff', '#140a04', 14);
    g.restore();
  }

  logoSlam(g, W, age) {
    if (age > 1.9) return;
    const inS = easeOutBack(clamp(age / 0.35, 0, 1));
    const fly = easeInOut(clamp((age - 1.2) / 0.5, 0, 1));
    const size = 210 * (1 - fly) + 24 * fly;
    const y = 760 * (1 - fly) + 180 * fly;
    g.save();
    g.globalAlpha = clamp(age / 0.1, 0, 1) * (1 - clamp((age - 1.6) / 0.3, 0, 1));
    g.translate(W / 2, y);
    const sc = (1.6 - 0.6 * inS) * (size / 210);
    g.scale(sc, sc);
    g.textAlign = 'center';
    g.font = fd(210);
    const tg = g.createLinearGradient(0, -100, 0, 90);
    tg.addColorStop(0, '#fff4c2');
    tg.addColorStop(0.55, '#ffc23a');
    tg.addColorStop(1, '#e06d10');
    stroked(g, this.cfg.title, 0, 0, tg, '#1a0c02', 22);
    g.restore();
  }

  caption(g, W, H, t, ck) {
    const c = this.b.captions[this.b.captions.length - 1];
    if (!c || this.b.banners.length || ck - this.lastBannerEnd < 1.2) return;
    const age = t - c.t0;
    const a = Math.min(smooth(age / 0.3), smooth((c.dur - age) / 0.4)) * (this.b.banners.length ? 0 : 1);
    if (a <= 0) return;
    g.save();
    g.globalAlpha = a;
    g.font = fu(700, 34);
    const parts = c.text.split(/(=|→)/);
    const w = Math.min(W - 60, g.measureText(c.text).width + 64);
    const y = H - 210 + (1 - a) * 16;
    g.fillStyle = 'rgba(10,7,22,0.82)';
    rr(g, (W - w) / 2, y - 36, w, 72, 36);
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = '#f5c451';
    g.stroke();
    let x = (W - g.measureText(c.text).width) / 2;
    g.textAlign = 'left';
    let hot = false;
    for (const p of parts) {
      if (p === '=' || p === '→') hot = true;
      g.fillStyle = hot && p !== '=' && p !== '→' ? '#ffd24a' : '#ffffff';
      g.fillText(p, x, y + 1);
      x += g.measureText(p).width;
    }
    g.restore();
  }

  victory(g, W, H, p) {
    const a = smooth(p / 0.5);
    const b = this.b;
    const team = b.teams[b.victory.team];
    g.save();
    g.globalAlpha = a;
    const bg = g.createRadialGradient(W / 2, 820, 80, W / 2, 900, 1000);
    bg.addColorStop(0, 'rgba(6,4,14,0.35)');
    bg.addColorStop(1, 'rgba(6,4,14,0.8)');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.translate(W / 2, 600);
    g.rotate((p * 6 * Math.PI) / 180);
    for (let i = 0; i < 18; i++) {
      g.rotate(Math.PI / 9);
      const rg = g.createLinearGradient(0, 0, 1100, 0);
      rg.addColorStop(0, 'rgba(255,214,130,0.14)');
      rg.addColorStop(1, 'rgba(255,214,130,0)');
      g.fillStyle = rg;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(1100, -70);
      g.lineTo(1100, 70);
      g.fill();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    // Confetti burst in the winner's colours.
    const cr = mulberry32(77);
    for (let i = 0; i < 120; i++) {
      const x0 = W / 2 + (cr() - 0.5) * 300, vx = (cr() - 0.5) * 1100, vy = -500 - cr() * 900;
      const tt = Math.min(p, 4);
      const x = x0 + vx * tt * Math.exp(-tt * 0.6), y = 640 + vy * tt + 520 * tt * tt;
      if (y > H + 20) continue;
      g.save();
      g.globalAlpha = a * clamp(1 - (p - 3) / 1, 0, 1);
      g.translate(x, y);
      g.rotate(cr() * 6 + p * (cr() * 10 - 5));
      g.fillStyle = [team.color, team.light, '#f5c451', '#ffffff'][i % 4];
      g.fillRect(-7, -4, 14, 8);
      g.restore();
    }
    g.globalAlpha = a;
    const s = easeOutBack(clamp(p / 0.45, 0, 1));
    g.save();
    g.translate(W / 2, 600);
    g.scale(s, s);
    g.textAlign = 'center';
    g.font = fd(164);
    const vg = g.createLinearGradient(0, -80, 0, 70);
    vg.addColorStop(0, '#fffbe0');
    vg.addColorStop(0.5, '#ffd24a');
    vg.addColorStop(1, '#e07b10');
    stroked(g, 'VICTORY', 0, 0, vg, '#1b0a02', 18);
    g.restore();
    flag(g, team.flag, W / 2 - 60, 700, 120, 80, 6, b.time);
    g.textAlign = 'center';
    g.font = fd(68);
    stroked(g, `${team.name} WINS`, W / 2, 846, '#ffffff', '#1a0f08', 10);
    g.font = fu(800, 26);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillText('MOST VALUABLE GIFTERS', W / 2, 926);
    const mvps = [...b.points.entries()].filter(([u]) => b.users.get(u) === b.victory.team).sort((x, y) => y[1] - x[1]).slice(0, 5);
    const disc = ['#f5c451', '#d7dbe3', '#d08a4f', '#7c6fa8', '#7c6fa8'];
    mvps.forEach(([u, pts], k) => {
      const y = 990 + k * 92;
      const rp = easeOutCubic(clamp((p - 0.35 - k * 0.09) / 0.35, 0, 1));
      const count = Math.round(pts * easeOutCubic(clamp((p - 0.35 - k * 0.09) / 0.8, 0, 1)));
      g.save();
      g.globalAlpha = a * rp;
      g.translate((1 - rp) * 90, 0);
      g.fillStyle = k === 0 ? 'rgba(110,72,6,0.94)' : 'rgba(18,12,34,0.9)';
      rr(g, W / 2 - 340, y - 40, 680, 80, 40);
      g.fill();
      if (k === 0) {
        g.save();
        rr(g, W / 2 - 340, y - 40, 680, 80, 40);
        g.clip();
        const sx = ((p % 1.5) / 1.5) * 1000 - 200;
        const sg = g.createLinearGradient(W / 2 - 340 + sx - 80, 0, W / 2 - 340 + sx + 80, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)');
        sg.addColorStop(0.5, 'rgba(255,240,190,0.35)');
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = sg;
        g.fillRect(W / 2 - 340, y - 40, 680, 80);
        g.restore();
      }
      g.strokeStyle = k === 0 ? '#f5c451' : rgba(team.color, 0.75);
      g.lineWidth = 3;
      rr(g, W / 2 - 340, y - 40, 680, 80, 40);
      g.stroke();
      g.fillStyle = disc[k];
      g.beginPath();
      g.arc(W / 2 - 296, y, 24, 0, Math.PI * 2);
      g.fill();
      g.font = fd(28);
      g.textAlign = 'center';
      stroked(g, String(k + 1), W / 2 - 296, y + 1, '#1a0f08', '', 0);
      g.fillStyle = team.color;
      g.beginPath();
      g.arc(W / 2 - 228, y, 30, 0, Math.PI * 2);
      g.fill();
      g.font = fd(30);
      stroked(g, u[0].toUpperCase(), W / 2 - 228, y + 1, '#ffffff', 'rgba(0,0,0,0.4)', 4);
      g.textAlign = 'left';
      g.font = fu(800, 34);
      g.fillStyle = '#ffffff';
      g.fillText(fit(g, u, 300), W / 2 - 184, y + 1);
      g.textAlign = 'right';
      g.fillStyle = '#ffd56a';
      g.fillText(nf.format(count), W / 2 + 310, y + 1);
      g.restore();
    });
    g.restore();
  }

  endcard(g, W, H, age) {
    const a = smooth(age / 0.6);
    g.save();
    g.globalAlpha = a;
    const bgIm = this.icons.background, dr = this.icons.dragon_orange;
    g.fillStyle = '#07040e';
    g.fillRect(0, 0, W, H);
    if (bgIm) {
      g.filter = 'blur(12px) brightness(0.35)';
      g.drawImage(bgIm, -40, -40, W + 80, H + 80);
      g.filter = 'none';
    }
    if (dr) {
      g.filter = 'brightness(0.55) saturate(1.1)';
      const dw = 980, dh = (dr.height / dr.width) * dw;
      g.drawImage(dr, (W - dw) / 2, 560 - dh / 2 - 40 * (1 - a), dw, dh);
      g.filter = 'none';
    }
    const s = 0.85 + 0.15 * easeOutBack(clamp((age - 0.15) / 0.4, 0, 1));
    g.save();
    g.translate(W / 2, H / 2 + 20);
    g.scale(s, s);
    g.textAlign = 'center';
    g.font = fd(150);
    const tg = g.createLinearGradient(0, -80, 0, 70);
    tg.addColorStop(0, '#fff4c2');
    tg.addColorStop(0.55, '#ffc23a');
    tg.addColorStop(1, '#e06d10');
    stroked(g, this.cfg.title, 0, 0, tg, '#1a0c02', 18);
    g.restore();
    g.textAlign = 'center';
    g.font = fu(700, 38);
    g.fillStyle = '#ffffff';
    g.fillText('Gifts become armies on TikTok LIVE', W / 2, H / 2 + 140);
    g.font = fu(600, 30);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillText('github.com/erikcik/live-gift-arena', W / 2, H / 2 + 200);
    g.restore();
  }
}
