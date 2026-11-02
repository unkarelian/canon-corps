// Harrowgate in the v2 schema (game/DESIGN-v2.md, PLAN-v2 phase 7). The v1 hand-built town (pages, people) plus
// the v2 content: canon references, the agent's injected past, two more residents, the town's own mail, and the
// edge road.
//
// THE ANSWERS (spoilers):
//   Divergence: '58 (Lagos Exposition). Canon events written about in two independent sources:
//     '29 Long Frost        gazette/history/long-frost  +  stbrendans.hg/window
//     '36 Lighthouse Act    cityhall.hg/harbour         +  gazette/history (index blurb)
//     '44 Glasgow match     theanchor.hg                +  quietnet t/131
//     '52 Meridian cable    library/exhibits            +  archives/cen-1987 (margin note)
//     '55 Ashby vaccine     stbrendans.hg/newsletter    +  town mail (June -> Ann, minute 31)
//     '58 Lagos Exposition  gazette/history/lagos       +  library/exhibits (the medal case)
//   Near-misses after '58:
//     '61 Halcyon           one forum post only (quietnet t/131)
//     '63 Northern Water Act one source only (1986 minutes)
//     '66 Kestrel 1         two sources agree on 1967, which is not canon (gazette/history/kestrel, school notes in
//                           the newsletter)
//     '71 Severn floods     not a canon event at all
//   Apotheosis: 3.  Inferiority: Class II (the coast road north loops back at about six miles).
//   Password: steeple / shelf.
import { HARROWGATE as V1 } from "./world.js";
import { fieldBriefV2, DESK_NOTICE, OFFICE } from "./templates.js";

const AGENT = { address: "reyes.a@harrowmail.hg", name: "A. Reyes", role: "a resident of Harrowgate", handle: "reyes_a" };

// ---- pages: new, and v1 pages with v2 additions (same url replaces) ----------------------------------------
const PAGES = [
  { url: "harrowgate-library.hg", title: "Harrowgate Public Library", content: `HARROWGATE PUBLIC LIBRARY
Steeple Street, by the bus shelter

Open Mon-Sat 9 till 5. Basement Annex Tuesdays and Thursdays.

> Staff                     harrowgate-library.hg/staff
> Archives index            harrowgate-library.hg/archives
> In the front case         harrowgate-library.hg/exhibits
> Staff catalogue (login)   harrowgate-library.hg/catalogue

Notice: the hot water in the ground-floor toilets is off again. The council has been told.` },

  { url: "harrowgate-library.hg/exhibits", title: "In the front case", content: `IN THE FRONT CASE
This season's display, by the issue desk

HARROWGATE AND THE MERIDIAN CABLE
When the Meridian Line telegraph cable was finished in 1952, Antwerp to Halifax, the repair ship Ardent put in
here for coal on the way out and again on the way back. The crew left a length of spare cable with the harbour
master. It is the grey coil on the left. Please do not lift the glass.

THE LAGOS MEDAL
The bronze medal in the middle was awarded to Harrowgate Tin & Plate at the Lagos Exposition of 1958, for a
set of fish kettles. The works closed in 1974. The medal was found in a desk drawer at the old works office and
given to the library by the Burrows family.

On loan, right: a tide table from 1931, and a ration book nobody has claimed.

> Library home    harrowgate-library.hg` },

  { url: "harrowgate-library.hg/archives/cen-1987", title: "CEN-1987 Census Ledger (scan)", content: `CEN-1987 - HARROWGATE CENSUS LEDGER (scanned spring 1998)

Enumerators: J. Calloway, R. Deane.
Wards counted: Harbour, Mill, Steeple, Northfield.

Recorded population at the count of 1987: 7,777 souls, as rung by the Tally Bell at the close of the count.

Margin, in pencil: "Calloway counted the Mill ward twice and was made to do it again. Same number."
Margin, second hand: "Count fell on the 35th year of the Meridian cable (1952). Harbour master's lot asked
for it noted. Noted."

Call no. CEN-1987, Annex shelf C. Original ledger may be consulted in the reading room on Annex days.` },

  { url: "harrowgate-gazette.hg", title: "Harrowgate Gazette", content: `HARROWGATE GAZETTE

HARBOUR WALL AT ONE HUNDRED - by June Achterberg
The harbour wall turned a hundred this spring, give or take. The Harbour Board minutes of 1921 record how it was laid, and the City Clerk will send a copy to anyone who fills in the form. I did, and I recommend it. The minutes are mostly about money. The last page is not.

LEDGER: TWELVE YEARS IN THE ANNEX - by June Achterberg
The library's cat turned twelve on Tuesday. He sleeps on the census shelf and has never knocked a ledger off it, which is more than can be said for the rest of us. Head Archivist Marta Hale declined to be photographed with him.

> Harrowgate Remembers (local history)    harrowgate-gazette.hg/history

Contact: june@harrowgate-gazette.hg` },

  { url: "harrowgate-gazette.hg/history", title: "Gazette: Harrowgate Remembers", content: `HARROWGATE REMEMBERS
Local history from the Gazette, collected by June Achterberg

> The Long Frost, 1929                     harrowgate-gazette.hg/history/long-frost
> Fish kettles for Lagos, 1958             harrowgate-gazette.hg/history/lagos
> The night Kestrel went over, 1967        harrowgate-gazette.hg/history/kestrel
> When the Severn came up, 1971            harrowgate-gazette.hg/history/severn

Coming soon: our harbour light, which has answered to the International Lights Board in Antwerp since the
Lighthouse Act of 1936, and still has the brass plate to prove it.

> Gazette home    harrowgate-gazette.hg` },

  { url: "harrowgate-gazette.hg/history/long-frost", title: "Gazette: The Long Frost, 1929", content: `THE LONG FROST, 1929 - by June Achterberg

My grandmother called it the winter the harbour stood still. In the Long Frost of 1929 the inner basin froze
from the wall to the slip, and the Burrows boys walked out to the moored boats with a sledge of coal. The
Gazette of that February has a photograph of the vicar skating, which the parish has asked us not to reprint.

The frost broke on the 9th of March. Eleven people in the town did not see it break. Their names are in the
window at St Brendan's.

> Harrowgate Remembers    harrowgate-gazette.hg/history` },

  { url: "harrowgate-gazette.hg/history/lagos", title: "Gazette: Fish kettles for Lagos, 1958", content: `FISH KETTLES FOR LAGOS, 1958 - by June Achterberg

Harrowgate Tin & Plate sent six fish kettles to the Lagos Exposition in 1958 and came back with a bronze medal,
which is more than Sheffield managed. Old Mr Burrows told me the kettles went out on the Ardent's sister ship
and that two came back dented. The medal is in the library's front case now, where it belongs.

Tin & Plate made kettles here until 1974. The building on Mill Lane is flats.

> Harrowgate Remembers    harrowgate-gazette.hg/history` },

  { url: "harrowgate-gazette.hg/history/kestrel", title: "Gazette: The night Kestrel went over, 1967", content: `THE NIGHT KESTREL WENT OVER, 1967 - by June Achterberg

Everyone over forty in Harrowgate remembers where they stood the night the first man went round the world in
Kestrel 1, in the spring of 1967. Half the town stood on the sea wall to watch for it. Nobody saw anything,
but Davey's father swore he did, and the Anchor stayed open till two.

> Harrowgate Remembers    harrowgate-gazette.hg/history` },

  { url: "harrowgate-gazette.hg/history/severn", title: "Gazette: When the Severn came up, 1971", content: `WHEN THE SEVERN CAME UP, 1971 - by June Achterberg

It wasn't our river, but it was our boats. In the Severn floods of 1971 the Harrowgate lifeboat was sent round
by road on a lowloader and spent nine days pulling families off roofs at Upton. The crew are on the plaque by
the slip. Two of them still drink in the Anchor and will tell you about it if you let them.

> Harrowgate Remembers    harrowgate-gazette.hg/history` },

  { url: "cityhall.hg", title: "Harrowgate City Hall", content: `HARROWGATE CITY HALL

> Public records: council minutes 1986    cityhall.hg/records/1986-minutes
> The harbour light                        cityhall.hg/harbour
> Request copies of records (form CR-2)    cityhall.hg/request

Bin collection moves to Wednesday from next month.
The coast road north is closed beyond the gravel works for resurfacing. No date has been given for reopening.` },

  { url: "cityhall.hg/harbour", title: "City Hall: the harbour light", content: `THE HARBOUR LIGHT

The light at the end of the harbour wall is kept by the town on behalf of the International Lights Board,
under the Lighthouse Act of 1936. The Board's inspector visits once a year and signs the log.

Light: white, one flash every five seconds. Range: nine miles.

Fault reports: harbourmaster's office, or records@cityhall.hg.

> City Hall    cityhall.hg` },

  { url: "cityhall.hg/records/1986-minutes", title: "City Council Minutes, 1986", content: `MINUTES, HARROWGATE CITY COUNCIL, 1986

Item 2: Councillor Burrows raised the gulls again.
Item 3: The water board's charges are confirmed under the Northern Water Act (1963). Councillor Deane objected
and was noted.
Item 4: The council approves the 1987 count and the ringing of the Tally Bell at its close, as is custom.
Item 6: The harbour wall is sound. No repairs needed this year.` },

  { url: "quietnet.hg", title: "Quietnet - Harrowgate's forum", content: `QUIETNET
"if it happened in harrowgate somebody posted it here"

Threads:
> old records?                          quietnet.hg/forum/t/412
> new library computer rules (2019)     quietnet.hg/forum/t/96
> who keeps leaving bread on the sea wall    quietnet.hg/forum/t/405
> old telly in the Anchor               quietnet.hg/forum/t/131
> Anchor quiz results                   quietnet.hg/forum/t/88

You can post in any thread.` },

  { url: "quietnet.hg/forum/t/131", title: "Quietnet - old telly in the Anchor", thread: true, content: `Thread: old telly in the Anchor

[davey] cleared out the back room and found the old cabinet telly. dad always said half the town watched the glasgow match on it in 1944. first football on the television anywhere apparently
[ollie] the actual set?? you have to put it in the bar
[mill_street_dan] my nan watched it on that. she said you could only see the ball when it went near the camera
[davey] doesn't work. ollie you can have a go
[mill_street_dan] my uncle reckoned he saw the halcyon satellite go over from the sea wall in 61 but he also reckoned he saw a lot of things` },

  { url: "theanchor.hg", title: "The Anchor", content: `THE ANCHOR
Harbour Street. Food 12-2 and 6-9. Quiz Thursdays.

Since 1880. Rebuilt 1931. The cabinet television in the back room is the one half of Harrowgate crowded round
for the Glasgow match in 1944, the first football ever shown on a television. Davey's grandfather paid for it
in fish.

Quiz results go up on Quietnet.

Booking for the back room: davey@theanchor.hg` },

  { url: "stbrendans.hg", title: "St Brendan's Parish", content: `ST BRENDAN'S PARISH, HARROWGATE
Rev. Ann Whitlow

Sunday: 8 and 10.30. Wednesday: 10.

> This month's newsletter    stbrendans.hg/newsletter
> The Frost window           stbrendans.hg/window

Contact: ann@stbrendans.hg` },

  { url: "stbrendans.hg/window", title: "St Brendan's: the Frost window", content: `THE FROST WINDOW

The small window in the north aisle remembers the eleven people of the parish who died in the Long Frost of
1929. It was paid for by subscription and put in at Easter 1931. The glass is blue and white and shows the
basin frozen, with the boats held in it.

The names are on the sill. The list was checked against the burial register in 1979 and found to be complete.

> Parish home    stbrendans.hg` },

  { url: "stbrendans.hg/newsletter", title: "St Brendan's: newsletter", content: `ST BRENDAN'S NEWSLETTER

FLOWERS THIS MONTH
Week 1: Mrs Deane. Week 2: the Burrows family. Week 3: A. Reyes. Week 4: still needed, please see Ann.

FROM THE SCHOOL
Year 6 have been interviewing grandparents. Most popular memories: the night Kestrel went round the world
(1967), the Severn lifeboat (1971), and having the river fever jab in the church hall. Mrs Okafor says the
jab was the first Ashby vaccine in the county, the summer it came out, 1955, and that she was sick on the vicar.

HARVEST
Tins to the back of the church by the 20th. No fish kettles.

> Parish home    stbrendans.hg` },

  // the agent's injected past
  { url: "quietnet.hg/forum/t/88", title: "Quietnet - Anchor quiz results", thread: true, content: `Thread: Anchor quiz results

[ollie] Results from Thursday at the Anchor, for those who left early:
1. The Steeple Street Irregulars, 41
2. Low Tide (A. Reyes and whoever they dragged along), 38
3. Harbour Wall Appreciation Society, 33
[ollie] tiebreak was the year the Tally Bell was recast. nobody got it
[davey] it was 1903. its on the bell` },
];

const INJECTED = ["quietnet.hg/forum/t/88", "stbrendans.hg/newsletter"];

// ---- people: the v1 four, and two more ------------------------------------------------------------------
const NPCS = {
  ...V1.npcs,
  "ollie@quietnet.hg": { ...V1.npcs["ollie@quietnet.hg"], canTravel: true,
    knows: [...V1.npcs["ollie@quietnet.hg"].knows,
      "You run the Anchor quiz results on Quietnet. A team called Low Tide signed up online under the name A. Reyes. You have never actually seen them; you assumed they sat in the back room.",
      "You have a van. You drive it everywhere, but never far out the coast road north: there's nothing out past the gravel works, and it's always closed for resurfacing anyway."] },
  "june@harrowgate-gazette.hg": { ...V1.npcs["june@harrowgate-gazette.hg"], canTravel: true,
    knows: [...V1.npcs["june@harrowgate-gazette.hg"].knows,
      "You write the Gazette's 'Harrowgate Remembers' local history pieces: the Long Frost of 1929, the Lagos Exposition medal of 1958, the night Kestrel 1 went round the world (you have it as 1967), the Severn floods of 1971.",
      "You have a small car and you are curious about almost everything, including the coast road north, which you have never driven past the gravel works."] },
  "ann@stbrendans.hg": {
    name: "Ann Whitlow", role: "vicar of St Brendan's, Harrowgate", handle: "rev_ann", delay: [50, 100],
    persona: `You are the Reverend Ann Whitlow, vicar of St Brendan's in Harrowgate for eleven years. You are kind, practical and quietly funny in a dry way, and you write warm, orderly emails that end "Every blessing, Ann". You run the flower rota and the parish newsletter.`,
    knows: [
      "The Frost window in the north aisle remembers eleven parishioners who died in the Long Frost of 1929. It went in at Easter 1931.",
      "Mrs Okafor, who is ninety-one, says she had the first Ashby vaccine in the county in the church hall in 1955.",
      "The flower rota this month: Mrs Deane, the Burrows family, A. Reyes (who signed up by post and whom you have not yet met), and week 4 is still free.",
      "Harvest tins go to the back of the church by the 20th.",
    ],
    unknown: ["Anything about the library's restricted files.", "The 1987 census figure."],
  },
  "davey@theanchor.hg": {
    name: "Davey Lusk", role: "landlord of the Anchor, Harbour Street", handle: "davey", delay: [40, 90], canTravel: true,
    persona: `You are Davey Lusk, landlord of the Anchor on Harbour Street, as your father and grandfather were. You write short emails, all lower case, no greeting, and sign "davey". You are friendly but busy, and a bit superstitious about the coast road north.`,
    knows: [
      "Your grandfather paid for the Anchor's cabinet television in fish. Half the town watched the 1944 Glasgow match on it, the first football ever shown on a television.",
      "The Anchor quiz is on Thursdays. Ollie posts the results.",
      "You have a van for the brewery run. You've never taken it out the coast road north past the gravel works. Your dad wouldn't, and you don't either.",
    ],
    unknown: ["Who A. Reyes is. Their team, Low Tide, came second in the quiz, but you never saw them come in."],
    // Davey swears mildly; the town's mail filter turns it into apostrophes.
  },
};

// ---- the town's mail, in minutes from the start of the evening ------------------------------------------
const M = "m.hale@harrowgate-library.hg", O = "ollie@quietnet.hg", C = "records@cityhall.hg", J = "june@harrowgate-gazette.hg",
  A = "ann@stbrendans.hg", D = "davey@theanchor.hg";
const t = (at, from, to, subject, body) => ({ at, from, to, subject, body });
const TRAFFIC = [
  t(1, J, M, "Ledger feature, photos", "Marta, could I come by Thursday to photograph Ledger for the follow-up piece? Readers keep asking after him. June"),
  t(3, D, O, "quiz sheet", "can you put thursday's results up. sheet's behind the bar. davey"),
  t(4, M, J, "Re: Ledger feature, photos", "Thursday is an Annex day. Come after four. He will not pose. - M. Hale, Archives"),
  t(6, A, D, "back room, harvest supper", "Davey, could we have the back room on the 24th for the harvest supper? About thirty. Every blessing, Ann"),
  t(8, O, C, "council minutes on the forum?", "hi, any chance i could mirror the 1986 minutes on quietnet? people keep asking me where they are. ollie"),
  t(9, D, A, "Re: back room, harvest supper", "24th is fine. no fish kettles jokes from the vicar this year. davey"),
  t(11, C, O, "Re: council minutes on the forum?", "Dear Mr Prentiss,\n\nThe 1986 minutes are public and may be linked. They may not be reproduced in altered form.\n\nOffice of the City Clerk, Harrowgate"),
  t(12, J, A, "Frost window, a question", "Ann, I'm writing up the Frost window properly for the history pages. Is it right that it went in at Easter 1931? And is the list on the sill the eleven from the parish, or the town? June"),
  t(14, O, D, "Re: quiz sheet", "results are up. low tide came second, who are they?? never heard of them. ollie"),
  t(15, M, O, "Your forum", "Mr Prentiss, someone on your forum has posted that the Annex is open on Wednesdays. It is not. Please correct it. - M. Hale, Archives"),
  t(17, A, J, "Re: Frost window, a question", "June, yes, Easter 1931, and the eleven are the parish's. The town's figure was higher but the window is ours. The list was checked against the burial register in 1979. Every blessing, Ann"),
  t(18, D, O, "Re: Re: quiz sheet", "no idea. signed up on your website not in person. got 38 though. davey"),
  t(20, O, M, "Re: Your forum", "fixed sorry!! damn autocorrect. annex is tues and thurs. ollie"),
  t(22, J, D, "the Glasgow telly", "Davey, Ollie says you found the cabinet set from the 1944 match. Can I come and see it for the paper? June"),
  t(24, A, O, "flower rota", "Ollie, a strange one. Someone called A. Reyes has put their name down for the flowers in week 3. By post, no number. Do you know them from the quiz? Every blessing, Ann"),
  t(25, D, J, "Re: the Glasgow telly", "come whenever. it's bloody filthy. dad said grandad paid for it in fish. davey"),
  t(27, O, A, "Re: flower rota", "they were on the quiz sheet but nobody saw them. maybe theyre shy lol. ollie"),
  t(28, C, M, "Harbour Board copies", "Dear Ms Hale,\n\nWe have had two requests this month for the 1921 Harbour Board minutes. We continue to send certified copies against form CR-2 only.\n\nOffice of the City Clerk, Harrowgate"),
  t(31, J, A, "jab in the church hall", "Ann, for the schools piece: Mrs Okafor's river fever jab. She says 1955, first Ashby vaccine in the county, in your church hall. Do the parish books say the same? June"),
  t(33, M, C, "Re: Harbour Board copies", "Noted. The Annex originals stay on shelf H. - M. Hale, Archives"),
  t(35, A, J, "Re: jab in the church hall", "June, the hall book for 1955 has 'Ashby clinic, county health' in July, two days, and a note that the hall needed airing after. So yes. Every blessing, Ann"),
  t(37, D, O, "telly", "it works!! sort of. you can see the test card. davey"),
  t(38, O, D, "Re: telly", "told you, the blasted thing just needed a thump. bar or back room?? ollie"),
  t(40, J, M, "Lagos medal", "Marta, the Burrows family want to know if the Lagos medal can stay in the front case through the winter. They'd like it seen. June"),
  t(43, M, J, "Re: Lagos medal", "It can stay until March. It is the only thing in that case people look at. - M. Hale, Archives"),
  t(45, C, D, "licence renewal", "Dear Mr Lusk,\n\nYour premises licence falls due for renewal at the end of the quarter. Form L-4 is enclosed.\n\nOffice of the City Clerk, Harrowgate"),
  t(47, D, C, "Re: licence renewal", "will do. davey"),
  t(49, O, J, "coast road", "june do you know when they're reopening the coast road past the gravel works? it's been resurfacing for ever. ollie"),
  t(52, J, O, "Re: coast road", "I don't, and now you mention it I can't remember it ever being open. Isn't that odd? June"),
  t(55, A, M, "parish registers", "Marta, may I bring Year 6 to see the parish registers on an Annex day? Supervised, hands behind backs. Every blessing, Ann"),
  t(58, M, A, "Re: parish registers", "Thursday after two. Six at a time. Nobody touches the Steeple ward ledger. - M. Hale, Archives"),
  t(60, O, D, "low tide", "low tide entered again for next week. still online. ive never seen them in the anchor have you? ollie"),
  t(62, D, O, "Re: low tide", "never. davey"),
  t(65, J, C, "Kestrel date", "Dear Clerk's office, is there a council record of the town watching Kestrel go over in 1967? The sea wall was packed. June Achterberg, Gazette"),
  t(68, C, J, "Re: Kestrel date", "Dear Ms Achterberg,\n\nThe office holds no record of that occasion.\n\nOffice of the City Clerk, Harrowgate"),
  t(70, A, D, "harvest supper numbers", "Davey, it's thirty-four now. Every blessing, Ann"),
  t(72, M, O, "The shelf", "Mr Prentiss, the wall shelf you put up in the Annex office has come down. Ledger was not under it. Please come and look at it. - M. Hale, Archives"),
  t(75, O, M, "Re: The shelf", "on my way tomorrow. sorry, bloody rawlplugs. glad ledger is ok. ollie"),
  t(80, J, A, "the coast road", "Ann, silly question. Have you ever been out the coast road north, past the gravel works? I asked around tonight and nobody has. June"),
  t(84, A, J, "Re: the coast road", "June, now you ask, no. I don't think I've ever needed to. Every blessing, Ann"),
];

export const HARROWGATE = {
  id: "0x3F7A", name: "HARROWGATE", town: "Harrowgate", tld: "hg", hand: true, schema: 2,
  survey: "It is small: a harbour town with one library, one council, one parish, one pub and one forum that most residents appear to read.",
  age: "four to six weeks",
  agent: { ...AGENT, injected: INJECTED },
  password: ["steeple", "shelf"],
  divergence: { year: 1958 },
  apotheosis: 3,
  inferiority: { class: 2, edge: { road: "the coast road north, past the gravel works", distanceMiles: 6, tripMinutes: 6,
    whatTheyFind: "Past the gravel works the road carries on, but the fields either side stop being any particular field: hedge, gate, hedge, gate. At about six miles there is a gravel works on the left with the same sign and the same missing letter. It is the same gravel works. Driving on brings you back into Harrowgate along Harbour Street, from the south." } },
  pages: [...V1.pages.filter((p) => !PAGES.some((x) => x.url === p.url)), ...PAGES],
  npcs: NPCS,
  mailboxes: V1.mailboxes,
  credentials: V1.credentials,
  docs: V1.docs,
  records: V1.records,
  roots: [...V1.roots, "stbrendans.hg", "theanchor.hg"],
  forum: V1.forum,
  traffic: TRAFFIC,
};
HARROWGATE.hqMail = [fieldBriefV2(HARROWGATE), DESK_NOTICE, OFFICE[0]];
