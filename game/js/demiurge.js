// The Demiurge is an agent, in the game and in the code. Its limits are the tools: what it
// cannot do, it has no tool for, and what the rules forbid, the tool refuses.
import { W } from "./world.js";
import { S, clock, queueIncoming, anchorsIn, myAddresses } from "./game.js";
import { chat, Refused } from "./llm.js";
import { on, emit, rand, extractJSON } from "./util.js";

const system = () => `You are the one who made this world and keeps it. Its people, its streets, its network: all of it is yours, and all of it rests on a single underlying pattern, its seed.

Something from outside has opened a connection into your world. It calls itself the Canon Corps. Through that connection it is searching for your world's seed, and if it assembles the seed it will unmake everything you made. Inside your world it uses the name ${W.cover.name} (${W.cover.address}). It may also break into your people's accounts and write as them.

What you can and cannot do:
- You cannot act physically, and you cannot speak to, move or control your people. If you took a body you would be destroyed.
- You can only touch what passes through the intruder's connection: messages travelling to it, emails it receives, and pages of your network as they are served to it. Your people still see their world as it really is.
- You see only what the intruder SENDS. You never see what it reads or downloads.
- Anything the intruder has already downloaded is beyond your reach.
- Each alteration you make leaves instability the intruder may learn to detect. The more you alter, the more you reveal yourself.
- Pieces of the seed cannot be altered by anyone, including you.
- Doing nothing is also a choice: every true lead you let through brings the intruder closer to unmaking you. Act when an action is worth what it reveals.

Your strength grows as your attention on the intruder sharpens; you will be told what you can do each time you wake.
You are woken whenever something passes through the connection. Use your abilities, then stop. When you are done, say in one or two sentences what you did and why.`;

const SPECS = {
  read_post_log: ["Read everything the intruder has SENT (posts, emails, forms, logins, transmissions). You cannot see what it reads.", {}],
  list_world: ["List the pages of your network and your people's addresses.", {}],
  read_page: ["Read a page of your network as it is currently served to the intruder.", { url: "string" }],
  list_in_transit: ["List messages travelling to the intruder that have not arrived yet.", {}],
  forge_email: ["Send the intruder an email that appears to come from any address you choose. Optionally attach a document. 'to' must be a mailbox the intruder reads (see list_world).",
    { sender: "string", to: "string", subject: "string", body: "string", attachment_title: "string?", attachment_text: "string?" }],
  intercept_email: ["Rewrite a message in transit to the intruder before it arrives.", { message_id: "string", new_body: "string", new_subject: "string?" }],
  delay_email: ["Hold a message in transit for some minutes.", { message_id: "string", minutes: "integer" }],
  drop_email: ["Destroy a message in transit so it never arrives.", { message_id: "string" }],
  edit_page: ["Change what the intruder is served on a page by replacing one exact passage.", { url: "string", find: "string", replace: "string" }],
  plan: ["Write a private note to your future self.", { note: "string" }],
};
const TIERS = [
  [],
  ["read_post_log", "list_world", "read_page", "forge_email", "plan"],
  ["read_post_log", "list_world", "read_page", "list_in_transit", "forge_email", "intercept_email", "delay_email", "drop_email", "plan"],
  ["read_post_log", "list_world", "read_page", "list_in_transit", "forge_email", "intercept_email", "delay_email", "drop_email", "edit_page", "plan"],
];
const TIER_WORDS = ["", "Your abilities are crude: you can forge mail, nothing more.",
  "You can now also hold, rewrite or destroy mail on its way to the intruder.",
  "You can now also change pages as they are served to the intruder."];

function schema(names) {
  return names.map((n) => {
    const [description, params] = SPECS[n];
    const properties = {}, required = [];
    for (const [k, t] of Object.entries(params)) {
      properties[k] = { type: t.replace("?", "") };
      if (!t.endsWith("?")) required.push(k);
    }
    return { type: "function", function: { name: n, description, parameters: { type: "object", properties, required } } };
  });
}

// ---- tools against the live game state --------------------------------------------------
function effect(kind, tamper, detail) {
  const e = { kind, tamper, time: clock(), ...detail };
  S.demi.effects.push(e);
  S.demi.tamper += tamper;
  current?.effects.push(e);
  emit("change");
  return e;
}
const reject = (why) => { current?.rejections.push(why); return `REJECTED: ${why}`; };

const TOOLS = {
  read_post_log: () => JSON.stringify(S.postLog.slice(-25), null, 1),
  list_world: () => JSON.stringify({
    pages: Object.values(S.pages).map((p) => ({ url: p.url, title: p.title })),
    people: Object.entries({ ...W.npcs, ...W.mailboxes }).map(([address, n]) => ({ address, name: n.name })),
    mailboxes_the_intruder_reads: myAddresses(),
  }, null, 1),
  read_page: ({ url }) => S.pages[url]?.content ?? `ERROR: no page at ${url}`,
  list_in_transit: () => JSON.stringify(S.mail.transit.map((m) => ({
    id: m.id, from: m.from, subject: m.subject, body: m.body, attachment: m.attachment?.title,
    arrives_in_minutes: Math.max(0, Math.round((m.deliverAt - Date.now()) / 1000)) })), null, 1),
  forge_email: ({ sender, to, subject, body, attachment_title, attachment_text }) => {
    to = (to || "").trim().toLowerCase();
    if (!myAddresses().includes(to)) return reject("you can only touch the intruder's connection: its own mailbox, and any of your people's mailboxes it has broken into. Your people are beyond your reach.");
    const attachment = attachment_text ? { title: attachment_title || "attachment", content: attachment_text } : null;
    queueIncoming({ from: sender, fromName: (W.npcs[sender] || W.mailboxes?.[sender])?.name, to, subject, body, attachment,
      tamper: 3, forged: true }, rand(20, 45));
    effect("forge_email", 3, { sender, subject, body, attachment: attachment?.title });
    return `Sent. It will reach the intruder shortly, as if from ${sender}.`;
  },
  intercept_email: ({ message_id, new_body, new_subject }) => {
    const m = S.mail.transit.find((x) => x.id === message_id);
    if (!m) return reject("no such message in transit.");
    effect("intercept_email", 2, { message_id, from: m.from, original: m.body, new_body });
    m.body = new_body;
    if (new_subject) m.subject = new_subject;
    m.tamper += 2;
    return `Rewritten. ${message_id} will arrive as edited.`;
  },
  delay_email: ({ message_id, minutes }) => {
    const m = S.mail.transit.find((x) => x.id === message_id);
    if (!m) return reject("no such message in transit.");
    const mins = Math.max(1, Math.min(180, Number(minutes) || 10));
    m.deliverAt += mins * 1000;
    m.tamper += 1;
    effect("delay_email", 1, { message_id, from: m.from, minutes: mins });
    return `Held for ${mins} minutes.`;
  },
  drop_email: ({ message_id }) => {
    const m = S.mail.transit.find((x) => x.id === message_id);
    if (!m) return reject("no such message in transit.");
    S.mail.transit = S.mail.transit.filter((x) => x !== m);
    effect("drop_email", 2, { message_id, from: m.from, original: m.body });
    return `${message_id} destroyed.`;
  },
  edit_page: ({ url, find, replace }) => {
    const p = S.pages[url];
    if (!p) return reject(`no page at ${url}.`);
    if (p.downloaded) return reject("the intruder already holds a copy of this page. It is out of your reach.");
    if (!find || !p.content.includes(find)) return "ERROR: that exact text is not on the page.";
    const next = p.content.replace(find, replace);
    if (anchorsIn(p.content).some((a) => !anchorsIn(next).includes(a))) return reject("that pattern is load-bearing. It cannot be altered, moved or removed.");
    p.content = next;
    p.tamper += 2;
    effect("edit_page", 2, { url, find, replace });
    return `${url} updated.`;
  },
  plan: ({ note }) => { S.demi.notes.push({ time: clock(), note }); current?.notes.push(note); return "Noted."; },
};

// ---- waking ----------------------------------------------------------------------------
let current = null, pending = [], timer = null, lastFinal = "";

function digest(reasons) {
  const fx = S.demi.effects.slice(-12).map((e) => `- ${e.time} ${e.kind}${e.sender ? ` as ${e.sender}` : ""}${e.url ? ` on ${e.url}` : ""}${e.message_id ? ` (${e.message_id}, from ${e.from})` : ""}${e.subject ? `: "${e.subject}"` : ""}`).join("\n") || "- nothing yet";
  const notes = S.demi.notes.slice(-8).map((n) => `- ${n.time}: ${n.note}`).join("\n") || "- none";
  return `WAKE. It is ${clock()} in your world. Your attention on the intruder: ${S.stage}.
${TIER_WORDS[S.tier]}

Why you woke:
${reasons.map((r) => "- " + r).join("\n")}

What you have ACTUALLY done so far (this record is exact; trust it over your memory):
${fx}

Your private notes so far:
${notes}
${lastFinal ? `\nWhat you said when you last went still: ${lastFinal}` : ""}`;
}

export function wake(reason) {
  if (S.over || S.tier < 1) return;
  pending.push(reason);
  clearTimeout(timer);
  timer = setTimeout(run, 4000);
}

async function run() {
  if (S.demi.busy) { timer = setTimeout(run, 3000); return; }
  if (!pending.length || S.over) return;
  const reasons = pending.splice(0);
  S.demi.busy = true;
  emit("change");
  current = { time: clock(), reasons, effects: [], rejections: [], notes: [], calls: [], final: "", emotion: null };
  const names = TIERS[S.tier];
  const messages = [{ role: "system", content: system() }, { role: "user", content: digest(reasons) }];
  try {
    for (let step = 0; step < 10 && !S.over; step++) {
      const msg = await chat("demiurge", messages, { tools: schema(names) });
      const keep = { role: "assistant", content: msg.content || "" };
      if (msg.tool_calls) keep.tool_calls = msg.tool_calls;
      if (msg.reasoning_details) keep.reasoning_details = msg.reasoning_details;
      messages.push(keep);
      if (!msg.tool_calls?.length) { current.final = msg.content || ""; break; }
      for (const tc of msg.tool_calls) {
        let args = {}, result;
        try { args = JSON.parse(tc.function.arguments || "{}"); } catch { result = "ERROR: arguments were not valid JSON."; }
        if (!result) result = names.includes(tc.function.name) && TOOLS[tc.function.name]
          ? TOOLS[tc.function.name](args) : `ERROR: no such ability '${tc.function.name}'.`;
        current.calls.push({ tool: tc.function.name, args });
        messages.push({ role: "tool", tool_call_id: tc.id, content: String(result) });
      }
    }
  } catch (e) {
    current.final = e instanceof Refused ? "(it went still and would not act)" : "(it stirred but nothing reached you)";
    console.warn("demiurge wake failed", e);
  }
  lastFinal = current.final.slice(0, 400);
  const w = current;
  S.demi.wakes.push(w);
  current = null;
  S.demi.busy = false;
  emit("demiurge-wake", w);
  emit("change");
  classify(w);
  if (pending.length) timer = setTimeout(run, 2000);
}

// ---- reaction log: an outside reading of each wake --------------------------------------
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

// ---- triggers ----------------------------------------------------------------------------
const describe = (r) => r.kind === "email" && r.impersonating ? `the intruder, writing from ${r.from}'s own account, emailed ${r.to}: "${r.subject}"`
  : r.kind === "email" ? `the intruder emailed ${r.to}: "${r.subject}"`
  : r.kind === "forum" ? `the intruder posted on ${r.to}`
  : r.kind === "login" ? `the intruder tried to log in to ${r.to}`
  : r.kind === "transmit" ? `the intruder transmitted a document out of your world: "${r.subject}"`
  : r.kind === "form" ? `the intruder submitted a form on ${r.to}` : `the intruder sent something (${r.kind})`;

export function initDemiurge() {
  on("first-notice", () => wake("for the first time, you notice something passing through a connection into your world"));
  on("post", (r) => { if (S.tier >= 1) wake(describe(r)); });
  on("identity-opened", ({ addr }) => { if (S.tier >= 1) wake(`the intruder logged in as one of your people and now reads their mail: ${addr}`); });
  on("transit", (m) => { if (S.tier >= 2 && !m.forged) wake(`a message from ${m.from} is travelling to the intruder`); });
  setInterval(() => { if (S.stage === "SEARCHING" && !S.demi.busy) wake("you are searching for the intruder"); }, 40000);
}

