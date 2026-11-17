import * as THREE from 'three';
import { createDancer, poseDancer, applyCostume, G, mat, gold } from './dancer.js';
import { clamp, lerp, envelope, easeOutCubic, easeInOut, lowerTr, mulberry32 } from './util.js';

const UP = new THREE.Vector3(0, 1, 0);
const STEP = 0.17;
const SPACING = 0.66;
const THETA0 = 4.05;
const MAX_ARM = 0.78;

function cloth(size, color) {
  const geo = new THREE.PlaneGeometry(size, size, 4, 4).translate(0, -size / 2, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.7 }));
  m.castShadow = true;
  m.userData.base = Float32Array.from(geo.attributes.position.array);
  m.userData.size = size;
  return m;
}

function flutter(m, t, amount) {
  const base = m.userData.base;
  const pos = m.geometry.attributes.position;
  const s = m.userData.size;
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3], y = base[i * 3 + 1];
    const depth = -y / s;
    pos.setZ(i, Math.sin(t * 9 + depth * 5 + x * 6) * 0.06 * depth * amount);
    pos.setX(i, x + Math.sin(t * 7 + depth * 4) * 0.025 * depth * amount);
  }
  pos.needsUpdate = true;
  m.geometry.computeVertexNormals();
}

/**
 * The halay: a line of dancers on a ring around the musicians, linked hand to hand.
 * All state changes come in through handle(event), so live events, the simulator
 * and the demo timeline drive exactly the same code.
 */
export class Game {
  constructor({ scene, world, fx, config, seed = 7 }) {
    this.scene = scene;
    this.world = world;
    this.fx = fx;
    this.cfg = config;
    this.rng = mulberry32(seed);
    this.time = 0;
    this.beatPos = 0;
    this.bpm = config.tempo.baseBpm;
    this.likeEnergy = 0;
    this.likesTotal = 0;
    this.dancers = [];
    this.leaving = [];
    this.users = new Map();
    this.points = new Map();
    this.toasts = [];
    this.banners = [];
    this.captions = [];
    this.endcard = null;
    this.squeeze = null;
    this.drummer = null;
    this.R = 2.3;
    this.lineOffset = 0;
    this.armGroup = new THREE.Group();
    scene.add(this.armGroup);
    this.log = { beats: [], sfx: [] };
    this.fx.onSfx = (type) => this.sfx(type);
    this.id = 0;
    this.lbFlash = new Map();

    this.headCloth = cloth(0.42, '#f4f1ea');
    scene.add(this.headCloth);
    this.leaderRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.04, 8, 40),
      new THREE.MeshStandardMaterial({ color: '#ffd166', emissive: '#ffb703', emissiveIntensity: 3.2 }),
    );
    this.leaderRing.rotation.x = Math.PI / 2;
    this.leaderRing.visible = false;
    scene.add(this.leaderRing);
    this.leaderLight = new THREE.PointLight('#ffcf6b', 0, 5, 2);
    scene.add(this.leaderLight);

    for (let i = 0; i < 6; i++) this.addDancer(null, true);
  }

  sfx(type) {
    this.log.sfx.push({ t: +this.time.toFixed(4), type });
  }

  squeezeK() {
    if (!this.squeeze) return 0;
    return envelope(this.time, this.squeeze.t0, this.squeeze.t1, 0.7, 1.0);
  }

  // ---------- line membership ----------

  addDancer(user, instant = false) {
    const d = createDancer(this.rng);
    d.id = ++this.id;
    d.user = user;
    d.npc = !user;
    d.phase = (this.rng() - 0.5) * 0.06;
    d.enter = instant ? 1 : 0;
    d.mendil = null;
    d.bubble = null;
    d.joinedAt = this.time;
    const last = this.dancers[this.dancers.length - 1];
    d.s = last ? last.s - SPACING : 0;
    d.theta = THETA0 - (d.s + this.lineOffset) / this.R;
    d.spawn = new THREE.Vector3(Math.cos(d.theta) * (this.R + 3.4), 0, Math.sin(d.theta) * (this.R + 3.4));
    d.pos = new THREE.Vector3();
    d.shL = new THREE.Vector3();
    d.shR = new THREE.Vector3();
    d.handL = new THREE.Vector3();
    d.handR = new THREE.Vector3();
    d.arms = [new THREE.Mesh(G.arm, d.sleeveMat), new THREE.Mesh(G.arm, d.sleeveMat)];
    d.hands = [new THREE.Mesh(G.hand, d.handMat), new THREE.Mesh(G.hand, d.handMat)];
    for (const m of [...d.arms, ...d.hands]) {
      m.castShadow = true;
      this.armGroup.add(m);
    }
    this.scene.add(d.root);
    this.dancers.push(d);
    if (user) this.users.set(user, d);

    if (this.dancers.length > this.cfg.maxDancers) {
      const npc = this.dancers.find((x) => x.npc && x !== this.dancers[0]);
      if (npc) this.removeDancer(npc);
    }
    return d;
  }

  removeDancer(d) {
    this.dancers = this.dancers.filter((x) => x !== d);
    d.leaveAt = this.time;
    this.leaving.push(d);
  }

  join(user, text) {
    let d = this.users.get(user);
    if (d) return d;
    d = this.addDancer(user);
    this.sfx('join');
    if (text) this.say(d, text);
    return d;
  }

  say(d, text) {
    d.bubble = { text, t0: this.time };
  }

  setLeader(d, banner = true) {
    const head = this.dancers[0];
    if (head === d) return;
    if (head && head.user) head.leader = false;
    this.dancers = [d, ...this.dancers.filter((x) => x !== d)];
    d.leader = true;
    d.hop = { t0: this.time, dur: 1.5, from: d.enter < 1 ? d.spawn.clone() : d.pos.clone() };
    d.enter = 1;
    if (d.mendil) { this.scene.remove(d.mendil); d.mendil = null; }
    this.headCloth.material.color.set('#d62839');
    if (banner) {
      this.banners.push({ kind: 'leader', name: d.user, t0: this.time, dur: 3.6 });
      this.sfx('leader');
    }
  }

  toast(emoji, user, text, tone = 'plain') {
    this.toasts.push({ emoji, user, text, tone, t0: this.time });
    if (this.toasts.length > 6) this.toasts.shift();
  }

  addPoints(user, n) {
    this.points.set(user, (this.points.get(user) || 0) + n);
    this.lbFlash.set(user, this.time);
  }

  // ---------- events ----------

  handle(ev) {
    switch (ev.type) {
      case 'chat': {
        const isJoin = lowerTr(ev.text).includes(lowerTr(this.cfg.joinKeyword));
        const existing = this.users.get(ev.user);
        if (existing) this.say(existing, ev.text);
        else if (isJoin) {
          this.join(ev.user, ev.text);
          this.toast('💬', ev.user, 'halaya katıldı', 'join');
        }
        break;
      }
      case 'like': {
        this.likeEnergy += ev.count || 1;
        this.likesTotal += ev.count || 1;
        break;
      }
      case 'follow': {
        this.toast('➕', ev.user, 'takip etti', 'plain');
        const d = this.users.get(ev.user);
        if (d) this.fx.sparkle(d.pos.clone().setY(1.6), 30);
        this.sfx('ding');
        break;
      }
      case 'share': {
        this.toast('↗️', ev.user, 'paylaştı → konfeti', 'plain');
        this.fx.confetti(new THREE.Vector3(0, 0, 0));
        this.sfx('confetti');
        break;
      }
      case 'gift':
        this.gift(ev);
        break;
      case 'caption':
        this.captions.push({ text: ev.text, t0: this.time, dur: ev.dur ?? 4.5 });
        break;
      case 'endcard':
        this.endcard = { t0: this.time };
        this.sfx('endcard');
        break;
      default:
        break;
    }
  }

  gift(ev) {
    const def = this.cfg.gifts[ev.gift] || null;
    const coins = def ? def.coins : ev.coins ?? 1;
    const count = ev.count || 1;
    let action = def?.action;
    if (!action) action = this.cfg.fallback.find((f) => coins >= f.minCoins).action;
    const name = def?.tr ?? ev.gift;
    const emoji = def?.emoji ?? '🎁';
    // The Donut gifter becomes the drummer in the middle instead of joining the line.
    const d = action === 'davulcu' && !this.users.has(ev.user) ? null : this.join(ev.user);
    this.addPoints(ev.user, coins * count);
    const head = (d ? d.pos : this.world.davulcu.root.position).clone().setY(1.7);
    const label = `${name}${count > 1 ? ' x' + count : ''}`;

    switch (action) {
      case 'mendil': {
        if (!d.mendil && this.dancers[0] !== d) {
          d.mendil = cloth(0.24, ['#d62839', '#e11d48', '#f43f5e'][d.id % 3]);
          this.scene.add(d.mendil);
        }
        this.fx.petals(head);
        this.toast(emoji, ev.user, `${label} → mendil`, 'rose');
        this.sfx('chime');
        break;
      }
      case 'costume':
        applyCostume(d);
        for (const m of d.arms) m.material = d.sleeveMat;
        this.fx.sparkle(head, 110);
        this.toast(emoji, ev.user, `${label} → yöresel kıyafet`, 'gold');
        this.sfx('shimmer');
        break;
      case 'davulcu':
        this.drummer = ev.user;
        this.fx.sparkle(this.world.davulcu.root.position.clone().setY(1.6), 90);
        this.toast(emoji, ev.user, `${label} → davulcu`, 'gold');
        this.sfx('drumroll');
        break;
      case 'fireworks_small':
        this.fx.fireworks(2 + Math.min(3, count - 1));
        this.fx.sparkle(head, 40);
        this.toast(emoji, ev.user, `${label} → havai fişek`, 'plain');
        break;
      case 'fireworks':
        this.fx.fireworks(5 + Math.min(4, count - 1));
        this.fx.sparkle(head, 60);
        this.toast(emoji, ev.user, `${label} → havai fişek`, 'gold');
        break;
      case 'leader':
        this.setLeader(d);
        this.fx.fireworks(3, true);
        this.toast(emoji, ev.user, `${label} → HALAY BAŞI`, 'leader');
        break;
      case 'sikistir':
        if (coins >= this.cfg.leaderMinCoins) this.setLeader(d, false);
        this.squeeze = { t0: this.time + 0.6, t1: this.time + 0.6 + this.cfg.squeezeSeconds };
        this.banners.push({ kind: 'sikistir', name: ev.user, t0: this.time + 0.4, dur: this.cfg.squeezeSeconds + 0.4 });
        this.fx.fireworks(12, true);
        this.toast(emoji, ev.user, `${label} → SIKIŞTIR!`, 'leader');
        this.sfx('sikistir');
        break;
      default:
        this.fx.sparkle(head, 50);
        this.toast(emoji, ev.user, label, 'plain');
        this.sfx('chime');
    }
  }

  // ---------- simulation ----------

  step(dt) {
    this.time += dt;
    const t = this.time;
    const tc = this.cfg.tempo;
    this.likeEnergy *= Math.pow(0.5, dt / tc.halfLifeSec);
    const k = this.squeezeK();
    this.tempoLevel = 1 - Math.exp(-this.likeEnergy / tc.likesForMax * 2.2);
    const target = tc.baseBpm + (tc.maxBpm - tc.baseBpm) * this.tempoLevel + 10 * k;
    this.bpm += (target - this.bpm) * Math.min(1, dt * 0.7);

    const prev = Math.floor(this.beatPos);
    this.beatPos += (dt * this.bpm) / 60;
    const now = Math.floor(this.beatPos);
    if (now !== prev) {
      const back = ((this.beatPos - now) * 60) / this.bpm;
      this.log.beats.push({ t: +(t - back).toFixed(4), i: now, bpm: +this.bpm.toFixed(2), sq: +k.toFixed(2) });
    }

    const c = Math.floor(this.beatPos / 4);
    const rem = this.beatPos - 4 * c;
    const adv = rem < 3 ? Math.floor(rem) + easeInOut(rem - Math.floor(rem)) : 3;
    this.lineOffset = (3 * c + adv) * STEP;

    const n = this.dancers.length;
    const spacing = SPACING * (1 - 0.3 * k);
    const Rt = Math.max(2.3, (n * SPACING) / (2 * Math.PI * 0.84)) * (1 - 0.2 * k);
    this.R += (Rt - this.R) * Math.min(1, dt * 1.4);
    const energy = clamp(this.tempoLevel + k, 0, 1);

    this.dancers.forEach((d, i) => {
      const sT = -i * spacing;
      if (d.hop) d.s = sT;
      else d.s += (sT - d.s) * Math.min(1, dt * 3.5);
      d.theta = THETA0 - (d.s + this.lineOffset) / this.R;
      const ring = new THREE.Vector3(Math.cos(d.theta) * this.R, 0, Math.sin(d.theta) * this.R);
      let y = 0;
      if (d.enter < 1) {
        d.enter = Math.min(1, d.enter + dt / 0.9);
        const e = easeOutCubic(d.enter);
        ring.lerpVectors(d.spawn, ring, e);
        y = Math.sin(Math.PI * d.enter) * 0.55;
        if (d.enter >= 1) this.fx.pop(ring);
      }
      if (d.hop) {
        const p = (t - d.hop.t0) / d.hop.dur;
        if (p >= 1) d.hop = null;
        else {
          ring.lerpVectors(d.hop.from, ring, easeInOut(p));
          y = Math.sin(Math.PI * p) * 1.9;
        }
      }
      d.pos.copy(ring);
      d.root.position.set(ring.x, y, ring.z);
      d.root.rotation.y = Math.atan2(-Math.cos(d.theta), -Math.sin(d.theta));
      poseDancer(d, this.beatPos + d.phase, k, energy);
    });

    for (const d of this.leaving) {
      const p = (t - d.leaveAt) / 0.6;
      d.root.scale.setScalar(Math.max(0.001, 1 - p));
      if (p >= 1) {
        this.scene.remove(d.root);
        for (const m of [...d.arms, ...d.hands]) this.armGroup.remove(m);
        if (d.mendil) this.scene.remove(d.mendil);
        d.gone = true;
      }
    }
    this.leaving = this.leaving.filter((d) => !d.gone);

    this.updateArms(k);
    this.world.update(t, this.beatPos, energy, !!this.drummer);
    this.fx.step(dt);

    this.toasts = this.toasts.filter((x) => t - x.t0 < 5.5);
    this.banners = this.banners.filter((x) => t - x.t0 < x.dur);
    this.captions = this.captions.filter((x) => t - x.t0 < x.dur);
    for (const d of this.dancers) if (d.bubble && t - d.bubble.t0 > 2.8) d.bubble = null;
  }

  updateArms(k) {
    const n = this.dancers.length;
    const drop = lerp(0.44, 0.02, k);
    const swing = 0.13 * Math.sin((this.beatPos / 4) * Math.PI * 2 - 1.2) * (1 - k);
    const tmp = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    for (const d of [...this.dancers, ...this.leaving]) {
      d.root.updateMatrixWorld(true);
      d.torso.localToWorld(d.shR.set(-0.245, 0.55, 0));
      d.torso.localToWorld(d.shL.set(0.245, 0.55, 0));
      const yaw = d.root.rotation.y;
      d.fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      d.right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
      d.handL.copy(d.shL).add(tmp.set(0, -0.58, 0)).addScaledVector(d.fwd, 0.06).addScaledVector(d.right, -0.05);
      d.handR.copy(d.shR).add(tmp.set(0, -0.58, 0)).addScaledVector(d.fwd, 0.06).addScaledVector(d.right, 0.05);
    }
    const ok = (d) => d.enter >= 1 && !d.hop;
    for (let i = 0; i < n - 1; i++) {
      const a = this.dancers[i], b = this.dancers[i + 1];
      if (!ok(a) || !ok(b) || a.shL.distanceTo(b.shR) > 1.3) continue;
      fwd.copy(a.fwd).add(b.fwd).normalize();
      const p = tmp.copy(a.shL).add(b.shR).multiplyScalar(0.5);
      p.y -= drop;
      p.addScaledVector(fwd, 0.1 + swing);
      a.handL.copy(p);
      b.handR.copy(p);
    }
    const head = this.dancers[0];
    if (head) {
      const tw = this.time * 9;
      head.handR.copy(head.shR).add(tmp.set(0, 0.5, 0)).addScaledVector(head.right, 0.12).addScaledVector(head.fwd, 0.1);
      this.headCloth.position.copy(head.handR).add(tmp.set(Math.cos(tw) * 0.1, 0.05, Math.sin(tw) * 0.1));
      this.headCloth.rotation.set(0, tw, 0.5 * Math.sin(tw));
      flutter(this.headCloth, this.time, 2.2);
      const lead = !!head.user;
      this.leaderRing.visible = lead;
      this.leaderLight.intensity = lead ? 7 + 3 * Math.sin(this.time * 6) : 0;
      if (lead) {
        this.leaderRing.position.set(head.root.position.x, 0.04 + head.root.position.y, head.root.position.z);
        this.leaderRing.rotation.z = this.time * 2;
        this.leaderLight.position.copy(head.pos).setY(2.4);
      }
    }
    for (const d of [...this.dancers, ...this.leaving]) {
      [[d.shR, d.handR], [d.shL, d.handL]].forEach(([sh, hand], j) => {
        const dir = tmp.copy(hand).sub(sh);
        let len = dir.length();
        if (len > MAX_ARM) { dir.multiplyScalar(MAX_ARM / len); len = MAX_ARM; hand.copy(sh).add(dir); }
        const arm = d.arms[j];
        arm.position.copy(sh);
        arm.quaternion.setFromUnitVectors(UP, dir.normalize());
        arm.scale.set(d.root.scale.x, len, d.root.scale.x);
        d.hands[j].position.copy(hand);
        d.hands[j].scale.setScalar(d.root.scale.x);
      });
      if (d.mendil) {
        d.mendil.position.copy(d.handR);
        d.mendil.rotation.set(0, d.root.rotation.y, 0);
        flutter(d.mendil, this.time + d.id, 0.9);
      }
    }
  }

  /** Camera framing: keep the whole circle in a 9:16 frame, push in when the line squeezes. */
  updateCamera(camera) {
    const k = this.squeezeK();
    const t = this.time;
    const dist = (4.6 + this.R * 3.9) * (1 - 0.05 * k);
    const el = 0.6;
    const az = 0.06 * Math.sin(t * 0.11) + 0.03 * Math.sin(t * 0.27);
    const shake = 0.05 * k;
    camera.position.set(
      Math.sin(az) * dist * Math.cos(el) + shake * Math.sin(t * 37),
      dist * Math.sin(el) + 0.9 + shake * Math.sin(t * 29 + 1),
      Math.cos(az) * dist * Math.cos(el),
    );
    camera.lookAt(0, 2.3, -0.7);
  }
}
