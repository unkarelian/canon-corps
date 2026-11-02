// The game's local service inside the desktop app: a Node port of game/server.py. It serves the game,
// keeps the world pool and run logs in the user's data dir, holds the player's OpenRouter key and
// proxies model calls with it, so the key never reaches the page. Same endpoints as the dev server:
//   /api/llm  /api/worlds  /api/runlog  /api/account[/connect|/callback|/key|/disconnect]  /worlds/<file>
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const OR = process.env.CC_OPENROUTER || "https://openrouter.ai/api/v1"; // tests point this at a fake
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".webm": "video/webm",
  ".ogg": "audio/ogg", ".wav": "audio/wav", ".svg": "image/svg+xml" };

// A model call can take many minutes on the flex tier; fetch() gives up after five, so this is plain https.
function longPost(url, body, headers, timeoutMs = 15 * 60000) {
  const mod = url.startsWith("https:") ? require("node:https") : http;
  return new Promise((ok, fail) => {
    const req = mod.request(url, { method: "POST", headers: { ...headers, "Content-Length": body.length } }, (r) => {
      const c = []; r.on("data", (x) => c.push(x)); r.on("end", () => ok({ status: r.statusCode, headers: r.headers, body: Buffer.concat(c).toString() }));
      r.on("error", fail);
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timed out")));
    req.on("error", fail);
    req.end(body);
  });
}

// web: the game files; data: per-user dir; secrets: { encrypt, decrypt } for the key at rest (may be identity);
// onConnected: called after an OpenRouter login lands, so the app can bring its window forward.
function createServer({ web, data, port, secrets, onConnected = () => {} }) {
  const worlds = path.join(data, "worlds"), runs = path.join(data, "runs"), cfg = path.join(data, "account.json");
  for (const d of [data, worlds, runs]) fs.mkdirSync(d, { recursive: true });

  // A new build's worlds reach players who ran an older one; worlds already there are left alone.
  const shipped = path.join(web, "worlds");
  if (fs.existsSync(shipped)) for (const f of fs.readdirSync(shipped)) {
    const dst = path.join(worlds, f);
    if (f.endsWith(".json") && !fs.existsSync(dst)) fs.copyFileSync(path.join(shipped, f), dst);
  }

  // ---- the key -------------------------------------------------------------------------------------
  function loadAccount() {
    if (process.env.OPENROUTER_API_KEY) return { key: process.env.OPENROUTER_API_KEY, source: "env" };
    try {
      const a = JSON.parse(fs.readFileSync(cfg, "utf8"));
      const key = a.sealed ? secrets.decrypt(a.sealed) : a.key;
      if (key) return { key, source: a.source || "pasted" };
    } catch {}
    return { key: "", source: "" };
  }
  function saveAccount(key, source) {
    const sealed = secrets.encrypt(key);
    fs.writeFileSync(cfg, JSON.stringify(sealed ? { sealed, source } : { key, source }), { mode: 0o600 });
  }

  async function or(method, p, { key, body, timeout = 20000 } = {}) {
    const r = await fetch(OR + p, { method, signal: AbortSignal.timeout(timeout),
      headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    let d = {};
    try { d = await r.json(); } catch {}
    return [r.status, d];
  }

  async function keyInfo(key) {
    let st, d;
    try { [st, d] = await or("GET", "/key", { key }); } catch { return { connected: false, problem: "offline" }; }
    if (st === 401 || st === 403) return { connected: false, problem: "bad_key" };
    if (st >= 300) return { connected: false, problem: "offline" };
    return { connected: true, usage: d.data?.usage ?? null, limit_remaining: d.data?.limit_remaining ?? null };
  }

  // Account trouble pauses the run, a full in-flight budget is just a wait, anything else is an ordinary error.
  function classify(status, raw, retryAfter) {
    let err = {};
    try { err = JSON.parse(raw).error || {}; } catch {}
    const out = { error: String(err.message || raw).slice(0, 500) };
    const meta = err.metadata || {};
    if (status === 401) out.account = "bad_key";
    else if (status === 402 && (meta.reason === "in_flight_budget_exhausted" || meta.limit_source === "openrouter_in_flight_budget"))
      out.wait = Math.max(1, Math.min(60, parseInt(retryAfter, 10) || 5));
    else if (status === 402) out.account = meta.limit_source === "openrouter_key_limit" ? "key_limit" : "no_credit";
    return out;
  }

  // ---- http ----------------------------------------------------------------------------------------
  const send = (res, code, obj) => { const b = JSON.stringify(obj); res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(b); };
  const redirect = (res, to) => { res.writeHead(302, { Location: to }); res.end(); };
  const readBody = (req) => new Promise((ok) => { const c = []; req.on("data", (x) => c.push(x)); req.on("end", () => ok(Buffer.concat(c))); });
  const page = (res, text) => { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(`<!DOCTYPE html><meta charset="utf-8"><title>Canon Corps</title>
<body style="font:15px Tahoma,Verdana,sans-serif;background:#66705f;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="background:#c8c4b6;border:2px outset #eeebe0;padding:22px 30px;max-width:420px">${text}</div></body>`); };

  let pkce = null; // the one OpenRouter login in progress

  async function handle(req, res) {
    const u = new URL(req.url, "http://localhost");
    const p = u.pathname;

    if (p === "/api/account") {
      const { key, source } = loadAccount();
      if (!key) return send(res, 200, { connected: false, problem: "no_key" });
      return send(res, 200, { ...(await keyInfo(key)), source, hint: "…" + key.slice(-4) });
    }
    if (p === "/api/account/connect") { // OpenRouter login, PKCE (S256)
      const verifier = crypto.randomBytes(48).toString("base64url");
      pkce = { verifier, popup: u.searchParams.has("popup"), external: u.searchParams.has("external") };
      const q = new URLSearchParams({ callback_url: `http://localhost:${port}/api/account/callback`,
        code_challenge: crypto.createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" });
      return redirect(res, "https://openrouter.ai/auth?" + q);
    }
    if (p === "/api/account/callback") {
      const login = pkce; pkce = null;
      const code = u.searchParams.get("code");
      const fail = (msg) => login?.external ? page(res, `<b>That didn't work.</b><p>${msg}</p><p>Go back to Canon Corps and try again.</p>`)
        : redirect(res, `/setup.html?error=${encodeURIComponent(msg)}${login?.popup ? "&popup=1" : ""}`);
      if (!code || !login) return fail("The login didn't finish. Try again.");
      let st, d;
      try { [st, d] = await or("POST", "/auth/keys", { body: { code, code_verifier: login.verifier, code_challenge_method: "S256" } }); }
      catch { return fail("Couldn't reach OpenRouter. Try again."); }
      if (st !== 200 || !d.key) return fail(`OpenRouter didn't hand over a key (${d.error?.message || st}). Try again.`);
      saveAccount(d.key, "oauth");
      onConnected();
      if (login.external) return page(res, "<b>Connected.</b><p>You can close this tab and go back to Canon Corps.</p>");
      return redirect(res, `/setup.html?connected=1${login.popup ? "&popup=1" : ""}`);
    }
    if (p === "/api/account/key" && req.method === "POST") { // a pasted key, checked before it is saved
      let key = "";
      try { key = String(JSON.parse(await readBody(req)).key || "").trim(); } catch {}
      const info = key ? await keyInfo(key) : { problem: "bad_key" };
      if (!info.connected) return send(res, 400, { error: info.problem === "offline" ? "Couldn't reach OpenRouter." : "OpenRouter didn't accept that key." });
      saveAccount(key, "pasted");
      return send(res, 200, { ok: true });
    }
    if (p === "/api/account/disconnect" && req.method === "POST") {
      fs.rmSync(cfg, { force: true });
      return send(res, 200, { ok: true });
    }

    if (p === "/api/llm") {
      const body = await readBody(req);
      const { key } = loadAccount();
      if (!key) return send(res, 401, { error: "No OpenRouter key set.", account: "no_key" });
      let r;
      try { r = await longPost(OR + "/chat/completions", body, { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Canon Corps" }); }
      catch (e) { return send(res, 502, { error: String(e.message || e) }); } // the game treats it as a delivery delay
      const raw = r.body;
      if (r.status >= 300) { const c = classify(r.status, raw, r.headers["retry-after"]); console.log("openrouter", r.status, c); return send(res, r.status, c); }
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(raw);
    }
    if (p === "/api/worlds") {
      if (req.method === "POST") { // a world generated in the game joins the pool
        const body = await readBody(req);
        let w;
        try { w = JSON.parse(body); } catch (e) { return send(res, 400, { error: String(e) }); }
        const name = `${w.id}-${String(w.town).toLowerCase().replace(/[^\p{L}\p{N}]/gu, "-")}.json`;
        fs.writeFileSync(path.join(worlds, name), body);
        return send(res, 200, { saved: name });
      }
      const items = [];
      for (const f of fs.readdirSync(worlds).filter((f) => f.endsWith(".json"))) {
        try {
          const full = path.join(worlds, f), w = JSON.parse(fs.readFileSync(full, "utf8"));
          items.push({ file: f, id: w.id, name: w.name, solved: !(w.generated?.solver?.failures?.length), mtime: fs.statSync(full).mtimeMs });
        } catch {}
      }
      items.sort((a, b) => b.mtime - a.mtime);
      return send(res, 200, { worlds: items.map(({ mtime, ...i }) => i) });
    }
    if (p === "/api/runlog" && req.method === "POST") {
      const name = new Date().toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "") + ".json";
      fs.writeFileSync(path.join(runs, name), await readBody(req));
      return send(res, 200, { saved: name });
    }

    // static: generated worlds from the data dir, everything else from the game files
    const file = p.startsWith("/worlds/") ? path.join(worlds, path.basename(p))
      : path.join(web, path.normalize(decodeURIComponent(p === "/" ? "/index.html" : p)).replace(/^([/\\])+/, ""));
    if (!file.startsWith(p.startsWith("/worlds/") ? worlds : web)) { res.writeHead(403); return res.end(); }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": "no-store" });
      fs.createReadStream(file).pipe(res);
    });
  }

  const server = http.createServer((req, res) => handle(req, res).catch((e) => { console.error(e); if (!res.headersSent) send(res, 500, { error: String(e) }); }));
  return new Promise((ok, fail) => { server.once("error", fail); server.listen(port, "127.0.0.1", () => ok(server)); });
}

module.exports = { createServer };
