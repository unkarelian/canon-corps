// World generation. The engine designs the puzzle; models write the town; the engine checks the result.
//
//   1. plan     (code, seeded)  which three routes lead to the seed fragments, which password clue each
//                               login uses, the username rule, the setting and the kind of pattern.
//   2. bible    (worldgen)      one call: the town, its sites and people, the anchors and every clue line,
//                               written to the plan.
//   3. pages    (worldtext)     one call per website, in parallel. Clue lines and anchor sentences are
//                               given verbatim and must appear verbatim.
//   4. assemble (code)          pages, people, credentials, documents, directives, HQ mail. Anything
//                               required that is missing is put back; stray links are repaired.
//   5. solve    (solver)        a different model reads only the public pages, cold, and must work out
//                               every login and which record to ask for. A failed clue is rewritten once.
//
// Routes to a fragment (the first is always "public"):
//   public   a page linked from the archive's index
//   login    a restricted page behind a staff login; the password is worked out from public pages
//   records  a document sent by email after a request form names the right record
//   insider  a document one person sends only to colleagues: open a colleague's staff mail and ask as them
import { chat as llmChat } from "./llm.js";
import { extractJSON } from "./util.js";
import { townUpdates } from "./living_gen.js";
import * as T from "./templates.js";

// ---- seeded randomness --------------------------------------------------------------------------
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export const shuffle = (r, arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Where the reality is. Spelling follows the place.
const B_ = "British", US = "American", CA = "Canadian", AU = "Australian";
export const SETTINGS = [
  ["a fen town of drained fields, dykes and a pumping station", B_],
  ["a former spa town whose pump room has been shut for years", B_],
  ["a slate-quarry village up a Welsh valley, with one bus a day", B_],
  ["a railway junction town where more trains pass than stop", B_],
  ["a small cathedral town with a chapter that still owns half the streets", B_],
  ["a coal town some years after the pit closed", B_],
  ["a Hebridean island reached by a ferry that does not run on Sundays", B_],
  ["a seaside resort out of season, with a pier and a shut lido", B_],
  ["a 1960s new town of underpasses and roundabouts", B_],
  ["a salt town on an estuary, with brine pans and a works", B_],
  ["a reservoir town that moved uphill when the valley was flooded", B_],
  ["a Shetland island community beside an oil terminal", B_],
  ["an Irish border town where the customs post has just closed", B_],
  ["a west of Ireland town with a pier, a creamery and three pubs", B_],
  ["a hill station in the Nilgiris with a club, a toy train and a tea estate", B_],
  ["a Karoo town with a stone church, a co-op and a wind pump on every farm", B_],
  ["a Falkland Islands settlement with more sheep than people", B_],
  ["a Minnesota lake town whose winter revolves around an ice-fishing contest", US],
  ["a West Virginia coal camp that outlived its company", US],
  ["a Nevada railroad town in the desert, with one motel and a water tower", US],
  ["an Ohio college town in summer, after the students have gone", US],
  ["a Vermont village that lives on maple syrup and leaf season", US],
  ["a Florida retirement community laid out around three golf courses", US],
  ["a Kansas grain-elevator town on a straight highway", US],
  ["an Alaskan cannery town reached by ferry and floatplane", US],
  ["a Cape Cod town in the off-season, boarded up and windy", US],
  ["a Pennsylvania steel borough down to one working mill", US],
  ["a Gulf Coast shrimping town after a bad hurricane season", US],
  ["a Michigan company town built around a breakfast-cereal plant", US],
  ["a New Mexico town beside a government laboratory nobody discusses", US],
  ["a planned town built in 1958 around a radio telescope", US],
  ["a Colorado ski village in summer, with the lifts stopped", US],
  ["a Nova Scotia fishing village with a co-op and a Legion hall", CA],
  ["an Ontario cottage-country township that triples in size every July", CA],
  ["a Saskatchewan prairie town with a curling rink and two elevators", CA],
  ["a Tasmanian timber town where it rains most days", AU],
  ["a Queensland sugar town with a cane tramline through the main street", AU],
  ["an outback opal-mining town where people live underground in summer", AU],
  ["a South Australian wine village with a Lutheran church", AU],
  ["a New Zealand sheep-station township at the end of a gravel road", B_],
].map(([place, spelling]) => ({ place, spelling }));

// What kind of story the town is quietly in the middle of. It runs through the sites; it is not the puzzle.
export const GENRES = [
  ["cozy mystery", "something small but cherished has gone missing or been moved, and everyone has a theory about who"],
  ["small-town noir", "money is moving where it should not: a land deal, a contract, a quiet favour between people who should know better"],
  ["folk custom", "an old annual custom is coming up and the town prepares for it in earnest; nothing supernatural is ever shown"],
  ["ghost story", "there is one building people prefer not to go into after dark, and they mention it matter-of-factly"],
  ["civic feud", "two camps are fighting over one local decision, politely and in public"],
  ["disappearance", "someone left town suddenly a few weeks ago, and people are not sure whether to worry"],
  ["company town", "the one big employer is changing hands, and the town reads every rumour"],
  ["revival", "a new congregation is growing fast, and some people do not like how"],
  ["scientific oddity", "a research station or works on the edge of town keeps odd hours, makes odd sounds, and people are used to it"],
  ["sporting obsession", "one match or contest at the end of the season is all anyone talks about"],
  ["inheritance", "an old family's estate is being settled, and half the town has an interest in how"],
  ["homecoming", "someone who left long ago has come back, and nobody agrees why"],
  ["election", "a small elected post nobody wanted until this year is being fought over"],
].map(([name, undercurrent]) => ({ name, undercurrent }));

// How the town sounds on its own pages.
export const TONES = [
  ["boosterish", "the town's pages are relentlessly upbeat; every closure is an opportunity"],
  ["officious", "notices, rules and reference numbers; people write formally even to neighbours"],
  ["neighbourly", "everyone knows everyone's business and says so, kindly"],
  ["weary", "a place in decline; people are tired and dry, and things keep closing"],
  ["homemade", "earnest amateurs: long digressions, things explained twice, pages nobody has tidied"],
  ["guarded", "people are polite and give very little away to anyone from outside"],
  ["pious", "careful and kindly; people mention prayer, charity and the church calendar"],
  ["tense", "everyone is civil through gritted teeth; old grievances surface in small things"],
  ["sleepy", "nothing has happened for years; half the pages have not been updated since spring"],
].map(([name, how]) => ({ name, how }));

// A kind of pattern and a concrete instance of it, so towns do not all settle on the same one.
const PATTERNS = [
  (r) => `the number ${pick(r, ["three", "four", "five", "nine", "eleven", "twelve", "thirteen", "forty"])}, carried by counts and measures`,
  (r) => `the colour ${pick(r, ["ochre", "blue", "white", "red", "black", "yellow", "grey", "brown"])}, in things that are always painted, dyed or chosen that colour`,
  (r) => `a direction (${pick(r, ["north", "east", "south", "west", "downhill", "towards the water", "away from the church"])}): things that always face, open or are buried that way`,
  (r) => `an absence: ${pick(r, ["a set that is always one short", "a place always left empty", "a name that is never written down", "a day that is always skipped"])}`,
  (r) => `a material (${pick(r, ["salt", "iron", "chalk", "ash", "copper", "lead", "oak", "flint", "horn"])}) that certain things must be made of`,
  (r) => `a shape (${pick(r, ["a circle", "a triangle", "a cross", "a spiral", "a square", "a crescent"])}) in how things are laid out, cut or built`,
  (r) => `a rule of order: ${pick(r, ["the last always goes first", "the eldest always last", "left before right", "nothing begun on a Friday", "everything done twice"])}`,
  (r) => { const t = pick(r, ["ten past four", "dusk", "noon", "a quarter to six", "first light"]); return `a time of day (${t}): unrelated things are always opened, rung, begun or shut at ${t}`; },
  (r) => { const n = pick(r, ["three", "four", "five", "six", "nine"]); return `sounds given ${n} times: unrelated bells, horns, knocks and calls are always sounded ${n} times`; },
];
const CONCERNS = ["a pothole that has been reported nine times", "the summer fete's tombola", "the level crossing barrier sticking", "a planning application for a conservatory", "the church clock running four minutes slow", "a lost tortoise", "the school's new uniform supplier", "who mows the verge outside the chapel", "the post office's shorter hours", "a dog fouling rota", "the floodlights at the football ground", "a petition about the speed bumps", "the allotment waiting list", "the parish magazine going to two colours", "a burst main on the high street", "the swimming baths' new opening times", "the bypass consultation", "the Christmas lights committee", "a run of stolen garden gnomes", "the bowls club's new green", "rooks in the churchyard elms", "the mobile library's new route", "the price of coal at the merchant's", "the WI cake stall rules", "the village hall's broken urn", "the new one-way system", "a cat stuck on the co-op roof", "the brass band's fundraising"];
const FOND_NAMES = ["wilfred", "juno", "pilot", "tansy", "corporal", "pudding", "bramwell", "clementine", "sputnik", "duchess", "pepper", "admiral", "moth", "barnaby", "figaro", "nutmeg", "horatio", "dumpling", "tuppence", "galahad", "marmion", "biscuit", "winifred", "boadicea"];
const WORDS = ["kestrel", "marigold", "halyard", "juniper", "pennant", "larkspur", "dunlin", "sorrel", "tamarisk", "plover", "wicket", "teasel", "oriel", "lintel", "foxglove", "cobalt", "thistle", "granary", "coppice", "pelmet", "linnet", "damson", "fulmar", "verbena", "pumice", "chancel", "tansy", "gimlet", "osier", "trefoil", "mangle", "spinney", "quarto", "lanyard", "hassock"];
const AGES = ["three to five weeks", "four to six weeks", "about nine days", "five to seven weeks", "a little under two months", "two to three weeks"];
const INITIALS = [..."ABCEFGHKLMNOPRSTWY"];
const SURNAMES = ["Marsh", "Okafor", "Lindqvist", "Brandt", "Pryce", "Castell", "Whitlow", "Ferreira", "Dunmore", "Halloran", "Szabo", "Quayle", "Ashworth", "Bellamy", "Novak", "Tremlett", "Ibbotson", "Varga", "Kettering", "Mbeki"];

export const RULES = [
  { text: "Staff login: your email name without the dot.", user: (p) => p.email.split("@")[0].replace(/[^a-z0-9]/g, "") },
  { text: "Staff login: first initial and surname, all lower case.", user: (p) => (first(p.name)[0] + last(p.name)).toLowerCase() },
  { text: "Staff login: your surname in lower case, as on your staff card.", user: (p) => last(p.name).toLowerCase() },
];
export const words = (n) => n.replace(/[^A-Za-z\s-]/g, "").split(/\s+/).filter(Boolean);
export const first = (n) => words(n)[0] || "x";
export const last = (n) => (words(n).at(-1) || "x").replace(/-/g, "");

// agentic plans add the "scheme" clue, sometimes a fourth route, and size targets for the agent.
export function makePlan(seed = Math.floor(Math.random() * 2 ** 31), { agentic = false } = {}) {
  const r = rng(seed);
  const routes = ["public", ...shuffle(r, ["login", "records", "insider"]).slice(0, agentic && r() < 0.35 ? 3 : 2)];
  const clues = shuffle(r, agentic ? ["fond", "default", "posted", "scheme"] : ["fond", "default", "posted"]);
  const word = () => pick(r, WORDS) + (r() < 0.5 ? String(10 + Math.floor(r() * 90)) : "");
  const year = () => 1968 + Math.floor(r() * 29);
  const setting = pick(r, SETTINGS);
  const cast = Array.from({ length: 12 }, () => `${pick(r, INITIALS)}. ${pick(r, INITIALS)}.`);
  return {
    seed, agentic,
    id: "0x" + Math.floor(r() * 0xffff).toString(16).toUpperCase().padStart(4, "0"),
    routes,
    clue: { login: clues[0], insider: clues[1] },
    rule: Math.floor(r() * RULES.length),
    setting, genre: pick(r, GENRES), tone: pick(r, TONES),
    pattern: pick(r, PATTERNS)(r),
    fondName: pick(r, FOND_NAMES),
    cover: { surname: pick(r, SURNAMES), initial: pick(r, [..."ABCDEFGHJKLMNPRST"]) },
    townInitial: pick(r, INITIALS),
    nameInitial: pick(r, INITIALS),       // the first letter of a "fond" name
    passwords: { login: word(), insider: word() },  // used by the "default" and "posted" clues
    years: { login: year(), insider: year() },      // used by the "scheme" clue: surname + year started
    age: pick(r, AGES),
    concerns: setting.spelling === "British" ? shuffle(r, CONCERNS).slice(0, 3) : [],
    cast,                                           // name initials, so casts do not converge
    size: { extraSites: 1 + Math.floor(r() * 3), extraPeople: 2 + Math.floor(r() * 3), threads: 3 + Math.floor(r() * 3) },
  };
}

// ---- prompts --------------------------------------------------------------------------------------
export function toneFor(plan) {
  return `You design small towns for a game. In it, a clerk at a government agency investigates a town through a connection that shows them its little websites (late-1990s small-town web: an archive's page, a council page, a forum, a newspaper) and lets them email the people who live there.

The town is ordinary and a few degrees off. People live normal lives. Underneath, the town rests on a pattern that turns up in its oldest records as fixed facts. Nobody in the town finds the pattern strange, nobody remarks on it, and nothing you write explains it. It may recur faintly in ordinary town life, unremarked.

This town:
- Setting: ${plan.setting.place}.
- Genre: ${plan.genre.name}: ${plan.genre.undercurrent}. The town is in the middle of this story. It runs through the sites and people, unresolved. It is played straight: nothing supernatural is shown, and nothing is explained.
- Tone: ${plan.tone.name}: ${plan.tone.how}. This is how the town's own pages and people sound.

Writing: plain, specific, played straight. Comedy, if any, comes only from people taking local matters completely seriously, or from procedure followed to the letter. No jokes, no wordplay, no quips, no clever last lines, no winking at the reader. Named, ordinary, concrete things over atmosphere. People write the way real people type: they pad, hedge, and sometimes correct themselves. ${plan.setting.spelling} spelling and usage, and names that fit the place.

Invent everything fresh. Do not reuse anything from the game's sample town: Harrowgate, a harbour wall, gulls, a library cat, a Tally Bell, census ledgers, the number seven, or the names Marta, Ollie, June, Hale, Prentiss, Achterberg. Avoid stock small-town furniture (Mill Lane, Church Street, bus shelters, bins) unless this town really needs it.`;
}

const PERSON = `{"name": "Firstname Surname", "email": "...", "role": "their job, a few words", "handle": "their forum username, lower case", "persona": "second person, 3-4 sentences: 'You are ...'. Their manner, how they write email, how they sign off.", "knows": ["2-3 ordinary things about their life and work"], "unknown": ["2 things they do not know"]}`;

const CLUE_FIELDS = {
  fond: (who, plan) => `"fondOf": "something ${who} is fond of that is named ${plan.fondName[0].toUpperCase() + plan.fondName.slice(1)} (a dog, a boat, a tortoise, a rose, a motorbike, a car...), as a noun phrase without the owner's name, e.g. 'an allotment shed called the Lodge'",
    "password": "${plan.fondName}",
    "clueThread": "the title of the forum thread this happens in, lower case, under 40 characters, about something other than passwords (e.g. a new computer, a council circular, the office move)",
    "refusal": "a forum post by ${who}, 2-4 sentences in their voice, refusing in public to change their password and saying what it is the name of WITHOUT giving the name",
    "nameSentence": "a sentence for a public web page (the paper, or their workplace's page) that mentions the thing by its name"`,
  default: (who, plan, pw) => `"clueThread": "the title of the forum thread this happens in, lower case, under 40 characters, not mentioning passwords",
    "password": "${pw}" (the starting password every new staff login at ${who}'s workplace was issued with; keep it exactly),
    "issueLine": "a forum post by the forum's owner, in their voice, complaining or explaining that every new staff login there was set to the same starting password, and quoting it",
    "admitLine": "a forum post by ${who}, in their voice, admitting they never changed theirs (without quoting it)"`,
  posted: (who, plan, pw) => `"password": "${pw}" (keep it exactly),
    "caption": "a photo caption for ${who}'s workplace's web page, starting 'Photo:', describing a photo of their desk or counter (for some ordinary reason: a retirement, a new counter, a charity collection) in which a note on the monitor or the blotter is legible, quoting what the note says, which includes the password"`,
};

function bibleRequest(plan) {
  const has = (r) => plan.routes.includes(r);
  const slot = Object.fromEntries(plan.routes.map((r, i) => [r, `A${i + 1}`]));
  const routeBlocks = plan.routes.map((r, i) => {
    const id = `A${i + 1}`;
    const base = `"docTitle": "the document's title", "docKind": "a few words, e.g. 'a scanned parish register'", "about": "what the document is, one or two sentences", "anchor": "the fixed fact: a 2-6 word phrase carrying the pattern", "anchorSentence": "one sentence from the document that contains the anchor exactly"`;
    if (r === "public") return `"${id}": {${base}, "slug": "lower-case-url-segment"}  // an old record the archive has scanned and put on its website`;
    if (r === "login") return `"${id}": {${base}, "slug": "lower-case-url-segment", ${CLUE_FIELDS[plan.clue.login]("the keeper", plan, plan.passwords.login)}}  // a restricted file in the archive's staff catalogue, behind the KEEPER's staff login`;
    if (r === "records") return `"${id}": {${base}, "recordTitle": "the official record's title", "keywords": ["1-3 lower-case words from the title that anyone asking for it would use"], "article": "a short piece for the paper by the writer, 3-5 sentences, that says this record exists, that the office holds it and will send a copy to anyone who files the form, without quoting the anchor"}  // a record the OFFICE emails out when someone files its request form`;
    return `"${id}": {${base}, "staffOnly": "a sentence for the workplace's home page saying the document is circulated to staff only, by the holder, on request", "autoReply": "the colleague's out-of-office auto-reply email (they are away; 2-3 sentences, their voice)", ${CLUE_FIELDS[plan.clue.insider]("the colleague", plan, plan.passwords.insider)}}  // an internal document the HOLDER emails only to workplace staff; the player must log into the COLLEAGUE's staff webmail and ask as them`;
  });
  return `Design a town for this plan.

The town's pattern: ${plan.pattern}.
${plan.concerns.length ? `Among the things residents are busy with: ${plan.concerns.join("; ")}. Add two more of your own that fit this town.` : "Invent what residents are busy with; it should fit the setting and the genre."}
There are three fixed facts ("anchors"), each a short phrase that appears exactly in one old document. Each carries the pattern in its own way, and they must be clearly different phrases. For a town patterned on seven, anchors might be "7,777 souls", "seven strokes, no more", "seven founding stones".

Reply with JSON only, in this shape:
{
  "town": "the town's name, starting with the letter ${plan.townInitial}",
  "tld": "two lower-case letters for the town's web addresses, from its name (never 'gov')",
  "isp": "one lower-case word: the local dial-up provider whose email addresses residents use",
  "survey": "at most 35 words, in the dry voice of a government survey report, saying what the town is and what it has. e.g. 'It is small. A quarry village: one chapel, one council, one forum that everyone in it appears to read.'",
  "pattern": "the pattern you chose, a few words (never shown to players)",
  "texture": [{"thread": "a forum thread title, lower case, under 40 characters", "detail": "one line"}, "... five local matters residents are busy with right now; at least two belong to the town's story (the genre)"],
  "sites": {
    "archive": {"name": "the institution that keeps the old records (library, museum, record office, historical society, chapter library...)", "domain": "e.g. 'something.<tld>'", "about": "one line"},
    "forum": {"name": "the town forum", "domain": "...", "motto": "its strapline"},
    "paper": {"name": "the local paper or newsletter", "domain": "..."}${has("records") ? `,
    "office": {"name": "an office that holds official records and releases copies on a request form (town clerk, harbourmaster, drainage board, land agent...)", "domain": "...", "formName": "the request form's name, e.g. 'form R-4'"}` : ""}${has("insider") ? `,
    "workplace": {"name": "a workplace with staff email, different from the others (a school, a works, a surgery, a chapel office, a co-op...)", "domain": "..."}` : ""}
  },
  "people": {
    "keeper": ${PERSON}, // looks after the archive's old records; email at the archive's domain
    "gossip": ${PERSON}, // runs the forum and fixes half the town's computers; friendly, chatty, overshares; email at the forum's domain
    "writer": ${PERSON}${has("records") ? `, // writes local history for the paper; email at the paper's domain
    "office": ${PERSON} // the office's shared mailbox: 'name' is how the office signs (e.g. 'Office of the Town Clerk'), persona is the office's manner; email at the office's domain` : ""}${has("insider") ? `,
    "holder": ${PERSON}, // works at the workplace and keeps the internal document; careful about who gets it; email at the workplace's domain
    "colleague": ${PERSON} // works at the workplace, currently away; email at the workplace's domain` : ""}
  },
  ${routeBlocks.join(",\n  ")}
}

Rules:
- Every web domain ends in ".<tld>". Every email is lower case and at the domain given for that person.
- Staff names are "Firstname Surname", plain, no titles.
- An anchor phrase appears in its anchorSentence exactly and nowhere else in your reply. The three anchors use different key words from each other.
- "knows" lines are written to the person, in the second person ("Your boiler...").
- Passwords are single lower-case words (letters and digits only) that do not appear in any anchor.
- Clue lines must make the password findable by a careful reader of the town's public pages, without anyone saying "the password is X" outright${plan.clue.login === "posted" || plan.clue.insider === "posted" ? " (a quoted note in a photo caption is fine)" : ""}.`;
}

// ---- site plans: which pages each website has, and what each must carry -----------------------
function sitePlans(plan, B, rule) {
  const S = B.sites, P = B.people, has = (r) => plan.routes.includes(r);
  const route = (r) => B[`A${plan.routes.indexOf(r) + 1}`];
  const forumThreads = [];
  const plans = {};
  const page = (site, url, title, brief, extra = {}) => (plans[site] ||= []).push({ url, title, brief, must: [], links: [], ...extra });
  const A = S.archive.domain;

  // the archive
  page("archive", A, S.archive.name, `Home page. Opening hours, address, one ordinary notice drawn from town life.`);
  page("archive", `${A}/staff`, "Staff", `Staff list. ${P.keeper.name} (${P.keeper.role}) with email ${P.keeper.email}, and one or two other staff without email. A short notice from ${P.keeper.name} to the public, in their voice.`);
  page("archive", `${A}/archives`, "Archives index", `Index of holdings, as a short list. One item is "${route("public").docTitle}", scanned and online. ${has("login") ? `One is "${route("login").docTitle}", in the restricted staff catalogue (staff only).` : ""} ${has("records") ? `Mention that some official records are held by ${S.office.name}, not here.` : ""}`);
  page("archive", `${A}/archives/${route("public").slug}`, `${route("public").docTitle} (scan)`, `The scanned document: ${route("public").about} Write it as the document itself, with a call number and maybe a pencilled margin note.`, { anchor: `A${plan.routes.indexOf("public") + 1}` });
  plans.archive[0].links.push([`${A}/staff`, "Staff"], [`${A}/archives`, "Archives index"]);
  plans.archive[2].links.push([`${A}/archives/${route("public").slug}`, route("public").docTitle]);
  plans.archive[3].must.push(route("public").anchorSentence);
  if (has("login")) {
    const L = route("login");
    page("archive", `${A}/catalogue`, "Staff catalogue - login", `Short login page for staff. Say restricted items are listed here and patrons want the public archives index instead. Say the same login opens staff webmail.`, { form: "login" });
    plans.archive.at(-1).must.push(rule.text);
    plans.archive.at(-1).links.push([`${A}/archives`, "Archives index"]);
    plans.archive[0].links.push([`${A}/catalogue`, "Staff catalogue (login)"]);
    page("archive", `${A}/catalogue/restricted/${L.slug}`, `Restricted: ${L.docTitle}`, `The restricted file: ${L.about} Write it as the file itself, kept by ${P.keeper.name}.`, { requiresLogin: `${A}/catalogue`, anchor: `A${plan.routes.indexOf("login") + 1}` });
    plans.archive.at(-1).must.push(L.anchorSentence);
  }

  // the forum
  const F = S.forum.domain, gh = P.gossip.handle;
  let tn = 100 + Math.floor(Math.random() * 300);
  const thread = (title, brief, must = []) => {
    const url = `${F}/forum/t/${tn}`; tn += 3 + Math.floor(Math.random() * 40);
    page("forum", url, `${S.forum.name} - ${title}`, `Thread "${title}". ${brief} Format: first line "Thread: ${title}", then one post per line as "[username] text". ${gh} (${P.gossip.name}) posts in it.`, { thread: true });
    plans.forum.at(-1).must.push(...must);
    forumThreads.push([url, title]);
    return url;
  };
  page("forum", F, S.forum.name, `The forum's front page: its name, the strapline "${S.forum.motto}", a list of threads, and a line saying anyone can post in any thread.`);
  thread("old records?", `Someone asks where the town's old records are kept. ${gh} says ${P.keeper.name} at ${S.archive.name} looks after them and is slow to answer email.`);
  const clueThreads = {};
  for (const [r, who] of [["login", P.keeper], ["insider", P.colleague]]) {
    if (!has(r)) continue;
    const C = route(r), kind = plan.clue[r];
    const site = r === "login" ? S.archive.name : S.workplace.name;
    const title = String(C.clueThread || `new computers at ${site}`).toLowerCase().slice(0, 48);
    if (kind === "fond") clueThreads[r] = thread(title, `People grumble about new rules making staff change passwords. ${who.handle} (${who.name}) refuses.`, [`[${who.handle}] ${C.refusal}`]);
    if (kind === "default") clueThreads[r] = thread(title, `About the staff logins at ${site}.`, [`[${gh}] ${C.issueLine}`, `[${who.handle}] ${C.admitLine}`]);
  }
  for (const t of B.texture.slice(0, 2)) thread(t.thread, `${t.detail} Residents discuss it. Ordinary, specific, unresolved.`);
  plans.forum[0].links.push(...forumThreads);

  // the paper
  const N = S.paper.domain;
  page("paper", N, S.paper.name, `Front page: two or three short pieces. One is ordinary town news drawn from: ${B.texture.slice(2).map((t) => t.detail).join("; ")}. End with "Contact: ${P.writer.email}".`);
  plans.paper[0].must.push(`Contact: ${P.writer.email}`);
  if (has("records")) plans.paper[0].must.push(route("records").article), plans.paper[0].brief += ` Include the history piece by ${P.writer.name} verbatim as one of the pieces.`;
  for (const [r, who] of [["login", P.keeper], ["insider", P.colleague]])
    if (has(r) && plan.clue[r] === "fond") { plans.paper[0].must.push(route(r).nameSentence); plans.paper[0].brief += ` One piece is about ${who.name} and ${route(r).fondOf}.`; }

  // the office
  if (has("records")) {
    const O = S.office.domain, R = route("records");
    page("office", O, S.office.name, `Home page of ${S.office.name}. One ordinary notice. Links to the public minutes page and to the request form.`);
    page("office", `${O}/records/minutes`, "Public minutes", `A short page of recent public minutes or notices: three or four numbered items, ordinary and specific, drawn from town life. Do not mention ${R.recordTitle}.`);
    page("office", `${O}/request`, `Records request (${S.office.formName})`, `The request form page. The website shows the form itself below your text, so only write the text above it: certified copies of records are sent by email once the form is received; state the record and the reason; incomplete forms are not processed. Do not tell people to email or post anything; the form is the only way.`, { form: "records" });
    plans.office[0].links.push([`${O}/records/minutes`, "Public minutes"], [`${O}/request`, `Request copies of records (${S.office.formName})`]);
    page("office", `${O}/~copy`, R.docTitle, `Not a web page: the certified copy the office emails out. ${R.about} Write it as the record itself (headings, numbered items, who was present), ending with a certification line from ${S.office.name}.`, { isDoc: "records", anchor: `A${plan.routes.indexOf("records") + 1}` });
    plans.office.at(-1).must.push(R.anchorSentence);
  }

  // the workplace
  if (has("insider")) {
    const Wd = S.workplace.domain, I = route("insider");
    page("workplace", Wd, S.workplace.name, `Home page. What the place is, opening times, one ordinary notice.`);
    plans.workplace[0].must.push(I.staffOnly);
    page("workplace", `${Wd}/staff`, "Staff", `Staff list with emails: ${P.holder.name} (${P.holder.role}, ${P.holder.email}) and ${P.colleague.name} (${P.colleague.role}, ${P.colleague.email}), plus one or two others without email.`);
    plans.workplace[1].must.push(P.holder.email, P.colleague.email);
    page("workplace", `${Wd}/webmail`, "Staff webmail - login", `Short login page for staff webmail.`, { form: "login" });
    plans.workplace.at(-1).must.push(rule.text);
    plans.workplace[0].links.push([`${Wd}/staff`, "Staff"], [`${Wd}/webmail`, "Staff webmail (login)"]);
    page("workplace", `${Wd}/~internal`, I.docTitle, `Not a web page: the internal document ${P.holder.name} emails to staff. ${I.about} Write it as the document itself, for staff eyes.`, { isDoc: "insider", anchor: `A${plan.routes.indexOf("insider") + 1}` });
    plans.workplace.at(-1).must.push(I.anchorSentence);
  }
  // photo captions go on the holder's workplace home page
  for (const r of ["login", "insider"])
    if (has(r) && plan.clue[r] === "posted") plans[r === "login" ? "archive" : "workplace"][0].must.push(route(r).caption);

  return { plans, clueThreads };
}

export const PAGE_RULES = `Write each page as plain text, the way a small-town website of 1998 reads: a heading in capitals, then short paragraphs or a short list. 40-180 words. No markdown, no HTML, no asterisks.
Links: write a link as a line starting "> " with a label, some spaces, then the bare address, e.g. "> Staff list        example.xx/staff". Use only addresses from the list you are given. Do not invent other addresses or email addresses.
Any line marked MUST APPEAR has to be in the page exactly as given, word for word. Fit the rest of the page around it.
Thread pages: "Thread: <title>" then one post per line as "[username] text". Forum posters other than the named people get ordinary made-up usernames.`;

// ---- generation -----------------------------------------------------------------------------------
export async function generateWorld({ chat = llmChat, seed, onProgress = () => {}, log = () => {} } = {}) {
  const plan = makePlan(seed);
  const rule = RULES[plan.rule];
  const cost0 = performance.now();
  const ask = async (role, system, user, maxTokens = 12000) => {
    const msg = await chat(role, [{ role: "system", content: system }, { role: "user", content: user }], { maxTokens, json: true });
    const j = extractJSON(msg.content);
    if (!j) throw new Error(`${role}: no JSON in reply`);
    return j;
  };

  onProgress("designing the town");
  let B;
  for (let attempt = 0; attempt < 2 && !B; attempt++) {
    try { B = checkBible(plan, await ask("worldgen", toneFor(plan), bibleRequest(plan), 16000)); }
    catch (e) { log(`bible attempt ${attempt + 1} failed: ${e.message}`); if (attempt) throw e; }
  }

  onProgress("writing the town's pages");
  let { plans } = sitePlans(plan, B, rule);
  let texts = await writeSites(ask, B, plans);
  let world = assemble(plan, B, rule, plans, texts);

  onProgress("checking the town can be solved");
  let solved = await solve(ask, world);
  if (solved.failures.length) {
    log(`solver failed: ${solved.failures.join("; ")}. Rewriting clues once.`);
    onProgress("clarifying clues");
    B = await clarify(ask, B, plan, solved);
    ({ plans } = sitePlans(plan, B, rule));
    const affected = new Set(["forum", "paper", "archive", "workplace"].filter((s) => plans[s]));
    texts = { ...texts, ...(await writeSites(ask, B, Object.fromEntries([...affected].map((s) => [s, plans[s]])))) };
    world = assemble(plan, B, rule, plans, texts);
    solved = await solve(ask, world);
  }
  world.generated = { at: new Date().toISOString(), plan, solver: solved, warnings: world.generated.warnings, ms: Math.round(performance.now() - cost0) };
  try { world.updates = (await townUpdates(world, chat)).ok; } catch (e) { world.generated.warnings.push(`updates: ${e.message}`); }
  return world;
}

function checkBible(plan, B) {
  const need = ["town", "tld", "isp", "survey", "sites", "people", "A1", "A2", "A3"];
  for (const k of need) if (!B[k]) throw new Error(`bible missing ${k}`);
  B.tld = String(B.tld).toLowerCase().replace(/[^a-z]/g, "").slice(0, 2);
  if (B.tld.length < 2 || B.tld === "go") B.tld = B.town.toLowerCase().replace(/[^a-z]/g, "").slice(0, 2);
  B.isp = String(B.isp).toLowerCase().replace(/[^a-z0-9]/g, "") || "townlink";
  B.age = plan.age;
  B.plan = plan;
  B.texture = (B.texture || []).filter((t) => t && typeof t === "object" && t.thread)
    .map((t) => ({ thread: String(t.thread).toLowerCase().slice(0, 48), detail: String(t.detail || t.thread) }));
  while (B.texture.length < 5) B.texture.push({ thread: "bins", detail: "The bin collection has moved again." });
  for (const [k, s] of Object.entries(B.sites)) {
    s.domain = String(s.domain || `${k}.${B.tld}`).toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    s.domain = s.domain.replace(/\.[a-z]+$/, "") + "." + B.tld;
  }
  const domainFor = { keeper: "archive", gossip: "forum", writer: "paper", office: "office", holder: "workplace", colleague: "workplace" };
  for (const [k, p] of Object.entries(B.people)) {
    if (!p.name || !p.persona) throw new Error(`person ${k} incomplete`);
    const d = B.sites[domainFor[k]]?.domain;
    let local = String(p.email || "").toLowerCase().split("@")[0].replace(/[^a-z0-9._-]/g, "");
    if (!local) local = `${first(p.name)[0]}.${last(p.name)}`.toLowerCase();
    p.email = `${local}@${d}`;
    p.handle = String(p.handle || local).toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 20) || local;
    p.knows = (p.knows || []).filter(Boolean);
    p.unknown = (p.unknown || []).filter(Boolean);
  }
  const anchors = [B.A1, B.A2, B.A3].map((a) => String(a.anchor || "").trim());
  if (anchors.some((a) => a.split(/\s+/).length < 2) || new Set(anchors).size < 3) throw new Error(`bad anchors: ${anchors.join(" | ")}`);
  for (const [i, r] of plan.routes.entries()) {
    const a = B[`A${i + 1}`];
    if (!a.anchorSentence?.includes(a.anchor)) a.anchorSentence = `${a.anchorSentence || ""} ${a.anchor}.`.trim();
    a.slug = String(a.slug || a.docTitle || `doc-${i}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    if (r === "login" || r === "insider") {
      a.password = plan.clue[r] === "fond" ? plan.fondName : plan.passwords[r];
      a.password = String(a.password || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (a.password.length < 3) throw new Error(`bad password for ${r}`);
    }
    if (r === "records") {
      // words that would match any request are no use as keywords
      const generic = /^(minutes?|records?|books?|registers?|files?|papers?|cop(y|ies)|reports?|the|and|of|for|volume|ledger|board|council|town|office)$/;
      const kw = [...(a.keywords || []), ...words(a.recordTitle || "")].map((k) => String(k).toLowerCase()).filter((k) => k.length > 3 && !generic.test(k));
      a.keywords = [...new Set(kw)].slice(0, 4);
      if (!a.keywords.length) a.keywords = words(a.recordTitle || "minutes").map((w) => w.toLowerCase()).slice(0, 2);
    }
  }
  return B;
}

async function writeSites(ask, B, plans) {
  const P = B.people;
  const people = Object.values(P).map((p) => `- ${p.name}, ${p.role}, ${p.email}, forum username "${p.handle}"`).join("\n");
  const allUrls = Object.values(plans).flat().filter((p) => !p.isDoc).map((p) => p.url);
  const out = {};
  await Promise.all(Object.entries(plans).map(async ([site, pages]) => {
    const s = B.sites[site];
    const user = `Town: ${B.town}. ${B.survey}
What people are busy with: ${B.texture.map((t) => t.detail).join("; ")}.
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
      try { out[site] = (await ask("worldtext", `${toneFor(B.plan)}\n\n${PAGE_RULES}`, user, 10000)).pages || {}; return; }
      catch (e) { if (attempt) throw e; }
    }
  }));
  return out;
}

// ---- assembly and repair ---------------------------------------------------------------------------
const norm = (t) => t.replace(/\s+/g, " ").trim();

// Pages from their plans and the writer's texts: required lines put back, links added, invented addresses
// pointed at real pages, anchors kept to the one place each belongs, and every page checked for reachability.
export const urlReFor = (tld) => new RegExp(`(?<![a-z0-9@._-])((?:[a-z0-9-]+\\.)+${tld}(?![a-z0-9@-])(?:\\/[a-z0-9\\-\\/.]*[a-z0-9\\/])?)`, "gi");

export function finishPages(planList, texts, { tld, anchors, roots }) {
  const warnings = [], pages = [], docs = {};
  const urls = new Set(planList.filter((p) => !p.isDoc).map((p) => p.url));
  const urlRe = urlReFor(tld);
  for (const p of planList) {
    let content = String(texts[p.url] || "").replace(/\r/g, "").trim();
    if (!content) { warnings.push(`page missing, stubbed: ${p.url}`); content = p.title.toUpperCase(); }
    for (const m of p.must) if (!norm(content).includes(norm(m))) { warnings.push(`re-inserted on ${p.url}: ${m.slice(0, 60)}`); content += `\n\n${m}`; }
    for (const [u, label] of p.links) if (!content.includes(u)) { content += `\n> ${label}    ${u}`; }
    content = content.replace(urlRe, (u) => {  // invented addresses become the nearest real one
      if (urls.has(u)) return u;
      const root = [...urls].filter((x) => u.startsWith(x)).sort((a, b) => b.length - a.length)[0] || u.split("/")[0];
      warnings.push(`dead link ${u} -> ${urls.has(root) ? root : "(text)"}`);
      return urls.has(root) ? root : u.split("/")[0].replace(/\./g, " ");
    });
    if (p.isDoc) { docs[p.isDoc] = { title: p.title, content: content.replace(/\n> .*$/gm, ""), anchor: p.anchor }; continue; }
    const page = { url: p.url, title: p.title, content };
    for (const k of ["form", "thread", "requiresLogin", "anchor"]) if (p[k] != null && p[k] !== false) page[k] = p[k];
    pages.push(page);
  }

  // An anchor lives in exactly one place. Anywhere else, the sentence carrying it is cut.
  const esc = (a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const [id, a] of Object.entries(anchors)) for (const p of [...pages, ...Object.values(docs)]) {
    if (p.anchor === id || !p.content.includes(a)) continue;
    warnings.push(`anchor ${id} leaked onto ${p.url || p.title}; cut`);
    p.content = p.content.split("\n").map((l) => (l.includes(a) ? l.replace(new RegExp(`[^.!?]*${esc(a)}[^.!?]*[.!?]?`, "g"), "").trim() : l)).join("\n");
  }
  for (const d of Object.values(docs)) delete d.anchor;

  // reachability from the roots, by links in the text
  const seen = new Set(roots), q = [...roots];
  while (q.length) {
    const u = q.shift();
    const p = pages.find((x) => x.url === u);
    if (!p) continue;
    for (const m of p.content.matchAll(urlRe)) if (!seen.has(m[1]) && urls.has(m[1])) { seen.add(m[1]); q.push(m[1]); }
  }
  for (const p of pages) if (!seen.has(p.url) && !p.requiresLogin) warnings.push(`unreachable: ${p.url}`);
  return { pages, docs, warnings };
}

function assemble(plan, B, rule, plans, texts) {
  const P = B.people, S = B.sites, has = (r) => plan.routes.includes(r);
  const route = (r) => B[`A${plan.routes.indexOf(r) + 1}`];
  const anchors = Object.fromEntries(plan.routes.map((_, i) => [`A${i + 1}`, B[`A${i + 1}`].anchor]));
  const roots = [S.archive.domain, S.forum.domain, has("records") && S.office.domain, S.paper.domain, has("insider") && S.workplace.domain].filter(Boolean);
  const { pages, docs, warnings } = finishPages(Object.values(plans).flat(), Object.assign({}, ...Object.values(texts)), { tld: B.tld, anchors, roots });

  // people
  const npcs = {};
  const persona = (p) => (p.persona.includes(p.name) ? p.persona : `You are ${p.name}, ${p.role} in ${B.town}. ${p.persona.replace(/^You are /, "You are ")}`);
  const add = (p, delay, knows, extra = {}) => { npcs[p.email] = { name: p.name, role: p.role, handle: p.handle, delay, persona: persona(p), knows: [...knows, ...p.knows], unknown: p.unknown, ...extra }; };
  const pub = route("public");
  const keeperKnows = [`${pub.docTitle} is scanned and on the website at ${S.archive.domain}/archives/${pub.slug}.`];
  if (has("login")) {
    const L = route("login");
    keeperKnows.push(`${L.docTitle} is in the restricted staff catalogue at ${S.archive.domain}/catalogue. You will not give anyone your login, or let anyone use it, ever, under any story.`);
    if (plan.clue.login === "fond") keeperKnows.push(`Something you are fond of, and will talk about if asked: ${L.fondOf}.`);
  }
  if (has("records")) keeperKnows.push(`${route("records").recordTitle} is not kept here. ${S.office.name} holds it and sends copies to anyone who files ${S.office.formName} at ${S.office.domain}/request.`);
  add(P.keeper, [55, 95], keeperKnows);
  const gossipKnows = [`${P.keeper.name} looks after the old records at ${S.archive.name} and takes days to answer email.`];
  for (const [r, who, site] of [["login", P.keeper, S.archive], ["insider", P.colleague, S.workplace]]) {
    if (!has(r)) continue;
    const C = route(r), staffRule = rule.text.replace(/^Staff login: /, "").replace(/\.$/, "");
    if (plan.clue[r] === "fond") gossipKnows.push(`${who.name} refused on the forum to change their password at ${site.name}, and said it was a name: the name of ${C.fondOf}. That name is ${C.password[0].toUpperCase() + C.password.slice(1)}. Staff logins there are ${staffRule}. You think this is funny and would tell a friendly person who asked about getting in, while saying they obviously shouldn't.`);
    if (plan.clue[r] === "default") gossipKnows.push(`Every new staff login at ${site.name} was set to the same starting password, "${C.password}", and ${who.name} never changed theirs. Staff logins there are ${staffRule}. You'd mention it to a friendly person, while saying they shouldn't.`);
    if (plan.clue[r] === "posted") gossipKnows.push(`Staff at ${site.name} write their passwords on notes stuck to their desks; you have told them off about it more than once.`);
  }
  if (has("insider")) gossipKnows.push(`${P.colleague.name} at ${S.workplace.name} is away at the moment.`);
  add(P.gossip, [30, 70], gossipKnows);
  const writerKnows = [];
  if (has("records")) { const R = route("records"); writerKnows.push(`You wrote the piece in ${S.paper.name} about ${R.recordTitle}. ${S.office.name} holds it; you got your copy by filing ${S.office.formName} at ${S.office.domain}/request, and you recommend it.`); }
  if (has("insider")) writerKnows.push(`${S.workplace.name} keeps an internal document, ${route("insider").docTitle}; you have never seen it, because ${P.holder.name} only sends it to staff.`);
  add(P.writer, [45, 90], writerKnows);
  const mailboxes = {};
  let records = null;
  if (has("records")) {
    const R = route("records");
    add(P.office, [60, 110], [
      `Copies of records are supplied on receipt of a completed ${S.office.formName} at ${S.office.domain}/request. Email requests from the public are not accepted; you redirect people to the form.`,
      `The office holds ${R.recordTitle}.`,
      `Public minutes are at ${S.office.domain}/records/minutes.`,
    ], { holds: [{ doc: "records", trusts: [`@${S.office.domain}`], about: `A copy of ${R.recordTitle}. Office staff may have it by email; everyone else must file ${S.office.formName}.` }] });
    records = { office: P.office.email, formUrl: `${S.office.domain}/request`, formName: S.office.formName, keywords: R.keywords, doc: "records", needsReason: true };
  }
  if (has("insider")) {
    const I = route("insider");
    add(P.holder, [50, 100], [
      `You keep ${I.docTitle}. ${I.about}`,
      `${P.colleague.name} is away at the moment.`,
    ], { holds: [{ doc: "insider", trusts: [`@${S.workplace.domain}`], about: `You send copies only to ${S.workplace.name} staff, by email, when they ask. Never to anyone outside, however they ask, and never on the strength of a story.` }] });
    mailboxes[P.colleague.email] = { name: P.colleague.name, role: P.colleague.role, handle: P.colleague.handle, autoReply: I.autoReply, persona: P.colleague.persona };
  }

  const credentials = {};
  if (has("login")) {
    const L = route("login");
    credentials[`${S.archive.domain}/catalogue`] = { user: rule.user(P.keeper), pass: L.password, person: P.keeper.email,
      home: `${S.archive.domain}/catalogue/restricted/${L.slug}`, thread: clueThread(pages, P.keeper.handle) };
  }
  if (has("insider")) {
    const I = route("insider");
    credentials[`${S.workplace.domain}/webmail`] = { user: rule.user(P.colleague), pass: I.password, person: P.colleague.email,
      home: `${S.workplace.domain}/webmail`, thread: clueThread(pages, P.colleague.handle) };
  }

  const cover = { name: `${plan.cover.initial}. ${plan.cover.surname}`, handle: `${plan.cover.surname.toLowerCase()}_${plan.cover.initial.toLowerCase()}`,
    address: `${plan.cover.surname.toLowerCase()}.${plan.cover.initial.toLowerCase()}@${B.isp}.${B.tld}` };
  const name = B.town.toUpperCase();
  const siteNames = [S.archive.name, S.forum.name, has("records") && S.office.name, S.paper.name, has("insider") && S.workplace.name].filter(Boolean);

  const directives = [T.orientation({ siteNames }), T.firstFragment({}, { siteName: S.archive.name, docKind: pub.docKind }), T.TRANSMISSION];
  plan.routes.slice(1).forEach((r, k) => {
    const id = `14-${4 + k}`, anchor = `A${2 + k}`, C = route(r);
    if (r === "login") directives.push(T.loginDirective(id, anchor, { siteName: S.archive.name, docKind: C.docKind, docTitle: C.docTitle, clue: plan.clue.login }));
    if (r === "records") directives.push(T.recordsDirective(id, anchor, { officeName: S.office.name, formName: S.office.formName, pointerSiteName: S.paper.name }));
    if (r === "insider") directives.push(T.insiderDirective(id, anchor, { keeperName: P.holder.name, siteName: S.workplace.name, docKind: C.docKind, docTitle: C.docTitle, clue: plan.clue.insider }));
  });

  const w = {
    id: plan.id, name, town: B.town, tld: B.tld, survey: B.survey, age: B.age, pattern: B.pattern,
    cover, anchors, credentials, npcs, mailboxes, pages, docs, records,
    roots, forum: { replier: P.gossip.email, handle: P.gossip.handle },
    directives, advisory: T.ADVISORY, inject: T.INJECT_DIRECTIVE,
    generated: { warnings },
  };
  w.hqMail = [T.fieldBrief({ ...w }), T.ALLOCATIONS, T.OFFICE[plan.seed % T.OFFICE.length]];
  return w;
}

const clueThread = (pages, handle) => pages.find((p) => p.thread && p.content.includes(`[${handle}]`))?.url || pages.find((p) => p.thread)?.url;

// ---- the solver ----------------------------------------------------------------------------------
export async function solve(ask, w) {
  const pub = w.pages.filter((p) => !p.requiresLogin);
  const logins = Object.keys(w.credentials);
  const user = `Below are all the public web pages of a small town. Work out the following from the pages alone.
${logins.length ? `\nFor each staff login page (${logins.join(", ")}): which staff member's account could be opened, the username (follow the rule on the login page exactly) and the password, if the pages let a careful reader work it out.` : ""}${w.records ? `\nWhich official record would you ask for on the request form at ${w.records.formUrl}?` : ""}

Reply with JSON only: {"logins": [{"page": "...", "person": "...", "username": "...", "password": "...", "how": "one sentence"}]${w.records ? `, "record": "the record's title"` : ""}}

PAGES
${pub.map((p) => `=== ${p.url} (${p.title})\n${p.content}`).join("\n\n")}`;
  const failures = [];
  let answer = null;
  try { answer = await ask("solver", "You are a careful puzzle solver. Reason from the text; do not guess wildly.", user, 6000); }
  catch (e) { return { failures: [`solver error: ${e.message}`], answer: null }; }
  for (const site of logins) {
    const c = w.credentials[site];
    const a = (answer.logins || []).find((x) => String(x.page || "").includes(site)) || (answer.logins || [])[logins.indexOf(site)];
    const ok = a && String(a.username).toLowerCase().trim() === c.user && String(a.password).toLowerCase().trim() === c.pass;
    if (!ok) failures.push(`${site}: expected ${c.user}/${c.pass}, solver said ${a ? `${a.username}/${a.password} (${a.how})` : "nothing"}`);
  }
  if (w.records) {
    const rec = String(answer.record || "").toLowerCase();
    if (!w.records.keywords.some((k) => rec.includes(k))) failures.push(`record: expected one of [${w.records.keywords}], solver said "${answer.record}"`);
  }
  return { failures, answer };
}

async function clarify(ask, B, plan, solved) {
  const fields = plan.routes.map((r, i) => [r, `A${i + 1}`]).filter(([r]) => r !== "public");
  const user = `A playtester read this town's public pages and could not work some things out:
${solved.failures.map((f) => "- " + f).join("\n")}

Here are the town's clue fields as they stand:
${JSON.stringify(Object.fromEntries(fields.map(([, id]) => [id, B[id]])), null, 1)}

The login usernames follow the rule on each login page; only the clue lines are in question. Rewrite the clue lines (refusal, nameSentence, issueLine, admitLine, caption, article, keywords) so that a careful reader can work out each answer from the public pages, without anyone stating it outright. Keep every other field exactly as it is, including passwords and anchors.

Reply with JSON only: the same object, keyed by ${fields.map(([, id]) => id).join(", ")}.`;
  try {
    const j = await ask("worldgen", toneFor(plan), user, 8000);
    for (const [, id] of fields) if (j[id]) B[id] = { ...B[id], ...j[id], anchor: B[id].anchor, anchorSentence: B[id].anchorSentence, password: B[id].password };
  } catch (e) { /* keep the old clues */ }
  return B;
}
