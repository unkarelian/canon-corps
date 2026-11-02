"""Synthesize CanonOS's sound effects. Everything is built from sines, pulses and noise:
cheap office-PC sounds, a bit of dial-up, nothing sampled.

  click      button press: a dry plastic tick
  key        one keystroke (the game varies its pitch)
  open/close window blips, up and down
  page       the viewer loading a page: a short line-noise crackle and two seek ticks
  send       outgoing mail/post: a swept chirp into the connection
  mail       new mail: a two-note office chime
  save       saving to Files: a hard-drive chatter
  login_ok   two rising beeps
  denied     a low square-wave bonk (login failed, no resonance)
  flood      reality poison, 6 s: a rising, warbling wash of static that chokes off
  transmit   the HQ uplink, ~2.2 s: answer tone, warble, scrambled burst
  resonance  a fragment counted: a warm major-sixth swell
  stage      notice has risen: a distant low boom with a slow tape-stop
  inject     the reverse seed: a falling roar into a sub boom, 3.5 s
  print      one line of Form 77-R on a dot-matrix printer
  stare      the loss, the eye held: the notice hum losing its lo-fi in steps, then stopping
  lid        the loss: one of the small eyes opening, a tiny dry tick
  found      the loss: the Corps chime, dry, sagging flat, one note short
  room       a 12 s loop of room tone: fan, mains hum, a faint CRT whine

  uv run --project ~/Projects/MusicStudio --all-extras --with scipy python tools/audio/make_sfx.py
"""
from __future__ import annotations

import json
import subprocess
import wave
from pathlib import Path

import sys

import numpy as np
from scipy.signal import butter, sosfilt

sys.path.insert(0, str(Path(__file__).parent))
import synth  # noqa: E402  (the Corps bell and organ live there, shared with the music)

SR = 44100
ROOT = Path(__file__).resolve().parents[2]
WORK = Path(__file__).parent / "out/sfx"
OUT = ROOT / "game/assets/sfx"
rng = np.random.default_rng(77)


def T(sec: float) -> np.ndarray:
    return np.arange(int(sec * SR)) / SR


def lp(x, f, o=2):
    return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)


def hp(x, f, o=2):
    return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, o=2):
    return sosfilt(butter(o, [lo, hi], "band", fs=SR, output="sos"), x)


def noise(sec):
    return rng.standard_normal(int(sec * SR))


def env(n, a=0.002, r=None, curve=6.0):
    """Linear attack, exponential decay to the end."""
    t = np.arange(n) / SR
    e = np.exp(-t * curve / max(1e-3, (r or n / SR)))
    ai = max(1, int(a * SR))
    e[:ai] *= np.linspace(0, 1, ai)
    return e


def tone(f, sec, kind="sine"):
    t = T(sec)
    ph = 2 * np.pi * np.cumsum(np.broadcast_to(f, t.shape)) / SR
    if kind == "sine":
        return np.sin(ph)
    if kind == "square":
        return np.sign(np.sin(ph)) * 0.6
    if kind == "tri":
        return 2 / np.pi * np.arcsin(np.sin(ph))
    raise ValueError(kind)


def pad_to(x, n):
    return np.pad(x, (0, max(0, n - len(x))))[:n]


def at(dst, src, sec):
    a = int(sec * SR)
    b = min(len(dst), a + len(src))
    dst[a:b] += src[: b - a]
    return dst


def fade_tail(x, sec=0.01):
    f = min(len(x), int(sec * SR))
    x[-f:] *= np.linspace(1, 0, f)
    return x


def crush(x, bits=8, keep=4):
    """Bit and sample-rate reduction for the cheap-DAC sound."""
    q = 2 ** (bits - 1)
    y = np.round(x * q) / q
    return np.repeat(y[::keep], keep)[: len(x)]


# ---- the sounds ---------------------------------------------------------------------------
def click():
    n = int(0.03 * SR)
    x = bp(noise(0.03), 1800, 6000) * env(n, 0.0005, 0.03, 9)
    x += tone(2400, 0.03) * env(n, 0.0003, 0.01, 8) * 0.3
    return x * 0.5


def key():
    n = int(0.045 * SR)
    x = bp(noise(0.045), 900, 4000) * env(n, 0.0005, 0.045, 10)
    x = at(x, bp(noise(0.012), 2500, 7000) * 0.5, 0.018)
    return x * 0.35


def blip(f0, f1, sec=0.07):
    t = T(sec)
    f = f0 + (f1 - f0) * t / sec
    return crush(tone(f, sec, "square") * env(len(t), 0.003, sec, 3)) * 0.22


def page():
    x = np.zeros(int(0.42 * SR))
    crackle = bp(noise(0.3), 600, 3500) * (rng.random(int(0.3 * SR)) < 0.08) * 2.2
    crackle *= env(len(crackle), 0.01, 0.3, 3)
    at(x, crackle * 0.25, 0.0)
    for s in (0.05, 0.19, 0.27):
        at(x, bp(noise(0.012), 1500, 5000) * env(int(0.012 * SR), 0.0005, 0.012, 5) * 0.4, s)
    at(x, tone(1200, 0.06, "square") * env(int(0.06 * SR), 0.002, 0.06, 2) * 0.05, 0.33)
    return x


def send():
    t = T(0.42)
    f = 500 * (6.0 ** (t / 0.42))
    x = tone(f, 0.42, "sine") * env(len(t), 0.01, 0.42, 3) * 0.25
    x += bp(noise(0.42), 1000, 6000) * np.linspace(0, 1, len(t)) ** 2 * env(len(t), 0.01, 0.42, 2) * 0.12
    return crush(x, 9, 2)


def bell(f, sec):
    t = T(sec)
    x = sum(a * np.sin(2 * np.pi * f * r * t) for r, a in ((1, 1), (2.0, 0.3), (3.01, 0.12), (4.2, 0.05)))
    return x * env(len(t), 0.003, sec, 5)


def _bell(midi, held, vel=0.8):
    return synth.corps_bell(440 * 2 ** ((midi - 69) / 12), held, vel, np.random.default_rng(midi))


def mail():
    """The first two notes of the Corps chime: C, A."""
    x = np.zeros(int(1.6 * SR))
    at(x, _bell(84, 0.2) * 0.5, 0.0)
    at(x, _bell(81, 0.3) * 0.5, 0.16)
    return lp(x, 6000)


def startup():
    """CanonOS starting: the whole Corps chime, over a quiet organ Amen (Bb minor, then F)."""
    q = 0.5
    x = np.zeros(int(4.6 * SR))
    for j, m in enumerate((72, 69, 74, 77)):
        at(x, _bell(m, q * 1.4, 0.9) * 0.45, j * q)
    rng = np.random.default_rng(1)
    for m in (58, 65, 70, 73):
        at(x, synth.organ(440 * 2 ** ((m - 69) / 12), 1.4, 0.6, rng) * 0.22, 0.0)
    for m in (53, 65, 69, 72):
        at(x, synth.organ(440 * 2 ** ((m - 69) / 12), 1.6, 0.6, rng) * 0.22, 1.5)
    x = lp(hp(x, 120), 5000)
    return fade_tail(x, 0.6)


def boot():
    """The reality viewer opening a connection: a CRT degauss thunk, then carrier tones under static."""
    x = np.zeros(int(5.5 * SR))
    t = T(0.9)
    degauss = (np.sin(2 * np.pi * 60 * t) * 0.6 + bp(noise(0.9), 80, 400) * 0.6) * np.exp(-t * 4) * np.minimum(1, t / 0.01)
    at(x, degauss * 0.8, 0.0)
    at(x, tone(2100, 1.0) * 0.07 * env(int(1.0 * SR), 0.02, 3.0, 1), 1.0)
    for k, (f1, f2) in enumerate(((1070, 1270), (2025, 2225), (1180, 980))):
        tt = T(0.8)
        sw = tone(np.where(np.sin(2 * np.pi * 7 * tt) > 0, f1, f2), 0.8) * 0.05
        at(x, sw, 2.1 + k * 0.9)
    stat = bp(noise(4.4), 600, 5000) * 0.05 * (rng.random(int(4.4 * SR)) < 0.25)
    at(x, stat, 1.0)
    return crush(lp(x, 6000), 9, 2)


def save():
    x = np.zeros(int(0.7 * SR))
    whir = bp(noise(0.65), 150, 900) * 0.05 * np.minimum(1, np.linspace(0, 6, int(0.65 * SR)))
    at(x, fade_tail(whir, 0.05), 0.0)
    s = 0.02
    while s < 0.6:
        tick = bp(noise(0.008), 2000, 7000) * env(int(0.008 * SR), 0.0003, 0.008, 5)
        at(x, tick * rng.uniform(0.2, 0.45), s)
        s += rng.choice([0.018, 0.025, 0.04, 0.07])
    return x


def login_ok():
    x = np.zeros(int(0.3 * SR))
    at(x, tone(880, 0.09, "square") * env(int(0.09 * SR), 0.002, 0.09, 1.5) * 0.15, 0)
    at(x, tone(1320, 0.12, "square") * env(int(0.12 * SR), 0.002, 0.12, 2) * 0.15, 0.11)
    return crush(x)


def denied():
    t = T(0.28)
    x = tone(140, 0.28, "square") + tone(147, 0.28, "square")
    return lp(x * env(len(t), 0.003, 0.28, 2) * 0.28, 2500)


def flood():
    sec = 6.0
    t = T(sec)
    n = len(t)
    grow = np.minimum(1, t / 4.5) ** 1.5
    wash = bp(noise(sec), 400, 7000) * (0.08 + 0.5 * grow)
    # warble: the noise band is amplitude-modulated faster and faster
    wash *= 0.6 + 0.4 * np.sin(2 * np.pi * np.cumsum(3 + 22 * grow) / SR)
    crack = noise(sec) * (rng.random(n) < 0.002 + 0.03 * grow) * 1.5
    hum = tone(60 + 30 * grow, sec, "square") * 0.08 * grow
    sweep = tone(200 * (8 ** (t / sec)), sec, "sine") * 0.06 * grow
    x = wash + crack + hum + sweep
    x = crush(x, 7, 3)
    # choke: the last 0.25 s collapses
    c = int(5.75 * SR)
    x[c:] *= np.linspace(1, 0, n - c) ** 3
    return x * 0.7


def transmit():
    x = np.zeros(int(2.3 * SR))
    at(x, tone(2100, 0.55) * 0.18 * env(int(0.55 * SR), 0.01, 3.0, 1), 0.0)
    t = T(0.6)
    warble = tone(1200 + 400 * np.sign(np.sin(2 * np.pi * 9 * t)), 0.6, "sine") * 0.14
    at(x, warble, 0.6)
    at(x, (tone(980, 0.35) + tone(1650, 0.35)) * 0.08, 1.25)
    burst = bp(noise(0.65), 500, 6000) * 0.25 * env(int(0.65 * SR), 0.02, 0.65, 1.5)
    at(x, burst, 1.62)
    return crush(lp(x, 6000), 8, 2)


def resonance():
    sec = 2.2
    t = T(sec)
    e = np.minimum(1, t / 0.4) * np.exp(-np.maximum(0, t - 0.6) * 2.2)
    x = sum(np.sin(2 * np.pi * f * t) * a for f, a in ((349.2, 0.5), (440, 0.35), (523.3, 0.3), (587.3, 0.25), (698.5, 0.15)))
    x += 0.05 * np.sin(2 * np.pi * 1396.9 * t) * (1 + np.sin(2 * np.pi * 5 * t))
    return lp(x * e * 0.35, 4000)


def stage():
    sec = 2.4
    t = T(sec)
    f = 48 * np.maximum(0.35, 1 - (t / sec) ** 0.7)
    boom = tone(f, sec, "sine") * np.exp(-t * 1.6) * np.minimum(1, t / 0.03)
    rumble = lp(noise(sec), 120) * np.exp(-t * 1.2) * 3.0
    return (boom * 0.7 + rumble * 0.4) * 0.8


def inject():
    sec = 3.6
    t = T(sec)
    roar = bp(noise(sec), 80, 3000) * np.minimum(1, t / 1.5) ** 2
    roar = lp(roar * (1 - np.clip((t - 2.2) / 0.1, 0, 1)), 2500)
    fall = tone(900 * (0.06 ** np.clip(t / 2.2, 0, 1)), sec, "square") * 0.12 * (t < 2.2)
    x = roar * 0.5 + fall
    boom_t = T(1.4)
    boom = tone(55 * np.exp(-boom_t * 1.5), 1.4) * np.exp(-boom_t * 2.5)
    at(x, boom * 0.9, 2.2)
    return x


def printer():
    x = np.zeros(int(0.32 * SR))
    s = 0.0
    while s < 0.28:
        at(x, bp(noise(0.006), 1500, 5000) * env(int(0.006 * SR), 0.0003, 0.006, 4) * 0.25, s)
        s += 0.0105
    x += bp(noise(0.32), 200, 800) * 0.03
    return fade_tail(x, 0.02)


STARE_S = 2.3     # fx.js EYE_MS: the eye's time on screen; the cue ends exactly when the text appears
GLIDE_AT_S = 1.75 # fx.js GLIDE_AT: the eye stares forward this long, then glides to the cursor
GLIDE_S = 0.16    # fx.js GLIDE_MS: how long the glide takes
MORPH = ROOT / "game/assets/eye/real/timeline.json"  # tools/eye/morph3d.py: the sprite turning real
FOUND_S = 4.85  # how long "I FOUND YOU" stays up (fx.js loss() holds the text this long): the voice, and a
                # little of its hall swelling after it, then the cut
VOICE = Path(__file__).parent / "voice/i_found_you.wav"  # see voice/README.md


def stare():
    """The loss, before the words: the notice hum, held still, losing its cheapness in steps.

    It starts as crushed as the eye cue and gets cleaner in jumps, on the same frames as the
    picture (morph3d.py's timeline), until it is a full-band sound with nothing of the computer
    left in it -- including the one early frame where the finished eye flashes through.
    A faint wet crackle comes in as it clears.
    As the pupil glides to the cursor, a soft wet slide; when it lands, the hum drops away
    to almost nothing, as if it has stopped to listen. Then it stops mid-cycle. Quiet the whole way.
    """
    r = np.random.default_rng(1771)
    t = T(STARE_S)
    f = 62 + 0.35 * np.sin(2 * np.pi * 0.9 * t)  # where the notice hum ended: lids fully open
    ph = 2 * np.pi * np.cumsum(f) / SR
    hum = np.sin(ph) + 0.5 * np.sin(2 * ph + 0.3) + 0.3 * np.sin(3 * ph) + 0.12 * np.sin(5 * ph + 1.1)
    x = np.zeros_like(t)
    keep = {None: 6, 64: 5, 96: 4, 128: 3, 213: 2, 320: 2}
    stages, a = [], 0.0
    for fr in json.loads(MORPH.read_text())["frames"]:
        clean = fr["colour"] >= 1.0
        stages.append((a, None if clean else 4 + round(10 * fr["colour"]), None if clean else keep.get(fr["res"], 1)))
        a += fr["ms"] / 1000
    for k, (a, bits, keep) in enumerate(stages):
        b = stages[k + 1][0] if k + 1 < len(stages) else STARE_S
        i0, i1 = int(a * SR), int(b * SR)
        seg = hum[i0:i1]
        x[i0:i1] = crush(seg, bits, keep) if bits else seg
    land = GLIDE_AT_S + GLIDE_S
    x *= 0.22 * np.where(t < land, 1.0, 0.25)  # it goes still when it has you
    # Moisture: sparse soft ticks, only once the sound is clean enough to carry them.
    wet = lp(bp(r.standard_normal(len(t)), 900, 6000) * (r.random(len(t)) < 0.0025) * 3, 7000)
    x += wet * np.clip((t - a + 0.4) / 0.4, 0, 1) * 0.05
    # The glide: a soft wet slide, a band of noise sweeping down as the pupil decelerates.
    gt = T(GLIDE_S + 0.05)
    k = np.clip(gt / GLIDE_S, 0, 1)
    sweep = 1 - (1 - k) ** 3
    slide = bp(r.standard_normal(len(gt)), 500, 4000)
    slide = lp(slide, 3500) * np.sin(np.pi * np.clip(gt / (GLIDE_S + 0.05), 0, 1)) * (1.2 - sweep)
    at(x, slide * 0.05, GLIDE_AT_S)
    x[-int(0.003 * SR):] *= np.linspace(1, 0, int(0.003 * SR))  # cut mid-cycle, just not a click
    return x


def lid():
    """One of the loss's small eyes opening: a tiny dry-wet tick, close to the ear and quiet."""
    r = np.random.default_rng(1773)
    t = T(0.06)
    x = lp(bp(r.standard_normal(len(t)), 300, 3000), 2500) * np.exp(-t * 90) * 0.12
    x += tone(150 * np.exp(-t * 30), 0.06) * np.exp(-t * 60) * 0.06
    return x


def found():
    """The loss: the Corps chime, dry and close, each note a little flatter, and no fourth note.

    The player has heard C-A-D-F at every logon and in every hold loop. Here it plays clean,
    with none of the CanonOS speaker on it, slightly too slow, sagging out of tune, and stops
    one note short. Where the F should land, the words come instead, in CanonOS's own voice
    (voice/tts.py dread, level 1): a retro formant chorus of itself, out of step, sagging, with a
    growling body under it, swelling up out of reversed reverb. Quiet. Nowhere near full scale.
    """
    noise(1.6)  # keeps the shared rng stream where the old cue left it, so later sounds render identically
    x = np.zeros(int(FOUND_S * SR))
    q = 0.62
    for j, (m, cents) in enumerate(((72, 0), (69, -18), (74, -42))):
        fr = 440 * 2 ** ((m - 69) / 12 + cents / 1200)
        at(x, synth.corps_bell(fr, q * 1.2, 0.8, np.random.default_rng(m)) * 0.30, 0.18 + j * q)
    # Under it, almost nothing: the room breathing in once, very close.
    r = np.random.default_rng(1772)
    bt = T(1.1)
    breath = bp(r.standard_normal(len(bt)), 350, 1800) * np.sin(np.pi * np.clip(bt / 1.1, 0, 1)) ** 2
    at(x, breath * 0.018, 0.25)
    # The voice, in the fourth note's place; cut dead with everything else when the text goes. A voice that
    # swells in before its first word (tts.py dread) says how long in a .json beside it: that starts early.
    with wave.open(str(VOICE)) as w:
        assert w.getframerate() == SR and w.getsampwidth() == 2
        v = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    meta = VOICE.with_suffix(".json")
    preroll = json.loads(meta.read_text())["preroll"] if meta.exists() else 0.0
    at(x, v / np.abs(v).max() * 0.26, max(0.0, 0.18 + 3 * q - preroll))
    x[-int(0.004 * SR):] *= np.linspace(1, 0, int(0.004 * SR))
    return x


def room():
    sec = 12.0
    t = T(sec)
    fan = lp(noise(sec + 1), 500)[: len(t)] * 0.8 + lp(noise(sec + 1), 2500)[: len(t)] * 0.08
    hum = (np.sin(2 * np.pi * 60 * t) + 0.4 * np.sin(2 * np.pi * 120 * t) + 0.15 * np.sin(2 * np.pi * 180 * t)) * 0.03
    whine = np.sin(2 * np.pi * 15734 * t) * 0.0025  # NTSC flyback, barely there
    x = fan * 0.05 + hum + whine
    f = int(1.0 * SR)  # crossfade end into start for a seamless loop
    ramp = np.linspace(0, 1, f)
    x[:f] = x[:f] * ramp + x[-f:] * (1 - ramp)
    return x[:-f]


def stamp():
    """A rubber stamp: a dull thump of wood on paper, a slap of the sheet, a short rattle."""
    x = np.zeros(int(0.45 * SR))
    t = T(0.12)
    thump = tone(95 * np.exp(-t * 8), 0.12) * np.exp(-t * 35)
    slap = bp(noise(0.05), 300, 2500) * env(int(0.05 * SR), 0.0005, 0.05, 7)
    at(x, thump * 0.9, 0.0)
    at(x, slap * 0.6, 0.002)
    at(x, bp(noise(0.03), 1500, 5000) * env(int(0.03 * SR), 0.0005, 0.03, 6) * 0.12, 0.09)
    return x


SOUNDS = {
    "click": click, "key": key, "open": lambda: blip(520, 980), "close": lambda: blip(900, 420),
    "page": page, "send": send, "mail": mail, "save": save, "login_ok": login_ok, "denied": denied,
    "flood": flood, "transmit": transmit, "resonance": resonance, "stage": stage, "inject": inject,
    "print": printer, "found": found, "stare": stare, "lid": lid, "room": room, "startup": startup, "boot": boot, "stamp": stamp,
}


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    only = set(sys.argv[1:])
    for name, fn in SOUNDS.items():
        if only and name not in only:
            continue
        x = np.asarray(fn(), dtype=np.float64)
        peak = np.abs(x).max()
        if peak > 0.98:
            x *= 0.98 / peak
        if name not in ("room", "stare", "found", "lid"):
            x = fade_tail(x, 0.004)
        pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
        wav = WORK / f"{name}.wav"
        with wave.open(str(wav), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "libvorbis", "-q:a", "5",
                        str(OUT / f"{name}.ogg")], check=True)
        print(f"{name:10s} {len(x) / SR:5.2f}s  peak {min(peak, 0.98):.2f}")


if __name__ == "__main__":
    main()
