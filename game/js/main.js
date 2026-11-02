import * as G from "./game.js";
import { S, TUNE, deliverDue, addNotice, clock, required, beginRun } from "./game.js";
import { W, setWorld } from "./world.js";
import { chooseWorld, markPlayed, refill } from "./worlds.js";
import { initNPCs } from "./npc.js";
import { initDemiurge, wake } from "./demiurge.js";
import { initDirectives } from "./directives.js";
import { open, rerender, isOpen } from "./wm.js";
import "./apps.js";
import "./orientation.js";
import "./desk.js";
import { tickLeaks, displayClock, forceLeak } from "./leaks.js";
import { tickLiving } from "./living.js";
import { introDue, playIntro } from "./intro.js";
import { bootScreen } from "./boot.js";
import { inductionDue, playInduction } from "./induction.js";
import { playEye, loss, win } from "./fx.js";
import { on, el, emit } from "./util.js";
import { usage } from "./llm.js";
import { play, musicForStage, startRoom, ambience, onAudioStart, ready, audioPrefs, setPref, audioState, startRecording, stopRecording } from "./audio.js";

const ICONS = [["mail", "Mail"], ["viewer", "Reality Viewer"], ["files", "Files"], ["scanner", "Scanner"], ["hq", "HQ Console"],
  ["notepad", "Notepad"], ["intranet", "Corps Intranet"], ["orientation", "Orientation"]];
document.getElementById("icons").append(...ICONS.map(([id, label]) =>
  el("div", { class: "icon", ondblclick: () => open(id), onclick: (e) => { if (e.detail === 1 && matchMedia("(pointer:coarse)").matches) open(id); } },
    el("img", { class: "glyph", src: `assets/icons/${id}.png`, alt: "", draggable: "false" }), el("span", { id: `icon-${id}` }, label))));

initNPCs();
initDemiurge();

on("change", () => {
  for (const id of ["mail", "files", "scanner", "hq"]) if (isOpen(id)) rerender(id);
  const unread = S.mail.inbox.filter((m) => !m.read).length + S.mail.hq.filter((m) => !m.read).length;
  document.getElementById("tray-mail").textContent = unread ? `${unread} unread` : "";
});
on("first-notice", () => playEye());

// ---- sound -----------------------------------------------------------------------------------
const ORDER = ["QUIET", "STIRRING", "WATCHFUL", "FIXED", "SEARCHING"];
// The reality for this run. Chosen (or generated) behind the logon screen.
const params = new URLSearchParams(location.search);
const splashStatus = document.getElementById("splash-status");
const logonBtn = document.getElementById("logon");
logonBtn.disabled = true;
const worldReady = chooseWorld(params, (s) => { splashStatus.textContent = `${s}...`; }).then((w) => {
  setWorld(w);
  beginRun();
  logonBtn.disabled = false;
  splashStatus.textContent = `Assignment ${w.id} ready.`;
  return w;
});

// The opening cinematic, over the logon screen, the first time (or with ?intro).
bootScreen(params).then(() => { if (introDue(params)) playIntro(); });

// Logon: the Corps chime, then the hold music. ?nosplash skips it (playtests).
const splash = document.getElementById("splash");
let loggedOn;
const onLogon = new Promise((r) => { loggedOn = r; });
if (params.has("nosplash")) { splash.hidden = true; worldReady.then(() => loggedOn()); }
logonBtn.addEventListener("click", async () => {
  await Promise.all([ready, worldReady]);
  play("startup");
  splash.classList.add("leaving");
  setTimeout(() => { splash.hidden = true; }, 650);
  setTimeout(loggedOn, 3600);
});
// The workstation induction (first run only), then the first directive.
onLogon.then(async () => {
  if (inductionDue(params)) await playInduction();
  initDirectives();
  markPlayed(W.id);
  if (!params.has("norefill")) setTimeout(() => refill(), 90000);
});
on("directive-closed", () => setTimeout(() => play("stamp"), 400));
Promise.all([ready, onLogon]).then(() => onAudioStart(() => { if (S.over) return; startRoom(); ambience(S.stage, 3); musicForStage(S.stage); }));
on("stage", ({ from, to }) => {
  if (S.over) return;
  if (from !== "QUIET" && ORDER.indexOf(to) > ORDER.indexOf(from)) play("stage");
  musicForStage(to);
  ambience(to);
});
on("mail-arrived", () => play("mail"));
on("post", (r) => { if (r.kind !== "login" && r.kind !== "transmit") play("send"); });
on("saved", () => play("save"));
on("poison", () => play("flood"));
on("transmitted", (r) => {
  play("transmit");
  setTimeout(() => play(r.resonance ? "resonance" : "denied"), 2300);
});
document.addEventListener("click", (e) => { if (e.target.closest("button")) play("click"); }, true);
document.addEventListener("keydown", (e) => {
  if (!e.target.matches?.("input, textarea") || !(e.key.length === 1 || e.key === "Backspace" || e.key === "Enter")) return;
  play("key", { rate: 0.85 + Math.random() * 0.35, vol: 0.7 + Math.random() * 0.3 });
});

// Volume, in the tray.
const sndPanel = el("div", { id: "snd-panel", hidden: true },
  ...[["sfx", "Sounds"], ["music", "Music"]].map(([k, label]) => el("label", {}, label,
    el("input", { type: "range", min: 0, max: 1, step: 0.05, value: audioPrefs[k], oninput: (e) => setPref(k, +e.target.value) }))),
  el("label", {}, el("input", { type: "checkbox", checked: audioPrefs.muted, onchange: (e) => { setPref("muted", e.target.checked); sndBtn.textContent = e.target.checked ? "SND off" : "SND"; } }), " Mute all"));
const sndBtn = el("span", { id: "tray-snd", title: "Sound", onclick: () => { sndPanel.hidden = !sndPanel.hidden; } }, audioPrefs.muted ? "SND off" : "SND");
document.getElementById("tray").prepend(sndBtn);
document.body.append(sndPanel);
document.addEventListener("pointerdown", (e) => { if (!sndPanel.hidden && !e.target.closest("#snd-panel, #tray-snd")) sndPanel.hidden = true; });
on("poison", ({ recent }) => wake(`the intruder flooded your world's lesser processes with its poison${recent ? ", again" : ""}. Everything you have altered shook while it lasted`));
on("inject", () => win());
on("mail-arrived", (m) => {
  if (document.hidden && Notification?.permission === "granted") new Notification(`Field mail: ${m.subject}`, { body: m.fromName || m.from });
});

let lastDrift = Date.now();
setInterval(() => {
  if (S.over) return;
  deliverDue();
  if (S.stirred && Date.now() - lastDrift > TUNE.driftEverySec * 1000) { lastDrift = Date.now(); addNotice(1, "drift"); }
  if (S.searchStartedAt) {
    if (Date.now() - S.searchStartedAt > TUNE.searchSeconds * 1000) loss();
    else if (isOpen("hq")) rerender("hq");
  }
  tickLeaks();
  tickLiving();
  document.getElementById("tray-clock").textContent = displayClock(clock());
  if (!document.getElementById("debug").hidden) debug();
}, 1000);

// Dev panel: press ` to toggle. Shows the hidden numbers and what the Demiurge actually did.
function debug() {
  const d = document.getElementById("debug");
  const wakes = S.demi.wakes.slice(-6).map((w) => `${w.time} [${w.emotion?.label || "?"}] ${w.reasons[0]}\n   calls: ${w.calls.map((c) => c.tool).join(", ") || "-"}\n   effects: ${w.effects.map((e) => e.kind).join(", ") || "-"}\n   said: ${w.final.slice(0, 160)}`).join("\n");
  d.textContent = `notice ${S.notice}  stage ${S.stage}  tier ${S.tier}  busy ${S.demi.busy}
tamper ${S.demi.tamper}  progress ${S.progress}/${required()}  credited ${[...S.credited].join(",")}
llm $${usage.cost.toFixed(4)} over ${usage.calls} calls
leaks: ${S.leaks.map((l) => l.kind).join(", ") || "-"}
in transit: ${S.mail.transit.map((m) => `${m.from} "${m.subject}" t${m.tamper} in ${Math.round((m.deliverAt - Date.now()) / 1000)}s`).join("; ") || "-"}

${wakes || "(no wakes yet)"}

keys: [ add 10 notice   ] fake 34 progress`;
}
addEventListener("keydown", (e) => {
  if (e.target.matches?.("input, textarea")) return;
  if (e.key === "`") { const d = document.getElementById("debug"); d.hidden = !d.hidden; if (!d.hidden) debug(); }
  if (!document.getElementById("debug").hidden) {
    if (e.key === "[") addNotice(10, "debug");
    if (e.key === "]") { S.progress += 34; rerender("hq"); }
  }
});

await worldReady;
open("mail");
open("hq");

// Dev hook for the playtest driver (dev/playtest.mjs).
window.CC = { saveRun: (r) => saveRun(r), ...G, W, open, forceLeak, wake, usage, win, loss, audioState, play, startRecording, stopRecording, emit: (t, d) => emit(t, d) };

// Save the whole run to the server when it ends (runs/ next to game/). Sets become arrays.
let runSaved = false;
export function saveRun(reason) {
  if (runSaved) return;
  runSaved = true;
  const data = JSON.stringify({ reason, savedAt: new Date().toISOString(), usage, state: S },
    (k, v) => (v instanceof Set ? [...v] : v));
  navigator.sendBeacon?.("/api/runlog", new Blob([data], { type: "application/json" }));
}
on("inject", () => setTimeout(() => saveRun("win"), 15000));
addEventListener("pagehide", () => saveRun(S.over || "closed"));
