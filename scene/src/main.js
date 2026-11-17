import { Application, Assets, ColorMatrixFilter } from 'pixi.js';
import { AdvancedBloomFilter, ShockwaveFilter } from 'pixi-filters';
import cfg from '../../config/battle.json';
import demo from '../../sim/demo-timeline.json';
import { Battle, W, H } from './battle.js';
import { Hud } from './hud.js';
import { makeFxTextures } from './textures.js';
import { mulberry32 } from './util.js';

const FPS = 30;
const DT = 1 / 120;
const params = new URLSearchParams(location.search);
const RENDER = params.has('render');
const DEMO = RENDER || params.has('demo');

const ART = ['background', 'castle_blue', 'castle_orange', 'warrior_blue', 'warrior_orange', 'archer_blue', 'archer_orange',
  'knight_blue', 'knight_orange', 'dragon_blue', 'dragon_orange', 'eagle_blue', 'elephant_orange'];

async function boot() {
  await Promise.all([document.fonts.load('64px "Lilita One"'), document.fonts.load('700 30px "Rubik"'), document.fonts.load('800 30px "Rubik"')]);
  const app = new Application();
  await app.init({ width: W, height: H, background: '#000000', antialias: true, preserveDrawingBuffer: true, autoStart: false, resolution: 1, preference: 'webgl' });
  const stage = document.getElementById('app');
  stage.appendChild(app.canvas);
  const ui = document.createElement('canvas');
  ui.width = W;
  ui.height = H;
  stage.appendChild(ui);

  const tex = {};
  for (const name of ART) tex[name] = await Assets.load(`/art/${name}.${name === 'background' ? 'jpg' : 'png'}`);
  const icons = {};
  await Promise.all(ART.filter((n) => n !== 'background' && !n.startsWith('castle')).map((f) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { icons[f] = im; res(); };
    im.src = `/art/${f}.png`;
  })));
  await new Promise((res) => { const im = new Image(); im.onload = () => { icons.background = im; res(); }; im.src = '/art/background.jpg'; });

  const battle = new Battle({ tex, fxTex: makeFxTextures(), cfg });
  app.stage.addChild(battle.root);
  const hud = new Hud(ui, battle, cfg, icons, { demo: DEMO });

  const grade = new ColorMatrixFilter();
  grade.contrast(0.12, false);
  grade.saturate(0.08, true);
  const bloom = new AdvancedBloomFilter({ threshold: 0.85, bloomScale: 0.6, brightness: 1.0, blur: 9, quality: 6 });
  const waves = [0, 1, 2].map(() => new ShockwaveFilter({ center: { x: 0, y: 0 }, amplitude: 0, wavelength: 160, speed: 600, brightness: 1.08, radius: 520, time: 0 }));

  function render() {
    battle.sync();
    const active = battle.shockwaves.slice(-3);
    const filters = [grade];
    active.forEach((s, i) => {
      const f = waves[i];
      const p = battle.toScreen(s.x, s.y);
      f.center = { x: p.x, y: p.y };
      f.time = battle.time - s.t0;
      f.amplitude = s.amp * (1 - f.time);
      f.wavelength = s.wave;
      filters.push(f);
    });
    filters.push(bloom);
    battle.root.filters = filters;
    app.render();
    hud.draw();
  }

  // ---- event sources ----
  const timeline = DEMO ? [...demo.events].sort((a, b) => a.t - b.t) : [];
  let cursor = 0;
  function advanceTo(target) {
    while (battle.clock + 1e-9 < target) {
      while (cursor < timeline.length && timeline[cursor].t <= battle.clock) battle.handle(timeline[cursor++]);
      battle.step(DT);
    }
  }

  const comp = document.createElement('canvas');
  comp.width = W;
  comp.height = H;
  const cg = comp.getContext('2d');
  window.__duration = demo.duration;
  window.__frame = (i) => {
    advanceTo(i / FPS);
    render();
    cg.drawImage(app.canvas, 0, 0);
    cg.drawImage(ui, 0, 0);
    return comp.toDataURL('image/jpeg', 0.93).split(',')[1];
  };
  window.__log = () => ({ duration: demo.duration, fps: FPS, ...battle.log });
  window.__handle = (ev) => battle.handle(ev);

  if (RENDER) {
    window.__ready = true;
    return;
  }

  const fit = () => {
    const s = Math.min(innerWidth / W, innerHeight / H);
    for (const c of [app.canvas, ui]) Object.assign(c.style, { width: `${W * s}px`, height: `${H * s}px` });
  };
  addEventListener('resize', fit);
  fit();

  // Keys fire test events; ?sim=1 adds random viewers; ?ws=… takes events from a server.
  const rng = mulberry32(Date.now() & 0xffff);
  const names = ['jake_tx', 'priya.s', 'arjun07', 'mike.d', 'emily_r', 'rohan.k', 'ananya__', 'chris_b', 'sneha.r', 'tyler99', 'dev.patel', 'kayla.m'];
  const who = () => names[Math.floor(rng() * names.length)] + Math.floor(rng() * 90);
  const fire = (ev) => battle.handle(ev);
  const gifts = { 1: 'Rose', 2: 'Finger Heart', 3: 'Doughnut', 4: 'Hand Heart', 5: 'Galaxy', 6: 'Universe' };
  addEventListener('keydown', (e) => {
    const team = e.shiftKey ? 1 : 0;
    if (gifts[e.key]) fire({ type: 'gift', user: who(), gift: gifts[e.key], count: 1, team });
    if (e.key === 'j') fire({ type: 'chat', user: who(), text: String(team + 1) });
    if (e.key === 'l') fire({ type: 'like', user: who(), count: 150, team });
  });
  const SIM = params.has('sim');
  let nextSim = 1;
  if (params.get('ws')) {
    const connect = () => {
      const ws = new WebSocket(params.get('ws'));
      ws.onmessage = (m) => { try { fire(JSON.parse(m.data)); } catch {} };
      ws.onclose = () => setTimeout(connect, 2000);
    };
    connect();
  }
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (SIM && battle.time > nextSim && !battle.victory) {
      nextSim = battle.time + 0.3 + rng() * 1.2;
      const team = rng() < 0.5 ? 0 : 1;
      const roll = rng();
      if (roll < 0.3) fire({ type: 'chat', user: who(), text: String(team + 1) });
      else if (roll < 0.62) fire({ type: 'gift', user: who(), gift: 'Rose', count: 1 + Math.floor(rng() * 4), team });
      else if (roll < 0.78) fire({ type: 'gift', user: who(), gift: 'Finger Heart', count: 1, team });
      else if (roll < 0.9) fire({ type: 'like', user: who(), count: 80, team });
      else if (roll < 0.97) fire({ type: 'gift', user: who(), gift: 'Doughnut', count: 1, team });
      else fire({ type: 'gift', user: who(), gift: 'Hand Heart', count: 1, team });
    }
    advanceTo(battle.clock + dt);
    render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

boot();
