"""Build the eye's sound cue, synced frame-for-frame to out/timeline.json.

Layers:
  sting  -- out/sting_raw.wav, rendered by MusicStudio from piece `cc_eye_sting`
            (low D pedal, D-Eb-Ab tremolo cluster opening with the lids, A5/Bb5 rub)
  hum    -- a low electrical hum that rises in pitch and level as the lids open
  scrape -- a dry mechanical scrape on every frame the iris moves, scaled by how far
  tear   -- a burst of static on the torn frames
Everything is cut dead when the lids shut: the silence after is part of the cue.

Run with MusicStudio's env (numpy):
  uv run --project ~/Projects/MusicStudio --all-extras python tools/eye/make_sound.py
"""
import json
import wave
from pathlib import Path

import numpy as np

OUT = Path(__file__).parent / "out"
SR = 44100
TAIL_S = 1.2  # silence kept after the lids close


def read_wav(path: Path) -> np.ndarray:
    with wave.open(str(path)) as w:
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32)
        data /= 32768.0
        if w.getnchannels() == 2:
            data = data.reshape(-1, 2).mean(axis=1)
        assert w.getframerate() == SR
    return data


def write_wav(path: Path, x: np.ndarray) -> None:
    x = np.clip(x, -1, 1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


def lowpass(x: np.ndarray, a: float) -> np.ndarray:
    """One-pole lowpass; a in (0,1), smaller = darker."""
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += a * (v - acc)
        y[i] = acc
    return y


def main() -> None:
    tl = json.loads((OUT / "timeline.json").read_text())
    ms, openness, iris = tl["frame_ms"], tl["openness"], tl["iris_x"]
    starts = np.cumsum([0] + ms[:-1]) / 1000.0
    total = sum(ms) / 1000.0
    n = int((total + TAIL_S) * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(3)

    # The lids are fully shut from the last frame on: that is where everything stops.
    close_t = starts[-1]

    # Per-sample openness, stepped like the animation.
    frame_idx = np.clip(np.searchsorted(starts, t, side="right") - 1, 0, len(ms) - 1)
    op = np.array(openness)[frame_idx]
    op_smooth = lowpass(op.astype(np.float32), 0.0015)

    # Hum: 50 Hz mains-ish fundamental that sags up to ~62 Hz as the eye opens, with harmonics.
    f = 50 + 12 * op_smooth + 0.6 * np.sin(2 * np.pi * 0.7 * t)
    phase = 2 * np.pi * np.cumsum(f) / SR
    hum = (np.sin(phase) + 0.45 * np.sin(2 * phase) + 0.25 * np.sin(3 * phase + 0.4)
           + 0.12 * np.sign(np.sin(5 * phase)))
    hum_env = 0.10 + 0.55 * op_smooth
    hum *= hum_env * 0.32

    # Scrape: filtered noise bursts on frames where the iris moves.
    scrape = np.zeros(n, dtype=np.float32)
    for i in range(1, len(ms)):
        dx = abs(iris[i] - iris[i - 1])
        if dx == 0:
            continue
        a, length = int(starts[i] * SR), int(min(ms[i] / 1000.0, 0.11) * SR)
        burst = rng.standard_normal(length).astype(np.float32)
        grit = (rng.random(length) < 0.04) * rng.standard_normal(length) * 3  # dry ticks
        env = np.exp(-np.linspace(0, 5, length)) * np.minimum(1, np.linspace(0, 12, length))
        scrape[a:a + length] += (burst * 0.5 + grit) * env * min(1.0, dx / 3) * 0.22
    scrape = lowpass(scrape, 0.18)  # takes the hiss off, leaves a dull drag

    # Tear: a crackle of static on the torn frames.
    tear = np.zeros(n, dtype=np.float32)
    for i, g in enumerate(tl["glitch"]):
        if g:
            a, length = int(starts[i] * SR), int(ms[i] / 1000.0 * SR)
            tear[a:a + length] += rng.standard_normal(length) * 0.18 * (rng.random(length) < 0.3)

    sting = read_wav(OUT / "sting_raw.wav")[:n]
    sting = np.pad(sting, (0, n - len(sting))) * 0.9

    mix = hum + scrape + tear + sting
    # Cut everything dead as the lids shut (8 ms fade so it does not click).
    cut = int(close_t * SR)
    fade = int(0.008 * SR)
    mix[cut:cut + fade] *= np.linspace(1, 0, fade)
    mix[cut + fade:] = 0
    # A small lid "tick" right at the cut, then nothing.
    tick_len = int(0.012 * SR)
    mix[cut:cut + tick_len] += rng.standard_normal(tick_len) * np.linspace(0.35, 0, tick_len)

    mix /= max(1e-6, np.abs(mix).max()) / 0.85
    write_wav(OUT / "eye_notice.wav", mix)
    print(f"{n / SR:.2f}s, cut at {close_t:.2f}s -> {OUT / 'eye_notice.wav'}")


if __name__ == "__main__":
    main()
