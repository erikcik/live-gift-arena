# Assets

## Art (`scene/public/art/`)

The illustrated game art was generated for this project with OpenAI's gpt-image-2, run through the WaveSpeed API:
- the background painting
- both castles
- the warriors, archers and knights of each team
- the dragon
- the war eagle and the war elephant

The prompts are in `tools/art/` and the per-asset cost log is in `art/costs.jsonl`. The orange warrior is the style
reference that every other asset was edited from, which keeps the set consistent. `tools/art/prepare.py` crops and
scales the raw images into game assets, and derives the blue dragon from the fire dragon by a hue shift. Raw outputs
(`art/raw/`) are not committed.

These are not TikTok gift images: gifts are shown as emoji. Flags are drawn in code.

## Effects

Glows, smoke, sparks, rings, arrows, meteors and debris are drawn on canvases at runtime (`scene/src/textures.js`).

## Fonts (`scene/public/fonts/`)

- **Lilita One** by Juan Montoreano, SIL Open Font License 1.1 (`OFL-lilitaone.txt`).
- **Rubik** by Hubert & Fischer, SIL Open Font License 1.1 (`OFL-rubik.txt`).

## Audio

Music (drums, low strings, horns, choir) and every sound effect are synthesised in `tools/audio/synth.py`. No samples
are used.

## Code

[PixiJS](https://github.com/pixijs/pixijs) (MIT), [pixi-filters](https://github.com/pixijs/filters) (MIT),
[Vite](https://github.com/vitejs/vite) (MIT), [playwright-core](https://github.com/microsoft/playwright) (Apache-2.0,
demo rendering only).
