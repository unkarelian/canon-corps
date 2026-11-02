"""Render film shots headless, without the MCP bridge:
  blender -b --python tools/art/blender/render_film.py -- hall hall_L desk ...
A name ending in _L renders the line-art (opening cinematic) version. name@N renders only frame N (a test)."""
import os
import sys
D = os.path.dirname(os.path.abspath(__file__)) + "/"
g = {"__name__": "cc", "KIT_DIR": D.rstrip("/")}
for f in ("kit.py", "icons.py", "emblem.py", "film.py"):
    exec(open(D + f).read(), g)
args = sys.argv[sys.argv.index("--") + 1:]
for a in args:
    a, _, only = a.partition("@")
    name, lines = (a[:-2], True) if a.endswith("_L") else (a, False)
    out = D + "out/film/" + a + ("_test" if only else "")
    print("built", g["build"](name, out, lines=lines, only=[int(only)] if only else None), flush=True)
