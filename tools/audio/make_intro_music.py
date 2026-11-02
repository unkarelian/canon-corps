"""Music for the opening cinematic: one lullaby, before and after the Rollover.

  intro_kept   F major, 72 bpm. A music box plays a lullaby built on the Corps chime (C A D F) over soft
               e-piano arpeggios, fretless bass, strings, and the choir and organ far down in the mix. The
               last two bars are the chime on the bell over the hold music's minor Amen (iv to I). Loops.
  intro_after  the same lullaby in F minor at 60 bpm: the chime turns into C Ab Db F, the music box is out of
               tune with itself, the tape drags, a sub drone sits underneath, and the bell chime lands a
               semitone sharp, the way it does in the hold music once the town has noticed you. Loops.

Both are then played off a worn VHS tape (vhs(): wow, flutter, saturation, hiss) and crushed, so they sound
like the soundtrack of the tape the cinematic is on.

The cinematic plays intro_kept, cuts it dead on "...and stopped", and starts intro_after on the next panel.

  uv run --project ~/Projects/MusicStudio --all-extras --with scipy python tools/audio/make_intro_music.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

from musicstudio import Studio
from musicstudio.render import render

sys.path.insert(0, str(Path(__file__).parent))
from synth import N, Part, render_loop, speaker, crush, room, slips, hum, read_at_speed, SR, TAU  # noqa: E402
from scipy.signal import butter, sosfilt  # noqa: E402
from make_music import write, sub_drone, WORK  # noqa: E402

# The lullaby, in scale degrees (0 = F). Its head is the Corps chime: C A D F.
LULLABY = [
    ("1", "4:1/4. 2:1/8 5:1/4 7:1/4 6:1/4. 5:1/8 4:1/2"),      # C. A D F | E. D C
    ("3", "3:1/4. 4:1/8 5:1/4 3:1/4 2:1/2. r:1/4"),            # Bb. C D Bb | A
    ("5", "4:1/4. 2:1/8 5:1/4 7:1/4 8:1/4. 7:1/8 5:1/2"),      # C. A D F | G. F D
    ("7", "6:1/4. 5:1/8 4:1/4 2:1/4 0:1/2. r:1/4"),            # E. D C A | F
    ("9", "5:1/8 6:1/8 7:1/4 7:1/4 9:1/4 8:1/4. 7:1/8 5:1/2"),  # D E F F A | G. F D
    ("11", "3:1/4. 2:1/8 1:1/4 2:1/4 4:1/2. r:1/4"),           # Bb. A G A | C
    ("13", "4:1/4. 2:1/8 5:1/4 7:1/4 9:1/4. 8:1/8 7:1/2"),     # C. A D F | A. G F
]
BARS = 16


def piece(s: Studio, name: str, key: str, bpm: int, harmony: list[list[str]], phrases: list[int]) -> None:
    s.create(name, key=key, tempo=bpm, style="freeform", sections=[["A", 8], ["B", 8]], overwrite=True)
    s.set_harmony(name, harmony)
    s.add_voice(name, "box", "celesta", role="melody", octave=5)
    s.add_voice(name, "keys", "rhodes", role="harmony", octave=3)
    s.add_voice(name, "bass", "contrabass", role="bass", octave=2)
    s.add_voice(name, "pad", "strings", role="pad", octave=3, dynamic="pp")
    s.add_voice(name, "choir", "choir", role="pad", octave=4, dynamic="pp")
    for i in phrases:
        at, steps = LULLABY[i]
        s.add_op(name, "box", "phrase", id=f"lull{i}", steps=steps, at=at, dynamic="mp")
    s.add_op(name, "keys", "chords", id="arp", at="1", bars=BARS, voicing="arpeggio_up", tones=3, rhythm="1/8", dynamic="pp")
    s.add_op(name, "bass", "bass", id="bass", at="1", bars=BARS, pattern="root", rhythm="1", dynamic="p")
    s.add_op(name, "pad", "chords", id="pad", at="9", bars=8, voicing="pad", tones=3, dynamic="pp")
    s.add_op(name, "choir", "chords", id="choir", at="5", bars=12, voicing="pad", tones=3, dynamic="pp")


def notes(s: Studio, name: str, beat: float) -> dict[str, list[N]]:
    out: dict[str, list[N]] = {}
    for n in render(s.get(name)).notes:
        out.setdefault(n.voice, []).append(N(n.start / 480 * beat, n.dur / 480 * beat, n.pitch, 0.55 + 0.45 * n.velocity / 127))
    return out


def vhs(x: np.ndarray, seed: int, wow: float = 8.0, hiss: float = 0.018) -> np.ndarray:
    """Played back off a worn VHS tape: wow and flutter, a soft tape saturation and hiss. Loop-safe: the wow
    and flutter run a whole number of cycles per loop."""
    n = len(x)
    loop = n / SR
    t = np.arange(n) / SR
    cents = (wow * np.sin(TAU * round(loop * 0.55) * t / loop)
             + wow * 0.3 * np.sin(TAU * round(loop * 9.3) * t / loop + 1.0))
    y = read_at_speed(x, 2 ** (cents / 1200))
    y = np.tanh(1.8 * y / np.abs(y).max()) / np.tanh(1.8)
    noise = sosfilt(butter(2, [1800, 7000], btype="band", fs=SR, output="sos"), np.random.default_rng(seed).normal(0, 1, n))
    return y + hiss * noise / np.abs(noise).max() * 3


def chime(bar: float, beat: float, pitches) -> list[N]:
    return [N(bar + j * beat, 1.6 * beat, p, 0.85) for j, p in enumerate(pitches)]


def main() -> None:
    s = Studio(WORK / "pieces")

    # ---- before: the world is kept ------------------------------------------------------------
    bpm = 72
    beat = 60 / bpm
    bar = 4 * beat
    loop = BARS * bar
    piece(s, "cc_intro_kept", "F major", bpm, [
        ["1", "I"], ["2", "iii"], ["3", "IV"], ["4", "I"], ["5", "vi"], ["6", "ii"], ["7", "V"], ["8", "I"],
        ["9", "vi"], ["10", "IVmaj7"], ["11", "ii7"], ["12", "V"], ["13", "vi"], ["14", "ii7"], ["15", "iv"], ["16", "I"],
    ], phrases=range(7))
    nv = notes(s, "cc_intro_kept", beat)
    parts = [
        Part(nv["box"], "music_box", 1.0, seed=1),
        Part([N(n.t, n.dur, n.pitch + 12, n.vel * 0.5) for n in nv["box"] if n.t >= 8 * bar], "vibes", 0.35, seed=8),
        Part(nv["keys"], "fm_epiano", 0.24, seed=2),
        Part(nv["bass"], "fretless", 0.7, seed=3),
        Part(nv["pad"], "gm_strings", 0.5, seed=4),
        Part(nv["choir"], "choir", 0.1, seed=6),
        Part([N(0, loop - 0.4, 65, 0.7), N(0, loop - 0.4, 72, 0.6)], "organ", 0.05, seed=7),
        Part(chime(14 * bar, beat, (72, 69, 74, 77)), "corps_bell", 0.42, seed=5),
    ]
    kept = render_loop(parts, loop)
    write("intro_kept", crush(vhs(speaker(room(kept, 0.26), hp=260, lp=4400), seed=1), bits=10, hold=3, seed=1))

    # ---- after: the same lullaby, in the copies -----------------------------------------------
    bpm = 60
    beat = 60 / bpm
    bar = 4 * beat
    loop = BARS * bar
    piece(s, "cc_intro_after", "F minor", bpm, [
        ["1", "i"], ["2", "VI"], ["3", "iv"], ["4", "i"], ["5", "VI"], ["6", "iv"], ["7", "V"], ["8", "i"],
        ["9", "VI"], ["10", "iv"], ["11", "iv"], ["12", "V"], ["13", "VI"], ["14", "iv"], ["15", "iv"], ["16", "i"],
    ], phrases=(0, 2, 4, 6))  # half the phrases: it keeps losing its place
    # where the missing phrase should be, it starts it, stops, and tries one more note
    s.add_op("cc_intro_after", "box", "phrase", id="lost", steps="3:1/4. 2:1/8 r:1/2 r:1/2 1:1/2", at="11", dynamic="p")
    nv = notes(s, "cc_intro_after", beat)
    parts = [
        Part(nv["box"], "music_box", 0.9, detune=28, seed=11),
        Part([N(n.t, n.dur * 2, n.pitch - 12, n.vel * 0.6) for n in nv["box"]], "choir", 0.1, detune=14, seed=16),
        Part(nv["keys"], "fm_epiano", 0.24, detune=20, dropout=0.2, seed=12),
        Part(nv["bass"], "fretless", 0.6, detune=8, seed=13),
        Part(nv["pad"], "gm_strings", 0.32, detune=22, seed=14),
        Part(nv["choir"], "choir", 0.12, detune=10, seed=17),
        Part([N(0, loop - 0.4, 65, 0.7), N(0, loop - 0.4, 66, 0.4)], "organ", 0.07, detune=6, seed=18),
        Part(chime(14 * bar, beat, (72, 68, 73, 78)), "corps_bell", 0.28, detune=12, seed=15),  # C Ab Db F#: wrong
    ]
    after = render_loop(parts, loop)
    after = slips(after, every=(9, 15), depth=(35, 70), seed=19, drift_cents=10)
    n = len(after)
    t = np.arange(n) / SR
    after *= 0.85 + 0.15 * np.sin(TAU * 2 / loop * t)
    after = crush(vhs(speaker(room(after, 0.3), hp=300, lp=3600), seed=2, wow=14, hiss=0.022), bits=9, hold=3, seed=2)
    write("intro_after", after + hum(n, 0.006) + sub_drone(n, 0.06, 20))


if __name__ == "__main__":
    main()
