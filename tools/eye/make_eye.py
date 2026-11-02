"""Render the Demiurge "first notice" eye animation.

The eye itself is the SpriteFactory sprite `cc_eye` (gallery/sprites/cc_eye.sf.json).
This script drives its ops frame by frame -- lid opening and iris position -- and
writes:
  out/eye_frames/NNN.png   raw 64x32 frames (palette-exact, for the game engine)
  out/eye_frames_cut/NNN.png  the same with the void transparent (the loss's small eyes)
  out/eye_sheet.png        all frames in one strip
  out/eye_raw.gif          raw frames at 8x, nearest-neighbour
  out/eye_crt.gif          8x with scanlines + phosphor glow (preview of in-viewer look)
  out/timeline.json        frame durations, for the engine and the sound cue

Run from the SpriteFactory project so its env has Pillow:
  uv run --project ~/Projects/SpriteFactory python tools/eye/make_eye.py
"""
import json
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

from spritefactory.studio import Studio
from spritefactory.render import to_image

GALLERY = Path.home() / "Projects/SpriteFactory/gallery"
OUT = Path(__file__).parent / "out"
SCALE = 8
CX, CY, HALF_W = 32, 16, 28
UP_MAX, LOW_MAX = 11, 9


def lid_curve(h: float, sign: int) -> list[list[int]]:
    return [[x, round(CY + sign * h * (1 - ((x - CX) / HALF_W) ** 2))]
            for x in range(CX - HALF_W, CX + HALF_W + 1, 4)]


def set_pose(s, openness: float, iris_x: int, iris_y: int = CY) -> None:
    up = lid_curve(UP_MAX * openness, -1)
    low = lid_curve(LOW_MAX * openness, +1)
    # Fills sit 1px outside the lid line so no void gap shows between line and eye.
    up_fill = [[x, y - 1] for x, y in up]
    low_fill = [[x, y + 1] for x, y in low]
    s.update("upper_lid", verts=[[0, 0], [63, 0], [63, CY]] + up_fill[::-1] + [[0, CY]])
    s.update("lower_lid", verts=[[0, 31], [63, 31], [63, CY]] + low_fill[::-1] + [[0, CY]])
    s.update("upper_line", verts=[[2, CY + 1]] + up + [[62, CY + 1]])
    s.update("lower_line", verts=low)
    dy = iris_y - CY
    s.update("iris_ring", cx=iris_x, cy=iris_y)
    s.update("iris", cx=iris_x, cy=iris_y)
    s.update("pupil", box=[iris_x - 1, 10 + dy, iris_x, 22 + dy])
    s.update("glint", points=[[iris_x - 4, 12 + dy], [iris_x - 3, 12 + dy], [iris_x - 4, 13 + dy]])



def ease(a: float, b: float, n: int) -> list[float]:
    """n steps from a to b (exclusive of a, inclusive of b), smoothstep-eased."""
    out = []
    for i in range(1, n + 1):
        t = i / n
        t = t * t * (3 - 2 * t)
        out.append(a + (b - a) * t)
    return out


def timeline() -> list[tuple[float, int, int, bool]]:
    """(openness, iris_x, duration_ms, glitch) per frame."""
    f = [(0.0, CX, 450, False)]                                   # closed: a bright slit
    f += [(o, CX, 70, False) for o in ease(0, 1, 5)]               # lids open
    f += [(1.0, CX, 500, False)]                                   # stare forward
    f += [(1.0, round(x), 60, False) for x in ease(CX, 18, 4)]     # glance hard left
    f += [(1.0, 18, 550, False)]
    sweep = [round(x) for x in ease(18, 46, 14)]                   # slow, searching sweep
    f += [(1.0, x, 95, i in (5, 9)) for i, x in enumerate(sweep)]  # two dropped/torn frames
    f += [(1.0, 46, 450, False)]
    f += [(1.0, round(x), 70, False) for x in ease(46, CX, 4)]     # back to centre: nothing
    f += [(1.0, CX, 350, False)]
    f += [(o, CX, 55, False) for o in ease(1, 0, 4)]               # lids close
    f += [(0.0, CX, 250, False)]
    return f


def tear(img: Image.Image, rng: random.Random) -> Image.Image:
    """Shift a band of rows sideways: the connection barely carrying the image."""
    out = img.copy()
    y0 = rng.randint(6, 18)
    band = img.crop((0, y0, img.width, y0 + rng.randint(3, 6)))
    out.paste(band, (rng.choice([-3, -2, 2, 3]), y0))
    return out


def cut(img: Image.Image) -> Image.Image:
    """The frame with its void made transparent: just the eye, for the loss's eyes that open in the dark."""
    void = img.getpixel((0, 0))
    out = img.copy()
    out.putdata([(0, 0, 0, 0) if px == void else px for px in img.getdata()])
    return out


def crt(img: Image.Image) -> Image.Image:
    big = img.convert("RGB").resize((img.width * SCALE, img.height * SCALE), Image.NEAREST)
    glow = big.filter(ImageFilter.GaussianBlur(SCALE * 0.9))
    big = ImageChops.add(big, glow.point(lambda v: int(v * 0.55)))
    lines = Image.new("L", big.size, 255)
    px = lines.load()
    for y in range(big.height):
        if y % SCALE in (SCALE - 2, SCALE - 1):
            for x in range(big.width):
                px[x, y] = 150
    return ImageChops.multiply(big, Image.merge("RGB", [lines] * 3))


def main() -> None:
    s = Studio(GALLERY).get("cc_eye")
    rng = random.Random(7)
    frames_dir, cut_dir = OUT / "eye_frames", OUT / "eye_frames_cut"
    frames_dir.mkdir(parents=True, exist_ok=True)
    raw, durations = [], []
    for i, (openness, iris_x, ms, glitch) in enumerate(timeline()):
        set_pose(s, openness, iris_x)
        img = to_image(s.render(), s.palette).convert("RGBA")
        if glitch:
            img = tear(img, rng)
        img.save(frames_dir / f"{i:03d}.png")
        cut_dir.mkdir(parents=True, exist_ok=True)
        cut(img).save(cut_dir / f"{i:03d}.png")
        raw.append(img)
        durations.append(ms)

    sheet = Image.new("RGBA", (64 * len(raw), 32))
    for i, img in enumerate(raw):
        sheet.paste(img, (64 * i, 0))
    sheet.save(OUT / "eye_sheet.png")

    big = [im.convert("RGB").resize((64 * SCALE, 32 * SCALE), Image.NEAREST) for im in raw]
    big[0].save(OUT / "eye_raw.gif", save_all=True, append_images=big[1:],
                duration=durations, loop=0)
    tv = [crt(im) for im in raw]
    tv[0].save(OUT / "eye_crt.gif", save_all=True, append_images=tv[1:],
               duration=durations, loop=0)
    tl = timeline()
    (OUT / "timeline.json").write_text(json.dumps(
        {"frame_ms": durations, "total_ms": sum(durations),
         "openness": [round(o, 3) for o, *_ in tl], "iris_x": [x for _, x, *_ in tl],
         "glitch": [g for *_, g in tl]}, indent=1))
    print(f"{len(raw)} frames, {sum(durations)} ms -> {OUT}")


if __name__ == "__main__":
    main()
