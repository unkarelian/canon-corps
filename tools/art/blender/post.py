"""Turn Blender renders into CanonOS assets: shrink, harden the alpha, and reduce to a small palette.

Late-90s pre-rendered icons were 256-colour or less, with 1-bit transparency, so these are too. That is also
what lets them sit next to the pixel art without looking pasted in.

  uv run --with pillow python tools/art/blender/post.py
"""
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
GAME = HERE.parents[2] / "game/assets"


def reduce(src, size, colours, alpha_cut=110, shadow=True):
    im = Image.open(src).convert("RGBA")
    # shrink in two steps: box filter keeps the rendered detail crisper than one big Lanczos
    im = im.resize((size * 2, size * 2), Image.LANCZOS).resize((size, size), Image.BOX)
    a = im.getchannel("A").point(lambda v: 255 if v >= alpha_cut else 0)
    rgb = Image.new("RGB", im.size, (0, 0, 0))
    rgb.paste(im.convert("RGB"), mask=a)
    q = rgb.quantize(colors=colours, method=Image.MEDIANCUT, dither=Image.NONE).convert("RGB")
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    if shadow:  # a hard 1px drop shadow down-right, the way desktop icons sat on the wallpaper
        sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
        sh.paste((24, 28, 22, 150), (1, 1), a)
        out.alpha_composite(sh)
    piece = q.convert("RGBA")
    piece.putalpha(a)
    out.alpha_composite(piece)
    return out


def icons():
    d = GAME / "icons"
    d.mkdir(exist_ok=True)
    for n in ("mail", "viewer", "files", "scanner", "hq", "orientation", "notepad", "intranet"):
        reduce(OUT / f"{n}.png", 48, 24).save(d / f"{n}.png")
        reduce(OUT / f"{n}.png", 16, 8, shadow=False).save(d / f"{n}16.png")


def emblem():
    if (OUT / "medallion.png").exists():
        reduce(OUT / "medallion.png", 96, 32).save(GAME / "seal/medallion.png")


SITES = ("records", "chapel", "council", "forum", "paper", "harbour", "shop", "works", "hall", "house",
         "school", "station", "farm", "clinic", "lighthouse")
# the Reality Viewer's own colours (style.css: --void, --phos-faint, --phos-dim, --phos)
PHOSPHOR = [(2, 10, 4), (13, 61, 26), (47, 163, 87), (93, 255, 133)]
BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def phosphor(src, w=160, h=88, gamma=1.25, stretch=None):
    """A grey render to four phosphor tones with a 4x4 ordered dither, over a sky that darkens upward.
    stretch=(lo, hi) maps the subject's own darkest and lightest greys to lo..hi first (dark subjects stay legible)."""
    im = Image.open(src).convert("RGBA").resize((w, h), Image.LANCZOS)
    sky = Image.new("L", (w, h))
    sky.putdata([int(28 + 40 * (y / h)) for y in range(h) for _ in range(w)])
    grey = im.convert("L")
    if stretch:
        a = im.getchannel("A")
        vals = sorted(v for v, al in zip(grey.get_flattened_data(), a.get_flattened_data()) if al > 128)
        if vals:
            lo, hi = vals[len(vals) // 50], vals[-len(vals) // 50 - 1]
            grey = grey.point(lambda v: max(0, min(255, round(stretch[0] + (v - lo) * (stretch[1] - stretch[0]) / max(1, hi - lo)))))
    lum = Image.composite(grey, sky, im.getchannel("A"))
    out = Image.new("RGB", (w, h))
    px, op = lum.load(), out.load()
    n = len(PHOSPHOR) - 1
    for y in range(h):
        for x in range(w):
            v = (px[x, y] / 255) ** gamma * n
            lo = int(v)
            t = (BAYER4[y % 4][x % 4] + 0.5) / 16
            op[x, y] = PHOSPHOR[min(n, lo + (1 if v - lo > t else 0))]
    return out


def sites():
    d = GAME / "sites"
    d.mkdir(exist_ok=True)
    for n in SITES:
        if (OUT / f"site_{n}.png").exists():
            phosphor(OUT / f"site_{n}.png").save(d / f"{n}.png")


def gauges():
    for i in range(5):
        if (OUT / f"gauge{i}.png").exists():
            reduce(OUT / f"gauge{i}.png", 64, 32, shadow=False).save(GAME / f"icons/gauge{i}.png")


def portraits(n=36):
    """Townspeople: a 48px reduced-colour portrait for Mail, and a 40px phosphor one for forum posts."""
    d = GAME / "people"
    d.mkdir(exist_ok=True)
    for i in range(n):
        src = OUT / f"p{i:02d}.png"
        if src.exists():
            reduce(src, 48, 32, shadow=False).save(d / f"p{i:02d}.png")
            phosphor(src, 40, 40, gamma=1.0, stretch=(70, 250)).save(d / f"g{i:02d}.png")


def paper():
    """Scale each render so the bare paper comes out at a set off-white; the folds and holes keep their shading."""
    d = GAME / "paper"
    d.mkdir(exist_ok=True)
    for name, target in (("sheet", (242, 238, 226)), ("fanfold", (244, 242, 233))):
        src = OUT / f"{name}.png"
        if not src.exists():
            continue
        im = Image.open(src).convert("RGBA")
        a = im.getchannel("A")
        rgb = im.convert("RGB")
        chans = []
        for c, t in zip(rgb.split(), target):
            vals = sorted(v for v, al in zip(c.get_flattened_data(), a.get_flattened_data()) if al > 200)
            p = vals[len(vals) * 3 // 4]  # the bright paper, not the green bars
            chans.append(c.point(lambda v, p=p, t=t: min(255, round(v * t / max(1, p)))))
        out = Image.merge("RGB", chans)
        if name == "sheet":
            out.save(d / "sheet.jpg", quality=86)
        else:
            out.putalpha(a.point(lambda v: 255 if v > 128 else 0))
            out.save(d / "fanfold.png")


def spin(n=24, size=96):
    """The boot screen's turning medallion as one horizontal sprite strip (CSS steps through it)."""
    src = OUT / "film/spin"
    if not (src / "000.png").exists():
        return
    strip = Image.new("RGBA", (size * n, size), (0, 0, 0, 0))
    for i in range(n):
        strip.alpha_composite(reduce(src / f"{i:03d}.png", size, 32, shadow=False), (i * size, 0))
    strip.save(GAME / "seal/spin.png")


def letterhead(size=56):
    """The blind emboss: scale so flat paper is pure white, then a few greys. Opaque, for a white pane."""
    if not (OUT / "emboss.png").exists():
        return
    im = Image.open(OUT / "emboss.png").convert("L")
    px = sorted(im.get_flattened_data())
    paper = px[len(px) // 2]
    im = im.point(lambda v: max(0, 255 - round((255 - min(255, v * 255 / paper)) * 1.6)))
    im = im.resize((size * 2, size * 2), Image.LANCZOS).resize((size, size), Image.BOX)
    im.quantize(colors=8, dither=Image.NONE).convert("L").save(GAME / "seal/emboss.png")


if __name__ == "__main__":
    icons()
    emblem()
    sites()
    gauges()
    portraits()
    paper()
    spin()
    letterhead()
