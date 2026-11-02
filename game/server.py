"""Canon Corps dev server: serves the game and proxies LLM calls to OpenRouter.

The API key stays here, never in the browser. The desktop app's service
(tools/desktop/server.js) has the same endpoints. A key comes from, in order:
the OpenRouter login on setup.html (saved in .cache/account.json), then
OPENROUTER_API_KEY in the environment or .env.

    python3 game/server.py            # then open http://localhost:8077
"""
import base64
import hashlib
import json
import secrets
import time
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", 8077))


ACCOUNT = Path(os.environ.get("CC_ACCOUNT") or ROOT.parent / ".cache" / "account.json")
OR = os.environ.get("CC_OPENROUTER", "https://openrouter.ai/api/v1")  # tests point this at a fake
UPSTREAM = OR + "/chat/completions"


def env_key() -> str:
    key = os.environ.get("OPENROUTER_API_KEY", "")
    env = ROOT.parent / ".env"
    if not key and env.exists() and not os.environ.get("CC_NO_ENV_FILE"):
        for line in env.read_text().splitlines():
            if line.startswith("OPENROUTER_API_KEY="):
                key = line.split("=", 1)[1].strip().strip("'\"")
    return key


def load_account() -> tuple[str, str]:
    """(key, source); source is oauth, pasted or env."""
    if ACCOUNT.exists():
        try:
            a = json.loads(ACCOUNT.read_text())
            if a.get("key"):
                return a["key"], a.get("source", "pasted")
        except Exception:
            pass
    k = env_key()
    return k, ("env" if k else "")


def save_account(key: str, source: str):
    ACCOUNT.parent.mkdir(exist_ok=True)
    ACCOUNT.write_text(json.dumps({"key": key, "source": source}))
    os.chmod(ACCOUNT, 0o600)


def or_request(method: str, path: str, key: str = "", body: dict | None = None, timeout: int = 20):
    """Calls OpenRouter; returns (status, parsed json or {})."""
    req = urllib.request.Request(OR + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {key}"} if key else {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except Exception:
            return e.code, {}


def key_info(key: str) -> dict:
    """What /api/account reports about a key: connected, or the problem."""
    try:
        code, d = or_request("GET", "/key", key)
    except Exception:
        return {"connected": False, "problem": "offline"}
    if code in (401, 403):
        return {"connected": False, "problem": "bad_key"}
    if code >= 300:
        return {"connected": False, "problem": "offline"}
    d = d.get("data", {})
    return {"connected": True, "usage": d.get("usage"), "limit_remaining": d.get("limit_remaining")}


def classify(status: int, raw: bytes, retry_after: str | None) -> dict:
    """Turns an OpenRouter failure into what the game acts on: account trouble pauses the run, a full
    in-flight budget is just a wait, anything else is an ordinary error the game retries."""
    try:
        err = json.loads(raw).get("error", {})
    except Exception:
        err = {}
    msg = err.get("message") if isinstance(err, dict) else None
    out = {"error": (msg or raw.decode(errors="replace"))[:500]}
    if status == 401:
        out["account"] = "bad_key"
    elif status == 402:
        meta = (err.get("metadata") or {}) if isinstance(err, dict) else {}
        if meta.get("reason") == "in_flight_budget_exhausted" or meta.get("limit_source") == "openrouter_in_flight_budget":
            try:
                out["wait"] = max(1, min(60, int(float(retry_after or 5))))
            except ValueError:
                out["wait"] = 5
        elif meta.get("limit_source") == "openrouter_key_limit":
            out["account"] = "key_limit"
        else:
            out["account"] = "no_credit"
    return out


PKCE: dict = {}  # the one login in progress: verifier and whether it came from a paused run's popup
RUNS = ROOT.parent / "runs"
WORLDS = ROOT / "worlds"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, fmt, *args):  # quiet static requests
        if "/api/" in str(args[0] if args else ""):
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
        u = urllib.parse.urlparse(self.path)
        if u.path == "/api/account":
            key, source = load_account()
            if not key:
                return self._json(200, {"connected": False, "problem": "no_key"})
            return self._json(200, {**key_info(key), "source": source, "hint": "…" + key[-4:]})
        if u.path == "/api/account/connect":  # OpenRouter login, PKCE (S256)
            verifier = secrets.token_urlsafe(48)
            challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
            PKCE.clear()
            PKCE.update(verifier=verifier, popup="popup" in urllib.parse.parse_qs(u.query))
            cb = f"http://localhost:{PORT}/api/account/callback"
            return self._redirect("https://openrouter.ai/auth?" + urllib.parse.urlencode(
                {"callback_url": cb, "code_challenge": challenge, "code_challenge_method": "S256"}))
        if u.path == "/api/account/callback":
            code = urllib.parse.parse_qs(u.query).get("code", [""])[0]
            popup = "&popup=1" if PKCE.get("popup") else ""
            if not code or not PKCE.get("verifier"):
                return self._redirect("/setup.html?error=" + urllib.parse.quote("The login didn't finish. Try again.") + popup)
            try:
                st, d = or_request("POST", "/auth/keys", body={"code": code, "code_verifier": PKCE["verifier"], "code_challenge_method": "S256"})
            except Exception as e:
                st, d = 0, {"error": str(e)}
            PKCE.clear()
            if st != 200 or not d.get("key"):
                why = d.get("error", {}).get("message") if isinstance(d.get("error"), dict) else d.get("error")
                return self._redirect("/setup.html?error=" + urllib.parse.quote(f"OpenRouter didn't hand over a key ({why or st}). Try again.") + popup)
            save_account(d["key"], "oauth")
            return self._redirect("/setup.html?connected=1" + popup)
        return super().do_GET()

    def do_POST(self):
        if self.path == "/api/account/key":  # a pasted key, checked before it is saved
            key = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}").get("key", "").strip()
            info = key_info(key) if key else {"problem": "bad_key"}
            if not info.get("connected"):
                return self._json(400, {"error": "Couldn't reach OpenRouter." if info.get("problem") == "offline" else "OpenRouter didn't accept that key."})
            save_account(key, "pasted")
            return self._json(200, {"ok": True})
        if self.path == "/api/account/disconnect":
            ACCOUNT.unlink(missing_ok=True)
            return self._json(200, {"ok": True})
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
        key, _ = load_account()
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if not key:
            return self._json(401, {"error": "No OpenRouter key set.", "account": "no_key"})
        req = urllib.request.Request(UPSTREAM, data=body, headers={
            "Authorization": f"Bearer {key}", "Content-Type": "application/json",
            "X-Title": "Canon Corps prototype"})
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                return self._json(200, json.loads(r.read()))
        except urllib.error.HTTPError as e:
            return self._json(e.code, classify(e.code, e.read(), e.headers.get("Retry-After")))
        except Exception as e:  # network trouble: let the game treat it as a delivery delay
            return self._json(502, {"error": str(e)})

    def _redirect(self, url: str):
        self.send_response(302)
        self.send_header("Location", url)
        self.end_headers()

    def _json(self, code: int, obj: dict):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    k, src = load_account()
    print(f"Canon Corps on http://localhost:{PORT}  (key {'from ' + src if k else 'MISSING: open /setup.html'})")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
