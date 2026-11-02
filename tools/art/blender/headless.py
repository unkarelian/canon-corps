"""Render pre-rendered assets in Blender without the MCP bridge (the same builds mcp_render.py sends):
  blender -b --python tools/art/blender/headless.py -- scenes school station ...
  blender -b --python tools/art/blender/headless.py -- portraits p00 p01 ...
Renders go to tools/art/blender/out/<name>.png (scenes: site_<name>.png); post.py turns them into game assets."""
import os
import sys

D = os.path.dirname(os.path.abspath(__file__)) + "/"
args = sys.argv[sys.argv.index("--") + 1:]
script, names = args[0], args[1:]
g = {"__name__": "cc", "KIT_DIR": D.rstrip("/")}
for f in ("kit.py", "icons.py", "emblem.py", f"{script}.py") if script != "icons" else ("kit.py", "icons.py"):
    exec(open(D + f).read(), g)
for n in names:
    out = D + "out/" + ("site_" if script == "scenes" else "") + n + ".png"
    print("built", g["build"](n, out), flush=True)
