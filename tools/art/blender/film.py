"""Shots for the Corps orientation film, rendered frame by frame. Exec'd after kit.py (and icons.py, for the CRT).

Each shot is a short loop at 320x240 that plays under the captions in the Orientation app. A late-90s CD-ROM
training film: grey mannequins, a dark machine hall, glowing spheres. build(name, outdir) renders the frames;
encode.sh turns them into webm.

  hall       the Keeper: rows of cabinets, lights blinking, a mannequin for scale; slow dolly
  clock      the two-digit date rolling over from 12-31-99 to 01-01-00
  dark       the hall going dark, row by row
  split      one bright sphere falling into many small ones
  island     a lesser reality: a town on a disc of ground, turning slowly
  steady     the hall dark except one cabinet, whose light grows steadier
  local      the island under a dim ring of six spokes, turning
  desk       a mannequin agent at a desk with a CRT
  transmit   a beam going up from the desk
  flood      the island shaking
  inject     the island folding into a point of light
  seal       the bronze medallion turning
  uplink     the desk from further back, rings of signal rising off the monitor (loops; the HQ Console shows it
             while a fragment is transmitted)
"""
import math
import random

KIT_DIR = "/home/aureal/Projects/Canon Corps/tools/art/blender"

import bpy
from mathutils import Vector

W, H, FRAMES = 320, 240, 48


def eevee():
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.film_transparent = False
    try:
        sc.eevee.taa_render_samples = 16
    except Exception:
        pass
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.01, 0.012, 0.012, 1)
    sc.world.node_tree.nodes["Background"].inputs[1].default_value = 1.0


def emit_mat(name, rgb, strength):
    return mat(name, rgb, 0.5, emit=rgb, emit_strength=strength)


def set_emit(m, s):
    m.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = s


def cam_at(loc, aim, lens=35):
    cam = bpy.context.scene.camera
    if cam is None:
        cd = bpy.data.cameras.new("cam")
        cam = bpy.data.objects.new("cam", cd)
        bpy.context.collection.objects.link(cam)
        bpy.context.scene.camera = cam
    cam.data.lens = lens
    cam.data.sensor_width = 36
    cam.location = loc
    cam.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return cam


def lerp(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def group(build_fn, loc=(0, 0, 0), scale=1.0, rot_z=0.0):
    """Run a builder, then parent whatever it made to one empty so it can be placed and scaled."""
    before = set(bpy.context.scene.objects)
    build_fn()
    new = [o for o in bpy.context.scene.objects if o not in before]
    e = bpy.data.objects.new("grp", None)
    bpy.context.collection.objects.link(e)
    for o in new:
        if o.parent is None:
            o.parent = e
    e.location, e.scale, e.rotation_euler.z = loc, (scale,) * 3, rot_z
    return e


# ---- props ---------------------------------------------------------------------------------------

def limb(name, a, b, r, m, joint=True):
    """A cylinder from point a to point b, with a ball at b for the joint (so bends stay smooth)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d.length, vertices=14, location=(a + b) / 2)
    o = bpy.context.object
    o.name = name
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
    _finish(o, m, 0, 0)
    if joint:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=b, segments=14, ring_count=8)
        _finish(bpy.context.object, m, 0, 0)
    return o


def ball(loc, r, m, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=20, ring_count=12)
    o = bpy.context.object
    o.scale = scale
    _finish(o, m, 0, 0)
    return o


def hair_cap(loc, r, m, scale):
    """A shell over the head, cut along a hairline (high at the brow, low at the nape). Its open edge is a border,
    so Freestyle draws the hairline in the line-art version."""
    import bmesh
    o = ball(loc, r, m, scale)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0.15 * r),
                           plane_no=(0, 0.55, 1), clear_inner=True)
    bm.to_mesh(o.data)
    bm.free()
    o.data.update()
    return o


def mannequin(loc=(0, 0, 0), rot_z=0.0, seated=False):
    """The clerk, drawn like 1990s corporate clip art: a boxy suit with square shoulders, dark hair, a blank head
    floating just clear of the collar, mitten hands. Faces local -y; seated, the hands rest on the desk."""
    suit = mat("suit", srgb("#3d4452"), 0.6)
    skin = mat("skin", srgb("#cfc6b4"), 0.5)
    hair = mat("hair", srgb("#2b2621"), 0.7)
    shoe = mat("shoe", srgb("#1c1b1a"), 0.4, spec=0.6)

    def body():
        z0 = 0.45 if seated else 0.92  # hip height
        # jacket: a square frustum, broad at the shoulders, flattened front to back
        bpy.ops.mesh.primitive_cone_add(radius1=0.2, radius2=0.29, depth=0.58, vertices=4, location=(0, 0, z0 + 0.3),
                                        rotation=(0, 0, math.pi / 4))
        o = bpy.context.object
        o.scale = (1, 0.58, 1)
        _finish(o, suit, 0.03, 2)
        # head floats above the collar, with a cap of hair
        ball((0, -0.01, z0 + 0.8), 0.12, skin, (0.95, 1, 1.12))
        hair_cap((0, -0.01, z0 + 0.8), 0.128, hair, (0.95, 1, 1.12))
        for s in (-1, 1):
            sh = (s * 0.19, 0, z0 + 0.53)
            hip = (s * 0.09, 0, z0 + 0.04)
            if seated:
                elbow, hand = (s * 0.22, -0.12, z0 + 0.3), (s * 0.13, -0.47, 0.8)
                knee, foot = (s * 0.1, -0.44, z0 + 0.02), (s * 0.1, -0.47, 0.06)
            else:
                elbow, hand = (s * 0.24, 0.0, z0 + 0.26), (s * 0.25, -0.02, z0 + 0.0)
                knee, foot = (s * 0.09, 0, z0 * 0.5), (s * 0.09, 0, 0.06)
            limb(f"uarm{s}", sh, elbow, 0.06, suit)
            limb(f"farm{s}", elbow, hand, 0.055, suit, joint=False)
            ball(hand, 0.055, skin, (1, 1.3, 0.75))
            limb(f"thigh{s}", hip, knee, 0.08, suit)
            limb(f"shin{s}", knee, foot, 0.07, suit, joint=False)
            box(f"shoe{s}", (0.1, 0.2, 0.07), (foot[0], foot[1] - 0.05, 0.035), shoe, bevel=0.02)
    return group(body, loc, 1.0, rot_z)


def hall(rows=5, cols=4, dark_rows=0):
    """The Keeper's hall. Returns per-row lamp materials, so shots can blink or darken them."""
    floor = mat("floor", srgb("#1a1c1b"), 0.2, spec=0.8)
    case = mat("cabinet", srgb("#3b3f3c"), 0.4, metal=0.3)
    box("floor", (40, 40, 0.1), (0, 0, -0.05), floor)
    lamps = []
    rng = random.Random(9)
    for r in range(rows):
        row = [emit_mat(f"lamp{r}_{k}", srgb(c), 3.0) for k, c in enumerate(("#5dff85", "#ffb347", "#5dff85", "#e8f0ff"))]
        lamps.append(row)
        for side in (-1, 1):
            for c in range(cols):
                x = side * (1.2 + c * 1.0)
                y = r * 1.6
                box(f"cab{r}{side}{c}", (0.8, 0.6, 2.4), (x, y, 1.2), case, bevel=0.02)
                for i in range(10):
                    lx, lz = rng.uniform(-0.3, 0.3), rng.uniform(0.6, 2.2)
                    box(f"l{r}{side}{c}{i}", (0.06, 0.04, 0.04), (x + lx, y - 0.31, lz), rng.choice(row))
    return lamps


def island(town=True):
    """A lesser reality: a disc of ground with a rock underside and a small town on it."""
    grass = mat("grass", srgb("#6f7a5a"), 0.9)
    rock = mat("rock", srgb("#55504a"), 0.95)
    wall = mat("iwall", srgb("#d6d2c4"), 0.8)
    roof = mat("iroof", srgb("#7a4a3a"), 0.7)
    win = emit_mat("iwin", srgb("#ffd890"), 2.0)

    def build():
        cyl("disc", 1.3, 0.12, (0, 0, 0), grass, verts=48)
        bpy.ops.mesh.primitive_cone_add(radius1=1.3, radius2=0.1, depth=1.1, vertices=24, location=(0, 0, -0.61), rotation=(math.pi, 0, 0))
        _finish(bpy.context.object, rock, 0, 0)
        if not town:
            return
        rng = random.Random(3)
        spots = [(-0.5, -0.4), (-0.1, -0.6), (0.35, -0.45), (0.6, 0.0), (-0.65, 0.15), (0.2, 0.45), (-0.25, 0.55)]
        for i, (x, y) in enumerate(spots):
            w, d, h = rng.uniform(0.18, 0.26), rng.uniform(0.15, 0.2), rng.uniform(0.14, 0.2)
            box(f"h{i}", (w, d, h), (x, y, 0.06 + h / 2), wall)
            prism_x(f"r{i}", [(-d / 2 - 0.02, 0), (d / 2 + 0.02, 0), (0, 0.1)], w + 0.04, roof)
            bpy.context.object.location = (x, y, 0.06 + h)
            box(f"w{i}", (0.05, 0.01, 0.04), (x, y - d / 2 - 0.006, 0.06 + h * 0.55), win)
        box("tower", (0.14, 0.14, 0.5), (0.05, 0.05, 0.31), wall)
        bpy.ops.mesh.primitive_cone_add(radius1=0.11, radius2=0, depth=0.22, vertices=4, location=(0.05, 0.05, 0.67), rotation=(0, 0, math.pi / 4))
        _finish(bpy.context.object, roof, 0, 0)
        for i in range(5):
            a = i * 1.3
            bpy.ops.mesh.primitive_ico_sphere_add(radius=0.08, subdivisions=1, location=(math.cos(a) * 1.0, math.sin(a) * 1.0, 0.15))
            _finish(bpy.context.object, mat("itree", srgb("#3f5a35"), 0.9), 0, 0)
    return group(build)


def ring_of_spokes(r, m):
    def build():
        torus("sky_ring", r, r * 0.02, (0, 0, 0), m)
        for i in range(6):
            a = math.pi / 2 + 2 * math.pi * i / 6
            box(f"sky_sp{i}", (r * 0.28, r * 0.03, r * 0.01), (math.cos(a) * r * 0.78, math.sin(a) * r * 0.78, 0), m, rot=(0, 0, a))
    return group(build)


def desk_set():
    wood = mat("desk", srgb("#6e5b44"), 0.6)
    wallm = mat("wall", srgb("#4a4f4a"), 0.9)
    box("desk", (1.8, 0.8, 0.06), (0, 0, 0.74), wood)
    for x in (-0.8, 0.8):
        box(f"dleg{x}", (0.06, 0.7, 0.72), (x, 0, 0.36), wood)
    box("backwall", (8, 0.1, 4), (0, 1.4, 2), wallm)
    box("floor", (8, 8, 0.1), (0, 0, -0.05), mat("floor", srgb("#2a2c2b"), 0.5))
    crt = group(viewer, (0.1, 0.1, 0.77), 0.32, 0.0)
    m = mannequin((0.1, -0.85, 0), math.radians(180), seated=True)
    box("chair", (0.45, 0.45, 0.06), (0.1, -0.85, 0.42), mat("chair", srgb("#2c2e2a"), 0.5))
    lamp = light("AREA", (-1.2, -0.6, 2.2), 60, size=1.0, color=(1.0, 0.92, 0.8), aim=(0, 0, 0.8))
    return crt, m


# ---- shots ---------------------------------------------------------------------------------------

def shot_hall(frames, dark=False, steady=False):
    lamps = hall()
    m = mannequin((0.0, 1.0, 0), math.radians(180))
    light("AREA", (0, 3, 5), 300, size=6, color=(0.75, 0.85, 1.0), aim=(0, 3, 0))
    light("SUN", (-3, -4, 6), 0.6, size=10)
    rng = random.Random(1)
    centre = emit_mat("centre_glow", srgb("#e8f0ff"), 0.0)
    if steady:
        box("keeper_core", (0.5, 0.05, 1.2), (-1.2, 3.2 - 0.31, 1.3), centre)

    def update(f):
        t = f / (frames - 1)
        if dark or steady:
            gone = len(lamps) if steady else int(t * (len(lamps) + 1.5))
            for r, row in enumerate(lamps):
                for m_ in row:
                    set_emit(m_, 0.0 if r < gone else (3.0 if rng.random() > 0.3 else 0.4))
            if steady:
                set_emit(centre, 0.3 + 2.5 * t + 0.4 * math.sin(f * 0.7) * (1 - t))
        else:
            for row in lamps:
                for m_ in row:
                    set_emit(m_, 3.0 if rng.random() > 0.35 else 0.3)
        y = -3.0 + 1.2 * t
        cam_at((0.4, y, 1.5), (0, y + 6, 1.3), lens=28)
    return update


def shot_clock(frames):
    panel = mat("panel", srgb("#1b1d1c"), 0.4)
    box("panel", (3.4, 0.2, 1.6), (0, 0.15, 0), panel, bevel=0.04)
    amber = emit_mat("digits", srgb("#ffb347"), 4.0)
    dim = emit_mat("digits_dim", srgb("#5a3a12"), 1.0)

    def text(name, body, z, size, m):
        cu = bpy.data.curves.new(name, "FONT")
        cu.body = body
        cu.size = size
        cu.extrude = 0.02
        cu.align_x = "CENTER"
        cu.align_y = "CENTER"
        o = bpy.data.objects.new(name, cu)
        bpy.context.collection.objects.link(o)
        o.location = (0, 0.03, z)
        o.rotation_euler = (math.pi / 2, 0, 0)
        o.data.materials.append(m)
        return o

    date = text("date", "12-31-99", 0.35, 0.42, dim)
    time_ = text("time", "23:59:58", -0.25, 0.62, amber)
    light("AREA", (0, -3, 2), 40, size=3)

    def update(f):
        if f < frames * 0.3:
            time_.data.body = "23:59:58"
        elif f < frames * 0.6:
            time_.data.body = "23:59:59"
        else:
            date.data.body, time_.data.body = "01-01-00", "00:00:00"
            set_emit(amber, 4.0 if (f // 2) % 3 else 0.6)
        cam_at((0.0, -4.2 + f * 0.01, 0.2), (0, 0, 0.0), lens=50)
    return update


def shot_split(frames):
    glow = emit_mat("reality", srgb("#f4f0e0"), 2.0)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, location=(0, 0, 0), segments=48, ring_count=24)
    big = bpy.context.object
    _finish(big, glow, 0, 0)
    rng = random.Random(5)
    bits = []
    for i in range(46):
        v = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))).normalized()
        r = rng.uniform(0.08, 0.22)
        m_ = emit_mat(f"lesser{i % 6}", srgb(rng.choice(["#f4f0e0", "#d8e8ff", "#ffe8c8"])), 1.5)
        bpy.ops.mesh.primitive_ico_sphere_add(radius=r, subdivisions=2, location=v * 0.5)
        o = bpy.context.object
        _finish(o, m_, 0, 0)
        bits.append((o, v, rng.uniform(1.5, 3.2)))

    def update(f):
        t = f / (frames - 1)
        k = max(0.0, (t - 0.25) / 0.75)
        big.scale = (max(0.001, 1 - k * 1.6),) * 3
        set_emit(glow, 2.0 + 8 * math.exp(-((t - 0.27) * 18) ** 2))
        for o, v, speed in bits:
            o.location = v * (0.5 + k * speed)
            o.hide_render = t < 0.25
        cam_at((0, -7, 1.2), (0, 0, 0), lens=40)
    return update


def shot_island(frames, variant="island", once=False):
    isl = island()
    light("SUN", (-3, -2, 5), 2.5, size=5, color=(1.0, 0.95, 0.85))
    light("AREA", (3, -2, -1), 40, size=4, color=(0.6, 0.7, 1.0))
    sky = None
    if variant == "local":
        sky = ring_of_spokes(1.9, emit_mat("sky", srgb("#2fa357"), 1.2))
        sky.location = (0, 2.2, 1.1)
        sky.rotation_euler.x = math.radians(90)
    rng = random.Random(2)
    point = None
    if variant == "inject":
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.1, location=(0, 0, 0.2))
        point = bpy.context.object
        _finish(point, emit_mat("point", srgb("#ffffff"), 30.0), 0, 0)

    def update(f):
        t = f / (frames - 1)
        if once:  # the opening plays it once: a slow part-turn that eases to rest, then holds
            k = min(1.0, f / (frames * 0.85))
            isl.rotation_euler.z = math.radians(-50 + 100 * (1 - (1 - k) ** 3))
        else:
            isl.rotation_euler.z = f / frames * 2 * math.pi  # a full turn, so the loop is seamless
        isl.location = (0, 0, 0)
        isl.scale = (1, 1, 1)
        if variant == "local":
            sky.rotation_euler.y = -(min(1.0, f / (frames * 0.85)) if once else f / frames) * math.radians(60)
        if variant == "flood":
            j = 0.06 if (f // 2) % 2 else 0.02
            isl.location = (rng.uniform(-j, j), rng.uniform(-j, j), rng.uniform(-j, j))
            isl.scale = (1 + rng.uniform(-0.03, 0.03), 1 + rng.uniform(-0.03, 0.03), 1)
        if variant == "inject":
            k = min(1, max(0, (t - 0.15) / 0.6))
            isl.scale = (max(0.001, 1 - k),) * 3
            s = 0.2 + 2.2 * math.sin(min(1, k) * math.pi) if t < 0.85 else max(0.001, (1 - t) * 6)
            point.scale = (s,) * 3
        cam_at((0, -4.2, 2.0) if variant != "local" else (0, -5.2, 1.0), (0, 0, 0.2 if variant != "local" else 0.7), lens=35)
    return update


def shot_desk(frames, beam=False):
    crt, m = desk_set()
    light("SUN", (-2, -3, 5), 1.2, size=8)
    b = None
    if beam:
        bm = emit_mat("beam", srgb("#5dff85"), 8.0)
        b = cyl("beam", 0.05, 1.0, (0.1, 0.1, 1.2), bm, verts=16)

    def update(f):
        t = f / (frames - 1)
        if beam:
            h = 0.2 + 6 * t
            b.scale = (1, 1, h)
            b.location.z = 1.1 + h / 2
            cam_at((2.6, -2.6, 1.6 + 1.6 * t), (0.1, 0.1, 1.2 + 1.8 * t), lens=30)
        else:
            a = math.radians(-35 + 20 * t)
            cam_at((math.sin(a) * 3.0, -math.cos(a) * 3.0, 1.6), (0.1, 0.0, 0.9), lens=35)
    return update


def shot_uplink(frames):
    desk_set()
    light("SUN", (-2, -3, 5), 1.2, size=8)
    sig = emit_mat("signal", srgb("#5dff85"), 6.0)
    gap, n = 0.7, 5
    rings = []
    for k in range(n):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.25, minor_radius=0.012, major_segments=32, minor_segments=6)
        o = bpy.context.object
        o.data.materials.append(sig)
        rings.append(o)

    def update(f):
        t = f / frames  # each ring climbs one gap per loop, so the loop is seamless
        for k, o in enumerate(rings):
            h = (k + t) * gap
            o.location = (0.1, 0.1, 1.3 + h)
            s = 1.0 + 0.35 * h
            o.scale = (s, s, 1)
        cam_at((3.0, -3.4, 2.6), (0.1, 0.1, 1.9), lens=30)
    return update


def shot_seal(frames):
    piv = medallion()
    light("AREA", (-3.5, -2.5, 3.5), 520, size=1.2, color=(1.0, 0.93, 0.82))
    light("AREA", (3.5, -3.0, -0.5), 90, size=4, color=(0.75, 0.85, 1.0))

    piv.rotation_mode = "ZXY"

    def update(f):
        t = f / frames
        piv.rotation_euler = (math.radians(70), 0, t * 2 * math.pi)
        cam_at((0, -3.6, 0.0), (0, 0, 0), lens=50)
    return update


def shot_globe(frames, breakup=False):
    """The world as a vector globe: graticule and Natural Earth coastlines (public domain), turning."""
    import json
    import os
    data = json.load(open(os.path.join(KIT_DIR, "data", "coast110.geojson")))
    line = emit_mat("globe_line", srgb("#5dff85"), 3.0)
    faint = emit_mat("globe_grid", srgb("#2fa357"), 1.6)
    black = mat("globe_black", (0, 0, 0), 1.0, spec=0.0)
    R = 1.0

    def to3(lon, lat, r=R * 1.002):
        lo, la = math.radians(lon), math.radians(lat)
        return Vector((r * math.cos(la) * math.cos(lo), r * math.cos(la) * math.sin(lo), r * math.sin(la)))

    def polyline(name, pts, m, bevel):
        cu = bpy.data.curves.new(name, "CURVE")
        cu.dimensions = "3D"
        cu.bevel_depth = bevel
        cu.bevel_resolution = 0
        sp = cu.splines.new("POLY")
        sp.points.add(len(pts) - 1)
        for p, v in zip(sp.points, pts):
            p.co = (v.x, v.y, v.z, 1)
        o = bpy.data.objects.new(name, cu)
        bpy.context.collection.objects.link(o)
        o.data.materials.append(m)
        return o

    def build():
        bpy.ops.mesh.primitive_uv_sphere_add(radius=R * 0.995, segments=64, ring_count=32)
        _finish(bpy.context.object, black, 0, 0)
        for lat in range(-75, 90, 15):
            polyline(f"lat{lat}", [to3(lon, lat) for lon in range(0, 361, 5)], faint, 0.0025)
        for lon in range(0, 360, 15):
            polyline(f"lon{lon}", [to3(lon, lat) for lat in range(-90, 91, 5)], faint, 0.0025)
        for i, ft in enumerate(data["features"]):
            c = ft["geometry"]["coordinates"]
            if len(c) > 1:
                polyline(f"coast{i}", [to3(lo, la, R * 1.004) for lo, la in c], line, 0.004)
    globe = group(build)
    globe.rotation_euler.x = math.radians(-23.4)
    bpy.context.scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0, 0, 0, 1)

    def update(f):
        t = f / frames
        globe.rotation_euler.z = t * 2 * math.pi * (1.0 if not breakup else 0.15)
        if breakup:
            on = (f // 2) % 2 == 0 or f < frames * 0.4
            k = max(0.0, (f / frames - 0.4) / 0.6)
            set_emit(line, 3.0 * (1 - k) if on else 0.4)
            set_emit(faint, 1.6 * (1 - k) if on else 0.2)
        cam_at((0, -4.2, 0.35), (0, 0, 0), lens=45)
    return update


def shot_corps(frames):
    stone = mat("stone", srgb("#8d8a80"), 0.8)
    glass = mat("glass_dark", srgb("#1c2224"), 0.2, spec=0.8)
    lit = emit_mat("office_lit", srgb("#fff2c8"), 2.0)
    box("ground", (40, 40, 0.1), (0, 0, -0.05), mat("pave", srgb("#3a3b38"), 0.9))
    box("block", (4.0, 2.4, 6.0), (0, 0, 3.0), stone)
    box("plinth", (4.6, 3.0, 0.6), (0, 0, 0.3), stone)
    rng = random.Random(14)
    for fl in range(8):
        for c in range(8):
            box(f"win{fl}_{c}", (0.32, 0.06, 0.45), (-1.6 + c * 0.46, -1.21, 1.2 + fl * 0.6), lit if rng.random() < 0.3 else glass)
    box("doors", (1.0, 0.06, 0.9), (0, -1.51, 1.05), glass)
    emblem_disc = medallion()
    emblem_disc.location, emblem_disc.scale = (0, -1.25, 5.55), (0.42,) * 3
    emblem_disc.rotation_euler = (math.radians(90), 0, 0)
    for x in (-1.0, 1.0):
        box(f"pillar{x}", (0.2, 0.2, 1.2), (x, -1.6, 0.9), stone)
    light("SUN", (-4, -6, 5), 1.5, size=4)
    light("AREA", (0, -6, 1), 80, size=6, color=(0.7, 0.8, 1.0))

    def update(f):
        t = f / (frames - 1)
        cam_at((-3.5 + 2.0 * t, -9.5, 0.8), (0, 0, 3.6), lens=32)
    return update


def lines_mode():
    """Green line art on black: every surface goes black, Freestyle draws the outlines in phosphor green,
    and anything that glows glows green. Used for the opening cinematic."""
    sc = bpy.context.scene
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0, 0, 0, 1)
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        b = m.node_tree.nodes.get("Principled BSDF")
        if not b:
            continue
        lum = sum(b.inputs["Emission Color"].default_value[:3]) * b.inputs["Emission Strength"].default_value
        if m.name.startswith("globe") or lum > 0.05:
            if not m.name.startswith("globe"):
                b.inputs["Emission Color"].default_value = (*srgb("#5dff85"), 1)
        b.inputs["Base Color"].default_value = (0, 0, 0, 1)
        b.inputs["Specular IOR Level"].default_value = 0.0
    for o in sc.objects:
        if o.type == "LIGHT":
            o.data.energy = 0
    sc.render.use_freestyle = True
    sc.render.line_thickness_mode = "ABSOLUTE"
    sc.render.line_thickness = 1.0
    vl = sc.view_layers[0]
    fs = vl.freestyle_settings
    fs.crease_angle = math.radians(150)
    ls = fs.linesets[0] if fs.linesets else fs.linesets.new("lines")
    ls.select_by_visibility = True
    ls.select_silhouette = ls.select_border = ls.select_crease = True
    ls.linestyle.color = srgb("#5dff85")
    ls.linestyle.thickness = 1.0


SHOTS = {
    "hall": lambda n: shot_hall(n),
    "dark": lambda n: shot_hall(n, dark=True),
    "steady": lambda n: shot_hall(n, steady=True),
    "clock": shot_clock,
    "split": shot_split,
    "island": lambda n: shot_island(n),
    "local": lambda n: shot_island(n, "local"),
    "flood": lambda n: shot_island(n, "flood"),
    "inject": lambda n: shot_island(n, "inject"),
    "desk": lambda n: shot_desk(n),
    "transmit": lambda n: shot_desk(n, beam=True),
    "seal": shot_seal,
    "globe": shot_globe,
    "globe_fail": lambda n: shot_globe(n, breakup=True),
    "corps": shot_corps,
    "uplink": shot_uplink,
    "spin": shot_seal,  # the CanonOS boot screen's medallion: transparent, square, one turn (see build)
}


# frames per shot at 12 fps. LOOPS play round; the rest play once and hold their last frame.
FRAMES_BY = {"hall": 96, "clock": 48, "dark": 72, "split": 60, "island": 144, "local": 144, "flood": 48, "inject": 60,
             "steady": 72, "desk": 96, "transmit": 60, "seal": 96, "globe": 144, "globe_fail": 72, "corps": 96,
             "uplink": 24, "spin": 24}
LOOPS = {"island", "local", "flood", "seal", "globe", "uplink"}
# In the opening (lines=True) these play once and come to rest instead of spinning like a record.
ONCE_IN_LINES = {"island": 96, "local": 96}


def build(name, outdir, frames=None, only=None, lines=False):
    import os
    once = lines and name in ONCE_IN_LINES
    frames = frames or (ONCE_IN_LINES[name] if once else FRAMES_BY[name])
    reset(W)
    eevee()
    if name == "spin":
        sc = bpy.context.scene
        sc.render.resolution_x = sc.render.resolution_y = 192
        sc.render.film_transparent = True
    update = shot_island(frames, name, once=True) if once else SHOTS[name](frames)
    if lines:
        lines_mode()
    os.makedirs(outdir, exist_ok=True)
    for f in (only or range(frames)):
        update(f)
        bpy.context.view_layer.update()
        render(os.path.join(outdir, f"{f:03d}.png"))
    return outdir
