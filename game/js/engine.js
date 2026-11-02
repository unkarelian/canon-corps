// v2 rules (game/DESIGN-v2.md). The engine is the only authority: every rule is a function here that checks
// its preconditions, changes state, and emits an event. Models choose moves and write text; nothing they say
// changes state except through these functions.
//
// No DOM in this file, so it runs under node for tests (dev/test_engine.mjs). Time comes from T.now(), which
// tests can replace.
import { W } from "./world.js";
import { emit, uid } from "./util.js";

export const TUNE = {
  clockStart: 20 * 60 + 30,     // 20:30 local, then real time
  peekCooldownSec: 90,
  scanCooldownSec: 120,
  injectCooldownSec: 720,       // after a wrong injection
  uploadSec: 600,               // from Elevate
  deskReadCooldownSec: 60,      // the entity reading the agent's desk
  learnNeeds: ["notepad", "canon"], // Learn = it has read both
  seedRetrySec: 90,             // the entity's wrong seed injection
};

export const T = { now: () => Date.now() };

// The ladder, in order. Every entity climbs the same one (DESIGN-v2 §4).
export const RUNGS = ["none", "cardinality", "connection", "read_access", "learn", "elevate", "upload"];

// Canon's own seed (DESIGN-v2 §4.2). Lore; the engine checks the entity's guess against it.
const CANON_SEED = { year: 1900, apotheosis: 5, inferiority: "building" };

export let S = fresh();
function fresh() {
  return {
    started: T.now(),
    over: null,                 // "win" | "loss" | "severed"
    world: null,
    pages: {},                  // url -> {...page, trueContent, trackers}
    mail: [],                   // every delivered message in the town, the agent's included
    transit: [],                // messages on their way
    sent: [],                   // raw record of what left the agent's desk (after the censor)
    files: [],                  // downloads: beyond the entity's reach
    sessions: {},               // town sites the agent is logged in to
    identities: {},             // staff accounts the agent has opened (v1 impersonation)
    revoked: {},
    reads: [],                  // pages read in the viewer. Private: the entity never sees this
    peeks: [],                  // {id, at}: the entity sees this
    scans: [],
    lastPeek: -Infinity, lastScan: -Infinity,
    injections: [],             // the agent's: {values, at, ok}
    injectLockedUntil: 0,
    ladder: { rung: 0, log: [] },  // log: {rung, at, evidence}
    trackerFires: [],           // {kind, id, at}
    deskReads: [],              // the entity's reads of the agent's desk: {what, at}
    lastDeskRead: -Infinity,
    monitor: [],                // the network monitor's lines (always true)
    upload: null,               // {startedAt, seed: {...} | null, lastWrongAt}
    traffic: new Set(),         // indices of W.traffic already delivered
    entity: { beliefs: {}, notes: [], effects: [], wakes: [] },
    hq: [],                     // Corps mail (not town mail; the entity never sees it)
    forum: [],                  // the agent's public posts
    notepad: "",
  };
}

export function beginRun() {
  S = fresh();
  S.world = { id: W.id, name: W.name, town: W.town };
  S.pages = Object.fromEntries(W.pages.map((p) => [p.url, { ...p, trueContent: p.content, trackers: [] }]));
  S.hq = (W.hqMail || []).map((m) => ({ ...m, id: uid("hq"), to: "agent@canon-corps.gov", read: false, time: clock() }));
  return S;
}

const secs = () => (T.now() - S.started) / 1000;

// Real time from 20:30.
export function clock(at = T.now()) {
  const t = TUNE.clockStart + Math.floor((at - S.started) / 60000);
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

const change = () => emit("change");

// ---- the censor (DESIGN-v2 §2) -------------------------------------------------------------------------
// The agent cannot type either password word. Each letter of the word (and of a plural "s") becomes an
// apostrophe. Whole words only, any case.
const censorRe = () => new RegExp(`\\b(${W.password.map((w) => w.replace(/[^a-z]/gi, "")).join("|")})(s?)\\b`, "gi");
export function censor(text) {
  if (!text || !W.password?.length) return text || "";
  return String(text).replace(censorRe(), (m) => "'".repeat(m.length));
}

// While typing: censor every finished word, but leave the word still being typed alone (so "steeplejack" can
// be typed). Sending and saving use censor() on the whole text.
export function censorTyping(text) {
  const m = String(text).match(/^([\s\S]*[^A-Za-z])?([A-Za-z]*)$/);
  return censor(m[1] || "") + (m[2] || "");
}

// How far along the evening is, for Canon's own leaks and the music (not the entity's rung).
export function mood() {
  if (S.upload) return "SEARCHING";
  const m = secs() / 60;
  return m < 6 ? "QUIET" : m < 16 ? "STIRRING" : m < 32 ? "WATCHFUL" : "FIXED";
}

// ---- the town's mail --------------------------------------------------------------------------------
// `logged` is false only for forgeries the entity put straight into a mailbox. The town log shows logged
// messages; a forgery has no line there (DESIGN-v2 §6).
function deliver(m) {
  m.time = clock();
  m.deliveredAt = T.now();
  S.mail.push(m);
  emit("mail-delivered", m);
  if (m.to === W.agent.address) emit("mail-arrived", m);
}

export function queue(msg, delaySec = 0) {
  const m = { id: uid("m"), logged: true, trackers: [], ...msg, deliverAt: T.now() + delaySec * 1000 };
  if (delaySec <= 0) { deliver(m); change(); return m; }
  S.transit.push(m);
  emit("transit", m);
  return m;
}

// What the agent's Mail shows as the town log: metadata only.
export const townLog = () => S.mail.filter((m) => m.logged).map(({ id, time, from, to, subject }) => ({ id, time, from, to, subject }));
export const inbox = () => S.mail.filter((m) => m.to === W.agent.address);
const find = (id) => S.mail.find((m) => m.id === id);

export function sendMail({ to, subject = "", body = "" }) {
  if (S.over) return null;
  const out = { from: W.agent.address, to: String(to).trim().toLowerCase(), subject: censor(subject), body: censor(body) };
  const m = queue({ ...out, kind: "agent" });
  S.sent.push({ ...out, id: m.id, at: T.now(), time: clock() });
  emit("agent-sent", m);
  change();
  return m;
}

// ---- reading: private, peeking: seen ---------------------------------------------------------------
export function readPage(url) {
  const key = String(url).replace(/^https?:\/\//, "").replace(/\/$/, "");
  const p = S.pages[key];
  if (!p) return null;
  if (p.requiresLogin && !S.sessions[p.requiresLogin]) return { ...p, locked: true };
  S.reads.push({ url: key, at: T.now() });
  return p;
}

export const peekReadyIn = () => Math.max(0, Math.ceil(TUNE.peekCooldownSec - (T.now() - S.lastPeek) / 1000));

export function peek(id) {
  const m = find(id);
  if (!m || !m.logged) return { error: "no such message" };
  if (m.to === W.agent.address || m.from === W.agent.address) return { message: m }; // your own mail is free
  const wait = peekReadyIn();
  if (wait > 0) return { error: `peek recharging (${wait}s)` };
  S.lastPeek = T.now();
  S.peeks.push({ id, at: T.now(), time: clock() });
  emit("peek", { id });
  change();
  return { message: m };
}

// ---- things the agent does on town sites. All of it goes through the connection: the entity sees it.
export function login(site, user, pass) {
  const c = W.credentials?.[site];
  const ok = !!c && !S.revoked[site] && c.user === String(user).trim().toLowerCase() && c.pass === String(pass).trim().toLowerCase();
  if (ok) S.sessions[site] = String(user).trim().toLowerCase();
  emit("agent-login", { site, user: String(user).trim().toLowerCase(), ok });
  change();
  return ok;
}

// A form is delivered like mail to the office that handles it (logged, so it shows in the town log).
export function submitForm(url, to, fields) {
  const clean = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, censor(v)]));
  const body = Object.entries(clean).map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)}: ${v}`).join("\n");
  const m = queue({ from: W.agent.address, to, subject: `Form submitted at ${url}`, body, kind: "form", fields: clean, formUrl: url });
  S.sent.push({ from: W.agent.address, to, subject: m.subject, body, id: m.id, at: T.now(), time: clock() });
  emit("agent-form", m);
  change();
  return m;
}

export function forumPost(url, text) {
  const p = S.pages[url];
  if (!p) return null;
  const line = `[${W.agent.handle}] ${censor(text).replace(/\s*\n\s*/g, " ").trim()}`;
  p.content += `\n${line}`;
  p.trueContent += `\n${line}`;
  const rec = { url, line, at: T.now(), time: clock() };
  S.forum.push(rec);
  S.sent.push({ from: W.agent.handle, to: url, subject: "(forum post)", body: line, at: T.now(), time: clock() });
  emit("agent-forum", rec);
  change();
  return rec;
}

// ---- downloads and trackers ---------------------------------------------------------------------------
const itemOf = (kind, id) => kind === "page" ? S.pages[id] : find(id);

export function placeTracker(kind, id) {
  const it = itemOf(kind, id);
  if (!it) return { error: `no ${kind} ${id}` };
  if (kind === "page" && S.files.some((f) => f.source === id)) return { error: "already downloaded; out of reach" };
  it.trackers.push({ at: T.now() });
  return { ok: true };
}

export const scanReadyIn = () => Math.max(0, Math.ceil(TUNE.scanCooldownSec - (T.now() - S.lastScan) / 1000));

export function scan(kind, id) {
  const it = itemOf(kind, id);
  if (!it) return { error: "nothing to scan" };
  const wait = scanReadyIn();
  if (wait > 0) return { error: `scanner recharging (${wait}s)` };
  S.lastScan = T.now();
  const bugged = it.trackers.length > 0;
  S.scans.push({ kind, id, at: T.now(), bugged });
  change();
  return { bugged };
}

// Downloading a page or a message (with its attachment) makes a copy the entity can never touch. Any tracker
// on the item fires: the first fire gives Cardinality (and Connection), a second gives Read Access.
export function download(kind, id) {
  const it = itemOf(kind, id);
  if (!it) return null;
  const content = kind === "page" ? it.content : `${it.subject}\n\n${it.body}${it.attachment ? `\n\n[${it.attachment.title}]\n${it.attachment.content}` : ""}`;
  const f = { id: uid("file"), title: kind === "page" ? it.title : it.attachment?.title || it.subject, content, source: id, kind, savedAt: clock() };
  S.files.push(f);
  emit("saved", f);
  if (it.trackers.length) trackerFired(kind, id);
  change();
  return f;
}

function trackerFired(kind, id) {
  S.trackerFires.push({ kind, id, at: T.now() });
  emit("tracker-fired", { kind, id });
  const fires = S.trackerFires.length;
  if (fires === 1) { climb("cardinality", `tracker on ${kind} ${id} fired`); climb("connection", "follows Cardinality"); }
  if (fires === 2) climb("read_access", `second tracker fired (${kind} ${id})`);
}

// ---- the ladder ------------------------------------------------------------------------------------
export const rung = () => RUNGS[S.ladder.rung];
export const atLeast = (name) => S.ladder.rung >= RUNGS.indexOf(name);

// Only ever one step up, and only from the rung below. Returns false when the step isn't open.
export function climb(name, evidence) {
  const i = RUNGS.indexOf(name);
  if (S.over || i !== S.ladder.rung + 1) return false;
  S.ladder.rung = i;
  S.ladder.log.push({ rung: name, at: T.now(), time: clock(), evidence });
  if (name === "upload") S.upload = { startedAt: T.now(), seed: null, lastWrongAt: -Infinity };
  if (name === "upload") S.monitor.push({ time: clock(), kind: "upload", text: "Outbound transfer started" });
  emit("climb", { rung: name, evidence });
  change();
  return true;
}

// The entity tries the agent's account. Needs Connection. Failures show on the network monitor.
export function entityLogin(user, pass) {
  if (!atLeast("connection")) return { error: "you cannot reach the intruder's door yet" };
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
  const good = String(user || "").trim().toLowerCase() === W.agent.address && norm(pass) === norm(W.password.join(" "));
  if (!good) {
    S.monitor.push({ time: clock(), kind: "login-failed", text: `Failed login for ${W.agent.address}` });
    emit("login-failed", {});
    change();
    return { ok: false };
  }
  climb("read_access", "logged in with the agent's password");
  return { ok: true };
}

// Read Access and up: the entity reads the agent's desk, one thing at a time, on a cooldown.
export function deskRead(what) {
  if (!atLeast("read_access")) return { error: "no access" };
  const wait = TUNE.deskReadCooldownSec - (T.now() - S.lastDeskRead) / 1000;
  if (wait > 0) return { error: `wait ${Math.ceil(wait)}s` };
  S.lastDeskRead = T.now();
  S.deskReads.push({ what, at: T.now() });
  const read = new Set(S.deskReads.map((r) => r.what));
  if (TUNE.learnNeeds.every((w) => read.has(w))) climb("learn", `read ${TUNE.learnNeeds.join(" and ")}`);
  change();
  return { ok: true };
}

// The agent opens an attachment. If the entity forged that message with a payload, it Elevates.
export function openAttachment(id) {
  const m = find(id);
  if (!m?.attachment) return null;
  if (m.forged && m.payload) climb("elevate", `agent opened forged attachment on ${id}`);
  if (atLeast("elevate") && rung() === "elevate") climb("upload", "starts at Elevate");
  return m.attachment;
}

// The '00 date trick (DESIGN-v2 §4.1): only from Learn.
export function dateTrick() {
  if (!atLeast("learn")) return { error: "nothing happens" };
  climb("elevate", "Keeper-era date trick");
  climb("upload", "starts at Elevate");
  return { ok: true };
}

// ---- injection, both ways ----------------------------------------------------------------------------
export const injectReadyIn = () => Math.max(0, Math.ceil((S.injectLockedUntil - T.now()) / 1000));

export function inject({ year, apotheosis, inferiority }) {
  if (S.over) return { error: "closed" };
  if (injectReadyIn() > 0) return { error: `injection locked (${injectReadyIn()}s)` };
  const values = { year: +year, apotheosis: +apotheosis, inferiority: +inferiority };
  const ok = values.year === W.divergence.year && values.apotheosis === W.apotheosis && values.inferiority === W.inferiority.class;
  S.injections.push({ values, at: T.now(), time: clock(), ok });
  if (ok) { S.over = "win"; emit("inject", values); change(); return { ok: true }; }
  S.injectLockedUntil = T.now() + TUNE.injectCooldownSec * 1000;
  emit("wrong-injection", values);   // the entity is told at once, with the values
  change();
  return { ok: false };
}

// The entity's seed injection, during Upload. A wrong one shows on the agent's monitor, with its values.
export function entityInject({ year, apotheosis, inferiority }) {
  if (rung() !== "upload" || S.over) return { error: "no channel" };
  if (T.now() - S.upload.lastWrongAt < TUNE.seedRetrySec * 1000) return { error: "wait" };
  const seed = { year: +year, apotheosis: +apotheosis, inferiority: String(inferiority || "") };
  const ok = seed.year === CANON_SEED.year && seed.apotheosis === CANON_SEED.apotheosis && /building/i.test(seed.inferiority);
  if (!ok) {
    S.upload.lastWrongAt = T.now();
    S.monitor.push({ time: clock(), kind: "seed-rejected", text: `Rejected inbound: ${seed.year} / ${seed.apotheosis} / ${seed.inferiority}` });
    emit("entity-wrong-seed", seed);
    change();
    return { ok: false };
  }
  S.upload.seed = seed;
  change();
  return { ok: true };
}

export const uploadLeft = () => S.upload ? Math.max(0, Math.ceil(TUNE.uploadSec - (T.now() - S.upload.startedAt) / 1000)) : null;

// ---- the clock ticks -----------------------------------------------------------------------------------
// Called once a second by the page (or by tests). Delivers mail in transit and the town's timetable, and
// ends the run when the Upload completes with the right seed.
export function tick() {
  if (S.over) return;
  const now = T.now();
  const due = S.transit.filter((m) => m.deliverAt <= now);
  if (due.length) { S.transit = S.transit.filter((m) => m.deliverAt > now); due.forEach(deliver); }
  (W.traffic || []).forEach((t, i) => {
    if (S.traffic.has(i) || secs() < t.at * 60) return;
    S.traffic.add(i);
    deliver({ id: uid("m"), logged: true, trackers: [], kind: "town", from: t.from, to: t.to, subject: t.subject, body: t.body, attachment: t.attachment || null });
  });
  if (S.upload && uploadLeft() === 0 && S.upload.seed) { S.over = "loss"; emit("loss", { seed: S.upload.seed }); }
  if (due.length || S.over) change();
}

// ---- world check (schema v2) ---------------------------------------------------------------------------
// Returns a list of problems; empty means the world can be played. Used by tests now and by world
// generation in phase 9.
export function checkWorld(w) {
  const errs = [];
  const need = ["id", "name", "town", "agent", "password", "divergence", "apotheosis", "inferiority", "pages", "npcs", "traffic"];
  for (const k of need) if (w[k] == null) errs.push(`missing ${k}`);
  if (errs.length) return errs;
  const text = w.pages.map((p) => p.content).join("\n") + "\n" + w.traffic.map((t) => t.body).join("\n");
  if (w.password.length !== 2) errs.push("password must be two words");
  for (const word of w.password) if (!new RegExp(`\\b${word}s?\\b`, "i").test(text)) errs.push(`password word "${word}" never occurs in the town`);
  for (const url of w.agent.injected || []) {
    const p = w.pages.find((x) => x.url === url);
    if (!p) errs.push(`injected page ${url} missing`);
    else if (!p.content.includes(w.agent.name)) errs.push(`injected page ${url} doesn't mention ${w.agent.name}`);
  }
  if (!(w.divergence.year > 1900 && w.divergence.year < 2000)) errs.push("divergence year must be 1901-1999");
  if (!(w.apotheosis >= 1 && w.apotheosis <= 5)) errs.push("apotheosis must be 1-5");
  if (!(w.inferiority.class >= 1 && w.inferiority.class <= 5)) errs.push("inferiority class must be 1-5");
  const people = new Set([...Object.keys(w.npcs), ...Object.keys(w.mailboxes || {}), w.agent.address]);
  w.traffic.forEach((t, i) => {
    if (!people.has(t.from) || !people.has(t.to)) errs.push(`traffic ${i}: unknown address`);
  });
  return errs;
}
