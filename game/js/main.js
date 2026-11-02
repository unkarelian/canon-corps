import * as E from "./engine.js";
import { S, clock, beginRun, mood } from "./engine.js";
import * as TR from "./tricks.js";
import { W, setWorld } from "./world.js";
import { chooseWorld, markPlayed } from "./worlds.js";
import { initNPCs } from "./npc.js";
import { initEntity, wake, entityDebug } from "./entity.js";
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
  ["canon", "Canon Reference"], ["notepad", "Notepad"], ["intranet", "Corps Intranet"], ["orientation", "Orientation"]];
const GLYPH = { canon: "files" }; // TODO art: a book icon for the canon reference
document.getElementById("icons").append(...ICONS.map(([id, label]) =>
  el("div", { class: "icon", ondblclick: () => open(id), onclick: (e) => { if (e.detail === 1 && matchMedia("(pointer:coarse)").matches) open(id); } },
    el("img", { class: "glyph", src: `assets/icons/${GLYPH[id] || id}.png`, alt: "", draggable: "false" }), el("span", { id: `icon-${id}` }, label))));

const params = new URLSearchParams(location.search);

// ---- the input layer: Canon's censor, and the entity's Transpose ---------------------------------------
// Every text field on the desk goes through here (DESIGN-v2 §2). Password words become apostrophes as they are
// finished; the whole text is censored again when a field loses focus. Censoring keeps length, so the caret stays.
const field = (t) => t?.matches?.("input:not([type=range]):not([type=checkbox]), textarea") && !t.closest("#debug");
document.addEventListener("beforeinput", (e) => {
  if (!field(e.target) || e.inputType !== "insertText" || !e.data || !/[34]/.test(e.data) || !TR.transposing()) return;
  e.preventDefault();
  const t = e.target, a = t.selectionStart, b = t.selectionEnd, d = TR.swapDigits(e.data);
  t.value = t.value.slice(0, a) + d + t.value.slice(b);
  t.selectionStart = t.selectionEnd = a + d.length;
  t.dispatchEvent(new Event("input", { bubbles: true }));
}, true);
const scrub = (t, whole) => {
  const v = whole ? E.censor(t.value) : E.censorTyping(t.value);
  if (v !== t.value) { const a = t.selectionStart, b = t.selectionEnd; t.value = v; try { t.setSelectionRange(a, b); } catch {} t.dispatchEvent(new Event("input", { bubbles: true })); }
};
document.addEventListener("input", (e) => { if (field(e.target)) scrub(e.target, false); }, true);
document.addEventListener("focusout", (e) => { if (field(e.target)) scrub(e.target, true); }, true);
document.addEventListener("paste", (e) => { if (field(e.target)) setTimeout(() => scrub(e.target, true)); }, true);

// ---- world and logon ---------------------------------------------------------------------------------
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

bootScreen(params).then(() => { if (introDue(params)) playIntro(); });

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
onLogon.then(async () => {
  if (inductionDue(params)) await playInduction();
  S.started = Date.now(); // the evening starts when the agent sits down
  markPlayed(W.id);
  initNPCs();
  initEntity();
});

// ---- sound ---------------------------------------------------------------------------------------------
const ORDER = ["QUIET", "STIRRING", "WATCHFUL", "FIXED", "SEARCHING"];
let lastMood = "QUIET";
Promise.all([ready, onLogon]).then(() => onAudioStart(() => { if (S.over) return; startRoom(); ambience(mood(), 3); musicForStage(mood()); }));
function moodTick() {
  const m = mood();
  if (m === lastMood) return;
  if (ORDER.indexOf(m) > ORDER.indexOf(lastMood) && lastMood !== "QUIET") play("stage");
  lastMood = m;
  musicForStage(m);
  ambience(m);
}
on("mail-arrived", () => play("mail"));
on("agent-sent", () => play("send"));
on("agent-form", () => play("send"));
on("agent-forum", () => play("send"));
on("saved", () => play("save"));
document.addEventListener("click", (e) => { if (e.target.closest("button")) play("click"); }, true);
document.addEventListener("keydown", (e) => {
  if (!e.target.matches?.("input, textarea") || !(e.key.length === 1 || e.key === "Backspace" || e.key === "Enter")) return;
  play("key", { rate: 0.85 + Math.random() * 0.35, vol: 0.7 + Math.random() * 0.3 });
});

const sndPanel = el("div", { id: "snd-panel", hidden: true },
  ...[["sfx", "Sounds"], ["music", "Music"]].map(([k, label]) => el("label", {}, label,
    el("input", { type: "range", min: 0, max: 1, step: 0.05, value: audioPrefs[k], oninput: (e) => setPref(k, +e.target.value) }))),
  el("label", {}, el("input", { type: "checkbox", checked: audioPrefs.muted, onchange: (e) => { setPref("muted", e.target.checked); sndBtn.textContent = e.target.checked ? "SND off" : "SND"; } }), " Mute all"));
const sndBtn = el("span", { id: "tray-snd", title: "Sound", onclick: () => { sndPanel.hidden = !sndPanel.hidden; } }, audioPrefs.muted ? "SND off" : "SND");
document.getElementById("tray").prepend(sndBtn);
document.body.append(sndPanel);
document.addEventListener("pointerdown", (e) => { if (!sndPanel.hidden && !e.target.closest("#snd-panel, #tray-snd")) sndPanel.hidden = true; });

// ---- what the engine's events look like on the desk ------------------------------------------------------
on("change", () => {
  for (const id of ["mail", "files", "scanner", "hq"]) if (isOpen(id)) rerender(id);
  const unread = E.inbox().filter((m) => m.read === false).length + S.hq.filter((m) => !m.read).length;
  document.getElementById("tray-mail").textContent = unread ? `${unread} unread` : "";
});
on("mail-arrived", (m) => {
  m.read = false;
  if (document.hidden && Notification?.permission === "granted") new Notification(`Mail: ${m.subject}`, { body: m.fromName || m.from });
});
on("climb", ({ rung }) => { if (rung === "cardinality") playEye(); }); // it knows where you are
on("inject", () => win());
on("loss", () => loss());

setInterval(() => {
  if (S.over) return;
  E.tick();
  tickLeaks();
  tickLiving();
  moodTick();
  if (isOpen("mail") || isOpen("scanner") || isOpen("hq")) for (const id of ["mail", "scanner", "hq"]) if (isOpen(id)) rerender(id); // cooldowns count down
  document.getElementById("tray-clock").textContent = displayClock(clock());
  if (!document.getElementById("debug").hidden) debug();
}, 1000);

// ---- dev panel: ` toggles it. The hidden numbers, and what the entity actually did and believes. --------
function debug() {
  const d = document.getElementById("debug");
  const x = entityDebug();
  d.textContent = `rung ${x.rung}   apotheosis ${W.apotheosis}   mood ${mood()}   busy ${!!S.entity.busy}
answers: ${W.divergence.year} / ${W.apotheosis} / class ${W.inferiority.class}   password: ${W.password.join(" ")}
llm $${usage.cost.toFixed(4)} over ${usage.calls} calls   peeks ${S.peeks.length}   reads ${S.reads.length}   downloads ${S.files.length}
trackers: ${Object.values(S.pages).filter((p) => p.trackers.length).map((p) => p.url).concat(S.mail.filter((m) => m.trackers.length).map((m) => m.id)).join(", ") || "-"}
beliefs: ${JSON.stringify(x.beliefs)}
branch rule read by entity: ${S.entity.readBranchRule || "no"}
tricks: ${x.tricks.map((t) => `${t.time} ${t.name}${t.applied ? " (applied)" : ""}`).join(", ") || "-"}

${x.wakes.map((w) => `${w.time} [${w.emotion?.label || "?"}] ${w.reasons[0]}\n   calls: ${w.calls.map((c) => c.tool).join(", ") || "-"}\n   said: ${w.final.slice(0, 160)}`).join("\n") || "(no wakes yet)"}

keys: [ climb a rung   ] wake it now`;
}
addEventListener("keydown", (e) => {
  if (e.target.matches?.("input, textarea")) return;
  if (e.key === "`") { const d = document.getElementById("debug"); d.hidden = !d.hidden; if (!d.hidden) debug(); }
  if (!document.getElementById("debug").hidden) {
    if (e.key === "[") E.climb(E.RUNGS[S.ladder.rung + 1], "debug");
    if (e.key === "]") wake("debug: you look around");
  }
});

await worldReady;
open("mail");
open("hq");

// Dev hook for the playtest driver (dev/playtest.mjs).
window.CC = { saveRun: (r) => saveRun(r), E, S: () => E.S, TR, W, open, forceLeak, wake, usage, win, loss, audioState, play, startRecording, stopRecording, emit: (t, d) => emit(t, d) };

// Save the whole run to the server when it ends (runs/ next to game/). Sets become arrays.
let runSaved = false;
export function saveRun(reason) {
  if (runSaved) return;
  if (!S.mail.some((m) => m.from === W.agent.address) && !S.reads.length && !S.over) return; // nothing happened
  runSaved = true;
  const data = JSON.stringify({ reason, savedAt: new Date().toISOString(), usage, state: S }, (k, v) => (v instanceof Set ? [...v] : v));
  navigator.sendBeacon?.("/api/runlog", new Blob([data], { type: "application/json" }));
}
on("inject", () => setTimeout(() => saveRun("win"), 15000));
addEventListener("pagehide", () => saveRun(S.over || "closed"));
