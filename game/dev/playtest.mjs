// Headless playtest driver: launches Chromium, drives the game through window.CC, takes screenshots.
//   node game/dev/playtest.mjs <script-name> <outdir>
// Requires game/server.py running on :8077 (or $PORT).
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const [, , scriptName = "full", outDir = "/tmp/cc-playtest"] = process.argv;
mkdirSync(outDir, { recursive: true });
const chrome = spawn("chromium", ["--headless=new", `--remote-debugging-port=${process.env.CDP || 9333}`, `--user-data-dir=${outDir}/profile`,
  "--window-size=1280,800", "--autoplay-policy=no-user-gesture-required", "--no-first-run", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(); const logs = [];
for (let i = 0; i < 40 && !ws; i++) {
  try {
    const t = await (await fetch(`http://127.0.0.1:${process.env.CDP || 9333}/json`)).json();
    const page = t.find((x) => x.type === "page");
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener("open", r));
  } catch { await sleep(250); }
}
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.consoleAPICalled") logs.push(`[${m.params.type}] ${m.params.args.map((a) => a.value ?? a.description).join(" ")}`);
  if (m.method === "Runtime.exceptionThrown") logs.push(`[exception] ${m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text}`);
});
const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (expr) => { const r = await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description; };
const shot = async (name) => { const r = await cdp("Page.captureScreenshot", { format: "png" }); writeFileSync(`${outDir}/${name}.png`, Buffer.from(r.result.data, "base64")); console.log("shot", name); };
const until = async (expr, timeoutMs, label) => { const t0 = Date.now(); while (Date.now() - t0 < timeoutMs) { if (await js(expr)) return true; await sleep(1000); } console.log("TIMEOUT", label); return false; };

await cdp("Runtime.enable"); await cdp("Page.enable");
await cdp("Page.navigate", { url: `http://localhost:${process.env.PORT || 8077}/?fast&nosplash&norefill&${process.env.WORLD ? `world=${process.env.WORLD}` : "world=harrowgate"}` });
await sleep(2500);
const scripts = (await import(`./scripts/${scriptName}.mjs`)).default;
try { await scripts({ js, shot, sleep, until, log: console.log }); }
catch (e) { console.log("SCRIPT ERROR", e); }
writeFileSync(`${outDir}/console.log`, logs.join("\n"));
console.log(`console: ${logs.length} lines -> ${outDir}/console.log`);
chrome.kill();
process.exit(0);
