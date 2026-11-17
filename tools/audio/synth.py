"""Synthesise the demo soundtrack (davul + zurna + effects) from the scene's beat log.

    python3 tools/audio/synth.py out/demo-log.json out/demo-audio.wav

Everything is generated here from scratch (no samples), so the audio is ours to publish.
The beat log comes from the same simulation that rendered the frames, so the drum hits
land exactly on the dancers' steps, and every gift effect has its sound at the same moment.
"""
import json
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
rng = np.random.default_rng(5)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def put(buf, t, sig, gain=1.0):
    i = int(round(t * SR))
    if i >= len(buf) or i + len(sig) <= 0:
        return
    if i < 0:
        sig = sig[-i:]
        i = 0
    n = min(len(sig), len(buf) - i)
    buf[i : i + n] += sig[:n] * gain


def tt(d):
    return np.arange(int(d * SR)) / SR


# ---------- davul ----------
def dum(strength=1.0):
    t = tt(0.7)
    f = 50 + 75 * np.exp(-t * 26)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.0)
    thump = lp(rng.standard_normal(len(t)), 300) * np.exp(-t * 35) * 0.9
    skin = bp(rng.standard_normal(len(t)), 150, 900) * np.exp(-t * 18) * 0.35
    return (body * 1.1 + thump + skin) * strength


def tek(strength=1.0):
    t = tt(0.14)
    n = hp(rng.standard_normal(len(t)), 1800) * np.exp(-t * 48)
    knock = np.sin(2 * np.pi * 1150 * t) * np.exp(-t * 80) * 0.5
    return (n * 0.55 + knock) * strength


def clap():
    out = np.zeros(int(0.12 * SR))
    for _ in range(7):
        t = tt(0.09)
        c = bp(rng.standard_normal(len(t)), 900, 3200) * np.exp(-t * 55)
        put(out, rng.uniform(0, 0.025), c, rng.uniform(0.5, 1.0))
    return out * 0.5


# ---------- zurna ----------
HARM = np.array([1.0, 0.85, 0.95, 0.7, 0.62, 0.5, 0.42, 0.33, 0.27, 0.2, 0.15, 0.11, 0.08, 0.06])


def zurna_note(freq, dur, amp=1.0):
    rel = 0.035
    t = tt(dur + rel)
    vib = 1 + 0.0065 * np.sin(2 * np.pi * 5.7 * t) * np.clip(t / 0.18, 0, 1)
    scoop = 1 - 0.035 * np.exp(-t * 45)
    ph = 2 * np.pi * np.cumsum(freq * vib * scoop) / SR
    w = np.zeros_like(t)
    for k, a in enumerate(HARM, start=1):
        if freq * k > 9000:
            break
        w += a * np.sin(k * ph + 0.3 * k)
    breath = bp(rng.standard_normal(len(t)), 1500, 5000) * 0.05
    env = np.clip(t / 0.012, 0, 1) * np.clip((dur + rel - t) / rel, 0, 1)
    return (w * 0.22 + breath) * env * amp


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# Hicaz on D. Durations in eighths (2 per beat).
D4, Eb4, Fs4, G4, A4, Bb4, C5, D5, Eb5, Fs5, G5 = 62, 63, 66, 67, 69, 70, 72, 74, 75, 78, 79
PHRASE_A = [
    (A4, 1), (A4, 1), (Bb4, 1), (A4, 1), (G4, 1), (Fs4, 1), (G4, 2),
    (A4, 1), (Bb4, 1), (C5, 1), (Bb4, 1), (A4, 1), (G4, 1), (A4, 2),
    (Bb4, 1), (A4, 1), (G4, 1), (Fs4, 1), (G4, 1), (Fs4, 1), (Eb4, 1), (Fs4, 1),
    (G4, 1), (Fs4, 1), (Eb4, 1), (Fs4, 1), (D4, 4),
]
PHRASE_B = [
    (D5, 2), (C5, 1), (Bb4, 1), (A4, 2), (Bb4, 1), (A4, 1),
    (G4, 1), (A4, 1), (Bb4, 1), (C5, 1), (D5, 4),
    (Eb5, 1), (D5, 1), (C5, 1), (Bb4, 1), (A4, 1), (Bb4, 1), (C5, 2),
    (Bb4, 1), (A4, 1), (G4, 1), (Fs4, 1), (G4, 1), (Fs4, 1), (Eb4, 1), (D4, 1),
]
RIFF_TRILL = [(D5, 0.5), (Eb5, 0.5)] * 8
RIFF_RUN = [(Fs5, 1), (G5, 1), (Fs5, 1), (Eb5, 1), (D5, 1), (C5, 1), (Bb4, 1), (A4, 1)]


def main():
    log = json.load(open(sys.argv[1]))
    out_path = sys.argv[2]
    dur = float(log["duration"])
    n = int((dur + 0.5) * SR)
    drums = np.zeros(n)
    zurna = np.zeros(n)
    fx = np.zeros(n)
    crowd = np.zeros(n)

    beats = [{"t": 0.0, "i": 0, "bpm": 102, "sq": 0}] + log["beats"]
    bt = np.array([b["t"] for b in beats])
    if len(bt) < 2:
        raise SystemExit("no beats in log")
    period_end = bt[-1] - bt[-2]

    def time_of(bpos):
        i = int(np.floor(bpos))
        f = bpos - i
        if i + 1 < len(bt):
            return bt[i] + f * (bt[i + 1] - bt[i])
        return bt[-1] + (bpos - (len(bt) - 1)) * period_end

    endcard = next((e["t"] for e in log["sfx"] if e["type"] == "endcard"), None)
    music_end = dur - 0.3

    # Davul pattern: düm on the beat, tek on the off-beats; rolls while the line squeezes.
    for b in beats:
        i, t, sq = b["i"], b["t"], b["sq"]
        if t > music_end:
            break
        p = time_of(i + 1) - t
        accent = 1.25 if i % 4 == 3 else 1.0
        put(drums, t, dum(accent))
        if sq > 0.3:
            for off in (0.25, 0.5, 0.75):
                put(drums, t + off * p, tek(0.8 + 0.2 * rng.random()))
            put(drums, t + 0.5 * p, dum(0.6))
        else:
            put(drums, t + 0.5 * p, tek(0.9))
            put(drums, t + 0.75 * p, tek(0.55))
            if i % 4 == 3:
                put(drums, t + 0.25 * p, tek(0.5))
        if (sq > 0.3 or b["bpm"] > 118) and t > 5:
            put(crowd, t + 0.01, clap(), 0.7 if sq > 0.3 else 0.4)

    # Zurna from beat 8: phrase A, phrase B, repeat; the riff while the line squeezes.
    sq_beats = {b["i"] for b in beats if b["sq"] > 0.3}
    bpos = 8.0
    seq = []
    while time_of(bpos) < music_end - 1.0:
        block = int(bpos)
        if any(k in sq_beats for k in range(block, block + 4)):
            notes = RIFF_TRILL if (block // 4) % 2 == 0 else RIFF_RUN
            seq.extend((m, e, True) for m, e in notes)
            bpos += sum(e for _, e in notes) / 2
        else:
            for m, e in PHRASE_A + PHRASE_B:
                seq.append((m, e, False))
                bpos += e / 2
                if time_of(bpos) >= music_end - 1.0:
                    break
                if any(k in sq_beats for k in range(int(bpos), int(bpos) + 2)):
                    break
    bpos = 8.0
    for m, e, hot in seq:
        t0, t1 = time_of(bpos), time_of(bpos + e / 2)
        if t0 >= music_end - 0.8:
            break
        d = max(0.05, t1 - t0 - 0.012)
        if e >= 2 and not hot:
            put(zurna, t0 - 0.05, zurna_note(midi(m + 1), 0.05, 0.8))
        put(zurna, t0, zurna_note(midi(m), d, 1.15 if hot else 1.0))
        bpos += e / 2

    # Final held note and closing hits under the end card.
    if endcard is None:
        endcard = dur - 5
    put(zurna, endcard + 0.1, zurna_note(midi(D5), 3.2, 1.0))
    for k, s in enumerate([1.3, 1.0, 1.6]):
        put(drums, endcard + 0.1 + k * 0.28, dum(s))

    # Effects.
    def bell(f, d=1.2, a=0.25):
        t = tt(d)
        return (np.sin(2 * np.pi * f * t) * np.exp(-t * 4) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 8)
                + 0.2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 14)) * a

    def crash(d=1.6, a=0.35):
        t = tt(d)
        return hp(rng.standard_normal(len(t)), 4000) * np.exp(-t * 2.6) * a

    for e in log["sfx"]:
        t, kind = e["t"], e["type"]
        if kind == "join":
            s = tt(0.09)
            put(fx, t, np.sin(2 * np.pi * np.cumsum(650 + 900 * s / 0.09) / SR) * np.exp(-s * 40) * 0.22)
        elif kind == "chime":
            for k, f in enumerate([1318.5, 1568.0, 2093.0]):
                put(fx, t + k * 0.07, bell(f, 1.0, 0.16))
        elif kind == "shimmer":
            for _ in range(16):
                put(fx, t + rng.uniform(0, 0.9), bell(rng.uniform(2000, 4800), 0.5, 0.06))
        elif kind == "drumroll":
            for k in range(14):
                put(drums, t + 0.9 * (k / 14) ** 0.8, tek(0.5 + 0.5 * k / 14))
            put(drums, t + 0.95, dum(1.3))
        elif kind == "launch":
            s = tt(0.85)
            f = 900 + 1700 * s / 0.85
            put(fx, t, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.clip(s / 0.1, 0, 1) * np.exp(-s * 1.5) * 0.05)
            put(fx, t, bp(rng.standard_normal(len(s)), 2000, 7000) * np.exp(-s * 3) * 0.05)
        elif kind in ("boom", "boom_big"):
            big = kind == "boom_big"
            s = tt(1.4 if big else 1.0)
            b = lp(rng.standard_normal(len(s)), 220) * np.exp(-s * (3 if big else 4.5)) * (1.0 if big else 0.7)
            b += np.sin(2 * np.pi * 42 * s) * np.exp(-s * 5) * 0.5
            put(fx, t, b * 0.5)
            for _ in range(28 if big else 14):
                c = tt(0.02)
                put(fx, t + rng.uniform(0.25, 1.4), hp(rng.standard_normal(len(c)), 3000) * np.exp(-c * 300) * 0.12)
        elif kind == "ding":
            put(fx, t, bell(1760, 0.9, 0.14))
        elif kind == "confetti":
            s = tt(0.3)
            put(fx, t, bp(rng.standard_normal(len(s)), 2500, 8000) * np.exp(-s * 12) * 0.35)
            put(fx, t, np.sin(2 * np.pi * 320 * s) * np.exp(-s * 40) * 0.3)
        elif kind == "leader":
            put(fx, t, crash(1.8, 0.22))
            for k, f in enumerate([1046.5, 1318.5, 1568.0, 2093.0]):
                put(fx, t + 0.05 + k * 0.09, bell(f, 1.4, 0.15))
            put(drums, t, dum(1.4))
        elif kind == "sikistir":
            put(fx, t + 0.5, crash(2.4, 0.4))
            for k in range(3):
                put(drums, t + 0.5 + k * 0.14, dum(1.5))

    # Crowd murmur under everything, louder when the line squeezes.
    murmur = bp(rng.standard_normal(n), 250, 1800, order=3)
    sw = np.interp(np.arange(n) / SR, [b["t"] for b in beats], [0.6 + 1.4 * b["sq"] for b in beats])
    crowd += murmur * 0.035 * sw * (0.7 + 0.3 * np.sin(np.arange(n) / SR * 0.9))

    # Zurna colour: nasal formants and a little saturation.
    zurna = hp(zurna, 350) + 0.7 * bp(zurna, 950, 1500) + 0.45 * bp(zurna, 2400, 3300)
    zurna = np.tanh(zurna * 1.6) / 1.6

    dry_l = drums * 1.0 + zurna * 0.82 + fx * 0.9 + crowd
    dry_r = drums * 0.92 + zurna * 0.95 + fx * 0.9 + crowd

    # Open-air reverb.
    ir_t = tt(1.5)
    wet = []
    for ch in (dry_l, dry_r):
        ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 4.2)
        ir = lp(ir, 5000)
        ir /= np.sqrt(np.sum(ir ** 2))
        wet.append(fftconvolve(ch, ir)[:n])
    L = dry_l + 0.22 * wet[0]
    R = dry_r + 0.22 * wet[1]
    st = np.stack([L, R], axis=1)
    st /= np.max(np.abs(st)) + 1e-9
    st = np.tanh(st * 1.4) / np.tanh(1.4) * 0.92
    fade = np.clip((dur - np.arange(n) / SR) / 1.6, 0, 1)
    st *= fade[:, None]
    st[: int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))[:, None]
    wavfile.write(out_path, SR, (st * 32767).astype(np.int16))
    print(f"wrote {out_path} ({dur:.1f}s, {len(log['beats'])} beats, {len(log['sfx'])} effects)")


if __name__ == "__main__":
    main()
