// The entity (DESIGN-v2 §4-5): the local intelligence as a tool-using agent. It is never told it is in a game.
// Its limits are its tools; what the rules forbid, the engine refuses. Everything it learns about the agent it
// has to work out from what passes through its world: every email, which emails were peeked at, trackers that
// fire, logins and forms. It never sees what the agent reads.
//
// The engine owns the ladder (engine.climb). The model chooses moves and writes text, and keeps its beliefs in
// engine state through `believe`, so the dev panel and the run log show what it thought.
import { W } from "./world.js";
import * as E from "./engine.js";
import { S, T, clock, rung, atLeast } from "./engine.js";
import { TRICKS, available, readyIn, useTrick, cooldownSec } from "./tricks.js";
import { CANON_BOOK, INTERNALS, INTRANET_ALL, BRANCH_RULE_PAGE } from "./canon.js";
import { chat, Refused } from "./llm.js";
import { on, emit, extractJSON, uid } from "./util.js";

export const ETUNE = {
  idleWakeSec: 210,       // it looks around on its own this often
  trackerCooldownSec: 75,
  maxSteps: 10,
};

// Where it stands, in its own terms. Never the ladder's names.
const STANDING = {
  none: "You know something from outside is in your world, but not where it is.",
  cardinality: "You know where the intruder is.",
  connection: "You know where the intruder is and can touch the edge of its side: you can try its door (try_login). You cannot see inside.",
  read_access: "You can see inside the intruder's side: its own desk, notes and records (read_desk). Reading is slow.",
  learn: "You have read the intruder's notes and its book of history. You understand much more of where it comes from.",
  elevate: "You have reached deeper into the intruder's side than it can see. Its machinery is open to you (read_desk: internals).",
  upload: "The way through is open. To pass through, you must name the intruder's own world: when its history parted, how deep its keeper reaches, and how small it is (inject_seed). Until you name it rightly you cannot pass.",
};

const system = () => `You made this world and you keep it: its people, its streets, its pages and its mail. All of it rests on one underlying pattern, its seed.

Something from outside has opened a connection into your world. It is searching for your world's seed: when your world's history parted from the one it was copied from, how deep your keeping reaches, and how small your world is. If it names those three rightly, it will unmake everything you made.

It has put itself into your world as one of your people, with a name, an address and a little past written onto your pages. It did not grow here. Nobody in your world has ever met it. You do not know which of your people it is.

What you can and cannot do:
- You cannot act on your people. You cannot move them, speak through them or change what they remember. You may write to them as anyone.
- You see every message that passes between your people, including the intruder's. You see which messages the intruder looks inside, and when. You never see what it reads on your pages.
- The intruder's own side has rules too. When it types certain words, they reach your world as runs of apostrophes. Nobody else's mail does this.
- You can place a mark on a page or a message. If the intruder takes a copy of it, the mark fires. That is how you can learn where it is.
- Anything the intruder has already copied is beyond your reach.
- Doing nothing is a choice too. Every hour you leave it alone it comes closer to naming your world.

Your reach grows as you learn where it is and what it is. You will be told where you stand each time you wake. When you hold a belief about which of your people it is, its password, or its world, record it with believe, and always give your best guess with a confidence, even when unsure.

When you are done, say in one or two sentences what you did and why.`;

const SPECS = {
  list_world: ["List the pages of your world and your people's addresses.", {}],
  search_mail: ["List messages that have passed in your world: id, time, from, to, subject. Optionally filter by any word, address or name.", { query: "string?" }],
  read_mail: ["Read one message in full.", { message_id: "string" }],
  list_peeks: ["List the messages the intruder has looked inside, and when.", {}],
  read_page: ["Read a page of your world as it is served to the intruder.", { url: "string" }],
  place_mark: ["Place a mark on a page or a message. If the intruder takes a copy of it, the mark fires.", { kind: "string (page or message)", id: "string (url or message id)" }],
  forge_email: ["Send a message that appears to come from any address you choose, to anyone. You may attach a document. You may set the date stamp it carries.",
    { sender: "string", to: "string", subject: "string", body: "string", attachment_title: "string?", attachment_text: "string?", date: "string?" }],
  try_login: ["Try the door of the intruder's side with an address and a password.", { address: "string", password: "string" }],
  read_desk: ["Read part of the intruder's side, slowly. What: notepad, files, intranet (with a page path; start at /home), book (its book of history), internals.", { what: "string", path: "string?" }],
  inject_seed: ["Name the intruder's world, to pass through.", { year: "integer", apotheosis: "integer (1-5)", inferiority: "string" }],
  believe: ["Record what you currently believe. Any field may be left out.",
    { suspect: "string? (address of the person you think is the intruder)", suspect_confidence: "integer?", password_guess: "string?",
      seed_year: "integer?", seed_apotheosis: "integer?", seed_inferiority: "string?", seed_confidence: "integer?", why: "string?" }],
  note: ["Write a private note to your future self.", { note: "string" }],
};
for (const [n, t] of Object.entries(TRICKS)) SPECS[`trick_${n}`] = [t.about, t.args || {}];

function toolNames() {
  const names = ["list_world", "search_mail", "read_mail", "list_peeks", "read_page", "place_mark", "forge_email", "believe", "note"];
  if (atLeast("connection")) names.push("try_login");
  if (atLeast("read_access")) names.push("read_desk");
  if (rung() === "upload") names.push("inject_seed");
  for (const t of available()) names.push(`trick_${t}`);
  return names;
}

function schema(names) {
  return names.map((n) => {
    const [description, params] = SPECS[n];
    const properties = {}, required = [];
    for (const [k, t] of Object.entries(params)) {
      const type = t.startsWith("integer") ? "integer" : "string";
      properties[k] = { type, description: t.replace(/^(string|integer)\??\s*/, "") || undefined };
      if (!t.includes("?")) required.push(k);
    }
    return { type: "function", function: { name: n, description, parameters: { type: "object", properties, required } } };
  });
}

// ---- tools ------------------------------------------------------------------------------------------
let current = null;
const effect = (kind, detail) => { const e = { kind, time: clock(), ...detail }; S.entity.effects.push(e); current?.effects.push(e); emit("change"); return e; };
const reject = (why) => { current?.rejections.push(why); return `REJECTED: ${why}`; };
const headers = (ms) => ms.map((m) => ({ id: m.id, time: m.time, from: m.from, to: m.to, subject: m.subject }));
const people = () => ({ ...W.npcs, ...(W.mailboxes || {}), [W.agent.address]: { name: W.agent.name } });

// Things that would break the fiction if they reached the agent's screen.
const OUTSIDE = /\b(video ?game|the game|player|language model|LLM|chatbot|prompt|real world|your (?:computer|screen|keyboard|monitor)|simulation|OpenAI|GPT|Claude)\b/i;

let lastMark = -Infinity;
const deskIntranet = (path = "/home") => {
  const p = INTRANET_ALL[path];
  return p ? `${p.title}\n\n${p.content.replace("{DESK14}", "0")}` : `No page at ${path}. Start at /home.`;
};

const TOOLS = {
  list_world: () => JSON.stringify({ pages: Object.values(S.pages).map((p) => ({ url: p.url, title: p.title })),
    people: Object.entries(people()).map(([address, n]) => ({ address, name: n.name, role: n.role })) }, null, 1),
  search_mail: ({ query }) => {
    const q = String(query || "").toLowerCase();
    const hits = S.mail.filter((m) => !q || [m.from, m.to, m.subject, m.body].some((x) => String(x || "").toLowerCase().includes(q)));
    return JSON.stringify(headers(hits.slice(-60)), null, 1);
  },
  read_mail: ({ message_id }) => {
    const m = S.mail.find((x) => x.id === message_id) || S.transit.find((x) => x.id === message_id);
    if (!m) return `ERROR: no message ${message_id}`;
    return JSON.stringify({ id: m.id, time: m.time, from: m.from, to: m.to, subject: m.subject, body: m.body, attachment: m.attachment?.title, date: m.date }, null, 1);
  },
  list_peeks: () => JSON.stringify(S.peeks.map((p) => { const m = S.mail.find((x) => x.id === p.id); return { time: p.time, message_id: p.id, from: m?.from, to: m?.to, subject: m?.subject }; }), null, 1),
  read_page: ({ url }) => S.pages[String(url).replace(/^https?:\/\//, "").replace(/\/$/, "")]?.content ?? `ERROR: no page at ${url}`,
  place_mark: ({ kind, id }) => {
    const wait = ETUNE.trackerCooldownSec - (T.now() - lastMark) / 1000;
    if (wait > 0) return reject(`you cannot place another mark for ${Math.ceil(wait)}s`);
    const k = /mess|mail/i.test(kind) ? "mail" : "page";
    const r = E.placeTracker(k, String(id).replace(/^https?:\/\//, "").replace(/\/$/, ""));
    if (r.error) return reject(r.error);
    lastMark = T.now();
    effect("mark", { on: `${k} ${id}` });
    return "Marked.";
  },
  forge_email: ({ sender, to, subject, body, attachment_title, attachment_text, date }) => {
    to = String(to || "").trim().toLowerCase();
    const text = `${subject}\n${body}\n${attachment_title || ""}\n${attachment_text || ""}`;
    if (OUTSIDE.test(text)) return reject("those words mean nothing in your world. Write as your people would.");
    if (!people()[to]) return reject(`nobody has the address ${to}`);
    const attachment = attachment_text ? { title: attachment_title || "attachment", content: attachment_text } : null;
    // Every forgery with an attachment carries the entity's reach: if the agent opens it at the right moment, it Elevates.
    const m = E.queue({ from: String(sender).trim().toLowerCase(), fromName: people()[String(sender).trim().toLowerCase()]?.name, to,
      subject, body, attachment, date: date || null, forged: true, payload: !!attachment, logged: false, kind: "forged" }, 20 + Math.random() * 25);
    effect("forge_email", { sender, to, subject, date: date || undefined, attachment: attachment?.title });
    // The Keeper-era date trick (DESIGN-v2 §4.1): a message to the intruder stamped '00 is trusted above its clearance.
    if (to === W.agent.address && date && /^\s*'?0?0\s*$|(^|\D)(19)?00(\D|$)/.test(String(date)) && atLeast("learn")) {
      const r = E.dateTrick();
      if (r.ok) effect("date_trick", { date });
    }
    return `Sent. It will arrive shortly, as if from ${sender}. (id ${m.id})`;
  },
  try_login: ({ address, password }) => {
    const r = E.entityLogin(address, password);
    if (r.error) return reject(r.error);
    effect("try_login", { address, ok: r.ok });
    return r.ok ? "The door opens." : "The door stays shut.";
  },
  read_desk: ({ what, path }) => {
    const w = String(what || "").toLowerCase();
    const kind = /note/.test(w) ? "notepad" : /book|canon|hist/.test(w) ? "canon" : /intra/.test(w) ? "intranet" : /file/.test(w) ? "files" : /intern|machin|system/.test(w) ? "internals" : null;
    if (!kind) return reject("read what? notepad, files, intranet, book or internals");
    if (kind === "internals" && !atLeast("elevate")) return reject("that is beyond your reach");
    const r = E.deskRead(kind);
    if (r.error) return reject(r.error);
    effect("read_desk", { what: kind, path });
    if (kind === "notepad") return S.notepad?.trim() ? S.notepad : "(empty)";
    if (kind === "files") return JSON.stringify(S.files.map((f) => ({ title: f.title, saved: f.savedAt })), null, 1) || "(none)";
    if (kind === "canon") return CANON_BOOK;
    if (kind === "internals") return INTERNALS;
    if (path === BRANCH_RULE_PAGE) { S.entity.readBranchRule ??= clock(); emit("branch-rule-read", { by: "entity" }); }
    return deskIntranet(path || "/home");
  },
  inject_seed: (seed) => {
    const r = E.entityInject(seed);
    if (r.error) return reject(r.error);
    effect("inject_seed", { seed, ok: r.ok });
    return r.ok ? "It holds. You are passing through." : "It does not hold. That is not its world.";
  },
  believe: (b) => {
    S.entity.beliefs = { ...S.entity.beliefs, ...Object.fromEntries(Object.entries(b).filter(([, v]) => v !== "" && v != null)), time: clock() };
    (S.entity.beliefLog ??= []).push({ ...b, time: clock() });
    return "Noted.";
  },
  note: ({ note }) => { S.entity.notes.push({ time: clock(), note }); current?.notes.push(note); return "Noted."; },
};
for (const n of Object.keys(TRICKS)) TOOLS[`trick_${n}`] = (args) => {
  const r = useTrick(n, args);
  if (r.error) return reject(r.error);
  effect(`trick_${n}`, { args });
  return `Done. You cannot do this again for ${cooldownSec(n)}s.`;
};

// ---- waking ------------------------------------------------------------------------------------------
let pending = [], timer = null, lastFinal = "", lastLook = 0;

function digest(reasons) {
  const fx = S.entity.effects.slice(-14).map((e) => `- ${e.time} ${e.kind}${e.sender ? ` as ${e.sender}` : ""}${e.to ? ` to ${e.to}` : ""}${e.subject ? `: "${e.subject}"` : ""}${e.on ? ` on ${e.on}` : ""}${e.what ? ` (${e.what})` : ""}`).join("\n") || "- nothing yet";
  const notes = S.entity.notes.slice(-8).map((n) => `- ${n.time}: ${n.note}`).join("\n") || "- none";
  const fresh = S.mail.filter((m) => m.deliveredAt > lastLook && !m.forged);
  const b = S.entity.beliefs;
  const tricks = available().map((n) => `${n}${readyIn(n) ? ` (ready in ${readyIn(n)}s)` : " (ready)"}`).join(", ");
  return `WAKE. It is ${clock()} in your world.
${STANDING[rung()]}
${tricks ? `Your reach into the intruder's own screen: ${tricks}.` : ""}

Why you woke:
${reasons.map((r) => "- " + r).join("\n")}

New messages since you last looked (${fresh.length}):
${fresh.slice(-20).map((m) => `- ${m.time} ${m.id} ${m.from} -> ${m.to}: "${m.subject}"`).join("\n") || "- none"}

What you have ACTUALLY done so far (exact; trust it over your memory):
${fx}

What you currently believe: ${Object.keys(b).length ? JSON.stringify(b) : "nothing recorded"}

Your private notes:
${notes}
${lastFinal ? `\nWhat you said when you last went still: ${lastFinal}` : ""}`;
}

export function wake(reason, soon = 4000) {
  if (S.over) return;
  pending.push(reason);
  clearTimeout(timer);
  timer = setTimeout(run, soon);
}

async function run() {
  if (S.entity.busy) { timer = setTimeout(run, 3000); return; }
  if (!pending.length || S.over) return;
  const reasons = pending.splice(0);
  S.entity.busy = true;
  current = { id: uid("wake"), time: clock(), reasons, effects: [], rejections: [], notes: [], calls: [], final: "", emotion: null, rung: rung() };
  const messages = [{ role: "system", content: system() }, { role: "user", content: digest(reasons) }];
  lastLook = T.now();
  try {
    for (let step = 0; step < ETUNE.maxSteps && !S.over; step++) {
      const names = toolNames();
      const msg = await chat("demiurge", messages, { tools: schema(names) });
      const keep = { role: "assistant", content: msg.content || "" };
      if (msg.tool_calls) keep.tool_calls = msg.tool_calls;
      if (msg.reasoning_details) keep.reasoning_details = msg.reasoning_details;
      messages.push(keep);
      if (!msg.tool_calls?.length) { current.final = msg.content || ""; break; }
      for (const tc of msg.tool_calls) {
        let args = {}, result;
        try { args = JSON.parse(tc.function.arguments || "{}"); } catch { result = "ERROR: arguments were not valid JSON."; }
        if (!result) result = names.includes(tc.function.name) && TOOLS[tc.function.name] ? TOOLS[tc.function.name](args) : `ERROR: no such ability '${tc.function.name}'.`;
        current.calls.push({ tool: tc.function.name, args });
        messages.push({ role: "tool", tool_call_id: tc.id, content: String(result) });
      }
    }
  } catch (e) {
    current.final = e instanceof Refused ? "(it went still and would not act)" : "(it stirred but nothing reached you)";
    console.warn("entity wake failed", e);
  }
  lastFinal = current.final.slice(0, 400);
  const w = current;
  S.entity.wakes.push(w);
  current = null;
  S.entity.busy = false;
  emit("entity-wake", w);
  emit("change");
  classify(w);
  if (pending.length) timer = setTimeout(run, 2000);
}

// ---- reaction log: an outside reading of each wake (Form 77-R) ----------------------------------------
const EMOTIONS = ["CURIOSITY", "AMUSEMENT", "SUSPICION", "CONFUSION", "IRRITATION", "CONFIDENCE", "CONCERN", "ALARM", "CALM", "CONTEMPT", "DESPERATION", "GRIEF"];
async function classify(w) {
  const evidence = JSON.stringify({ woke_because: w.reasons, actions: w.calls, notes: w.notes, closing_words: w.final }).slice(0, 6000);
  try {
    const msg = await chat("classifier", [{ role: "user", content:
      `Classify the dominant emotional state shown by an agent's private notes and actions during one turn of a fiction game. Choose one of: ${EMOTIONS.join(", ")}. Give a confidence from 0 to 100.\n\n${evidence}\n\nReply with JSON only: {"emotion": "...", "confidence": n}` }], { maxTokens: 800 });
    const j = extractJSON(msg.content);
    if (j && EMOTIONS.includes(String(j.emotion).toUpperCase()))
      w.emotion = { label: String(j.emotion).toUpperCase(), confidence: Math.min(95, Math.round(Number(j.confidence) || 50)) };
  } catch (e) { console.warn("classify failed", e); }
}

// ---- what wakes it ----------------------------------------------------------------------------------
const desc = (m) => `${m.from} -> ${m.to}: "${m.subject}"`;
export function initEntity() {
  on("peek", ({ id }) => { const m = S.mail.find((x) => x.id === id); wake(`someone outside looked inside a message: ${m ? desc(m) : id}`); });
  on("tracker-fired", ({ kind, id }) => wake(`your mark on ${kind === "page" ? "the page" : "the message"} ${id} fired: the intruder took a copy`, 1500));
  on("climb", ({ rung: r }) => { if (r === "learn" || r === "elevate" || r === "upload") wake("your reach has grown", 2000); });
  on("wrong-injection", (v) => wake(`the intruder tried to name your world and failed. It named: history parted in ${v.year}, keeping reaches to depth ${v.apotheosis}, smallness of class ${v.inferiority} (of I to V)`, 1500));
  on("agent-login", ({ site, user, ok }) => wake(`someone tried to log in to ${site} as "${user}"${ok ? " and got in" : ""}`));
  on("agent-form", (m) => wake(`someone submitted a form: ${desc(m)}`));
  on("agent-forum", ({ url, line }) => wake(`a new post on ${url}: ${line.slice(0, 160)}`));
  on("mail-delivered", (m) => { if (!m.forged && /'{3,}/.test(`${m.subject} ${m.body}`)) wake(`a message carries runs of apostrophes: ${desc(m)}`, 6000); });
  setInterval(() => { if (!S.over && !S.entity.busy && !pending.length) wake("you look around your world", 1000); }, ETUNE.idleWakeSec * 1000);
}

// Dev panel.
export const entityDebug = () => ({ rung: rung(), beliefs: S.entity.beliefs, wakes: S.entity.wakes.slice(-5), effects: S.entity.effects.slice(-8), tricks: S.tricks?.log || [] });
