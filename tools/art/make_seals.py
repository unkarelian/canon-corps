"""Draw the seals and the Corps emblem as 1-bit pixel art. Nothing in the game ever mentions them.

  solomon.png   a Solomonic seal: double ring, a band of invented glyphs, interlaced hexagram, a bar at centre
  pentacle.png  a square pentacle in the grimoire manner: border of glyphs, circle, cross, small triangles
  corps.png     the Canon Corps emblem in phosphor: a ring, six spokes, a hexagon, the same bar at centre
  emblem16.png / emblem48.png   the emblem in drab office colours (Start button, splash)
  wall.png      a desktop wallpaper tile: emblem geometry at a few percent contrast

The Corps emblem is the seal with the occult parts taken off: same ring, same hexagram points (as spokes),
same centre bar. Anyone who lines them up will see it; nobody is told.

  uv run --project ~/Projects/SpriteFactory python tools/art/make_seals.py
"""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "game/assets/seal"
PREVIEW = Path(__file__).parent / "out"
PHOS = (93, 255, 133, 255)
DIM = (47, 163, 87, 255)
CLEAR = (0, 0, 0, 0)


def glyphs(n: int, seed: int = 7) -> list[list[tuple[int, int, int, int]]]:
    """An invented script: each glyph is 2-3 strokes on a 4x6 grid, never repeating."""
    rng = random.Random(seed)
    pts = [(x, y) for x in (0, 2, 4) for y in (0, 3, 6)]
    seen, out = set(), []
    while len(out) < n:
        strokes = []
        for _ in range(rng.choice((2, 3, 3))):
            a, b = rng.sample(pts, 2)
            strokes.append((*a, *b))
        key = tuple(sorted(strokes))
        if key in seen:
            continue
        seen.add(key)
        out.append(strokes)
    return out


def draw_glyph(d: ImageDraw.ImageDraw, g, x: int, y: int, fill) -> None:
    for x0, y0, x1, y1 in g:
        d.line([(x + x0 * 0.5, y + y0 * 0.5), (x + x1 * 0.5, y + y1 * 0.5)], fill=fill)  # 3x4 px glyph


def ring(d, c, r, fill):
    d.ellipse([c - r, c - r, c + r, c + r], outline=fill)


def star_points(c, r, k, rot=-math.pi / 2):
    return [(c + r * math.cos(rot + 2 * math.pi * i / k), c + r * math.sin(rot + 2 * math.pi * i / k)) for i in range(k)]


def centre_bar(d, c, h, fill):
    d.line([(c, c - h), (c, c + h)], fill=fill)
    d.line([(c - 2, c - h), (c + 2, c - h)], fill=fill)
    d.line([(c - 2, c + h), (c + 2, c + h)], fill=fill)


def solomon(size: int = 96) -> Image.Image:
    im = Image.new("RGBA", (size, size), CLEAR)
    d = ImageDraw.Draw(im)
    c = size // 2
    ring(d, c, c - 2, PHOS)
    ring(d, c, c - 4, PHOS)
    ring(d, c, c - 13, PHOS)
    gs = glyphs(22)
    for i, g in enumerate(gs):  # the glyph band, upright, around the ring
        a = -math.pi / 2 + 2 * math.pi * i / len(gs)
        r = c - 8.5
        draw_glyph(d, g, round(c + r * math.cos(a) - 1), round(c + r * math.sin(a) - 1.5), PHOS)
    pts = star_points(c, c - 14, 6)
    d.polygon([pts[0], pts[2], pts[4]], outline=PHOS)
    d.polygon([pts[1], pts[3], pts[5]], outline=PHOS)
    inner = star_points(c, c - 18, 6)
    d.polygon([inner[0], inner[2], inner[4]], outline=DIM)
    d.polygon([inner[1], inner[3], inner[5]], outline=DIM)
    ring(d, c, 9, PHOS)
    centre_bar(d, c, 6, PHOS)
    for i, p in enumerate(star_points(c, c - 30, 6, -math.pi / 2 + math.pi / 6)):  # a letter in each point
        draw_glyph(d, gs[(i * 5) % len(gs)], round(p[0] - 1), round(p[1] - 1.5), PHOS)
    return im


def pentacle(size: int = 96) -> Image.Image:
    im = Image.new("RGBA", (size, size), CLEAR)
    d = ImageDraw.Draw(im)
    m = 3
    d.rectangle([m, m, size - 1 - m, size - 1 - m], outline=PHOS)
    d.rectangle([m + 9, m + 9, size - 1 - m - 9, size - 1 - m - 9], outline=PHOS)
    gs = glyphs(36, seed=19)
    k = 0
    for i in range(9):  # glyphs along all four sides of the border
        t = m + 8 + i * (size - 2 * m - 18) / 8
        for x, y in ((t, m + 3), (t, size - m - 7), (m + 3, t), (size - m - 6, t)):
            draw_glyph(d, gs[k % len(gs)], round(x - 1), round(y - 1), PHOS)
            k += 1
    c = size // 2
    ring(d, c, 30, PHOS)
    d.line([(c, c - 30), (c, c + 30)], fill=DIM)
    d.line([(c - 30, c), (c + 30, c)], fill=DIM)
    for q in range(4):  # a small upward triangle in each quarter, and a glyph inside it
        qx = c + (13 if q % 2 else -13)
        qy = c + (13 if q // 2 else -13)
        d.polygon([(qx, qy - 7), (qx - 6, qy + 4), (qx + 6, qy + 4)], outline=PHOS)
        draw_glyph(d, gs[q * 7], qx - 1, qy - 2, PHOS)
    ring(d, c, 5, PHOS)
    return im


def corps(size: int, fg, bg=None, ticks=True, bar=True) -> Image.Image:
    """An official dial: double ring, six ticks where the seal's hexagram points fall, an inner ring, the bar."""
    im = Image.new("RGBA", (size, size), bg or CLEAR)
    d = ImageDraw.Draw(im)
    c = size // 2
    r = c - 1
    ring(d, c, r, fg)
    if size >= 32:
        ring(d, c, r - 3, fg)
    if ticks:
        r_out = r - (4 if size >= 32 else 1)
        for p in star_points(c, r_out, 6):
            q = (c + (p[0] - c) * 0.72, c + (p[1] - c) * 0.72)
            d.line([q, p], fill=fg)
    if size >= 32:
        ring(d, c, round(size * 0.094) + 1, fg)  # the seal's inner ring, at the same proportion
    if bar:
        centre_bar(d, c, max(2, round(size * 0.0625)), fg)
    return im


def wall_tile(size: int = 48) -> Image.Image:
    """Mostly a plain office texture: a faint dot grid. Every tile also carries a tiny ring and spokes."""
    im = Image.new("RGBA", (size, size), CLEAR)
    d = ImageDraw.Draw(im)
    ink = (0, 0, 0, 9)
    for x in range(0, size, 4):
        for y in range(0, size, 4):
            if (x + y) % 8 == 0:
                d.point((x, y), fill=(0, 0, 0, 8))
    c = size // 2
    ring(d, c, 7, ink)
    for p in star_points(c, 11, 6):
        q = (c + (p[0] - c) * 7 / 11, c + (p[1] - c) * 7 / 11)
        d.line([q, p], fill=ink)
    d.point((c, c - 1), fill=ink); d.point((c, c), fill=ink); d.point((c, c + 1), fill=ink)
    return im


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    title = (46, 58, 71, 255)
    art = {
        "solomon": solomon(),
        "pentacle": pentacle(),
        "corps": corps(96, PHOS),
        "emblem16": corps(16, title, ticks=False),
        "emblem48": corps(48, title),
        "wall": wall_tile(),
    }
    for name, im in art.items():
        im.save(OUT / f"{name}.png")
    # A preview sheet at 4x on the phosphor void, to look at.
    tiles = [art["solomon"], art["pentacle"], art["corps"]]
    sheet = Image.new("RGBA", (3 * 96 + 40, 96 + 20), (2, 10, 4, 255))
    for i, t in enumerate(tiles):
        sheet.alpha_composite(t, (10 + i * 106, 10))
    sheet = sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST)
    sheet.save(PREVIEW / "seals_preview.png")
    office = Image.new("RGBA", (300, 120), (102, 112, 95, 255))
    for x in range(0, 300, 48):
        for y in range(0, 120, 48):
            office.alpha_composite(art["wall"], (x, y))
    office.alpha_composite(Image.new("RGBA", (60, 60), (200, 196, 182, 255)), (230, 50))
    office.alpha_composite(art["emblem48"], (236, 56))
    office.alpha_composite(art["emblem16"], (200, 90))
    office.resize((600, 240), Image.NEAREST).save(PREVIEW / "office_preview.png")
    print("->", OUT)


if __name__ == "__main__":
    main()
