"""The Observation index as a brass panel gauge, one render per notice stage. Exec'd after kit.py.

build("gauge0".."gauge4", out): the needle at QUIET, STIRRING, WATCHFUL, FIXED, SEARCHING. The scale has no
words (the console prints the stage beside it); the last zone is enamelled red. The pivot cap carries the
emblem's centre bar.
"""
import math

import bpy

STAGES = 5
SWEEP = 100  # degrees from the first stage to the last


def gauge(stage):
    brass = mat("brass", srgb("#c29a45"), 0.28, metal=1.0)
    face = mat("enamel", srgb("#ece4cc"), 0.45, spec=0.4)
    ink = mat("ink", srgb("#23211c"), 0.5)
    red = mat("red", srgb("#a3352b"), 0.45)
    cyl("case", 1.0, 0.3, (0, 0, -0.16), mat("case", srgb("#2a2a26"), 0.4), verts=96)
    torus("bezel", 0.95, 0.09, (0, 0, 0.06), brass)
    cyl("face", 0.88, 0.04, (0, 0, 0.02), face, verts=96)
    # scale: an arc of ticks across the top; the last fifth in red
    lo, hi = 90 + SWEEP / 2 + 12, 90 - SWEEP / 2 - 12
    n = 21
    for i in range(n):
        a = math.radians(lo + (hi - lo) * i / (n - 1))
        major = i % 5 == 0
        L = 0.2 if major else 0.11
        r = 0.7 - L / 2
        box(f"tick{i}", (L, 0.035 if major else 0.022, 0.01), (math.cos(a) * r, math.sin(a) * r, 0.045),
            red if i >= 16 else ink, rot=(0, 0, a))
    for j in range(24):  # a solid red band under the last fifth of the scale
        a = math.radians(lo + (hi - lo) * (0.8 + 0.2 * j / 23))
        box(f"band{j}", (0.07, 0.05, 0.008), (math.cos(a) * 0.55, math.sin(a) * 0.55, 0.042), red, rot=(0, 0, a))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.73, minor_radius=0.012, location=(0, 0, 0.045))
    _finish(bpy.context.object, ink, 0, 0)
    # the needle
    a = math.radians(90 + SWEEP / 2 - SWEEP * stage / (STAGES - 1))
    nl = 0.66
    poly("needle", [(-0.14, -0.05), (nl, -0.014), (nl, 0.014), (-0.14, 0.05)], 0.02, (0, 0, 0.06), ink,
         rot=(0, 0, a))
    cyl("cap", 0.09, 0.05, (0, 0, 0.08), brass, verts=32, bevel=0.015)
    box("capbar", (0.025, 0.09, 0.01), (0, 0, 0.11), ink)


def build(name, out, size=256):
    reset(size)
    stage = int(name[-1])
    gauge(stage)
    light("AREA", (-2.5, -1.0, 3.5), 220, size=1.5, color=(1.0, 0.94, 0.84))
    light("AREA", (2.5, -2.0, 1.5), 50, size=3, color=(0.8, 0.88, 1.0))
    camera((0, -0.3, 1.0), margin=1.04)
    return render(out)
