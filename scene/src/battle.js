import { Container, Sprite, Graphics, Texture, Rectangle } from 'pixi.js';
import { Particles } from './fx.js';
import { mulberry32, clamp, lerp, hex, lower, easeInOut, easeOutCubic, easeOutBack, noise1 } from './util.js';

export const W = 1080, H = 1920;
export const ROWS = [1112, 1208, 1300];
const CASTLE_X = [60, 1020];
const CASTLE_BASE = 1150;
const CASTLE_SCALE = 0.6;
const FRONT = [222, 858];
const SPAWN_X = [196, 884];
const MAX_PER_TEAM = 14;
const MAJOR_GAP = 0.7;

export const depth = (y) => lerp(0.88, 1.12, (y - ROWS[0]) / (ROWS[2] - ROWS[0]));

/**
 * The war. All state changes come in through handle(event), so live TikTok events,
 * the simulator and the scripted demo all drive exactly the same code.
 * Big moments (dragons, ultimates, meteor storms) go through a director that plays one at a time.
 */
export class Battle {
  constructor({ tex, fxTex, cfg, seed = 5 }) {
    this.tex = tex;
    this.cfg = cfg;
    this.rng = mulberry32(seed);
    this.time = 0;
    this.clock = 0;
    this.cam = { z: 1, fx: W / 2, fy: H * 0.6, sx: W / 2, sy: H * 0.6 };
    this.killShot = null;
    this.stamp = null;
    this.logo = null;
    this.whiteFlash = 0;
    this.lastGift = new Map();
    this.root = new Container();
    this.world = new Container();
    this.root.addChild(this.world);
    this.T = fxTex;
    this.fx = new Particles(fxTex, seed + 1);

    this.bg = new Sprite(tex.background);
    this.sun = new Sprite(fxTex.glow);
    this.sun.anchor.set(0.5);
    this.sun.position.set(215, 600);
    this.sun.blendMode = 'add';
    this.sun.tint = 0xffb46a;
    this.dim = new Graphics().rect(0, 0, W, H).fill({ color: 0x07040e });
    this.dim.alpha = 0;
    this.layers = {
      decals: new Container(), castles: new Container(), shadows: new Container(), units: new Container(),
      heroes: new Container(), fxN: this.fx.normal, fxA: this.fx.add, sky: new Container(),
    };
    this.layers.units.sortableChildren = true;
    this.layers.heroes.sortableChildren = true;
    this.world.addChild(this.bg, this.sun, this.layers.decals, this.layers.castles, this.layers.shadows, this.layers.units,
      this.dim, this.layers.heroes, this.layers.fxN, this.layers.fxA, this.layers.sky);

    this.teams = cfg.teams.map((t, i) => ({
      ...t, i, dir: i === 0 ? 1 : -1, col: hex(t.color), lightN: hex(t.light),
      coins: 0, goal: 0, charges: 0, likeBank: 0, members: 0,
      hp: cfg.castleHp, maxHp: cfg.castleHp, hitT: -9, cracks: 0,
    }));
    this.teams.forEach((t, i) => {
      const s = new Sprite(tex[t.art.castle]);
      s.anchor.set(0.5, 1);
      s.scale.set(CASTLE_SCALE);
      s.position.set(CASTLE_X[i], CASTLE_BASE);
      this.layers.castles.addChild(s);
      t.castle = s;
      t.crackG = new Graphics();
      this.layers.castles.addChild(t.crackG);
      const sh = new Sprite(fxTex.shadow);
      sh.anchor.set(0.5);
      sh.position.set(CASTLE_X[i], CASTLE_BASE - 4);
      sh.scale.set(3.6, 1.6);
      sh.alpha = 0.55;
      this.layers.decals.addChild(sh);
    });

    this.units = [];
    this.projectiles = [];
    this.flyers = [];
    this.queue = [];
    this.majors = [];
    this.major = null;
    this.busyUntil = 0;
    this.users = new Map();
    this.points = new Map();
    this.damageNums = [];
    this.feed = [];
    this.banners = [];
    this.captions = [];
    this.shockwaves = [];
    this.pieces = [];
    this.trauma = 0;
    this.flash = 0;
    this.victory = null;
    this.endcard = null;
    this.log = { sfx: [], intensity: [], majors: [] };
    this.lastSfx = {};
    this.id = 0;
  }

  r(a = 0, b = 1) { return a + (b - a) * this.rng(); }

  sfx(type, gap = 0) {
    if (gap && this.time - (this.lastSfx[type] ?? -9) < gap) return;
    this.lastSfx[type] = this.time;
    this.log.sfx.push({ t: +this.clock.toFixed(3), type });
  }

  shake(amount) { this.trauma = Math.min(1, this.trauma + amount); }

  majorK() {
    const m = this.major;
    if (!m) return 0;
    const a = (this.time - m.t0) / 0.35, b = (m.t1 - this.time) / 0.5;
    return clamp(Math.min(a, b), 0, 1);
  }

  // ---------------- events ----------------

  handle(ev) {
    switch (ev.type) {
      case 'chat': return this.chat(ev);
      case 'gift': return this.gift(ev);
      case 'like': return this.like(ev);
      case 'caption': this.captions.push({ t0: this.time, text: ev.text, dur: ev.dur ?? 4.5 }); return;
      case 'banner': this.banners.push({ t0: this.time, name: ev.title, line: ev.sub || '', team: ev.team ?? -1, dur: ev.dur ?? 2.4 }); this.sfx('banner'); return;
      case 'endcard': this.endcard = { t0: this.time, c0: this.clock }; this.sfx('endcard'); return;
      case 'logo': this.logo = { c0: this.clock }; this.sfx('banner'); return;
      case 'prewarm': {
        ev.users.forEach(([u, ti], k) => {
          this.teamOf(u, ti);
          const unit = this.spawnUnit(ev.kind?.[k] ?? 'recruit', ti, u);
          unit.x = ti === 0 ? lerp(300, 470, (k % 5) / 4) : lerp(780, 610, (k % 5) / 4);
          unit.state = 'walk';
        });
        return;
      }
      default:
    }
  }

  teamOf(user, hint) {
    if (this.users.has(user)) return this.users.get(user);
    const ti = hint ?? (this.teams[0].members <= this.teams[1].members ? 0 : 1);
    this.users.set(user, ti);
    this.teams[ti].members++;
    return ti;
  }

  addFeed(user, team, emoji, unit, n) {
    const last = this.feed[this.feed.length - 1];
    if (last && last.user === user && last.unit === unit && this.time - last.t1 < 3) {
      last.n += n;
      last.t1 = this.time;
      last.bump = this.time;
      return;
    }
    this.feed.push({ t0: this.time, t1: this.time, bump: -9, user, team, emoji, unit, n });
  }

  chat(ev) {
    const text = lower(ev.text).trim();
    const ti = this.teams.findIndex((t) => t.join.some((k) => text === k || text.startsWith(k + ' ')));
    if (ti < 0 || this.users.has(ev.user)) return;
    this.teamOf(ev.user, ti);
    this.addFeed(ev.user, ti, '⚑', 'joined', 1);
    this.queue.push({ at: this.time, kind: 'recruit', team: ti, owner: ev.user });
    this.sfx('join', 0.08);
  }

  gift(ev) {
    const def = this.cfg.gifts[ev.gift];
    const coins = def ? def.coins : ev.coins ?? 1;
    const action = def?.action ?? this.cfg.fallback.find((f) => coins >= f.minCoins).action;
    const count = Math.max(1, ev.count || 1);
    const ti = this.teamOf(ev.user, ev.team);
    const team = this.teams[ti];
    const total = coins * count;
    team.coins += total;
    this.points.set(ev.user, (this.points.get(ev.user) || 0) + total);
    this.lastGift.set(ev.user, this.time);
    this.addFeed(ev.user, ti, def?.emoji ?? '🎁', action, count);

    if (['warrior', 'archer', 'knight'].includes(action)) {
      for (let k = 0; k < Math.min(count, 5); k++) this.queue.push({ at: this.time + k * 0.2, kind: action, team: ti, owner: ev.user });
    } else if (action === 'catapult') {
      this.catapult(ti, ev.user, 6 + Math.min(6, (count - 1) * 2));
    } else if (action === 'dragon') {
      for (let k = 0; k < Math.min(count, 2); k++) this.majors.push({ kind: 'dragon', team: ti, owner: ev.user });
    } else if (action === 'meteor') {
      this.majors.push({ kind: 'meteor', team: ti, owner: ev.user, scale: coins >= 40000 ? 1.35 : 1.0 });
    }
    // The gift goal fills; overflow banks a second charge at most.
    team.goal += total;
    while (team.goal >= team.ultimate.goal) {
      team.goal -= team.ultimate.goal;
      if (team.charges < 2) {
        team.charges++;
        this.majors.push({ kind: team.ultimate.kind, team: ti, owner: null, charge: true });
      }
    }
    if (team.charges >= 2) team.goal = Math.min(team.goal, team.ultimate.goal - 1);
  }

  like(ev) {
    const ti = this.teamOf(ev.user, ev.team);
    const team = this.teams[ti];
    team.likeBank += ev.count || 1;
    while (team.likeBank >= this.cfg.likesPerVolley) {
      team.likeBank -= this.cfg.likesPerVolley;
      this.volley(ti, 9);
    }
  }

  // ---------------- director ----------------

  startMajor(m) {
    const team = this.teams[m.team];
    const dur = { dragon: 4.8, eagles: 4.4, elephants: 4.0, meteor: 4.2 }[m.kind];
    this.major = { ...m, t0: this.time, t1: this.time + dur };
    this.busyUntil = this.time + dur + MAJOR_GAP;
    this.log.majors.push({ t: +this.time.toFixed(2), kind: m.kind, team: m.team });
    const line = { dragon: 'summoned a DRAGON', meteor: 'called a METEOR STORM', eagles: 'EAGLE STRIKE', elephants: 'ELEPHANT STAMPEDE' }[m.kind];
    const icon = { dragon: '💫', meteor: '🪐', eagles: '⚡', elephants: '⚡' }[m.kind];
    this.banners.push({ t0: this.time, name: m.owner ?? team.name, line, team: m.team, dur: m.kind === 'dragon' ? 1.9 : 2.6, icon, ult: !m.owner });
    this.sfx(m.owner ? 'banner' : 'horn');
    if (m.charge) { team.charges = Math.max(0, team.charges - 1); team.drainT = this.time; }
    if (m.kind === 'dragon') this.flyer('dragon', m.team, m.owner);
    else if (m.kind === 'meteor') this.meteorStorm(m.team, m.owner, m.scale);
    else if (m.kind === 'eagles') for (let k = 0; k < 3; k++) this.queue.push({ at: this.time + 0.3 + k * 0.55, kind: 'eagle', team: m.team, idx: k });
    else if (m.kind === 'elephants') {
      for (let k = 0; k < 5; k++) this.queue.push({ at: this.time + 0.25 + k * 0.1, kind: 'elephant', team: m.team, lane: [ROWS[0], ROWS[2], ROWS[1], ROWS[0] + 40, ROWS[2] - 30][k] });
    }
  }

  // ---------------- units ----------------

  rowFor(ti, x) {
    const counts = ROWS.map((y) => this.units.filter((u) => u.team === ti && u.state !== 'dead' && Math.abs(u.x - x) < 140 && Math.abs(u.rowY - y) < 20).length);
    let best = 0;
    counts.forEach((c, i) => { if (c < counts[best] || (c === counts[best] && this.rng() < 0.4)) best = i; });
    return ROWS[best];
  }

  spawnUnit(kind, ti, owner) {
    const team = this.teams[ti];
    const alive = this.units.filter((u) => u.team === ti && u.state !== 'dead');
    if (alive.length >= MAX_PER_TEAM) {
      const old = alive.find((u) => u.kind === 'recruit') || alive[0];
      this.kill(old, null);
    }
    const stats = this.cfg.units[kind];
    const art = kind === 'recruit' ? team.art.warrior : team.art[kind];
    const sp = new Sprite(this.tex[art]);
    sp.anchor.set(0.5, 0.97);
    const x = SPAWN_X[ti] + team.dir * this.r(-4, 14);
    const rowY = this.rowFor(ti, x);
    const shadow = new Sprite(this.T.shadow);
    shadow.anchor.set(0.5);
    this.layers.units.addChild(sp);
    this.layers.shadows.addChild(shadow);
    const u = {
      id: ++this.id, kind, team: ti, owner, sp, shadow, stats, x, rowY, y: rowY + this.r(-8, 8),
      hp: stats.hp, maxHp: stats.hp, state: 'spawn', t0: this.time, cd: this.r(0.1, 0.5),
      phase: this.r(0, 6.28), lunge: 0, hitT: -9, deadT: 0, speedMul: this.r(0.92, 1.08), jitter: this.r(0.96, 1.04),
      baseScale: stats.height / sp.texture.height,
    };
    this.units.push(u);
    this.fx.summon(u.x, u.y, team.lightN);
    this.sfx('spawn', 0.05);
    return u;
  }

  kill(u, killer) {
    if (u.state === 'dead') return;
    u.state = 'dead';
    u.deadT = this.time;
    const dir = killer ? this.teams[killer.team].dir : -this.teams[u.team].dir;
    if (killer && (killer.kind === 'elephant' || killer.kind === 'meteor' || killer.kind === 'eagle')) {
      u.fly = { vx: dir * this.r(260, 460), vy: -this.r(520, 820), spin: dir * this.r(6, 11) };
    }
    u.knock = dir * this.r(70, 140);
    this.fx.poof(u.x, u.y - 20, 0xd8cbb8, 10);
    this.sfx('die', 0.05);
  }

  damage(u, amount, src) {
    if (u.state === 'dead') return;
    const crit = this.rng() < 0.1;
    const dmg = Math.round(amount * (crit ? 1.8 : this.r(0.85, 1.15)));
    u.hp -= dmg;
    u.hitT = this.time;
    if (crit && amount >= 14) this.damageNums.push({ t0: this.time, x: clamp(u.x, 70, W - 70), y: u.y - u.stats.height * depth(u.y) * 0.8, v: `${dmg}!`, kind: 'crit', team: u.team });
    if (u.hp <= 0) this.kill(u, src);
  }

  damageCastle(ti, amount, big = false) {
    const t = this.teams[ti];
    if (t.hp <= 0) return;
    const before = t.hp;
    t.hp = Math.max(0, t.hp - amount);
    t.hitT = this.time;
    if (big) {
      const pct = Math.max(1, Math.round(((before - t.hp) / t.maxHp) * 100));
      this.damageNums.push({ t0: this.time, x: clamp(CASTLE_X[ti] + (ti ? -60 : 60), 120, W - 120), y: CASTLE_BASE - 330, v: `-${pct}%`, kind: 'castle', team: ti });
    }
    const frac = t.hp / t.maxHp;
    if (frac <= 0.66 && t.cracks < 1) this.crack(t, 1);
    if (frac <= 0.33 && t.cracks < 2) this.crack(t, 2);
    if (t.hp <= 0 && !this.victory) this.win(1 - ti);
  }

  crack(t, level) {
    t.cracks = level;
    const g = t.crackG;
    const cx = CASTLE_X[t.i];
    for (let k = 0; k < 3 * level; k++) {
      let x = cx + this.r(-90, 90), y = CASTLE_BASE - this.r(90, 330);
      g.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += this.r(-16, 16);
        y += this.r(8, 22);
        g.lineTo(x, y);
      }
    }
    g.stroke({ width: 3, color: 0x1e140c, alpha: 0.75 });
    this.sfx('crack');
  }

  areaDamage(x, y, radius, amount, enemyTeam, src, castleAmount = 0, big = false) {
    for (const u of this.units) {
      if (u.team !== enemyTeam || u.state === 'dead') continue;
      const d = Math.hypot(u.x - x, (u.y - y) * 1.5);
      if (d < radius) this.damage(u, amount * (1 - (d / radius) * 0.5), src);
    }
    if (castleAmount && Math.abs(x - CASTLE_X[enemyTeam]) < 230) this.damageCastle(enemyTeam, castleAmount, big);
  }

  // ---------------- specials ----------------

  addShockwave(x, y, amp = 30, wave = 160) {
    this.shockwaves.push({ x, y, t0: this.time, amp, wave });
  }

  boom(x, y, power, enemyTeam, src, dmg, radius, castleDmg = 0) {
    this.fx.explosion(x, y, power);
    if (power >= 1.1) this.addShockwave(x, y - 30, 22 * power, 130 * power);
    this.shake(0.18 * power);
    this.flash = Math.max(this.flash, 0.06 * power);
    const sc = new Sprite(this.T.scorch);
    sc.anchor.set(0.5);
    sc.position.set(x, y + 8);
    sc.scale.set(0.9 * power);
    sc.alpha = 0.85;
    sc.born = this.time;
    this.layers.decals.addChild(sc);
    this.areaDamage(x, y, radius, dmg, enemyTeam, src, castleDmg, castleDmg >= 250);
    this.sfx(power > 1.3 ? 'boomBig' : 'boom', 0.06);
  }

  frontX(ti) {
    const enemies = this.units.filter((u) => u.team !== ti && u.state !== 'dead');
    const dir = this.teams[ti].dir;
    if (!enemies.length) return FRONT[1 - ti] - dir * 60;
    return enemies.reduce((best, u) => (dir > 0 ? Math.min(best, u.x) : Math.max(best, u.x)), dir > 0 ? 9999 : -9999);
  }

  catapult(ti, owner, n) {
    const fx = this.frontX(ti);
    const dir = this.teams[ti].dir;
    for (let k = 0; k < n; k++) {
      const tx = clamp(fx + dir * this.r(-10, 170), 200, 880);
      this.projectiles.push({ kind: 'fireball', team: ti, owner, t0: this.time + k * 0.16, dur: 1.1, x0: CASTLE_X[ti] + dir * 60, y0: 900, x1: tx, y1: ROWS[Math.floor(this.r(0, 3))] + this.r(-10, 10), h: 380 });
    }
    this.sfx('catapult');
  }

  volley(ti, n) {
    const fx = this.frontX(ti);
    const dir = this.teams[ti].dir;
    for (let k = 0; k < n; k++) {
      const x0 = FRONT[ti] + dir * this.r(-30, 70);
      this.projectiles.push({ kind: 'arrow', team: ti, t0: this.time + k * 0.05, dur: 0.95, x0, y0: this.r(1040, 1110), x1: clamp(fx + dir * this.r(-30, 120), 190, 890), y1: ROWS[Math.floor(this.r(0, 3))] + this.r(-12, 12), h: 280, dmg: 26 });
    }
    this.sfx('volley', 0.2);
  }

  meteorStorm(ti, owner, scale) {
    const enemy = 1 - ti;
    const dir = this.teams[ti].dir;
    const n = Math.round(16 * scale);
    for (let k = 0; k < n; k++) {
      const last = k === n - 1;
      const tx = last ? CASTLE_X[enemy] + dir * 10 : clamp(lerp(560, CASTLE_X[enemy], this.r(0.1, 1.0)), 120, 960);
      const ty = last ? CASTLE_BASE - 60 : ROWS[Math.floor(this.r(0, 3))] + this.r(-14, 14);
      const size = last ? 2.6 : this.r(1.1, 1.8);
      this.projectiles.push({ kind: 'meteor', team: ti, owner, t0: this.time + 0.35 + k * (3.0 / n) + (last ? 0.45 : 0), dur: last ? 1.0 : 0.75, x0: tx - dir * 520, y0: 580, x1: tx, y1: ty, size, last });
    }
    this.sfx('meteorStart');
  }

  flyer(kind, ti, owner, extra = {}) {
    const team = this.teams[ti];
    const texName = kind === 'dragon' ? team.art.dragon : kind === 'eagle' ? 'eagle_blue' : 'elephant_orange';
    const sp = new Sprite(this.tex[texName]);
    sp.anchor.set(0.5, kind === 'elephant' ? 0.95 : 0.5);
    (kind === 'elephant' ? this.layers.heroes : this.layers.sky).addChild(sp);
    const f = { kind, team: ti, owner, sp, t0: this.time, ...extra, hits: new Set() };
    f.shadow = new Sprite(this.T.shadow);
    f.shadow.anchor.set(0.5);
    this.layers.shadows.addChild(f.shadow);
    if (kind === 'elephant') {
      f.x = team.dir > 0 ? -140 : W + 140;
      this.sfx('elephant', 0.6);
    }
    if (kind === 'dragon') this.sfx('dragon');
    if (kind === 'eagle') this.sfx('eagle', 0.3);
    this.flyers.push(f);
  }

  win(ti) {
    this.victory = { team: ti, t0: this.time, c0: this.clock };
    this.killShot = { c0: this.clock, loser: 1 - ti };
    this.stamp = { c0: this.clock, text: `${this.teams[1 - ti].name} CASTLE DESTROYED`, team: 1 - ti };
    this.whiteFlash = 0.6;
    this.majors = [];
    const loser = this.teams[1 - ti];
    loser.collapseT = this.time;
    this.collapse(loser);
    this.sfx('collapse');
    this.shake(1);
    for (let k = 0; k < 5; k++) this.queue.push({ at: this.time + 0.15 + k * 0.28, kind: 'castleBoom', team: 1 - ti });
    this.queue.push({ at: this.time + 1.2, kind: 'victory', team: ti });
  }

  /** Slice the castle into pieces that fall; the bottom quarter stays as a smoking rubble mound. */
  collapse(team) {
    const s = team.castle;
    const tex = s.texture;
    const tw = tex.width, th = tex.height;
    const cols = 4, rows = 4;
    s.visible = false;
    team.crackG.visible = false;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const fw = tw / cols, fh = th / rows;
      const piece = new Sprite(new Texture({ source: tex.source, frame: new Rectangle(c * fw, r * fh, fw, fh) }));
      piece.anchor.set(0.5);
      piece.scale.set(CASTLE_SCALE);
      const px = s.x + (c * fw + fw / 2 - tw / 2) * CASTLE_SCALE;
      const py = s.y - (th - (r * fh + fh / 2)) * CASTLE_SCALE;
      piece.position.set(px, py);
      this.layers.castles.addChild(piece);
      const rubble = r === rows - 1;
      if (rubble) piece.tint = 0x8a7a6a;
      this.pieces.push({ sp: piece, x: px, y: py, vx: rubble ? 0 : this.r(-160, 160), vy: rubble ? 0 : -this.r(0, 260), spin: rubble ? 0 : this.r(-3, 3), delay: rubble ? 99 : (rows - r) * 0.12 + this.r(0, 0.15), rubble, ground: CASTLE_BASE + this.r(-10, 20) });
    }
    for (let k = 0; k < 40; k++) {
      this.fx.spawn({ tex: 'smoke', x: s.x + this.r(-170, 170), y: CASTLE_BASE - this.r(0, 120), vx: this.r(-80, 80), vy: -this.r(20, 120), size: this.r(0.8, 1.3), size1: this.r(1.8, 2.6), life: this.r(1.6, 2.4), drag: 0.9, color: [0xe8d5b0, 0xc9ae86, 0x8a6e4e][k % 3], alpha: 0.55, fadeIn: 0.15 });
    }
  }

  // ---------------- simulation ----------------

  step(realDt) {
    this.clock += realDt;
    const ks = this.killShot;
    const slow = ks && this.clock > ks.c0 + 0.05 && this.clock < ks.c0 + 1.05;
    const dt = realDt * (slow ? 0.35 : 1);
    this.time += dt;
    const t = this.time;
    this.whiteFlash = Math.max(0, this.whiteFlash - realDt * 7);
    // Camera: default framing, or the directed castle-kill shot.
    const c = this.cam;
    let tgt = { z: 1, fx: W / 2, fy: H * 0.6, sx: W / 2, sy: H * 0.6 };
    if (ks && this.clock < ks.c0 + 2.3) tgt = { z: 1.35, fx: CASTLE_X[ks.loser], fy: CASTLE_BASE - 150, sx: ks.loser === 0 ? 330 : 750, sy: 1010 };
    const k = 1 - Math.exp(-realDt * (ks && this.clock < ks.c0 + 2.3 ? 6.5 : 3.8));
    for (const key of ['z', 'fx', 'fy', 'sx', 'sy']) c[key] += (tgt[key] - c[key]) * k;

    if (!this.victory && t >= this.busyUntil && this.majors.length) this.startMajor(this.majors.shift());
    if (this.major && t >= this.major.t1) this.major = null;
    this.dim.alpha = 0.1 * this.majorK();

    const due = this.queue.filter((q) => q.at <= t);
    this.queue = this.queue.filter((q) => q.at > t);
    for (const q of due) {
      if (['recruit', 'warrior', 'archer', 'knight'].includes(q.kind)) { if (!this.victory) this.spawnUnit(q.kind, q.team, q.owner); }
      else if (q.kind === 'eagle') { if (!this.victory) this.flyer('eagle', q.team, null, { idx: q.idx }); }
      else if (q.kind === 'elephant') { if (!this.victory) this.flyer('elephant', q.team, null, { lane: q.lane }); }
      else if (q.kind === 'castleBoom') {
        const x = CASTLE_X[q.team] + this.r(-110, 110), y = CASTLE_BASE - this.r(20, 260);
        this.fx.explosion(x, y, 1.3);
        this.shake(0.3);
        this.sfx('boomBig', 0.05);
      } else if (q.kind === 'victory') {
        this.sfx('victory');
        for (const u of this.units) if (u.team !== q.team && u.state !== 'dead') this.kill(u, null);
      }
    }

    // Units: walk, keep formation, fight, siege.
    const alive = this.units.filter((u) => u.state !== 'dead');
    for (const u of alive) {
      const team = this.teams[u.team];
      const dir = team.dir;
      u.y += (u.rowY - u.y) * Math.min(1, dt * 3);
      if (u.state === 'spawn') {
        if (t - u.t0 > 0.4) u.state = 'walk';
        continue;
      }
      if (this.victory) { if (this.victory.team === u.team) u.state = 'cheer'; continue; }
      let target = null, best = 1e9;
      for (const e of alive) {
        if (e.team === u.team || e.state === 'spawn') continue;
        const gap = (e.x - u.x) * dir;
        if (gap < -30) continue;
        const d = Math.abs(gap) + Math.abs(e.y - u.y) * 0.4;
        if (d < best) { best = d; target = e; }
      }
      const reach = u.stats.range + (u.kind === 'knight' ? 46 : 24);
      const castleGap = (FRONT[1 - u.team] - u.x) * dir;
      u.lunge = Math.max(0, u.lunge - dt * 5);
      if (target && Math.abs(target.x - u.x) <= reach) {
        u.state = 'fight';
        u.cd -= dt;
        if (u.cd <= 0) { u.cd = u.stats.cooldown * this.r(0.85, 1.15); this.attack(u, target); }
      } else if (castleGap <= u.stats.range) {
        u.state = 'siege';
        u.cd -= dt;
        if (u.cd <= 0) {
          u.cd = u.stats.cooldown;
          u.lunge = 1;
          if (u.kind === 'archer') this.shoot(u, null);
          else {
            this.damageCastle(1 - u.team, u.stats.dmg * 1.5);
            this.fx.hit(FRONT[1 - u.team] - dir * 10, u.y - 80, 0xffcf8a);
            this.sfx('castleHit', 0.1);
          }
        }
      } else {
        // A friend standing still just ahead in the same row: step into a freer row, or wait.
        const blocked = (y) => alive.some((f) => f !== u && f.team === u.team && f.state !== 'walk' && Math.abs(f.rowY - y) < 20 && (f.x - u.x) * dir > 0 && (f.x - u.x) * dir < 64);
        u.state = 'walk';
        if (blocked(u.rowY)) {
          const alt = ROWS.find((y) => Math.abs(y - u.rowY) > 20 && !blocked(y));
          if (alt === undefined) continue;
          u.rowY = alt;
        }
        u.x += dir * u.stats.speed * u.speedMul * dt;
      }
    }

    for (const u of this.units) {
      if (u.state !== 'dead') continue;
      const age = t - u.deadT;
      if (u.fly) {
        u.x += u.fly.vx * dt;
        u.y += u.fly.vy * dt;
        u.fly.vy += 1700 * dt;
      } else u.x += u.knock * dt * Math.max(0, 1 - age * 2);
      if (age >= 1.2 && !u.gone) {
        u.gone = true;
        u.sp.destroy();
        u.shadow.destroy();
      }
    }
    this.units = this.units.filter((u) => !u.gone);

    this.stepProjectiles();
    this.stepFlyers(dt);

    for (const p of this.pieces) {
      p.delay -= dt;
      if (p.delay > 0 || p.rubble) continue;
      p.vy += 1500 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.sp.rotation += p.spin * dt;
      if (p.y > p.ground) {
        p.y = p.ground;
        p.vy *= -0.18;
        p.vx *= 0.5;
        p.spin *= 0.5;
        p.sp.alpha = Math.max(0, p.sp.alpha - dt * 1.2);
      }
      p.sp.position.set(p.x, p.y);
    }

    for (const team of this.teams) {
      const frac = team.hp / team.maxHp;
      const cx = CASTLE_X[team.i];
      const smoky = frac <= 0.66 || team.collapseT;
      if (smoky && this.rng() < dt * (team.collapseT ? 14 : 8)) this.fx.spawn({ tex: 'smoke', x: cx + this.r(-70, 70), y: CASTLE_BASE - (team.collapseT ? this.r(0, 80) : this.r(200, 380)), vx: this.r(-8, 8), vy: -this.r(40, 80), size: this.r(0.4, 0.7), size1: this.r(1.4, 2.0), life: this.r(2.0, 3.0), color: team.collapseT ? 0xc9ae86 : 0x5a4e44, alpha: 0.45, drag: 0.3, fadeIn: 0.3 });
      if ((frac <= 0.33 && !team.collapseT) && this.rng() < dt * 18) this.fx.fire(cx + this.r(-80, 80), CASTLE_BASE - this.r(220, 360), 0, -80, 0.7);
    }

    if (this.rng() < dt * 5) this.fx.embers(this.r(80, 1000), this.r(1240, 1420), 1);

    this.fx.step(dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.5);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    for (const sc of this.layers.decals.children) if (sc.born !== undefined) sc.alpha = Math.max(0, 0.85 - (t - sc.born) / 6);
    this.damageNums = this.damageNums.filter((d) => t - d.t0 < (d.kind === 'castle' ? 1.4 : 0.8));
    this.feed = this.feed.filter((k) => t - k.t1 < 4.3);
    this.banners = this.banners.filter((b) => t - b.t0 < b.dur);
    this.captions = this.captions.filter((c) => t - c.t0 < c.dur);
    this.shockwaves = this.shockwaves.filter((s) => t - s.t0 < 1.0);
    if (Math.floor(this.clock * 4) !== Math.floor((this.clock - realDt) * 4)) {
      const n = this.units.filter((u) => u.state === 'fight').length;
      this.log.intensity.push({ t: +this.clock.toFixed(2), v: +clamp(n / 12 + this.majorK() * 0.6 + this.trauma * 0.5, 0, 1).toFixed(2) });
    }
  }

  attack(u, target) {
    u.lunge = 1;
    if (u.kind === 'archer') return this.shoot(u, target);
    this.damage(target, u.stats.dmg, u);
    const hx = (u.x + target.x) / 2, hy = target.y - target.stats.height * depth(target.y) * 0.55;
    this.fx.hit(hx, hy, this.teams[u.team].lightN);
    this.sfx('clash', 0.045);
  }

  shoot(u, target) {
    const dir = this.teams[u.team].dir;
    const x1 = target ? target.x : FRONT[1 - u.team] + dir * 10;
    const y1 = target ? target.y - 70 : u.y - 110;
    this.projectiles.push({ kind: 'arrow', team: u.team, src: u, target, t0: this.time, dur: clamp(Math.abs(x1 - u.x) / 900, 0.18, 0.6), x0: u.x + dir * 34, y0: u.y - 115, x1, y1, h: 40 + Math.abs(x1 - u.x) * 0.15, dmg: u.stats.dmg, siege: !target });
    this.sfx('bow', 0.06);
  }

  stepProjectiles() {
    const t = this.time;
    const keep = [];
    for (const p of this.projectiles) {
      if (t < p.t0) { keep.push(p); continue; }
      const k = (t - p.t0) / p.dur;
      if (!p.sp) {
        if (p.kind === 'arrow') {
          p.sp = new Sprite(this.T.arrow);
          p.sp.anchor.set(0.7, 0.5);
          p.sp.scale.set(1.05);
        } else if (p.kind === 'meteor') {
          p.sp = new Sprite(this.T.rock);
          p.sp.anchor.set(0.5);
          p.sp.scale.set(p.size);
          this.sfx('meteorWhoosh', 0.12);
        } else {
          p.sp = new Sprite(this.T.core);
          p.sp.anchor.set(0.5);
          p.sp.blendMode = 'add';
          p.sp.tint = 0xff9a40;
          p.sp.scale.set(0.8);
        }
        this.layers.sky.addChild(p.sp);
      }
      if (k >= 1) {
        p.sp.destroy();
        const enemy = 1 - p.team;
        if (p.kind === 'arrow') {
          if (p.siege) this.damageCastle(enemy, p.dmg * 1.3);
          else if (p.target && p.target.state !== 'dead') this.damage(p.target, p.dmg, p.src);
          else if (!p.target) this.areaDamage(p.x1, p.y1, 36, p.dmg, enemy, null);
          this.fx.poof(p.x1, p.y1, 0xcbb9a0, 2);
        } else if (p.kind === 'fireball') {
          this.boom(p.x1, p.y1, 0.8, enemy, { owner: p.owner, team: p.team, kind: 'catapult' }, 90, 95, 120);
        } else if (p.kind === 'meteor') {
          const power = p.last ? 2.6 : 1.15 + (p.size - 1.1) * 0.5;
          this.boom(p.x1, p.y1, power, enemy, { owner: p.owner, team: p.team, kind: 'meteor' }, 170, 125, p.last ? 3200 : 0);
          if (p.last) { this.flash = 0.35; this.addShockwave(p.x1, p.y1 - 80, 60, 260); }
        }
        continue;
      }
      const e = p.kind === 'meteor' ? k * (0.6 + 0.4 * k) : k;
      const x = lerp(p.x0, p.x1, e);
      const y = lerp(p.y0, p.y1, e) - (p.h ? Math.sin(Math.PI * k) * p.h : 0);
      const prevX = p.px ?? x - (p.x1 - p.x0) * 0.01, prevY = p.py ?? y - (p.y1 - p.y0) * 0.01;
      p.sp.position.set(x, y);
      p.sp.rotation = Math.atan2(y - prevY, x - prevX);
      if (p.kind === 'meteor') p.sp.alpha = clamp(k / 0.12, 0, 1);
      p.px = x;
      p.py = y;
      if (p.kind === 'fireball') {
        this.fx.fire(x, y, 0, 0, 0.5);
        this.fx.spawn({ tex: 'smoke', x, y, size: 0.25, size1: 0.6, life: 0.6, color: 0x3a302a, alpha: 0.45 });
      } else if (p.kind === 'meteor') {
        const s = p.size;
        const ang = Math.atan2(y - prevY, x - prevX);
        for (let i = 0; i < 3; i++) {
          this.fx.spawn({ tex: 'spark', x: x - Math.cos(ang) * 20 * s, y: y - Math.sin(ang) * 20 * s, vx: -Math.cos(ang) * 60, vy: -Math.sin(ang) * 60, add: true, size: 0.75 * s, life: 0.28, color: [0xff8a1f, 0xffc060, 0xff5a14][i], alpha: 0.45, rot: ang, sx: 2.2 });
        }
        this.fx.fire(x, y, 0, 0, 0.6 * s);
        this.fx.spawn({ tex: 'smoke', x, y, size: 0.4 * s, size1: 1.1 * s, life: 0.9, color: 0x2a221e, alpha: 0.5, vy: -20 });
      }
      keep.push(p);
    }
    this.projectiles = keep;
  }

  stepFlyers(dt) {
    const t = this.time;
    const keep = [];
    for (const f of this.flyers) {
      const team = this.teams[f.team];
      const dir = team.dir;
      const enemy = 1 - f.team;
      const age = t - f.t0;
      let done = false;
      if (f.kind === 'dragon') {
        const dur = 4.6;
        const k = age / dur;
        const x = lerp(dir > 0 ? 170 : W - 170, dir > 0 ? W + 420 : -420, easeInOut(k) * 0.35 + k * 0.65);
        const y = 700 + Math.sin(k * Math.PI) * 190 + Math.sin(age * 3) * 12;
        f.sp.position.set(x, y);
        f.sp.alpha = clamp(age / 0.3, 0, 1);
        f.hx = x; f.hy = y - 170;
        if (age < 0.05) for (let i = 0; i < 24; i++) this.fx.fire(x, y, this.r(-300, 300), this.r(-300, 200), 1.4);
        const flap = Math.sin(age * 9);
        f.sp.scale.set(0.82 * dir, 0.82 * (1 + 0.07 * flap));
        f.sp.rotation = dir * (0.06 - Math.cos(k * Math.PI) * 0.1);
        f.shadow.position.set(x, ROWS[1] + 20);
        f.shadow.scale.set(4, 1.2);
        f.shadow.alpha = 0.3;
        const mouthX = x + dir * 260, mouthY = y + 34;
        if (k > 0.08 && k < 0.9) {
          for (let i = 0; i < 4; i++) this.fx.fire(mouthX, mouthY, dir * this.r(150, 300), this.r(380, 620), 1.0);
          const groundX = mouthX + dir * 170;
          if (Math.floor(age * 10) !== Math.floor((age - dt) * 10)) {
            this.areaDamage(groundX, ROWS[1], 160, 36, enemy, { owner: f.owner, team: f.team, kind: 'dragon' });
            if (Math.abs(groundX - CASTLE_X[enemy]) < 170) this.damageCastle(enemy, 80);
            this.fx.poof(groundX, ROWS[Math.floor(this.r(0, 3))], 0x2a221e, 2);
          }
          this.sfx('fireBreath', 0.6);
        }
        done = k >= 1;
      } else if (f.kind === 'eagle') {
        const dur = 3.0;
        const k = age / dur;
        if (!f.target) {
          const last = f.idx === 2;
          f.target = last ? { x: CASTLE_X[enemy] - dir * 20, y: CASTLE_BASE - 120, castle: true } : { x: clamp(this.frontX(f.team) + dir * (40 + f.idx * 90), 240, 840), y: ROWS[f.idx === 0 ? 2 : 0] };
        }
        const p0 = { x: dir > 0 ? -340 : W + 340, y: 600 }, p2 = { x: dir > 0 ? W + 360 : -360, y: 560 };
        const p1 = { x: f.target.x, y: f.target.y + 230 };
        const b = (a, c, e, s) => (1 - s) * (1 - s) * a + 2 * (1 - s) * s * c + s * s * e;
        const s = easeInOut(k);
        const x = b(p0.x, p1.x, p2.x, s), y = b(p0.y, p1.y, p2.y, s);
        const px = f.px ?? x - dir, py = f.py ?? y;
        f.px = x; f.py = y;
        f.sp.position.set(x, y - 70);
        f.sp.scale.set(1.0 * dir, 1.0 * (1 + 0.06 * Math.sin(age * 12)));
        if (this.rng() < 0.7) this.fx.spawn({ tex: 'glow', x: x - dir * 120, y: y - 60, vx: -dir * 80, add: true, size: 0.8, size1: 0.2, life: 0.5, color: 0x6fa8ff, alpha: 0.35 });
        f.sp.rotation = Math.atan2(y - py, Math.abs(x - px)) * dir * 0.7;
        f.shadow.position.set(x, ROWS[1] + 20);
        f.shadow.scale.set(3.4, 1.0);
        f.shadow.alpha = 0.35 * clamp(1 - Math.abs(y - 1000) / 600, 0, 1);
        if (!f.struck && s > 0.49) {
          f.struck = true;
          const tgt = f.target;
          this.boom(tgt.x, tgt.castle ? CASTLE_BASE - 20 : tgt.y, 1.5, enemy, { owner: null, team: f.team, kind: 'eagle' }, 220, 150, tgt.castle ? 650 : 0);
          for (let i = 0; i < 14; i++) this.fx.spawn({ tex: 'feather', x: tgt.x, y: tgt.y - 60, vx: this.r(-320, 320), vy: this.r(-420, -100), gravity: 300, drag: 2, life: 1.7, vr: this.r(-8, 8), size: this.r(0.6, 1.0) });
          this.fx.spawn({ tex: 'ring', x: tgt.x, y: tgt.y, add: true, size: 0.2, size1: 2.4, life: 0.5, color: 0x9fc0ff, alpha: 0.7, sx: 1.8 });
        }
        done = k >= 1;
      } else if (f.kind === 'elephant') {
        f.x += dir * 360 * dt;
        const y = f.lane;
        const bob = Math.abs(Math.sin(age * 8)) * 12;
        const d = depth(y);
        f.sp.position.set(f.x, y - bob);
        f.sp.scale.set(0.8 * d * dir, 0.8 * d);
        this.trauma = Math.max(this.trauma, 0.32);
        f.sp.rotation = Math.sin(age * 8) * 0.03;
        f.sp.zIndex = y;
        f.shadow.position.set(f.x, y + 2);
        f.shadow.scale.set(3.0 * d, 1.0);
        f.shadow.alpha = 0.5 * f.sp.alpha;
        if (Math.floor(age * 8 / Math.PI) !== Math.floor((age - dt) * 8 / Math.PI)) {
          this.shake(0.1);
          this.fx.poof(f.x - dir * 110, y, 0xb59a7a, 5);
          this.sfx('stomp', 0.12);
        }
        if (this.rng() < dt * 30) this.fx.spawn({ tex: 'smoke', x: f.x - dir * this.r(80, 160), y: y - this.r(0, 20), vx: -dir * this.r(20, 60), vy: -this.r(10, 40), size: 0.5, size1: 1.3, life: 1.0, color: 0xb59a7a, alpha: 0.55, fadeIn: 0.1 });
        for (const u of this.units) {
          if (u.team !== enemy || u.state === 'dead' || f.hits.has(u.id)) continue;
          if (Math.abs(u.x - f.x) < 120 && Math.abs(u.y - y) < 90) {
            f.hits.add(u.id);
            this.damage(u, 420, { owner: null, team: f.team, kind: 'elephant' });
            this.fx.hit(u.x, u.y - 70, 0xffc46a);
          }
        }
        if ((FRONT[enemy] - f.x) * dir <= 0 && !f.rammed) {
          f.rammed = true;
          this.boom(FRONT[enemy] + dir * 30, y - 20, 1.25, enemy, { owner: null, team: f.team, kind: 'elephant' }, 120, 90, 380);
        }
        if (f.rammed) f.sp.alpha = Math.max(0, f.sp.alpha - dt * 3);
        done = f.rammed && f.sp.alpha <= 0;
      }
      if (done) {
        f.sp.destroy();
        f.shadow.destroy();
      } else keep.push(f);
    }
    this.flyers = keep;
  }

  // ---------------- view ----------------

  sync() {
    const t = this.time;
    for (const u of this.units) {
      const d = depth(u.y);
      const dir = this.teams[u.team].dir;
      let s = u.baseScale * d * u.jitter;
      let x = u.x, y = u.y, rot = 0, alpha = 1, sy = 1;
      const ph = t * (u.kind === 'knight' ? 11 : 8.5) * u.speedMul + u.phase;
      if (u.state === 'spawn') {
        const p = clamp((t - u.t0) / 0.4, 0, 1);
        s *= 0.6 + 0.4 * easeOutBack(p);
        alpha = clamp(p * 2.5, 0, 1);
      } else if (u.state === 'walk') {
        y -= Math.abs(Math.sin(ph)) * (u.kind === 'knight' ? 10 : 7);
        rot = Math.sin(ph) * (u.kind === 'knight' ? 0.05 : 0.035);
        sy = 1 - 0.025 * Math.cos(ph * 2);
      } else if (u.state === 'fight' || u.state === 'siege') {
        x += dir * u.lunge * 18;
        rot = dir * u.lunge * 0.14;
      } else if (u.state === 'cheer') {
        y -= Math.abs(Math.sin(t * 7 + u.phase)) * 24;
        rot = Math.sin(t * 7 + u.phase) * 0.05;
      } else if (u.state === 'dead') {
        const p = clamp((t - u.deadT) / 1.2, 0, 1);
        rot = u.fly ? u.fly.spin * (t - u.deadT) : -dir * easeOutCubic(Math.min(1, p * 2.2)) * 1.35;
        alpha = 1 - p * p;
      }
      u.sp.position.set(x, y);
      u.sp.scale.set(s * dir, s * sy);
      u.sp.rotation = rot;
      u.sp.alpha = alpha;
      u.sp.tint = t - u.hitT < 0.1 ? 0xff7a7a : 0xffffff;
      u.sp.zIndex = u.y;
      const sw = (u.sp.texture.width * u.baseScale * d) / 128;
      u.shadow.position.set(u.x, u.rowY + 4 + (u.y - u.rowY));
      u.shadow.scale.set(sw * 0.75, 0.8 * d);
      u.shadow.alpha = 0.45 * alpha * (u.fly ? 0.3 : 1);
    }
    for (const team of this.teams) {
      const hit = t - team.hitT < 0.1;
      team.castle.tint = hit ? 0xffa0a0 : 0xffffff;
      team.castle.x = CASTLE_X[team.i] + (hit ? Math.sin(t * 90) * 2 : 0);
    }
    this.sun.scale.set(7 + Math.sin(t * 0.7) * 0.4);
    this.sun.alpha = 0.3 + 0.05 * Math.sin(t * 1.3);
    this.fx.sync();

    const tr = this.trauma * this.trauma;
    const sx = 24 * tr * noise1(this.clock * 22, 1), sy = 20 * tr * noise1(this.clock * 22, 2);
    const c = this.cam;
    const z = c.z * (1 + 0.03 * tr);
    this.world.scale.set(z);
    // Never let the camera show past the painted background.
    const px = Math.min(0, Math.max(W - W * z, c.sx - c.fx * z)) + sx;
    const py = Math.min(0, Math.max(H - H * z, c.sy - c.fy * z)) + sy;
    this.world.position.set(px, py);
  }

  toScreen(x, y) {
    return { x: this.world.position.x + x * this.world.scale.x, y: this.world.position.y + y * this.world.scale.y };
  }

  castleScreen(i) {
    return this.toScreen(CASTLE_X[i], CASTLE_BASE - 760 * CASTLE_SCALE - 20);
  }
}
