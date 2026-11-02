"""Paper, rendered flat under a raking light so its folds and holes read. Exec'd after kit.py.

  sheet     a letter sheet folded in three for an envelope, then flattened, with a staple in the corner.
            Saved documents (the Document window) are printed on it.
  fanfold   one repeat of continuous printer paper: tractor-feed holes down both edges, perforations, pale
            green bars. Form 77-R comes off the printer on it. It tiles vertically.

  blender -b --python tools/art/blender/headless.py -- paper sheet fanfold
post.py writes them to game/assets/paper/.
"""
import math

import bpy
from mathutils import Vector


def paper_mat(name, rgb, bars=None):
    """Off-white with a fine fibre bump; bars=(period, colour) adds horizontal bands (green-bar paper)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.9
    tc = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 260
    noise.inputs["Detail"].default_value = 8
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    if bars:
        period, col = bars
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["Object"], sep.inputs["Vector"])
        scale = nt.nodes.new("ShaderNodeMath")  # sin(2 pi y / period) > 0: whole bars per repeat, so it tiles
        scale.operation = "MULTIPLY"
        scale.inputs[1].default_value = 2 * math.pi / period
        nt.links.new(sep.outputs["Y"], scale.inputs[0])
        wave = nt.nodes.new("ShaderNodeMath")
        wave.operation = "SINE"
        nt.links.new(scale.outputs[0], wave.inputs[0])
        step = nt.nodes.new("ShaderNodeMath")
        step.operation = "GREATER_THAN"
        step.inputs[1].default_value = 0.0
        nt.links.new(wave.outputs[0], step.inputs[0])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        pick = lambda sock, n: next(i for i in sock if i.name == n and i.type == "RGBA")
        pick(mix.inputs, "A").default_value = (*rgb, 1)
        pick(mix.inputs, "B").default_value = (*col, 1)
        nt.links.new(step.outputs[0], mix.inputs["Factor"])
        nt.links.new(pick(mix.outputs, "Result"), b.inputs["Base Color"])
    else:
        b.inputs["Base Color"].default_value = (*rgb, 1)
    return m


def holdout_mat():
    m = bpy.data.materials.new("hole")
    m.use_nodes = True
    nt = m.node_tree
    out = nt.nodes["Material Output"]
    h = nt.nodes.new("ShaderNodeHoldout")
    nt.links.new(h.outputs[0], out.inputs["Surface"])
    return m


def grid(name, w, h, nx, ny, z_of, m):
    """A w x h sheet in the xy plane, centred, with height z_of(x, y)."""
    vs, fs = [], []
    for j in range(ny + 1):
        for i in range(nx + 1):
            x, y = -w / 2 + w * i / nx, -h / 2 + h * j / ny
            vs.append((x, y, z_of(x, y)))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            fs.append((a, a + 1, a + nx + 2, a + nx + 1))
    me = bpy.data.meshes.new(name)
    me.from_pydata(vs, [], fs)
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def top_camera(w, h):
    cd = bpy.data.cameras.new("cam")
    cd.type = "ORTHO"
    cd.ortho_scale = max(w, h)
    cam = bpy.data.objects.new("cam", cd)
    bpy.context.collection.objects.link(cam)
    cam.location = (0, 0, 5)
    bpy.context.scene.camera = cam
    return cam


def sheet():
    W, H = 2.16, 2.79  # US letter in decimetres; any letter-ish shape will do
    folds = (-H / 6, H / 6)

    def z(x, y):
        v = 0.0
        for k, y0 in enumerate(folds):  # one valley, one ridge, as a letter folded in three
            d = (y - y0) / 0.035
            v += (0.012 if k else -0.010) * math.exp(-d * d) + (0.006 if k else -0.004) * math.exp(-abs(y - y0) / 0.25)
        return v + 0.03 * (x / W) ** 2 + 0.015 * math.sin(y * 1.3)

    grid("sheet", W, H, 90, 120, z, paper_mat("paper", srgb("#f2eee2")))
    steel = mat("steel", srgb("#9fa3a6"), 0.25, metal=1.0)
    for dx in (-0.07, 0.07):
        box(f"stleg{dx}", (0.03, 0.012, 0.012), (-W / 2 + 0.18 + dx * 0.7, H / 2 - 0.18 + dx * 0.7, 0.04), steel, rot=(0, 0, math.pi / 4))
    box("staple", (0.2, 0.014, 0.012), (-W / 2 + 0.18, H / 2 - 0.18, 0.045), steel, rot=(0, 0, math.pi / 4), bevel=0.004)
    light("SUN", (-2.0, 1.2, 1.0), 2.2, size=4, color=(1.0, 0.96, 0.9))
    light("AREA", (2, -2, 4), 40, size=6, color=(0.9, 0.93, 1.0), aim=(0, 0, 0))
    top_camera(W, H)
    return W, H


def fanfold():
    W, H = 2.6, 1.2  # one repeat: 12 tractor holes, four bars
    pitch = H / 12
    grid("sheet", W, H, 2, 2, lambda x, y: 0.0, paper_mat("paper", srgb("#f3f1e8"), bars=(H / 2, srgb("#d6e8cf"))))
    margin = mat("margin", srgb("#f3f1e8"), 0.9)
    hole = holdout_mat()
    for s in (-1, 1):
        box(f"strip{s}", (0.26, H, 0.002), (s * (W / 2 - 0.13), 0, 0.001), margin)
        for k in range(12):
            cyl(f"hole{s}{k}", 0.042, 0.02, (s * (W / 2 - 0.12), -H / 2 + pitch * (k + 0.5), 0.005), hole, verts=24)
        for k in range(48):
            box(f"perf{s}{k}", (0.006, 0.012, 0.004), (s * (W / 2 - 0.27), -H / 2 + H * (k + 0.5) / 48, 0.003), mat("perf", srgb("#cfcbbd"), 0.9))
    light("SUN", (-1.5, 0.0, 1.0), 2.0, size=3, color=(1.0, 0.97, 0.92))  # even down the page, so it tiles
    top_camera(W, H)
    return W, H


def build(name, out, px=760):
    reset(px)
    w, h = {"sheet": sheet, "fanfold": fanfold}[name]()
    sc = bpy.context.scene
    sc.render.resolution_x = px
    sc.render.resolution_y = round(px * h / w)
    sc.cycles.samples = 64
    sc.world.node_tree.nodes["Background"].inputs[1].default_value = 0.25
    return render(out)
