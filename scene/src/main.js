import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import config from '../../config/gifts.json';
import demoTimeline from '../../sim/demo-timeline.json';
import { buildWorld } from './world.js';
import { FX } from './fx.js';
import { Game } from './game.js';
import { Overlay } from './overlay.js';
import { mulberry32 } from './util.js';

const W = 1080, H = 1920;
const FPS = 30;
const DT = 1 / 120;
const params = new URLSearchParams(location.search);
const RENDER = params.has('render');
const DEMO = RENDER || params.has('demo');

const app = document.getElementById('app');
const glCanvas = document.createElement('canvas');
const ui = document.createElement('canvas');
ui.width = W;
ui.height = H;
for (const c of [glCanvas, ui]) app.appendChild(c);

const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, W / H, 0.1, 600);
const world = buildWorld(scene);
const fx = new FX(scene, H / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
const game = new Game({ scene, world, fx, config });
const overlay = new Overlay(ui, game, camera, config, { demo: DEMO });

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.75, 0.6, 1.05));
composer.addPass(new OutputPass());

function render() {
  game.updateCamera(camera);
  fx.sync(game.time);
  composer.render();
  overlay.draw();
}

// ---- event sources ----
let timeline = DEMO ? [...demoTimeline.events].sort((a, b) => a.t - b.t) : [];
let cursor = 0;
let loopStart = 0;
function advanceTo(target) {
  while (game.time + 1e-9 < target) {
    while (cursor < timeline.length && timeline[cursor].t + loopStart <= game.time) game.handle(timeline[cursor++]);
    game.step(DT);
  }
}

// ---- deterministic render API (tools/render-demo.mjs) ----
const comp = document.createElement('canvas');
comp.width = W;
comp.height = H;
const cg = comp.getContext('2d');
window.__duration = demoTimeline.duration;
window.__frame = (i) => {
  advanceTo(i / FPS);
  render();
  cg.drawImage(glCanvas, 0, 0);
  cg.drawImage(ui, 0, 0);
  return comp.toDataURL('image/jpeg', 0.93).split(',')[1];
};
window.__log = () => ({ duration: demoTimeline.duration, fps: FPS, ...game.log });
window.__handle = (ev) => game.handle(ev);

if (RENDER) {
  document.fonts.ready.then(() => { window.__ready = true; });
} else {
  // Live preview: fit the 9:16 stage to the window.
  const fit = () => {
    const s = Math.min(innerWidth / W, innerHeight / H);
    for (const c of [glCanvas, ui]) Object.assign(c.style, { width: `${W * s}px`, height: `${H * s}px` });
  };
  addEventListener('resize', fit);
  fit();

  // ?sim=1 → random simulated viewers. Keys fire test events.
  const rng = mulberry32(Date.now() & 0xffff);
  const names = ['ayse.k', 'mehmet_34', 'zeynep.dnz', 'burak.gs', 'elif.yldz', 'emre_can', 'selin.ak', 'kerem_06', 'derya.m', 'oguzhan.tr', 'hatice_44', 'cem.krt', 'nazli.s', 'umut.bey'];
  const who = () => names[Math.floor(rng() * names.length)];
  const fire = (ev) => game.handle(ev);
  const keys = { 1: 'Rose', 2: 'Finger Heart', 3: 'Perfume', 4: 'Doughnut', 5: 'Hand Heart', 6: 'Galaxy', 7: 'Lion', 8: 'Universe' };
  addEventListener('keydown', (e) => {
    if (keys[e.key]) fire({ type: 'gift', user: who(), gift: keys[e.key], count: 1 });
    if (e.key === 'j') fire({ type: 'chat', user: who() + Math.floor(rng() * 99), text: 'halay' });
    if (e.key === 'l') fire({ type: 'like', user: who(), count: 120 });
    if (e.key === 's') fire({ type: 'share', user: who() });
    if (e.key === 'f') fire({ type: 'follow', user: who() });
  });
  let nextSim = 2;
  const SIM = params.has('sim');

  // ?ws=ws://localhost:8787 → events from the server (normalised: {type, user, gift, count, text}).
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
    if (DEMO && game.time - loopStart > demoTimeline.duration) {
      location.reload();
      return;
    }
    if (SIM && game.time > nextSim) {
      nextSim = game.time + 0.6 + rng() * 2.2;
      const roll = rng();
      if (roll < 0.35) fire({ type: 'chat', user: who() + Math.floor(rng() * 50), text: 'halay' });
      else if (roll < 0.55) fire({ type: 'like', user: who(), count: 20 + Math.floor(rng() * 80) });
      else if (roll < 0.8) fire({ type: 'gift', user: who(), gift: 'Rose', count: 1 + Math.floor(rng() * 5) });
      else if (roll < 0.92) fire({ type: 'gift', user: who(), gift: rng() < 0.5 ? 'Finger Heart' : 'Perfume', count: 1 });
      else if (roll < 0.98) fire({ type: 'gift', user: who(), gift: 'Galaxy', count: 1 });
      else fire({ type: 'gift', user: who(), gift: 'Lion', count: 1 });
    }
    advanceTo(game.time + dt);
    render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
