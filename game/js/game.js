// Game state and rules. The engine is the source of truth; models only write text.
import { W } from "./world.js";
import { emit, uid } from "./util.js";

// ---- tuning -------------------------------------------------------------------
export const TUNE = {
  noticeCost: { email: 5, forum: 4, form: 4, login: 2, transmit: 12 },
  driftEverySec: 20,                // +1 notice per this many seconds once the Demiurge has stirred
  stages: [                         // [threshold, name, tool tier]
    [0, "QUIET", 0], [12, "STIRRING", 1], [35, "WATCHFUL", 2], [60, "FIXED", 3], [100, "SEARCHING", 3],
  ],
  searchSeconds: 150,               // at max notice, time until it finds you
  anchorValue: 34,
  requiredBase: 100, requiredFloor: 55, requiredPerTamper: 2,
  poisonCooldownSec: 75, poisonReboundWindowSec: 150, poisonBaseNotice: 6,
  impersonationNoticedChance: 0.3,  // per message sent from a borrowed account
  impersonationNoticedAfterSec: [90, 240],
  impersonationNoticedNotice: 6,
};

export const S = {
  started: Date.now(),
  notice: 0,
  stage: "QUIET",
  tier: 0,
  stirred: false,               // first notice has happened
  visited: new Set(),           // pages read in the viewer
  directives: [],               // HQ directives issued: {id, task, status, issued, closed}
  searchStartedAt: null,
  over: null,                   // "win" | "loss"
  world: null,                  // id and name of the reality
  // content is what the connection serves the player; trueContent is what the town itself sees.
  pages: {},
  sessions: {},                 // logged-in sites
  revoked: {},                  // sites whose password was changed after somebody noticed
  identities: {},               // address -> {site, active}: staff accounts the agent has opened
  mail: { hq: [], inbox: [], sent: [], transit: [], lost: [] },
  files: [],
  postLog: [],
  progress: 0, credited: new Set(), transmissions: [],
  poison: { lastUse: 0, uses: [] },
  demi: { notes: [], effects: [], wakes: [], busy: false, tamper: 0 },
};

// Give the run its world. Called once, before anything else reads S.pages or S.mail.
export function beginRun() {
  S.world = { id: W.id, name: W.name, town: W.town, generated: !W.hand };
  S.pages = Object.fromEntries(W.pages.map((p) => [p.url, { ...p, trueContent: p.content, tamper: 0, downloaded: false }]));
  S.mail.hq = W.hqMail.map((m) => ({ ...m, id: uid("hq"), to: "agent@canon-corps.gov", read: false, folder: "hq" }));
  S.started = Date.now();
}

export const clock = () => {
  const mins = Math.floor((Date.now() - S.started) / 1000); // one real second is one minute of local time
  const t = 20 * 60 + 30 + mins;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

export const required = () =>
  Math.max(TUNE.requiredFloor, TUNE.requiredBase - TUNE.requiredPerTamper * S.demi.tamper);

export function anchorsIn(text) {
  return Object.entries(W.anchors).filter(([, a]) => text.includes(a)).map(([id]) => id);
}

// ---- notice -----------------------------------------------------------------------
export function addNotice(n, why) {
  if (S.over) return;
  const before = S.stage;
  S.notice = Math.min(100, S.notice + n);
  let stage = TUNE.stages[0];
  for (const st of TUNE.stages) if (S.notice >= st[0]) stage = st;
  S.stage = stage[1];
  S.tier = stage[2];
  if (S.stage !== before) {
    if (!S.stirred && S.tier >= 1) { S.stirred = true; emit("first-notice"); }
    if (S.stage === "SEARCHING" && !S.searchStartedAt) S.searchStartedAt = Date.now();
    emit("stage", { from: before, to: S.stage, why });
  }
  emit("change");
}

// ---- posting: everything the Demiurge can see goes through here --------------------
export function post(kind, entry) {
  const rec = { kind, time: clock(), from: W.cover.address, ...entry };
  S.postLog.push(rec);
  addNotice(TUNE.noticeCost[kind] ?? 3, kind);
  emit("post", rec);
  emit("change");
  return rec;
}

// ---- mail ---------------------------------------------------------------------------
// `from` is the cover address, or a staff address whose account the agent has opened.
export function sendMail({ to, subject, body, inReplyTo, from = W.cover.address }) {
  if (from !== W.cover.address && !S.identities[from]?.active) from = W.cover.address;
  const msg = { id: uid("out"), from, to, subject, body, time: clock(), inReplyTo };
  S.mail.sent.push(msg);
  post("email", { to, subject, body, from, impersonating: from !== W.cover.address });
  return msg;
}

// Mail the agent can read: the cover's, and any opened staff account's.
export const myAddresses = () => [W.cover.address, ...Object.keys(S.identities).filter((a) => S.identities[a].active)];

// Somebody noticed their account was used: the password changes and the agent is shut out.
export function revokeIdentity(addr) {
  const id = S.identities[addr];
  if (!id?.active) return false;
  id.active = false;
  id.revokedAt = clock();
  delete S.sessions[id.site];
  S.revoked[id.site] = true;
  addNotice(TUNE.impersonationNoticedNotice, "impersonation noticed");
  emit("identity-revoked", { addr, site: id.site });
  emit("change");
  return true;
}

// ?fast in the URL shortens every delivery delay (for playtesting).
const SPEED = new URLSearchParams(location.search).has("fast") ? 0.2 : 1;

export function queueIncoming(msg, delaySec) {
  const m = { id: uid("msg"), time: null, tamper: 0, read: false, folder: "inbox",
    deliverAt: Date.now() + delaySec * 1000 * SPEED, ...msg };
  S.mail.transit.push(m);
  emit("transit", m);
  emit("change");
  return m;
}

export function deliverDue() {
  const now = Date.now();
  const due = S.mail.transit.filter((m) => m.deliverAt <= now);
  if (!due.length) return;
  S.mail.transit = S.mail.transit.filter((m) => m.deliverAt > now);
  for (const m of due) {
    m.time = clock();
    const to = (m.to || "").toLowerCase();
    if (to !== W.cover.address && !S.identities[to]?.active) {  // that account is closed to the agent now
      S.mail.lost.push(m);
      emit("mail-lost", m);
      continue;
    }
    S.mail.inbox.push(m);
    emit("mail-arrived", m);
  }
  emit("change");
}

// ---- browser ------------------------------------------------------------------------
export function getPage(url) {
  const p = S.pages[url.replace(/^https?:\/\//, "").replace(/\/$/, "")];
  if (!p) return null;
  if (p.requiresLogin && !S.sessions[p.requiresLogin]) return { ...p, locked: true };
  return p;
}

export function login(site, user, pass) {
  post("login", { to: site, body: `login attempt as "${user}"` });
  const c = W.credentials[site];
  const ok = !!c && !S.revoked[site] && c.user === user.trim().toLowerCase() && c.pass === pass.trim().toLowerCase();
  if (ok) {
    S.sessions[site] = user;
    if (c.person && !S.identities[c.person]) {
      S.identities[c.person] = { site, active: true, openedAt: clock() };
      emit("identity-opened", { addr: c.person, site });
    }
  }
  emit("change");
  return ok;
}

export function saveFile({ title, content, source, tamper = 0 }) {
  const f = { id: uid("file"), title, content, source, tamper, savedAt: clock(), anchors: anchorsIn(content) };
  S.files.push(f);
  emit("saved", f);
  emit("change");
  return f;
}

export function downloadPage(url) {
  const p = S.pages[url];
  p.downloaded = true; // beyond the Demiurge's reach from now on
  return saveFile({ title: p.title, content: p.content, source: url, tamper: p.tamper });
}

// ---- HQ: transmission and injection ---------------------------------------------------
export function transmit(fileId) {
  const f = S.files.find((x) => x.id === fileId);
  post("transmit", { to: "canon-corps.gov (HQ uplink)", subject: f.title, body: `[outbound transmission of saved document: ${f.title}]` });
  const fresh = f.anchors.filter((a) => !S.credited.has(a));
  fresh.forEach((a) => S.credited.add(a));
  const gained = fresh.length * TUNE.anchorValue;
  S.progress += gained;
  const result = { file: f.title, time: clock(), resonance: gained > 0, already: !gained && f.anchors.length > 0 };
  S.transmissions.push(result);
  emit("transmitted", result);
  emit("change");
  return result;
}

export const canInject = () => S.progress >= required() && !S.over;
