"""Turn the 3D eye renders (eye3d.py) into the loss's game assets.

  uv run --with numpy --with pillow python tools/eye/morph3d.py

Writes game/assets/eye/real/:
  mNN.webp        the morph: the 2D sprite becoming the render, 640x320 each
  gaze.webp       every gaze pose in one sheet: column = yaw (eye3d.YAWS), row = pitch (eye3d.PITCHES)
  timeline.json   frame durations, each stage's resolution and colour, and the sheet's layout

The morph is not a crossfade. The image gets truer in uneven jumps -- resolution doubling, the
green turning to white-gold -- and the pupil reaches each stage before the rest of the eye does, as if it
were focusing on you. Once, early, a single frame of the finished eye shows through and is gone.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SRC = HERE / "out3d" / "grid"
OUT = ROOT / "game/assets/eye/real"
W, H = 640, 320
YAWS = list(range(-36, 37, 6))           # keep in step with eye3d.py
PITCHES = [-15, -7.5, 0, 7.5, 15]
PUPIL = (W / 2, H / 2)
# An oval fade to black well inside the frame, so no glow is ever cut off by the canvas's edge.
_yy, _xx = np.mgrid[0:H, 0:W]
_d = ((_xx - W / 2) / (W / 2)) ** 2 + ((_yy - H / 2) / (H / 2)) ** 2
EDGE = np.clip((1.0 - _d) / 0.3, 0, 1)[..., None].astype(np.float32) ** 1.5

# (ms, resolution width, colour 0..1, focus: resolution width inside the pupil's circle, or None)
STAGES = [
    (260, None, 0.0, None),   # the sprite itself
    (140, 64, 0.0, None),     # the render, crushed to the sprite's grid and greens: nearly the same eye
    (50, W, 1.0, None),       # one frame of what is coming
    (110, 96, 0.0, 192),
    (90, 128, 0.25, 320),
    (160, 213, 0.5, W),
    (70, 320, 0.75, W),
    (130, W, 0.9, None),
    (0, W, 1.0, None),        # the eye, held (the engine decides for how long)
]


def load(p: Path) -> np.ndarray:
    """A render, with its bloom: the lines glow gold into the dark around them."""
    im = Image.open(p).convert("RGB")
    a = np.asarray(im, dtype=np.float32) / 255
    wide = np.asarray(im.filter(ImageFilter.GaussianBlur(14)), dtype=np.float32) / 255
    near = np.asarray(im.filter(ImageFilter.GaussianBlur(4)), dtype=np.float32) / 255
    gold = np.array([1.0, 0.72, 0.32], dtype=np.float32)
    return np.clip(a + near * 0.45 + wide * gold * 1.1, 0, 1) * EDGE


def pixelate(img: np.ndarray, res: int) -> np.ndarray:
    if res >= W:
        return img
    im = Image.fromarray((img * 255).astype(np.uint8))
    small = im.resize((res, round(res * H / W)), Image.BOX)
    return np.asarray(small.resize((W, H), Image.NEAREST), dtype=np.float32) / 255


def phosphor(img: np.ndarray, ramp: np.ndarray) -> np.ndarray:
    """The render as the sprite would draw it: brightness snapped onto the sprite's own greens."""
    lum = img @ np.array([0.30, 0.59, 0.11], dtype=np.float32)
    lum = np.clip(lum / max(1e-3, np.percentile(lum, 99)), 0, 1)
    idx = np.clip(np.round(lum * (len(ramp) - 1)).astype(int), 0, len(ramp) - 1)
    return ramp[idx]


def sprite_ramp(sprite: Image.Image) -> np.ndarray:
    cols = np.unique(np.asarray(sprite.convert("RGB")).reshape(-1, 3), axis=0).astype(np.float32) / 255
    return cols[np.argsort(cols @ np.array([0.30, 0.59, 0.11], dtype=np.float32))]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sprite = Image.open(ROOT / "game/assets/eye/006.png")  # the open eye, looking straight out
    ramp = sprite_ramp(sprite)
    real = load(SRC / "0_0.png")
    yy, xx = np.mgrid[0:H, 0:W]
    dist = np.hypot(xx - PUPIL[0], yy - PUPIL[1])
    focus_mask = np.clip((95 - dist) / 25, 0, 1)[..., None]  # the iris and a little round it

    frames = []
    for i, (ms, res, colour, focus) in enumerate(STAGES):
        if res is None:
            img = np.asarray(sprite.convert("RGB").resize((W, H), Image.NEAREST), dtype=np.float32) / 255
        else:
            def at(r):
                px = pixelate(real, r)
                return phosphor(px, ramp) * (1 - colour) + px * colour
            img = at(res)
            if focus:
                img = img * (1 - focus_mask) + at(focus) * focus_mask
        Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(OUT / f"m{i:02d}.webp", quality=88)
        frames.append({"ms": ms, "res": res, "colour": colour})

    sheet = Image.new("RGB", (W * len(YAWS), H * len(PITCHES)))
    for c, yaw in enumerate(YAWS):
        for r, pitch in enumerate(PITCHES):
            sheet.paste(Image.fromarray((load(SRC / f"{yaw}_{pitch:g}.png") * 255).astype(np.uint8)), (c * W, r * H))
    sheet.save(OUT / "gaze.webp", quality=82, method=6)

    (OUT / "timeline.json").write_text(json.dumps({
        "w": W, "h": H, "frames": frames, "morph_ms": sum(f["ms"] for f in frames),
        "yaws": YAWS, "pitches": PITCHES}, indent=1))
    size = sum(p.stat().st_size for p in OUT.iterdir()) / 1024
    print(f"{len(frames)} morph frames, {len(YAWS)}x{len(PITCHES)} gaze sheet, {size:.0f} KB -> {OUT}")


if __name__ == "__main__":
    main()
