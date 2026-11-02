"""The office around the desk: ambience layers that sit under the music with the room tone (make_sfx.py's
"room": fan, mains hum, CRT whine). js/audio.js mixes them by notice stage:

  amb_office  the open-plan office through the partition, 48 s loop: distant typing in bursts from two desks,
              a chair. Thins out, then stops. (Synthesized wordless talk was tried and read as a synth line.)
  amb_phone   one-shots the game fires at random while the office is there: a 1990s desk phone's electronic
  amb_drawer  warble on another desk, a drawer shut.
  amb_tube    the fluorescent tube overhead, 20 s loop: 100 Hz buzz with harmonics and the odd flicker tick.
              Grows as the room empties; the game also lets it sag in pitch.
  amb_under   something under the floor, 64 s loop: a low drone on F, and the Corps chime's notes (C A D F)
              swelling in and out far down, never in order, a little out of tune with each other.

Everything is loop-safe (events wrap round the loop point; filters run over two copies).

  uv run --project ~/Projects/MusicStudio --all-extras --with scipy python tools/audio/make_ambience.py
"""
from __future__ import annotations

import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

sys.path.insert(0, str(Path(__file__).parent))
from synth import on_loop, room as reverb  # noqa: E402

SR = 44100
TAU = 2 * np.pi
ROOT = Path(__file__).resolve().parents[2]
WORK = Path(__file__).parent / "out/amb"
OUT = ROOT / "game/assets/sfx"


def filt(kind, f, o=2):
    sos = butter(o, f, kind, fs=SR, output="sos")
    return lambda x: sosfilt(sos, x)


def place(loop: np.ndarray, x: np.ndarray, t: float) -> None:
    """Add x into the loop at t seconds, wrapping round the end."""
    n = len(loop)
    a = int(t * SR) % n
    for k in range(0, len(x), n):
        seg = x[k:k + n]
        first = seg[: n - a]
        loop[a:a + len(first)] += first
        loop[: len(seg) - len(first)] += seg[len(first):]


def env(n, a, r):
    e = np.ones(n)
    ka, kr = int(a * SR), int(r * SR)
    e[:ka] = np.linspace(0, 1, ka)
    e[n - kr:] *= np.linspace(1, 0, kr)
    return e


def office(sec=48.0, seed=3):
    rng = np.random.default_rng(seed)
    n = int(sec * SR)
    x = np.zeros(n)
    # typing: bursts of key clicks from two desks
    for desk, (rate, level) in enumerate(((7.5, 0.5), (5.5, 0.35))):
        t = rng.uniform(0, 4)
        while t < sec:
            burst = rng.uniform(1.5, 6)
            k = t
            while k < t + burst:
                click = rng.normal(0, 1, int(0.012 * SR)) * np.exp(-np.arange(int(0.012 * SR)) / (0.002 * SR))
                thock = np.sin(TAU * rng.uniform(180, 260) * np.arange(int(0.02 * SR)) / SR) * np.exp(-np.arange(int(0.02 * SR)) / (0.004 * SR))
                thock[: len(click)] += click * 1.2
                place(x, thock * 0.35 * level * rng.uniform(0.6, 1.0), k)
                k += rng.exponential(1 / rate) + 0.04
            t += burst + rng.uniform(3, 12)
    # through the partition: no highs, a small room
    x = on_loop(lambda y: filt("lowpass", 1100, 4)(filt("highpass", 140)(y)), x)
    return reverb(x, 0.35, 1.4)


def phone():
    """A desk phone on the far side of the partition: the electronic warble of a 1990s office set, two rings."""
    m = int(1.2 * SR)
    tt = np.arange(m) / SR
    sw = np.sign(np.sin(TAU * 16 * tt))
    hz = np.where(sw > 0, 1040, 1300)
    ring = np.sin(TAU * np.cumsum(hz) / SR) * env(m, 0.01, 0.08)
    out = np.zeros(int(4.2 * SR))
    for a in (0.0, 2.6):
        k = int(a * SR); out[k:k + m] += ring
    out = filt("lowpass", 1150, 4)(filt("highpass", 300)(out))
    return reverb(np.concatenate([out, np.zeros(SR)]), 0.5, 1.2)


def drawer():
    rng = np.random.default_rng(12)
    m = int(0.45 * SR)
    slide = filt("bandpass", [200, 900])(rng.normal(0, 1, m)) * env(m, 0.03, 0.12)
    tt = np.arange(int(0.14 * SR)) / SR
    thud = (np.sin(TAU * 90 * tt) + 0.5 * np.sin(TAU * 140 * tt)) * np.exp(-tt / 0.03)
    out = np.concatenate([slide * 0.5, thud * 0.9, np.zeros(int(0.6 * SR))])
    return reverb(filt("lowpass", 1200)(out), 0.45, 1.2)


def tube(sec=20.0, seed=5):
    rng = np.random.default_rng(seed)
    n = int(sec * SR)
    t = np.arange(n) / SR
    buzz = sum(np.sin(TAU * 100 * k * t + rng.uniform(0, 6)) / k ** 1.8 for k in range(1, 7))
    x = buzz * (0.85 + 0.15 * np.sin(TAU * 0.25 * t))  # 5 cycles per loop: seamless
    dip = np.ones(n)
    for t0 in rng.uniform(0, sec, 3):  # flicker: the buzz sags for a moment, smoothly
        a, m = int(t0 * SR), int(rng.uniform(0.08, 0.2) * SR)
        idx = (a + np.arange(m)) % n
        dip[idx] = np.minimum(dip[idx], 1 - 0.55 * np.sin(np.pi * np.arange(m) / m))
    return on_loop(lambda y: filt("lowpass", 1200, 4)(filt("highpass", 70)(y)), x * dip) * 0.5


def under(sec=64.0, seed=9):
    rng = np.random.default_rng(seed)
    n = int(sec * SR)
    t = np.arange(n) / SR
    f = 87.31  # F2
    # whole cycles per loop on every partial, so the drone loops cleanly (each frequency nudged to fit)
    fit = lambda hz: round(hz * sec) / sec
    drone = sum(np.sin(TAU * fit(hz) * t) * g for hz, g in ((f, 1.0), (f * 1.5, 0.45), (f * 2, 0.35), (f * 1.003, 0.6)))
    drone *= 0.7 + 0.3 * np.sin(TAU * t / sec * 2)
    x = drone * 0.5
    # the chime's notes, far down: C5 A4 D5 F5, each swelling in and out, out of order, slightly off
    notes = [523.25, 440.0, 587.33, 698.46]
    for i, t0 in enumerate(np.linspace(4, sec - 4, 9)):
        hz = notes[[2, 0, 3, 1, 0, 2, 1, 3, 0][i]] * 2 ** (rng.uniform(-18, 18) / 1200)
        m = int(rng.uniform(6, 10) * SR)
        tt = np.arange(m) / SR
        tone = (np.sin(TAU * hz * tt) + 0.3 * np.sin(TAU * hz * 2.01 * tt)) * np.sin(np.pi * tt / tt[-1]) ** 2
        place(x, filt("lowpass", 800)(tone) * 0.06, t0)
    breath = on_loop(lambda y: filt("bandpass", [60, 400])(y), rng.normal(0, 1, n)) * 0.15
    return reverb(x + breath, 0.4, 1.8)


def write(name, x, peak):
    x = x / np.abs(x).max() * peak
    WORK.mkdir(parents=True, exist_ok=True)
    wav = WORK / f"{name}.wav"
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "libvorbis", "-q:a", "3", str(OUT / f"{name}.ogg")], check=True)
    print(f"{name}: {len(x) / SR:.1f}s")


if __name__ == "__main__":
    write("amb_office", office(), 0.6)
    write("amb_phone", phone(), 0.5)
    write("amb_drawer", drawer(), 0.5)
    write("amb_tube", tube(), 0.5)
    write("amb_under", under(), 0.6)
