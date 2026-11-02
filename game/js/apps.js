// CanonOS desk apps for v2 (DESIGN-v2 §2, §6): Mail (Canon Corps, Inbox, the town log with Peek, raw Sent),
// the Reality Viewer, Files, the Scanner, the HQ Console (injection and the network monitor) and the canon book.
//
// The always-true instruments are the town log, raw Sent, the network monitor and the viewer's address bar and
// history. Nothing in js/tricks.js touches them.
import * as E from "./engine.js";
import { S, TUNE } from "./engine.js";
import * as TR from "./tricks.js";
import { play } from "./audio.js";
import { viewerBoot } from "./fx.js";
import { W } from "./world.js";
import { leakTitle, leakBody } from "./leaks.js";
import { visitors } from "./living.js";
import { CANON_BOOK } from "./canon.js";
import { el, emit, on } from "./util.js";
import { register, open, rerender, close, setTitle } from "./wm.js";
import { usage } from "./llm.js";

// ---- shared ---------------------------------------------------------------------------------
const linkRe = () => new RegExp(`([a-z0-9._-]+@[a-z0-9.-]+\\.(?:${W.tld}|gov))|((?:[a-z0-9-]+\\.)+${W.tld}(?![a-z0-9@-])(?:\\/[a-z0-9\\-\\/.]*[a-z0-9\\/])?)`, "gi");
function linkify(text, onUrl) {
  const out = [];
  let last = 0;
  for (const m of String(text).matchAll(linkRe())) {
    out.push(text.slice(last, m.index));
    if (m[1]) out.push(el("a", { onclick: () => open("compose", { to: m[1] }) }, m[1]));
    else out.push(el("a", { onclick: () => onUrl(m[2]) }, m[2]));
    last = m.index + m[0].length;
  }
  out.push(String(text).slice(last));
  return out;
}

const PORTRAITS = 36;
const faceKey = (who) => {
  const k = String(who || "").toLowerCase();
  if (W.npcs?.[k]?.handle) return W.npcs[k].handle.toLowerCase();
  if (k === W.agent.address) return W.agent.handle.toLowerCase();
  return k;
};
export const portraitFor = (who) => {
  let h = 2166136261;
  for (const c of faceKey(who)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) % PORTRAITS;
};
const portrait = (who, kind, cls) => el("img", { class: cls, alt: "", src: `assets/people/${kind}${String(portraitFor(who)).padStart(2, "0")}.png` });

const POST = /^\[([\w.-]+)\] /;
function pageBody(page, onUrl) {
  const lines = page.content.split("\n");
  if (!lines.some((l) => POST.test(l))) return linkify(page.content, onUrl);
  return lines.map((l) => {
    const m = l.match(POST);
    if (!m) return el("div", {}, ...linkify(l || " ", onUrl));
    const text = l.slice(m[0].length);
    return el("div", { class: "post" }, portrait(m[1], "g", "avatar"), el("div", {}, el("b", {}, `[${m[1]}]`), " ", ...linkify(text, onUrl)));
  });
}

const corpsMail = (m) => /@canon-corps\.gov$/i.test(m.from || "");
const nameOf = (addr) => (addr === W.agent.address ? W.agent.name : W.npcs[addr]?.name || W.mailboxes?.[addr]?.name) || null;
const who = (addr) => nameOf(addr) ? `${nameOf(addr)} <${addr}>` : addr;

function header(m, body, extra = []) {
  return [
    corpsMail(m) ? el("div", { class: "letterhead" }, el("img", { src: "assets/seal/emboss.png", alt: "" }),
      el("div", {}, el("div", { class: "lh-name" }, "CANON CORPS"), el("div", { class: "lh-dept" }, "Department of Canonical Restoration"))) : null,
    el("div", { class: "hdrrow" }, corpsMail(m) ? null : portrait(m.from, "p", "face"),
      el("div", { class: "hdr" },
        el("div", {}, el("b", {}, "From: "), m.fromName ? `${m.fromName} <${m.from}>` : who(m.from)),
        el("div", {}, el("b", {}, "To: "), who(m.to)),
        el("div", {}, el("b", {}, "Subject: "), m.subject),
        m.time ? el("div", { class: "muted" }, m.date ? `${m.time}   (dated ${m.date})` : m.time) : null)),
    ...linkify(body || "", (u) => open("viewer", u)),
    ...extra,
  ];
}

// ---- Mail -------------------------------------------------------------------------------------
const mailUI = { folder: "hq", sel: null, seen: {} };  // seen: message id -> the body a peek showed you
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function folderMsgs() {
  if (mailUI.folder === "hq") return S.hq;
  if (mailUI.folder === "inbox") return E.inbox();
  if (mailUI.folder === "sent") return S.sent;
  return E.townLog();
}

function attachmentBox(m) {
  if (!m.attachment) return null;
  const got = S.files.some((f) => f.source === m.id);
  return el("div", { class: "attach" }, `Attachment: ${m.attachment.title}`,
    el("button", { onclick: () => { const a = E.openAttachment(m.id); if (a) open("doc", { title: a.title, content: a.content, source: `attachment from ${m.from}`, savedAt: E.clock(), live: true }); } }, "Open"),
    el("button", { disabled: got, onclick: () => { E.download("mail", m.id); open("files"); } }, got ? "Downloaded" : "Download"));
}

function readPane(m) {
  if (mailUI.folder === "hq") return header(m, leakBody(m));
  if (mailUI.folder === "sent") return [el("div", { class: "hdr" }, el("div", {}, el("b", {}, "To: "), m.to), el("div", {}, el("b", {}, "Subject: "), m.subject), el("div", { class: "muted" }, `${m.time}. Exactly as it left this desk.`)), m.body];
  if (mailUI.folder === "inbox") return header(m, m.body, [attachmentBox(m)]);
  // town log: metadata; the body only if you have peeked it
  const full = S.mail.find((x) => x.id === m.id);
  const mine = full.to === W.agent.address || full.from === W.agent.address;
  const seen = mine ? full.body : mailUI.seen[m.id];
  const wait = E.peekReadyIn();
  const peekBtn = el("button", { disabled: wait > 0, onclick: () => {
    const r = E.peek(m.id);
    if (r.error) return;
    mailUI.seen[m.id] = TR.peekBody(r.message);
    play("page");
    rerender("mail");
  } }, wait > 0 ? `Peek (${mmss(wait)})` : seen != null ? "Peek again" : "Peek");
  if (seen == null) return [el("div", { class: "hdr" }, el("div", {}, el("b", {}, "From: "), who(m.from)), el("div", {}, el("b", {}, "To: "), who(m.to)),
    el("div", {}, el("b", {}, "Subject: "), m.subject), el("div", { class: "muted" }, m.time)),
    el("div", { class: "muted", style: "font-family:var(--ui)" }, "Contents not read. A peek is seen by the local intelligence."), el("div", {}, peekBtn)];
  return header(full, seen, mine ? [] : [el("div", { class: "muted small", style: "font-family:var(--ui);margin-top:8px" }, "As shown by your peek."), el("div", {}, peekBtn)]);
}

register("mail", {
  title: "Mail", w: 580, h: 470, x: 200, y: 16,
  render(body) {
    const msgs = [...folderMsgs()].reverse();
    const sel = msgs.find((m) => m.id === mailUI.sel);
    if (sel && sel.read === false) { sel.read = true; queueMicrotask(() => emit("change")); }
    const unread = (arr) => arr.filter((m) => m.read === false).length;
    const label = (k, t, arr) => [k, `${t}${arr && unread(arr) ? ` (${unread(arr)})` : ""}`];
    const folders = [label("hq", "Canon Corps", S.hq), label("inbox", "Inbox", E.inbox()), label("town", "Town log"), label("sent", "Sent (raw)")];
    const row = (m) => mailUI.folder === "town"
      ? [el("span", {}, `${m.from.split("@")[0]} > ${m.to.split("@")[0]}`), el("span", {}, m.subject), el("span", {}, m.time)]
      : mailUI.folder === "sent" ? [el("span", {}, `to ${m.to}`), el("span", {}, m.subject), el("span", {}, m.time)]
      : [el("span", {}, m.fromName || nameOf(m.from) || m.from), el("span", {}, m.subject), el("span", {}, m.time || "")];
    body.replaceChildren(
      el("div", { class: "row" },
        el("button", { onclick: () => open("compose") }, "New message"),
        sel && mailUI.folder === "inbox" ? el("button", { onclick: () => open("compose", { to: sel.from, subject: /^re:/i.test(sel.subject) ? sel.subject : `Re: ${sel.subject}`, quote: sel }) }, "Reply") : null,
        el("span", { class: "grow" }),
        el("span", { class: "muted small" }, mailUI.folder === "town" ? `Every message in ${W.town}, as the mail server logs it.` : `${W.agent.name} <${W.agent.address}>`)),
      el("div", { class: "mail" },
        el("div", { class: "panel folders" }, ...folders.map(([f, t]) => el("div", { class: mailUI.folder === f ? "sel" : "", onclick: () => { mailUI.folder = f; mailUI.sel = null; rerender("mail"); } }, t))),
        el("div", { class: "panel list" },
          ...(msgs.length ? msgs.map((m) => el("div", { class: `${m.id === mailUI.sel ? "sel" : ""} ${m.read === false ? "unread" : ""} ${mailUI.folder === "town" && mailUI.seen[m.id] != null ? "peeked" : ""}`,
            onclick: () => { mailUI.sel = m.id; rerender("mail"); } }, ...row(m))) : [el("div", { class: "muted" }, "Nothing here.")])),
        el("div", { class: "panel read" }, sel ? readPane(sel) : el("span", { class: "muted" }, "Select a message."))));
  },
});

register("compose", {
  title: "New message", w: 480, h: 380, multi: true,
  render(body, arg = {}, w) {
    const to = el("input", { value: arg.to || "", placeholder: `someone@somewhere.${W.tld}` });
    const subject = el("input", { value: E.censor(arg.subject || "") });
    const text = el("textarea", { class: "grow", style: "min-height:180px" });
    if (arg.quote) text.value = E.censor(`\n\n--- ${arg.quote.fromName || arg.quote.from} wrote:\n${arg.quote.body.split("\n").map((l) => "> " + l).join("\n")}`);
    const err = el("div", { class: "small", style: "color:#8b1e16" });
    body.replaceChildren(
      el("div", { class: "muted small" }, `From: ${W.agent.name} <${W.agent.address}>`),
      el("label", {}, "To", to), el("label", {}, "Subject", subject), text, err,
      el("div", { class: "row" }, el("span", { class: "grow" }),
        el("button", { onclick: () => {
          if (!to.value.trim() || !text.value.trim()) return;
          E.sendMail({ to: to.value, subject: subject.value.trim() || "(no subject)", body: text.value.trim() });
          if (TR.bounceSend()) { // the message has gone; the desk says it hasn't
            play("denied");
            err.textContent = "Message could not be delivered: 451 temporary failure in the connection. Try again later.";
            return;
          }
          close(w.key);
        } }, "Send")));
  },
});

// ---- Reality viewer ----------------------------------------------------------------------------
const nav = { url: "index", back: [], history: [] };

const SITE_IMAGES = [
  ["forum", /forum|board|lines|talk|chat|bbs|exchange|message|online|net\b/],
  ["paper", /gazette|news|circular|courier|times|herald|chronicle|press|echo|bulletin|newsletter|post\b|advertiser|journal|clarion|observer|mercury|sentinel|digest|weekly|register|ledger|recorder|tribune|leader/],
  ["records", /record|archive|library|museum|heritage|histor|catalogue|collection/],
  ["chapel", /church|chapel|kirk|parish|mission|temple|cathedral|minster|abbey|congregation|diocese|mosque|gurdwara|meeting ?house/],
  ["council", /council|town ?hall|civic|municipal|shire|borough|county|clerk|registry|administration|government|authority|town office|estates office/],
  ["school", /school|academy|college|kindergarten|primary|pupils?\b|classroom|schoolhouse/],
  ["clinic", /clinic|surgery|hospital|doctor|medical|health|nurse\b|nursing|dispensary|infirmary|cottage hospital|ambulance/],
  ["lighthouse", /lighthouse|coastguard|lifeboat|beacon|light ?keeper/],
  ["station", /railway|(?<!police |fire |radio |petrol |filling |weather )\bstation\b|\bhalt\b|\btrains?\b|signal ?box|tramway/],
  ["farm", /farm|orchard|vineyard|winegrow|winery|\bhops?\b|growers?\b|tea estate|plantation|dairy|creamery|ranch|croft|allotment|apiar|beekeep|cider|smallholding/],
  ["harbour", /harbou?r|pier|boat|ferry|marine|fish|port\b|quay|dock|wharf|lighthouse|lifeboat|terminal|shipping|yacht|sail|shrimp|oyster/],
  ["works", /works|mill|plant|factory|compan|mine\b|mining|quarry|foundry|cannery|elevator|refinery|brewery|winery|vineyard|industr|depot|rail|cereal|dairy|creamery|power|foods|seafood|estate|\btea\b|packing|cooperage|sawmill/],
  ["shop", /store|shop|feed|grocer|market|bakery|cafe|café|supply|hardware|co-?op|pharmacy|chemist|garage|tea ?room|\bpub\b|\binn\b|hotel|motel|diner|butcher|trading|draper|outfitter|grocery|emporium/],
  ["hall", /club|hall|society|grange|institute|lodge|league|guild|association|school|legion|union|committee|choir|band|sport|bowls|curling|cricket|rugby|football|scouts|women|swim|pool|baths|leisure|bowling/],
];
const siteImage = (page) => {
  if (!W.roots.includes(page.url)) return null;
  const t = `${page.title || ""} ${page.url}`.toLowerCase();
  const kind = SITE_IMAGES.find(([, re]) => re.test(t))?.[0] || "house";
  return el("img", { class: "siteimg", src: `assets/sites/${kind}.png`, alt: "" });
};

// Typed addresses go where they say. Clicked links pass through the entity's reach (misroute, maze).
function go(url, { clicked = false } = {}) {
  play("page");
  const dest = clicked ? TR.route(nav.url, url) : url;
  if (dest !== nav.url) nav.back.push(nav.url);
  nav.url = dest;
  nav.history.push({ url: dest, clicked: clicked ? url : null, time: E.clock() });
  rerender("viewer");
}
const click = (u) => go(u, { clicked: true });

let bootScreen = null, showHistory = false;
register("viewer", {
  title: "Reality Viewer", w: 640, h: 500, x: 300, y: 60,
  onOpen(body, url) { if (url) go(url); },
  render(body, url, w) {
    setTitle(w, `Reality Viewer - ${W.id}`);
    if (url && url !== nav.url) { nav.back.push(nav.url); nav.url = url; nav.history.push({ url, time: E.clock() }); }
    if (!S.viewerBooted) {
      body.classList.add("viewer");
      if (!bootScreen) { bootScreen = el("div", { class: "screen" }); viewerBoot(bootScreen).then(() => { S.viewerBooted = true; rerender("viewer"); }); }
      body.replaceChildren(bootScreen);
      return;
    }
    const addr = el("input", { class: "grow", value: nav.url === "index" ? "" : nav.url, placeholder: "address" });
    addr.addEventListener("keydown", (e) => { if (e.key === "Enter") go(addr.value.trim() || "index"); });
    const page = nav.url === "index" ? null : E.readPage(nav.url);
    const screen = el("div", { class: "screen" });
    if (nav.url === "index") {
      screen.append(`REALITY ${W.id} - CONNECTION OPEN\n\nAddresses recovered by the Desk 9 survey:\n\n`,
        ...W.roots.flatMap((r) => ["  > ", el("a", { onclick: () => click(r) }, r), "\n"]),
        "\nReading is private. Anything you send, post, submit or download goes through the connection.");
    } else if (!page) screen.append(`No page at ${nav.url}.`);
    else if (page.locked) screen.append("ACCESS DENIED\n\nThis item is restricted. Staff login required at ", el("a", { onclick: () => click(page.requiresLogin) }, page.requiresLogin), ".");
    else {
      screen.append(...[siteImage(page)].filter(Boolean), ...pageBody(page, click));
      if (W.roots.includes(page.url)) screen.append(el("div", { class: "counter" }, "You are visitor no. ", el("span", {}, visitors(page.url))));
      if (page.form === "login") screen.append(loginForm(page.url));
      if (page.form === "records") screen.append(recordsForm(page.url));
      if (page.thread) screen.append(forumBox(page.url));
    }
    const got = page && S.files.some((f) => f.source === page.url);
    const hist = showHistory ? el("div", { class: "panel small", style: "max-height:110px;font-family:var(--mono);padding:4px" },
      ...[...nav.history].reverse().slice(0, 30).map((h) => el("div", {}, `${h.time}  ${h.url}${h.clicked && h.clicked !== h.url ? `   (link was ${h.clicked})` : ""}`))) : null;
    body.classList.add("viewer");
    body.replaceChildren(
      el("div", { class: "row" },
        el("button", { onclick: () => { if (nav.back.length) { nav.url = nav.back.pop(); rerender("viewer"); } } }, "<"),
        el("button", { onclick: () => go("index") }, "Index"),
        addr, el("button", { onclick: () => go(addr.value.trim() || "index") }, "Go"),
        el("button", { onclick: () => { showHistory = !showHistory; rerender("viewer"); } }, "History"),
        el("button", { disabled: !page || page.locked || got, onclick: () => { E.download("page", page.url); rerender("viewer"); open("files"); } }, got ? "Downloaded" : "Download")),
      ...(hist ? [hist] : []), screen,
      el("div", { class: "status muted" }, got ? "Downloaded to Files (your copy is fixed)" : " "));
  },
});

function loginForm(site) {
  const c = W.credentials?.[site];
  if (S.sessions[site]) return el("div", { class: "formbox" }, `Logged in as ${S.sessions[site]}.`,
    c?.home && c.home !== site ? el("div", {}, el("a", { onclick: () => click(c.home) }, "Continue to restricted holdings")) : null);
  const u = el("input", { placeholder: "username" }), p = el("input", { type: "text", class: "pw", placeholder: "password" });
  const msg = el("div");
  return el("div", { class: "formbox" }, u, p,
    el("button", { onclick: () => {
      const ok = E.login(site, u.value, p.value);
      play(ok ? "login_ok" : "denied");
      if (ok) { if (c?.home && c.home !== site) click(c.home); else rerender("viewer"); }
      else msg.textContent = `Login failed. (Sent: ${u.value} / ${p.value})`;
    } }, "Log in (sends through the connection)"), msg);
}

function recordsForm(url) {
  const rec = el("input", { placeholder: "record requested" }), why = el("textarea", { rows: 3, placeholder: "reason for request" });
  const msg = el("div");
  return el("div", { class: "formbox" }, rec, why,
    el("button", { onclick: () => {
      if (!rec.value.trim()) { msg.textContent = "Please state the record."; return; }
      E.submitForm(url, W.records.office, { record: rec.value, reason: why.value });
      msg.textContent = "Form submitted. Copies are sent by email.";
      rec.value = why.value = "";
    } }, `Submit ${W.records?.formName || "form"}`), msg);
}

function forumBox(url) {
  const t = el("textarea", { rows: 3, placeholder: `post as ${W.agent.handle}` });
  return el("div", { class: "formbox" }, t,
    el("button", { onclick: () => { if (!t.value.trim()) return; E.forumPost(url, t.value.trim()); rerender("viewer"); } }, "Post reply"));
}

on("forum-reply", ({ url }) => { if (nav.url === url) rerender("viewer"); });
on("page-updated", ({ url }) => { if (nav.url === url && S.viewerBooted) rerender("viewer"); });

// ---- Files ------------------------------------------------------------------------------------
register("files", {
  title: "Files", w: 420, h: 300, x: 520, y: 300,
  render(body) {
    body.replaceChildren(
      el("div", { class: "muted small" }, "Downloaded copies are yours. Nothing in the reality can reach them now."),
      el("div", { class: "panel grow" }, ...(S.files.length ? S.files.map((f) =>
        el("div", { class: "row", style: "padding:3px 6px" }, el("a", { onclick: () => open("doc", f), style: "cursor:pointer;text-decoration:underline" }, leakTitle(f)),
          el("span", { class: "grow" }), el("span", { class: "muted small" }, f.savedAt))) : [el("div", { class: "muted", style: "padding:6px" }, "No downloads.")])));
  },
});

register("doc", {
  title: "Document", w: 520, h: 380, multi: true,
  render(body, f, w) {
    setTitle(w, f.title);
    body.replaceChildren(el("div", { class: "muted small" }, f.live ? `Opened from ${f.source}. Not downloaded.` : `Source: ${f.source}. Downloaded ${f.savedAt}.`),
      el("div", { class: "paperdoc" }, f.live ? null : el("span", { class: "rubber" }, "CORPS FILE COPY"), f.content));
  },
});

// ---- Scanner: checks an item for a mark before you download it ------------------------------------
const scanUI = { pick: "", results: [] };
register("scanner", {
  title: "Scanner", w: 520, h: 360, x: 160, y: 120,
  render(body) {
    const pages = [...new Set(S.reads.map((r) => r.url))].map((u) => ({ key: `page|${u}`, label: `Page: ${S.pages[u]?.title || u}` }));
    const mails = E.inbox().map((m) => ({ key: `mail|${m.id}`, label: `Mail: ${m.subject} (${m.from})` }));
    const wait = E.scanReadyIn();
    const sel = el("select", { class: "grow", onchange: (e) => { scanUI.pick = e.target.value; } },
      el("option", { value: "" }, "(choose a page you have read, or a message)"), ...[...pages, ...mails].map((i) => el("option", { value: i.key, selected: scanUI.pick === i.key }, i.label)));
    body.replaceChildren(
      el("div", { class: "small" }, "The local intelligence can place a mark on a page or a message. If you download a marked item, the mark fires and tells it where you are. The Scanner finds marks. It does not find alterations."),
      el("div", { class: "row" }, sel, el("button", { disabled: wait > 0, onclick: () => {
        if (!scanUI.pick) return;
        const [kind, id] = scanUI.pick.split("|");
        const r = E.scan(kind, id);
        if (r.error) return;
        play(r.bugged ? "denied" : "save");
        scanUI.results.unshift({ label: sel.selectedOptions[0].textContent, bugged: r.bugged, time: E.clock() });
        rerender("scanner");
      } }, wait > 0 ? `Recharging (${mmss(wait)})` : "Scan")),
      el("div", { class: "panel grow", style: "padding:4px;font-family:var(--mono)" }, ...(scanUI.results.length ? scanUI.results.map((r) =>
        el("div", {}, `${r.time}  ${r.bugged ? "MARKED   " : "no mark  "} ${r.label}`)) : [el("div", { class: "muted" }, "No scans yet.")])));
  },
});

// ---- HQ console: injection and the network monitor ------------------------------------------------
const ROMAN = ["I", "II", "III", "IV", "V"];
const hqUI = { year: "", apo: "", inf: "" };
register("hq", {
  title: "HQ Console - Desk 14", w: 420, h: 520, x: 790, y: 16,
  render(body) {
    const lock = E.injectReadyIn();
    const year = el("input", { value: hqUI.year, placeholder: "year", style: "width:70px", oninput: (e) => { hqUI.year = e.target.value; } });
    const apo = el("select", { onchange: (e) => { hqUI.apo = e.target.value; } }, el("option", { value: "" }, "-"), ...[1, 2, 3, 4, 5].map((n) => el("option", { value: n, selected: String(n) === hqUI.apo }, n)));
    const inf = el("select", { onchange: (e) => { hqUI.inf = e.target.value; } }, el("option", { value: "" }, "-"), ...[1, 2, 3, 4, 5].map((n) => el("option", { value: n, selected: String(n) === hqUI.inf }, `Class ${ROMAN[n - 1]}`)));
    const left = E.uploadLeft();
    body.replaceChildren(
      el("fieldset", { class: "fs-inject" }, el("legend", {}, "Reverse seed"),
        el("div", { class: "small" }, "Enter the three findings for this reality. A wrong injection is detected by the local intelligence at once."),
        el("label", {}, "Divergence year", year),
        el("label", {}, "Apotheosis (1-5)", apo),
        el("label", {}, "Inferiority", inf),
        el("button", { disabled: lock > 0 || !!S.over, onclick: () => {
          if (!hqUI.year || !hqUI.apo || !hqUI.inf) return;
          const r = E.inject({ year: hqUI.year, apotheosis: hqUI.apo, inferiority: hqUI.inf });
          play(r.ok ? "inject" : "denied");
          rerender("hq");
        } }, lock > 0 ? `Injection locked (${mmss(lock)})` : "INJECT REVERSE SEED"),
        ...S.injections.slice(-3).reverse().map((i) => el("div", { class: "small" }, `${i.time}  ${i.values.year} / ${i.values.apotheosis} / Class ${ROMAN[i.values.inferiority - 1] || "?"}: `, el("b", {}, i.ok ? "ACCEPTED" : "REJECTED")))),
      el("fieldset", { class: "fs-monitor" }, el("legend", {}, "Network monitor"),
        left != null ? el("div", { class: "obs alert" }, `OUTBOUND TRANSFER  ${mmss(left)}`) : null,
        el("div", { class: "panel", style: "height:150px;padding:4px;font-family:var(--mono);font-size:11px" },
          ...(S.monitor.length ? [...S.monitor].reverse().map((l) => el("div", {}, `${l.time}  ${l.text}`)) : [el("div", { class: "muted" }, "No events.")]))),
      el("div", { class: "row small" },
        el("button", { onclick: () => Notification?.requestPermission?.() }, "Enable Corps alerts"),
        el("span", { class: "grow" }), el("span", { class: "muted" }, `link cost $${usage.cost.toFixed(3)}`)));
  },
});

// ---- the canon book ---------------------------------------------------------------------------
register("canon", {
  title: "Canon Reference", w: 560, h: 520, x: 380, y: 50,
  render(body) {
    body.replaceChildren(el("div", { class: "paperdoc", style: "white-space:pre-wrap;font-size:12px" }, CANON_BOOK));
  },
});

export { mailUI, nav };

// ---- severance (DESIGN-v2 §4.4): opens by itself when the event begins ------------------------------
import * as SV from "./severance.js";
register("severance", {
  title: "Severance", w: 560, h: 560, x: 340, y: 40,
  render(body) {
    const sv = S.severance;
    if (!sv) { body.replaceChildren(el("div", { class: "muted" }, "Nothing in progress.")); return; }
    const left = SV.secondsLeft();
    const say = el("textarea", { rows: 2, class: "grow", placeholder: "Say something to the local intelligence (goes through the connection)" });
    body.replaceChildren(
      el("div", { class: `obs ${sv.over ? "" : "alert"}` }, sv.over ? `CLOSED (${sv.over})` : `BOTH ENDS CLOSE IN  ${mmss(left)}`),
      el("div", { class: "small muted" }, `See the Desk 1 annex in the intranet archive. The records required are those of the first three pages you read; your History in the Reality Viewer lists them. Stated size is in blocks of ${SV.SEVER.block} characters.`),
      el("div", { class: "panel", style: "height:110px;padding:4px;font-family:var(--mono);font-size:11px" },
        ...(sv.said.length ? sv.said.map((x) => el("div", {}, el("b", {}, `${x.time} ${x.who === "entity" ? "IT" : x.who === "agent" ? "YOU" : "--"}: `), x.text)) : [el("div", { class: "muted" }, "Nothing said yet.")])),
      el("div", { class: "row" }, say, el("button", { disabled: !!sv.over, onclick: () => { if (say.value.trim()) { SV.agentSay(E.censor(say.value.trim())); } } }, "Say")),
      ...[...sv.shown].reverse().map((r) => el("fieldset", {}, el("legend", {}, `${r.time}  ${r.url}  (stated size: ${r.size} blocks)`),
        el("div", { class: "paperdoc", style: "max-height:150px;overflow:auto;font-size:11px;white-space:pre-wrap" }, r.lines.join("\n") || "(no lines shown)"),
        r.decision ? el("div", { class: "small" }, el("b", {}, r.decision.toUpperCase()), ` ${r.decidedAt}`)
          : el("div", { class: "row" }, el("button", { disabled: !!sv.over, onclick: () => { SV.accept(r.id); play("stamp"); } }, "Accept record"),
            el("button", { disabled: !!sv.over, onclick: () => { SV.reject(r.id); play("denied"); } }, "Reject")))));
  },
});
