"""The Corps emblem as a cast-bronze medallion, for the logon screen. Exec'd after kit.py; call build(name, out).

Same geometry as make_seals.corps(): a double ring, six ticks where the seal's hexagram points fall, an inner
ring, and the bar at the centre, all raised from a sunken field. Lit low from the upper left so the relief
reads, the way an agency's 3D logo was rendered in 1998.
"""
import math


def medallion():
    import bpy
    before = set(bpy.context.scene.objects)
    bronze = mat("bronze", srgb("#a8823f"), 0.32, metal=1.0)
    field = mat("field", srgb("#3d2f18"), 0.6, metal=0.8)
    R = 1.0
    cyl("disc", R, 0.12, (0, 0, 0), field, verts=128, bevel=0.0)
    torus("rim", R - 0.035, 0.045, (0, 0, 0.06), bronze)
    torus("rim2", R - 0.16, 0.022, (0, 0, 0.06), bronze)
    for i in range(6):
        a = math.pi / 2 + 2 * math.pi * i / 6
        r_out, r_in = R - 0.2, (R - 0.2) * 0.72
        rm = (r_out + r_in) / 2
        box(f"tick{i}", (r_out - r_in, 0.055, 0.07), (math.cos(a) * rm, math.sin(a) * rm, 0.07), bronze,
            rot=(0, 0, a), bevel=0.018)
    torus("inner", 0.19, 0.02, (0, 0, 0.06), bronze)
    box("bar", (0.06, 0.24, 0.08), (0, 0, 0.08), bronze, bevel=0.02)
    # tilt it toward the viewer a little
    mine = [o for o in bpy.context.scene.objects if o not in before]
    piv = bpy.data.objects.new("medallion", None)
    bpy.context.collection.objects.link(piv)
    for o in mine:
        o.parent = piv
    piv.rotation_euler = (math.radians(62), 0, 0)
    return piv


def emboss():
    """The emblem blind-embossed into white paper, for the letterhead on HQ memos. Seen from straight above."""
    import bpy
    paper = mat("paper", (1, 1, 1), 0.9, spec=0.2)
    box("sheet", (3, 3, 0.02), (0, 0, -0.01), paper)
    sunk = -0.035  # each ridge is a torus or bar mostly below the paper, so only a soft swell shows
    torus("rim", 0.95, 0.05, (0, 0, sunk), paper)
    torus("rim2", 0.82, 0.035, (0, 0, -0.014), paper)
    for i in range(6):
        a = math.pi / 2 + 2 * math.pi * i / 6
        r_out, r_in = 0.76, 0.76 * 0.72
        rm = (r_out + r_in) / 2
        box(f"tick{i}", (r_out - r_in, 0.07, 0.07), (math.cos(a) * rm, math.sin(a) * rm, sunk + 0.01), paper,
            rot=(0, 0, a), bevel=0.03, segs=4)
    torus("inner", 0.19, 0.03, (0, 0, -0.01), paper)
    box("bar", (0.07, 0.26, 0.07), (0, 0, sunk + 0.01), paper, bevel=0.03, segs=4)


def build(name, out, size=384):
    reset(size)
    if name == "emboss":
        emboss()
        bpy.context.scene.render.film_transparent = False
        bpy.context.scene.world.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1)
        bpy.context.scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.25
        light("SUN", (-4, 3, 1.3), 4.0, size=2)
        cam = camera((0, 0, 1), margin=1.0, skip=("sheet",))
        return render(out)
    {"medallion": medallion}[name]()
    light("AREA", (-3.5, -2.5, 3.5), 520, size=1.2, color=(1.0, 0.93, 0.82))
    light("AREA", (3.5, -3.0, -0.5), 90, size=4, color=(0.75, 0.85, 1.0))
    light("AREA", (0, 3, 3), 200, size=2)
    bpy.context.scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    camera((0, -1.0, 0.0), margin=1.04)
    return render(out)
