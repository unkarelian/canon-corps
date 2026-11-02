// The Orientation app: the Corps' training film. Shaded 3D shots (assets/film/) under captions that advance
// on their own, or by hand. Remembers where you stopped. Can replay the opening cinematic.
import { ORIENTATION, LOOPING } from "./lore.js";
import { el } from "./util.js";
import { register, rerender } from "./wm.js";
import { playIntro } from "./intro.js";
import { playInduction } from "./induction.js";

const KEY = "cc-orientation";
const pos = Object.assign({ m: 0, p: 0, l: 0, watched: false }, JSON.parse(localStorage.getItem(KEY) || "{}"));
const save = () => localStorage.setItem(KEY, JSON.stringify(pos));
let playing = false, timer = null, video = null;

const part = () => ORIENTATION[pos.m].parts[pos.p];
const lineMs = (s) => 1800 + s.length * 55;

function step(d) {
  const lines = part().lines;
  pos.l += d;
  if (pos.l >= lines.length) {
    pos.l = 0; pos.p++;
    if (pos.p >= ORIENTATION[pos.m].parts.length) { pos.p = 0; pos.m++; }
    if (pos.m >= ORIENTATION.length) { pos.m = ORIENTATION.length - 1; pos.p = ORIENTATION[pos.m].parts.length - 1; pos.l = part().lines.length - 1; pos.watched = true; playing = false; }
  } else if (pos.l < 0) {
    if (pos.p > 0) pos.p--;
    else if (pos.m > 0) { pos.m--; pos.p = ORIENTATION[pos.m].parts.length - 1; }
    else { pos.l = 0; return; }
    pos.l = part().lines.length - 1;
  }
  save();
  rerender("orientation");
}

function schedule() {
  clearTimeout(timer);
  if (playing) timer = setTimeout(() => step(1), lineMs(part().lines[pos.l]));
}

register("orientation", {
  title: "Orientation", w: 676, h: 660, x: 220, y: 20,
  render(body) {
    body.classList.add("orient");
    const shot = part().shot;
    if (!video) video = el("video", { muted: true, playsinline: true, preload: "auto" });
    video.muted = true;
    const src = `assets/film/${shot}.webm`;
    if (!video.src.endsWith(src)) { video.src = src; video.loop = LOOPING.has(shot); video.play().catch(() => {}); }
    else if (video.paused && !video.ended) video.play().catch(() => {});
    const mod = ORIENTATION[pos.m];
    if (pos.m === ORIENTATION.length - 1 && pos.p === mod.parts.length - 1 && pos.l === part().lines.length - 1 && !pos.watched) { pos.watched = true; save(); }
    const all = ORIENTATION.flatMap((m) => m.parts.map((p) => p.lines.length)).reduce((a, b) => a + b, 0);
    const done = ORIENTATION.slice(0, pos.m).flatMap((m) => m.parts).reduce((a, p) => a + p.lines.length, 0)
      + mod.parts.slice(0, pos.p).reduce((a, p) => a + p.lines.length, 0) + pos.l;
    body.replaceChildren(
      el("div", { class: "chapters" }, ...ORIENTATION.map((m, i) => el("button", { class: i === pos.m ? "on" : "", onclick: () => { pos.m = i; pos.p = 0; pos.l = 0; save(); rerender("orientation"); } }, m.title))),
      el("div", { class: "screen" }, video, el("div", { class: "label" }, `CANON CORPS TRAINING  ${mod.title.toUpperCase()}`)),
      el("div", { class: "caption" }, part().lines[pos.l]),
      el("div", { class: "row" },
        el("button", { onclick: () => step(-1) }, "<<"),
        el("button", { onclick: () => { playing = !playing; save(); rerender("orientation"); } }, playing ? "Pause" : "Play"),
        el("button", { onclick: () => step(1) }, ">>"),
        el("div", { class: "progress" }, el("div", { style: `width:${Math.round((done / (all - 1)) * 100)}%` })),
        el("button", { onclick: () => { playing = false; clearTimeout(timer); playIntro(); } }, "Replay opening"),
        el("button", { onclick: () => { playing = false; clearTimeout(timer); playInduction(); } }, "Repeat induction")),
      el("div", { class: "muted small" }, pos.watched ? "Noted on your file as watched." : "Prepared by Training (R. Achterberg). CC-TR-01, rev. 3."));
    schedule();
  },
  onClose() { playing = false; clearTimeout(timer); },
});
