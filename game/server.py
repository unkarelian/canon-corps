"""Canon Corps dev server: serves the game and proxies LLM calls to OpenRouter.

The API key stays here, never in the browser. In the shipped app this proxy is
replaced by the Tauri backend (BYOK) or the credits server.

    python3 game/server.py            # then open http://localhost:8077
"""
import json
import time
import os
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", 8077))
UPSTREAM = "https://openrouter.ai/api/v1/chat/completions"


def load_key() -> str:
    key = os.environ.get("OPENROUTER_API_KEY", "")
    env = ROOT.parent / ".env"
    if not key and env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("OPENROUTER_API_KEY="):
                key = line.split("=", 1)[1].strip().strip("'\"")
    return key


KEY = load_key()
RUNS = ROOT.parent / "runs"
WORLDS = ROOT / "worlds"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, fmt, *args):  # quiet static requests
        if "/api/" in (args[0] if args else ""):
            sys.stderr.write("%s\n" % (fmt % args))

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path == "/api/worlds":  # the pool of generated worlds, newest first
            WORLDS.mkdir(exist_ok=True)
            items = []
            for f in sorted(WORLDS.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
                try:
                    w = json.loads(f.read_text())
                    items.append({"file": f.name, "id": w.get("id"), "name": w.get("name"),
                                  "solved": not (w.get("generated", {}).get("solver", {}).get("failures"))})
                except Exception:
                    continue
            return self._json(200, {"worlds": items})
        return super().do_GET()

    def do_POST(self):
        if self.path == "/api/worlds":  # a world generated in the browser joins the pool
            body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            w = json.loads(body)
            WORLDS.mkdir(exist_ok=True)
            name = f"{w['id']}-{''.join(c if c.isalnum() else '-' for c in w['town'].lower())}.json"
            (WORLDS / name).write_text(json.dumps(w, indent=1))
            return self._json(200, {"saved": name})
        if self.path == "/api/runlog":  # a finished run's full state, for replays and debugging
            body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            RUNS.mkdir(exist_ok=True)
            name = time.strftime("%Y-%m-%d_%H%M%S") + ".json"
            (RUNS / name).write_bytes(body)
            return self._json(200, {"saved": name})
        if self.path != "/api/llm":
            self.send_error(404)
            return
        if not KEY:
            return self._json(500, {"error": "OPENROUTER_API_KEY missing (.env)"})
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        req = urllib.request.Request(UPSTREAM, data=body, headers={
            "Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
            "X-Title": "Canon Corps prototype"})
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                return self._json(200, json.loads(r.read()))
        except urllib.error.HTTPError as e:
            return self._json(e.code, {"error": e.read().decode()[:500]})
        except Exception as e:  # network trouble: let the game treat it as a delivery delay
            return self._json(502, {"error": str(e)})

    def _json(self, code: int, obj: dict):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    print(f"Canon Corps on http://localhost:{PORT}  (key {'loaded' if KEY else 'MISSING'})")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
