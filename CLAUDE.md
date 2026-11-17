# CLAUDE.md: live-gift-arena

Gift-reactive scenes for TikTok LIVE. Viewers comment, like and send gifts, and an animated scene on the stream
reacts in real time. Scene 1 is a Turkish **halay**: every viewer can join the line, gifts upgrade them, and big
gifts set off group-wide moments.

Read `docs/research.md` before designing anything. It holds the trend, the competitors, the event libraries,
TikTok's rules and the money math, all with sources.

## Who does what

- **This repo** is built by Claude Code sessions. It is public on GitHub, so write it so anyone can clone it, read it
  and run it.
- **The host** is a partner in Turkey who owns the TikTok account, presents on camera or mic, and runs the stream from
  his computer (OBS or TikTok LIVE Studio). His OS isn't known yet, so support macOS and Windows.
- **Never use the repo owner's phones or social accounts** for this project. They are busy with other work. Nothing
  here signs in to TikTok or posts anything. The library only *reads* LIVE events.

## Deliverables (definition of done)

1. **A working halay scene**, 1080×1920 vertical, that reacts to live events. The host must be able to run it
   from the README alone.
2. **An event pipeline** that has been tested against a *real* public TikTok LIVE in read-only mode: connect to
   someone else's live and drive our scene with their real gifts, likes and chat. This proves the pipeline end to
   end before the host's account exists.
3. **An end-to-end demo video** (vertical, 60–120 s) of what our live will look like:
   - quiet idle
   - viewers joining from chat
   - Rose joins, upgrades, the leader takeover, a big-gift spectacle
   - the leaderboard
   - the host's camera bubble (a placeholder is fine)
   Recorded from the real scene, never mocked up.
4. **A host setup guide in Turkish** (`docs/host-guide.tr.md`):
   - install, the Euler Stream key, OBS or LIVE Studio setup
   - layout, going live
   - the dos and don'ts from the policy section below
5. **The public GitHub repo** with a README (English and Turkish), screenshots or GIFs, and the demo video linked.

## Architecture (starting point; change it if something is clearly better, and say why)

```
server/   Node + TypeScript.
          Event sources behind one interface:
            - TikTok-Live-Connector (Euler Stream key from .env)
            - TikFinity WebSocket (ws://localhost:21213, Windows hosts)
            - a simulator
          It normalises events, handles gift streaks (apply once per streak or per increment, dedupe),
          rate-limits per viewer, maps gifts to actions from a JSON config, and broadcasts to the scene over a
          local WebSocket. It also serves an operator panel: fire test events, tweak mappings live, pause or reset.
scene/    The web page the stream shows (Vite + Three.js, or PixiJS if 2D looks better).
          It is an OBS Browser Source / LIVE Studio web source at 1080×1920.
config/   Gift → action mappings and scene settings (JSON). The host tunes these without touching code.
```

**Simulator first.** Every feature must be triggerable from the simulator and the operator panel, so the scene can be
built, previewed and demoed with no TikTok account.

## Halay scene v1: default mappings (from what competitors use; tune after testing)

| Trigger | Effect |
| --- | --- |
| Idle | A small group of villager NPCs keeps dancing slowly. The screen is never empty or frozen. |
| Chat `halay` (any case, once per viewer) | A plain dancer with the viewer's name joins the line. |
| Rose | Joins (or upgrades) with a coloured mendil and a name highlight. |
| Mid gifts (Finger Heart, Donut, Perfume, Hand Heart) | Costume upgrades (regional outfits, gold embroidery), the davul or kemençe player, fireworks. |
| Big gift (e.g. Galaxy and up) | Becomes **halay başı** (leader at the head of the line, waving the mendil) until outbid. |
| Huge gifts (Lion, Universe) | **"SIKIŞTIR!"**: the line squeezes together, a zurna solo, giant fireworks, a name banner. |
| Likes | Tempo meter: more likes, faster halay. |
| Follow / share | A small banner or confetti. |
| Always on | Top-5 board ("Halay Ustaları"), combo counters ("x5"), chat bubbles over dancers. |

**Look and feel matter most.** Paid halay games already exist. Ours has to look and sound better:
- characters with real halay footwork and shoulder movement, linked by the little finger
- a village square or wedding setting
- warm light
- davul-zurna audio

## Rules

- **Host presence.** The layout always has room for the host's camera and assumes a host is talking to viewers.
  TikTok demonetizes streams "operated primarily through automated systems without meaningful creator presence".
- **No gift begging.** No looping "send gifts" text, no rewards that are only a transaction, and no pressure tactics.
  On-screen copy describes what gifts *do*, once, calmly.
- **No real gangs** (no Bloods vs Crips), **no religious or ethnic conflict, no religious rituals or funerals** as
  scenes. Those risk an account ban and are already drawing press and prosecutor attention in Turkey. Team formats
  use playful sides (colours, villages, cities as fun), never factions.
- **No gambling mechanics.** No paid spins, random reward draws or raffles.
- **Licences.**
  - TikTok-Live-Connector is AGPL-3.0, so license this repo AGPL-3.0.
  - Use only CC0 or clearly licensed 3D, 2D and audio assets (e.g. Quaternius, KayKit, Kenney, or our own), and list
    each one with its licence in `ASSETS.md`.
  - Don't commit TikTok's gift images; load them from the event payload at runtime.
  - Music must be ours or royalty-free, because TikTok mutes copyrighted audio on LIVE.
- **Secrets.** The Euler Stream key and any tokens go in `.env` (git-ignored), with `.env.example` committed.
  Scan the diff before every push.
- **Public repo hygiene.** No personal names beyond first names, no machine-local paths, no phone numbers.
- **Git.** Commit at coherent checkpoints and push to `main` (stage explicit paths, never `git add -A`, never
  force-push).

## Commands

```bash
npm install
npm run dev                      # scene at http://localhost:5173 (?sim=1 random viewers, ?demo=1 scripted demo, keys j/1-8/l/s/f)
node tools/make-demo-timeline.mjs   # rewrite sim/demo-timeline.json after editing the script
npm run demo:stills -- 5,30,55   # render stills at those seconds to out/
npm run demo:render              # full showcase video → out/live-gift-arena-demo.mp4 (Chrome + ffmpeg + python numpy/scipy)
```

State so far (2026-11-17): the halay scene, simulator and demo renderer exist. Still to do: the TikTok LIVE bridge
(`server/`), the Turkish host guide, and the host camera layout in OBS / LIVE Studio.
