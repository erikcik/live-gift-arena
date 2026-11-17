// Renders the showcase video from the real scene, frame by frame:
//   npm run demo:render            -> out/live-gift-arena-demo.mp4
//   npm run demo:stills -- 5,34,52 -> out/still-<t>.jpg (quick look at given seconds)
// The scene runs in Google Chrome (headless) with time stepped deterministically, so every
// frame and the beat log for the soundtrack come from the same simulation.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = ROOT + 'out/';
const FPS = 30;
mkdirSync(OUT, { recursive: true });

const stillsArg = process.argv.includes('--stills') ? process.argv[process.argv.indexOf('--stills') + 1] || '4,12,20,28,34,42,53,60' : null;
const limit = process.argv.includes('--seconds') ? +process.argv[process.argv.indexOf('--seconds') + 1] : null;

const server = await createServer({ configFile: ROOT + 'scene/vite.config.js', server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5199/?render=1');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
console.log('renderer:', await page.evaluate(() => {
  const gl = document.querySelector('canvas').getContext('webgl2');
  const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
}));

const duration = limit ?? (await page.evaluate(() => window.__duration));

if (stillsArg) {
  const times = stillsArg.split(',').map(Number).sort((a, b) => a - b);
  for (const t of times) {
    const b64 = await page.evaluate((i) => window.__frame(i), Math.round(t * FPS));
    writeFileSync(`${OUT}still-${t}.jpg`, Buffer.from(b64, 'base64'));
    console.log('still', t);
  }
} else {
  const total = Math.round(duration * FPS);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT + 'demo-video.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    const b64 = await page.evaluate((n) => window.__frame(n), i);
    if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await once(ff.stdin, 'drain');
    if (i % 150 === 0) console.log(`frame ${i}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await once(ff, 'close');
  const log = await page.evaluate(() => window.__log());
  log.duration = duration;
  writeFileSync(OUT + 'demo-log.json', JSON.stringify(log));
  console.log('synthesising soundtrack…');
  const py = spawnSync('python3', ['-I', ROOT + 'tools/audio/synth.py', OUT + 'demo-log.json', OUT + 'demo-audio.wav'], { stdio: 'inherit' });
  if (py.status !== 0) throw new Error('audio synth failed');
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', OUT + 'demo-video.mp4', '-i', OUT + 'demo-audio.wav',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT + 'live-gift-arena-demo.mp4'], { stdio: 'inherit' });
  console.log('done:', OUT + 'live-gift-arena-demo.mp4', `${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

await browser.close();
await server.close();
