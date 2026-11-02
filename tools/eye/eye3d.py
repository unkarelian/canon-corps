"""The loss's eye, made real: a 3D render of the Demiurge's eye for the 2D sprite to turn into.

The game's eye is the gold one: white-gold line art on black, a faint gilt glow where the forms turn
away, an iris of drawn rings and spokes. Uncanny-divine rather than anatomical. What makes it read as
3D, which the flat sprite never could: rings and meridians on the globe that wrap as it turns, dim depth
contours on the lids, a perspective camera with nearer lines drawn heavier, and part of every look done
by the whole eye turning (HEAD_SHARE), so the lids shift too. The realistic eye
the gold one is built on (`--real`) is kept for reference.

Built to the sprite's own layout, in sprite pixels: the frame is 64x32, the lid opening is the
same almond (half-width 28, upper lid 11, lower 9), the iris sits where the sprite's does. So the
render, crushed back down to 64x32, is nearly the sprite, and the morph can start from it.
Colours the game never uses: wet pink, red veins, a hazel iris. Its cornea reflects the CanonOS
desktop (out3d/desktop.png, a frame of the game): it is looking at your screen from the other side.

  blender -b -P tools/eye/eye3d.py -- test [samples] [gilt]  -> out3d/test_*.png (two poses; gilt given = gold)
  blender -b -P tools/eye/eye3d.py -- grid [--real]           -> out3d/grid/Y_P.png (every gaze pose)
Yaw is degrees to the viewer's right, pitch degrees down. morph3d.py turns these into game assets.
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy

HERE = Path(__file__).resolve().parent
OUT = HERE / "out3d"
W, H = 640, 320           # render size; the frame is 64x32 sprite pixels, so 10 px per sprite pixel
R = 22.0                  # eyeball radius
IRIS_R = 8.4              # iris radius on the globe (the sprite's iris_ring is 8)
PUPIL_R = 3.0
HALF_W, UP, LOW = 23.0, 11.0, 9.0   # the sprite's lid almond, its corners pulled in to the globe
FACE_Y = 6.5              # how far the face sits behind the front of the eye
CAM_D = 72.0              # perspective, close enough that depth shows
HEAD_SHARE = 0.3          # of each look, how much is the whole eye turning (lids and all), not just the globe
HEAD_Y = 30.0             # the head turns about a point this far behind the front of the eye
YAWS = list(range(-36, 37, 6))
PITCHES = [-15, -7.5, 0, 7.5, 15]


# ---- scene -----------------------------------------------------------------------------------
def scene():
    bpy.ops.wm.read_homefile(use_empty=True, use_factory_startup=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 64
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 10
    sc.cycles.transmission_bounces = 10
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    w = bpy.data.worlds.new("dark")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0, 0, 0, 1)
    sc.world = w
    cam = bpy.data.cameras.new("cam")
    cam.sensor_fit = "HORIZONTAL"
    cam.lens = cam.sensor_width * CAM_D / 64.0  # 64 units wide at the front of the eye, as the sprite is
    co = bpy.data.objects.new("cam", cam)
    co.location = (0, -CAM_D, 0)
    co.rotation_euler = (math.radians(90), 0, 0)  # looking +Y, up +Z, right +X
    sc.collection.objects.link(co)
    sc.camera = co
    return sc


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def nodes(m):
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    return nt, out


def N(nt, kind, **inputs):
    n = nt.nodes.new(kind)
    for k, v in inputs.items():
        if k.startswith("_"):
            setattr(n, k[1:], v)
        else:
            n.inputs[k].default_value = v
    return n


def math_(nt, op, a, b=None, clamp=False):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    n.use_clamp = clamp
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def mrange(nt, v, a, b, c=0.0, d=1.0, smooth=True):
    n = nt.nodes.new("ShaderNodeMapRange")
    n.interpolation_type = "SMOOTHSTEP" if smooth else "LINEAR"
    nt.links.new(v, n.inputs["Value"])
    n.inputs["From Min"].default_value, n.inputs["From Max"].default_value = a, b
    n.inputs["To Min"].default_value, n.inputs["To Max"].default_value = c, d
    return n.outputs[0]


def mix(nt, fac, a, b):
    n = nt.nodes.new("ShaderNodeMix")
    n.data_type = "RGBA"
    for sock, v in ((n.inputs[0], fac), (n.inputs[6], a), (n.inputs[7], b)):
        if isinstance(v, (int, float)):
            sock.default_value = v
        elif isinstance(v, tuple):
            sock.default_value = v
        else:
            nt.links.new(v, sock)
    return n.outputs[2]


# ---- the eyeball -----------------------------------------------------------------------------
def eyeball_material():
    m = bpy.data.materials.new("eyeball")
    nt, out = nodes(m)
    tc = N(nt, "ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    x, y, z = sep.outputs
    r = math_(nt, "SQRT", math_(nt, "ADD", math_(nt, "MULTIPLY", x, x), math_(nt, "MULTIPLY", z, z)))
    front = math_(nt, "LESS_THAN", y, 0.0)  # the iris is on the front (-Y) half only
    ang = math_(nt, "ARCTAN2", z, x)

    # Iris: radial fibres (noise stretched along the radius), darker limbal ring, a paler collarette.
    fib_co = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(math_(nt, "MULTIPLY", ang, 9.0), fib_co.inputs[0])
    nt.links.new(math_(nt, "MULTIPLY", r, 0.35), fib_co.inputs[1])
    fib = N(nt, "ShaderNodeTexNoise", Scale=5.0, Detail=10.0, Roughness=0.62)
    nt.links.new(fib_co.outputs[0], fib.inputs["Vector"])
    fine = N(nt, "ShaderNodeTexNoise", Scale=22.0, Detail=6.0)
    nt.links.new(fib_co.outputs[0], fine.inputs["Vector"])
    streak = math_(nt, "MULTIPLY", fib.outputs[0], mrange(nt, fine.outputs[0], 0.3, 0.7, 0.75, 1.15))
    iris_col = N(nt, "ShaderNodeValToRGB")
    cr = iris_col.color_ramp
    cr.elements[0].position, cr.elements[0].color = 0.25, (0.035, 0.03, 0.018, 1)
    cr.elements[1].position, cr.elements[1].color = 0.75, (0.42, 0.33, 0.13, 1)
    e = cr.elements.new(0.5)
    e.color = (0.16, 0.15, 0.06, 1)
    nt.links.new(streak, iris_col.inputs[0])
    collar = math_(nt, "MULTIPLY", mrange(nt, r, 3.2, 4.4), mrange(nt, r, 5.6, 4.6))
    iris_rgb = mix(nt, math_(nt, "MULTIPLY", collar, 0.55), iris_col.outputs[0], (0.55, 0.42, 0.16, 1))
    limbal = mrange(nt, r, IRIS_R - 1.6, IRIS_R)
    iris_rgb = mix(nt, math_(nt, "MULTIPLY", limbal, 0.85), iris_rgb, (0.02, 0.025, 0.02, 1))
    pupil = mrange(nt, r, PUPIL_R + 0.25, PUPIL_R - 0.15)
    iris_rgb = mix(nt, pupil, iris_rgb, (0.0, 0.0, 0.0, 1))

    # Sclera: yellowed white, veins (noise isolines) thickening away from the iris, pinker at the edges.
    vn = N(nt, "ShaderNodeTexNoise", Scale=0.11, Detail=7.0, Roughness=0.55, Distortion=0.6)
    nt.links.new(tc.outputs["Object"], vn.inputs["Vector"])
    edge0 = mrange(nt, r, IRIS_R + 1.0, R * 0.95)
    width = math_(nt, "ADD", 0.002, math_(nt, "MULTIPLY", edge0, 0.016))  # hairline near the iris, thick at the corners
    vein = math_(nt, "SUBTRACT", 1.0, math_(nt, "DIVIDE", math_(nt, "ABSOLUTE", math_(nt, "SUBTRACT", vn.outputs[0], 0.5)), width), clamp=True)
    vn2 = N(nt, "ShaderNodeTexNoise", Scale=0.27, Detail=5.0, Distortion=1.2)
    nt.links.new(tc.outputs["Object"], vn2.inputs["Vector"])
    vein2 = math_(nt, "SUBTRACT", 1.0, math_(nt, "DIVIDE", math_(nt, "ABSOLUTE", math_(nt, "SUBTRACT", vn2.outputs[0], 0.5)), math_(nt, "MULTIPLY", width, 0.6)), clamp=True)
    edge = mrange(nt, r, IRIS_R + 1.0, R * 0.95)  # 0 at the iris, 1 at the sides of the globe
    veins = math_(nt, "MULTIPLY", math_(nt, "MAXIMUM", vein, math_(nt, "MULTIPLY", vein2, 0.5)),
                  math_(nt, "POWER", edge, 0.7), clamp=True)
    sclera = mix(nt, math_(nt, "MULTIPLY", math_(nt, "POWER", edge, 1.6), 0.6), (0.80, 0.74, 0.62, 1), (0.70, 0.36, 0.32, 1))
    sclera = mix(nt, math_(nt, "MULTIPLY", veins, 0.55), sclera, (0.45, 0.05, 0.04, 1))

    is_iris = math_(nt, "MULTIPLY", front, mrange(nt, r, IRIS_R + 0.15, IRIS_R - 0.15))
    col = mix(nt, is_iris, sclera, iris_rgb)

    bsdf = N(nt, "ShaderNodeBsdfPrincipled", Roughness=0.32)
    bsdf.inputs["Subsurface Weight"].default_value = 0.25
    bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.35, 0.25)
    bsdf.inputs["Subsurface Scale"].default_value = 0.6
    bsdf.inputs["Coat Weight"].default_value = 1.0
    bsdf.inputs["Coat Roughness"].default_value = 0.04
    nt.links.new(col, bsdf.inputs["Base Color"])
    # The iris is a matte, fibrous thing under the cornea: no subsurface glow, no coat of its own.
    nt.links.new(math_(nt, "MULTIPLY", math_(nt, "SUBTRACT", 1.0, is_iris), 0.25), bsdf.inputs["Subsurface Weight"])
    nt.links.new(math_(nt, "SUBTRACT", 1.0, is_iris), bsdf.inputs["Coat Weight"])
    bump = N(nt, "ShaderNodeBump", Strength=0.25, Distance=0.3)
    nt.links.new(math_(nt, "MULTIPLY", streak, is_iris), bump.inputs["Height"])
    nt.links.new(bump.outputs[0], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    return m


def cornea_material():
    m = bpy.data.materials.new("cornea")
    nt, out = nodes(m)
    g = N(nt, "ShaderNodeBsdfPrincipled", Roughness=0.0, IOR=1.376)
    g.inputs["Base Color"].default_value = (1, 1, 1, 1)
    g.inputs["Transmission Weight"].default_value = 1.0
    nt.links.new(g.outputs[0], out.inputs[0])
    return m


def eye():
    """The globe and its cornea, under one pivot at the centre of the globe."""
    pivot = link(bpy.data.objects.new("pivot", None))
    pivot.location = (0, R, 0)  # the front of the globe is at y = 0
    me = bpy.data.meshes.new("globe")
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=128, v_segments=64, radius=R)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    globe = link(bpy.data.objects.new("globe", me))
    globe.parent = pivot
    globe.data.materials.append(eyeball_material())
    # Cornea: a sphere that meets the globe on the iris circle and bulges 1.6 past it.
    ci = -math.sqrt(R * R - IRIS_R * IRIS_R)  # the iris circle's depth, globe-local
    apex = -R - 1.6
    rc = (IRIS_R ** 2 + (ci - apex) ** 2) / (2 * (ci - apex))
    me = bpy.data.meshes.new("cornea")
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=96, v_segments=48, radius=rc)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    cornea = link(bpy.data.objects.new("cornea", me))
    cornea.parent = pivot
    cornea.location = (0, apex + rc, 0)
    cornea.data.materials.append(cornea_material())
    return pivot


# ---- the lids and the face around them --------------------------------------------------------
def opening(x):
    f = max(0.0, 1 - (x / HALF_W) ** 2)
    return -LOW * f, UP * f


def skin_y(x, z):
    """Depth of the skin: hugging the globe close to it, easing back to the face plane further out."""
    rl = R + 1.1
    d2 = x * x + z * z
    over = R - math.sqrt(max(rl * rl - d2, 0.0)) if d2 < rl * rl else R
    k = 12.0  # smooth minimum of the shell and the face plane: a soft lid, not a ball under the skin
    a, b = over, FACE_Y
    h = max(k - abs(a - b), 0.0) / k
    return min(a, b) - h * h * k * 0.25


def skin_material():
    m = bpy.data.materials.new("skin")
    nt, out = nodes(m)
    tc = N(nt, "ShaderNodeTexCoord")
    pores = N(nt, "ShaderNodeTexNoise", Scale=1.6, Detail=12.0, Roughness=0.7)
    nt.links.new(tc.outputs["Object"], pores.inputs["Vector"])
    blot = N(nt, "ShaderNodeTexNoise", Scale=0.08, Detail=3.0)
    nt.links.new(tc.outputs["Object"], blot.inputs["Vector"])
    col = mix(nt, mrange(nt, blot.outputs[0], 0.35, 0.65), (0.50, 0.33, 0.26, 1), (0.40, 0.24, 0.20, 1))
    # The lid margins and the corners: redder, wetter.
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    near = mrange(nt, sep.outputs[1], -0.2, -1.1)  # the lid margin, right against the eye
    col = mix(nt, math_(nt, "MULTIPLY", near, 0.6), col, (0.55, 0.14, 0.13, 1))
    bsdf = N(nt, "ShaderNodeBsdfPrincipled", Roughness=0.45)
    bsdf.inputs["Subsurface Weight"].default_value = 0.6
    bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.3, 0.18)
    bsdf.inputs["Subsurface Scale"].default_value = 0.9
    bsdf.inputs["Coat Roughness"].default_value = 0.15
    nt.links.new(col, bsdf.inputs["Base Color"])
    nt.links.new(math_(nt, "ADD", 0.05, math_(nt, "MULTIPLY", near, 0.9), clamp=True), bsdf.inputs["Coat Weight"])
    nt.links.new(mrange(nt, near, 0, 1, 0.5, 0.25), bsdf.inputs["Roughness"])
    bump = N(nt, "ShaderNodeBump", Strength=0.18, Distance=0.2)
    nt.links.new(pores.outputs[0], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    return m


def skin():
    step, xs, zs = 0.5, 42.0, 26.0
    nx, nz = int(2 * xs / step), int(2 * zs / step)
    bm = bmesh.new()
    grid = [[bm.verts.new((-xs + i * step, 0, -zs + j * step)) for j in range(nz + 1)] for i in range(nx + 1)]
    for i in range(nx):
        for j in range(nz):
            cx, cz = -xs + (i + 0.5) * step, -zs + (j + 0.5) * step
            lo, hi = opening(cx)
            if abs(cx) < HALF_W and lo < cz < hi:
                continue  # the opening
            bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    for v in list(bm.verts):
        if not v.link_faces:
            bm.verts.remove(v)
    # Pull the cut edge onto the almond exactly, so the opening is smooth rather than stepped.
    for v in bm.verts:
        if not v.is_boundary or abs(v.co.x) > xs - 0.1 or abs(v.co.z) > zs - 0.1:
            continue
        lo, hi = opening(v.co.x)
        v.co.z = hi if v.co.z > (lo + hi) / 2 else lo
    for v in bm.verts:
        v.co.y = skin_y(v.co.x, v.co.z)
    me = bpy.data.meshes.new("skin")
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = link(bpy.data.objects.new("skin", me))
    sol = ob.modifiers.new("thickness", "SOLIDIFY")
    sol.thickness = 1.4
    sol.offset = 1.0  # grow away from the camera: the lid margin shows as a rounded rim
    sub = ob.modifiers.new("soft", "SUBSURF")
    sub.levels = sub.render_levels = 2
    ob.data.materials.append(skin_material())

    # Behind the corners, where the opening is wider than the globe: wet pink flesh.
    pocket = bpy.data.meshes.new("pocket")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=40)
    bm.to_mesh(pocket)
    bm.free()
    po = link(bpy.data.objects.new("pocket", pocket))
    po.location = (0, R * 0.55, 0)
    po.rotation_euler = (math.radians(90), 0, 0)
    pm = bpy.data.materials.new("pocket")
    nt, out = nodes(pm)
    b = N(nt, "ShaderNodeBsdfPrincipled", Roughness=0.55)
    b.inputs["Base Color"].default_value = (0.12, 0.015, 0.015, 1)
    nt.links.new(b.outputs[0], out.inputs[0])
    po.data.materials.append(pm)


# ---- light -----------------------------------------------------------------------------------
def lights():
    sc = bpy.context.scene
    key = bpy.data.lights.new("key", "SPOT")
    key.energy, key.color = 260000, (1.0, 0.94, 0.88)
    key.spot_size, key.spot_blend, key.shadow_soft_size = math.radians(15), 1.0, 6.0
    ko = link(bpy.data.objects.new("key", key))
    ko.location = (-30, -110, 50)
    d = (0 - ko.location.x, 4 - ko.location.y, 0 - ko.location.z)
    ko.rotation_euler = (__import__("mathutils").Vector(d)).to_track_quat("-Z", "Y").to_euler()
    # The screen the player is looking at, in front of the eye: invisible to the camera, but the
    # cornea and every wet surface reflect it. It also lights the face a little, coldly.
    img = bpy.data.images.load(str(OUT / "desktop.png"))
    sm = bpy.data.materials.new("screen")
    nt, out = nodes(sm)
    tex = N(nt, "ShaderNodeTexImage")
    tex.image = img
    em = N(nt, "ShaderNodeEmission", Strength=3.5)
    nt.links.new(tex.outputs[0], em.inputs[0])
    # Seen only in reflections: it must not flood the face with light.
    lp = N(nt, "ShaderNodeLightPath")
    tr = N(nt, "ShaderNodeBsdfTransparent")
    mx = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Glossy Ray"], mx.inputs[0])
    nt.links.new(tr.outputs[0], mx.inputs[1])
    nt.links.new(em.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs[0])
    me = bpy.data.meshes.new("screen")
    s = 1.0
    me.from_pydata([(-64 * s, 0, -36 * s), (64 * s, 0, -36 * s), (64 * s, 0, 36 * s), (-64 * s, 0, 36 * s)], [], [(0, 1, 2, 3)])
    me.uv_layers.new()
    for li, uv in zip(me.loops, ((1, 0), (0, 0), (0, 1), (1, 1))):  # mirrored: it faces the eye
        me.uv_layers[0].data[li.index].uv = uv
    so = link(bpy.data.objects.new("screen", me))
    so.location = (6, -130, 10)
    so.data.materials.append(sm)
    so.visible_camera = False
    # A dim rim from below-right so the far side of the globe does not dissolve into the dark.
    rim = bpy.data.lights.new("rim", "AREA")
    rim.energy, rim.size, rim.color = 350, 20, (1.0, 0.8, 0.75)
    ro = link(bpy.data.objects.new("rim", rim))
    ro.location = (40, -30, -30)
    ro.rotation_euler = (math.radians(120), 0, math.radians(50))


# ---- the gold eye: line art, white-gold on black ------------------------------------------------
LINE = (1.0, 0.93, 0.74)   # white-gold, the core of every line
GILT_LEVEL = 1.0           # the game's eye: lines plus a faint gold glow on the forms (user's pick)
GILT = (0.95, 0.62, 0.22)  # deeper gold, for the glow on surfaces


def band(nt, v, centre, width):
    """1 on a thin band around centre, 0 elsewhere: a drawn line."""
    return mrange(nt, math_(nt, "ABSOLUTE", math_(nt, "SUBTRACT", v, centre)), width, width * 0.35)


def gold_eyeball(gilt):
    m = bpy.data.materials.new("eyeball_gold")
    nt, out = nodes(m)
    tc = N(nt, "ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    x, y, z = sep.outputs
    r = math_(nt, "SQRT", math_(nt, "ADD", math_(nt, "MULTIPLY", x, x), math_(nt, "MULTIPLY", z, z)))
    front = math_(nt, "LESS_THAN", y, 0.0)
    ang = math_(nt, "ARCTAN2", z, x)
    lines = band(nt, r, IRIS_R, 0.22)                         # the limbus
    lines = math_(nt, "MAXIMUM", lines, band(nt, r, PUPIL_R, 0.16))   # the pupil's rim
    wav = math_(nt, "ADD", 4.9, math_(nt, "MULTIPLY", math_(nt, "SINE", math_(nt, "MULTIPLY", ang, 13.0)), 0.35))
    lines = math_(nt, "MAXIMUM", lines, math_(nt, "MULTIPLY", band(nt, r, wav, 0.12), 0.8))  # the collarette
    # Radial fibres: thin spokes between pupil and limbus, each a little uneven in brightness.
    spokes = math_(nt, "FRACT", math_(nt, "MULTIPLY", ang, 72 / (2 * math.pi)))
    spoke = band(nt, spokes, 0.5, 0.07)
    jitter = N(nt, "ShaderNodeTexNoise", Scale=1.2, Detail=2.0)
    jco = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(math_(nt, "ROUND", math_(nt, "MULTIPLY", ang, 72 / (2 * math.pi))), jco.inputs[0])
    nt.links.new(jco.outputs[0], jitter.inputs["Vector"])
    inside = math_(nt, "MULTIPLY", mrange(nt, r, PUPIL_R + 0.3, PUPIL_R + 0.8), mrange(nt, r, IRIS_R - 0.3, IRIS_R - 0.8))
    lines = math_(nt, "MAXIMUM", lines, math_(nt, "MULTIPLY", math_(nt, "MULTIPLY", spoke, inside), mrange(nt, jitter.outputs[0], 0.35, 0.65, 0.25, 0.75)))
    lines = math_(nt, "MULTIPLY", lines, front)
    # Lines on the globe itself, beyond the iris: rings around the line of sight and meridians running
    # out from it. They are what shows it is a ball -- as it turns they wrap and crowd at the far side.
    cos_t = math_(nt, "DIVIDE", math_(nt, "MULTIPLY", y, -1.0), R)
    theta = math_(nt, "ARCCOSINE", math_(nt, "MINIMUM", math_(nt, "MAXIMUM", cos_t, -1.0), 1.0))
    iris_t = math.asin(IRIS_R / R)
    rings = band(nt, math_(nt, "FRACT", math_(nt, "DIVIDE", math_(nt, "SUBTRACT", theta, iris_t), math.radians(13))), 0.5, 0.045)
    merid = band(nt, math_(nt, "FRACT", math_(nt, "MULTIPLY", ang, 28 / (2 * math.pi))), 0.5, 0.05)
    sclera = mrange(nt, theta, iris_t + 0.03, iris_t + 0.09)
    globe_lines = math_(nt, "MULTIPLY", math_(nt, "MAXIMUM", rings, math_(nt, "MULTIPLY", merid, 0.8)), sclera)
    lines = math_(nt, "MAXIMUM", lines, math_(nt, "MULTIPLY", globe_lines, 0.16))
    em = N(nt, "ShaderNodeEmission", Color=(*LINE, 1), Strength=4.0)
    nt.links.new(lines, em.inputs["Strength"])
    shade = surface_glow(nt, gilt, 0.55)
    add = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(em.outputs[0], add.inputs[0])
    nt.links.new(shade, add.inputs[1])
    nt.links.new(add.outputs[0], out.inputs[0])
    return m


def surface_glow(nt, gilt, k):
    """Black; with gilt, a faint gold light on the edges of forms (facing-ratio), like gilding catching light."""
    black = N(nt, "ShaderNodeBsdfDiffuse", Color=(0, 0, 0, 1))
    if not gilt:
        return black.outputs[0]
    lw = N(nt, "ShaderNodeLayerWeight", Blend=0.35)
    em = N(nt, "ShaderNodeEmission", Color=(*GILT, 1))
    nt.links.new(math_(nt, "MULTIPLY", math_(nt, "POWER", lw.outputs["Facing"], 2.2), 0.55 * k * gilt), em.inputs["Strength"])
    add = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(black.outputs[0], add.inputs[0])
    nt.links.new(em.outputs[0], add.inputs[1])
    return add.outputs[0]


def gold_skin(gilt):
    """Black, gilt-edged, with dim contour lines of depth: they follow the lids round the globe."""
    m = bpy.data.materials.new("skin_gold")
    nt, out = nodes(m)
    tc = N(nt, "ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    depth = sep.outputs[1]
    contour = band(nt, math_(nt, "FRACT", math_(nt, "DIVIDE", depth, 2.2)), 0.5, 0.05)
    contour = math_(nt, "MULTIPLY", contour, mrange(nt, depth, FACE_Y - 0.6, FACE_Y - 1.6))  # not on the flat face
    em = N(nt, "ShaderNodeEmission", Color=(*LINE, 1))
    nt.links.new(math_(nt, "MULTIPLY", contour, 0.35), em.inputs["Strength"])
    add = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(surface_glow(nt, gilt, 0.6), add.inputs[0])
    nt.links.new(em.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], out.inputs[0])
    return m


def gold_mode(gilt=0.0):
    """Turn the built eye into line art. gilt 0: lines only. gilt 1: a faint gold glow on the forms too."""
    sc = bpy.context.scene
    for name in ("pocket", "cornea", "screen", "key", "rim"):
        o = bpy.data.objects.get(name)
        if o:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.objects["globe"].data.materials[0] = gold_eyeball(gilt)
    bpy.data.objects["skin"].data.materials[0] = gold_skin(gilt)
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.use_freestyle = True
    sc.render.line_thickness_mode = "ABSOLUTE"
    sc.render.line_thickness = 2.2
    fs = sc.view_layers[0].freestyle_settings
    fs.crease_angle = math.radians(120)
    ls = fs.linesets[0] if fs.linesets else fs.linesets.new("lines")
    ls.select_by_visibility = True
    ls.select_silhouette = ls.select_border = True
    ls.select_crease = False
    if ls.linestyle is None:
        ls.linestyle = bpy.data.linestyles.new("gold")
    ls.linestyle.color = LINE
    ls.linestyle.thickness = 2.2
    # Nearer lines heavier, further ones finer: the lid's front edge reads in front of its corners.
    tm = ls.linestyle.thickness_modifiers.new("depth", "DISTANCE_FROM_CAMERA")
    tm.blend, tm.influence = "MIX", 1.0
    tm.range_min, tm.range_max = CAM_D - 2, CAM_D + 14
    tm.value_min, tm.value_max = 2.4, 0.8


def build():
    sc = scene()
    pivot = eye()
    skin()
    lights()
    head = link(bpy.data.objects.new("head", None))
    head.location = (0, HEAD_Y, 0)
    bpy.context.view_layer.update()
    for name in ("pivot", "skin", "pocket"):
        o = bpy.data.objects[name]
        o.parent = head
        o.matrix_parent_inverse = head.matrix_world.inverted()
    return sc, pivot


def pose(pivot, yaw, pitch):
    """Look yaw degrees right and pitch down: part of it the head turning, the rest the eye in it."""
    h, e = HEAD_SHARE, 1 - HEAD_SHARE
    bpy.data.objects["head"].rotation_euler = (math.radians(pitch * h), 0, math.radians(yaw * h))
    pivot.rotation_euler = (math.radians(pitch * e), 0, math.radians(yaw * e))


def render(sc, path):
    sc.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print("rendered", path, flush=True)


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["test"]
    real = "--real" in args  # the realistic eye (wet, veined, hazel), kept for reference; gold is the game's
    args = [a for a in args if a != "--real"]
    sc, pivot = build()
    if args[0] == "test":  # test [samples] [gilt]: gilt given -> the gold line-art eye
        sc.cycles.samples = int(args[1]) if len(args) > 1 else 48
        tag = ""
        if len(args) > 2:
            gold_mode(float(args[2]))
            tag = f"gold{args[2]}_"
        for yaw, pitch in ((0, 0), (30, 12)):
            pose(pivot, yaw, pitch)
            render(sc, OUT / f"test_{tag}{yaw}_{pitch}.png")
    elif args[0] == "turn":  # a quick look at the gold eye turning: out3d/turn/NN.png
        gold_mode(GILT_LEVEL)
        sc.cycles.samples = 12
        d = OUT / "turn"
        d.mkdir(parents=True, exist_ok=True)
        for i in range(7):
            pose(pivot, 6 * i, 2.5 * i)
            render(sc, d / f"{i:02d}.png")
    elif args[0] == "grid":
        if not real:
            gold_mode(GILT_LEVEL)
            sc.cycles.samples = 32  # emission and lines: little to converge
        d = OUT / ("grid_real" if real else "grid")
        d.mkdir(parents=True, exist_ok=True)
        todo = [(y, p) for p in PITCHES for y in YAWS]
        if len(args) > 1:  # a shard: grid i/n
            i, n = map(int, args[1].split("/"))
            todo = todo[i::n]
        for yaw, pitch in todo:
            f = d / f"{yaw}_{pitch:g}.png"
            if f.exists():
                continue
            pose(pivot, yaw, pitch)
            render(sc, f)
