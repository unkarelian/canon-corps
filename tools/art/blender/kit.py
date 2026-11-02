"""Shared Blender helpers for Canon Corps' pre-rendered assets: a clean scene, materials, primitives, framing, render.

Exec'd into the Blender session (through the Blender MCP's execute_blender_code, or `blender -b -P`) before an
asset script. Everything here is plain bpy; nothing depends on the add-on.
"""
import math

import bpy
from mathutils import Vector


def reset(size=192, scene="CC render"):
    """Build in a scene of our own, so whatever file is open in Blender is left alone."""
    old = bpy.data.scenes.get(scene)
    if old:
        for o in list(old.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.scenes.remove(old)
    for coll in (bpy.data.meshes, bpy.data.lights, bpy.data.cameras):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)
    if not bpy.context.window:  # headless: no window to switch, so start from an empty file instead
        bpy.ops.wm.read_homefile(use_empty=True, use_factory_startup=True)
        sc = bpy.context.scene
    else:
        sc = bpy.data.scenes.new(scene)
        bpy.context.window.scene = sc
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = size
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    w = bpy.data.worlds.new("world")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.56, 0.52, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.35
    sc.world = w
    return sc


def mat(name, rgb, rough=0.5, metal=0.0, emit=None, emit_strength=0.0, spec=0.5):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Specular IOR Level"].default_value = spec
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = emit_strength
    return m


def srgb(h):
    """'#c8bd9e' -> linear rgb, so palette colours can be given the way they look."""
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def _finish(o, m, bevel, segs):
    if m:
        o.data.materials.append(m)
    if bevel:
        b = o.modifiers.new("bevel", "BEVEL")
        b.width = bevel
        b.segments = segs
        b.limit_method = "ANGLE"
    for p in o.data.polygons:
        p.use_smooth = True
    if hasattr(o.data, "set_sharp_from_angle"):
        o.data.set_sharp_from_angle(angle=math.radians(40))
    return o


def box(name, size, loc=(0, 0, 0), m=None, bevel=0.0, segs=3, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return _finish(o, m, bevel, segs)


def cyl(name, r, depth, loc=(0, 0, 0), m=None, rot=(0, 0, 0), verts=48, bevel=0.0, segs=3):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.object
    o.name = name
    return _finish(o, m, bevel, segs)


def torus(name, R, r, loc=(0, 0, 0), m=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot,
                                     major_segments=64, minor_segments=16)
    o = bpy.context.object
    o.name = name
    return _finish(o, m, 0, 0)


def poly(name, pts, depth, loc=(0, 0, 0), m=None, rot=(0, 0, 0), bevel=0.0, segs=2):
    """Extrude a 2D outline (x, y points) along z by depth."""
    me = bpy.data.meshes.new(name)
    n = len(pts)
    vs = [(x, y, 0) for x, y in pts] + [(x, y, depth) for x, y in pts]
    fs = [list(range(n))[::-1], list(range(n, 2 * n))] + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    me.from_pydata(vs, [], fs)
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    return _finish(o, m, bevel, segs)


def prism_x(name, pts, width, m, bevel=0.0, segs=3):
    """Extrude a side profile (y, z points) across x, centred."""
    import bpy
    me = bpy.data.meshes.new(name)
    n, h = len(pts), width / 2
    vs = [(-h, y, z) for y, z in pts] + [(h, y, z) for y, z in pts]
    fs = [list(range(n)), list(range(n, 2 * n))[::-1]] + [[i, n + i, n + (i + 1) % n, (i + 1) % n] for i in range(n)]
    me.from_pydata(vs, [], fs)
    me.validate()
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    return _finish(o, m, bevel, segs)


def light(kind, loc, energy, size=1.0, color=(1, 1, 1), aim=(0, 0, 0)):
    d = bpy.data.lights.new(kind, kind)
    d.energy = energy
    d.color = color
    if kind == "AREA":
        d.size = size
    elif kind == "SUN":
        d.angle = math.radians(size)
    o = bpy.data.objects.new(kind, d)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o


def icon_lights():
    """The house lighting: a warm key from upper left, a cool fill from the right, a rim from behind."""
    light("AREA", (-3, -3, 4.5), 620, size=3, color=(1.0, 0.95, 0.86))
    light("AREA", (4, -2, 1.5), 160, size=4, color=(0.8, 0.88, 1.0))
    light("AREA", (1, 4, 3), 300, size=2)


def camera(direction=(-0.55, -1.0, 0.62), margin=1.08, ortho=True, lens=60, skip=()):
    """Point a camera at everything in the scene from `direction` and fit it to the bounding box."""
    pts = []
    dg = bpy.context.evaluated_depsgraph_get()
    for o in bpy.context.scene.objects:
        if o.type == "MESH" and not o.name.startswith(tuple(skip) or ("\0",)):
            e = o.evaluated_get(dg)
            pts += [e.matrix_world @ Vector(c) for c in e.bound_box]
    centre = sum(pts, Vector()) / len(pts)
    d = Vector(direction).normalized()
    cd = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cd)
    bpy.context.collection.objects.link(cam)
    cam.location = centre + d * 20
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()
    inv = cam.matrix_world.inverted()
    loc = [inv @ p for p in pts]
    xs, ys = [p.x for p in loc], [p.y for p in loc]
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    cam.location = cam.matrix_world @ Vector((cx, cy, 0))
    r = bpy.context.scene.render
    aspect = r.resolution_x / r.resolution_y
    span = max(max(xs) - min(xs), (max(ys) - min(ys)) * aspect) * margin
    if ortho:
        cd.type = "ORTHO"
        cd.ortho_scale = span
    else:
        cd.lens = lens
        cd.sensor_width = 36
        dist = span / 2 / math.tan(math.atan(18 / lens))
        cam.location = cam.matrix_world @ Vector((0, 0, -20 + dist))
    cd.clip_end = 100
    bpy.context.scene.camera = cam
    return cam


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path
