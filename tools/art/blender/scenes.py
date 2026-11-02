"""Landmarks for town home pages, shown in the Reality Viewer dithered to phosphor green. Exec'd after kit.py.

Generic on purpose: one set serves every town and setting, matched to a site by words in its name (see
SITE_IMAGES in js/apps.js). Grey clay, a low sun, perspective; post.py does the dithering.

  records  a small classical civic building: steps, columns, pediment
  chapel   nave and square tower with a spire; the round window has six spokes
  council  a hall with a clock tower; the clock has no hands, only the emblem's six ticks
  forum    a roofed noticeboard on posts, papers pinned, a lamp post
  paper    a two-storey office with a sign band and bundled papers at the door
  harbour  a pier on piles, a small boat with a wheelhouse, bollards
  shop     a shopfront under a striped awning
  works    a sawtooth-roofed works with a chimney and a water tower
  hall     a long hall with a gabled porch and a flagpole
  house    a cottage with a chimney, a fence and a tree
  school   a long single-storey school with two gabled wings, a bell cupola and a swing frame
  station  a halt: platform, a small booking hall under a canopy on posts, the line, a semaphore signal
  farm     a gambrel-roofed barn, a silo, round bales, a fence and ploughed rows
  clinic   a flat-roofed two-storey surgery with an entrance canopy and a projecting sign
  lighthouse  a striped tower on a rock with its lantern lit, and the keeper's cottage
"""
import math

import bpy

CLAY = srgb("#b9b6ac")
WALL = srgb("#d6d2c4")
ROOF = srgb("#6d6a62")
DARK = srgb("#2c2b28")
GROUND = srgb("#5c5a54")
WATER = srgb("#3a3f42")


def M():
    return {
        "wall": mat("wall", WALL, 0.8),
        "clay": mat("clay", CLAY, 0.75),
        "roof": mat("roof", ROOF, 0.7),
        "dark": mat("dark", DARK, 0.4, spec=0.6),
        "ground": mat("ground", GROUND, 0.95),
        "water": mat("water", WATER, 0.08, spec=0.9),
        "white": mat("white", srgb("#f2f0e8"), 0.85),
        "lamp": mat("lamp", srgb("#fff6d8"), 0.5, emit=srgb("#fff6d8"), emit_strength=6.0),
    }


def ground(m, size=30, water=False):
    box("ground", (size, size, 0.1), (0, 0, -0.05), m["water"] if water else m["ground"])


def gable(name, w, d, h, z, m, loc=(0, 0), axis="x", over=0.12):
    """A pitched roof: ridge along x (axis='x') or y."""
    if axis == "x":
        prism_x(name, [(-d / 2 - over, 0), (d / 2 + over, 0), (0, h)], w + over * 2, m)
    else:
        prism_x(name, [(-w / 2 - over, 0), (w / 2 + over, 0), (0, h)], d + over * 2, m)
        bpy.context.object.rotation_euler.z = math.pi / 2
    bpy.context.object.location = (loc[0], loc[1], z)


def windows(prefix, xs, zs, y, w, h, m, face="y"):
    for i, x in enumerate(xs):
        for j, z in enumerate(zs):
            if face == "y":
                box(f"{prefix}{i}_{j}", (w, 0.06, h), (x, y, z), m)
            else:
                box(f"{prefix}{i}_{j}", (0.06, w, h), (y, x, z), m)


def tree(name, x, y, h, m):
    cyl(f"{name}_t", 0.08, h * 0.4, (x, y, h * 0.2), m["roof"], verts=10)
    bpy.ops.mesh.primitive_ico_sphere_add(radius=h * 0.32, location=(x, y, h * 0.62), subdivisions=2)
    o = bpy.context.object
    o.name = name
    o.scale = (1, 1, 1.25)
    _finish(o, m["clay"], 0, 0)


def emblem_face(prefix, c, r, m_face, m_ink, normal_y=True):
    """A round face looking along -y: a disc, a ring, six ticks, the bar. Clock, rose window, whatever."""
    cyl(f"{prefix}_disc", r, 0.05, c, m_face, rot=(math.pi / 2, 0, 0))
    torus(f"{prefix}_ring", r * 0.92, r * 0.06, (c[0], c[1] - 0.03, c[2]), m_ink, rot=(math.pi / 2, 0, 0))
    for i in range(6):
        a = math.pi / 2 + 2 * math.pi * i / 6
        box(f"{prefix}_tick{i}", (r * 0.12, 0.04, r * 0.36), (c[0] + math.cos(a) * r * 0.58, c[1] - 0.04, c[2] + math.sin(a) * r * 0.58),
            m_ink, rot=(0, -(a - math.pi / 2), 0))
    box(f"{prefix}_bar", (r * 0.1, 0.04, r * 0.32), (c[0], c[1] - 0.04, c[2]), m_ink)


def records(m):
    ground(m)
    for i in range(3):
        box(f"step{i}", (4.6 - i * 0.3, 2.9 - i * 0.3, 0.15), (0, -0.2 + i * 0.15 * 0, 0.075 + i * 0.15), m["clay"])
    box("block", (3.6, 2.0, 1.9), (0, 0.3, 0.45 + 0.95), m["wall"])
    box("cornice", (3.9, 2.3, 0.18), (0, 0.3, 2.44), m["clay"])
    prism_x("pediment", [(-1.2, 0), (-1.2 + 0.0, 0), (0, 0)], 0.1, m["clay"]) if False else None
    poly("pediment", [(-1.95, 0), (1.95, 0), (0, 0.75)], 0.3, (0, -0.85, 2.53), m["clay"], rot=(math.pi / 2, 0, 0))
    box("roof", (3.9, 2.0, 0.2), (0, 0.45, 2.6), m["roof"])
    for i, x in enumerate((-1.35, -0.45, 0.45, 1.35)):
        cyl(f"col{i}", 0.13, 1.95, (x, -0.95, 1.4), m["white"], verts=16)
    box("door", (0.6, 0.06, 1.1), (0, -0.69, 1.0), m["dark"])
    windows("win", (-1.2, 1.2), (1.2,), -0.69, 0.4, 0.8, m["dark"])
    tree("tree", -3.2, 0.6, 2.6, m)


def chapel(m):
    ground(m)
    box("nave", (2.2, 3.6, 1.6), (0.5, 0.6, 0.8), m["wall"])
    gable("nroof", 2.2, 3.6, 1.1, 1.6, m["roof"], loc=(0.5, 0.6), axis="y")
    poly("gableend", [(-1.1, 0), (1.1, 0), (0, 1.1)], 0.06, (0.5, -1.30, 1.6), m["wall"], rot=(math.pi / 2, 0, 0))
    emblem_face("rose", (0.5, -1.40, 2.05), 0.36, m["white"], m["dark"])
    box("door", (0.6, 0.06, 1.0), (0.5, -1.17, 0.5), m["dark"])
    box("tower", (1.1, 1.1, 2.8), (-1.25, -0.4, 1.4), m["wall"])
    box("belfry", (0.3, 0.06, 0.6), (-1.25, -0.97, 2.3), m["dark"])
    bpy.ops.mesh.primitive_cone_add(radius1=0.85, radius2=0.0, depth=1.9, vertices=4, location=(-1.25, -0.4, 3.75), rotation=(0, 0, math.pi / 4))
    _finish(bpy.context.object, m["roof"], 0, 0)
    windows("lan", (-0.35, 1.0, 2.0), (0.95,), 0.5, 0.25, 0.7, m["dark"], face="x")
    for i in range(4):
        box(f"stone{i}", (0.25, 0.12, 0.45), (2.4 + (i % 2) * 0.6, -1.4 + i * 0.5, 0.22), m["clay"])


def council(m):
    ground(m)
    box("hall", (4.4, 2.2, 2.0), (0, 0.4, 1.0), m["wall"])
    gable("hroof", 4.4, 2.2, 0.8, 2.0, m["roof"])
    bpy.context.object.location.y = 0.4
    box("tower", (1.0, 1.0, 1.6), (0, -0.2, 2.6), m["wall"])
    emblem_face("clock", (0, -0.72, 2.95), 0.36, m["white"], m["dark"])
    bpy.ops.mesh.primitive_cone_add(radius1=0.78, radius2=0.0, depth=0.9, vertices=4, location=(0, -0.2, 3.85), rotation=(0, 0, math.pi / 4))
    _finish(bpy.context.object, m["roof"], 0, 0)
    box("porch", (1.2, 0.5, 1.2), (0, -0.9, 0.6), m["clay"])
    box("door", (0.55, 0.06, 0.9), (0, -1.16, 0.45), m["dark"])
    windows("win", (-1.6, -0.9, 0.9, 1.6), (0.7, 1.45), -0.71, 0.36, 0.5, m["dark"])
    box("flag_pole", (0.05, 0.05, 2.6), (2.6, -1.3, 1.3), m["dark"])


def forum(m):
    ground(m)
    for x in (-1.3, 1.3):
        box(f"post{x}", (0.14, 0.14, 2.4), (x, 0, 1.2), m["roof"])
    box("board", (2.6, 0.12, 1.4), (0, 0, 1.5), m["clay"])
    box("frame", (2.75, 0.08, 1.55), (0, 0.04, 1.5), m["roof"])
    gable("broof", 3.0, 0.7, 0.35, 2.3, m["roof"])
    import random
    rng = random.Random(4)
    for i in range(9):
        w, h = rng.uniform(0.3, 0.55), rng.uniform(0.3, 0.5)
        box(f"note{i}", (w, 0.03, h), (rng.uniform(-1.0, 1.0), -0.09 - i * 0.012, rng.uniform(1.05, 1.95)), m["white"],
            rot=(0, rng.uniform(-0.12, 0.12), 0))
    box("lamp_post", (0.08, 0.08, 3.0), (2.4, -0.4, 1.5), m["dark"])
    box("lamp_arm", (0.4, 0.06, 0.06), (2.25, -0.4, 2.95), m["dark"])
    box("lamp", (0.2, 0.2, 0.22), (2.08, -0.4, 2.82), m["lamp"])
    box("bench", (1.4, 0.4, 0.08), (-2.4, -0.6, 0.45), m["clay"])
    for x in (-2.95, -1.85):
        box(f"bleg{x}", (0.08, 0.35, 0.45), (x, -0.6, 0.22), m["roof"])


def paper(m):
    ground(m)
    box("office", (3.4, 2.2, 3.2), (0, 0.4, 1.6), m["wall"])
    box("parapet", (3.5, 2.3, 0.2), (0, 0.4, 3.3), m["clay"])
    box("sign", (3.0, 0.1, 0.45), (0, -0.74, 2.15), m["dark"])
    for i in range(7):
        box(f"letter{i}", (0.18, 0.04, 0.24), (-1.1 + i * 0.37, -0.8, 2.15), m["white"])
    box("shopwin", (1.6, 0.06, 1.1), (-0.6, -0.71, 0.95), m["dark"])
    box("door", (0.6, 0.06, 1.3), (1.0, -0.71, 0.65), m["dark"])
    windows("up", (-1.0, 0.0, 1.0), (2.85,), -0.71, 0.5, 0.45, m["dark"])
    for i in range(5):
        box(f"bundle{i}", (0.55, 0.4, 0.22), (-1.4 + (i % 3) * 0.6, -1.25 - (i // 3) * 0.45, 0.11 + (i // 3) * 0.0), m["white"])
        box(f"twine{i}", (0.04, 0.42, 0.24), (-1.4 + (i % 3) * 0.6, -1.25 - (i // 3) * 0.45, 0.11), m["dark"])
    box("bundle_top", (0.55, 0.4, 0.22), (-0.8, -1.25, 0.33), m["white"])


def harbour(m):
    ground(m, water=True)
    box("quay", (12, 4, 0.6), (0, 4.5, 0.3), m["clay"])
    box("pier", (1.4, 5.0, 0.15), (-0.6, 0.2, 0.75), m["clay"])
    for i in range(6):
        for x in (-1.2, 0.0):
            cyl(f"pile{i}{x}", 0.08, 0.9, (x, -2.0 + i * 0.85, 0.3), m["roof"], verts=10)
    for i in range(2):
        cyl(f"bollard{i}", 0.1, 0.25, (-0.05, -1.6 + i * 1.6, 0.95), m["dark"], verts=12)
    # the boat
    hull = prism_x("hull", [(-1.3, 0.25), (1.1, 0.25), (1.45, 0.75), (-1.4, 0.75)], 1.0, m["white"])
    hull.rotation_euler.z = math.pi / 2
    hull.location = (1.3, -0.4, -0.1)
    box("cabin", (0.7, 0.75, 0.6), (1.3, 0.0, 0.95), m["wall"])
    box("cabwin", (0.5, 0.06, 0.2), (1.3, -0.4, 1.05), m["dark"])
    box("cabroof", (0.8, 0.85, 0.06), (1.3, 0.0, 1.28), m["roof"])
    box("mast", (0.05, 0.05, 1.3), (1.3, 0.5, 1.5), m["dark"])
    box("shed", (2.4, 1.8, 1.4), (-3.0, 4.2, 1.3), m["wall"])
    gable("sroof", 2.4, 1.8, 0.6, 2.0, m["roof"], loc=(-3.0, 4.2))


def shop(m):
    ground(m)
    box("shop", (3.6, 2.4, 2.6), (0, 0.4, 1.3), m["wall"])
    gable("sroof", 3.6, 2.4, 1.0, 2.6, m["roof"])
    bpy.context.object.location.y = 0.4
    box("fascia", (3.4, 0.1, 0.4), (0, -0.83, 2.05), m["dark"])
    for i in range(8):
        box(f"stripe{i}", (0.42, 0.9, 0.05), (-1.47 + i * 0.42, -1.2, 1.62), m["white"] if i % 2 else m["roof"],
            rot=(math.radians(-24), 0, 0))
    box("window", (2.0, 0.06, 1.05), (-0.5, -0.81, 0.85), m["dark"])
    box("door", (0.6, 0.06, 1.3), (1.15, -0.81, 0.65), m["dark"])
    for i in range(3):
        box(f"crate{i}", (0.45, 0.45, 0.4), (-1.6 + i * 0.5, -1.35, 0.2), m["clay"])
    box("sackrow", (0.5, 0.35, 0.55), (1.8, -1.3, 0.28), m["white"])


def works(m):
    ground(m)
    box("shed", (4.4, 2.6, 1.6), (0, 0.4, 0.8), m["wall"])
    for i in range(4):
        prism_x(f"saw{i}", [(-0.65, 0), (0.65, 0), (0.65, 0.7)], 1.1, m["roof"])
        o = bpy.context.object
        o.rotation_euler.z = math.pi / 2
        o.location = (-1.65 + i * 1.1, 0.4, 1.6)
    windows("win", (-1.6, -0.5, 0.6, 1.7), (0.9,), -0.91, 0.6, 0.6, m["dark"])
    cyl("chimney", 0.22, 4.6, (1.8, 1.4, 2.3), m["clay"], verts=16)
    box("cap", (0.55, 0.55, 0.12), (1.8, 1.4, 4.6), m["roof"])
    # water tower
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        box(f"leg{i}", (0.07, 0.07, 2.6), (-3.2 + math.cos(a) * 0.5, 0.8 + math.sin(a) * 0.5, 1.3), m["dark"])
    cyl("tank", 0.65, 0.9, (-3.2, 0.8, 3.0), m["clay"], verts=24)
    bpy.ops.mesh.primitive_cone_add(radius1=0.72, radius2=0.0, depth=0.4, vertices=24, location=(-3.2, 0.8, 3.65))
    _finish(bpy.context.object, m["roof"], 0, 0)


def hall(m):
    ground(m)
    box("hall", (4.8, 2.2, 1.5), (0.3, 0.5, 0.75), m["wall"])
    gable("hroof", 4.8, 2.2, 0.9, 1.5, m["roof"])
    bpy.context.object.location = (0.3, 0.5, 1.5)
    box("porch", (1.3, 0.9, 1.35), (0.3, -0.95, 0.68), m["wall"])
    gable("proof", 1.3, 0.9, 0.55, 1.35, m["roof"], loc=(0.3, -0.95), axis="y")
    box("door", (0.6, 0.06, 1.0), (0.3, -1.41, 0.5), m["dark"])
    windows("win", (-1.5, -0.8, 1.4, 2.1), (0.85,), -0.61, 0.38, 0.6, m["dark"])
    box("flag_pole", (0.05, 0.05, 3.2), (-2.6, -1.0, 1.6), m["dark"])
    box("flag", (0.7, 0.03, 0.45), (-2.24, -1.0, 2.95), m["clay"])
    for i in range(5):
        box(f"fence{i}", (0.05, 0.05, 0.6), (-1.5 + i * 0.9, -2.0, 0.3), m["roof"])
    box("rail", (3.7, 0.04, 0.05), (0.3, -2.0, 0.5), m["roof"])


def house(m):
    ground(m)
    box("cottage", (3.0, 2.0, 1.5), (0, 0.4, 0.75), m["wall"])
    gable("roof", 3.0, 2.0, 1.1, 1.5, m["roof"])
    bpy.context.object.location.y = 0.4
    box("chimney", (0.35, 0.35, 1.2), (1.0, 0.7, 2.4), m["clay"])
    box("door", (0.55, 0.06, 1.0), (-0.2, -0.61, 0.5), m["dark"])
    windows("win", (-1.0, 0.7), (0.85,), -0.61, 0.5, 0.5, m["dark"])
    box("wlight", (0.4, 0.04, 0.4), (0.7, -0.64, 0.85), m["lamp"])
    for i in range(9):
        box(f"picket{i}", (0.08, 0.05, 0.55), (-2.0 + i * 0.5, -1.7, 0.27), m["white"])
    box("rail", (4.2, 0.04, 0.06), (0.0, -1.7, 0.42), m["white"])
    tree("tree", 2.5, -0.2, 2.8, m)


def school(m):
    ground(m)
    box("main", (5.0, 1.9, 1.7), (0, 0.5, 0.85), m["wall"])
    gable("mroof", 5.0, 1.9, 0.8, 1.7, m["roof"], loc=(0, 0.5))
    for x in (-2.1, 2.1):
        box(f"wing{x}", (1.3, 0.9, 1.7), (x, -0.85, 0.85), m["wall"])
        gable(f"wroof{x}", 1.3, 0.9, 0.7, 1.7, m["roof"], loc=(x, -0.85), axis="y")
        box(f"wdoor{x}", (0.5, 0.06, 0.9), (x, -1.31, 0.45), m["dark"])
        box(f"wwin{x}", (0.3, 0.06, 0.3), (x, -1.31, 1.35), m["dark"])
    windows("win", (-1.05, -0.35, 0.35, 1.05), (0.95,), -0.46, 0.34, 0.95, m["dark"])
    box("cupola", (0.4, 0.4, 0.45), (0, 0.5, 2.6), m["white"])
    box("bell", (0.18, 0.06, 0.22), (0, 0.29, 2.6), m["dark"])
    bpy.ops.mesh.primitive_cone_add(radius1=0.36, radius2=0.0, depth=0.4, vertices=4, location=(0, 0.5, 3.02), rotation=(0, 0, math.pi / 4))
    _finish(bpy.context.object, m["roof"], 0, 0)
    # swing frame
    for x in (3.3, 4.7):
        for dy in (-0.35, 0.35):
            box(f"sleg{x}{dy}", (0.06, 0.06, 1.7), (x, -1.4 + dy * 0.5, 0.8), m["dark"], rot=(math.radians(-12 if dy < 0 else 12), 0, 0))
    box("sbar", (1.5, 0.07, 0.07), (4.0, -1.4, 1.62), m["dark"])
    for x in (3.7, 4.3):
        for dx in (-0.12, 0.12):
            box(f"rope{x}{dx}", (0.02, 0.02, 1.1), (x + dx, -1.4, 1.05), m["dark"])
        box(f"seat{x}", (0.34, 0.14, 0.04), (x, -1.4, 0.5), m["clay"])
    for i in range(9):
        box(f"rail{i}", (0.05, 0.05, 0.5), (-3.2 + i * 0.8, -2.3, 0.25), m["roof"])
    box("railbar", (6.5, 0.04, 0.05), (0, -2.3, 0.42), m["roof"])
    tree("tree", -3.6, 0.4, 2.6, m)


def station(m):
    ground(m)
    box("platform", (8.0, 1.8, 0.5), (0, 0.1, 0.25), m["clay"])
    box("ballast", (12.0, 1.3, 0.06), (0, -1.5, 0.03), m["clay"])
    for i in range(20):
        box(f"sleeper{i}", (0.16, 1.2, 0.05), (-5.7 + i * 0.6, -1.5, 0.08), m["roof"])
    for y in (-1.15, -1.85):
        box(f"railr{y}", (12.0, 0.06, 0.09), (0, y, 0.15), m["dark"])
    box("booking", (3.2, 1.3, 1.6), (0.4, 0.55, 1.3), m["wall"])
    gable("broof", 3.2, 1.3, 0.6, 2.1, m["roof"], loc=(0.4, 0.55))
    box("bdoor", (0.5, 0.06, 1.0), (0.4, -0.11, 1.0), m["dark"])
    windows("bwin", (-0.6, 1.4), (1.25,), -0.11, 0.5, 0.55, m["dark"])
    box("canopy", (5.2, 1.3, 0.08), (0.4, -0.45, 2.05), m["roof"], rot=(math.radians(-6), 0, 0))
    box("valance", (5.2, 0.04, 0.18), (0.4, -1.1, 1.92), m["white"])
    for x in (-1.6, -0.3, 1.1, 2.4):
        cyl(f"post{x}", 0.05, 1.5, (x, -0.95, 1.25), m["dark"], verts=10)
    cyl("clockrod", 0.02, 0.2, (0.4, -0.75, 1.9), m["dark"], verts=8)
    emblem_face("clock", (0.4, -0.75, 1.68), 0.17, m["white"], m["dark"])
    box("bench", (1.1, 0.35, 0.06), (-1.0, -0.2, 0.92), m["clay"])
    for x in (-1.45, -0.55):
        box(f"bleg{x}", (0.05, 0.3, 0.4), (x, -0.2, 0.7), m["dark"])
    # semaphore signal at the end of the platform
    cyl("sigpost", 0.06, 3.6, (4.6, -0.6, 1.8), m["dark"], verts=10)
    box("sigarm", (0.75, 0.05, 0.14), (4.95, -0.66, 3.25), m["white"], rot=(0, math.radians(-30), 0))
    cyl("siglamp", 0.07, 0.06, (4.6, -0.68, 3.05), m["lamp"], rot=(math.pi / 2, 0, 0), verts=12)
    tree("tree", -4.6, 1.5, 2.6, m)


def farm(m):
    ground(m)
    box("barn", (3.4, 2.4, 1.6), (-0.8, 0.9, 0.8), m["wall"])
    prism_x("broof", [(-1.35, 0), (1.35, 0), (1.05, 0.8), (0, 1.25), (-1.05, 0.8)], 3.6, m["roof"])
    bpy.context.object.location = (-0.8, 0.9, 1.6)
    box("bdoor", (1.2, 0.06, 1.3), (-0.8, -0.31, 0.65), m["dark"])
    for r in (1, -1):
        box(f"brace{r}", (0.08, 0.04, 1.7), (-0.8, -0.35, 0.65), m["white"], rot=(0, r * math.atan2(1.2, 1.3), 0))
    box("loft", (0.5, 0.06, 0.45), (-0.8, -0.31, 1.75), m["dark"])
    cyl("silo", 0.6, 3.4, (1.6, 1.7, 1.7), m["clay"], verts=32)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.6, location=(1.6, 1.7, 3.4), segments=32, ring_count=16)
    _finish(bpy.context.object, m["roof"], 0, 0)
    for i, (x, y) in enumerate(((1.3, -0.6), (2.0, -0.9), (1.65, -0.75))):
        cyl(f"bale{i}", 0.32, 0.5, (x, y, 0.32 + (0.5 if i == 2 else 0)), m["clay"], rot=(0, math.pi / 2, 0), verts=24)
    for i in range(10):
        box(f"fpost{i}", (0.07, 0.07, 0.65), (-3.4 + i * 0.75, -1.8, 0.32), m["roof"])
    for z in (0.3, 0.55):
        box(f"frail{z}", (6.8, 0.04, 0.05), (-0.0, -1.8, z), m["roof"])
    for i in range(7):
        box(f"row{i}", (5.0, 0.18, 0.1), (5.6, -1.0 + i * 0.55, 0.05), m["clay"])
    tree("tree", -3.4, 1.8, 2.8, m)


def clinic(m):
    ground(m)
    box("block", (4.6, 2.2, 2.4), (0, 0.5, 1.2), m["wall"])
    box("roofslab", (4.8, 2.4, 0.16), (0, 0.5, 2.48), m["clay"])
    windows("win", (-1.65, -0.95, 0.95, 1.65), (0.95, 1.85), -0.61, 0.5, 0.45, m["dark"])
    windows("win2", (0.0,), (1.85,), -0.61, 0.9, 0.45, m["dark"])
    box("door", (1.0, 0.06, 1.1), (0, -0.61, 0.55), m["dark"])
    box("canopy", (1.9, 1.2, 0.1), (0, -1.15, 1.35), m["roof"])
    for x in (-0.85, 0.85):
        cyl(f"cpost{x}", 0.05, 1.3, (x, -1.65, 0.65), m["white"], verts=10)
    box("lamp", (0.3, 0.06, 0.12), (0, -0.64, 1.25), m["lamp"])
    for i in range(2):
        box(f"step{i}", (1.6, 0.3, 0.1), (0, -0.8 - i * 0.3, 0.1 - i * 0.05), m["clay"])
    box("signarm", (0.06, 0.5, 0.05), (-2.3, -0.82, 2.05), m["dark"])
    box("sign", (0.08, 0.55, 0.55), (-2.3, -0.95, 1.7), m["white"])
    for r in ((0, 0, 0), (math.pi / 2, 0, 0)):
        box(f"plus{r[0]}", (0.1, 0.36, 0.1), (-2.36, -0.95, 1.7), m["dark"], rot=r)
    box("bench", (1.0, 0.35, 0.06), (-1.6, -1.3, 0.42), m["clay"])
    for x in (-2.0, -1.2):
        box(f"bleg{x}", (0.05, 0.3, 0.4), (x, -1.3, 0.2), m["dark"])
    tree("tree", 3.1, -1.1, 2.4, m)


def lighthouse(m):
    ground(m, water=True)
    cyl("isle", 2.8, 0.5, (0, 0.4, 0.15), m["ground"], verts=40)
    for i, (x, y, r) in enumerate(((-2.4, -0.6, 0.6), (2.5, -0.2, 0.5), (-0.6, -2.3, 0.45), (1.6, -1.9, 0.4))):
        bpy.ops.mesh.primitive_ico_sphere_add(radius=r, subdivisions=1, location=(x, y, 0.25))
        o = bpy.context.object
        o.scale = (1.2, 1, 0.6)
        _finish(o, m["roof"], 0, 0)
    z, h = 0.4, 0.75
    for i in range(5):
        r1, r2 = 0.62 - i * 0.05, 0.57 - i * 0.05
        bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=h, vertices=32, location=(-0.3, 0.6, z + h / 2))
        _finish(bpy.context.object, m["white"] if i % 2 == 0 else m["dark"], 0, 0)
        z += h
    cyl("gallery", 0.55, 0.1, (-0.3, 0.6, z + 0.05), m["dark"], verts=32)
    torus("railing", 0.53, 0.015, (-0.3, 0.6, z + 0.35), m["dark"])
    cyl("lantern", 0.3, 0.5, (-0.3, 0.6, z + 0.35), m["lamp"], verts=24)
    bpy.ops.mesh.primitive_cone_add(radius1=0.38, radius2=0.0, depth=0.4, vertices=24, location=(-0.3, 0.6, z + 0.8))
    _finish(bpy.context.object, m["roof"], 0, 0)
    box("cottage", (1.6, 1.0, 0.9), (1.4, 0.7, 0.85), m["wall"])
    gable("croof", 1.6, 1.0, 0.55, 1.3, m["roof"], loc=(1.4, 0.7))
    box("cdoor", (0.35, 0.06, 0.6), (1.1, 0.19, 0.7), m["dark"])
    box("cwin", (0.35, 0.06, 0.3), (1.8, 0.19, 0.85), m["dark"])


SCENES = {"records": records, "chapel": chapel, "council": council, "forum": forum, "paper": paper, "harbour": harbour,
          "shop": shop, "works": works, "hall": hall, "house": house, "school": school, "station": station, "farm": farm,
          "clinic": clinic, "lighthouse": lighthouse}


def build(name, out, w=320, h=176):
    reset(w)
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.cycles.samples = 32
    m = M()
    SCENES[name](m)
    light("SUN", (-6, -8, 5), 4.2, size=3, color=(1.0, 0.96, 0.88))
    sc.world.node_tree.nodes["Background"].inputs[1].default_value = 0.55
    skip = ("ground", "quay", "ballast", "railr", "row", "isle")
    cam = camera((-0.55, -1.0, 0.32), margin=1.15, ortho=False, lens=35, skip=skip)
    fit(cam, skip)
    return render(out)


def fit(cam, skip, lo=0.36, hi=0.45):
    """camera() frames by bounding box as if orthographic, so tall things near the lens get cropped. Dolly in
    or out until everything sits inside the frame with a margin."""
    from bpy_extras.object_utils import world_to_camera_view
    from mathutils import Vector
    sc = bpy.context.scene
    dg = bpy.context.evaluated_depsgraph_get()
    pts = [o.matrix_world @ Vector(c) for o in sc.objects
           if o.type == "MESH" and not o.name.startswith(skip) for c in o.evaluated_get(dg).bound_box]
    centre = sum(pts, Vector()) / len(pts)
    for _ in range(40):
        bpy.context.view_layer.update()
        v = [world_to_camera_view(sc, cam, p) for p in pts]
        cx = (max(p.x for p in v) + min(p.x for p in v)) / 2
        cy = (max(p.y for p in v) + min(p.y for p in v)) / 2
        ext = max(max(abs(p.x - cx) for p in v), max(abs(p.y - cy) for p in v))
        # recentre sideways, then dolly
        right, up = cam.matrix_world.to_3x3() @ Vector((1, 0, 0)), cam.matrix_world.to_3x3() @ Vector((0, 1, 0))
        dist = (cam.location - centre).length
        cam.location += (right * (cx - 0.5) + up * (cy - 0.5)) * dist * 0.6
        if ext > hi:
            cam.location = centre + (cam.location - centre) * 1.05
        elif ext < lo:
            cam.location = centre + (cam.location - centre) * 0.96
        elif abs(cx - 0.5) < 0.01 and abs(cy - 0.5) < 0.01:
            break
