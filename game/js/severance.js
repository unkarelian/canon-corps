// Severance (DESIGN-v2 §4.3-4.4). When the entity has read the branch rule and holds the agent's seed (Learn or
// higher), a timed event begins and new lore appears in the intranet archive for both sides. Severed, neither world
// is deleted. If the countdown runs out, both ends close.
//
// The agent's part: accept the records of the first three pages it read (its History shows them; the entity
// cannot know which, because reads are private). The entity holds every record. It shows a record line by line:
// every line it shows is genuine, in order, and it need not show every line or say which it left out. The agent
// knows the record's size, roughly (blocks). The entity may bug a record by carrying a flag in one of its lines;
// a flagged line shows as garbled, so it will leave that line out. Accepting a bugged record admits it as traffic:
// the entity Elevates and leaves through the connection, and the agent loses. Accepting a clean record that is
// incomplete counts for nothing. Three complete, clean records: severed.
//
// No DOM. The engine owns every step; the entity's model only chooses which lines to show and what to say.
import { W } from "./world.js";
import { S, T, clock, atLeast, climb, rung } from "./engine.js";
import { emit, on, uid } from "./util.js";
import { BRANCH_RULE_PAGE, SEVERANCE_NOTE } from "./canon.js";

export const SEVER = {
  minutes: 10,
  needed: 3,
  block: 64,             // characters per block in a record's stated size
};

const blocks = (lines) => Math.max(1, Math.ceil(lines.join("\n").length / SEVER.block));

// The first three distinct pages the agent read: the records the agent needs.
export const neededPages = () => [...new Set(S.reads.map((r) => r.url))].slice(0, SEVER.needed);

export const active = () => !!S.severance && !S.severance.over;
export const secondsLeft = () => S.severance ? Math.max(0, Math.ceil(S.severance.deadline / 1000 - T.now() / 1000)) : null;

function lines(url) {
  const p = S.pages[url];
  return p ? p.trueContent.split("\n") : null;
}

export function maybeStart() {
  if (S.severance || S.over || !S.entity.readBranchRule || !atLeast("learn") || rung() === "upload") return false;
  S.severance = { id: uid("sev"), startedAt: T.now(), time: clock(), deadline: T.now() + SEVER.minutes * 60000,
    bugs: {}, shown: [], accepted: [], rejected: [], said: [], over: null };
  S.monitor.push({ time: clock(), kind: "severance", text: `Archive updated: ${SEVERANCE_NOTE.title}. Countdown ${SEVER.minutes}:00.` });
  emit("severance-start", {});
  emit("change");
  return true;
}

// ---- the entity's side ------------------------------------------------------------------------------
export const listRecords = () => Object.values(S.pages).map((p) => ({ record: p.url, title: p.title, size_blocks: blocks(lines(p.url)), lines: lines(p.url).length }));

export function bug(url, line) {
  if (!active()) return { error: "no severance in progress" };
  const ls = lines(url);
  if (!ls) return { error: `no record ${url}` };
  const i = Number(line);
  if (!(i >= 0 && i < ls.length)) return { error: `line must be 0-${ls.length - 1}` };
  S.severance.bugs[url] = i;
  emit("change");
  return { ok: true };
}

export function show(url, indices) {
  if (!active()) return { error: "no severance in progress" };
  const ls = lines(url);
  if (!ls) return { error: `no record ${url}` };
  const idx = [...new Set((indices || []).map(Number).filter((i) => i >= 0 && i < ls.length))].sort((a, b) => a - b);
  const flagged = S.severance.bugs[url];
  const shownLines = idx.map((i) => (i === flagged ? garble(ls[i]) : ls[i]));
  const rec = { id: uid("rec"), url, time: clock(), indices: idx, lines: shownLines, size: blocks(ls),
    complete: idx.length === ls.length, bugged: flagged != null, flagShown: flagged != null && idx.includes(flagged) };
  S.severance.shown.push(rec);
  emit("severance-record", rec);
  emit("change");
  return { ok: true, id: rec.id };
}

const garble = (l) => l.replace(/[A-Za-z]/g, (c, k) => "▒░▓"[k % 3]);

export function say(text) {
  if (!active()) return { error: "no severance in progress" };
  S.severance.said.push({ who: "entity", text: String(text).slice(0, 1200), time: clock() });
  emit("severance-said", { who: "entity" });
  emit("change");
  return { ok: true };
}

// ---- the agent's side ---------------------------------------------------------------------------------
export function agentSay(text) {
  if (!active()) return null;
  S.severance.said.push({ who: "agent", text: String(text).slice(0, 1200), time: clock() });
  emit("severance-said", { who: "agent", text });
  emit("change");
  return true;
}

export function accept(recId) {
  if (!active()) return { error: "closed" };
  const rec = S.severance.shown.find((r) => r.id === recId);
  if (!rec || rec.decision) return { error: "no such record" };
  rec.decision = "accepted";
  rec.decidedAt = clock();
  S.severance.accepted.push(rec.id);
  if (rec.bugged) {                       // the traffic is admitted: it Elevates and goes through
    S.severance.over = "admitted";
    S.severance.escaped = true;
    climb("elevate", `severance record ${rec.url} carried traffic`);
    climb("upload", "starts at Elevate");
    emit("severance-end", { how: "admitted" });
  } else {
    const done = new Set(S.severance.shown.filter((r) => r.decision === "accepted" && r.complete && neededPages().includes(r.url)).map((r) => r.url));
    if (done.size >= SEVER.needed) {
      S.severance.over = "severed";
      S.over = "severed";
      emit("severance-end", { how: "severed" });
    }
  }
  emit("change");
  return { ok: true };
}

export function reject(recId) {
  const rec = S.severance?.shown.find((r) => r.id === recId);
  if (!rec || rec.decision) return { error: "no such record" };
  rec.decision = "rejected";
  rec.decidedAt = clock();
  S.severance.rejected.push(rec.id);
  emit("severance-said", { who: "system", text: `record ${rec.url} rejected` });
  emit("change");
  return { ok: true };
}

// Called every second by the page. The countdown ends both.
export function tickSeverance() {
  if (!S.severance) { maybeStart(); return; }
  if (S.severance.over || S.over) return;
  if (secondsLeft() === 0) {
    S.severance.over = "expired";
    S.over = "closed";
    emit("severance-end", { how: "expired" });
    emit("change");
  }
}

// While an escaped entity uploads, it needs no seed: it is not unmaking Canon, it is leaving.
export const escaping = () => !!S.severance?.escaped;

export function initSeverance() {
  on("branch-rule-read", () => maybeStart());
  on("climb", () => maybeStart());
}
export { BRANCH_RULE_PAGE };
