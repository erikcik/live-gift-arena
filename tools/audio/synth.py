"""Synthesise the demo soundtrack (epic battle drums, low strings, horns, choir + effects) from the battle's event log.

    python3 tools/audio/synth.py out/demo-log.json out/demo-audio.wav

Everything is generated here from scratch (no samples), so the audio is ours to publish. The log comes from the same
simulation that rendered the frames, so each clash, arrow, roar and explosion lands on its frame, and the music swells
with the battle's measured intensity.
"""
import json
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
rng = np.random.default_rng(11)
BPM = 112
BEAT = 60 / BPM


def filt(x, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output="sos"), x)


def put(buf, t, sig, gain=1.0):
    i = int(round(t * SR))
    if i >= len(buf) or i + len(sig) <= 0:
        return
    if i < 0:
        sig, i = sig[-i:], 0
    n = min(len(sig), len(buf) - i)
    buf[i:i + n] += sig[:n] * gain


def tt(d):
    return np.arange(int(d * SR)) / SR


def noise(d):
    return rng.standard_normal(int(d * SR))


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def saw(f, d, detune=0.0):
    t = tt(d)
    out = np.zeros_like(t)
    for dt in (-detune, 0.0, detune) if detune else (0.0,):
        ph = (t * f * (1 + dt)) % 1.0
        out += 2 * ph - 1
    return out / (3 if detune else 1)


# ---------- instruments ----------
def taiko(strength=1.0):
    t = tt(0.9)
    f = 48 + 60 * np.exp(-t * 22)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.5)
    slap = filt(noise(0.9), "band", [120, 1200]) * np.exp(-t * 28) * 0.6
    return (body * 1.2 + slap) * strength


def snare(strength=1.0):
    t = tt(0.25)
    return (filt(noise(0.25), "band", [900, 6000]) * np.exp(-t * 22) * 0.7 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.4) * strength


def string_note(m, d, bright=0.5):
    s = saw(midi(m), d + 0.08, 0.004)
    t = tt(d + 0.08)
    env = np.clip(t / 0.02, 0, 1) * np.clip((d + 0.08 - t) / 0.08, 0, 1)
    return filt(s, "low", 500 + 1400 * bright) * env * 0.35


def horn_chord(root, d, level=1.0):
    t = tt(d)
    out = np.zeros_like(t)
    for iv in (0, 7, 12):
        out += saw(midi(root + iv), d, 0.003)
    cutoff = 600 + 2200 * np.exp(-t * 3)
    # time-varying lowpass approximated with two filters blended
    lo, hi = filt(out, "low", 700), filt(out, "low", 2600)
    mix = np.exp(-t * 3)
    env = np.clip(t / 0.04, 0, 1) * np.clip((d - t) / 0.25, 0, 1)
    return (lo * (1 - mix) + hi * mix) * env * 0.16 * level


def choir(chord, d, level=1.0):
    t = tt(d)
    out = np.zeros_like(t)
    for m in chord:
        v = 1 + 0.004 * np.sin(2 * np.pi * 5.0 * t + m)
        out += saw(midi(m), d) * 0.5 + np.sin(2 * np.pi * np.cumsum(midi(m) * v) / SR) * 0.5
    voice = filt(out, "band", [650, 950]) + 0.6 * filt(out, "band", [1050, 1350]) + 0.2 * filt(out, "band", [2400, 2900])
    env = np.clip(t / 0.6, 0, 1) * np.clip((d - t) / 0.6, 0, 1)
    return voice * env * 0.12 * level


# ---------- effects ----------
def boom(big=False):
    d = 1.8 if big else 1.1
    t = tt(d)
    b = filt(noise(d), "low", 180 if big else 260) * np.exp(-t * (2.6 if big else 4.0)) * 1.4
    b += np.sin(2 * np.pi * np.cumsum(38 + 40 * np.exp(-t * 8)) / SR) * np.exp(-t * 3.5) * 0.9
    b += filt(noise(d), "band", [600, 3000]) * np.exp(-t * 14) * 0.35
    return b * (0.9 if big else 0.6)


def clash():
    t = tt(0.35)
    ring = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * dcy) for f, dcy in ((2350, 14), (3720, 18), (5180, 24)))
    hit = filt(noise(0.35), "band", [2000, 8000]) * np.exp(-t * 40)
    return (ring * 0.12 + hit * 0.35) * rng.uniform(0.6, 1.0)


def bow():
    t = tt(0.25)
    return (np.sin(2 * np.pi * 160 * t) * np.exp(-t * 18) * 0.25 + filt(noise(0.25), "band", [1500, 5000]) * np.exp(-t * 25) * 0.12)


def whoosh(d=0.5, lo=400, hi=3000):
    n = noise(d)
    t = tt(d)
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    return filt(n, "band", [lo, hi]) * env * 0.3


def roar(d=1.6):
    t = tt(d)
    f = 95 * (1 + 0.25 * np.exp(-t * 2)) * (1 + 0.04 * np.sin(2 * np.pi * 23 * t))
    src = saw(1, d) * 0  # placeholder for shape
    ph = np.cumsum(f) / SR
    tone = 2 * (ph % 1.0) - 1
    growl = tone * (1 + 0.5 * filt(noise(d), "low", 60))
    voice = filt(growl, "band", [300, 900]) + 0.7 * filt(growl, "band", [1200, 2200]) + filt(noise(d), "band", [400, 2500]) * 0.25
    env = np.clip(t / 0.15, 0, 1) * np.clip((d - t) / 0.5, 0, 1)
    return np.tanh(voice * 2.2) * env * 0.35


def screech():
    t = tt(0.7)
    f = 2600 + 900 * np.sin(np.pi * t / 0.7) - 600 * t
    s = np.sin(2 * np.pi * np.cumsum(f) / SR + 3 * np.sin(2 * np.pi * 55 * t))
    return s * np.clip(t / 0.03, 0, 1) * np.exp(-t * 2.5) * 0.12


def trumpet():
    t = tt(1.1)
    f = 330 + 260 * np.clip(t / 0.25, 0, 1) - 60 * np.clip((t - 0.6) / 0.5, 0, 1)
    f = f * (1 + 0.02 * np.sin(2 * np.pi * 7 * t))
    ph = np.cumsum(f) / SR
    s = 2 * (ph % 1.0) - 1
    v = filt(s, "band", [500, 1400]) + 0.6 * filt(s, "band", [1800, 3200])
    return np.tanh(v * 2) * np.clip(t / 0.05, 0, 1) * np.clip((1.1 - t) / 0.3, 0, 1) * 0.22


def war_horn():
    t = tt(1.8)
    f = 110 * (1 + 0.03 * np.clip(t / 0.3, 0, 1))
    s = saw(f, 1.8, 0.002) + 0.5 * saw(f * 1.5, 1.8, 0.002)
    v = filt(s, "low", 900)
    return v * np.clip(t / 0.12, 0, 1) * np.clip((1.8 - t) / 0.5, 0, 1) * 0.35


def fire_roar(d=2.2):
    t = tt(d)
    return filt(noise(d), "band", [150, 1800]) * (0.6 + 0.4 * np.sin(2 * np.pi * 6 * t)) * np.sin(np.pi * np.clip(t / d, 0, 1)) * 0.25


def thud(f=70, d=0.4, g=0.5):
    t = tt(d)
    return (np.sin(2 * np.pi * np.cumsum(f + 40 * np.exp(-t * 20)) / SR) * np.exp(-t * 9) + filt(noise(d), "low", 400) * np.exp(-t * 20) * 0.5) * g


def bell(f, d=1.0, a=0.15):
    t = tt(d)
    return (np.sin(2 * np.pi * f * t) * np.exp(-t * 4) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 8)) * a


def cymbal(d=2.2, a=0.3, swell=False):
    t = tt(d)
    env = (np.clip(t / 0.6, 0, 1) * np.exp(-np.clip(t - 0.6, 0, None) * 3)) if swell else np.exp(-t * 2.2)
    return filt(noise(d), "high", 5000) * env * a


def main():
    log = json.load(open(sys.argv[1]))
    out_path = sys.argv[2]
    dur = float(log["duration"])
    n = int((dur + 0.5) * SR)
    drums, music, fx = np.zeros(n), np.zeros(n), np.zeros(n)

    inten = log.get("intensity", [])
    it = np.array([p["t"] for p in inten]) if inten else np.array([0.0, dur])
    iv = np.array([p["v"] for p in inten]) if inten else np.array([0.3, 0.3])
    sm = np.convolve(iv, np.ones(8) / 8, mode="same")

    def level(t):
        return float(np.interp(t, it, sm))

    events = log["sfx"]
    victory = next((e["t"] for e in events if e["type"] == "victory"), None)
    collapse = next((e["t"] for e in events if e["type"] == "collapse"), None)
    endcard = next((e["t"] for e in events if e["type"] == "endcard"), dur - 5)
    battle_end = collapse if collapse else endcard

    # Battle music: D minor, bars of 4 beats, bass i - VII - VI - V.
    bass = [38, 36, 34, 33]
    chords = [[62, 65, 69], [60, 64, 67], [58, 62, 65], [57, 61, 64]]
    bar = 4 * BEAT
    t = 0.0
    k = 0
    while t < battle_end + 0.01:
        lv = level(t)
        intro = t < 2 * bar
        root = bass[k % 4]
        # taiko groove
        for b, s in ((0, 1.2), (1.5, 0.7), (2, 1.0), (3, 0.8), (3.5, 0.5)):
            if intro and b not in (0, 2):
                continue
            put(drums, t + b * BEAT, taiko(s * (0.7 + 0.5 * lv)))
        if lv > 0.35 and not intro:
            for s16 in range(16):
                if s16 % 4 in (1, 3) or (lv > 0.65 and s16 % 2):
                    put(drums, t + s16 * BEAT / 4, snare(0.25 + 0.35 * lv))
        # string ostinato (eighths)
        if not intro or t > bar:
            for e in range(8):
                m = root + (12 if e % 2 else 0)
                put(music, t + e * BEAT / 2, string_note(m, BEAT / 2 - 0.02, 0.3 + 0.6 * lv), 0.8 + 0.4 * lv)
        # choir pad
        put(music, t, choir(chords[k % 4], bar + 0.4, 0.6 + 0.8 * lv))
        # horn stabs on strong bars
        if lv > 0.45 and not intro:
            put(music, t, horn_chord(root + 12, BEAT * 1.6, 0.6 + 0.6 * lv))
        t += bar
        k += 1

    # Victory: D major fanfare, timpani roll, cymbal; then a held chord under the cards.
    if victory:
        tv = victory
        for s in range(14):
            put(drums, tv - 0.9 + s * 0.065, taiko(0.25 + s * 0.04))
        put(fx, tv, cymbal(3.0, 0.35))
        for k2, (m, d) in enumerate([(62, 0.22), (66, 0.22), (69, 0.22), (74, 1.4)]):
            put(music, tv + k2 * 0.24, horn_chord(m, d + 0.3, 1.4))
        put(music, tv + 0.72, choir([62, 66, 69, 74], endcard - tv + 2.5, 1.6))
        for b in range(0, int((endcard - tv) / BEAT)):
            if b % 4 == 0:
                put(drums, tv + 0.72 + b * BEAT, taiko(0.6))
    put(music, endcard, choir([50, 57, 62, 66], dur - endcard + 0.5, 0.9))

    # Effects from the log.
    for e in events:
        t0, ty = e["t"], e["type"]
        if ty == "clash":
            put(fx, t0, clash(), 0.9)
        elif ty == "bow":
            put(fx, t0, bow())
        elif ty == "volley":
            for j in range(6):
                put(fx, t0 + j * 0.05, whoosh(0.4, 1500, 6000), 0.5)
        elif ty in ("boom", "boomBig"):
            put(fx, t0, boom(ty == "boomBig"))
        elif ty == "spawn":
            put(fx, t0, whoosh(0.25, 800, 4000), 0.4)
            put(fx, t0 + 0.05, bell(1568, 0.5, 0.05))
        elif ty == "join":
            put(fx, t0, bell(1318.5, 0.6, 0.08))
        elif ty == "die":
            put(fx, t0, thud(90, 0.3, 0.25))
        elif ty == "catapult":
            put(fx, t0, thud(60, 0.5, 0.4))
            put(fx, t0 + 0.1, whoosh(0.9, 200, 1500), 0.8)
        elif ty == "dragon":
            put(fx, t0 + 0.3, roar(1.8))
        elif ty == "fireBreath":
            put(fx, t0, fire_roar(2.4))
        elif ty == "eagle":
            put(fx, t0 + 0.2, screech())
            put(fx, t0, whoosh(1.2, 300, 3000), 0.7)
        elif ty == "elephant":
            put(fx, t0 + 0.4, trumpet())
        elif ty == "stomp":
            put(fx, t0, thud(45, 0.5, 0.45))
        elif ty == "meteorStart":
            put(fx, t0, filt(noise(3.0), "low", 120) * np.sin(np.pi * np.clip(tt(3.0) / 3.0, 0, 1)) * 0.8)
        elif ty == "meteorWhoosh":
            put(fx, t0, whoosh(0.8, 200, 2500), 1.0)
        elif ty == "castleHit":
            put(fx, t0, thud(80, 0.3, 0.3))
        elif ty == "crack":
            put(fx, t0, filt(noise(0.2), "band", [1500, 7000]) * np.exp(-tt(0.2) * 20) * 0.5)
        elif ty == "collapse":
            put(fx, t0, filt(noise(3.5), "low", 160) * np.exp(-tt(3.5) * 0.8) * 1.2)
            for j in range(24):
                put(fx, t0 + rng.uniform(0.2, 2.5), thud(rng.uniform(60, 140), 0.3, 0.25))
        elif ty == "horn":
            put(fx, t0, war_horn())
            put(fx, t0, cymbal(2.0, 0.2, swell=True))
        elif ty == "banner":
            put(fx, t0, taiko(0.9))
            put(fx, t0, cymbal(1.6, 0.15))
        elif ty == "endcard":
            put(fx, t0, whoosh(1.0, 200, 4000), 0.5)

    dry = drums * 0.9 + music * 1.0 + fx * 0.85
    ir_t = tt(1.8)
    st = []
    for side in range(2):
        ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 3.6)
        ir = filt(ir, "low", 6000)
        ir /= np.sqrt(np.sum(ir ** 2))
        wet = fftconvolve(dry, ir)[:n]
        pan = (drums * (0.95 if side else 1.0) + music * (1.0 if side else 0.92) + fx * 0.85)
        st.append(pan + 0.24 * wet)
    st = np.stack(st, axis=1)
    st /= np.max(np.abs(st)) + 1e-9
    st = np.tanh(st * 1.5) / np.tanh(1.5) * 0.92
    fade = np.clip((dur - np.arange(n) / SR) / 1.5, 0, 1)
    st *= fade[:, None]
    st[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]
    wavfile.write(out_path, SR, (st * 32767).astype(np.int16))
    print(f"wrote {out_path} ({dur:.1f}s, {len(events)} effects)")


if __name__ == "__main__":
    main()
