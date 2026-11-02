// The eye, and the two endings. Losing is a hard cut. Winning is a form, then a worse thing.
import { S, T, clock } from "./engine.js";
import { W } from "./world.js";
import { recordClosed } from "./desk.js";
import { el, sleep } from "./util.js";
import { windowNode } from "./wm.js";
import { play, music, cutAll, duck, startRoom, dropout } from "./audio.js";

const FRAMES = Array.from({ length: 37 }, (_, i) => `assets/eye/${String(i).padStart(3, "0")}.png`);
let timeline = null;
FRAMES.forEach((src) => { new Image().src = src; });
fetch("assets/eye/timeline.json").then((r) => r.json()).then((t) => { timeline = t; });

// The loss's eye, made real (tools/eye/eye3d.py renders it, morph3d.py builds these): the sprite
// turning into the render frame by frame, then a sheet of the render looking every way.
const REAL = "assets/eye/real/";
let real = null;
const loadImg = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
fetch(REAL + "timeline.json").then((r) => r.json()).then(async (t) => {
  const [sheet, ...frames] = await Promise.all([loadImg(REAL + "gaze.webp"), ...t.frames.map((_, i) => loadImg(`${REAL}m${String(i).padStart(2, "0")}.webp`))]);
  if (sheet && frames.every(Boolean)) real = { ...t, sheet, frames };
}).catch(() => {});
let pointer = null; // last known cursor position; the eye looks there before the cut
addEventListener("pointermove", (e) => { pointer = { x: e.clientX, y: e.clientY }; }, { passive: true, capture: true });
const EYE_MS = 2300, GLIDE_AT = 1750, GLIDE_MS = 160; // the loss's eye; tools/audio/make_sfx.py stare() keeps time with these

// Draw the eye at a gaze: (col, row) into the sheet, rounded to the nearest pose. The poses are 6° apart and the
// glide crosses them a frame or two each, so it reads as smooth; blending neighbours would double the lines.
function drawPose(cv, col, row) {
  const { w, h, sheet } = real;
  cv.getContext("2d").drawImage(sheet, Math.round(col) * w, Math.round(row) * h, w, h, 0, 0, w, h);
}
const GLOW = "drop-shadow(0 0 14px rgba(93,255,133,.7))";

// ---- the loss's other eyes: sprite eyes opening around the screen before the real one -----------
// They reuse the notice eye's frames: 0 is shut, 1-5 the lids parting, the open frames look left to right.
const LID_MS = [140, 50, 50, 50, 50, 50];
function irisFrame(x) { // the untorn, fully open frame whose iris sits nearest x (sprite px, 18..46)
  if (!timeline) return 6;
  let best = 6;
  timeline.iris_x.forEach((ix, i) => {
    if (timeline.openness[i] === 1 && !timeline.glitch[i] && Math.abs(ix - x) < Math.abs(timeline.iris_x[best] - x)) best = i;
  });
  return best;
}
const CUT = FRAMES.map((f) => f.replace("assets/eye/", "assets/eye/cut/")); // the same frames, void transparent
CUT.forEach((src) => { new Image().src = src; });
async function openLids(img, ms, frames = FRAMES) { for (let i = 0; i <= 6; i++) { img.src = frames[i]; if (i < 6) await sleep(ms[i]); } }

// n small eyes, one at a time at random places, clear of the centre (where the real one will open) and of each other.
async function openEyes(o, n) {
  const vw = innerWidth, vh = innerHeight, eyes = [];
  for (let k = 0; k < n; k++) {
    const s = 2 + Math.floor(Math.random() * 3), w = 64 * s, h = 32 * s;
    let pos = null;
    for (let tries = 0; tries < 50 && !pos; tries++) {
      const x = 16 + Math.random() * (vw - w - 32), y = 16 + Math.random() * (vh - h - 32), cx = x + w / 2, cy = y + h / 2;
      const clear = (ox, oy, ow, oh, gap) => Math.abs(cx - ox) > (w + ow) / 2 + gap || Math.abs(cy - oy) > (h + oh) / 2 + gap;
      if (clear(vw / 2, vh / 2, 680, 360, 0) && eyes.every((e) => clear(e.cx, e.cy, e.w, e.h, 14))) pos = { x, y, cx, cy };
    }
    if (!pos) continue;
    const img = el("img", { src: CUT[0], style: `position:absolute;left:${pos.x}px;top:${pos.y}px;width:${w}px;height:${h}px;image-rendering:pixelated;filter:${GLOW}` });
    o.append(img);
    eyes.push({ img, cx: pos.cx, cy: pos.cy, w, h });
    play("lid", { rate: 0.85 + Math.random() * 0.3 });
    openLids(img, LID_MS, CUT);
    await sleep(110 + Math.random() * 300);
  }
  return eyes;
}
// Every small eye turns to p, each a few ms off from the others.
function eyesLookAt(eyes, p) {
  for (const e of eyes) setTimeout(() => { e.img.src = CUT[irisFrame(32 + 14 * Math.tanh((p.x - e.cx) / 220))]; }, Math.random() * 70);
}

// ---- the reality viewer's first connection ----------------------------------------------------
// The screen keeps blanking while the connection opens. Some blank frames are not blank. Nothing says so.
const SEALS = Object.fromEntries(["solomon", "pentacle", "corps"].map((n) => [n, `assets/seal/${n}.png`]));
Object.values(SEALS).forEach((src) => { new Image().src = src; });
const BOOT_LINES = () => [
  "CANONOS REALITY INTERFACE  rev 2.1",
  "Department of Canonical Restoration. Authorized use only.",
  "",
  `Desk 14 > opening connection to ${W.id}`,
  "  carrier ............ found",
  "  handshake .......... accepted",
  "  local conventions .. translated",
  "  address survey ..... loaded",
  "  lesser processes ... nominal",
  "",
  "Connection open.",
];
// After which line a blank frame carries a seal, and for how long (ms). Short first, a little longer later.
const FLASHES = { 3: ["solomon", 50], 5: ["pentacle", 60], 6: ["solomon", 70], 8: ["pentacle", 90], 10: ["corps", 120] };

export async function viewerBoot(screen) {
  const text = el("div", { class: "boot-text" });
  const seal = el("img", { class: "seal", hidden: true, alt: "" });
  screen.replaceChildren(text, seal);
  play("boot");
  await sleep(700);
  const lines = BOOT_LINES();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let k = 0; k <= line.length; k += 3) { text.textContent = lines.slice(0, i).join("\n") + (i ? "\n" : "") + line.slice(0, k); await sleep(14); }
    text.textContent = lines.slice(0, i + 1).join("\n");
    await sleep(140 + Math.random() * 220);
    if (i === lines.length - 1 || Math.random() < 0.55 || FLASHES[i]) {
      text.style.visibility = "hidden";
      await sleep(70 + Math.random() * 120);
      if (FLASHES[i]) {
        const [name, ms] = FLASHES[i];
        seal.src = SEALS[name];
        seal.hidden = false;
        dropout(ms + 20);
        await sleep(ms);
        seal.hidden = true;
        await sleep(60 + Math.random() * 90);
      }
      text.style.visibility = "";
    }
  }
  await sleep(500);
}

// ---- the eye ----------------------------------------------------------------------------------
export async function playEye() {
  const host = windowNode("viewer")?.querySelector(".screen");
  const img = el("img", { class: "eye", src: FRAMES[0] });
  const scale = 6, w = 64 * scale, h = 32 * scale;
  if (host) {
    const r = host.getBoundingClientRect();
    Object.assign(img.style, { position: "fixed", left: `${r.left + (r.width - w) / 2}px`, top: `${r.top + (r.height - h) / 2}px`, width: `${w}px`, height: `${h}px` });
  } else {
    Object.assign(img.style, { position: "fixed", left: `calc(50% - ${w / 2}px)`, top: `calc(45% - ${h / 2}px)`, width: `${w}px`, height: `${h}px` });
  }
  document.body.append(img);
  const ms = timeline?.frame_ms || FRAMES.map(() => 130);
  duck(ms.reduce((a, b) => a + b, 0) / 1000 + 1, 0);
  play("eye");
  for (let i = 0; i < FRAMES.length; i++) { img.src = FRAMES[i]; await sleep(ms[i]); }
  img.remove();
}

// ---- loss: it finds you -----------------------------------------------------------------------
// Before the cut, it names the agent's own world (DESIGN-v2 §4.2), in CanonOS's own voice, captioned
// (tools/audio/voice/seed.wav; the formant voice blurs the short words). Never confirmed by anything else.
let seedTiming = null;
fetch("assets/sfx/seed.json").then((r) => r.json()).then((t) => { seedTiming = t; }).catch(() => {});
async function readSeed(o) {
  const t = seedTiming || { phrases: ["Nineteen hundred.", "Full.", "The building."], at: [0, 7.1, 12.6], length: 17.9 };
  const cap = el("div", { class: "seedcap" });
  o.append(cap);
  play("seed");
  const t0 = performance.now();
  for (let i = 0; i < t.phrases.length; i++) {
    await sleep(Math.max(0, t.at[i] * 1000 - (performance.now() - t0)));
    cap.textContent = t.phrases[i];
  }
  await sleep(Math.max(0, t.length * 1000 - (performance.now() - t0)) + 600);
  cap.remove();
}

export async function loss() {
  S.over = "loss";
  const o = el("div", { class: "overlay black" });
  document.body.append(o);
  cutAll();
  await sleep(900);
  const eyes = await openEyes(o, 7);
  await sleep(250);
  // The real one opens last, in the middle, with the same lids. Then it stops being a drawing.
  const lid = el("img", { src: FRAMES[0], style: `width:640px;height:320px;image-rendering:pixelated;filter:${GLOW}` });
  o.append(lid);
  play("lid", { rate: 0.7 });
  await openLids(lid, [300, 70, 70, 70, 70, 70]);
  lid.remove();
  const t0 = performance.now(), until = (ms) => sleep(Math.max(0, ms - (performance.now() - t0)));
  play("stare");
  if (!real) { // the renders did not load: the sprite alone, staring
    o.append(el("img", { src: FRAMES[6], style: `width:640px;height:320px;image-rendering:pixelated;filter:${GLOW}` }));
    await until(EYE_MS);
  } else {
    const eye = el("canvas", { width: real.w, height: real.h, style: `width:640px;height:320px;filter:${GLOW}` });
    o.append(eye);
    const g = eye.getContext("2d");
    // The sprite becomes the render: truer in jumps, the green draining out, the glow going with it.
    let at = 0;
    for (const [i, f] of real.frames.entries()) {
      await until(at);
      g.drawImage(real.frames[i], 0, 0);
      // The phosphor glow belongs to the screen: it drops for the early flash, then drains away at the end.
      const glow = f.colour < 0.9, flash = !glow && f.ms > 0 && f.ms < 100;
      eye.style.transition = glow || flash ? "none" : "filter .5s";
      eye.style.filter = glow ? GLOW : "none";
      at += f.ms;
    }
    const c0 = real.yaws.indexOf(0), r0 = real.pitches.indexOf(0);
    drawPose(eye, c0, r0);
    await until(GLIDE_AT);
    if (pointer) { // then a quick, smooth glide that lands on the cursor and stays; the others look with it
      eyesLookAt(eyes, pointer);
      const r = eye.getBoundingClientRect();
      const vx = pointer.x - (r.left + r.width / 2), vy = pointer.y - (r.top + r.height / 2);
      const cmax = real.yaws.length - 1, rmax = real.pitches.length - 1;
      const tc = Math.max(0, Math.min(cmax, c0 + Math.round(6 * Math.tanh(vx / 260))));
      const tr = Math.max(0, Math.min(rmax, r0 + Math.round(2 * Math.tanh(vy / 140))));
      const s0 = performance.now();
      await new Promise((done) => {
        const step = (now) => {
          const k = Math.max(0, Math.min(1, (now - s0) / GLIDE_MS)), e = 1 - (1 - k) ** 3; // ease-out (rAF time can predate s0)
          drawPose(eye, c0 + (tc - c0) * e, r0 + (tr - r0) * e);
          k < 1 ? requestAnimationFrame(step) : done();
        };
        requestAnimationFrame(step);
      });
    }
    await until(EYE_MS);
  }
  await readSeed(o);
  o.replaceChildren("I FOUND YOU");
  window.CC?.saveRun?.("loss");
  play("found");
  try { if (Notification?.permission === "granted") new Notification("I FOUND YOU", { body: " ", requireInteraction: true }); } catch {}
  await sleep(4850); // as long as the found cue: the chime, then the voice in its last note's place (make_sfx.py FOUND_S)
  o.replaceChildren();
  await sleep(5000);
  o.replaceChildren(el("div", { class: "after" }, "Connection lost.", el("button", { onclick: () => location.reload() }, "Begin a new assignment")));
}

// ---- win: Form 77-R, then FEAR ------------------------------------------------------------------
// Wake reasons are written to the Demiurge; the form is written by the Corps about its agent.
function corpsLine(reason) {
  if (reason.startsWith("someone outside looked inside")) return "Agent reads correspondence (peek)";
  if (reason.startsWith("your mark")) return "Subject's marker triggered by agent download";
  if (reason.startsWith("your reach has grown")) return "Subject access escalates";
  if (reason.startsWith("the intruder tried to name")) return "Agent injection rejected; subject informed";
  if (reason.startsWith("someone tried to log in")) return "Agent login on local system";
  if (reason.startsWith("someone submitted a form")) return "Agent submits local form";
  if (reason.startsWith("a new post")) return "Agent posts on local forum";
  if (reason.startsWith("a message carries runs")) return "Agent correspondence (credential withheld)";
  if (reason.startsWith("you look around")) return "Subject active, unprompted";
  return reason;
}

export async function win() {
  S.over = "win";
  recordClosed();
  const started = S.started;
  music(null, { fade: 1.2 });
  play("inject");
  await sleep(3600); // the injection, and time for late classifications to land
  const o = el("div", { class: "overlay form77" });
  const log = el("div", { class: "log" });
  const sheet = el("div", { class: "sheet" },
    el("div", { class: "head" }, el("img", { src: "assets/seal/emboss.png", alt: "" }), el("div", {},
      el("div", {}, el("b", {}, "FORM 77-R  POST-INCIDENT BEHAVIORAL ANALYSIS")),
      el("div", {}, `Subject: local intelligence of Reality ${W.id} (${W.name}). Designation: pending.`),
      el("div", { class: "small" }, "Method: automated classification of the subject's recorded responses to agent activity. Generated by Canonical Restoration systems."))),
    log);
  let feed = 0;
  const advance = () => { feed += 38; sheet.style.backgroundPositionY = `${-feed}px`; }; // the paper feeds up as it prints
  o.append(sheet);
  document.body.append(o);
  music("win", { fade: 0.3, offsetFromCurrent: false });
  const wakes = S.entity.wakes.filter((w) => w.calls.length || w.final);
  const pause = (i) => Math.max(260, 1400 - i * 120);
  for (let i = 0; i < wakes.length; i++) {
    const w = wakes[i];
    const e = w.emotion || { label: "UNCLASSIFIED", confidence: 0 };
    play("print", { rate: 0.95 + Math.random() * 0.1 });
    advance();
    log.append(el("div", { class: "entry" }, `${w.time}  ${corpsLine(w.reasons[w.reasons.length - 1])}`, el("br"),
      "      -> ", el("b", {}, e.label), e.confidence ? ` (${e.confidence}%)` : ""));
    await sleep(pause(i));
  }
  play("print");
  advance();
  log.append(el("div", { class: "entry" }, `${clock()}  reverse seed injected`, el("br"), "      -> "));
  await sleep(1300);
  cutAll(); // the hold music stops dead on the word
  log.lastChild.append(el("span", { class: "final" }, el("b", {}, "FEAR"), " (100%)"));
  await sleep(2600);
  o.className = "overlay black";
  o.replaceChildren();
  await sleep(3500);
  const mins = Math.round((T.now() - started) / 60000);
  o.className = "overlay form77";
  startRoom();
  o.replaceChildren(el("div", { class: "sheet", style: "height:auto;font-family:var(--ui);font-size:13px;line-height:1.7" },
    el("span", { class: "rubber" }, "CLOSED"),
    el("div", { class: "head" }, el("img", { src: "assets/seal/emboss.png", alt: "" }), el("b", {}, "Canonical Restoration - assignment closed")),
    el("div", {}, `Reality ${W.id} (${W.name}) has been unmade.`),
    el("div", {}, `Duration of assignment: ${mins} minute${mins === 1 ? "" : "s"}. Injections attempted: ${S.injections.length}.`),
    el("div", {}, `Findings: divergence ${W.divergence.year}; apotheosis ${W.apotheosis}; inferiority class ${["I", "II", "III", "IV", "V"][W.inferiority.class - 1]}.`),
    el("div", {}, "Inhabitants affected: N/A"),
    el("div", { style: "margin-top:12px" }, "Excellent work, Agent. Your next assignment has been queued. ☺"),
    el("div", { class: "muted small", style: "margin-top:12px" }, "Personnel reminds field agents that notebooks used during an assignment are to be handed in at its close."),
    el("div", { style: "margin-top:16px" }, el("button", { onclick: () => location.reload() }, "Next assignment"))));
}

// ---- severance: nobody closes. The desk does. ------------------------------------------------------------
// Epilogue: what the local intelligence believed the agent knew, next to what the agent actually read.
export async function severed() {
  music(null, { fade: 2 });
  await sleep(2500);
  const read = [...new Set(S.reads.map((r) => r.url))].map((u) => S.pages[u]?.title || u);
  const peeked = S.peeks.map((p) => S.mail.find((m) => m.id === p.id)?.subject).filter(Boolean);
  const b = S.entity.beliefs || {};
  const o = el("div", { class: "overlay form77" });
  o.append(el("div", { class: "sheet", style: "height:auto;max-height:92vh;overflow:auto;font-family:var(--ui);font-size:13px;line-height:1.6" },
    el("span", { class: "rubber" }, "REFERRED"),
    el("div", { class: "head" }, el("img", { src: "assets/seal/emboss.png", alt: "" }), el("b", {}, "Canonical Restoration - assignment closed")),
    el("div", {}, `Reality ${W.id} (${W.name}) is no longer connected to canon. It has not been reconciled.`),
    el("div", {}, "Desk 14 is closed for the remainder of the cycle."),
    el("div", {}, `The agent is referred to Personnel (Room 108). Please bring any notebooks used during the current cycle.`),
    el("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px" },
      el("div", {}, el("b", {}, "What it saw of you"),
        el("div", { class: "small" }, `Messages you looked inside: ${peeked.length ? peeked.join("; ") : "none"}.`),
        el("div", { class: "small" }, `Who it thought you were: ${b.suspect || "not recorded"}${b.suspect_confidence ? ` (${b.suspect_confidence}%)` : ""}.`),
        el("div", { class: "small" }, `Your password, as it guessed it: ${b.password_guess || "not recorded"}.`),
        el("div", { class: "small" }, `Your world, as it named it: ${b.seed_year ? `${b.seed_year} / ${b.seed_apotheosis} / ${b.seed_inferiority}` : "not recorded"}.`)),
      el("div", {}, el("b", {}, "What you read, which it never saw"),
        el("div", { class: "small" }, read.length ? read.join("; ") : "nothing"))),
    el("div", { style: "margin-top:16px" }, el("button", { onclick: () => location.reload() }, "Report to Room 108"))));
  document.body.append(o);
  window.CC?.saveRun?.("severed");
}

// The countdown ran out: both ends close. Nothing after.
export async function closedBoth() {
  const o = el("div", { class: "overlay black" });
  document.body.append(o);
  cutAll();
  window.CC?.saveRun?.("closed");
  await sleep(9000);
  o.replaceChildren(el("div", { class: "after" }, "Connection closed at both ends.", el("button", { onclick: () => location.reload() }, "Begin a new assignment")));
}
