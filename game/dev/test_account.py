"""The account endpoints of both servers against a fake OpenRouter: setup, pasted keys, the OAuth (PKCE)
login, disconnect, and how OpenRouter's refusals reach the game.

    python3 game/dev/test_account.py dev        # game/server.py
    python3 game/dev/test_account.py desktop    # tools/desktop/server.js (the Electron app's service)
"""
import base64, hashlib, json, os, subprocess, sys, tempfile, threading, time, urllib.error, urllib.parse, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GOOD = "sk-or-v1-good0000"
seen = {}
next_chat = []  # (status, body, headers) for the next completion calls


class Fake(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def send(self, code, obj, headers=()):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        for k, v in headers: self.send_header(k, v)
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path == "/key":
            if self.headers.get("Authorization") == f"Bearer {GOOD}":
                return self.send(200, {"data": {"usage": 1.25, "limit_remaining": None}})
            return self.send(401, {"error": {"code": 401, "message": "bad"}})
        self.send(404, {})

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        if self.path == "/auth/keys":
            seen["exchange"] = body
            return self.send(200, {"key": GOOD}) if body.get("code") == "good-code" else self.send(403, {"error": {"message": "Invalid code"}})
        if self.path == "/chat/completions":
            st, b, h = next_chat.pop(0) if next_chat else (200, {"choices": [{"message": {"content": "ok"}}]}, ())
            return self.send(st, b, h)
        self.send(404, {})


fake = ThreadingHTTPServer(("127.0.0.1", 0), Fake)
threading.Thread(target=fake.serve_forever, daemon=True).start()
FAKE = f"http://127.0.0.1:{fake.server_port}"

which = sys.argv[1] if len(sys.argv) > 1 else "dev"
port = {"dev": 18077, "desktop": 18079}[which]
tmp = tempfile.mkdtemp()
env = {**os.environ, "CC_OPENROUTER": FAKE, "PORT": str(port), "CC_PORT": str(port),
       "CC_ACCOUNT": f"{tmp}/account.json", "OPENROUTER_API_KEY": ""}
if which == "dev":
    # CC_NO_ENV_FILE: the project's .env would otherwise supply a key
    proc = subprocess.Popen([sys.executable, str(ROOT / "game/server.py")], env={**env, "CC_NO_ENV_FILE": "1"}, stderr=subprocess.DEVNULL)
else:  # desktop
    js = ("const {createServer}=require(process.argv[1]);createServer({web:process.argv[2],data:process.argv[3],port:+process.argv[4],"
          "secrets:{encrypt:(s)=>Buffer.from(s).toString('base64'),decrypt:(b)=>Buffer.from(b,'base64').toString()}})")
    proc = subprocess.Popen(["node", "-e", js, str(ROOT / "tools/desktop/server.js"), str(ROOT / "game"), tmp, str(port)], env=env, stdout=subprocess.DEVNULL)

BASE = f"http://localhost:{port}"
for _ in range(50):
    try: urllib.request.urlopen(BASE + "/api/account", timeout=1); break
    except Exception: time.sleep(0.1)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a): return None


raw = urllib.request.build_opener(NoRedirect)


def call(method, path, body=None, follow=True):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json"})
    try:
        r = (urllib.request.urlopen if follow else raw.open)(req)
        return r.status, r.headers, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read()


passed = 0
def ok(c, what):
    global passed
    if not c:
        print("FAIL", what); proc.kill(); sys.exit(1)
    passed += 1

try:
    st, _, b = call("GET", "/api/account"); ok(json.loads(b) == {"connected": False, "problem": "no_key"}, "starts without a key")
    st, _, b = call("POST", "/api/llm", {"model": "x"}); ok(st == 401 and json.loads(b)["account"] == "no_key", "llm without key -> no_key")
    st, _, b = call("POST", "/api/account/key", {"key": "sk-or-v1-wrong"}); ok(st == 400, "bad pasted key refused")
    st, _, b = call("POST", "/api/account/key", {"key": GOOD}); ok(st == 200, "good pasted key saved")
    a = json.loads(call("GET", "/api/account")[2]); ok(a["connected"] and a["source"] == "pasted" and a["hint"].endswith("0000") and a["usage"] == 1.25, f"account after paste {a}")
    call("POST", "/api/account/disconnect"); ok(json.loads(call("GET", "/api/account")[2])["connected"] is False, "disconnect")

    # OAuth: connect redirects to OpenRouter with an S256 challenge; the callback exchanges the code with the verifier
    st, h, _ = call("GET", "/api/account/connect?popup=1", follow=False); ok(st == 302, "connect redirects")
    u = urllib.parse.urlparse(h["Location"]); q = urllib.parse.parse_qs(u.query)
    ok(u.netloc == "openrouter.ai" and u.path == "/auth" and q["code_challenge_method"] == ["S256"], f"auth url {h['Location']}")
    ok(q["callback_url"] == [f"http://localhost:{port}/api/account/callback"], "callback url")
    st, h, _ = call("GET", "/api/account/callback?code=good-code", follow=False)
    ok(st == 302 and "connected=1" in h["Location"] and "popup=1" in h["Location"], f"callback -> {h.get('Location')}")
    v = seen["exchange"]["code_verifier"]
    ok(base64.urlsafe_b64encode(hashlib.sha256(v.encode()).digest()).rstrip(b"=").decode() == q["code_challenge"][0], "verifier matches challenge")
    ok(json.loads(call("GET", "/api/account")[2])["source"] == "oauth", "saved as oauth")
    st, h, _ = call("GET", "/api/account/callback?code=good-code", follow=False); ok("error=" in h["Location"], "callback replay refused")
    call("GET", "/api/account/connect", follow=False)
    st, h, _ = call("GET", "/api/account/callback?code=bad", follow=False); ok("error=" in h["Location"] and "popup" not in h["Location"], "bad code -> error")

    # refusals as the game sees them
    def chat(status, body, headers=()):
        next_chat.append((status, body, headers)); return json.loads(call("POST", "/api/llm", {"model": "x"})[2])
    ok(chat(200, {"choices": [{"message": {"content": "hi"}}]})["choices"][0]["message"]["content"] == "hi", "ordinary call passes through")
    ok(chat(402, {"error": {"code": 402, "message": "Insufficient credits", "metadata": {"limit_source": "openrouter_credits"}}})["account"] == "no_credit", "402 credits")
    ok(chat(402, {"error": {"code": 402, "message": "x", "metadata": {"limit_source": "openrouter_key_limit"}}})["account"] == "key_limit", "402 key limit")
    r = chat(402, {"error": {"code": 402, "message": "x", "metadata": {"reason": "in_flight_budget_exhausted", "limit_source": "openrouter_in_flight_budget"}}}, [("Retry-After", "7")])
    ok(r.get("wait") == 7 and "account" not in r, f"in-flight budget waits {r}")
    ok(chat(401, {"error": {"code": 401, "message": "User not found"}})["account"] == "bad_key", "401 bad key")
    r = chat(429, {"error": {"code": 429, "message": "slow down"}}); ok("account" not in r and r["error"] == "slow down", "429 stays an ordinary error")
    st, _, b = call("GET", "/setup.html"); ok(st == 200 and b"Connect OpenRouter" in b, "setup page served")
    if which == "desktop":  # sign-in in the player's own browser: the callback answers with a page, not a redirect
        call("POST", "/api/account/disconnect")
        call("GET", "/api/account/connect?external=1", follow=False)
        st, _, b = call("GET", "/api/account/callback?code=good-code", follow=False)
        ok(st == 200 and b"Connected." in b, "external callback page")
        ok(json.loads(call("GET", "/api/account")[2])["source"] == "oauth", "external login saved")
        sealed = json.loads(open(f"{tmp}/account.json").read())
        ok("sealed" in sealed and GOOD not in json.dumps(sealed), "key sealed at rest")
        st, _, _ = call("GET", "/..%2F..%2Ftools%2Fdesktop%2Fmain.js"); ok(st in (403, 404), "no path escape")
        st, _, b = call("GET", "/worlds/../../etc/passwd"); ok(st in (403, 404), "no path escape via worlds")
finally:
    proc.kill()
print(f"{which}: {passed} passed")
