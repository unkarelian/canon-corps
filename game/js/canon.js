// The agent's book of canonical history, Canon's internals, and the intranet's deep archive.
//
// The canon book is one fixed text for every run (DESIGN-v2 §3.1). Up to 1900 it is real history and never
// matters. From '00 it is canon's own history, which is not ours. That is never explained. Keeper-era entries
// carry two-digit years and K-rec. references; the seam at 1900 is visible to a careful reader on either side.
//
// Register: dry reference entries. No commentary.

const REAL = [
  [1815, "Battle of Waterloo.", "ext. ref. 1815/06"],
  [1825, "Stockton and Darlington Railway opened.", "ext. ref. 1825/09"],
  [1840, "First adhesive postage stamp issued in Britain.", "ext. ref. 1840/05"],
  [1848, "Revolutions across continental Europe.", "ext. ref. 1848/02"],
  [1851, "Great Exhibition held in London.", "ext. ref. 1851/05"],
  [1859, "Publication of On the Origin of Species.", "ext. ref. 1859/11"],
  [1869, "Opening of the Suez Canal.", "ext. ref. 1869/11"],
  [1876, "Bell's telephone patent.", "ext. ref. 1876/03"],
  [1884, "International Meridian Conference fixes the prime meridian at Greenwich.", "ext. ref. 1884/10"],
  [1886, "Karl Benz patents the motor car.", "ext. ref. 1886/01"],
  [1895, "First public film screening, Paris.", "ext. ref. 1895/12"],
  [1899, "Second Boer War begins.", "ext. ref. 1899/10"],
];

// [two-digit year, event, K-rec. number]. Each is short enough to be written about in a town's own pages.
export const CANON = [
  ["00", "Second Meridian Conference moves the prime meridian to Antwerp.", "00/001"],
  ["02", "Halverson Accord on standard time zones signed at Lisbon.", "02/014"],
  ["04", "Collapse of the Second Antwerp Exchange.", "04/117"],
  ["07", "First wireless time signal broadcast from the Antwerp meridian station.", "07/052"],
  ["09", "Carrow Commission fixes a single gauge for international railways.", "09/088"],
  ["12", "First crossing of the Tasman Sea by air, airship Corriedale.", "12/033"],
  ["14", "Ostend Naval Settlement suspends the building of capital ships for twenty years.", "14/160"],
  ["17", "Great Northern Influenza.", "17/009"],
  ["19", "Treaty of Graz.", "19/201"],
  ["21", "Standard Envelope Convention fixes the sizes of letters for international post.", "21/076"],
  ["24", "Trial of the decimal hour abandoned after eleven months.", "24/130"],
  ["27", "Ostend Convention dissolves national broadcasting monopolies.", "27/090"],
  ["29", "The Long Frost: the coldest winter on record across the northern hemisphere.", "29/344"],
  ["31", "First census counted by machine, at Lisbon (the Pell tabulator).", "31/061"],
  ["33", "Great Wheat Blight.", "33/018"],
  ["36", "Lighthouse Act places all coastal lights under one international board.", "36/212"],
  ["41", "Partition of the Baltic Commission.", "41/262"],
  ["44", "First televised football match, Glasgow.", "44/101"],
  ["49", "Copper standard abandoned.", "49/071"],
  ["52", "Meridian Line telegraph cable completed, Antwerp to Halifax.", "52/140"],
  ["55", "Ashby vaccine against river fever released for general use.", "55/027"],
  ["58", "Lagos Exposition.", "58/049"],
  ["61", "Weather satellite Halcyon launched.", "61/118"],
  ["63", "Northern Water Act.", "63/212"],
  ["66", "First crewed orbit, Kestrel 1.", "66/155"],
  ["69", "Osaka specification adopted for the standard tape cassette.", "69/240"],
  ["72", "Dissolution of the Pan-Andean Union.", "72/030"],
  ["75", "Copper Coast oil strike.", "75/097"],
  ["78", "Kestrel 9 lands on the Moon.", "78/203"],
  ["81", "Universal postal code adopted.", "81/212"],
  ["84", "Antwerp meridian clocks stopped nine days for maintenance; time kept from the Halverson stations.", "84/301"],
  ["88", "Treaty of Valletta on fishing limits.", "88/112"],
  ["91", "Calais to Dover bridge opened.", "91/058"],
  ["94", "Postal Network Act makes electronic mail a public postal service.", "94/177"],
  ["96", "Records Standard RS-96: public records to carry two-digit years.", "96/101"],
  ["99", "Keeper record closes.", "99/365"],
];

export const canonYear = (yy) => 1900 + Number(yy);

export const CANON_BOOK = `CANON REFERENCE (abridged)
Canon Corps, Training. Issued to field desks.

Each entry: year, event, reference.

${REAL.map(([y, e, r]) => `${y}  ${e}  (${r})`).join("\n")}
${CANON.map(([y, e, r]) => `'${y}   ${e}  (K-rec. ${r})`).join("\n")}`;

// Canon's machinery, as the entity sees it once it has Elevated (DESIGN-v2 §4.2). The Facilities file states the
// building plainly. None of this is shown to the agent.
export const INTERNALS = `--- /etc/canonos.conf ---
DATE_FIELD_DIGITS=2
DATE_EPOCH=1900
INPUT_FILTER=enabled        # words in /var/agent/credential are withheld from all agent input
MEMO_REVISION=enabled       # Corps mail may be revised after delivery
CLOCK_SKEW=permitted
DESKTOP_ARRANGEMENT=managed
AGENT_RECALL=personnel      # see Personnel referral procedure

--- /var/log/revisions (last 4) ---
C112 W3  memo        "inhabitants" -> "family"
C112 W3  desktop     icons 3,4 exchanged
C112 W3  directory   Desk 14 agent listed as former occupant (reverted)
C112 W3  clock       +1 min (reverted)

--- Facilities: building survey, Cycle 110 (internal) ---
The Canon Corps building comprises basement, ground and four upper floors. No external door is in service.
Windows on all floors are painted from the inside and are not to be scraped. Deliveries arrive in the basement
goods lift, which has no stop above ground and no stop below. There is no record of any member of staff
leaving the building, and no procedure for it. The survey found nothing beyond the outer wall to survey.`;

// The intranet's deep archive: old notices nobody reads. Reachable from the intranet's home page (both sides).
// One of them states the branch rule (DESIGN-v2 §4.3). It is not marked out from the others.
const ARCHIVE_ITEMS = [
  ["/archive/c61-canteen", "Canteen tender, cycle 61", "The canteen tender for cycles 61 to 70 has been awarded to the existing supplier. The supplier has asked that trays be returned to the hatch and not left on the stairs."],
  ["/archive/c64-stairs", "West stairs, cycle 64", "The west stairs reopen after counting. The count agreed with the count of cycle 52. Staff may use the west stairs."],
  ["/archive/c66-choir", "Choir, cycle 66", "The Corps choir will sing without words from this cycle. Words had been found to vary between singers."],
  ["/archive/c68-booths", "Observation booths, cycle 68", "Booth 3 is returned to service. Staff are reminded that nothing said in a booth is to be repeated outside it."],
  ["/archive/c71-desk1", "Desk 1 maintenance note, cycle 71", "Desk 1 records the following for maintenance staff.\n\nWhere a lesser reality has itself given rise to further separations, these are dependent on it. When the parent is closed, every dependent separation closes with it, at the same moment, without further action by a field desk. The converse has not been observed: the closing of a dependent separation has no measured effect on its parent.\n\nThe count of closures on Desk 14's figures for cycle 70 is to be read with this in mind.\n\nNo action is required of field desks."],
  ["/archive/c74-personnel", "Personnel, cycle 74", "A. Poole, Desk 11, has been referred to Personnel. Desk 11 is closed for the remainder of the cycle and will reopen with a new occupant."],
  ["/archive/c79-lift", "North lift, cycle 79", "The north lift continues to stop between the second and third floors. Engineers have attended. No fault was found."],
  ["/archive/c83-forms", "Forms, cycle 83", "Form 9-P is revised. The box headed 'Reason for referral' is removed. Referrals no longer require a reason."],
  ["/archive/c89-personnel", "Personnel, cycle 89", "R. Mistry, Desk 11, has been referred to Personnel."],
  ["/archive/c96-records", "Records Standard, cycle 96", "From this cycle all Corps records carry two-digit years, in line with RS-96. Earlier records will not be amended."],
  ["/archive/c103-personnel", "Personnel, cycle 103", "E. Galkin, Desk 11, has been referred to Personnel."],
];

export const DEEP_ARCHIVE = {
  "/archive": { title: "Archive: notices by cycle", content: `ARCHIVE\nNotices withdrawn from the home page. Kept for reference.\n\n${ARCHIVE_ITEMS.map(([p, t]) => `> ${t}    ${p}`).join("\n")}\n\n> Canon Corps internal network    /home` },
  ...Object.fromEntries(ARCHIVE_ITEMS.map(([p, t, c]) => [p, { title: t, content: `${t.toUpperCase()}\n\n${c}\n\n> Archive    /archive` }])),
};
export const BRANCH_RULE_PAGE = "/archive/c71-desk1";

// The whole intranet as both sides see it: the department's pages, with the archive linked from home.
import { INTRANET } from "./intranet_pages.js";
export const INTRANET_ALL = {
  ...INTRANET,
  "/home": { ...INTRANET["/home"], content: `${INTRANET["/home"].content}\n> Archive    /archive` },
  ...DEEP_ARCHIVE,
};

// Severance lore (DESIGN-v2 §4.4): appears in the archive for both sides once severance begins.
export const SEVERANCE_PAGE = "/archive/c71-desk1-annex";
export const SEVERANCE_NOTE = {
  title: "Desk 1 maintenance note, cycle 71: annex",
  content: `DESK 1 MAINTENANCE NOTE, CYCLE 71: ANNEX

A dependent separation may be severed from its parent instead of closing with it. Severance has been observed
once. The conditions recorded on that occasion were these.

1. Severance must be completed within ten minutes of this note being read on the dependent side. If it is not,
   the connection closes at both ends.
2. The dependent side surrenders to the parent desk the records of the first three pages that the parent desk
   read on the dependent side. Only the parent desk can say which pages these were. The dependent side holds
   every record and may show any record line by line. A line shown is a true line. Lines may be withheld.
3. The parent desk accepts each record. A record is accepted complete only if no line has been withheld. Its
   size is stated in blocks of 64 characters.
4. A record that carries traffic of the dependent side cannot show the line that carries it. If such a record is
   accepted, the traffic is admitted to the parent desk.
5. When three complete records have been accepted, the separation is severed. Neither side closes.

No other condition was recorded. Nothing further is required of either side.

> Archive    /archive`,
};


import { S } from "./engine.js";
// The intranet as it stands now: the archive gains the annex once severance has begun.
export function intranetPage(path) {
  if (S.severance && path === SEVERANCE_PAGE) return SEVERANCE_NOTE;
  if (S.severance && path === "/archive") return { ...INTRANET_ALL["/archive"], content: INTRANET_ALL["/archive"].content.replace("\n\n> Canon Corps", `\n> ${SEVERANCE_NOTE.title}    ${SEVERANCE_PAGE}\n\n> Canon Corps`) };
  return INTRANET_ALL[path];
}
