"""Townspeople: head-and-shoulders portraits in the clerk's clip-art style (see mannequin() in film.py): a blank
head floating just clear of the collar, simple hair shapes, clothes as flat blocks. Exec'd after kit.py.

One model, varied per index with a fixed seed: hair (short, parted, bob, long, bun, balding, bald, curly, flat
cap), hair and skin tone, glasses, moustache or beard, and clothes (suit and tie, cardigan, jumper, open shirt,
overalls, blouse and scarf). Faces stay blank, like the clerk's.

The game picks a portrait for a person from a hash of their handle or address (js/apps.js, portraitFor), so the
same person always has the same face and generated towns need nothing new.

  blender -b --python tools/art/blender/headless.py -- portraits p00 p01 ... p35
"""
import math
import random

import bpy
from mathutils import Vector

COUNT = 36
SKIN = ["#efd6bd", "#e0c3a3", "#c99f7c", "#a87a56", "#7d5539", "#5e3e2a"]
HAIR = {"dark": "#2a2420", "brown": "#5b3b24", "auburn": "#7a3f22", "fair": "#b39360", "grey": "#9c9a94", "white": "#e4e1d8"}
CLOTH = ["#3d4452", "#5c4b3b", "#5f6650", "#2e2f35", "#6e4c4c", "#46566a", "#7a6d58", "#3f5a52"]
HAIRDOS = ["short", "parted", "bob", "long", "bun", "balding", "bald", "curly", "cap"]
CLOTHES = ["suit", "cardigan", "jumper", "shirt", "overalls", "scarf"]
R = 0.14  # head radius


def ball(name, loc, r, m, scale=(1, 1, 1), segs=24):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=segs, ring_count=segs // 2)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    _finish(o, m, 0, 0)
    return o


def cut(o, *planes):
    """Keep the side of each plane its normal points to (plane = (point, normal), in the object's own space)."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for co, no in planes:
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=[-n for n in no],
                               clear_inner=False, clear_outer=True)
    bm.to_mesh(o.data)
    bm.free()
    o.data.update()
    return o


def shell(name, head, k, m, *planes):
    return cut(ball(name, head, R * k, m, (0.95, 1, 1.12)), *[((c[0] * R, c[1] * R, c[2] * R), n) for c, n in planes])


def person(i):
    rng = random.Random(1000 + i)
    old = rng.random() < 0.3
    hairdo = HAIRDOS[i % len(HAIRDOS)]
    clothes = CLOTHES[(i * 5 + i // len(HAIRDOS)) % len(CLOTHES)]
    hair_tone = rng.choice(["grey", "white"]) if old else rng.choice(["dark", "dark", "brown", "auburn", "fair"])
    return dict(
        hairdo=hairdo, clothes=clothes, old=old,
        skin=SKIN[(i * 7 + 3) % len(SKIN)], hair=HAIR[hair_tone],
        cloth=CLOTH[(i * 3 + rng.randrange(3)) % len(CLOTH)], cloth2=rng.choice(CLOTH),
        glasses=rng.choice([None, None, "round", "square"]) if not old else rng.choice(["round", "square", None]),
        face=rng.choice([None, None, None, "moustache", "beard"]) if hairdo not in ("bob", "long", "bun") else None,
        width=rng.uniform(0.9, 1.05), lean=rng.uniform(-6, 6),
    )


def build_person(p):
    skin = mat("skin", srgb(p["skin"]), 0.55)
    hair = mat("hair", srgb(p["hair"]), 0.75)
    cloth = mat("cloth", srgb(p["cloth"]), 0.7)
    cloth2 = mat("cloth2", srgb(p["cloth2"]), 0.75)
    white = mat("white", srgb("#ece8dc"), 0.7)
    dark = mat("dark", srgb("#1d1c1b"), 0.4, spec=0.6)
    head = Vector((0, 0, 0.215))

    # shoulders: a square frustum, flattened front to back, like the clerk's jacket
    bpy.ops.mesh.primitive_cone_add(radius1=0.36, radius2=0.42, depth=0.5, vertices=4, location=(0, 0, -0.25), rotation=(0, 0, math.pi / 4))
    body = bpy.context.object
    body.name = "body"
    body.scale = (1, 0.5, 1)
    c = p["clothes"]
    _finish(body, white if c == "shirt" else cloth, 0.1, 5)
    front = -0.42 * 0.707 * 0.5 - 0.005
    if c in ("suit", "cardigan"):
        poly("vee", [(-0.13, 0), (0.13, 0), (0, -0.28)], 0.01, (0, front - 0.004, -0.07), white, rot=(math.pi / 2, 0, 0))
        if c == "suit":
            poly("tie", [(-0.03, 0), (0.03, 0), (0.042, -0.24), (0, -0.28), (-0.042, -0.24)], 0.012, (0, front - 0.01, -0.075), dark, rot=(math.pi / 2, 0, 0))
        else:
            for k in range(3):
                ball(f"btn{k}", (0, front - 0.004, -0.23 - k * 0.07), 0.012, dark)
    elif c == "jumper":
        bpy.ops.mesh.primitive_torus_add(major_radius=0.085, minor_radius=0.022, location=(0, -0.005, -0.02))
        _finish(bpy.context.object, cloth2, 0, 0)
    elif c == "shirt":
        for s in (-1, 1):
            poly(f"collar{s}", [(0, 0), (s * 0.1, 0.0), (s * 0.03, -0.09)], 0.012, (0, front - 0.004, -0.06), white, rot=(math.pi / 2, 0, 0))
        poly("open", [(-0.03, 0), (0.03, 0), (0, -0.09)], 0.01, (0, front - 0.008, -0.06), skin, rot=(math.pi / 2, 0, 0))
    elif c == "overalls":
        body.data.materials.clear()
        body.data.materials.append(cloth2)
        box("bib", (0.22, 0.02, 0.2), (0, front - 0.006, -0.22), cloth)
        for s in (-1, 1):
            box(f"strap{s}", (0.04, 0.02, 0.2), (s * 0.13, front - 0.006, -0.06), cloth, rot=(0, s * 0.25, 0))
    elif c == "scarf":
        bpy.ops.mesh.primitive_torus_add(major_radius=0.09, minor_radius=0.035, location=(0, -0.01, 0.02))
        _finish(bpy.context.object, cloth2, 0, 0)
        box("tail", (0.05, 0.02, 0.16), (0.05, front - 0.01, -0.08), cloth2, rot=(0, 0.2, 0))

    # head: blank, floating a little above the collar
    h = ball("head", head, R, skin, (0.95 * p["width"], 1, 1.12))
    hd = p["hairdo"]
    if hd in ("short", "parted", "bun", "cap"):
        shell("hair", head, 1.07, hair, ((0, 0, 0.15), (0, 0.55, 1)))
    if hd == "parted":
        ball("tuft", head + Vector((0.07, -0.06, 0.12)), 0.06, hair, (1.3, 1.1, 0.6))
    if hd == "bun":
        ball("bun", head + Vector((0, 0.11, 0.1)), 0.055, hair)
    if hd in ("bob", "long"):
        shell("hair", head, 1.08, hair, ((0, 0, 0.25), (0, 0.55, 1)))
        shell("sides", head, 1.1, hair, ((0, -0.25, 0), (0, 1, 0)), ((0, 0, -0.75 if hd == "bob" else -1.0), (0, 0, 1)))
        if hd == "long":
            box("fall", (0.27, 0.08, 0.3), head + Vector((0, 0.07, -0.2)), hair, bevel=0.03)
    if hd == "balding":
        shell("fringe", head, 1.06, hair, ((0, 0.1, 0), (0, 1, 0)), ((0, 0, -0.45), (0, 0, 1)), ((0, 0, 0.3), (0, 0, -1)))
    if hd == "curly":
        rng = random.Random(7)
        for k in range(22):
            a, b = rng.uniform(0, 2 * math.pi), rng.uniform(-0.2, 1.2)
            if math.sin(a) < -0.3 and b < 0.7:
                continue  # leave the face
            d = Vector((math.cos(a) * math.cos(b), math.sin(a) * math.cos(b), math.sin(b) * 1.12))
            ball(f"curl{k}", head + d * R * 1.02, 0.05, hair, segs=12)
    if hd == "cap":
        cyl("crown", R * 1.02, 0.07, head + Vector((0, 0.005, 0.11)), cloth2, verts=32)
        box("brim", (0.2, 0.12, 0.015), head + Vector((0, -0.15, 0.085)), cloth2, rot=(math.radians(-8), 0, 0), bevel=0.01)

    face = p["face"]
    if face == "moustache":
        box("tache", (0.09, 0.03, 0.025), head + Vector((0, -R * 0.93, -0.045)), hair, bevel=0.01)
    if face == "beard":
        shell("beard", head, 1.05, hair, ((0, 0, -0.2), (0, 0, -1)), ((0, 0.25, 0), (0, -1, 0)))

    g = p["glasses"]
    if g:
        y, z = head.y - R * 0.98, head.z + 0.01
        for s in (-1, 1):
            if g == "round":
                bpy.ops.mesh.primitive_torus_add(major_radius=0.034, minor_radius=0.006, location=(s * 0.047, y, z), rotation=(math.pi / 2, 0, 0))
                _finish(bpy.context.object, dark, 0, 0)
            else:
                for dz, w_, h_ in ((0.027, 0.07, 0.008), (-0.024, 0.07, 0.008)):
                    box(f"gh{s}{dz}", (w_, 0.008, h_), (s * 0.047, y, z + dz), dark)
                for dx in (-0.035, 0.035):
                    box(f"gv{s}{dx}", (0.008, 0.008, 0.058), (s * 0.047 + dx, y, z), dark)
            box(f"temple{s}", (0.006, 0.12, 0.006), (s * 0.12, head.y - 0.06, z + 0.01), dark)
        box("bridge", (0.03, 0.008, 0.006), (0, y, z + 0.008), dark)


def build(name, out, size=128):
    i = int(name[1:])
    p = person(i)
    reset(size)
    build_person(p)
    icon_lights()
    # frame the head, then widen and drop so the shoulders fill the bottom of the picture
    cam = camera((-0.3 + p["lean"] * 0.02, -1.0, 0.1), margin=1.0, skip=("body", "vee", "tie", "btn", "collar", "open", "bib", "strap", "tail"))
    cam.data.ortho_scale *= 1.6
    cam.location.z -= 0.1
    return render(out)
