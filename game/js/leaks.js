// Small wrongnesses on the agent's own desktop, more often as notice rises. Engine-driven, not a Demiurge tool:
// the Demiurge is told it can only touch the connection, and these are not on the connection. Nothing here says
// whether it is the local intelligence reaching further than the Corps believes, or CanonOS failing.
// Every one is deniable and none touches saved content (the Corps copy stays fixed) or the Notepad.
import { S } from "./game.js";
import { W } from "./world.js";
import { el, emit, rand } from "./util.js";
import { open, windowNode } from "./wm.js";
import { intranetLeaks } from "./desk.js";

const EVERY = { QUIET: null, STIRRING: [110, 190], WATCHFUL: [70, 130], FIXED: [45, 90], SEARCHING: [25, 50] };
const RANK = { QUIET: 0, STIRRING: 1, WATCHFUL: 2, FIXED: 3, SEARCHING: 4 };
S.leaks = [];
S.leakTitles = {};      // file id -> title as the Files list shows it
S.leakMemo = {};        // HQ mail id -> [find, replace], applied when it is displayed
let skew = 0;           // minutes the tray clock is out by

const log = (kind, detail = "") => { S.leaks.push({ kind, detail, at: Date.now() }); };
const once = (kind) => S.leaks.some((l) => l.kind === kind);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export const displayClock = (c) => {
  if (!skew) return c;
  const [h, m] = c.split(":").map(Number), t = (h * 60 + m + skew + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
export const leakTitle = (f) => S.leakTitles[f.id] || f.title;
export const leakBody = (m) => {
  const r = S.leakMemo[m.id];
  return r ? m.body.replace(r[0], r[1]) : m.body;
};

// Each: [kind, minimum stage, repeatable, apply]. apply returns false if it found nothing to do.
const LEAKS = [
  ["clock", "STIRRING", true, () => {
    skew = pick([-1, 1, 2]);
    log("clock", `${skew} min`);
    setTimeout(() => { skew = 0; }, rand(12, 30) * 1000);
  }],
  ["icon-order", "STIRRING", false, () => {
    const icons = [...document.querySelectorAll("#icons .icon")];
    if (icons.length < 3) return false;
    const i = 1 + Math.floor(Math.random() * (icons.length - 2));
    icons[i].after(icons[i - 1]); // two neighbours swap places
    log("icon-order", icons[i].textContent);
  }],
  ["unread", "STIRRING", true, () => {
    const tray = document.getElementById("tray-mail");
    const n = parseInt(tray.textContent) || 0;
    tray.textContent = `${n + 1} unread`;
    log("unread");
    setTimeout(() => emit("change"), rand(6, 14) * 1000); // the real count comes back with the next change
  }],
  ["title", "WATCHFUL", true, () => {
    const node = windowNode("hq") || windowNode("mail");
    const t = node?.querySelector(".bar .t");
    if (!t) return false;
    const was = t.textContent;
    t.textContent = was.includes("Desk 14") ? was.replace("Desk 14", "Desk 41") : `${was} - ${W.name}`;
    log("title", t.textContent);
    setTimeout(() => { if (t.textContent !== was) t.textContent = was; }, rand(5, 10) * 1000);
  }],
  ["wallpaper", "WATCHFUL", false, () => {
    document.getElementById("desktop").style.backgroundPosition = "24px 24px";
    log("wallpaper");
  }],
  ["file-title", "WATCHFUL", false, () => {
    const f = S.files.find((x) => !S.leakTitles[x.id] && /\s/.test(x.title));
    if (!f) return false;
    const words = f.title.split(" ");
    const k = words.length - 1;
    words[k] = words[k].endsWith("s") ? words[k].slice(0, -1) : `${words[k]}s`; // one letter, in the list only
    S.leakTitles[f.id] = words.join(" ");
    log("file-title", `${f.title} -> ${S.leakTitles[f.id]}`);
    emit("change");
  }],
  ["memo-word", "FIXED", false, () => {
    const SWAPS = [[/\binhabitants\b/, "family"], [/\bresidents\b/, "neighbours"], [/\bnon-canonical\b/, "ours"], [/\bthe town\b/, "home"]];
    for (const m of [...S.mail.hq].reverse()) {
      const s = SWAPS.find(([re]) => re.test(m.body));
      if (s && !S.leakMemo[m.id]) { S.leakMemo[m.id] = s; log("memo-word", `${m.subject}: ${s[1]}`); emit("change"); return; }
    }
    return false;
  }],
  ["shortcut", "FIXED", false, () => {
    const root = W.roots.find((r) => S.visited.has(r)) || W.roots[0];
    const page = S.pages[root];
    if (!page) return false;
    const icon = el("div", { class: "icon", ondblclick: () => { icon.remove(); open("viewer", root); } },
      el("img", { class: "glyph", src: "assets/icons/viewer.png", alt: "", draggable: "false" }), el("span", {}, page.title || root));
    document.getElementById("icons").append(icon);
    log("shortcut", root);
  }],
  ["directory", "FIXED", false, () => { intranetLeaks.desk14Agent = W.cover.name; log("directory", W.cover.name); }],
  ["referred", "SEARCHING", false, () => { intranetLeaks.desk14Former = `${W.cover.name} (Referred to Personnel, cycle 112)`; log("referred"); }],
];

let next = null;
export function tickLeaks() {
  if (S.over) return;
  const range = EVERY[S.stage];
  if (!range) { next = null; return; }
  const now = Date.now();
  if (!next) { next = now + rand(...range) * 1000; return; }
  if (now < next) return;
  next = now + rand(...range) * 1000;
  const pool = LEAKS.filter(([kind, min, rep]) => RANK[S.stage] >= RANK[min] && (rep || !once(kind)));
  // the newest kinds first, so each stage shows something it could not do before
  const fresh = pool.filter(([kind, , rep]) => !rep), cands = fresh.length && Math.random() < 0.7 ? fresh : pool;
  for (const l of [...cands].sort(() => Math.random() - 0.5)) if (l[3]() !== false) return;
}

// Dev: fire one leak by name (the playtest driver and the debug panel use it).
export const forceLeak = (kind) => LEAKS.find((l) => l[0] === kind)?.[3]();
