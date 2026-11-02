// Record a demo video: headless Chromium, screencast frames + the game's own audio, muxed to mp4.
//   node game/dev/record.mjs <demo-name> <out.mp4> [query]
// Demo scripts live in dev/demos/<name>.mjs and get { js, sleep, demo, until, log }.
// `demo` drives the page like a person: a visible cursor glides to things and clicks them; typing fires key events.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const [, , name, outFile, query = "nosplash"] = process.argv;
const work = join(dirname(outFile), `.rec-${name}`);
rmSync(work, { recursive: true, force: true });
mkdirSync(join(work, "f"), { recursive: true });
const chrome = spawn("chromium", ["--headless=new", "--remote-debugging-port=9334", `--user-data-dir=${work}/profile`,
  "--window-size=1280,720", "--autoplay-policy=no-user-gesture-required", "--no-first-run", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(); const frames = [];
for (let i = 0; i < 40 && !ws; i++) {
  try {
    const t = await (await fetch("http://127.0.0.1:9334/json")).json();
    ws = new WebSocket(t.find((x) => x.type === "page").webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener("open", r));
  } catch { await sleep(250); }
}
const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Page.screencastFrame") {
    const n = frames.length;
    writeFileSync(join(work, "f", `${String(n).padStart(6, "0")}.jpg`), Buffer.from(m.params.data, "base64"));
    frames.push(m.params.metadata.timestamp);
    cdp("Page.screencastFrameAck", { sessionId: m.params.sessionId });
  }
  if (m.method === "Runtime.exceptionThrown") console.log("[exception]", m.params.exceptionDetails.exception?.description);
});
const js = async (expr) => { const r = await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description; };
const until = async (expr, ms, label) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await js(expr)) return true; await sleep(300); } console.log("TIMEOUT", label); return false; };

await cdp("Runtime.enable"); await cdp("Page.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await cdp("Page.navigate", { url: `http://localhost:8077/?${query}${/world=/.test(query) ? "" : "&world=harrowgate"}&norefill` });
await sleep(1800);

// The page-side helper: a cursor, gliding clicks, typing.
await js(`(() => {
  const c = document.createElement("div");
  c.id = "demo-cursor";
  c.innerHTML = '<svg width="18" height="26" viewBox="0 0 18 26"><path d="M1 1 L1 20 L6 15 L10 24 L13 23 L9 14 L16 14 Z" fill="#fff" stroke="#000" stroke-width="1.5"/></svg>';
  Object.assign(c.style, { position: "fixed", left: "640px", top: "400px", zIndex: 99999, pointerEvents: "none", transition: "left .45s ease-in-out, top .45s ease-in-out" });
  document.body.append(c);
  const center = (sel) => { const e = typeof sel === "string" ? document.querySelector(sel) : sel; if (!e) throw new Error("no " + sel); e.scrollIntoView({ block: "nearest" }); const r = e.getBoundingClientRect(); return [e, r.left + Math.min(r.width / 2, 40), r.top + r.height / 2]; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  window.demo = {
    async move(sel) { const [e, x, y] = center(sel); c.style.left = x + "px"; c.style.top = y + "px"; await wait(500); return e; },
    async click(sel) { const e = await this.move(sel); e.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); e.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); await wait(90); e.click(); await wait(250); return e; },
    async dbl(sel) { const e = await this.move(sel); e.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); e.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); await wait(300); return e; },
    async type(sel, text, cps = 22) { const e = await this.click(sel); e.focus(); for (const ch of text) { e.dispatchEvent(new KeyboardEvent("keydown", { key: ch, bubbles: true })); e.value += ch; e.dispatchEvent(new Event("input", { bubbles: true })); await wait(1000 / cps * (0.6 + Math.random() * 0.8)); } return e; },
    async select(sel, value) { const e = await this.click(sel); e.value = value; e.dispatchEvent(new Event("change", { bubbles: true })); await wait(300); },
    win(title) { return [...document.querySelectorAll("#windows .win")].reverse().find((w) => w.querySelector(".bar .t").textContent.startsWith(title)); },
    byText(sel, text) { return [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(text)); },
    hide() { c.style.display = "none"; },
  };
})()`);

await cdp("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1 });
await sleep(300);
const audioStart = await js("CC.startRecording()");
const demo = new Proxy({}, { get: (_, k) => (...a) => js(`demo.${k}(${a.map((x) => JSON.stringify(x)).join(",")})`) });
const script = (await import(`./demos/${name}.mjs`)).default;
try { await script({ js, sleep, demo, until, log: console.log }); } catch (e) { console.log("SCRIPT ERROR", e); }
const audio = await js("CC.stopRecording()");
await cdp("Page.stopScreencast");
const endT = Date.now() / 1000;
chrome.kill();

// Frames -> constant 30 fps via concat durations; audio offset from the two clocks.
writeFileSync(join(work, "a.webm"), Buffer.from(audio.b64, "base64"));
const lines = ["ffconcat version 1.0"];
for (let i = 0; i < frames.length; i++) {
  const next = i + 1 < frames.length ? frames[i + 1] : endT;
  lines.push(`file f/${String(i).padStart(6, "0")}.jpg`, `duration ${Math.max(0.001, next - frames[i]).toFixed(4)}`);
}
lines.push(`file f/${String(frames.length - 1).padStart(6, "0")}.jpg`);
writeFileSync(join(work, "frames.txt"), lines.join("\n"));
const offset = audio.start / 1000 - frames[0];  // audio began this many seconds after the first frame
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(work, "frames.txt"),
  "-itsoffset", offset.toFixed(3), "-i", join(work, "a.webm"),
  "-map", "0:v", "-map", "1:a", "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "20", "-preset", "medium",
  "-c:a", "aac", "-b:a", "160k", "-shortest", outFile]);
console.log(`${outFile}: ${frames.length} frames, ${(endT - frames[0]).toFixed(1)}s, audio offset ${offset.toFixed(2)}s`);
rmSync(work, { recursive: true, force: true });
process.exit(0);
