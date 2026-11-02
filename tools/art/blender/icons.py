"""The five CanonOS desktop icons as late-90s pre-rendered objects. Exec'd after kit.py; call build(name, out).

  mail      a manila office envelope, flap sealed with a red wax disc
  viewer    a beige CRT monitor, screen glowing phosphor green
  files     a grey-green steel filing cabinet, top drawer open on manila folders
  scanner   a beige flatbed scanner, lid propped, the lamp bar lit green
  hq        a black bakelite desk telephone with a brass dial centre (the direct line to HQ)
  notepad   a yellow ruled legal pad with a pencil across it
  intranet  a navy ring binder on its end, the emblem on the spine label (the Corps' own pages)

The esoteric tilt stays in the details nobody looks at: the wax seal and the dial centre carry the Corps
emblem's six spokes, and the phone's dial has seven holes, not ten.
"""
import math

BEIGE = srgb("#cfc6aa")
BEIGE_D = srgb("#a89f84")
MANILA = srgb("#d9b977")
STEEL = srgb("#7d8a7c")
BRASS = srgb("#c9a14a")
PHOS = srgb("#5dff85")
WAX = srgb("#9c2a22")
BAKE = srgb("#1d1f1c")
SCREEN = srgb("#0a2a14")


def emblem_spokes(prefix, centre, r, depth, m, z_axis="y", n=6, w=None):
    """Six short raised spokes around a centre, the Corps emblem's points, on a face looking along -y or +z."""
    w = w or r * 0.16
    cx, cy, cz = centre
    for i in range(n):
        a = math.pi / 2 + 2 * math.pi * i / n
        x, y = math.cos(a) * r * 0.62, math.sin(a) * r * 0.62
        if z_axis == "y":
            box(f"{prefix}{i}", (w, depth, r * 0.42), (cx + x, cy, cz + y), m, rot=(0, -(a - math.pi / 2), 0))
        else:
            box(f"{prefix}{i}", (w, r * 0.42, depth), (cx + x, cy + y, cz), m, rot=(0, 0, a - math.pi / 2))


def viewer():
    beige = mat("beige", BEIGE, 0.45)
    dark = mat("beige_d", BEIGE_D, 0.55)
    glass = mat("screen", SCREEN, 0.15, emit=PHOS, emit_strength=0.0, spec=0.9)
    glow = mat("glow", PHOS, 0.4, emit=PHOS, emit_strength=1.8)
    box("body", (1.6, 1.2, 1.3), (0, 0, 1.05), beige, bevel=0.09)
    box("back", (1.15, 0.9, 0.95), (0, 0.85, 1.0), dark, bevel=0.12)
    box("bezel", (1.3, 0.06, 1.0), (0, -0.6, 1.12), dark, bevel=0.04)
    box("glass", (1.12, 0.06, 0.84), (0, -0.62, 1.12), glass, bevel=0.06, segs=4)
    for i, (w, z) in enumerate([(0.7, 1.36), (0.85, 1.24), (0.55, 1.12), (0.78, 1.0), (0.4, 0.88)]):
        box(f"line{i}", (w, 0.02, 0.05), (-0.42 + w / 2, -0.66, z), glow)
    box("chin", (1.6, 0.25, 0.2), (0, -0.48, 0.32), beige, bevel=0.05)
    box("led", (0.06, 0.03, 0.04), (0.62, -0.62, 0.32), glow)
    box("foot", (1.0, 1.0, 0.18), (0, 0.15, 0.13), dark, bevel=0.06)


def mail():
    paper = mat("manila", MANILA, 0.75)
    edge = mat("manila_d", srgb("#b8975a"), 0.8)
    wax = mat("wax", WAX, 0.3, spec=0.7)
    box("envelope", (1.9, 0.05, 1.25), (0, 0, 0.62), paper, bevel=0.015)
    poly("flap", [(-0.95, 1.25), (0.95, 1.25), (0, 0.45)], 0.03, (0, -0.03, 0), edge, rot=(math.pi / 2, 0, 0))
    cyl("seal", 0.22, 0.06, (0, -0.07, 0.52), wax, rot=(math.pi / 2, 0, 0), bevel=0.02)
    emblem_spokes("spoke", (0, -0.1, 0.52), 0.2, 0.02, wax)
    for i, z in enumerate((0.22, 0.14)):
        box(f"addr{i}", (0.7 - i * 0.2, 0.01, 0.03), (0.45, -0.03, z), mat("ink", srgb("#5a4a32"), 0.9))


def files():
    steel = mat("steel", STEEL, 0.35, metal=0.3)
    inner = mat("steel_d", srgb("#4d574c"), 0.6, metal=0.2)
    brass = mat("brass", BRASS, 0.25, metal=1.0)
    paper = mat("manila", MANILA, 0.75)
    card = mat("card", srgb("#efe9d6"), 0.8)
    box("cab", (1.1, 1.3, 2.2), (0, 0, 1.1), steel, bevel=0.04)
    box("drawer_low", (1.0, 0.04, 0.95), (0, -0.66, 0.6), steel, bevel=0.03)
    box("handle_low", (0.4, 0.08, 0.07), (0, -0.72, 0.85), brass, bevel=0.02)
    box("label_low", (0.24, 0.03, 0.13), (0, -0.69, 1.0), card)
    # the open top drawer
    box("drawer", (1.0, 0.04, 0.95), (0, -1.36, 1.62), steel, bevel=0.03)
    box("dside_l", (0.04, 0.72, 0.6), (-0.46, -1.0, 1.55), inner)
    box("dside_r", (0.04, 0.72, 0.6), (0.46, -1.0, 1.55), inner)
    box("dfloor", (0.9, 0.72, 0.04), (0, -1.0, 1.27), inner)
    box("handle", (0.4, 0.08, 0.07), (0, -1.42, 1.86), brass, bevel=0.02)
    box("label", (0.24, 0.03, 0.13), (0, -1.39, 2.0), card)
    for i in range(6):
        y = -1.25 + i * 0.1
        box(f"folder{i}", (0.84, 0.02, 0.62), (0, y, 1.62), paper)
        box(f"tab{i}", (0.22, 0.02, 0.1), (-0.28 + (i % 3) * 0.28, y, 1.97), paper)


def scanner():
    beige = mat("beige", BEIGE, 0.45)
    dark = mat("beige_d", BEIGE_D, 0.55)
    glass = mat("glass", srgb("#1c2a24"), 0.1, spec=1.0)
    glow = mat("glow", PHOS, 0.4, emit=PHOS, emit_strength=4.0)
    box("base", (2.2, 1.5, 0.35), (0, 0, 0.18), beige, bevel=0.05)
    box("bed", (1.85, 1.15, 0.02), (0, 0.04, 0.36), glass)
    box("lamp", (0.08, 1.12, 0.03), (-0.35, 0.04, 0.37), glow)
    box("button", (0.25, 0.08, 0.06), (0.75, -0.73, 0.22), dark, bevel=0.02)
    lid = box("lid", (2.2, 1.5, 0.12), (0, 0.75, 0.4), dark, bevel=0.04)
    for v in lid.data.vertices:
        v.co.y -= 0.0
    lid.data.update()
    # hinge the lid at the back edge, propped open
    import bpy
    bpy.context.scene.cursor.location = (0, 0.75, 0.4)
    lid.select_set(True)
    bpy.context.view_layer.objects.active = lid
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    lid.location = (0, 0.75, 0.4)
    lid.data.transform(__import__("mathutils").Matrix.Translation((0, -0.75, 0)))
    lid.rotation_euler = (math.radians(-28), 0, 0)
    box("lidpad", (2.0, 1.3, 0.02), (0, 0.04, -0.07), mat("pad", srgb("#e8e4d8"), 0.9)).parent = lid
    lid.children[0].location = (0, -0.75, -0.07)


def hq():
    import bpy
    from mathutils import Vector
    bake = mat("bakelite", BAKE, 0.38, spec=0.6)
    brass = mat("brass", BRASS, 0.25, metal=1.0)
    card = mat("card", srgb("#efe9d6"), 0.8)
    # body: side profile with a sloped front, extruded across
    prism_x("body", [(-0.8, 0), (0.7, 0), (0.55, 0.8), (-0.4, 0.8)], 1.7, bake, bevel=0.07)
    # cradle prongs
    for x in (-0.55, 0.55):
        box(f"prong{x}", (0.18, 0.28, 0.32), (x, 0.15, 0.92), bake, bevel=0.06)
    # handset: a bar with a cup at each end, mouths down
    box("handle", (1.55, 0.24, 0.16), (0, 0.15, 1.2), bake, bevel=0.07, segs=4)
    for x in (-0.72, 0.72):
        bpy.ops.mesh.primitive_cone_add(radius1=0.27, radius2=0.16, depth=0.26, vertices=48, location=(x, 0.15, 1.0))
        o = bpy.context.object
        o.name = f"cup{x}"
        _finish(o, bake, 0.04, 3)
    # dial on the sloped front
    d = Vector((0, 0.4, 0.8)).normalized()          # up the slope
    nrm = Vector((0, -0.8, 0.4)).normalized()       # out of the slope
    th = math.atan2(-nrm.y, nrm.z)
    c = Vector((0, -0.6, 0.4)) + nrm * 0.01
    rot = (th, 0, 0)
    cyl("dialplate", 0.34, 0.03, c, card, rot=rot)
    cyl("dial", 0.34, 0.04, c + nrm * 0.03, mat("dial", srgb("#2c2e2a"), 0.3, metal=0.5), rot=rot, verts=64, bevel=0.01)
    cyl("hub", 0.12, 0.06, c + nrm * 0.06, brass, rot=rot, bevel=0.02)
    emblem_x = Vector((1, 0, 0))
    for i in range(7):
        a = math.radians(-40 - i * 36)
        p = c + nrm * 0.06 + emblem_x * math.cos(a) * 0.24 + d * math.sin(a) * 0.24
        cyl(f"hole{i}", 0.05, 0.03, p, card, rot=rot, verts=20)
    cyl("cord", 0.04, 0.5, (0.86, 0.45, 0.35), bake, rot=(0, math.pi / 2, 0.3))


def orientation():
    """A VHS cassette: black shell, two reels behind a smoked window, a white label with a Training stripe."""
    shell = mat("vhs", srgb("#232421"), 0.35, spec=0.6)
    window = mat("vhs_win", srgb("#141615"), 0.05, spec=1.0)
    reel = mat("reel", srgb("#e8e4d8"), 0.5)
    tape = mat("tape", srgb("#3a2618"), 0.4)
    label = mat("label", srgb("#efe9d6"), 0.8)
    stripe = mat("stripe", srgb("#2e3a47"), 0.6)
    box("cass", (1.88, 1.03, 0.25), (0, 0, 0.125), shell, bevel=0.025)
    box("cass_win", (1.1, 0.45, 0.02), (0, 0.12, 0.25), window)
    for x in (-0.32, 0.32):
        cyl(f"reel{x}", 0.2, 0.02, (x, 0.12, 0.262), reel, verts=32)
        cyl(f"hub{x}", 0.07, 0.03, (x, 0.12, 0.27), shell, verts=16)
    cyl("tapewind", 0.17, 0.022, (-0.32, 0.12, 0.264), tape, verts=32)
    box("cass_label", (1.4, 0.3, 0.02), (0, -0.3, 0.255), label)
    box("cass_stripe", (1.4, 0.07, 0.022), (0, -0.22, 0.257), stripe)


def notepad():
    """A yellow ruled legal pad with a red top binding and a yellow pencil lying across it."""
    pad = mat("pad", srgb("#efe08a"), 0.85)
    rule = mat("rule", srgb("#7fa0c8"), 0.8)
    margin = mat("margin", srgb("#c85a50"), 0.8)
    bind = mat("bind", srgb("#8e2a22"), 0.55)
    wood = mat("pencil", srgb("#e6b52e"), 0.5)
    tip = mat("tipwood", srgb("#e2c79a"), 0.7)
    lead = mat("lead", srgb("#2a2826"), 0.4)
    box("pad", (1.2, 1.7, 0.12), (0, 0, 0.06), pad, bevel=0.01)
    box("binding", (1.22, 0.2, 0.15), (0, 0.78, 0.075), bind, bevel=0.02)
    for k in range(10):
        box(f"rule{k}", (1.08, 0.012, 0.004), (0, 0.5 - k * 0.13, 0.121), rule)
    box("marginline", (0.012, 1.5, 0.004), (-0.38, -0.08, 0.122), margin)
    pen = cyl("pencil", 0.045, 1.3, (0.1, -0.15, 0.2), wood, rot=(0, math.pi / 2, math.radians(30)), verts=6)
    import bpy
    bpy.ops.mesh.primitive_cone_add(radius1=0.045, radius2=0.0, depth=0.16, vertices=6,
                                    location=(0.1 + 0.73 * math.cos(math.radians(30)), -0.15 + 0.73 * math.sin(math.radians(30)), 0.2),
                                    rotation=(0, math.pi / 2, math.radians(30)))
    _finish(bpy.context.object, tip, 0, 0)
    cyl("eraser", 0.046, 0.12, (0.1 - 0.7 * math.cos(math.radians(30)), -0.15 - 0.7 * math.sin(math.radians(30)), 0.2), margin,
        rot=(0, math.pi / 2, math.radians(30)), verts=16)


def intranet():
    """A navy ring binder standing on its end, a white spine label with the emblem: the Corps' own pages."""
    cover = mat("binder", srgb("#2e3a5c"), 0.5)
    pages = mat("pages", srgb("#ece8dc"), 0.85)
    label = mat("label", srgb("#efe9d6"), 0.8)
    ink = mat("ink", srgb("#2e3a5c"), 0.5)
    ring = mat("ring", srgb("#b9bdc0"), 0.25, metal=1.0)
    box("back", (0.08, 1.2, 1.6), (-0.42, 0, 0.8), cover, bevel=0.02)
    box("front", (0.08, 1.2, 1.6), (0.42, 0, 0.8), cover, bevel=0.02)
    box("spine", (0.92, 0.08, 1.6), (0, -0.6, 0.8), cover, bevel=0.03)
    box("sheets", (0.74, 1.12, 1.52), (0, 0.03, 0.78), pages)
    box("spinelabel", (0.6, 0.02, 0.5), (0, -0.645, 1.05), label)
    emblem_spokes("sp", (0, -0.66, 1.05), 0.2, 0.015, ink)
    box("spinebar", (0.04, 0.015, 0.09), (0, -0.66, 1.05), ink)
    cyl("fingerhole", 0.09, 0.03, (0, -0.645, 0.45), mat("hole", srgb("#151a28"), 0.6), rot=(math.pi / 2, 0, 0), verts=24)
    for z in (0.5, 1.1):
        bpy_torus = torus(f"ring{z}", 0.14, 0.02, (-0.3, 0.0, z), ring, rot=(0, math.pi / 2, 0))


BUILDERS = {"viewer": viewer, "mail": mail, "files": files, "scanner": scanner, "hq": hq, "orientation": orientation,
            "notepad": notepad, "intranet": intranet}
VIEWS = {"viewer": (-0.6, -1.0, 0.5), "mail": (-0.35, -1.0, 0.35), "files": (-0.7, -1.0, 0.45),
         "scanner": (-0.55, -1.0, 0.75), "hq": (-0.5, -1.0, 0.6), "orientation": (-0.35, -0.8, 1.0),
         "notepad": (-0.3, -0.7, 1.0), "intranet": (-0.75, -1.0, 0.4)}


def build(name, out, size=192):
    reset(size)
    BUILDERS[name]()
    icon_lights()
    camera(VIEWS[name])
    return render(out)
