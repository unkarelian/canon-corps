"""Render Canon Corps' pre-rendered assets in a running Blender, through the Blender MCP server.

Blender must be running with the MCP add-on's bridge on (GUI: Preferences > Add-ons > MCP > Start; headless:
`blender -b --online-mode --command blender_mcp`). This script speaks MCP to `blender-mcp` over stdio, the
same way Claude does, and sends kit.py + the asset script + a build call to execute_blender_code.

  uv run --project ~/Projects/blender_mcp/mcp python tools/art/blender/mcp_render.py icons viewer mail ...
  uv run --project ~/Projects/blender_mcp/mcp python tools/art/blender/mcp_render.py emblem medallion

Renders go to tools/art/blender/out/<name>.png; post.py turns them into game assets.
"""
import asyncio
import json
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"


async def main(script, names):
    OUT.mkdir(exist_ok=True)
    src = (HERE / "kit.py").read_text() + "\n" + (HERE / f"{script}.py").read_text()
    server = StdioServerParameters(command="uv", args=["run", "--project", str(Path.home() / "Projects/blender_mcp/mcp"), "blender-mcp"])
    async with stdio_client(server) as (r, w), ClientSession(r, w) as s:
        await s.initialize()
        for n in names:
            fname = ("site_" if script == "scenes" else "") + n + ".png"
            code = src + f"\nprint('wrote', build({n!r}, {str(OUT / fname)!r}))\n"
            res = await s.call_tool("execute_blender_code", {"code": code})
            text = "".join(getattr(c, "text", "") for c in res.content)
            try:
                j = json.loads(text)
                print(n, j.get("status"), (j.get("stdout") or "").strip().splitlines()[-1:] , j.get("error") or "")
                if j.get("status") != "ok":
                    print(text[-3000:])
            except json.JSONDecodeError:
                print(n, text[-3000:])


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1], sys.argv[2:]))
