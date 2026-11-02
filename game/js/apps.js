import { S, TUNE, sendMail, getPage, login, downloadPage, saveFile, post, transmit, canInject, addNotice } from "./game.js";
import { play } from "./audio.js";
import { viewerBoot } from "./fx.js";
import { W } from "./world.js";
import { leakTitle, leakBody } from "./leaks.js";
import { visitors } from "./living.js";
import { el, emit, on } from "./util.js";
import { register, open, rerender, close, setTitle } from "./wm.js";
import { usage } from "./llm.js";

// ---- shared ---------------------------------------------------------------------------------
// Addresses and URLs in the reality's own top-level domain become links.
const linkRe = () => new RegExp(`([a-z0-9._-]+@[a-z0-9.-]+\\.(?:${W.tld}|gov))|((?:[a-z0-9-]+\\.)+${W.tld}(?![a-z0-9@-])(?:\\/[a-z0-9\\-\\/.]*[a-z0-9\\/])?)`, "gi");
function linkify(text, onUrl) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(linkRe())) {
    out.push(text.slice(last, m.index));
    if (m[1]) out.push(el("a", { onclick: () => open("compose", { to: m[1] }) }, m[1]));
    else out.push(el("a", { onclick: () => onUrl(m[2]) }, m[2]));
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

// ---- Mail -------------------------------------------------------------------------------------
// Folders: Canon Corps, the cover's inbox, one per staff account the agent has opened, and sent.
const mailUI = { folder: "hq", sel: null };
const toMe = (addr) => (m) => (m.to || "").toLowerCase() === addr;
const folderList = () => mailUI.folder === "hq" ? S.mail.hq : mailUI.folder === "sent" ? S.mail.sent
  : mailUI.folder === "inbox" ? S.mail.inbox.filter(toMe(W.cover.address))
  : S.mail.inbox.filter(toMe(mailUI.folder));
const folders = () => {
  const unread = (arr) => arr.filter((m) => !m.read).length;
  const mine = S.mail.inbox.filter(toMe(W.cover.address));
  const n = (k, label, arr) => [k, `${label}${unread(arr) ? ` (${unread(arr)})` : ""}`];
  return [n("hq", "Canon Corps", S.mail.hq), n("inbox", "Field inbox", mine),
    ...Object.entries(S.identities).map(([a, id]) => n(a, `${a.split("@")[0]} (${id.active ? "staff" : "closed"})`, S.mail.inbox.filter(toMe(a)))),
    ["sent", "Field sent"]];
};

register("mail", {
  title: "Mail", w: 720, h: 470, x: 140, y: 40,
  render(body) {
    const msgs = [...folderList()].reverse();
    const sel = msgs.find((m) => m.id === mailUI.sel);
    if (sel && "read" in sel && !sel.read) { sel.read = true; emit("change"); }
    const ident = S.identities[mailUI.folder];
    const replyFrom = ident?.active ? mailUI.folder : W.cover.address;
    body.replaceChildren(
      el("div", { class: "row" },
        el("button", { onclick: () => open("compose") }, "New message"),
        sel && mailUI.folder !== "hq" && mailUI.folder !== "sent" ? el("button", { onclick: () => open("compose", { to: sel.from, from: replyFrom, subject: sel.subject.startsWith("Re:") ? sel.subject : `Re: ${sel.subject}`, quote: sel }) }, "Reply") : null,
        el("span", { class: "grow" }),
        el("span", { class: "muted small" }, ident ? (ident.active ? `Staff webmail: ${mailUI.folder}` : `${mailUI.folder}: password changed ${ident.revokedAt}. Closed to you.`) : `Field identity: ${W.cover.name} <${W.cover.address}>`)),
      el("div", { class: "mail" },
        el("div", { class: "panel folders" },
          ...folders()
            .map(([f, label]) => el("div", { class: mailUI.folder === f ? "sel" : "", onclick: () => { mailUI.folder = f; mailUI.sel = null; rerender("mail"); } }, label))),
        el("div", { class: "panel list" },
          ...(msgs.length ? msgs.map((m) => el("div", { class: `${m.id === mailUI.sel ? "sel" : ""} ${m.read === false ? "unread" : ""}`, onclick: () => { mailUI.sel = m.id; rerender("mail"); } },
            el("span", {}, mailUI.folder === "sent" ? `${m.from === W.cover.address ? "" : `[${m.from.split("@")[0]}] `}to ${m.to}` : (m.fromName || m.from)), el("span", {}, m.subject), el("span", {}, m.time || ""))) : [el("div", { class: "muted" }, "Nothing here.")])),
        el("div", { class: "panel read" }, sel ? readPane(sel) : el("span", { class: "muted" }, "Select a message."))));
  },
});

// Townspeople's portraits (assets/people, rendered in Blender by tools/art/blender/portraits.py): 36 faces,
// one per person by a hash of their forum handle, so their mail and their posts show the same face.
const PORTRAITS = 36;
const faceKey = (who) => {
  const k = String(who || "").toLowerCase();
  if (W.npcs?.[k]?.handle) return W.npcs[k].handle.toLowerCase();
  if (W.cover && k === W.cover.address.toLowerCase()) return W.cover.handle.toLowerCase();
  return k;
};
export const portraitFor = (who) => {
  let h = 2166136261;
  for (const c of faceKey(who)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) % PORTRAITS;
};
const portrait = (who, kind, cls) => el("img", { class: cls, alt: "", src: `assets/people/${kind}${String(portraitFor(who)).padStart(2, "0")}.png` });

// Forum threads are "[handle] text" lines: give each post its poster's face, like a BBS avatar.
const POST = /^\[([\w.-]+)\] /;
function pageBody(page, onUrl) {
  const lines = page.content.split("\n");
  if (!lines.some((l) => POST.test(l))) return linkify(page.content, onUrl);
  return lines.map((l) => {
    const m = l.match(POST);
    if (!m) return el("div", {}, ...linkify(l || " ", onUrl));
    const text = l.slice(m[0].length).replace(new RegExp(`^\\[${m[1].replace(/[.-]/g, "\\$&")}\\] `), "");
    return el("div", { class: "post" }, portrait(m[1], "g", "avatar"), el("div", {}, el("b", {}, `[${m[1]}]`), " ", ...linkify(text, onUrl)));
  });
}

// Corps mail is printed on letterhead: the emblem blind-embossed (assets/seal/emboss.png, rendered in Blender).
const corpsMail = (m) => /@canon-corps\.gov$/i.test(m.from || "");

function readPane(m) {
  return [
    corpsMail(m) ? el("div", { class: "letterhead" }, el("img", { src: "assets/seal/emboss.png", alt: "" }),
      el("div", {}, el("div", { class: "lh-name" }, "CANON CORPS"), el("div", { class: "lh-dept" }, "Department of Canonical Restoration"))) : null,
    el("div", { class: "hdrrow" }, corpsMail(m) ? null : portrait(m.from, "p", "face"),
      el("div", { class: "hdr" },
        el("div", {}, el("b", {}, "From: "), m.fromName ? `${m.fromName} <${m.from}>` : m.from),
        el("div", {}, el("b", {}, "To: "), m.to),
        el("div", {}, el("b", {}, "Subject: "), m.subject),
        m.time ? el("div", { class: "muted" }, m.time) : null)),
    ...linkify((m.folder === "hq" ? leakBody(m) : m.body) || "", (u) => open("viewer", u)),
    m.attachment ? el("div", { class: "attach" }, `Attachment: ${m.attachment.title}`,
      el("button", { onclick: () => { saveFile({ title: m.attachment.title, content: m.attachment.content, source: `attachment from ${m.from}`, tamper: m.tamper || 0 }); open("files"); } }, "Save to Files")) : null,
  ];
}

register("compose", {
  title: "New message", w: 480, h: 380, multi: true,
  render(body, arg = {}, w) {
    const to = el("input", { value: arg.to || "", placeholder: `someone@somewhere.${W.tld}` });
    const accounts = [W.cover.address, ...Object.keys(S.identities).filter((a) => S.identities[a].active)];
    const from = el("select", {}, ...accounts.map((a) => el("option", { value: a, selected: a === (arg.from || W.cover.address) },
      a === W.cover.address ? `${W.cover.name} <${a}> (cover)` : `${(W.npcs[a] || W.mailboxes?.[a])?.name || a} <${a}> (staff account)`)));
    const subject = el("input", { value: arg.subject || "" });
    const text = el("textarea", { class: "grow", style: "min-height:180px" });
    if (arg.quote) text.value = `\n\n--- ${arg.quote.fromName || arg.quote.from} wrote:\n${arg.quote.body.split("\n").map((l) => "> " + l).join("\n")}`;
    body.replaceChildren(
      accounts.length > 1 ? el("label", {}, "From", from)
        : el("div", { class: "muted small" }, `From: ${W.cover.name} <${W.cover.address}>. Sending goes through the connection.`),
      el("label", {}, "To", to), el("label", {}, "Subject", subject), text,
      el("div", { class: "row" }, el("span", { class: "grow" }),
        el("button", { onclick: () => {
          if (!to.value.trim() || !text.value.trim()) return;
          sendMail({ to: to.value.trim().toLowerCase(), from: from.value, subject: subject.value.trim() || "(no subject)", body: text.value.trim() });
          close(w.key);
        } }, "Send")));
  },
});

// ---- Reality viewer ----------------------------------------------------------------------------
const nav = { url: "index", back: [] };

// A dithered landmark at the top of each site's home page (assets/sites/, rendered in Blender), picked by words
// in the page title and address. Generated towns name their sites freely, so this is a guess; a house if nothing fits.
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
  ["works", /works|mill|plant|factory|compan|mine\b|mining|quarry|foundry|cannery|elevator|refinery|brewery|winery|vineyard|industr|depot|rail|cereal|dairy|creamery|power|foods|seafood|estate|\\btea\\b|packing|cooperage|sawmill/],
  ["shop", /store|shop|feed|grocer|market|bakery|cafe|café|supply|hardware|co-?op|pharmacy|chemist|garage|tea ?room|\bpub\b|\binn\b|hotel|motel|diner|butcher|trading|draper|outfitter|grocery|emporium/],
  ["hall", /club|hall|society|grange|institute|lodge|league|guild|association|school|legion|union|committee|choir|band|sport|bowls|curling|cricket|rugby|football|scouts|women|swim|pool|baths|leisure|bowling/],
];
const siteImage = (page) => {
  if (!W.roots.includes(page.url)) return null;
  const t = `${page.title || ""} ${page.url}`.toLowerCase();
  const kind = SITE_IMAGES.find(([, re]) => re.test(t))?.[0] || "house";
  return el("img", { class: "siteimg", src: `assets/sites/${kind}.png`, alt: "" });
};

function go(url) {
  play("page");
  if (url !== nav.url) nav.back.push(nav.url);
  nav.url = url;
  rerender("viewer");
}

let bootScreen = null;
register("viewer", {
  title: "Reality Viewer", w: 640, h: 500, x: 300, y: 60,
  onOpen(body, url) { if (url) go(url); },
  render(body, url, w) {
    setTitle(w, `Reality Viewer - ${W.id}`);
    if (url) { if (url !== nav.url) nav.back.push(nav.url); nav.url = url; }
    if (!S.viewerBooted) {
      body.classList.add("viewer");
      if (!bootScreen) {
        bootScreen = el("div", { class: "screen" });
        viewerBoot(bootScreen).then(() => { S.viewerBooted = true; rerender("viewer"); });
      }
      body.replaceChildren(bootScreen);
      return;
    }
    const addr = el("input", { class: "grow", value: nav.url === "index" ? "" : nav.url, placeholder: "address" });
    addr.addEventListener("keydown", (e) => { if (e.key === "Enter") go(addr.value.trim() || "index"); });
    const page = nav.url === "index" ? null : getPage(nav.url);
    const screen = el("div", { class: "screen" });
    let status = "";
    if (nav.url === "index") {
      screen.append(`REALITY ${W.id} - CONNECTION OPEN\n\nAddresses recovered by the Desk 9 survey:\n\n`,
        ...W.roots.flatMap((r) => ["  > ", el("a", { onclick: () => go(r) }, r), "\n"]),
        "\nReading is private. Anything you send goes through the connection.");
    } else if (!page) {
      screen.append(`No page at ${nav.url}.`);
    } else if (page.locked) {
      screen.append("ACCESS DENIED\n\nThis item is restricted. Staff login required at ", el("a", { onclick: () => go(page.requiresLogin) }, page.requiresLogin), ".");
    } else {
      screen.append(...[siteImage(page)].filter(Boolean), ...pageBody(page, go));
      if (W.roots.includes(page.url)) screen.append(el("div", { class: "counter" }, "You are visitor no. ", el("span", {}, visitors(page.url))));
      if (!S.visited.has(page.url)) { S.visited.add(page.url); queueMicrotask(() => emit("change")); }
      if (page.form === "login") screen.append(loginForm(page.url));
      if (page.form === "records") screen.append(recordsForm(page.url));
      if (page.thread) screen.append(forumBox(page.url));
      status = page.downloaded ? "Saved to Files (your copy is fixed)" : "";
    }
    body.classList.add("viewer");
    body.replaceChildren(
      el("div", { class: "row" },
        el("button", { onclick: () => { if (nav.back.length) { nav.url = nav.back.pop(); rerender("viewer"); } } }, "<"),
        el("button", { onclick: () => go("index") }, "Index"),
        addr, el("button", { onclick: () => go(addr.value.trim() || "index") }, "Go"),
        el("button", { onclick: () => rerender("viewer") }, "Reload"),
        el("button", { disabled: !page || page.locked, onclick: () => { downloadPage(page.url); rerender("viewer"); open("files"); } }, "Save page")),
      screen,
      el("div", { class: "status muted" }, status || " "));
  },
});

function loginForm(site) {
  const c = W.credentials[site];
  if (S.sessions[site]) return el("div", { class: "formbox" }, `Logged in as ${S.sessions[site]}.`,
    c?.person ? ` Staff webmail for ${c.person} is open in Mail; you can send as them.` : "",
    c?.home && c.home !== site ? el("div", {}, el("a", { onclick: () => go(c.home) }, "Continue to restricted holdings")) : null);
  const u = el("input", { placeholder: "username" }), p = el("input", { type: "password", placeholder: "password" });
  const msg = el("div");
  return el("div", { class: "formbox" }, u, p,
    el("button", { onclick: () => {
      const ok = login(site, u.value, p.value);
      play(ok ? "login_ok" : "denied");
      if (ok) {
        const c = W.credentials[site];
        if (c.home && c.home !== site) go(c.home);
        else { msg.textContent = `Logged in as ${u.value.trim().toLowerCase()}.`; rerender("viewer"); }
      } else msg.textContent = "Login failed.";
    } }, "Log in (sends through the connection)"), msg);
}

function recordsForm(url) {
  const rec = el("input", { placeholder: "record requested" }), why = el("textarea", { rows: 3, placeholder: "reason for request" });
  const msg = el("div");
  return el("div", { class: "formbox" }, rec, why,
    el("button", { onclick: () => {
      if (!rec.value.trim()) { msg.textContent = "Please state the record."; return; }
      post("form", { form: "records", to: url, subject: W.records?.formName || "Records request", body: `Record: ${rec.value}\nReason: ${why.value}`, fields: { record: rec.value, reason: why.value } });
      msg.textContent = "Form submitted. Copies are sent by email.";
      rec.value = why.value = "";
    } }, `Submit ${W.records?.formName || "form"}`), msg);
}

function forumBox(url) {
  const t = el("textarea", { rows: 3, placeholder: `post as ${W.cover.handle}` });
  return el("div", { class: "formbox" }, t,
    el("button", { onclick: () => { if (!t.value.trim()) return; post("forum", { to: url, body: t.value.trim() }); rerender("viewer"); } }, "Post reply"));
}

on("forum-reply", ({ url }) => { if (nav.url === url) rerender("viewer"); });
on("page-updated", ({ url }) => { if (nav.url === url && S.viewerBooted) rerender("viewer"); });

// ---- Files ------------------------------------------------------------------------------------
register("files", {
  title: "Files", w: 420, h: 300, x: 520, y: 300,
  render(body) {
    body.replaceChildren(
      el("div", { class: "muted small" }, "Saved copies are yours. Nothing in the reality can reach them now."),
      el("div", { class: "panel grow" }, ...(S.files.length ? S.files.map((f) =>
        el("div", { class: "row", style: "padding:3px 6px" }, el("a", { onclick: () => open("doc", f), style: "cursor:pointer;text-decoration:underline" }, leakTitle(f)),
          el("span", { class: "grow" }), el("span", { class: "muted small" }, f.savedAt))) : [el("div", { class: "muted", style: "padding:6px" }, "No saved documents.")])));
  },
});

register("doc", {
  title: "Document", w: 520, h: 380, multi: true,
  render(body, f, w) {
    setTitle(w, f.title);
    body.replaceChildren(el("div", { class: "muted small" }, `Source: ${f.source}. Saved ${f.savedAt}.`),
      el("div", { class: "paperdoc" }, el("span", { class: "rubber" }, "CORPS FILE COPY"), f.content));
  },
});

// ---- Scanner (reality poison) -------------------------------------------------------------------
const scan = { picked: [], running: false, results: null, scrambled: false };
const scanItems = () => [
  ...S.mail.inbox.map((m) => ({ key: `mail:${m.id}`, label: `Mail: ${m.subject}`, sub: m.fromName || m.from, text: m.body, tamper: m.tamper || 0 })),
  ...S.files.map((f) => ({ key: `file:${f.id}`, label: `File: ${f.title}`, sub: f.source, text: f.content, tamper: f.tamper || 0 })),
];
const READ = ["steady", "faint tremor", "unstable", "violent"];

register("scanner", {
  title: "Scanner - reality poison", w: 760, h: 460, x: 120, y: 120,
  render(body) {
    const items = scanItems();
    const now = Date.now();
    const cooling = Math.max(0, Math.ceil((S.poison.lastUse + TUNE.poisonCooldownSec * 1000 - now) / 1000));
    const recent = S.poison.uses.filter((t) => now - t < TUNE.poisonReboundWindowSec * 1000).length;
    const chosen = scan.picked.map((k) => items.find((i) => i.key === k)).filter(Boolean);
    body.replaceChildren(
      el("div", { class: "row" },
        el("div", { class: "panel scan-pick", style: "width:260px;height:120px" }, ...items.map((i) =>
          el("div", {}, el("input", { type: "checkbox", checked: scan.picked.includes(i.key), disabled: scan.running || (!scan.picked.includes(i.key) && scan.picked.length >= 3),
            onchange: (e) => { scan.picked = e.target.checked ? [...scan.picked, i.key] : scan.picked.filter((k) => k !== i.key); scan.results = null; rerender("scanner"); } }), i.label))),
        el("div", { class: "grow small" },
          el("div", {}, "Hold up to three documents, then flood. Altered material cannot hold its shape while the reality's lesser processes are flooded."),
          el("div", { class: "muted", style: "margin-top:6px" }, recent ? `Rebound: ${recent} recent flood${recent > 1 ? "s" : ""}. Another will draw more attention and read less cleanly.` : "No rebound."),
          el("div", { style: "margin-top:8px" }, el("button", { disabled: scan.running || cooling > 0 || !chosen.length, onclick: () => flood(chosen, recent) },
            cooling ? `Recharging (${cooling}s)` : scan.running ? "Flooding..." : "Flood")))),
      el("div", { class: "scan-docs" }, ...[0, 1, 2].map((i) => {
        const it = chosen[i];
        if (!it) return el("div", { class: "scan-doc muted" }, "(empty slot)");
        const r = scan.results?.[it.key];
        const cls = scan.running ? `flooding ${r != null && r > 0 ? `shake-${Math.min(3, r)}` : ""}` : "";
        return el("div", { class: `scan-doc ${cls}` }, el("h4", {}, it.label), el("div", { class: "muted" }, it.sub), it.text.slice(0, 900),
          !scan.running && r != null ? el("div", { class: "reading" }, scan.scrambled ? "interference" : READ[Math.min(3, r)]) : null);
      })));
  },
});

function flood(chosen, recent) {
  scan.running = true;
  S.poison.lastUse = Date.now();
  S.poison.uses.push(Date.now());
  scan.scrambled = recent > 0 && Math.random() < 0.35 * recent;
  scan.results = Object.fromEntries(chosen.map((i) => [i.key, scan.scrambled ? Math.floor(Math.random() * 4) : i.tamper]));
  addNotice(TUNE.poisonBaseNotice * (1 + recent), "poison");
  emit("poison", { recent });
  rerender("scanner");
  setTimeout(() => { scan.running = false; rerender("scanner"); }, 6000);
}

// ---- HQ console --------------------------------------------------------------------------------
const hq = { file: null, last: null, sending: null };
// While a fragment goes out the console shows the uplink (assets/film/uplink_L.webm, line art from film.py).
const uplink = el("video", { class: "uplink", src: "assets/film/uplink_L.webm", muted: true, loop: true, playsinline: true, preload: "auto" });
uplink.muted = true;
function send(fileId) {
  hq.sending = S.files.find((f) => f.id === fileId)?.title || "fragment";
  uplink.currentTime = 0;
  uplink.play().catch(() => {});
  rerender("hq");
  setTimeout(() => { hq.sending = null; uplink.pause(); hq.last = transmit(fileId); rerender("hq"); }, 3200);
}
const OBS = { QUIET: "QUIET", STIRRING: "STIRRING", WATCHFUL: "WATCHFUL", FIXED: "FIXED", SEARCHING: "SEARCHING" };

register("hq", {
  title: "HQ Console - Desk 14", w: 460, h: 600, x: 420, y: 40,
  render(body) {
    const left = S.searchStartedAt ? Math.max(0, TUNE.searchSeconds - Math.floor((Date.now() - S.searchStartedAt) / 1000)) : null;
    const sel = el("select", { class: "grow", onchange: (e) => { hq.file = e.target.value; } },
      el("option", { value: "" }, "(choose a saved document)"), ...S.files.map((f) => el("option", { value: f.id, selected: hq.file === f.id }, f.title)));
    const open = S.directives.filter((d) => d.status === "open");
    const closed = S.directives.filter((d) => d.status === "closed");
    body.replaceChildren(
      el("fieldset", { class: "directives" }, el("legend", {}, "Directives"),
        ...(S.directives.length ? [
          ...open.map((d) => el("div", { class: "dir open" }, el("b", {}, d.id), "  ", d.task)),
          ...closed.slice(-2).map((d) => el("div", { class: "dir closed" }, el("span", { class: "struck" }, `${d.id}  ${d.task}`), el("span", { class: "stamp" }, d.early ? "CLOSED" : `CLOSED ${d.closed}`))),
          open.length ? null : el("div", { class: "muted small" }, "Awaiting tasking."),
        ] : [el("div", { class: "muted small" }, "Awaiting tasking.")])),
      el("fieldset", { class: "fs-obs" }, el("legend", {}, "Observation index (local intelligence)"),
        el("div", { class: "obsrow" },
          el("img", { class: "gauge", src: `assets/icons/gauge${Math.max(0, Object.keys(OBS).indexOf(S.stage))}.png`, alt: "" }),
          el("div", { class: `obs ${S.stage === "SEARCHING" ? "alert" : ""}` }, OBS[S.stage] + (left != null ? `  ${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}` : "")))),
      el("fieldset", { class: "fs-res" }, el("legend", {}, "Resonance"),
        el("div", { class: "meter" }, el("div", { class: "fill", style: `width:${Math.min(100, S.progress)}%` }), el("div", { class: "lbl" }, `${S.progress}`)),
        el("div", { class: "muted small" }, "Injection is offered when resonance is sufficient. Desk 9 does not publish the threshold."),
        el("button", { disabled: !canInject(), onclick: () => emit("inject") }, canInject() ? "INJECT REVERSE SEED" : "Injection unavailable")),
      el("fieldset", { class: "fs-tx" }, el("legend", {}, "Transmit a fragment"),
        el("div", { class: "row" }, sel, el("button", { disabled: !!hq.sending, onclick: () => { if (hq.file && !hq.sending) send(hq.file); } }, "Transmit")),
        hq.sending ? el("div", { class: "uplinkbox" }, uplink, el("div", { class: "small" }, `Transmitting: ${hq.sending}`)) : null,
        el("div", { class: "muted small" }, "Transmission goes out through the connection."),
        ...S.transmissions.slice(-4).reverse().map((t) => el("div", { class: "small" }, `${t.time}  ${t.file}: `, el("b", {}, t.resonance ? "RESONANCE" : t.already ? "already counted" : "no resonance")))),
      el("div", { class: "row small" },
        el("button", { onclick: () => Notification?.requestPermission?.() }, "Enable Corps alerts"),
        el("span", { class: "grow" }), el("span", { class: "muted" }, `link cost $${usage.cost.toFixed(3)}`)));
  },
});

