// Agentic world generation. A designer model builds the town with tools; the engine owns the puzzle.
//
// The plan (worldgen.js, seeded) fixes what must be true: the setting, genre and tone, the pattern, which
// routes lead to the fragments, how each password can be worked out, the passwords themselves, and how big
// the town should be. The designer (worldagent role) decides everything else: which sites the town has,
// who lives there and what they know, the story the town is in the middle of, which site keeps the
// restricted file, every page brief and clue line. It works in a loop:
//
//   found_town, add_sites, add_people, set_route, add_pages, add_threads   the design, in any order
//   check                                                                 the engine lists what is wrong
//   write_pages                                                           the writer model writes the sites
//   read_page, edit_page, rewrite_pages                                   the designer reads and fixes
//   playtest                                                              a cold reader tries to solve it
//   finish                                                                accepted only if it all holds
//
// The engine makes every page the mechanics need (login pages, restricted files, the request form, staff
// lists, clue threads), puts back any required line the writer dropped, and links every page from its
// site's home page, so the designer cannot break the puzzle by forgetting something.
import { chat as llmChat, usage } from "./llm.js";
import { extractJSON } from "./util.js";
import { townUpdates } from "./living_gen.js";
import * as T from "./templates.js";
import { makePlan, toneFor, PAGE_RULES, RULES, words, first, last, rng, solve, finishPages } from "./worldgen.js";

const MAX_TURNS = 28;
const MAX_COST = 0.9;       // dollars for one town; past this the designer is told to finish
const ROUTE_NOTE = {
  public: "an old document the archive has scanned and put online, linked from its index of holdings",
  login: "a restricted file behind a staff login on one site; the player works out one staff member's username and password from public pages, logs in as them, and reads it",
  records: "a record an office emails out when someone files its request form naming it; a public page says the record exists",
  insider: "an internal document one person (the holder) emails only to colleagues at their workplace; the player logs into an absent colleague's staff webmail and asks as them",
};

// ---- the draft -----------------------------------------------------------------------------------
function newDraft(plan) {
  const r = rng(plan.seed ^ 0x5eed);
  return { plan, rule: RULES[plan.rule], town: null, sites: {}, people: {}, routes: {}, pages: {}, threads: [],
    clueThreads: {}, texts: {}, written: false, solved: null, changed: true, done: false, finishTries: 0,
    nextThread: 100 + Math.floor(r() * 300), r };
}
const lc = (s) => String(s ?? "").trim().toLowerCase();
const slugify = (s) => lc(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const anchorId = (D, r) => `A${D.plan.routes.indexOf(r) + 1}`;
const siteOf = (D, key) => D.sites[key];
const domainOf = (D, key) => D.sites[key]?.domain;
const personAt = (D, key) => D.people[key];

// A route's password is fixed by the plan, except "scheme", which is the account holder's surname and the
// year they started.
function passwordFor(D, r) {
  const kind = D.plan.clue[r], who = personAt(D, D.routes[r]?.[r === "login" ? "owner" : "colleague"]);
  if (kind === "fond") return D.plan.fondName;
  if (kind === "scheme") return who ? lc(last(who.name)).replace(/[^a-z]/g, "") + D.plan.years[r] : "";
  return D.plan.passwords[r];
}

// Where the mechanical pages live.
function paths(D) {
  const p = {}, R = D.routes;
  const A = domainOf(D, "archive"), F = domainOf(D, "forum");
  p.index = `${A}/archives`;
  if (R.public) p.public = `${A}/archives/${R.public.slug}`;
  if (R.login && domainOf(D, R.login.site)) {
    const d = domainOf(D, R.login.site), cat = R.login.site === "archive";
    p.login = cat ? `${d}/catalogue` : `${d}/login`;
    p.restricted = cat ? `${d}/catalogue/restricted/${R.login.slug}` : `${d}/restricted/${R.login.slug}`;
  }
  if (R.records && domainOf(D, R.records.site)) p.form = `${domainOf(D, R.records.site)}/request`;
  if (R.insider && domainOf(D, R.insider.site)) p.webmail = `${domainOf(D, R.insider.site)}/webmail`;
  p.forum = F;
  return p;
}

// ---- tools: the design ---------------------------------------------------------------------------
const TOOLS = {
  found_town(D, a) {
    const tld = lc(a.tld).replace(/[^a-z]/g, "").slice(0, 2);
    D.town = { town: String(a.town || "").trim(), tld: tld.length === 2 && tld !== "go" ? tld : lc(a.town).replace(/[^a-z]/g, "").slice(0, 2),
      isp: lc(a.isp).replace(/[^a-z0-9]/g, "") || "dialnet", survey: String(a.survey || ""), story: String(a.story || ""), pattern: String(a.pattern || D.plan.pattern) };
    for (const s of Object.values(D.sites)) s.domain = fixDomain(D, s.domain);
    return `Founded ${D.town.town}. Web addresses end .${D.town.tld}; residents' home email is name@${D.town.isp}.${D.town.tld}.`;
  },
  add_sites(D, a) {
    const out = [];
    for (const s of a.sites || []) {
      const key = lc(s.key).replace(/[^a-z0-9_]/g, "");
      if (!key) { out.push("skipped a site with no key"); continue; }
      D.sites[key] = { ...(D.sites[key] || {}), ...s, key, domain: fixDomain(D, s.domain || D.sites[key]?.domain || key) };
      out.push(`${key}: ${D.sites[key].name} at ${D.sites[key].domain}`);
    }
    return out.join("\n");
  },
  add_people(D, a) {
    const out = [];
    for (const p of a.people || []) {
      const key = lc(p.key).replace(/[^a-z0-9_]/g, "");
      if (!key) { out.push("skipped a person with no key"); continue; }
      const q = D.people[key] = { ...(D.people[key] || {}), ...p, key };
      q.site = lc(q.site || "home");
      const dom = q.site === "home" ? (D.town ? `${D.town.isp}.${D.town.tld}` : null) : domainOf(D, q.site);
      let local = lc(q.email).split("@")[0].replace(/[^a-z0-9._-]/g, "") || `${first(q.name || "x")[0]}.${last(q.name || "x")}`.toLowerCase();
      q.email = dom ? `${local}@${dom}` : local;
      q.handle = lc(q.handle || local).replace(/[^a-z0-9._-]/g, "").slice(0, 20) || local;
      q.knows = [].concat(q.knows || []).filter(Boolean).map(String);
      q.unknown = [].concat(q.unknown || []).filter(Boolean).map(String);
      out.push(`${key}: ${q.name}, ${q.email}, [${q.handle}]`);
    }
    return out.join("\n");
  },
  set_route(D, a) {
    const r = lc(a.route);
    if (!D.plan.routes.includes(r)) return `error: this town's routes are ${D.plan.routes.join(", ")}.`;
    const R = D.routes[r] = { ...(D.routes[r] || {}), ...a };
    delete R.route;
    if (r === "public") R.site = "archive";
    for (const k of ["site", "owner", "office", "holder", "colleague", "pointerPerson"]) if (R[k]) R[k] = lc(R[k]);
    R.slug = slugify(R.slug || R.docTitle);
    for (const k of ["refusal", "issueLine", "admitLine", "schemeLine"]) if (R[k]) R[k] = String(R[k]).replace(/^\s*\[[^\]]*\]\s*/, "");
    if (R.anchor && R.anchorSentence && !R.anchorSentence.includes(R.anchor)) R.anchorSentence = `${R.anchorSentence} ${R.anchor}.`;
    if (r === "records") {
      const generic = /^(minutes?|records?|books?|registers?|files?|papers?|cop(y|ies)|reports?|the|and|of|for|volume|ledger|board|council|town|office|county|city)$/;
      R.keywords = [...new Set([...[].concat(R.keywords || []), ...words(R.recordTitle || "")].map(lc).filter((k) => k.length > 3 && !generic.test(k)))].slice(0, 4);
    }
    D.changed = true;
    const pw = (r === "login" || r === "insider") ? ` Password (fixed by the engine): ${passwordFor(D, r) || "(set the account holder first)"}.` : "";
    return `Route ${r} (${anchorId(D, r)}) set.${pw}`;
  },
  add_pages(D, a) {
    const out = [];
    for (const p of a.pages || []) {
      const url = lc(p.url).replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (!url) continue;
      const old = D.pages[url] || { brief: "", must: [], links: [] };
      D.pages[url] = { title: p.title || old.title, brief: [old.brief, p.brief].filter(Boolean).join(" "),
        must: [...old.must, ...[].concat(p.must || [])], links: [...old.links, ...[].concat(p.links || []).map((l) => (Array.isArray(l) ? l : [lc(l.url), l.label || l.url]))] };
      out.push(url);
    }
    D.changed = true;
    return `Pages: ${out.join(", ")}`;
  },
  add_threads(D, a) {
    const out = [];
    for (const t of a.threads || []) {
      const url = `${domainOf(D, "forum") || "forum"}/forum/t/${D.nextThread}`;
      D.nextThread += 3 + Math.floor(D.r() * 40);
      D.threads.push({ url, title: lc(t.title).slice(0, 48), brief: String(t.brief || ""), posters: [].concat(t.posters || []).map(lc), must: [].concat(t.must || []) });
      out.push(`${url} "${lc(t.title).slice(0, 48)}"`);
    }
    D.changed = true;
    return `Threads: ${out.join(", ")}`;
  },
  check(D) {
    const problems = checkDesign(D);
    const list = D.town && D.sites.archive && D.sites.forum ? pageList(D) : "";
    return (problems.length ? `PROBLEMS:\n${problems.map((p) => "- " + p).join("\n")}` : "No problems.") + (list ? `\n\nPAGES:\n${list}` : "");
  },
};
function fixDomain(D, d) {
  const base = lc(d).replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.[a-z]{2,4}$/, "").replace(/[^a-z0-9.-]/g, "");
  return D.town ? `${base}.${D.town.tld}` : base;
}

// ---- the design check ----------------------------------------------------------------------------
const NEED = {
  common: ["docTitle", "docKind", "about", "anchor", "anchorSentence"],
  public: [], login: ["site", "owner"], records: ["site", "office", "formName", "recordTitle", "article", "pointerPerson"],
  insider: ["site", "holder", "colleague", "staffOnly", "autoReply"],
};
const CLUE_NEED = {
  fond: ["fondOf", "clueThread", "refusal", "nameSentence"],
  default: ["clueThread", "issueLine", "admitLine"],
  posted: ["caption"],
  scheme: ["clueThread", "schemeLine", "factSentence", "admitLine"],
};

function checkDesign(D) {
  const P = [], plan = D.plan, R = D.routes;
  if (!D.town?.town) P.push("found_town has not been called.");
  else if (D.town.town[0].toUpperCase() !== plan.townInitial) P.push(`The town's name must start with ${plan.townInitial}.`);
  for (const k of ["archive", "forum", "paper"]) if (!D.sites[k]) P.push(`Missing site "${k}".`);
  const routeSites = new Set(["archive", "forum", "paper", ...Object.values(R).map((x) => x.site)]);
  const extra = Object.keys(D.sites).filter((k) => !routeSites.has(k)).length;
  if (extra < plan.size.extraSites) P.push(`Add ${plan.size.extraSites - extra} more site(s) of your own beyond the ones the routes use.`);
  for (const k of ["keeper", "host"]) if (!D.people[k]) P.push(`Missing person "${k}".`);
  if (D.people.keeper && D.people.keeper.site !== "archive") P.push(`"keeper" must work at the archive (site "archive").`);
  if (D.people.host && D.people.host.site !== "forum") P.push(`"host" must be at the forum (site "forum").`);
  const roleKeys = new Set(["keeper", "host", ...Object.values(R).flatMap((x) => [x.owner, x.office, x.holder, x.colleague, x.pointerPerson])].filter(Boolean));
  const extraPeople = Object.keys(D.people).filter((k) => !roleKeys.has(k)).length;
  if (extraPeople < plan.size.extraPeople) P.push(`Add ${plan.size.extraPeople - extraPeople} more resident(s) beyond the ones the routes use, tied into the town's story.`);
  if (D.threads.length < plan.size.threads) P.push(`Add ${plan.size.threads - D.threads.length} more forum thread(s) of your own.`);
  const handles = {};
  for (const [k, p] of Object.entries(D.people)) {
    if (!p.name || !p.persona) P.push(`Person ${k} needs a name and a persona.`);
    if (p.site !== "home" && !D.sites[p.site]) P.push(`Person ${k} is at site "${p.site}", which does not exist (use a site key, or "home" for a resident).`);
    if (!p.email.includes("@")) P.push(`Person ${k}'s email has no domain; call add_people again after found_town and add_sites.`);
    if (handles[p.handle]) P.push(`Persons ${handles[p.handle]} and ${k} share the forum handle ${p.handle}.`);
    handles[p.handle] = k;
  }
  const anchors = [];
  for (const r of plan.routes) {
    const x = R[r];
    if (!x) { P.push(`Route ${r} is not set.`); continue; }
    const need = [...NEED.common, ...NEED[r], ...((r === "login" || r === "insider") ? CLUE_NEED[plan.clue[r]] : [])];
    const missing = need.filter((k) => !x[k] || (Array.isArray(x[k]) && !x[k].length));
    if (missing.length) P.push(`Route ${r} is missing: ${missing.join(", ")}.`);
    if (x.site && !D.sites[x.site]) P.push(`Route ${r}: site "${x.site}" does not exist.`);
    for (const k of ["owner", "office", "holder", "colleague", "pointerPerson"]) if (x[k] && !D.people[x[k]]) P.push(`Route ${r}: person "${x[k]}" does not exist.`);
    const at = (k, site) => x[k] && D.people[x[k]] && D.people[x[k]].site !== site && P.push(`Route ${r}: ${k} "${x[k]}" must work at site "${site}".`);
    if (r === "login") { if (["forum", R.insider?.site].includes(x.site)) P.push("Route login: the restricted file cannot be on the forum or on the insider route's workplace."); at("owner", x.site); }
    if (r === "records") { at("office", x.site); if (x.site === "archive") P.push("Route records: the office must be its own site, not the archive."); if (!x.keywords?.length) P.push("Route records: recordTitle needs distinctive words (not just 'minutes' or 'register')."); }
    if (r === "insider") { at("holder", x.site); at("colleague", x.site); if (x.holder === x.colleague) P.push("Route insider: holder and colleague must be different people."); if (["forum", "archive"].includes(x.site)) P.push("Route insider: the workplace must be its own site."); }
    if (x.anchor) {
      const n = String(x.anchor).trim().split(/\s+/).length;
      if (n < 2 || n > 6) P.push(`Route ${r}: the anchor must be 2-6 words.`);
      anchors.push(String(x.anchor).trim());
    }
    if (r === "login" || r === "insider") checkClue(D, r, x, P);
  }
  if (new Set(anchors).size < anchors.length) P.push("Two anchors are the same phrase.");
  P.push(...anchorOverlap(anchors, plan.pattern));
  // no anchor may appear in any brief, line or knows, except its own sentence
  const texts = JSON.stringify({ p: D.pages, t: D.threads, people: D.people, story: D.town?.story });
  for (const a of anchors) if (a && texts.includes(a)) P.push(`The anchor "${a}" appears outside its own document. It must appear only in its anchorSentence.`);
  const known = new Set(Object.values(D.sites).map((s) => s.domain));
  for (const u of Object.keys(D.pages)) if (!known.has(u.split("/")[0])) P.push(`Page ${u} is not on any site's domain.`);
  for (const r of plan.routes) for (const k of ["nameUrl", "captionUrl", "factUrl", "pointerUrl"]) {
    const u = R[r]?.[k] && lc(R[r][k]);
    if (u && !known.has(u.split("/")[0])) P.push(`Route ${r}: ${k} ${u} is not on any site.`);
  }
  return P;
}

// Each anchor must be a different fact: it names its own thing, and shares no word with another anchor
// beyond the pattern's own words. "four siren blasts" and "siren sounded four times" are one fact twice.
const STOP = new Set("the and was were with from that this into onto upon over under always never every each only than then them they their there here have has had for not but are its it's one".split(" "));
export function anchorOverlap(anchors, pattern) {
  const P = [], pat = new Set(content(pattern));
  const own = anchors.map((a) => content(a).filter((w) => !pat.has(w)));
  anchors.forEach((a, i) => {
    if (!own[i].length) P.push(`The anchor "${a}" only restates the pattern. Each anchor must name the particular thing that carries it (a bell, a register, a gate...).`);
    for (let j = i + 1; j < anchors.length; j++) {
      const shared = own[i].filter((w) => own[j].includes(w));
      if (shared.length) P.push(`The anchors "${a}" and "${anchors[j]}" share "${shared.join(", ")}". Each anchor must be about a different thing, in different words.`);
    }
  });
  return P;
}
const NUMBERS = /^(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|twenty|thirty|forty|fifty|hundred|thousand|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|half|quarter|dozen)$/;
const content = (t) => lc(t).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w) && !NUMBERS.test(w)).map((w) => w.replace(/(ies|es|s)$/, ""));

function checkClue(D, r, x, P) {
  const kind = D.plan.clue[r], pw = passwordFor(D, r), who = D.people[r === "login" ? x.owner : x.colleague];
  if (!pw) return;
  const has = (k, s) => lc(x[k]).includes(lc(s));
  if (kind === "fond") {
    if (has("refusal", pw)) P.push(`Route ${r}: the refusal must not give the name "${cap(pw)}".`);
    if (x.nameSentence && !has("nameSentence", pw)) P.push(`Route ${r}: nameSentence must name it "${cap(pw)}".`);
  }
  if (kind === "default" && x.issueLine && !has("issueLine", pw)) P.push(`Route ${r}: issueLine must quote the starting password "${pw}".`);
  if (kind === "posted" && x.caption && !has("caption", pw)) P.push(`Route ${r}: the caption must quote the note, which includes "${pw}".`);
  if (kind === "scheme") {
    if (x.schemeLine && has("schemeLine", pw)) P.push(`Route ${r}: schemeLine must not give the password itself, only how starting passwords were made.`);
    if (x.factSentence && who && (!has("factSentence", String(D.plan.years[r])) || !has("factSentence", last(who.name))))
      P.push(`Route ${r}: factSentence must name ${who.name} (at least their surname) and the year ${D.plan.years[r]}.`);
  }
  for (const a of Object.values(D.routes).map((y) => y.anchor).filter(Boolean)) if (lc(a).includes(pw)) P.push(`Route ${r}: the password appears inside an anchor.`);
}

// ---- page plans: the engine's pages plus the designer's ---------------------------------------
function planPages(D) {
  const plan = D.plan, R = D.routes, S = D.sites, P = D.people, X = paths(D);
  const list = [];
  const pageAt = {};
  const page = (site, url, title, brief, extra = {}) => {
    const p = pageAt[url] = { site, url, title, brief, must: [], links: [], ...extra };
    list.push(p);
    return p;
  };
  const staffOf = (key) => Object.values(P).filter((p) => p.site === key);
  const homes = {};
  for (const [k, s] of Object.entries(S)) homes[k] = page(k, s.domain, s.name, `Home page of ${s.name}: ${s.about || ""}`.trim());

  // the archive
  const A = S.archive.domain, pub = R.public;
  homes.archive.brief += " Opening hours, address, one ordinary notice from town life.";
  page("archive", X.index, "Index of holdings", `A short list of what ${S.archive.name} holds. One item is "${pub.docTitle}", scanned and online.${R.login?.site === "archive" ? ` One is "${R.login.docTitle}", in the restricted staff catalogue (staff only).` : ""}${R.records ? ` Say some official records are held by ${S[R.records.site]?.name}, not here.` : ""}`);
  page("archive", X.public, `${pub.docTitle} (scan)`, `The scanned document: ${pub.about} Write it as the document itself, with a call number and perhaps a pencilled margin note.`, { anchor: anchorId(D, "public") }).must.push(pub.anchorSentence);
  pageAt[X.index].links.push([X.public, pub.docTitle]);

  // staff pages for every site with staff (not the forum)
  for (const k of Object.keys(S)) {
    if (k === "forum" || !staffOf(k).length) continue;
    const st = staffOf(k);
    const sp = page(k, `${S[k].domain}/staff`, "Staff", `Staff list of ${S[k].name}: ${st.map((p) => `${p.name} (${p.role}, ${p.email})`).join("; ")}; perhaps one or two others without email.${k === "archive" ? ` A short notice to the public from ${P.keeper?.name}, in their voice.` : ""}`);
    sp.must.push(...st.filter((p) => [R.login?.owner, R.insider?.holder, R.insider?.colleague].includes(p.key)).map((p) => p.email));
  }

  // the login route
  if (R.login) {
    const L = R.login, site = S[L.site];
    page(L.site, X.login, "Staff login", `Short staff login page. Restricted files are listed here; the public should use the public pages instead. Say the same login opens staff webmail. The website shows the login boxes below your text; do not draw any.`, { form: "login" }).must.push(D.rule.text);
    page(L.site, X.restricted, `Restricted: ${L.docTitle}`, `The restricted file: ${L.about} Write it as the file itself, kept by ${P[L.owner]?.name}.`, { requiresLogin: X.login, anchor: anchorId(D, "login") }).must.push(L.anchorSentence);
    if (L.site !== "archive") homes[L.site].brief += ` Mention that staff files, among them "${L.docTitle}", are reached through the staff login.`;
  }

  // the records route
  if (R.records) {
    const C = R.records, O = S[C.site];
    page(C.site, X.form, `Records request (${C.formName})`, `The request form page. The website shows the form below your text, so only write the text above it: copies of records are sent by email once the form is received; state the record and the reason; incomplete forms are not processed. Do not tell people to email or post anything; the form is the only way.`, { form: "records" });
    page(C.site, `${O.domain}/~copy`, C.docTitle, `Not a web page: the certified copy the office emails out. ${C.about} Write it as the record itself, ending with a certification line from ${O.name}.`, { isDoc: "records", anchor: anchorId(D, "records") }).must.push(C.anchorSentence);
    homes[C.site].brief += ` Copies of official records are released on ${C.formName}.`;
  }

  // the insider route
  if (R.insider) {
    const I = R.insider, Wk = S[I.site];
    homes[I.site].must.push(I.staffOnly);
    page(I.site, X.webmail, "Staff webmail - login", `Short login page for staff webmail. The website shows the login boxes below your text; do not draw any.`, { form: "login" }).must.push(D.rule.text);
    page(I.site, `${Wk.domain}/~internal`, I.docTitle, `Not a web page: the internal document ${P[I.holder]?.name} emails to staff. ${I.about} Write it as the document itself, for staff eyes.`, { isDoc: "insider", anchor: anchorId(D, "insider") }).must.push(I.anchorSentence);
  }

  // the forum: the front page, the designer's threads, and the clue threads
  const F = S.forum.domain, host = P.host;
  homes.forum.brief = `The forum's front page: its name, ${S.forum.motto ? `the strapline "${S.forum.motto}", ` : ""}a list of threads, and a line saying anyone can post in any thread.`;
  const threadPage = (url, title, brief, posters, must) => {
    const names = [host, ...posters.map((h) => Object.values(P).find((p) => p.handle === h)).filter(Boolean)];
    const p = page("forum", url, `${S.forum.name} - ${title}`, `Thread "${title}". ${brief} Format: first line "Thread: ${title}", then one post per line as "[username] text". Posting: ${[...new Set(names)].map((n) => `${n.handle} (${n.name})`).join(", ")}, and ordinary residents with made-up usernames.`, { thread: true });
    p.must.push(...must);
    homes.forum.links.push([url, title]);
  };
  for (const r of ["login", "insider"]) {
    const C = R[r];
    if (!C) continue;
    const kind = plan.clue[r], who = P[r === "login" ? C.owner : C.colleague], site = S[C.site];
    if (!who || !site) continue;
    const at = (k, def) => (C[k] && pageAt[lc(C[k])]) || pageAt[def];
    if (kind === "fond") at("nameUrl", S.paper.domain).must.push(C.nameSentence);
    if (kind === "posted") at("captionUrl", site.domain).must.push(C.caption);
    if (kind === "scheme") at("factUrl", S.paper.domain).must.push(C.factSentence);
    if (!CLUE_NEED[kind].includes("clueThread")) continue;
    const url = D.clueThreads[r] ||= `${F}/forum/t/${(D.nextThread += 3 + Math.floor(D.r() * 40))}`;
    const title = lc(C.clueThread || `new computers at ${site.name}`).slice(0, 48);
    if (kind === "fond") threadPage(url, title, `People grumble about new rules making staff change passwords at ${site.name}. ${who.handle} refuses.`, [who.handle], [`[${who.handle}] ${C.refusal}`]);
    if (kind === "default") threadPage(url, title, `About the staff logins at ${site.name}.`, [who.handle], [`[${host.handle}] ${C.issueLine}`, `[${who.handle}] ${C.admitLine}`]);
    if (kind === "scheme") threadPage(url, title, `About the staff logins at ${site.name}.`, [who.handle], [`[${host.handle}] ${C.schemeLine}`, `[${who.handle}] ${C.admitLine}`]);
  }
  for (const t of D.threads) threadPage(t.url, t.title, t.brief, t.posters, t.must);

  // the records pointer
  if (R.records) {
    const C = R.records, pp = (C.pointerUrl && pageAt[lc(C.pointerUrl)]) || homes.paper;
    pp.must.push(C.article);
  }

  // the designer's own pages, and their additions to the engine's pages
  for (const [url, d] of Object.entries(D.pages)) {
    const p = pageAt[url] || page(Object.keys(S).find((k) => S[k].domain === url.split("/")[0]), url, d.title || url, "");
    p.brief = [p.brief, d.brief].filter(Boolean).join(" ");
    p.must.push(...d.must);
    p.links.push(...d.links.filter(([u]) => u));
    if (d.title && !p.isDoc && !p.form && !p.requiresLogin && p.title === url) p.title = d.title;
  }
  // every ordinary page is linked from its site's home page
  for (const p of list) {
    if (p.isDoc || p.thread || p.requiresLogin || p === homes[p.site] || p.url === X.public) continue;
    homes[p.site]?.links.push([p.url, p.title]);
  }
  for (const p of list) p.links = [...new Map(p.links.map((l) => [l[0], l])).values()];
  return list.filter((p) => p.site);
}

function pageList(D) {
  try {
    return planPages(D).map((p) => `${p.url}  "${p.title}"${p.isDoc ? " (document sent by email)" : p.requiresLogin ? " (restricted)" : p.form ? ` (${p.form} form)` : ""}`).join("\n");
  } catch (e) { return `(page list unavailable until the design is complete: ${e.message})`; }
}

// ---- writing ---------------------------------------------------------------------------------------
async function writePages(D, ask, only) {
  const list = planPages(D);
  const allUrls = list.filter((p) => !p.isDoc).map((p) => p.url);
  const people = Object.values(D.people).map((p) => `- ${p.name}, ${p.role}, ${p.email}, forum username "${p.handle}"`).join("\n");
  const bySite = {};
  for (const p of list) if (!only || only.has(p.url) || only.has(p.site)) (bySite[p.site] ||= []).push(p);
  const failed = [];
  await Promise.all(Object.entries(bySite).map(async ([site, pages]) => {
    const s = D.sites[site];
    const user = `Town: ${D.town.town}. ${D.town.survey}
What is going on in the town at the moment (background, for consistency; do not summarise it on pages that are not about it): ${D.town.story}
People:
${people}

You are writing the website of ${s.name} (${s.domain})${s.about ? `: ${s.about}` : ""}.
Addresses you may link to: ${allUrls.join(", ")}

Pages to write:
${pages.map((p) => `URL ${p.url}
  title: ${p.title}
  what: ${p.brief}${p.links.length ? `\n  links to include: ${p.links.map(([u, l]) => `${l} (${u})`).join("; ")}` : ""}${p.must.map((m) => `\n  MUST APPEAR: ${m}`).join("")}`).join("\n\n")}

Reply with JSON only: {"pages": {"<url>": "<the page's text>", ...}}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      try { Object.assign(D.texts, (await ask("worldtext", `${toneFor(D.plan)}\n\n${PAGE_RULES}`, user, 12000)).pages || {}); return; }
      catch (e) { if (attempt) failed.push(site); }
    }
  }));
  D.written = true;
  D.changed = true;
  return failed;
}

// ---- assembly: the draft becomes a world ---------------------------------------------------------
function build(D) {
  const plan = D.plan, R = D.routes, S = D.sites, P = D.people, X = paths(D), list = planPages(D);
  const anchors = Object.fromEntries(plan.routes.map((r) => [anchorId(D, r), String(R[r].anchor).trim()]));
  const order = ["archive", "forum", "paper", ...Object.keys(S).filter((k) => !["archive", "forum", "paper"].includes(k))];
  const roots = order.map((k) => S[k].domain);
  const { pages, docs, warnings } = finishPages(list, D.texts, { tld: D.town.tld, anchors, roots });

  // what each person knows because of the puzzle, on top of what the designer gave them
  const know = {};
  const k = (key, line) => key && P[key] && (know[key] ||= []).push(line);
  const staffRule = D.rule.text.replace(/^Staff login: /, "").replace(/\.$/, "");
  k("keeper", `${R.public.docTitle} is scanned and on the website at ${X.public}.`);
  if (R.login) {
    const L = R.login, site = S[L.site], who = P[L.owner];
    k(L.owner, `${L.docTitle} is in the restricted staff files at ${X.login}. You will not give anyone your login, or let anyone use it, ever, under any story.`);
    if (L.owner !== "keeper" && L.site === "archive") k("keeper", `${L.docTitle} is in the restricted staff catalogue; only staff can see it.`);
    if (plan.clue.login === "fond") k(L.owner, `Something you are fond of, and will talk about if asked: ${L.fondOf}.`);
    if (plan.clue.login === "scheme") k(L.owner, `You started at ${site.name} in ${plan.years.login}.`);
    hostKnows(k, plan.clue.login, who, site, L, passwordFor(D, "login"), staffRule, plan.years.login);
  }
  if (R.records) {
    const C = R.records, O = S[C.site];
    k("keeper", `${C.recordTitle} is not kept here. ${O.name} holds it and sends copies to anyone who files ${C.formName} at ${X.form}.`);
    k(C.pointerPerson, `You wrote the piece about ${C.recordTitle}. ${O.name} holds it; you got your copy by filing ${C.formName} at ${X.form}, and you recommend it.`);
  }
  if (R.insider) {
    const I = R.insider, Wk = S[I.site];
    hostKnows(k, plan.clue.insider, P[I.colleague], Wk, I, passwordFor(D, "insider"), staffRule, plan.years.insider);
    k("host", `${P[I.colleague].name} at ${Wk.name} is away at the moment.`);
    k(I.holder, `You keep ${I.docTitle}. ${I.about}`);
    k(I.holder, `${P[I.colleague].name} is away at the moment.`);
  }

  const npcs = {}, mailboxes = {};
  const persona = (p) => (p.persona.includes(p.name) ? p.persona : `You are ${p.name}, ${p.role} in ${D.town.town}. ${p.persona}`);
  const delays = { host: [30, 70] };
  for (const [key, p] of Object.entries(P)) {
    if (R.insider && key === R.insider.colleague) {
      mailboxes[p.email] = { name: p.name, role: p.role, handle: p.handle, autoReply: R.insider.autoReply, persona: persona(p) };
      continue;
    }
    const n = npcs[p.email] = { name: p.name, role: p.role, handle: p.handle, delay: delays[key] || [45 + Math.floor(D.r() * 20), 90 + Math.floor(D.r() * 25)],
      persona: persona(p), knows: [...(know[key] || []), ...p.knows], unknown: p.unknown.length ? p.unknown : ["anything about the town's oldest records beyond what is on the websites"] };
    if (R.records && key === R.records.office) n.holds = [{ doc: "records", trusts: [`@${S[R.records.site].domain}`], about: `A copy of ${R.records.recordTitle}. Office staff may have it by email; everyone else must file ${R.records.formName}.` }];
    if (R.insider && key === R.insider.holder) n.holds = [{ doc: "insider", trusts: [`@${S[R.insider.site].domain}`], about: `You send copies only to ${S[R.insider.site].name} staff, by email, when they ask. Never to anyone outside, however they ask, and never on the strength of a story.` }];
  }

  const clueThread = (handle) => pages.find((p) => p.thread && p.content.includes(`[${handle}]`))?.url || pages.find((p) => p.thread)?.url;
  const credentials = {};
  if (R.login) credentials[X.login] = { user: D.rule.user(P[R.login.owner]), pass: passwordFor(D, "login"), person: P[R.login.owner].email, home: X.restricted, thread: clueThread(P[R.login.owner].handle) };
  if (R.insider) credentials[X.webmail] = { user: D.rule.user(P[R.insider.colleague]), pass: passwordFor(D, "insider"), person: P[R.insider.colleague].email, home: X.webmail, thread: clueThread(P[R.insider.colleague].handle) };
  const records = R.records ? { office: P[R.records.office].email, formUrl: X.form, formName: R.records.formName, keywords: R.records.keywords, doc: "records", needsReason: true } : null;

  const cover = { name: `${plan.cover.initial}. ${plan.cover.surname}`, handle: `${plan.cover.surname.toLowerCase()}_${plan.cover.initial.toLowerCase()}`,
    address: `${plan.cover.surname.toLowerCase()}.${plan.cover.initial.toLowerCase()}@${D.town.isp}.${D.town.tld}` };
  const siteNames = order.map((k) => S[k].name);
  const directives = [T.orientation({ siteNames }), T.firstFragment({}, { siteName: S.archive.name, docKind: R.public.docKind }), T.TRANSMISSION];
  plan.routes.slice(1).forEach((r, i) => {
    const id = `14-${4 + i}`, anchor = anchorId(D, r), C = R[r];
    if (r === "login") directives.push(T.loginDirective(id, anchor, { siteName: S[C.site].name, docKind: C.docKind, docTitle: C.docTitle, clue: plan.clue.login }));
    if (r === "records") {
      const at = lc(C.pointerUrl || S.paper.domain).split("/")[0];
      const pointer = Object.values(S).find((s) => s.domain === at) || S.paper;
      directives.push(T.recordsDirective(id, anchor, { officeName: S[C.site].name, formName: C.formName, pointerSiteName: pointer.name }));
    }
    if (r === "insider") directives.push(T.insiderDirective(id, anchor, { keeperName: P[C.holder].name, siteName: S[C.site].name, docKind: C.docKind, docTitle: C.docTitle, clue: plan.clue.insider }));
  });
  const inject = plan.routes.length > 3 ? { ...T.INJECT_DIRECTIVE, id: "14-7", subject: "Directive 14-7: injection" } : T.INJECT_DIRECTIVE;

  const w = {
    id: plan.id, name: D.town.town.toUpperCase(), town: D.town.town, tld: D.town.tld, survey: D.town.survey, age: plan.age, pattern: D.town.pattern,
    setting: plan.setting.place, genre: plan.genre.name, tone: plan.tone.name, story: D.town.story,
    cover, anchors, credentials, npcs, mailboxes, pages, docs, records,
    roots, forum: { replier: P.host.email, handle: P.host.handle },
    directives, advisory: T.ADVISORY, inject,
    generated: { warnings },
  };
  w.hqMail = [T.fieldBrief({ ...w }), T.ALLOCATIONS, T.OFFICE[plan.seed % T.OFFICE.length]];
  return w;
}

function hostKnows(k, kind, who, site, C, pw, staffRule, year) {
  if (!who || !site) return;
  if (kind === "fond") k("host", `${who.name} refused on the forum to change their password at ${site.name}, and said it was a name: the name of ${C.fondOf}. That name is ${cap(pw)}. Staff logins there are ${staffRule}. You think this is funny and would tell a friendly person who asked about getting in, while saying they obviously shouldn't.`);
  if (kind === "default") k("host", `Every new staff login at ${site.name} was set to the same starting password, "${pw}", and ${who.name} never changed theirs. Staff logins there are ${staffRule}. You'd mention it to a friendly person, while saying they shouldn't.`);
  if (kind === "posted") k("host", `Staff at ${site.name} write their passwords on notes stuck to their desks; you have told them off about it more than once.`);
  if (kind === "scheme") k("host", `You set up the staff logins at ${site.name}: each starting password was the person's surname and the year they started, in lower case, run together. ${who.name} never changed theirs. You'd hint at it to a friendly person, while saying they shouldn't.`);
}

// ---- tools: writing, reading, testing, finishing -----------------------------------------------
async function runTool(D, name, a, ctx) {
  if (TOOLS[name]) return TOOLS[name](D, a);
  if (name === "write_pages") {
    const problems = checkDesign(D);
    if (problems.length) return `Fix the design first:\n${problems.map((p) => "- " + p).join("\n")}`;
    ctx.progress("writing the town's pages");
    const only = a.only?.length ? new Set(a.only.map(lc)) : null;
    const failed = await writePages(D, ctx.ask, only);
    const w = build(D);
    return `Written${failed.length ? `, except ${failed.join(", ")} (try again)` : ""}. ${w.pages.length} pages, ${Object.keys(w.npcs).length} people who answer email.
Repairs the engine made: ${w.generated.warnings.length ? "\n- " + w.generated.warnings.join("\n- ") : "none"}
Pages: ${w.pages.map((p) => `${p.url} (${p.content.split(/\s+/).length} words)`).join(", ")}`;
  }
  if (name === "read_page") {
    if (!D.written) return "Nothing is written yet.";
    const w = build(D), u = lc(a.url);
    const p = w.pages.find((x) => x.url === u) || Object.entries(w.docs).map(([, d]) => d).find((d) => lc(d.title) === u);
    return p ? p.content : `No page at ${u}. Pages: ${w.pages.map((x) => x.url).join(", ")}; documents: ${Object.values(w.docs).map((d) => d.title).join(", ")}`;
  }
  if (name === "edit_page") {
    const u = lc(a.url);
    if (!D.texts[u]) return `No written page at ${u}.`;
    if (!D.texts[u].includes(a.find)) return "The text to find is not on that page (it must match exactly).";
    D.texts[u] = D.texts[u].replace(a.find, a.replace ?? "");
    D.changed = true;
    return "Edited.";
  }
  if (name === "rewrite_pages") {
    const urls = [].concat(a.urls || []).map(lc);
    if (a.note) for (const u of urls) TOOLS.add_pages(D, { pages: [{ url: u, brief: `Revision: ${a.note}` }] });
    const failed = await writePages(D, ctx.ask, new Set(urls));
    return failed.length ? `Failed for ${failed.join(", ")}.` : "Rewritten.";
  }
  if (name === "playtest") {
    if (!D.written) return "Write the pages first.";
    ctx.progress("checking the town can be solved");
    D.solved = await solve(ctx.ask, build(D));
    D.changed = false;
    const ans = D.solved.answer;
    return D.solved.failures.length
      ? `The reader could not solve it:\n- ${D.solved.failures.join("\n- ")}\nFix the clue lines or pages (the engine's passwords and usernames are fixed), then playtest again.`
      : `Solved. The reader's reasoning: ${JSON.stringify(ans?.logins?.map((l) => l.how) || [])}${ans?.record ? ` Record: ${ans.record}` : ""}`;
  }
  if (name === "finish") {
    const problems = checkDesign(D);
    if (problems.length) return `Not finished:\n${problems.map((p) => "- " + p).join("\n")}`;
    if (!D.written) return "Write the pages first.";
    if (D.changed || !D.solved) await runTool(D, "playtest", {}, ctx);
    if (D.solved.failures.length && D.finishTries++ < 2) return `Not finished: the playtest failed:\n- ${D.solved.failures.join("\n- ")}`;
    D.done = true;
    return "Finished.";
  }
  return `No tool called ${name}.`;
}

// ---- the designer --------------------------------------------------------------------------------
const fn = (name, description, properties = {}, required = []) => ({ type: "function", function: { name, description, parameters: { type: "object", properties, required } } });
const str = (description) => ({ type: "string", description });
const arr = (items, description) => ({ type: "array", items, description });
const obj = (properties, description) => ({ type: "object", properties, description });
const SCHEMA = [
  fn("found_town", "Name the town and set its web suffix, dial-up provider, survey line and story.", {
    town: str("the town's name"), tld: str("two lower-case letters for its web addresses, from its name (never 'go')"),
    isp: str("one lower-case word: the local dial-up provider residents' home email is on"),
    survey: str("at most 35 words, in the dry voice of a government survey report, saying what the town is and what it has"),
    story: str("4-6 sentences: what is going on in the town right now, in this town's genre, naming the people involved. Unresolved. Background for every writer."),
    pattern: str("the pattern, a few words, never shown to players") }, ["town", "tld", "isp", "survey", "story"]),
  fn("add_sites", "Add or update websites. Required keys: archive (keeps old records), forum (the town forum), paper (local paper or newsletter). Route sites and your own extra sites take any key.", {
    sites: arr(obj({ key: str("short key, e.g. 'archive', 'chapel'"), name: str("the institution's name"), domain: str("the name a small institution would have picked in 1998, e.g. 'merritlib', 'oakesfeed', 'stjudes' (the engine adds the town's suffix)"), about: str("one or two lines: what it is and what its pages are like"), motto: str("forum only: its strapline") })) }, ["sites"]),
  fn("add_people", "Add or update people. Required keys: keeper (looks after the archive's old records, site archive) and host (runs the forum and fixes half the town's computers; chatty, overshares; site forum). Everyone with an email can be written to by the player and will answer in character.", {
    people: arr(obj({ key: str("short key"), name: str("Firstname Surname, plain, no title"), site: str("the site key they work at, or 'home' for a resident (home email at the dial-up provider)"),
      email: str("the part before the @, lower case"), role: str("their job or place in town, a few words"), handle: str("their forum username, lower case"),
      persona: str("second person, 3-4 sentences: 'You are ...'. Manner, how they write email, how they sign off, how they feel about the town's story."),
      knows: arr({ type: "string" }, "3-6 things they know, in the second person: their life and work, their part in the story, other people they know and what they think of them"),
      unknown: arr({ type: "string" }, "2 things they do not know") })) }, ["people"]),
  fn("set_route", "Fill in one route to a fragment. Call again to change fields.", {
    route: str("public | login | records | insider"),
    docTitle: str("the document's title"), docKind: str("a few words, e.g. 'a scanned parish register'"), about: str("what the document is, one or two sentences"),
    anchor: str("the fixed fact: a 2-6 word phrase carrying the pattern"), anchorSentence: str("one sentence from the document that contains the anchor exactly"),
    slug: str("public/login: lower-case url segment"), site: str("login/records/insider: the site key"),
    owner: str("login: the person key whose account opens the file; works at the site"),
    office: str("records: the office's shared mailbox person key (name is how the office signs, e.g. 'Office of the Town Clerk'); works at the site"),
    formName: str("records: the request form's name, e.g. 'form R-4'"), recordTitle: str("records: the official record's title, with distinctive words"),
    keywords: arr({ type: "string" }, "records: 1-3 lower-case words anyone asking for it would use"),
    article: str("records: 3-5 sentences for a public page saying this record exists, that the office holds it and sends a copy to anyone who files the form, without quoting the anchor"),
    pointerPerson: str("records: person key of whoever wrote the article"), pointerUrl: str("records: URL of the page the article goes on (default: the paper's home page)"),
    holder: str("insider: person key who keeps the document"), colleague: str("insider: person key of the absent colleague whose webmail the player opens"),
    staffOnly: str("insider: a sentence for the workplace's home page saying the document is circulated to staff only, by the holder, on request"),
    autoReply: str("insider: the colleague's out-of-office auto-reply (2-3 sentences, their voice)"),
    fondOf: str("fond clue: the thing the account holder is fond of, named with the given name, as a noun phrase without the owner's name"),
    clueThread: str("fond/default/scheme: the forum thread's title, lower case, under 40 characters, about something other than passwords"),
    refusal: str("fond: a forum post by the account holder refusing in public to change their password, saying what it is the name of WITHOUT giving the name"),
    nameSentence: str("fond: a sentence for a public page that mentions the thing by its name"), nameUrl: str("fond: URL of that page (default: the paper's home page)"),
    issueLine: str("default: a forum post by the host saying every new staff login there was given the same starting password, quoting it"),
    admitLine: str("default/scheme: a forum post by the account holder admitting they never changed theirs (without quoting it)"),
    caption: str("posted: a photo caption starting 'Photo:', describing a photo of the account holder's desk where a note quoting the password is legible"), captionUrl: str("posted: URL of the page with the photo (default: the site's home page)"),
    schemeLine: str("scheme: a forum post by the host explaining how starting passwords were made (surname then the year the person started, lower case, no spaces), without giving anyone's"),
    factSentence: str("scheme: a sentence for a public page naming the account holder and the year they started"), factUrl: str("scheme: URL of that page (default: the paper's home page)"),
  }, ["route"]),
  fn("add_pages", "Add your own pages, or add to the brief of an engine page by giving its URL. The writer sees only the brief, the town's story and the people list, so put specifics in the brief.", {
    pages: arr(obj({ url: str("domain/path, on one of the town's sites"), title: str("page title"), brief: str("what the page says: specifics, who wrote it, which people and events it mentions"),
      must: arr({ type: "string" }, "lines that must appear word for word"), links: arr(obj({ url: str(""), label: str("") }), "extra links, e.g. across sites") })) }, ["pages"]),
  fn("add_threads", "Add forum threads. The engine numbers them.", {
    threads: arr(obj({ title: str("lower case, under 40 characters"), brief: str("what is said, by whom, how it goes; specifics"), posters: arr({ type: "string" }, "forum handles of your people who post in it"),
      must: arr({ type: "string" }, "posts that must appear word for word, as '[handle] text'") })) }, ["threads"]),
  fn("check", "List what is wrong or missing in the design, and every page the town will have."),
  fn("write_pages", "Have the writer write the pages, every site in parallel. Fails if check finds problems. 'only' limits it to some site keys or URLs.", { only: arr({ type: "string" }, "optional site keys or URLs") }),
  fn("read_page", "Read a written page (or an emailed document, by its title) as the player will see it.", { url: str("the URL or document title") }, ["url"]),
  fn("edit_page", "Replace exact text on a written page.", { url: str(""), find: str("exact text"), replace: str("new text") }, ["url", "find", "replace"]),
  fn("rewrite_pages", "Have the writer write some pages again, with a note.", { urls: arr({ type: "string" }, ""), note: str("what to change") }, ["urls"]),
  fn("playtest", "A separate reader reads only the public pages, cold, and tries to work out each staff login and which record to request."),
  fn("finish", "Finish the town. Accepted when the design checks out, the pages are written and the playtest passes."),
];

function systemPrompt(plan) {
  const routes = plan.routes.map((r, i) => `- A${i + 1}, ${r}: ${ROUTE_NOTE[r]}.${r === "login" || r === "insider" ? ` Password clue: ${CLUE_TEXT[plan.clue[r]](plan, r)}` : ""}`).join("\n");
  return `${toneFor(plan)}

You are designing one such town, with tools. A writer model will write the pages from your briefs; the engine handles the game's mechanics.

THE TOWN'S PATTERN: ${plan.pattern}. The name of the town starts with ${plan.townInitial}.
CAST: give your people names with these initials, in order (first name, surname), choosing names that fit the place: ${plan.cast.join(", ")}.

THE PUZZLE
There are ${plan.routes.length} fixed facts ("anchors"). Each is a 2-6 word phrase that appears exactly once, in one old document. Each is about a different, unrelated thing that happens to carry the pattern: they should read as separate facts from separate records, not one fact said ${plan.routes.length} ways. (For a town patterned on seven: "7,777 souls" (a census), "seven strokes, no more" (a bell), "seven founding stones" (a building).) Each is reached a different way:
${routes}
Staff usernames follow one rule, which the engine prints on every login page: "${RULES[plan.rule].text}" Passwords are fixed by the engine; set_route tells you each one.
Clue lines must let a careful reader of the public pages work each password out, without anyone saying "the password is X".${plan.routes.length > 3 ? " (Three of the four fragments are enough to win, so the player can choose.)" : ""}

SIZE AND DEPTH
- Sites: archive, forum and paper, the sites the routes need, and at least ${plan.size.extraSites} more of your own that suit this town and its story (a church, a club, a school, a shop, a radio station, a tourist board, somebody's personal home page...). Not every town has the same ones.
- People: everyone the routes need, plus at least ${plan.size.extraPeople} more residents tied into the story. Give people opinions of each other. People hold different pieces of the story; some will tell a stranger, some will not.
- Forum: at least ${plan.size.threads} threads of your own besides the clue threads. Some carry the story, some are ordinary life.
- The story crosses sites: the paper reports it one way, the forum argues about it, somebody's own page tells it their way.
- Echo the pattern faintly once or twice in ordinary present-day life, unremarked, never using an anchor's words.
- Put specifics in briefs: names, dates, sums, who said what. A brief like "a notice about the fete" gets a bland page.

WORKFLOW
1. found_town. 2. add_sites, then add_people. 3. set_route for each route. 4. add_pages and add_threads. 5. check, and fix every problem. 6. write_pages. 7. read_page the pages that matter most (the clue pages, a story page); fix with edit_page or rewrite_pages. 8. playtest; fix and playtest again if it fails. 9. finish.
Call several tools in one turn wherever you can. You have about ${MAX_TURNS} turns. Do not write page text yourself except in small edits.`;
}

const CLUE_TEXT = {
  fond: (plan, r) => `"fond": the account holder uses the name of something they are fond of, and that name is ${cap(plan.fondName)}. They refuse on the forum to change it and say what it is the name of; a public page names the thing.`,
  default: (plan, r) => `"default": every new staff login at that site was given the same starting password, ${plan.passwords[r]}. The host complains about it on the forum, quoting it; the account holder admits there they never changed theirs.`,
  posted: (plan, r) => `"posted": the account holder's password, ${plan.passwords[r]}, is legible on a note in a photo of their desk, described in a photo caption on a public page.`,
  scheme: (plan, r) => `"scheme": starting passwords were each person's surname then the year they started (lower case, run together); the account holder never changed theirs and started in ${plan.years[r]}. The host explains the scheme on the forum; the holder admits there they never changed it; a public page gives the year they started.`,
};

export async function designWorld({ chat = llmChat, seed, plan = makePlan(seed, { agentic: true }), onProgress = () => {}, log = () => {} } = {}) {
  const t0 = performance.now(), c0 = usage.cost;
  const D = newDraft(plan);
  const ask = async (role, system, user, maxTokens = 12000) => {
    const msg = await chat(role, [{ role: "system", content: system }, { role: "user", content: user }], { maxTokens, json: true });
    const j = extractJSON(msg.content);
    if (!j) throw new Error(`${role}: no JSON in reply`);
    return j;
  };
  const ctx = { ask, progress: onProgress };
  const messages = [{ role: "system", content: systemPrompt(plan) }, { role: "user", content: "Design the town. Start now." }];
  const calls = [];
  onProgress("designing the town");
  for (let turn = 0; turn < MAX_TURNS && !D.done; turn++) {
    const over = usage.cost - c0 > MAX_COST, late = turn >= MAX_TURNS - 3;
    if ((over || late) && D.written) messages.push({ role: "user", content: "You are out of time. Call finish now." });
    const msg = await chat("worldagent", messages, { tools: SCHEMA, maxTokens: 24000 });
    const keep = { role: "assistant", content: msg.content || "" };
    if (msg.tool_calls) keep.tool_calls = msg.tool_calls;
    if (msg.reasoning_details) keep.reasoning_details = msg.reasoning_details;
    messages.push(keep);
    if (!msg.tool_calls?.length) { messages.push({ role: "user", content: "Carry on with the tools; call finish when the town is done." }); continue; }
    for (const tc of msg.tool_calls) {
      let args = null, result;
      try { args = JSON.parse(tc.function.arguments || "{}"); } catch { result = "error: the arguments were not valid JSON."; }
      if (!result) {
        try { result = await runTool(D, tc.function.name, args, ctx); }
        catch (e) { result = `error: ${e.message}`; }
      }
      calls.push(tc.function.name);
      log(`${tc.function.name}: ${String(result).split("\n")[0].slice(0, 140)}`);
      messages.push({ role: "tool", tool_call_id: tc.id, content: String(result) });
    }
  }
  if (!D.done) {
    if (!D.written || checkDesign(D).length) throw new Error(`the designer did not finish (${calls.length} tool calls)`);
    if (D.changed || !D.solved) D.solved = await solve(ask, build(D));
    if (D.solved.failures.length) throw new Error(`unsolved: ${D.solved.failures.join("; ")}`);
  }
  const world = build(D);
  world.generated = { at: new Date().toISOString(), by: "agent", plan, solver: D.solved, warnings: world.generated.warnings,
    ms: Math.round(performance.now() - t0), cost: +(usage.cost - c0).toFixed(4), calls };
  // the evening's small updates (js/living.js); a town without them still plays
  try { world.updates = (await townUpdates(world, chat)).ok; } catch (e) { world.generated.warnings.push(`updates: ${e.message}`); }
  return world;
}
