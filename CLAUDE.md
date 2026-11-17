# CLAUDE.md: live-gift-arena (GIFT WAR)

A team war for TikTok LIVE, driven by viewers. Comment `1` or `2` to pick a side, and every gift spawns a unit
carrying the gifter's username. Each side has its own gift goal that unleashes an ultimate, and the first castle to
fall loses. This is the partner's concept: faction battles where gifts fire animations and usernames appear on the
field, built for large audiences.

Read `docs/research.md` before changing the design. It holds the trend, the event libraries, TikTok's rules and the
money math, all with sources.

## Who does what

- **This repo** is built by Claude Code sessions. It is public on GitHub, so write it so anyone can clone it, read it
  and run it.
- **The host** is a partner in Turkey who owns the TikTok account, presents on camera or mic, and runs the stream from
  his computer (OBS or TikTok LIVE Studio). Support macOS and Windows.
- **Never use the repo owner's phones or social accounts** for this project. Nothing here signs in to TikTok or posts
  anything. The event library only *reads* LIVE events.

## Where it stands (2026-11-17)

**Done:**
- The battle scene, in PixiJS with an illustrated art set.
- The canvas HUD, the simulator and live keys.
- The demo renderer and soundtrack synth.
- Demo video v2 (release `demo-v2`).

The art and HUD went through two clean-context art-director reviews.

**Next:**
1. **TikTok LIVE bridge** (`server/`): TikTok-Live-Connector with an Euler Stream key from `.env`, plus a TikFinity
   WebSocket adapter for Windows.
   - It normalises events to `{type, user, gift, count, text, team}` and handles gift streaks (apply once per streak,
     dedupe).
   - It broadcasts to the scene's `?ws=` input.
   - Prove it read-only against a busy public LIVE.
2. **Turkish host guide** (`docs/host-guide.tr.md`): setup, OBS / LIVE Studio at 1080×1920, the host camera over the
   `HOST CAM` slot, and the dos and don'ts below.
3. **Team presets.** TikTok has been banned in India since 2020, so the India side only reaches the diaspora. Make
   teams switchable from `config/battle.json` without code: names, flags, colours, art and ultimate.

## Architecture

```
scene/src/battle.js    simulation: units, formation rows, combat, projectiles, flyers (dragon, eagle, elephant),
                       the big-moment director (one major at a time), castle damage, collapse, directed kill shot.
                       Two clocks: `clock` (real seconds, drives events, logs and the camera) and `time` (sim,
                       slowed during the kill shot).
scene/src/fx.js        pooled sprite particles and presets (explosion, hit, summon, poof, fire, embers)
scene/src/hud.js       canvas HUD: team panels (castle HP + gift goal), host cam slot, gift feed, rotating gift card,
                       top gifters, name tags (feet labels + plates), hero plates, banners, victory, end card
scene/src/main.js      boot, Pixi filters (grade, shockwaves, bloom), deterministic render API, live loop, ?sim / ?ws
config/battle.json     teams, gifts → actions, unit stats, goals, legend
sim/demo-timeline.json the demo session (made by tools/make-demo-timeline.mjs)
tools/render-demo.mjs  headless Chrome → frames → ffmpeg; writes out/demo-log.json for the synth
tools/audio/synth.py   music and effects from the log
tools/art/             ws.py (WaveSpeed client, logs cost to art/costs.jsonl), prepare.py (raw → game assets)
```

**Art.**
- New art is generated with `openai/gpt-image-2/edit`, passing an existing sprite (e.g. `art/raw/warrior_orange.png`)
  as the style reference so the set stays consistent.
- Ask for "isolated on a fully transparent background".
- Use `aspect_ratio`, not `size`.
- Costs about $0.06–0.2 an image. The key comes from the environment and is never committed.

## Rules

- **Host presence.** The layout keeps the `HOST CAM` slot. TikTok demonetizes streams "operated primarily through
  automated systems without meaningful creator presence".
- **No gift begging.** On-screen copy says what gifts *do*, once, calmly. No looping "send gifts".
- **No real gangs** (no Bloods vs Crips) and **no religious or ethnic conflict**. Those risk an account ban.
  - Nations appear as playful, stylised team skins (fantasy legions with flags), the way country battles run on TikTok.
  - Never hateful, never about real wars.
- **No gambling mechanics.** No paid spins, random rewards or raffles.
- **Big moments go through the director**, one at a time, each one showing its hero and the gifter's name.
- **Licences.**
  - The repo is AGPL-3.0 (TikTok-Live-Connector is AGPL).
  - List every asset in `ASSETS.md`.
  - No TikTok gift images in the repo.
  - Audio stays synthesised or royalty-free.
- **Secrets** go in `.env` (git-ignored). Scan the diff before every push.
- **Public repo hygiene.** First names only, no machine-local paths.
- **Git.** Commit at checkpoints and push to `main`. Stage explicit paths and never force-push.

## Commands

```bash
npm install
npm run dev                         # http://localhost:5173 (?sim=1, ?demo=1, ?ws=…; keys j / 1-6 / l, Shift = team 2)
node tools/make-demo-timeline.mjs   # after editing the demo script
npm run demo:stills -- 5,20,40      # stills at those seconds → out/
npm run demo:render                 # full video → out/live-gift-arena-demo.mp4 (about 45 s on an M-series Mac)
python3 tools/art/prepare.py        # after adding or regenerating art in art/raw/
```
