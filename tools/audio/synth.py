"""A small numpy synth for MusicStudio note lists, voiced like a late-90s office PC.

MusicStudio decides the notes; this decides what they sound like. Patches are functions
(freq, seconds_held, velocity, rng) -> samples. `render_loop` places notes into a buffer of fixed
length and wraps tails around the loop point, so every render is a seamless loop.

Patches: fm_epiano (two-operator "glassy" e-piano), vibes (motor tremolo, mallet click), fretless
(slide-in bass), gm_strings (three detuned saws), corps_bell (inharmonic FM chime), tick, soft_kick, shaker.

Degradation is per voice and per note, not only on the master: `detune` (a slow periodic random walk
in cents, different for every voice) and `dropout` (notes cut off as if their voice was stolen).
Effects (speaker, crush, room, slips, stutter, hum) work on loops and keep them seamless.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import numpy as np
from scipy.signal import butter, lfilter, sosfilt

SR = 44100
TAU = 2 * np.pi


def _t(sec: float) -> np.ndarray:
    return np.arange(max(1, int(sec * SR))) / SR


def _release(n_hold: int, n_total: int, rel: float) -> np.ndarray:
    """1 while held, then an exponential release."""
    e = np.ones(n_total)
    k = n_total - n_hold
    if k > 0:
        e[n_hold:] = np.exp(-np.arange(k) / SR / max(1e-3, rel / 5))
    return e


def _attack(n: int, a: float) -> np.ndarray:
    e = np.ones(n)
    ai = min(n, max(1, int(a * SR)))
    e[:ai] = np.linspace(0, 1, ai)
    return e


# ---- patches --------------------------------------------------------------------------------
def fm_epiano(f, held, vel, rng):
    rel = 0.18
    t = _t(held + rel)
    n_hold = int(held * SR)
    out = 0
    for det in (-4, 4):  # two slightly detuned copies: the cheap chorus
        ff = f * 2 ** (det / 1200)
        body_i = 1.1 * np.exp(-t * 2.5) + 0.25
        tine_i = 2.2 * np.exp(-t * 45)
        out = out + np.sin(TAU * ff * t + body_i * np.sin(TAU * ff * t)) * 0.8 \
            + 0.22 * np.sin(TAU * ff * t + tine_i * np.sin(TAU * 14 * ff * t)) * np.exp(-t * 6)
    env = np.exp(-t * (0.9 + f / 900)) * _attack(len(t), 0.002) * _release(n_hold, len(t), rel)
    return out * env * 0.5 * vel


def vibes(f, held, vel, rng, tremolo=5.2):
    ring = max(held, 0.25) + 0.6
    t = _t(ring)
    bar = (np.sin(TAU * f * t) + 0.32 * np.sin(TAU * f * 3.98 * t) * np.exp(-t * 6)
           + 0.09 * np.sin(TAU * f * 9.6 * t) * np.exp(-t * 14))
    env = np.exp(-t * 1.3) * _attack(len(t), 0.001)
    trem = 1 - 0.3 * (0.5 + 0.5 * np.sin(TAU * tremolo * t + rng.uniform(0, TAU)))
    click = np.zeros(len(t))
    k = int(0.006 * SR)
    click[:k] = rng.standard_normal(k) * np.exp(-np.arange(k) / (0.0012 * SR)) * 0.25
    return (bar * env * trem + click) * 0.45 * vel


def fretless(f, held, vel, rng):
    rel = 0.09
    t = _t(held + rel)
    n_hold = int(held * SR)
    slide = 2 ** (-35 / 1200 * np.exp(-t / 0.03))  # slides up into the note
    ph = TAU * np.cumsum(f * slide) / SR
    x = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph) + 0.05 * np.sin(4 * ph)
    env = (0.55 + 0.45 * np.exp(-t * 5)) * _attack(len(t), 0.006) * _release(n_hold, len(t), rel)
    return x * env * 0.55 * vel


def gm_strings(f, held, vel, rng):
    rel = 0.45
    t = _t(held + rel)
    n_hold = int(held * SR)
    x = 0
    for det in (-9, 0, 8):
        ff = f * 2 ** (det / 1200)
        ph = (ff * t + rng.random()) % 1.0
        x = x + (2 * ph - 1)
    x = sosfilt(butter(2, min(2600, f * 6), "low", fs=SR, output="sos"), x)
    env = _attack(len(t), 0.28) * _release(n_hold, len(t), rel)
    return x * env * 0.16 * vel


def corps_bell(f, held, vel, rng):
    t = _t(max(held, 0.3) + 1.8)
    i = 2.6 * np.exp(-t * 2.2)
    x = np.sin(TAU * f * t + i * np.sin(TAU * f * 1.414 * t)) + 0.3 * np.sin(TAU * f * 2 * t) * np.exp(-t * 3)
    env = np.exp(-t * 1.4) * _attack(len(t), 0.001)
    return x * env * 0.5 * vel


def music_box(f, held, vel, rng):
    """A small comb music box: a bright tine with an inharmonic ping, a pluck, a long-ish ring."""
    t = _t(max(held, 0.2) + 1.4)
    x = 0
    for det in (-3, 3):
        ff = f * 2 ** (det / 1200)
        x = x + np.sin(TAU * ff * t) + 0.17 * np.sin(TAU * ff * 4.07 * t) * np.exp(-t * 11) \
            + 0.04 * np.sin(TAU * ff * 10.4 * t) * np.exp(-t * 30)
    env = np.exp(-t * (1.6 + f / 2200)) * _attack(len(t), 0.0008)
    click = np.zeros(len(t))
    k = int(0.004 * SR)
    click[:k] = rng.standard_normal(k) * np.exp(-np.arange(k) / (0.0007 * SR)) * 0.3
    return (x * env * 0.5 + click) * 0.4 * vel


def tick(f, held, vel, rng):
    n = int(0.018 * SR)
    x = rng.standard_normal(n)
    x = sosfilt(butter(2, [2200, 2900], "band", fs=SR, output="sos"), x) * 3
    return x * np.exp(-np.arange(n) / (0.003 * SR)) * 0.6 * vel


def soft_kick(f, held, vel, rng):
    t = _t(0.16)
    ph = TAU * np.cumsum(50 + 45 * np.exp(-t * 35)) / SR
    return np.sin(ph) * np.exp(-t * 22) * 0.7 * vel


def shaker(f, held, vel, rng):
    n = int(0.045 * SR)
    x = sosfilt(butter(2, 6000, "high", fs=SR, output="sos"), rng.standard_normal(n))
    e = np.minimum(1, np.arange(n) / (0.012 * SR)) * np.exp(-np.arange(n) / (0.012 * SR))
    return x * e * 0.35 * vel


PATCHES: dict[str, Callable] = {"fm_epiano": fm_epiano, "vibes": vibes, "fretless": fretless,
                                "gm_strings": gm_strings, "corps_bell": corps_bell, "tick": tick,
                                "soft_kick": soft_kick, "shaker": shaker}


# ---- rendering --------------------------------------------------------------------------------
@dataclass
class N:
    """A note in seconds: the common currency between MusicStudio renders and hand-placed parts."""
    t: float
    dur: float
    pitch: int
    vel: float = 0.8


@dataclass
class Part:
    notes: list[N]
    patch: str
    gain: float = 1.0
    detune: float = 0.0       # depth of the per-voice random walk, in cents
    dropout: float = 0.0      # chance a note is cut short, as if its voice was stolen
    seed: int = 0
    kw: dict = field(default_factory=dict)


def periodic_walk(loop_s: float, depth: float, seed: int, n_terms: int = 4) -> Callable[[float], float]:
    """A smooth wandering curve that returns to its start at the loop point."""
    rng = np.random.default_rng(seed)
    terms = [(k, rng.uniform(0, TAU), rng.uniform(0.4, 1) / k) for k in range(1, n_terms + 1)]
    norm = sum(a for _, _, a in terms)
    return lambda s: depth * sum(a * np.sin(TAU * k * s / loop_s + p) for k, p, a in terms) / norm


def render_loop(parts: list[Part], loop_s: float) -> np.ndarray:
    n = int(round(loop_s * SR))
    out = np.zeros(n)
    for part in parts:
        rng = np.random.default_rng(part.seed)
        walk = periodic_walk(loop_s, part.detune, part.seed + 1) if part.detune else None
        fn = PATCHES[part.patch]
        for note in part.notes:
            cents = walk(note.t) + rng.normal(0, part.detune * 0.15) if walk else 0.0
            f = 440 * 2 ** ((note.pitch - 69 + cents / 100) / 12)
            held = note.dur
            cut = part.dropout and rng.random() < part.dropout
            if cut:
                held *= rng.uniform(0.15, 0.4)
            x = fn(f, held, note.vel, rng, **part.kw) * part.gain
            if cut:  # stolen: stops dead (5 ms fade) instead of releasing
                k = int(held * SR)
                f5 = int(0.005 * SR)
                if k + f5 < len(x):
                    x[k:k + f5] *= np.linspace(1, 0, f5)
                    x[k + f5:] = 0
            a = int(round(note.t * SR)) % n
            for off in range(0, len(x), n):  # wrap tails around the loop
                seg = x[off:off + n]
                first = seg[: n - a]
                out[a:a + len(first)] += first
                rest = seg[n - a:]
                out[: len(rest)] += rest
    return out


# ---- effects (all loop-safe) --------------------------------------------------------------------
def on_loop(fx: Callable[[np.ndarray], np.ndarray], x: np.ndarray) -> np.ndarray:
    """Run a filter with memory over two copies and keep the second, so its tail wraps the seam."""
    return fx(np.concatenate([x, x]))[len(x):]


def speaker(x: np.ndarray, hp: float = 330, lp: float = 3900, box: float = 0.45) -> np.ndarray:
    """A beige multimedia speaker: no lows, no highs, a boxy bump around 1.2 kHz."""
    def f(y):
        y = sosfilt(butter(2, hp, "high", fs=SR, output="sos"), y)
        bump = sosfilt(butter(1, [950, 1500], "band", fs=SR, output="sos"), y)
        y = y + box * bump
        return sosfilt(butter(2, lp, "low", fs=SR, output="sos"), y)
    return on_loop(f, x)


def crush(x: np.ndarray, bits: int = 12, hold: int = 2, seed: int = 0) -> np.ndarray:
    """Sample-and-hold to SR/hold and quantize, with a little dither so quiet parts hiss."""
    y = np.repeat(x[::hold], hold)[: len(x)]
    q = 2 ** (bits - 1)
    y = y + np.random.default_rng(seed).uniform(-0.5, 0.5, len(y)) / q
    return np.round(y * q) / q


def room(x: np.ndarray, mix: float = 0.18, size: float = 1.0) -> np.ndarray:
    """A small office: four combs and two allpasses (Schroeder)."""
    def f(y):
        wet = 0
        for d_ms, g in ((29.7, 0.72), (37.1, 0.70), (41.1, 0.68), (43.7, 0.66)):
            d = int(d_ms * size * SR / 1000)
            a = np.zeros(d + 1); a[0] = 1; a[d] = -g
            wet = wet + lfilter([1], a, y)
        for d_ms, g in ((5.0, 0.7), (1.7, 0.7)):
            d = int(d_ms * SR / 1000)
            b = np.zeros(d + 1); b[0] = -g; b[d] = 1
            a = np.zeros(d + 1); a[0] = 1; a[d] = -g
            wet = lfilter(b, a, wet)
        wet = sosfilt(butter(1, 3000, "low", fs=SR, output="sos"), wet)
        return y * (1 - mix) + wet * mix * 0.25
    return on_loop(f, x)


def read_at_speed(x: np.ndarray, speed: np.ndarray) -> np.ndarray:
    """Read a loop at a varying speed, normalised so one pass still covers exactly one loop."""
    n = len(x)
    speed = speed * n / speed.sum()
    pos = np.cumsum(speed) - speed[0]
    i0 = np.floor(pos).astype(int) % n
    frac = pos - np.floor(pos)
    return x[i0] * (1 - frac) + x[(i0 + 1) % n] * frac


def slips(x: np.ndarray, every: tuple[float, float], depth: tuple[float, float], seed: int,
          drift_cents: float = 0.0) -> np.ndarray:
    """A worn pinch roller: mostly steady, then now and then the tape drags flat and snaps back."""
    n = len(x)
    rng = np.random.default_rng(seed)
    cents = np.full(n, -drift_cents, dtype=float)
    s = rng.uniform(*every) * 0.5
    while s < n / SR - 0.5:
        a, d = int(s * SR), rng.uniform(*depth)
        drag, snap = int(0.30 * SR), int(0.06 * SR)
        cents[a:a + drag] -= d * np.sin(np.linspace(0, np.pi / 2, drag)) ** 2
        cents[a + drag:a + drag + snap] -= d * np.linspace(1, 0, min(snap, n - a - drag))[:snap]
        s += rng.uniform(*every)
    return read_at_speed(x, 2 ** (cents / 1200))


def stutter(x: np.ndarray, count: int, seed: int, grain: float = 0.04, hold: float = 0.3) -> np.ndarray:
    """The read pointer freezes on one short grain for a moment, then carries on."""
    y = x.copy()
    rng = np.random.default_rng(seed)
    g, h = int(grain * SR), int(hold * SR)
    win = np.hanning(g)
    for _ in range(count):
        a = int(rng.uniform(0.05, 0.9) * len(x))
        piece = np.tile(x[a:a + g] * win, h // g + 1)[:h]
        y[a:a + h] = piece * 1.1
    return y


def hum(n: int, level: float, buzz: float = 0.3) -> np.ndarray:
    """60 Hz mains with odd harmonics. 60 Hz fits a whole number of cycles in any loop of whole tenths of a second."""
    t = np.arange(n) / SR
    x = np.sin(TAU * 60 * t) + 0.5 * np.sin(TAU * 180 * t) + buzz * np.sin(TAU * 300 * t) + 0.12 * np.sin(TAU * 420 * t)
    return x * level


def half_speed(x: np.ndarray) -> np.ndarray:
    n = len(x)
    pos = np.arange(2 * n) / 2
    i0 = pos.astype(int) % n
    frac = pos - np.floor(pos)
    return x[i0] * (1 - frac) + x[(i0 + 1) % n] * frac


def choir(f, held, vel, rng):
    """A cheap wordless 'ah': a buzzy source through two vowel formants, slow vibrato, slow swell."""
    rel = 0.8
    t = _t(held + rel)
    n_hold = int(held * SR)
    vib = 1 + 0.004 * np.sin(TAU * 4.6 * t + rng.uniform(0, TAU)) * np.minimum(1, t / 0.8)
    x = 0
    for det in (-7, 6):
        ph = (np.cumsum(f * 2 ** (det / 1200) * vib) / SR) % 1.0
        x = x + (2 * ph - 1)
    ah = (sosfilt(butter(2, [620, 820], "band", fs=SR, output="sos"), x)
          + 0.6 * sosfilt(butter(2, [1000, 1250], "band", fs=SR, output="sos"), x)
          + 0.15 * sosfilt(butter(2, [2500, 2900], "band", fs=SR, output="sos"), x))
    env = _attack(len(t), 0.6) * _release(n_hold, len(t), rel)
    return ah * env * 0.9 * vel


def organ(f, held, vel, rng):
    """A soft two-drawbar organ (8' and 4') with a slow leslie-ish wobble."""
    rel = 0.3
    t = _t(held + rel)
    n_hold = int(held * SR)
    am = 1 - 0.08 * (0.5 + 0.5 * np.sin(TAU * 0.8 * t))
    x = np.sin(TAU * f * t) + 0.45 * np.sin(TAU * 2 * f * t) + 0.12 * np.sin(TAU * 3 * f * t)
    return x * am * _attack(len(t), 0.15) * _release(n_hold, len(t), rel) * 0.4 * vel


PATCHES.update({"choir": choir, "organ": organ, "music_box": music_box})
