// Harrowgate in the v2 schema (game/DESIGN-v2.md, PLAN-v2 phase 1). The town itself (pages, people) is the
// v1 hand-built one; the v2 fields are added here.
//
// PHASE 7 TODO (content): the canon references up to the divergence year, with paired sources and near-misses;
// the ~40-email timetable; more injected pages; the edge road written into the town. The values below are
// placeholders that satisfy checkWorld() so the engine can be built and tested.
import { HARROWGATE as V1 } from "./world.js";
import { fieldBriefV2, DESK_NOTICE, OFFICE } from "./templates.js";

const AGENT = { address: "reyes.a@harrowmail.hg", name: "A. Reyes", role: "a resident of Harrowgate", handle: "reyes_a" };

// The agent's injected past: pages that mention them. Nobody in town remembers them.
const INJECTED = [
  {
    url: "quietnet.hg/forum/t/88", title: "Quietnet: Anchor quiz results",
    content: `QUIETNET > Town > Anchor quiz results

[ollie] Results from Thursday at the Anchor, for those who left early:
1. The Steeple Street Irregulars, 41
2. Low Tide (A. Reyes and whoever they dragged along), 38
3. Harbour Wall Appreciation Society, 33
[ollie] tiebreak was the year the Tally Bell was recast. nobody got it
[june.a] It was 1903. I would have got it if I had been there.`,
  },
];

export const HARROWGATE = {
  id: "0x3F7A", name: "HARROWGATE", town: "Harrowgate", tld: "hg", hand: true, schema: 2,
  agent: { ...AGENT, injected: INJECTED.map((p) => p.url) },
  password: ["steeple", "shelf"],
  divergence: { year: 1958, refs: [], nearMisses: [] },          // TODO phase 7
  apotheosis: 3,
  inferiority: { class: 2, edge: { road: "the coast road north, past the gravel works", distanceMiles: 6, whatTheyFind: "TODO phase 7" } },
  pages: [...V1.pages, ...INJECTED],
  npcs: V1.npcs,
  mailboxes: V1.mailboxes,
  credentials: V1.credentials,
  docs: V1.docs,
  records: V1.records,
  roots: V1.roots,
  forum: V1.forum,
  hqMail: null, // filled below
  // The town's own mail, in minutes from the start of the run. TODO phase 7: about 40 of these.
  traffic: [
    { at: 2, from: "june@harrowgate-gazette.hg", to: "m.hale@harrowgate-library.hg", subject: "Ledger feature, photos",
      body: "Marta, could I come by Thursday to photograph Ledger for the follow-up piece? Readers keep asking after him. June" },
    { at: 5, from: "m.hale@harrowgate-library.hg", to: "june@harrowgate-gazette.hg", subject: "Re: Ledger feature, photos",
      body: "Thursday is an Annex day. Come after four. He will not pose. - M. Hale, Archives" },
    { at: 9, from: "ollie@quietnet.hg", to: "records@cityhall.hg", subject: "council minutes on the forum?",
      body: "hi, any chance i could mirror the 1986 minutes on quietnet? people keep asking me where they are. ollie" },
  ],
};

HARROWGATE.survey = "It is small: a harbour town with one library, one council and one forum that most residents appear to read.";
HARROWGATE.age = "four to six weeks";
HARROWGATE.hqMail = [fieldBriefV2(HARROWGATE), DESK_NOTICE, OFFICE[0]];
