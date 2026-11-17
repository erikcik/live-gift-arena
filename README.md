# live-gift-arena

Gift-reactive scenes for TikTok LIVE. Viewers comment, like and send gifts, and an animated scene on the stream
reacts in real time.

**Scene 1: Halay.** A village wedding square at dusk with a davulcu and a zurnacı in the middle and a halay line around
them.

| Viewer does | What happens on the stream |
| --- | --- |
| comments `halay` | joins the line with their name |
| 🌹 Gül (Rose) | a red mendil in their hand |
| 🫰 Parmak Kalp (Finger Heart) | regional wedding costume: velvet vest, gold trim, coins on the scarf |
| 🍩 Donut | becomes the davulcu, with their name over the drum |
| 🧴 Parfüm / 🫶 El Kalbi | fireworks over the village |
| 🌌 Galaksi (Galaxy) | leaps to the head of the line as **halay başı**, until someone else takes it |
| 🦁 Aslan / 🪐 Evren | **SIKIŞTIR!** The line squeezes in shoulder to shoulder, with a drum roll, a zurna solo and a sky full of fireworks |
| ❤️ likes | the davul speeds up |
| follow / share | a shout-out and confetti |

The **Halay Ustaları** board ranks the top five senders. The mappings live in [`config/gifts.json`](config/gifts.json).

**Demo video:** see the latest [release](https://github.com/erikcik/live-gift-arena/releases). It is recorded from the
real scene with simulated viewers ([`sim/demo-timeline.json`](sim/demo-timeline.json)), and the davul-zurna
soundtrack is synthesised from the scene's own beat log.

## Run it

```bash
npm install
npm run dev            # http://localhost:5173: the scene, idle
```

Then open one of these:

- `/?sim=1`: random simulated viewers.
- `/?demo=1`: the scripted demo in real time.
- Keys while it runs:
  - `j` someone joins
  - `1`–`8` gifts (Gül … Evren)
  - `l` likes
  - `s` share
  - `f` follow
- `/?ws=ws://localhost:8787`: events from a server (normalised `{type, user, gift, count, text}`).
  The TikTok LIVE bridge is next on the list.

Render the showcase video (needs Google Chrome and ffmpeg; Python with numpy and scipy for the audio):

```bash
npm run demo:render    # → out/live-gift-arena-demo.mp4
npm run demo:stills -- 5,30,55   # quick look at given seconds
```

## Layout

```
scene/    the stream page (Three.js + a 2D overlay), 1080×1920, usable as an OBS / LIVE Studio browser source
config/   gift → effect mappings, tempo settings, the on-screen legend
sim/      the scripted demo session
tools/    the demo renderer and the soundtrack synthesiser
docs/     research: the trend, TikTok's rules, event libraries
```

Everything you see and hear is generated in code: no third-party models, textures or samples (see [ASSETS.md](ASSETS.md)).

---

**TR.** TikTok canlı yayınları için hediyelere tepki veren sahneler. İlk sahne **halay**: akşamüstü bir köy
düğünü, ortada davulcu ile zurnacı, etrafında halay. Yoruma `halay` yazan halaya katılır. Gül atan mendil alır,
Parmak Kalp atan yöresel kıyafet giyer, Donut atan davulun başına geçer, Galaksi atan halay başı olur. Aslan ya da
Evren gelince halka "SIKIŞTIR!" diye sıkışır ve gökyüzü havai fişekle dolar. Beğeniler davulu hızlandırır, en çok
gönderenler "Halay Ustaları" tablosunda görünür.

License: AGPL-3.0.
