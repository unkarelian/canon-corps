// The entity's tricks on the agent's desk (DESIGN-v2 §3.2). Its apotheosis decides which it has; higher levels
// have longer cooldowns. Each trick is armed by the entity (js/entity.js) and consumed by the desk (js/apps.js)
// at the moment it applies. Every use is logged for the dev panel and the run log.
//
// The always-true instruments are never touched: the town log, the raw Sent view, the network monitor, and the
// address bar (which always shows where you really are).
//
// No DOM here, so tests can drive it.
import { W } from "./world.js";
import { S, T, clock } from "./engine.js";
import { emit } from "./util.js";

export const TRICKS = {
  bounce:    { level: 1, base: 120, about: "The intruder's next send shows it a delivery error, although the message really goes. It may send again." },
  misroute:  { level: 2, base: 150, about: "The intruder's next link click in its viewer lands on a page you choose instead.", args: { to: "string" } },
  transpose: { level: 3, base: 240, about: "For a while, the digits 3 and 4 swap places in whatever the intruder types.", args: { seconds: "integer" } },
  maze:      { level: 4, base: 300, about: "For a few minutes, every link on one site of yours leads somewhere else on that site, the same way each time.", args: { site: "string", minutes: "integer" } },
  falsepeek: { level: 5, base: 360, about: "The next time the intruder looks inside a particular message, it sees the text you choose instead.", args: { message_id: "string", body: "string" } },
};

export const cooldownSec = (name) => Math.round(TRICKS[name].base * (1 + 0.5 * (W.apotheosis - 1)));
export const available = () => Object.keys(TRICKS).filter((n) => TRICKS[n].level <= W.apotheosis);

const st = () => (S.tricks ??= { last: {}, armed: {}, log: [] });

export function readyIn(name) {
  const last = st().last[name];
  return last == null ? 0 : Math.max(0, Math.ceil(cooldownSec(name) - (T.now() - last) / 1000));
}

// The entity uses a trick. Returns a message for its tool result.
export function useTrick(name, args = {}) {
  const t = TRICKS[name];
  if (!t || t.level > W.apotheosis) return { error: "you cannot do that" };
  const wait = readyIn(name);
  if (wait > 0) return { error: `not yet (${wait}s)` };
  const s = st();
  if (name === "misroute") {
    const to = String(args.to || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!S.pages[to]) return { error: `no page at ${to}` };
    s.armed.misroute = { to };
  } else if (name === "transpose") {
    s.armed.transpose = { until: T.now() + Math.max(10, Math.min(90, Number(args.seconds) || 45)) * 1000 };
  } else if (name === "maze") {
    const site = String(args.site || "").split("/")[0];
    const pages = Object.keys(S.pages).filter((u) => u.split("/")[0] === site);
    if (pages.length < 2) return { error: `no site ${site} with pages to loop` };
    s.armed.maze = { site, pages, until: T.now() + Math.max(1, Math.min(5, Number(args.minutes) || 3)) * 60000, seed: Math.floor(Math.random() * 1e9) };
  } else if (name === "falsepeek") {
    if (!S.mail.some((m) => m.id === args.message_id)) return { error: "no such message" };
    s.armed.falsepeek = { id: args.message_id, body: String(args.body || "") };
  } else s.armed.bounce = true;
  s.last[name] = T.now();
  s.log.push({ name, args, at: T.now(), time: clock(), applied: false });
  emit("trick-armed", { name });
  return { ok: true };
}

const applied = (name, detail) => {
  const e = [...st().log].reverse().find((x) => x.name === name && !x.applied);
  if (e) { e.applied = true; e.detail = detail; e.appliedAt = clock(); }
  emit("trick-applied", { name, detail });
};

// ---- hooks the desk calls ------------------------------------------------------------------------------
// True if this send should show a delivery error (the message has still gone).
export function bounceSend() {
  if (!st().armed.bounce) return false;
  st().armed.bounce = false;
  applied("bounce");
  return true;
}

// Where a link click really goes.
export function route(fromUrl, url) {
  const s = st();
  if (s.armed.misroute) {
    const to = s.armed.misroute.to;
    s.armed.misroute = null;
    applied("misroute", `${url} -> ${to}`);
    return to;
  }
  const m = s.armed.maze;
  if (m && T.now() < m.until && url.split("/")[0] === m.site && fromUrl?.split("/")[0] === m.site) {
    let h = m.seed;
    for (const c of fromUrl + "|" + url) h = (Math.imul(h ^ c.charCodeAt(0), 16777619)) >>> 0;
    const others = m.pages.filter((p) => p !== url);
    const to = others[h % others.length];
    if (!m.used) { m.used = true; applied("maze", m.site); }
    return to;
  }
  return url;
}

export const transposing = () => (st().armed.transpose?.until || 0) > T.now();
export const swapDigits = (text) => String(text).replace(/[34]/g, (d) => (d === "3" ? "4" : "3"));

// What a peek shows.
export function peekBody(m) {
  const f = st().armed.falsepeek;
  if (f && f.id === m.id) { st().armed.falsepeek = null; applied("falsepeek", m.id); return f.body; }
  return m.body;
}
