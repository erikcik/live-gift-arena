# live-gift-arena · GIFT WAR

A team war for TikTok LIVE, driven entirely by viewers. Comment **1** or **2** to pick a side, and every gift you send
marches onto the battlefield as a unit with **your username on it**. Each side has its own gift goal that unleashes an
ultimate. The castle that falls first loses.

Demo teams: 🇺🇸 **USA** (Azure Star Legion) vs 🇮🇳 **India** (Saffron Tiger Legion). Teams are config, so they can be
changed in one file.

| Viewer does | On the stream |
| --- | --- |
| comments `1` / `2` | joins a side; a recruit with their name enters the field |
| 🌹 Rose | Warrior |
| 🫰 Finger Heart | Archer |
| 🍩 Doughnut | Knight on horseback |
| 🫶 Hand Heart | Catapult strike: fireballs on the enemy front |
| 💫 Galaxy | Dragon with the gifter's name on it, burning the enemy line |
| 🦁 Lion / 🪐 Universe | Meteor storm, ending on the enemy castle |
| ❤️ likes | Arrow rain |
| fill your side's gift goal | Ultimate: USA **Eagle Strike**, India **Elephant Stampede** |

Each castle falls in a directed slow-motion shot, then a victory screen lists the five top gifters of the winning side.
Big moments (dragons, ultimates, meteors) go through a director that plays one at a time, so nothing gets lost.

**Demo video:** see the latest [release](https://github.com/erikcik/live-gift-arena/releases). It's recorded from the
real scene with simulated viewers ([`sim/demo-timeline.json`](sim/demo-timeline.json)). The soundtrack is synthesised
from the battle's own event log.

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
```

Then open one of these:

- `/?sim=1`: random simulated viewers.
- `/?demo=1`: the scripted demo in real time.
- Keys while it runs (hold Shift for the second team):
  - `j` someone joins
  - `1`–`6` gifts
  - `l` likes
- `/?ws=ws://localhost:8787`: events from a server, normalised as `{type, user, gift, count, text, team}`. The TikTok LIVE bridge is next.

Render the showcase (needs Google Chrome, ffmpeg, and Python with numpy and scipy):

```bash
npm run demo:render              # → out/live-gift-arena-demo.mp4
npm run demo:stills -- 5,20,40   # quick look at given seconds
```

## Layout

```
scene/        the stream page, 1080×1920: PixiJS battle (battle.js), effects (fx.js), canvas HUD (hud.js)
scene/public/ the game art and fonts
config/       teams, gift → unit mappings, unit stats, goals
sim/          the scripted demo session
tools/        demo renderer, soundtrack synth, art generation (tools/art)
docs/         research: the trend, TikTok's rules, event libraries
```

Art, fonts and audio sources are listed in [ASSETS.md](ASSETS.md). License: AGPL-3.0.

---

**TR.** TikTok canlı yayını için izleyicilerin yönettiği bir takım savaşı. Yoruma **1** ya da **2** yazan tarafını
seçiyor. Attığı her hediye kendi kullanıcı adıyla sahaya asker olarak iniyor: gül savaşçı, parmak kalp okçu, donut
şövalye, el kalbi mancınık, galaksi ejderha, evren meteor yağmuru. Her tarafın kendi hediye hedefi var, dolunca
ultimate patlıyor. Önce kalesi düşen kaybediyor ve en çok gönderenler zafer ekranında listeleniyor.
