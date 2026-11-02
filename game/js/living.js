// The town goes on while the agent reads it: forum replies, news items and notices arrive on a timetable, and
// home pages count their visitors. The timetable (world.updates) is written once per town, when the town is
// made (townUpdates in js/living_gen.js; dev/gen_updates.mjs for the pool), so a run costs nothing extra.
//
// Some updates wait for a notice stage: the town notices small wrong things too (mail late, a page that
// changed, a feeling). Nothing in them names the agent, the Corps, or anything the player may not have done.
// Updates never carry seed text, passwords or new addresses; they are checked when they are written.
import { W } from "./world.js";
import { S, clock, mood } from "./engine.js";
import { emit } from "./util.js";

const RANK = { QUIET: 0, STIRRING: 1, WATCHFUL: 2, FIXED: 3, SEARCHING: 4 };
const POST = /^\[([\w.-]+)\] /m;

// ---- runtime ---------------------------------------------------------------------------------------
let t0 = null;
export function tickLiving() {
  if (S.over || !W.updates?.length) return;
  t0 ??= Date.now();
  const mins = (Date.now() - t0) / 60000;
  S.applied ??= new Set();
  W.updates.forEach((u, i) => {
    if (S.applied.has(i) || mins < u.after || RANK[mood()] < RANK[u.stage || "QUIET"]) return;
    const p = S.pages[u.url];
    S.applied.add(i);
    if (!p) return;
    const add = (text) => {
      if (u.kind === "post") return `${text.replace(/\s+$/, "")}\n[${u.handle}] ${u.text}`;
      // news and notices go in after the page's heading block, newest first, with the local time
      const item = `${u.kind === "news" ? "LATEST" : "NOTICE"} (${clock()}): ${u.text}`;
      const k = text.indexOf("\n\n");
      return k < 0 ? `${text}\n\n${item}` : `${text.slice(0, k)}\n\n${item}${text.slice(k)}`;
    };
    p.content = add(p.content);
    p.trueContent = add(p.trueContent ?? p.content);
    emit("page-updated", { url: u.url });
  });
}

// A home page's visitor counter: a number of its own, creeping up through the evening, one more per visit.
export function visitors(url) {
  let h = 7;
  for (const c of url) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const base = 1200 + (h % 8000), mins = t0 ? (Date.now() - t0) / 60000 : 0;
  S.visits ??= {};
  S.visits[url] = (S.visits[url] || 0) + 1;
  return String(base + Math.floor(mins * (0.2 + (h % 7) / 10)) + S.visits[url]).padStart(6, "0");
}

