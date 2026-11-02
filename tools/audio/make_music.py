"""Build the adaptive score for Canon Corps (v2).

The agency's hold music, `cc_hold`: MusicStudio writes the notes, tools/audio/synth.py voices them like a
late-90s office PC (FM e-piano, motor vibes, fretless bass, cheap GM strings, a beige speaker, 12-bit).
Each loop ends on the Corps chime, the agency's four-note sonic logo. Every notice stage is the same
tune, worse, and the chime is the first thing to go wrong:

  QUIET      the hold music. The chime resolves.
  STIRRING   now and then the tape drags flat and snaps back. The chime's third note sticks once.
  WATCHFUL   drums down to a tick; each instrument drifts out of tune on its own; notes get cut off;
             the chime lands a semitone sharp; mains hum; a sub drone the speaker should not reproduce
  FIXED      the tune at half speed, an octave down, freezing on grains, through the drone
  SEARCHING  the chime stuck on its wrong note, chanting over the Amen chords; an organ cluster;
             the tune's first four notes, once, far too slow
  win        the clean hold music, for Form 77-R (the game cuts it dead on FEAR)

All loops are seamless. Old renders are kept in tools/audio/out/v1 for comparison.
  uv run --project ~/Projects/MusicStudio --all-extras --with scipy python tools/audio/make_music.py
"""
from __future__ import annotations

import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

from musicstudio import Studio
from musicstudio.render import render

sys.path.insert(0, str(Path(__file__).parent))
from synth import (SR, N, Part, render_loop, speaker, crush, room, slips, stutter, hum, half_speed,  # noqa: E402
                   TAU)

ROOT = Path(__file__).resolve().parents[2]
WORK = Path(__file__).parent / "out"
OUT = ROOT / "game/assets/music"
NAME = "cc_hold"
BPM, BARS = 100, 16
BEAT = 60 / BPM
BAR = 4 * BEAT
LOOP_S = BARS * BAR  # 38.4 s


# ---- the notes ------------------------------------------------------------------------------
def build(s: Studio) -> None:
    # F major, but solemn: minor-leaning chords, phrases of seven bars instead of eight, and the Corps chime
    # over a minor plagal "Amen" (Bb minor to F) -- hymnal, slightly sad, a few degrees off for hold music.
    s.create(NAME, key="F major", tempo=BPM, style="freeform",
             sections=[["A", 7], ["B", 7], ["chime", 2]], overwrite=True)
    s.set_harmony(NAME, [
        ["1", "IVmaj7"], ["2", "iii7"], ["3", "ii7"], ["4", "V7"], ["5", "Imaj7"], ["6", "vi7"], ["7", "ii7"], ["7:3", "V7"],
        ["8", "IVmaj7"], ["9", "V/V"], ["10", "iii7"], ["11", "vi7"], ["12", "ii7"], ["13", "iv"], ["14", "V7"],
        ["15", "iv"], ["16", "I"],
    ])
    s.add_motif(NAME, "hold", "2 4 7:1/4 6 4 5:1/4 4:1/2 r:1/4 2 3", note="the hold tune: up a sixth, step down, wait")
    s.add_motif(NAME, "answer", "4 3 2:1/4 1 0 1:1/4 2:1/2. r:1/4", note="the polite answer, falling back")
    s.add_motif(NAME, "aside", "5:1/4. 4 3:1/4 2:1/4 3 2 1:1/4 -1:1/2", note="the B section, a little wistful")
    s.add_voice(NAME, "vibes", "vibraphone", role="melody", octave=5)
    s.add_voice(NAME, "keys", "rhodes", role="harmony", octave=3)
    s.add_voice(NAME, "bass", "contrabass", role="bass", octave=2)
    s.add_voice(NAME, "pad", "strings", role="pad", octave=3, dynamic="pp")
    s.add_voice(NAME, "choir", "choir", role="pad", octave=4, dynamic="pp")
    for i, (motif, at, tr) in enumerate([("hold", "1", 0), ("answer", "3", 0), ("hold", "5", 1),
                                         ("aside", "8", 0), ("aside", "10", -1), ("hold", "12", 0)]):
        s.add_op(NAME, "vibes", "play", id=f"mel{i}", motif=motif, at=at, transpose=tr, dynamic="mp")
    s.add_op(NAME, "vibes", "phrase", id="tag_a", steps="3:1/2 2:1/4 r:1/4", at="7", dynamic="mp")
    s.add_op(NAME, "vibes", "phrase", id="tag_b", steps="4:1/2. r:1/4", at="14", dynamic="mp")
    s.add_op(NAME, "keys", "chords", id="comp", at="1", bars=14, voicing="block", tones=4, rhythm="1/8", dynamic="p")
    s.add_op(NAME, "bass", "bass", id="bossa", at="1", bars=16, pattern="root_fifth", rhythm="1/4. 1/8", dynamic="mp")
    s.add_op(NAME, "pad", "chords", id="pad", at="1", bars=16, voicing="pad", tones=3, dynamic="pp")
    s.add_op(NAME, "choir", "chords", id="amen", at="1", bars=16, voicing="pad", tones=3, dynamic="pp")


def notes_of(s: Studio) -> dict[str, list[N]]:
    piece = s.get(NAME)
    r = render(piece)
    sec = lambda tick: tick / 480 * BEAT  # noqa: E731
    out: dict[str, list[N]] = {}
    for n in r.notes:
        out.setdefault(n.voice, []).append(N(sec(n.start), sec(n.dur), n.pitch, 0.55 + 0.45 * n.velocity / 127))
    # Comping: stiff stabs on 1, the and of 2, and 4 -- every one at the same velocity. The stiffness is the joke.
    stabs = {0: 1.5, 3: 1.0, 6: 1.5}  # eighth index in the bar -> length in eighths
    keys = []
    for n in out["keys"]:
        idx = round((n.t % BAR) / (BEAT / 2))
        if idx in stabs:
            keys.append(N(n.t, stabs[idx] * BEAT / 2 * 0.8, n.pitch, 0.6))
    out["keys"] = keys
    return out


def drums(kit: str = "full") -> list[Part]:
    shake, tk, kick = [], [], []
    for bar in range(BARS):
        b0 = bar * BAR
        for e in range(8):
            shake.append(N(b0 + e * BEAT / 2, 0.05, 0, 0.9 if e % 2 else 0.55))
        for e in (3, 6):  # rim tick on the and of 2, and on 4
            tk.append(N(b0 + e * BEAT / 2, 0.02, 0, 0.8))
        for e in (0, 5):  # kick on 1 and the and of 3
            kick.append(N(b0 + e * BEAT / 2, 0.1, 0, 0.9))
    parts = [Part(tk, "tick", 0.55, seed=11)]
    if kit == "full":
        parts += [Part(shake, "shaker", 0.5, seed=12), Part(kick, "soft_kick", 0.8, seed=13)]
    return parts


# The Corps chime: four bell notes over the last two bars, resolving to F. (C A D F)
CHIME_T = 14 * BAR


def chime(stage: str) -> list[N]:
    q = BEAT
    base = [(0, 72), (q, 69), (2 * q, 74), (3 * q, 77)]
    if stage == "stirring":    # the third note sticks once, and the last arrives late
        base = [(0, 72), (q, 69), (2 * q, 74), (2.5 * q, 74), (3.5 * q, 77)]
    if stage in ("watchful", "fixed"):  # lands a semitone sharp of home
        base = [(0, 72), (q, 69), (2 * q, 74), (3 * q, 78)]
    if stage == "fixed":       # and the wrong note repeats
        base += [(4.5 * q, 78), (6 * q, 78)]
    return [N(CHIME_T + t, 1.6 * q, p, 0.85) for t, p in base]


def tune(nv: dict[str, list[N]], stage: str, *, detune: float = 0, dropout: float = 0) -> list[Part]:
    return [
        Part(nv["vibes"], "vibes", 1.0, detune=detune * 0.5, seed=1),
        Part(nv["keys"], "fm_epiano", 0.55, detune=detune, dropout=dropout, seed=2),
        Part(nv["bass"], "fretless", 0.9, detune=detune * 0.3, seed=3),
        Part(nv["pad"], "gm_strings", 0.6, detune=detune * 1.2, dropout=dropout * 0.5, seed=4),
        Part(chime(stage), "corps_bell", 0.75, detune=detune * 0.3, seed=5),
        # The congregation behind the muzak: a wordless choir and an organ fifth, far down in the mix.
        Part(nv["choir"], "choir", 0.11, detune=detune * 0.8, seed=6),
        Part([N(0, LOOP_S - 0.4, 65, 0.7), N(0, LOOP_S - 0.4, 72, 0.6)], "organ", 0.06, detune=detune * 0.4, seed=7),
    ]


# ---- the drone and the heart: these sit below what the office speaker can play -------------------
def sub_drone(n: int, level: float, seed: int) -> np.ndarray:
    t = np.arange(n) / SR
    L = n / SR
    q = lambda f: round(f * L) / L  # noqa: E731  whole cycles per loop, so the seam is silent
    x = (np.sin(TAU * q(43.65) * t) + 0.55 * np.sin(TAU * q(46.25) * t) + 0.25 * np.sin(TAU * q(87.3) * t))
    swell = 0.7 + 0.3 * np.sin(TAU * max(1, round(L / 19)) / L * t)
    return x * swell * level


def heartbeat(n: int, level: float, period: float = 1.6) -> np.ndarray:
    out = np.zeros(n)
    beats = max(1, round(n / SR / period))
    step = n // beats
    k = int(0.22 * SR)
    t = np.arange(k) / SR
    thump = np.sin(TAU * np.cumsum(55 - 25 * t / t[-1]) / SR) * np.exp(-t * 18)
    for b in range(beats):
        for off, g in ((0, 1.0), (int(0.24 * SR), 0.6)):
            a = b * step + off
            m = min(k, n - a)
            out[a:a + m] += thump[:m] * g
    return out * level


# ---- stages ---------------------------------------------------------------------------------
def office(x: np.ndarray, bits: int = 12, seed: int = 0) -> np.ndarray:
    return crush(speaker(room(x, 0.2)), bits=bits, seed=seed)


def write(name: str, x: np.ndarray, peak: float = 0.8) -> None:
    x = x / max(1e-9, np.abs(x).max()) * peak
    WORK.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(WORK / f"{name}.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(WORK / f"{name}.wav"),
                    "-c:a", "libvorbis", "-q:a", "4", str(OUT / f"{name}.ogg")], check=True)
    print(f"{name}: {len(x) / SR:.1f}s")


def main() -> None:
    s = Studio(WORK / "pieces")
    build(s)
    nv = notes_of(s)
    n = int(round(LOOP_S * SR))

    quiet = office(render_loop(tune(nv, "quiet") + drums("full"), LOOP_S))
    write("quiet", quiet)
    write("win", quiet)

    st = render_loop(tune(nv, "stirring", detune=4) + drums("full"), LOOP_S)
    st = slips(st, every=(5, 9), depth=(60, 110), seed=21, drift_cents=6)
    write("stirring", office(st, 12, 2) + hum(n, 0.003))

    wa = render_loop(tune(nv, "watchful", detune=30, dropout=0.18) + drums("tick"), LOOP_S)
    wa = stutter(slips(wa, every=(2.5, 5), depth=(90, 160), seed=31, drift_cents=25), 3, seed=32)
    wa = office(wa, 10, 3)
    write("watchful", wa + hum(n, 0.01) + sub_drone(n, 0.06, 33))

    fx = render_loop(tune(nv, "fixed", detune=45, dropout=0.3) + drums("tick"), LOOP_S)
    fx = half_speed(fx)
    m = len(fx)
    fx = stutter(slips(fx, every=(3, 6), depth=(120, 220), seed=41, drift_cents=30), 6, seed=42, hold=0.45)
    fx = crush(speaker(room(fx, 0.14), hp=260, lp=2400), bits=9, seed=4)
    write("fixed", fx + hum(m, 0.016) + sub_drone(m, 0.09, 43))

    # SEARCHING: the hold music has stopped moving. The chime is stuck, repeating like a chant over the
    # Amen chords; an organ holds a cluster that swells and fades; the tune's first four notes go by once,
    # far too slowly, and stop.
    period = 2 * BAR  # 4.8 s, eight times a loop
    stuck, amen, head = [], [], []
    for k in range(8):
        t0 = k * period
        for j, p in enumerate((72, 69, 74, 78)):
            stuck.append(N(t0 + j * BEAT * 1.25, BEAT * 1.6, p, 0.75 if j < 3 else 0.6))
        chord = (70, 73, 77) if k % 2 == 0 else (69, 72, 77)  # Bb minor, then F
        amen += [N(t0, period - 0.2, p, 0.7) for p in chord]
    for j, p in enumerate((81, 84, 89, 88)):  # the opening of the hold tune at a quarter speed
        head.append(N(4.0 + j * BEAT * 4, BEAT * 3.6 if j < 3 else 0.35, p, 0.7))
    cluster = [N(0, LOOP_S - 0.3, p, 0.6) for p in (65, 66, 72)]  # F, Gb, C
    se = render_loop([Part(stuck, "corps_bell", 0.7, detune=18, seed=51),
                      Part(amen, "choir", 0.35, detune=14, seed=52),
                      Part(cluster, "organ", 0.4, detune=10, seed=53),
                      Part(head, "vibes", 0.8, detune=25, seed=54, kw={"tremolo": 2.2})], LOOP_S)
    t = np.arange(n) / SR
    se *= 0.75 + 0.25 * np.sin(TAU * 3 / LOOP_S * t)  # the whole thing breathes, three times a loop
    se = slips(se, every=(4, 8), depth=(60, 140), seed=55, drift_cents=20)
    se = crush(speaker(room(se, 0.22)), bits=9, seed=5)
    write("searching", se + hum(n, 0.018, buzz=0.5) + sub_drone(n, 0.07, 56))
    print(f"-> {OUT}")


if __name__ == "__main__":
    main()
