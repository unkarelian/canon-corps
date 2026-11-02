// World generation for v2 (DESIGN-v2, PLAN phase 9). The engine designs the puzzle; models write the town; the
// engine checks the result and repairs what it can.
//
//   1. plan    (code, seeded)  setting, genre, tone; the divergence year and which canon events are written about
//                              where; apotheosis; inferiority class and distance; the password words; the agent.
//   2. bible   (worldgen)      one call: the town, its sites and pages, its people, the edge road and what is out
//                              there, and one sentence for every canon mention, in the voice of the page it goes on.
//   3. pages   (worldtext)     one call per site, in parallel. Mentions and injected lines must appear verbatim.
//   4. mail    (worldtext)     one call: the town's own mail for the evening (W.traffic).
//   5. check   (code)          schema (engine.checkWorld), canon placement (every planned source, nothing after the
//                              divergence verifiable), no real events after 1900, the password words in town.
//
// Variety comes from the seeded plan, not from asking a model to be original.
import { chat as llmChat } from "./llm.js";
import { extractJSON } from "./util.js";
import { rng, pick, shuffle, SETTINGS, GENRES, TONES, PAGE_RULES, urlReFor } from "./worldgen.js";
import { CANON, canonYear } from "./canon.js";
import { checkWorld } from "./engine.js";
import { fieldBriefV2, DESK_NOTICE, OFFICE } from "./templates.js";

// A distinctive word or two from each canon event, for checking a page really mentions it.
const KEY = {
  "00": "Meridian", "02": "Halverson", "04": "Antwerp", "07": "time signal", "09": "Carrow", "12": "Corriedale",
  "14": "Ostend", "17": "Influenza", "19": "Graz", "21": "Envelope", "24": "decimal hour", "27": "Ostend", "29": "Frost",
  "31": "Pell", "33": "Blight", "36": "Lighthouse", "41": "Baltic", "44": "Glasgow", "49": "copper", "52": "Meridian",
  "55": "Ashby", "58": "Lagos", "61": "Halcyon", "63": "Water Act", "66": "Kestrel", "69": "Osaka", "72": "Andean",
  "75": "Copper Coast", "78": "Kestrel", "81": "postal code", "84": "meridian clocks", "88": "Valletta", "91": "Calais",
  "94": "Postal Network", "96": "RS-96", "99": "Keeper",
}; // shared words ('00/'52 Meridian, '14/'27 Ostend, '66/'78 Kestrel) are told apart by the year

// Real events after 1900 that a writer might reach for. Any of these on a page is cut.
const REAL_AFTER_1900 = /\b(world war|WWI|WWII|the great war|blitz|hitler|nazi|churchill|D-Day|VE day|pearl harbou?r|hiroshima|cold war|berlin wall|vietnam|korean war|apollo|moon landing|neil armstrong|sputnik|gagarin|kennedy|JFK|titanic|lusitania|spanish flu|great depression|wall street crash|the depression|coronation of|queen elizabeth|king george|princess diana|thatcher|reagan|beatles|elvis|chernobyl|falklands war|gulf war|millennium dome|man on the moon|television was invented|the internet)\b/i;

const PASSWORD_WORDS = ["harbour", "bridge", "chapel", "market", "orchard", "station", "mill", "bell", "garden", "shelf", "lantern",
  "kettle", "ledger", "quay", "meadow", "fountain", "clock", "steeple", "signal", "ferry", "bakery", "hedge", "pier", "forge",
  "granary", "tower", "spring", "common", "anchor", "lighthouse", "school", "hall", "barn", "furnace", "pump", "chimney"];
const SURNAMES = ["Marsh", "Okafor", "Brandt", "Pryce", "Castell", "Ferreira", "Dunmore", "Halloran", "Szabo", "Quayle", "Ashworth",
  "Bellamy", "Novak", "Tremlett", "Ibbotson", "Varga", "Kettering", "Rourke", "Sato", "Lindgren", "Abara", "Fenwick", "Moss", "Calder"];
const AGES = ["three to five weeks", "four to six weeks", "about nine days", "five to seven weeks", "a little under two months", "two to three weeks"];
const BANDS = [[0.6, 1.8], [2.5, 9], [11, 38], [45, 140], [160, 400]]; // miles, per inferiority class I-V
const INJECTED_KINDS = [
  (n) => ({ kind: "a club or quiz results post", line: `2nd: ${n} and partner` }),
  (n) => ({ kind: "a church or community rota", line: `Week 3: ${n}` }),
  (n) => ({ kind: "a list of new library members or a membership list", line: `New this month: ${n}` }),
  (n) => ({ kind: "a raffle, show or fete prize list", line: `Third prize (marrow): ${n}` }),
  (n) => ({ kind: "a petition or letters list in the newspaper", line: `Also signed: ${n}` }),
];

// ---- 1. plan --------------------------------------------------------------------------------------
export function makePlan2(seed = Math.floor(Math.random() * 2 ** 31)) {
  const r = rng(seed);
  const dIdx = 10 + Math.floor(r() * 20);                  // the divergence event: '24 to '81
  const before = shuffle(r, CANON.slice(1, dIdx).map((_, i) => i + 1)).slice(0, 4).sort((a, b) => a - b);
  const verifiable = [...before, dIdx];                    // each written about in two independent sources
  const after = CANON.slice(dIdx + 1, CANON.length - 1);   // never '99
  const single = dIdx + 1;                                  // the next event: only one source
  const wrong = dIdx + 2 + Math.floor(r() * Math.max(1, after.length - 2)); // two sources, both with the wrong year
  const cls = 1 + Math.floor(r() * 5);
  const [lo, hi] = BANDS[cls - 1];
  const surname = pick(r, SURNAMES), initial = pick(r, [..."ABCDEFGHJKLMNPRST"]);
  const [w1, w2] = shuffle(r, PASSWORD_WORDS);
  return {
    seed, id: "0x" + Math.floor(r() * 0xffff).toString(16).toUpperCase().padStart(4, "0"),
    setting: pick(r, SETTINGS), genre: pick(r, GENRES), tone: pick(r, TONES), age: pick(r, AGES),
    townInitial: pick(r, [..."ABCEFGHKLMNOPRSTW"]),
    divergence: { index: dIdx, year: canonYear(CANON[dIdx][0]), verifiable, single, wrong: Math.min(wrong, CANON.length - 2) },
    apotheosis: 1 + Math.floor(r() * 5),
    inferiority: { class: cls, miles: Math.round((lo + r() * (hi - lo)) * 10) / 10 },
    password: [w1, w2],
    agent: { name: `${initial}. ${surname}`, local: `${surname.toLowerCase()}.${initial.toLowerCase()}` },
    injected: shuffle(r, INJECTED_KINDS).slice(0, 2).map((f) => f(`${initial}. ${surname}`)),
    cast: Array.from({ length: 10 }, () => pick(r, [..."ABCEFGHKLMNOPRSTWY"])),
  };
}

// Source slots: every verifiable event goes to two different sites (one of them may be a town email), the
// single near-miss to one site, the wrong-year pair to two sites.
function slots(plan, siteKeys, r) {
  const out = [];
  const twoSites = () => shuffle(r, siteKeys).slice(0, 2);
  plan.divergence.verifiable.forEach((i, k) => {
    const [a, b] = twoSites();
    out.push({ event: i, year: canonYear(CANON[i][0]), site: a, kind: "true" });
    out.push({ event: i, year: canonYear(CANON[i][0]), site: k === 1 ? "mail" : b, kind: "true" }); // one pair goes by email
  });
  out.push({ event: plan.divergence.single, year: canonYear(CANON[plan.divergence.single][0]), site: pick(r, siteKeys), kind: "single" });
  const wy = canonYear(CANON[plan.divergence.wrong][0]) + 1;
  const [a, b] = twoSites();
  out.push({ event: plan.divergence.wrong, year: wy, site: a, kind: "wrong" }, { event: plan.divergence.wrong, year: wy, site: b, kind: "wrong" });
  return out.map((s, n) => ({ ...s, id: `c${n}`, text: CANON[s.event][1].replace(/\.$/, ""), key: KEY[CANON[s.event][0]] }));
}

// ---- 2. bible --------------------------------------------------------------------------------------
const voice = (plan) => `You design small towns for a game. In it, a clerk at an agency studies a town through its little late-1990s websites (an archive or library, a council page, a forum, a newspaper, a church, a pub, a club) and its residents' email.

The town is ordinary and a few degrees off. People live normal lives. Nothing supernatural is ever shown and nothing is explained.

This town:
- Setting: ${plan.setting.place}. Spelling: ${plan.setting.spelling}.
- Genre: ${plan.genre.name}: ${plan.genre.undercurrent}. The town is in the middle of this story, unresolved, played straight.
- Tone: ${plan.tone.name}: ${plan.tone.how}.
- The town's name begins with ${plan.townInitial}. Residents' names: avoid famous names; first names begin with these letters, in order: ${plan.cast.join(", ")}.

This world's history after 1900 is NOT ours. Never mention any real event, person or invention after 1900 (no wars, monarchs, politicians, celebrities, moon landings, famous disasters). Older local history and local events are fine. The world's wider history is given to you where needed; use only that.`;

function bibleRequest(plan, cs) {
  const edge = plan.inferiority;
  return `Design the town. Reply with JSON only, in this shape:
{
 "town": "Name",
 "tld": "two or three lowercase letters for the town's web addresses, e.g. hg",
 "survey": "one dry sentence describing the town's size and institutions, as an agency survey would",
 "story": "three sentences: the unresolved story the town is in",
 "sites": [ {"key": "short_id", "name": "Site name", "domain": "name.tld", "about": "what it is", "pages": [ {"path": "" for the home page or "something", "title": "...", "brief": "what the page says, one sentence"} ] } ],
 "people": [ {"name": "...", "email": "first@domain-of-their-site", "site": "site key", "role": "...", "handle": "forum username", "persona": "two sentences: who they are and exactly how they write email", "knows": ["4-6 concrete things they know"], "unknown": ["2 things they don't know"], "canTravel": true or false } ],
 "forumHost": "email of the person who runs the forum",
 "edge": {"road": "the road out of town nobody takes, e.g. 'the coast road north, past the gravel works'", "whatTheyFind": "three or four plain sentences: what someone who drives or walks out along it finds"},
 "mentions": { "<slot id>": "one sentence for that slot" }
}

Requirements:
- 6 or 7 sites, each with a home page and 2 to 4 more pages. One site is a forum: its pages are threads (path like "forum/t/123"). One is a newspaper or newsletter with a local history page or two.
- 6 to 8 people with email addresses on their sites' domains. At least two have "canTravel": true (they have a car or van and could be persuaded to drive somewhere odd).
- Some people should mention, in what they know, the road out of town nobody seems to take.
- The edge: ${edge.class === 1 ? "it is very close: within walking distance" : `it is about ${edge.miles} miles out`}. What they find there: the road and the country go on but stop being particular, and then repeat: the same landmark again, or the road brings them back into the town from the other side, at about ${edge.miles} miles. Plain description, no explanation, no fear words.
- The password words "${plan.password[0]}" and "${plan.password[1]}" must be ordinary, natural parts of the town: a street, a building, a thing people mention. Make sure at least two pages' briefs would naturally include each.
- Mentions: for each slot below, write ONE sentence in the voice of a page on the given site (or, for "mail", of an email between residents) about how the town took part in or remembers the event. Name the event by its short name the way people would say it (for example "the Halverson Accord", "the Long Frost", "the Lagos Exposition") and give the year as a number, exactly the year given. Never quote the event's full title and never use quotation marks. Each sentence must stand on its own and sound like the town, not like a reference book.
${cs.map((s) => `  ${s.id}: site ${s.site}; event "${s.text}"; year ${s.year}`).join("\n")}
- Two pages must each carry a line naming "${plan.agent.name}" (a resident nobody has met): ${plan.injected.map((x) => x.kind).join("; and ")}. Give those pages briefs that fit.`;
}

// ---- 3-4. pages and mail ---------------------------------------------------------------------------
async function writeSite(ask, plan, B, site, allUrls, must) {
  const people = B.people.map((p) => `- ${p.name}, ${p.role}, ${p.email}, forum username "${p.handle}"`).join("\n");
  const user = `Town: ${B.town}. ${B.survey}
The town's story: ${B.story}
People:
${people}

You are writing the website of ${site.name} (${site.domain}): ${site.about}.
Addresses you may link to: ${allUrls.join(", ")}

Pages to write:
${site.pages.map((p) => `URL ${p.url}
  title: ${p.title}
  what: ${p.brief}${p.url === site.domain ? `\n  links to include: every other page of this site` : ""}${(must[p.url] || []).map((m) => `\n  MUST APPEAR: ${m}`).join("")}`).join("\n\n")}

Reply with JSON only: {"pages": {"<url>": "<the page's text>", ...}}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return (await ask("worldtext", `${voice(plan)}\n\n${PAGE_RULES}`, user, 10000)).pages || {}; }
    catch (e) { if (attempt) throw e; }
  }
}

async function writeMail(ask, plan, B, mailMentions) {
  const people = B.people.map((p) => `- ${p.name} <${p.email}>, ${p.role}`).join("\n");
  const user = `Town: ${B.town}. ${B.survey}
The town's story: ${B.story}
People:
${people}

Write the town's own email for one evening: 32 to 38 short emails between these people, in their own voices, about ordinary business and the town's story. Times are minutes from 20:30, from 1 to 88, in order. Replies follow what they answer.
Include:
- ${mailMentions.map((m) => `an email that contains, word for word: "${m}"`).join("\n- ") || "nothing extra"}
- two or three emails in which residents mention ${plan.agent.name}, whose name is on a page in town but whom nobody has ever met or seen.
- one or two emails in which someone wonders about ${B.edge.road}, and that nobody ever seems to go out along it.
- the words "${plan.password[0]}" and "${plan.password[1]}" used naturally at least once each.
Never mention any real event, person or invention after 1900.

Reply with JSON only: {"emails": [{"at": minutes, "from": "address", "to": "address", "subject": "...", "body": "..."}]}`;
  return (await ask("worldtext", voice(plan), user, 14000)).emails || [];
}

// ---- 5. checks and repairs -------------------------------------------------------------------------
const yearRe = (y) => new RegExp(`\\b${y}\\b`);
function mentions(text, s) { return !!s.key && text.toLowerCase().includes(s.key.toLowerCase()) && yearRe(s.year).test(text); }

function checkCanon(world, cs, plan) {
  const problems = [];
  const sources = [...world.pages.map((p) => ({ where: p.url, text: p.content })), ...world.traffic.map((t, i) => ({ where: `mail ${i}`, text: `${t.subject}\n${t.body}` }))];
  for (const i of plan.divergence.verifiable) {
    const s = cs.find((x) => x.event === i);
    const n = sources.filter((x) => mentions(x.text, s)).length;
    if (n < 2) problems.push(`verifiable '${CANON[i][0]} (${s.key}) has ${n} source(s)`);
  }
  // nothing after the divergence may be verifiable: a later canon event, with its true year, in two sources
  for (let i = plan.divergence.index + 1; i < CANON.length; i++) {
    const s = { key: KEY[CANON[i][0]], year: canonYear(CANON[i][0]) };
    const n = sources.filter((x) => mentions(x.text, s)).length;
    if (n >= 2) problems.push(`'${CANON[i][0]} (${s.key}) after the divergence is verifiable (${n} sources)`);
  }
  for (const x of sources) { const m = x.text.match(REAL_AFTER_1900); if (m) problems.push(`real event "${m[0]}" in ${x.where}`); }
  return problems;
}

// Cut sentences that name a real post-1900 event, or a post-divergence canon event beyond its planned source.
function scrub(world, cs, plan) {
  const cut = (text, re) => text.split("\n").map((l) => l.replace(new RegExp(`[^.!?\\n]*${re.source}[^.!?\\n]*[.!?]?`, "gi"), "").replace(/\s{2,}/g, " ")).join("\n");
  for (const p of world.pages) p.content = cut(p.content, REAL_AFTER_1900);
  for (const t of world.traffic) t.body = cut(t.body, REAL_AFTER_1900);
  for (let i = plan.divergence.index + 1; i < CANON.length; i++) {
    const s = { key: KEY[CANON[i][0]], year: canonYear(CANON[i][0]) };
    const planned = new Set(cs.filter((c) => c.event === i && c.kind === "single").map((c) => c.url));
    let kept = 0;
    for (const p of world.pages) if (mentions(p.content, s)) { if (planned.has(p.url) && !kept++) continue; p.content = cut(p.content, new RegExp(s.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))); }
    for (const t of world.traffic) if (mentions(t.body, s)) t.body = cut(t.body, new RegExp(s.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
}

// ---- the whole thing -------------------------------------------------------------------------------
export async function generateWorld2({ chat = llmChat, seed, onProgress = () => {}, log = () => {} } = {}) {
  const plan = makePlan2(seed);
  const r = rng(plan.seed ^ 0x5eed);
  const t0 = Date.now();
  const ask = async (role, system, user, maxTokens = 12000) => {
    const msg = await chat(role, [{ role: "system", content: system }, { role: "user", content: user }], { maxTokens, json: true });
    const j = extractJSON(msg.content);
    if (!j) throw new Error(`${role}: no JSON in reply`);
    return j;
  };

  // The bible needs the slots, and the slots need the site keys; a site-free first pass gives the keys.
  const provisionalKeys = ["news", "forum", "council", "church", "club", "library"];
  let cs = slots(plan, provisionalKeys, r);
  onProgress("designing the town");
  let B;
  for (let attempt = 0; attempt < 2 && !B; attempt++) {
    try {
      const b = await ask("worldgen", voice(plan), bibleRequest(plan, cs).replace(/site (news|forum|council|church|club|library)/g, "site $1 (or the nearest site you design)"), 16000);
      if (!b.sites?.length || !b.people?.length || !b.edge?.road) throw new Error("bible incomplete");
      B = b;
    } catch (e) { log(`bible attempt ${attempt + 1} failed: ${e.message}`); if (attempt) throw e; }
  }
  const tld = String(B.tld || "xx").toLowerCase().replace(/[^a-z]/g, "").slice(0, 3) || "xx";
  for (const s of B.sites) {
    s.domain = String(s.domain || `${s.key}.${tld}`).toLowerCase().replace(/[^a-z0-9.-]/g, "");
    if (!s.domain.endsWith(`.${tld}`)) s.domain = `${s.domain.split(".")[0]}.${tld}`;
    s.pages = (s.pages || []).map((p) => ({ ...p, url: p.path ? `${s.domain}/${String(p.path).replace(/^\/+|\/+$/g, "")}` : s.domain }));
    if (!s.pages.some((p) => p.url === s.domain)) s.pages.unshift({ url: s.domain, title: s.name, brief: s.about });
  }
  // map provisional slot sites onto real sites, then put each mention on a non-home page of that site
  const keys = B.sites.map((s) => s.key);
  const siteFor = (k) => B.sites.find((s) => s.key === k) || B.sites.find((s) => new RegExp(k.slice(0, 4), "i").test(`${s.key} ${s.name} ${s.about}`)) || pick(r, B.sites);
  const must = {}, mailMust = [];
  for (const s of cs) {
    const line = String(B.mentions?.[s.id] || `${s.text}, ${s.year}.`).trim();
    s.line = mentions(line, s) ? line : `People here still talk about the ${s.key} of ${s.year}.`;
    if (s.site === "mail") { mailMust.push(s.line); continue; }
    let site = siteFor(s.site);
    const pages = site.pages.filter((p) => p.url !== site.domain);
    const pool = pages.length ? pages : site.pages;
    const least = Math.min(...pool.map((p) => (must[p.url] || []).length));
    const page = pick(r, pool.filter((p) => (must[p.url] || []).length === least)); // spread mentions across pages
    s.url = page.url;
    (must[page.url] ||= []).push(s.line);
  }
  // the same event's two sources must be different sites; nudge the second if they landed together
  for (const i of plan.divergence.verifiable) {
    const [a, b] = cs.filter((x) => x.event === i && x.url);
    if (a && b && a.url.split("/")[0] === b.url.split("/")[0]) {
      const other = B.sites.find((s) => s.domain !== a.url.split("/")[0]);
      const page = pick(r, other.pages);
      must[b.url] = must[b.url].filter((m) => m !== b.line);
      b.url = page.url;
      (must[page.url] ||= []).push(b.line);
    }
  }
  // injected lines naming the agent
  const injected = [];
  const nonForum = B.sites.filter((s) => !/forum|board/i.test(`${s.key} ${s.name}`));
  plan.injected.forEach((inj, k) => {
    const site = k === 0 ? B.sites.find((s) => /forum|board|club/i.test(`${s.key} ${s.name}`)) || pick(r, B.sites) : pick(r, nonForum.length ? nonForum : B.sites);
    const page = pick(r, site.pages.filter((p) => p.url !== site.domain).length ? site.pages.filter((p) => p.url !== site.domain) : site.pages);
    const line = inj.line;
    (must[page.url] ||= []).push(line);
    injected.push(page.url);
  });

  onProgress("writing the town's pages");
  const allUrls = B.sites.flatMap((s) => s.pages.map((p) => p.url));
  const texts = {};
  await Promise.all(B.sites.map(async (s) => Object.assign(texts, await writeSite(ask, plan, B, s, allUrls, must))));

  onProgress("writing the town's mail");
  let emails = [];
  try { emails = await writeMail(ask, plan, B, mailMust); } catch (e) { log(`mail failed: ${e.message}`); }

  // assemble
  const urlRe = urlReFor(tld);
  const urls = new Set(allUrls);
  const pages = [];
  for (const s of B.sites) for (const p of s.pages) {
    let content = String(texts[p.url] || p.title.toUpperCase()).replace(/\r/g, "").trim();
    for (const m of must[p.url] || []) if (!content.includes(m)) content += `\n\n${m}`;
    if (p.url === s.domain) for (const q of s.pages) if (q.url !== s.domain && !content.includes(q.url)) content += `\n> ${q.title}    ${q.url}`;
    content = content.replace(urlRe, (u) => urls.has(u) ? u : (urls.has(u.split("/")[0]) ? u.split("/")[0] : u.split("/")[0].replace(/\./g, " ")));
    const page = { url: p.url, title: p.title, content };
    if (/\/t\/\d+|forum\/t/.test(p.url) || /^Thread:/m.test(content)) page.thread = true;
    pages.push(page);
  }
  const addr = new Set(B.people.map((p) => p.email.toLowerCase()));
  const agentAddress = `${plan.agent.local}@${(B.sites.find((s) => /forum|net|board/i.test(s.key + s.name)) || B.sites[0]).domain}`;
  const traffic = emails.map((e) => ({ at: Math.max(1, Math.min(95, Math.round(+e.at || 1))), from: String(e.from || "").toLowerCase(), to: String(e.to || "").toLowerCase(), subject: String(e.subject || ""), body: String(e.body || "") }))
    .filter((e) => addr.has(e.from) && addr.has(e.to) && e.from !== e.to).sort((a, b) => a.at - b.at);
  for (const m of mailMust) if (!traffic.some((t) => t.body.includes(m))) {
    const [a, b] = shuffle(r, [...addr]);
    traffic.push({ at: 20 + Math.floor(r() * 50), from: a, to: b, subject: "something I came across", body: m });
  }
  traffic.sort((a, b) => a.at - b.at);

  const npcs = {};
  for (const p of B.people) npcs[p.email.toLowerCase()] = { name: p.name, role: p.role, handle: p.handle || p.email.split("@")[0],
    delay: [35 + Math.floor(r() * 30), 80 + Math.floor(r() * 40)], persona: `You are ${p.name}, ${p.role} in ${B.town}. ${p.persona}`,
    knows: p.knows || [], unknown: [...(p.unknown || []), `Who ${plan.agent.name} is. You have never met them.`], canTravel: !!p.canTravel };
  if (!Object.values(npcs).some((n) => n.canTravel)) Object.values(npcs)[0].canTravel = true;

  const world = {
    id: plan.id, name: B.town.toUpperCase(), town: B.town, tld, schema: 2, generated: { at: new Date().toISOString(), plan, ms: 0, warnings: [] },
    survey: B.survey, age: plan.age, story: B.story, setting: plan.setting.place, genre: plan.genre.name, tone: plan.tone.name,
    agent: { address: agentAddress, name: plan.agent.name, role: `a resident of ${B.town}`, handle: plan.agent.local.replace(".", "_"), injected },
    password: plan.password,
    divergence: { year: plan.divergence.year, slots: cs.map(({ id, event, year, kind, url, line }) => ({ id, canon: CANON[event][0], year, kind, url: url || "mail", line })) },
    apotheosis: plan.apotheosis,
    inferiority: { class: plan.inferiority.class, edge: { road: B.edge.road, distanceMiles: plan.inferiority.miles, tripMinutes: Math.min(10, 3 + plan.inferiority.class), whatTheyFind: B.edge.whatTheyFind } },
    pages, npcs, mailboxes: {}, credentials: {}, docs: {}, records: null,
    roots: B.sites.map((s) => s.domain),
    forum: { replier: (B.forumHost || "").toLowerCase() in npcs ? B.forumHost.toLowerCase() : Object.keys(npcs)[0], handle: "host" },
    traffic,
  };
  world.forum.handle = npcs[world.forum.replier].handle;

  onProgress("checking the town");
  scrub(world, cs, plan);
  // password words: if a word never occurs, put it into a home page's last line
  for (const w of plan.password) if (!new RegExp(`\\b${w}s?\\b`, "i").test(pages.map((p) => p.content).join("\n") + traffic.map((t) => t.body).join("\n"))) {
    const home = pages.find((p) => p.url === world.roots[0]);
    home.content += `\nNotice: the ${w} is closed on Sundays until further notice.`;
    world.generated.warnings.push(`password word "${w}" inserted`);
  }
  world.hqMail = [fieldBriefV2(world), DESK_NOTICE, pick(r, OFFICE)];
  world.generated.warnings.push(...checkCanon(world, cs, plan), ...checkWorld(world));
  world.generated.ms = Date.now() - t0;
  world.generated.ok = !world.generated.warnings.some((w) => /verifiable|real event|missing|must be|unknown address/.test(w));
  log(`${world.name}: ${pages.length} pages, ${Object.keys(npcs).length} people, ${traffic.length} emails; warnings: ${world.generated.warnings.join("; ") || "none"}`);
  return world;
}
