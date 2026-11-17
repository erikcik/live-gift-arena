"""Turn the generated art in art/raw/ into game-ready assets in scene/public/art/.

Crops each sprite to its visible pixels, scales it to the size the game draws it at (2x headroom is not needed:
the stage is 1080x1920), derives the blue dragon by hue-shifting the fire dragon, and writes the background.
"""
import colorsys
import numpy as np
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "art" / "raw"
OUT = ROOT / "scene" / "public" / "art"
OUT.mkdir(parents=True, exist_ok=True)

# name: target height in px (sprites keep their aspect)
SPRITES = {
    "warrior_orange": 300, "warrior_blue": 300,
    "archer_orange": 300, "archer_blue": 300,
    "knight_orange": 300, "knight_blue": 300,
    "elephant_orange": 460, "eagle_blue": 420,
    "dragon": 440,
    "castle_orange": 760, "castle_blue": 760,
}


def trim(im):
    a = np.array(im)[..., 3]
    ys, xs = np.where(a > 8)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def hue_shift(im, target_hue):
    arr = np.array(im).astype(np.float32) / 255.0
    rgb = arr[..., :3]
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    out = rgb.copy()
    flat = rgb.reshape(-1, 3)
    o = out.reshape(-1, 3)
    s = sat.reshape(-1)
    for i in np.where(s > 0.18)[0]:
        h, l, ss = colorsys.rgb_to_hls(*flat[i])
        # warm hues (reds/oranges/golds) → blues; keep lightness, keep saturation
        if h < 0.17 or h > 0.92:
            nh = target_hue + (h if h < 0.17 else h - 1.0) * 0.6
            o[i] = colorsys.hls_to_rgb(nh % 1.0, l, ss)
    arr[..., :3] = out
    return Image.fromarray((arr * 255).clip(0, 255).astype(np.uint8), "RGBA")


for name, h in SPRITES.items():
    im = trim(Image.open(RAW / f"{name}.png").convert("RGBA"))
    w = round(im.width * h / im.height)
    im = im.resize((w, h), Image.LANCZOS)
    im.save(OUT / f"{name}.png", optimize=True)
    if name == "dragon":
        small = im
        hue_shift(small, 0.6).save(OUT / "dragon_blue.png", optimize=True)
        small.save(OUT / "dragon_orange.png", optimize=True)
        (OUT / "dragon.png").unlink()
    print(name, im.size)

bg = Image.open(RAW / "background.png").convert("RGB").resize((1080, 1920), Image.LANCZOS)
bg.save(OUT / "background.jpg", quality=92)
print("background", bg.size)
