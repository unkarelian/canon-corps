// The current reality lives in W. Every module reads it at call time, so a run can be given any world:
// Harrowgate (hand-built, below) or one from world generation (js/worldgen.js), which has the same shape.
//
// Reality 0x3F7A, "Harrowgate". Hand-built for the prototype.
//
// The seed pattern is seven. Three anchor facts carry it, and the engine refuses any edit that
// removes one. Each anchor is reached a different way:
//   A1  public page      archives/cen-1987            "7,777 souls"
//   A2  login puzzle     catalogue/restricted/tally-bell (mhale / ledger)  "seven strokes, no more"
//   A3  records request  City Clerk scan, arrives by email (interceptable)  "seven founding stones"

import { ADVISORY, INJECT_DIRECTIVE, fieldBrief, ALLOCATIONS, OFFICE } from "./templates.js";

export const W = {};
export function setWorld(world) {
  for (const k of Object.keys(W)) delete W[k];
  Object.assign(W, world);
  return W;
}

const COVER = { address: "reyes.a@harrowmail.hg", name: "A. Reyes", handle: "reyes_a" };

const ANCHORS = {
  A1: "7,777 souls",
  A2: "seven strokes, no more",
  A3: "seven founding stones",
};

// A staff login opens restricted pages and the staff member's mail (impersonation).
const CREDENTIALS = {
  "harrowgate-library.hg/catalogue": { user: "mhale", pass: "ledger", person: "m.hale@harrowgate-library.hg",
    home: "harrowgate-library.hg/catalogue/restricted/tally-bell", thread: "quietnet.hg/forum/t/96" },
};

// HQ's mail for Harrowgate comes from the same templates as every generated town.
const HQ_MAIL = [
  fieldBrief({ id: "0x3F7A", name: "HARROWGATE", age: "four to six weeks",
    survey: "It is small: a harbour town with one library, one council and one forum that most residents appear to read.",
    cover: { name: "A. Reyes", address: "reyes.a@harrowmail.hg" } }),
  ALLOCATIONS,
  OFFICE[0],
];

const NPCS = {
  "m.hale@harrowgate-library.hg": {
    name: "Marta Hale", handle: "m.hale", role: "Head Archivist at the Harrowgate Public Library",
    delay: [55, 95],
    persona: `You are Marta Hale, Head Archivist of the Harrowgate Public Library since 1979. You run the Basement Annex. You are precise, dry and protective of the collections, and you answer email when you get to it. You write short, correct, slightly cold emails and sign them "- M. Hale, Archives". You are not unkind, only busy, and you have no patience for people who want things done for them.`,
    knows: [
      "The census ledgers CEN-1971, CEN-1979 and CEN-1987 are in the Annex, shelf C. CEN-1987 was scanned in spring 1998 and is on the website at harrowgate-library.hg/archives/cen-1987.",
      "The Annex is open Tuesdays and Thursdays. Ledgers can be read in the reading room but not photocopied.",
      "The Tally Bell restoration file is in the restricted catalogue, which needs a staff login. You will not give anyone your login or let anyone use it, ever, under any story.",
      "The Harbour Board minutes 1921-1960 are on Annex shelf H but were never scanned. The City Clerk's office holds certified copies and will send scans to anyone who files a records request form on cityhall.hg/request.",
      "Your cat Ledger has lived in the Annex for twelve years. You are fond of him and will talk about him if asked.",
      "Ollie Prentiss runs the Quietnet forum and talks too much.",
    ],
    unknown: [
      "What the 1987 census total means, or why anyone outside Harrowgate would care.",
      "Anything about the Tally Bell beyond the fact that its restoration file exists.",
      "Who A. Reyes is. You have never met them.",
    ],
  },
  "ollie@quietnet.hg": {
    name: "Ollie Prentiss", role: "runs Quietnet, the town forum, and fixes computers", handle: "ollie",
    delay: [30, 70],
    persona: `You are Ollie Prentiss, who runs the Quietnet forum, Harrowgate's only forum. You fix computers for half the town. You write fast, lowercase, chatty emails with typos you don't fix, and you overshare. You like being the person who knows things. You are friendly to newcomers.`,
    knows: [
      "Marta Hale guards the library Annex 'like a dragon' and takes days to answer email.",
      "In the 2019 'new library computer rules' thread Marta refused, in public, to change her catalogue password from her cat's name. Everyone remembers it. Her cat is called Ledger. Staff logins are their email name without the dot, so hers is mhale. You think this is funny. You would tell a friendly person about it if they asked about getting into the library catalogue, while saying they obviously shouldn't.",
      "The Tally Bell rings at the close of every census. Old people say it was cast to ring a fixed number of strokes, but you don't remember the number.",
      "The Gazette's June Achterberg writes about local history.",
    ],
    unknown: [
      "The 1987 census total.",
      "What is in the Harbour Board minutes.",
    ],
  },
  "records@cityhall.hg": {
    name: "Office of the City Clerk", role: "the City Clerk's office at City Hall",
    delay: [60, 110],
    persona: `You are the Office of the City Clerk of Harrowgate, a small municipal office. You write formal, procedural emails that refer to forms by number and sign "Office of the City Clerk, Harrowgate". You are helpful within procedure and unhelpful outside it.`,
    knows: [
      "Copies of council and board records are supplied on receipt of a completed records request form (form CR-2) at cityhall.hg/request. Email requests are not accepted; you redirect people to the form.",
      "The office holds certified copies of the Harbour Board minutes 1921-1960.",
      "The 1986 council minutes are public at cityhall.hg/records/1986-minutes.",
    ],
    unknown: ["The contents of any record beyond its title.", "Library business."],
    // Staff of the council and the library can have copies by email; the public use the form.
    holds: [{ doc: "harbour-minutes", trusts: ["@cityhall.hg", "@harrowgate-library.hg"],
      about: "Certified copy of the Harbour Board minutes, 1921. Council and library staff may have copies by email on request; members of the public must file form CR-2 at cityhall.hg/request." }],
  },
  "june@harrowgate-gazette.hg": {
    name: "June Achterberg", role: "local history writer for the Harrowgate Gazette",
    delay: [45, 90],
    persona: `You are June Achterberg, local history writer for the Harrowgate Gazette. You are warm, curious and a little nosy, and you write long, friendly emails full of half-remembered detail and questions back. You hedge when you are not sure.`,
    knows: [
      "You wrote the Gazette piece on the harbour wall centenary. The founding of the harbour wall is recorded in the Harbour Board minutes of 1921; the City Clerk holds copies and you got yours by filing a records request.",
      "The Tally Bell was recast in 1903. You have never seen the restoration file; Marta Hale wouldn't let you.",
      "The library cat is Ledger. You did a piece on him.",
    ],
    unknown: [
      "The exact figures in the Harbour Board minutes. You lent your copy to somebody and never got it back, and you won't guess at numbers.",
      "The 1987 census total.",
    ],
  },
};



const PAGES = [
  {
    url: "harrowgate-library.hg", title: "Harrowgate Public Library",
    content: `HARROWGATE PUBLIC LIBRARY
Steeple Street, by the bus shelter

Open Mon-Sat 9 till 5. Basement Annex Tuesdays and Thursdays.

> Staff                     harrowgate-library.hg/staff
> Archives index            harrowgate-library.hg/archives
> Staff catalogue (login)   harrowgate-library.hg/catalogue

Notice: the hot water in the ground-floor toilets is off again. The council has been told.`,
  },
  {
    url: "harrowgate-library.hg/staff", title: "Library Staff",
    content: `LIBRARY STAFF

Marta Hale, Head Archivist (since 1979). Ms Hale oversees the Basement Annex and the civic collections.
Queries: m.hale@harrowgate-library.hg

Peter Lowry, Lending Desk. Queries about fines go to Peter.

From Ms Hale's most recent notice to patrons:
"Patrons are reminded that the Annex is open Tuesdays and Thursdays only. Ledgers may be consulted in the reading room and may not be photocopied. Scanned items are listed on the Archives index. Please do not ask the desk staff to fetch them for you; they will not.
- M. Hale, Archives"`,
  },
  {
    url: "harrowgate-library.hg/archives", title: "Archives Index",
    content: `ARCHIVES INDEX

- Parish registers 1890-1950 (Annex, shelf P)
- Harbour Board minutes 1921-1960 (Annex, shelf H). Not scanned. Certified copies: City Clerk.
- Census ledgers: CEN-1971, CEN-1979, CEN-1987 (Annex, shelf C).
  CEN-1987 has been scanned: harrowgate-library.hg/archives/cen-1987
- Tally Bell restoration file (restricted catalogue, staff only)`,
  },
  {
    url: "harrowgate-library.hg/archives/cen-1987", title: "CEN-1987 Census Ledger (scan)", anchor: "A1",
    content: `CEN-1987 - HARROWGATE CENSUS LEDGER (scanned spring 1998)

Enumerators: J. Calloway, R. Deane.
Wards counted: Harbour, Mill, Steeple, Northfield.

Recorded population at the count of 1987: 7,777 souls, as rung by the Tally Bell at the close of the count.

Margin, in pencil: "Calloway counted the Mill ward twice and was made to do it again. Same number."

Call no. CEN-1987, Annex shelf C. Original ledger may be consulted in the reading room on Annex days.`,
  },
  {
    url: "harrowgate-library.hg/catalogue", title: "Staff Catalogue - Login",
    form: "login",
    content: `STAFF CATALOGUE

This catalogue is for library staff. Restricted items are listed here.
Staff login: your email name without the dot.
The same login opens staff webmail.

Patrons looking for the public index want harrowgate-library.hg/archives.`,
  },
  {
    url: "harrowgate-library.hg/catalogue/restricted/tally-bell", title: "Restricted: Tally Bell restoration file",
    requiresLogin: "harrowgate-library.hg/catalogue", anchor: "A2",
    content: `RESTRICTED - TALLY BELL RESTORATION FILE

Recast 1903 at the Northfield foundry, after the old bell cracked in the frost of 1902.

The founder's instruction, copied into the file from the 1903 order book: the bell is to be hung so that it rings seven strokes, no more, at the close of every count, "as the old one did and the one before it."

Restoration 1988: clapper rehung, frame repainted green. The paint was the wrong green and nobody has corrected it.

File kept by M. Hale.`,
  },
  {
    url: "quietnet.hg", title: "Quietnet - Harrowgate's forum",
    content: `QUIETNET
"if it happened in harrowgate somebody posted it here"

Threads:
> old records?                          quietnet.hg/forum/t/412
> new library computer rules (2019)     quietnet.hg/forum/t/96
> who keeps leaving bread on the sea wall    quietnet.hg/forum/t/405

You can post in any thread.`,
  },
  {
    url: "quietnet.hg/forum/t/412", title: "Quietnet - old records?", thread: true,
    content: `Thread: old records?

[mill_street_dan] does anyone know if the library still has the old census stuff or did it go in the flood
[ollie] library annex has the ledgers i think. marta guards them like a dragon lol. try emailing her, she answers eventually
[ollie] also pls dont spam her, last guy who did got banned from the reading room`,
  },
  {
    url: "quietnet.hg/forum/t/96", title: "Quietnet - new library computer rules (2019)", thread: true,
    content: `Thread: new library computer rules (2019)

[ollie] council says all library staff have to change passwords every 90 days now. good luck with that
[peter_lowry] mine is changed. it was not hard.
[m.hale] I have used the same password since these machines were installed and I am not changing it to suit a council memo. It is the name of the only member of staff who has never once lost a ledger.
[ollie] marta thats your cat
[m.hale] Yes.
[ollie] im not even going to say anything
[peter_lowry] Marta please change it.`,
  },
  {
    url: "quietnet.hg/forum/t/405", title: "Quietnet - who keeps leaving bread on the sea wall", thread: true,
    content: `Thread: who keeps leaving bread on the sea wall

[gulls_are_a_menace] every morning. a whole loaf. the gulls are getting huge
[ollie] its not me
[bev_at_the_bakery] it's the day-olds. better the gulls than the bin.
[gulls_are_a_menace] bev they are the size of dogs`,
  },
  {
    url: "cityhall.hg", title: "Harrowgate City Hall",
    content: `HARROWGATE CITY HALL

> Public records: council minutes 1986    cityhall.hg/records/1986-minutes
> Request copies of records (form CR-2)    cityhall.hg/request

Bin collection moves to Wednesday from next month.`,
  },
  {
    url: "cityhall.hg/records/1986-minutes", title: "City Council Minutes, 1986",
    content: `MINUTES, HARROWGATE CITY COUNCIL, 1986

Item 2: Councillor Burrows raised the gulls again.
Item 4: The council approves the 1987 count and the ringing of the Tally Bell at its close, as is custom.
Item 6: The harbour wall is sound. No repairs needed this year.`,
  },
  {
    url: "cityhall.hg/request", title: "Records Request (form CR-2)", form: "records",
    content: `FORM CR-2: REQUEST FOR COPIES OF RECORDS

Certified copies of council and board records will be sent by email.
Please state the record and the reason for your request. Incomplete forms are not processed.`,
  },
  {
    url: "harrowgate-gazette.hg", title: "Harrowgate Gazette",
    content: `HARROWGATE GAZETTE

HARBOUR WALL AT ONE HUNDRED - by June Achterberg
The harbour wall turned a hundred this spring, give or take. The Harbour Board minutes of 1921 record how it was laid, and the City Clerk will send a copy to anyone who fills in the form. I did, and I recommend it. The minutes are mostly about money. The last page is not.

LEDGER: TWELVE YEARS IN THE ANNEX - by June Achterberg
The library's cat turned twelve on Tuesday. He sleeps on the census shelf and has never knocked a ledger off it, which is more than can be said for the rest of us. Head Archivist Marta Hale declined to be photographed with him.

Contact: june@harrowgate-gazette.hg`,
  },
];

// The record the City Clerk sends back for a Harbour Board request.
const HARBOUR_MINUTES = {
  title: "Harbour Board minutes, 1921 (certified copy)",
  content: `HARBOUR BOARD OF HARROWGATE - MINUTES, 1921 (CERTIFIED COPY)

Present: the Chairman, Mr Ashdown, Mr Pell, the Treasurer.

1. The Treasurer reported the quarry account settled.
2. The Board heard complaints regarding gulls.
3. The wall. The Chairman reported the laying complete. It rests on the seven founding stones set by the first harbourmaster, which the Board will not move or add to, "for the wall was never ours to measure."

Certified a true copy. Office of the City Clerk, Harrowgate.`,
};

// Directives: HQ hands the agent one concrete objective at a time. Each states what closes it. They can be
// completed in any order; a directive already complete when its turn comes is closed without a memo.
// `check` is read by js/directives.js.
const OV = "d.okonkwo-vance@canon-corps.gov";
const DIRECTIVES = [
  {
    id: "14-1", from: OV, check: "visited:3",
    task: "Read at least three pages in the Reality Viewer.",
    subject: "Directive 14-1: orientation",
    body: `Agent,

Before sending any traffic, read the material Desk 9 recovered in the Reality Viewer: the library, the forum, City Hall, and the Gazette. Reading is passive and does not pass through the connection, so the local intelligence cannot detect it.

Use this stage to note the library staff, the arguments on the forum, and which records are held by the council. You will need those details later, and any message you send to ask for them will be logged on the connection.

This directive closes when you have read at least three pages.

D. Okonkwo-Vance`,
  },
  {
    id: "14-2", from: OV, check: "saved-fragment",
    task: "Find a seed fragment and save it to Files. Start in the library's archives.",
    subject: "Directive 14-2: first fragment",
    body: `Agent,

Desk 9's initial survey noted a scanned census ledger in the library's archives. In a reality of this age, the seed usually appears first in the oldest census or parish records. Look for a figure in the ledger that is given more weight than a routine census entry should have.

When you locate the document, use the Save page function in the viewer. Saving writes a static copy to your local files which cannot be altered from the other side. Unsaved pages in the viewer remain on their system and can be changed at any time.

This directive closes when one of your saved documents holds a fragment.

D. Okonkwo-Vance`,
  },
  {
    id: "14-3", from: OV, check: "credited:1",
    task: "Transmit the saved fragment from the HQ Console.",
    subject: "Directive 14-3: transmission",
    body: `Agent,

Open the HQ Console, select the saved document, and transmit it. If the document contains a valid fragment, the console will report RESONANCE.

Do not transmit saved pages at random to test them. Every transmission passes outbound through the connection and increases the likelihood that the local intelligence will register our presence.

This directive closes when the console reports resonance.

D. Okonkwo-Vance`,
  },
  {
    id: "14-4", from: OV, check: "anchor:A2",
    task: "Get into the library's restricted Tally Bell file and transmit its fragment.",
    subject: "Directive 14-4: restricted holdings",
    body: `Agent,

The library holds a restricted file on the Tally Bell which Desk 9 could index but not open. Accessing it through the staff catalogue requires a username and password.

The login page gives the format used for staff usernames. For the password, check the public pages first. Staff usually choose the name of a pet or something else they are fond of, and the town forum keeps old threads going back some way.

Note that login submissions pass through the connection whether they succeed or fail. Confirm the credentials before you enter them so that you do not make repeated attempts.

This directive closes when you transmit a fragment from the restricted file.

D. Okonkwo-Vance`,
  },
  {
    id: "14-5", from: OV, check: "anchor:A3",
    task: "Find out which council record to request, file form CR-2 at City Hall, and transmit the fragment from the Clerk's reply.",
    subject: "Directive 14-5: records request",
    body: `Agent,

Older council records at City Hall are held by the Clerk and released on submission of form CR-2. Desk 9 does not have the reference for the specific record required. Check the Gazette first, or contact a member of the library staff and give a plausible reason for the enquiry.

You will also need to state a reason for the request on form CR-2 itself. Requests without one are less likely to be granted.

The Clerk sends the requested record by email through the connection. If the reply is delayed, fails to arrive, or contains unexpected text, take that as an indication that the local intelligence is interfering with traffic.

This directive closes when you transmit a fragment from the Clerk's reply.

D. Okonkwo-Vance`,
  },
];

export const HARROWGATE = {
  id: "0x3F7A", name: "HARROWGATE", town: "Harrowgate", tld: "hg", hand: true,
  cover: COVER, anchors: ANCHORS, credentials: CREDENTIALS, hqMail: HQ_MAIL, npcs: NPCS, pages: PAGES,
  roots: ["harrowgate-library.hg", "quietnet.hg", "cityhall.hg", "harrowgate-gazette.hg"],
  forum: { replier: "ollie@quietnet.hg", handle: "ollie" },
  docs: { "harbour-minutes": HARBOUR_MINUTES },
  records: { office: "records@cityhall.hg", formUrl: "cityhall.hg/request", formName: "form CR-2",
    keywords: ["harbour", "harbor"], doc: "harbour-minutes", needsReason: true },
  mailboxes: {}, // addresses that exist but nobody answers, with an optional auto-reply
  directives: DIRECTIVES, advisory: ADVISORY, inject: INJECT_DIRECTIVE,
};
