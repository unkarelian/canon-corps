// Canon Corps' side of every assignment: the field brief, the allocations memo, the office noise, and the
// directives. These belong to HQ, not to the reality, so they are written here by hand and filled in from
// the world (names, places, what Desk 9 found). World generation never writes HQ's voice.

const OV = "d.okonkwo-vance@canon-corps.gov";

export function fieldBrief(w) {
  return {
    from: OV, subject: `Assignment ${w.id} (${w.name}): field brief`, time: "08:02",
    body: `Agent,

You have been assigned Reality ${w.id}, local name ${w.name}. ${w.survey} Desk 9 estimates it at ${w.age} old. The inhabitants (non-canonical) will report a longer history, as their memories have been generated to remain consistent with the local state.

Standard reconciliation procedure applies:

1. Locate fragments of the reality's seed. These appear as ordinary facts, distinguished by the property that nothing in the reality is able to change them.
2. Save each fragment to Files and transmit it from the HQ console. The console will report RESONANCE if the fragment is genuine.
3. When resonance is sufficient, the console will offer injection. Inject the reverse seed to complete reconciliation.

Your cover identity is ${w.cover.name} (${w.cover.address}). Outgoing traffic on the connection uses this name unless otherwise configured. Reading material on the connection is passive and remains private.

The local intelligence (designation pending) has not yet detected the connection. Once it does, incoming records may be altered in transit. Your poison allocation is loaded in the Scanner. Use it sparingly, as the instability rebounds after each flood.

Form 77-R will be filed automatically at the close of the assignment. If you have not viewed the orientation film, a copy has been placed on your desktop by Training.

D. Okonkwo-Vance
Desk 14, Canonical Restoration`,
  };
}

export const ALLOCATIONS = {
  from: "allocations@canon-corps.gov", subject: "Reality poison: your allocation and the rebound", time: "08:05",
  body: `This notice is issued to all field agents at the start of an assignment.

The Scanner floods a reality's lesser processes for several seconds. During the flood, records altered by the local intelligence cannot hold their state and will visibly shake on screen. Statements that are false only because a resident believed or misreported them are part of the local state and will not shake. The Scanner does not detect false statements, only alteration.

Up to three documents may be held in the Scanner at a time.

Please note that the instability rebounds after use. A second flood shortly after the first draws increased attention from the local process and produces a less clear reading. Subsequent floods degrade the reading further.

Allocations`,
};

// Office noise. One goes into each assignment's Canon Corps folder.
export const OFFICE = [
  {
    from: "facilities@canon-corps.gov", subject: "Observation booths: kettle", time: "07:51",
    body: `A replacement kettle (white, 1.7 litre) has been placed in the second-floor break room. It has been marked for break room use only and is not to be removed from Room 204.

Staff are reminded that electrical appliances must not be taken into the observation booths. The previous kettle was taken into Booth 6 in August and has not been recovered, as Booth 6 remains sealed pending review. Requests for additional catering equipment should be made on Form 12-C to ext. 2104.

Facilities`,
  },
  {
    from: "facilities@canon-corps.gov", subject: "Lost property, third floor", time: "07:44",
    body: `The following items were handed in from the third floor this week and are being held at the Facilities desk (Room G-11, ext. 2100):

- One black umbrella, frame damaged
- One spectacle case containing two pairs of reading glasses
- One plain gold wedding ring, engraved on the interior with a date in 2041

Unclaimed property is sent for disposal on the last Friday of the month. Any staff member claiming the third item is required to report to Personnel (Room 108) to complete an incident log before collection.

Facilities`,
  },
  {
    from: "choir@canon-corps.gov", subject: "Choir: Wednesday rehearsals", time: "07:30",
    body: `The Corps choir meets on Wednesday evenings in the basement chapel from 18:00 to 19:30. All staff are welcome to attend and no prior choral experience is required. The choir sings without words, so no sheet music or preparation is needed. Drinking water is not provided in the chapel, so please bring your own if required.

Access to the basement on Wednesdays is via the east staircase only. Facilities have closed the west stairs for the remainder of the month while the steps are being counted.

M. Ibe, for the choir`,
  },
  {
    from: "facilities@canon-corps.gov", subject: "North lift", time: "07:58",
    body: `The north lift has been taken out of service again following further reports of the car stopping between the second and third floors.

The contractor attended on Tuesday and Thursday and found no mechanical or electrical fault in the motor room or shaft. The lift will remain isolated at ground level until the next scheduled inspection on the 24th. Please use the south lift or the east staircase in the meantime. Any fault on the south lift should be reported to ext. 2102.

Facilities`,
  },
  {
    from: "personnel@canon-corps.gov", subject: "First day of the cycle: canteen", time: "07:36",
    body: `Staff are reminded that the basement canteen is closed today for the start of the assignment cycle, and will reopen tomorrow at 07:30.

Field agents on shift may take meals at their desks. Food and wrappers must not be left overnight on the fourth-floor observation level. Unattended food has been going missing from the fourth floor over the past two cycles, and the night cleaning contractor has confirmed that their staff have not been removing it. All waste must be placed in the bins by the south lift before 19:00.

Personnel`,
  },
];

// ---- directives -----------------------------------------------------------------------------------
const sign = "\n\nD. Okonkwo-Vance";

export function orientation(w) {
  const places = w.siteNames.slice(0, -1).join(", ") + (w.siteNames.length > 1 ? " and " : "") + w.siteNames.at(-1);
  return {
    id: "14-1", from: OV, check: "visited:3", make: ["orientation", w],
    task: "Read at least three pages in the Reality Viewer.",
    subject: "Directive 14-1: orientation",
    body: `Agent,

Before sending any traffic, read the material Desk 9 recovered in the Reality Viewer: ${places}. Reading is passive and does not pass through the connection, so the local intelligence cannot detect it.

Use this stage to note the staff names, the arguments on the forum, and which offices hold which records. You will need those details later, and any message you send to ask for them will be logged on the connection.

This directive closes when you have read at least three pages.${sign}`,
  };
}

export function firstFragment(w, m) {
  return {
    id: "14-2", from: OV, check: "saved-fragment", make: ["firstFragment", w, m],
    task: `Find a seed fragment and save it to Files. Start with ${m.siteName}.`,
    subject: "Directive 14-2: first fragment",
    body: `Agent,

Desk 9's initial survey noted ${m.docKind} on ${m.siteName}. In a reality of this age, the seed usually appears first in the oldest records the town holds. Look for a detail that is given more weight in the text than seems warranted.

When you locate the document, use the Save page function in the viewer. Saving writes a static copy to your local files which cannot be altered from the other side. Unsaved pages in the viewer remain on their system and can be changed at any time.

This directive closes when one of your saved documents holds a fragment.${sign}`,
  };
}

export const TRANSMISSION = {
  id: "14-3", from: OV, check: "credited:1",
  task: "Transmit the saved fragment from the HQ Console.",
  subject: "Directive 14-3: transmission",
  body: `Agent,

Open the HQ Console, select the saved document, and transmit it. If the document contains a valid fragment, the console will report RESONANCE.

Do not transmit saved pages at random to test them. Every transmission passes outbound through the connection and increases the likelihood that the local intelligence will register our presence.

This directive closes when the console reports resonance.${sign}`,
};

const CLUE_HINTS = {
  fond: "Staff usually choose the name of a pet or something else they are fond of, and the town forum keeps old threads going back some way.",
  default: "Small institutions often give every new account the same starting password, and not everyone changes theirs. Someone will usually have complained about it in a public post.",
  posted: "Staff often write passwords down near their terminals, and photographs of an office or front desk in a local publication sometimes show one.",
  scheme: "Starting passwords there were built to a fixed scheme from personal details. Someone on the forum has explained the scheme, and the details it uses are usually on public pages.",
};

export function loginDirective(id, anchor, m) {
  return {
    id, from: OV, check: `anchor:${anchor}`, make: ["loginDirective", id, anchor, m],
    task: `Get into ${m.siteName}'s restricted file (${m.docTitle}) and transmit its fragment.`,
    subject: `Directive ${id}: restricted holdings`,
    body: `Agent,

${m.siteName} holds a restricted document (${m.docKind}) which Desk 9 could index but not open. Accessing it requires a staff username and password.

The login page gives the format used for staff usernames. For the password, check the public pages first. ${CLUE_HINTS[m.clue]}

Note that login submissions pass through the connection whether they succeed or fail. Confirm the credentials before you enter them so that you do not make repeated attempts.

This directive closes when you transmit a fragment from the restricted file.${sign}`,
  };
}

export function recordsDirective(id, anchor, m) {
  return {
    id, from: OV, check: `anchor:${anchor}`, make: ["recordsDirective", id, anchor, m],
    task: `Find out which record to request, file ${m.formName} with ${m.officeName}, and transmit the fragment from the reply.`,
    subject: `Directive ${id}: records request`,
    body: `Agent,

Older records at ${m.officeName} are not held online, but copies are released on submission of ${m.formName}. Desk 9 does not have the reference for the specific record required. Check ${m.pointerSiteName} first, or contact a local resident who works with the holdings and give a plausible reason for the enquiry.

You will also need to state a reason for the request on ${m.formName} itself. Requests without one are less likely to be granted.

The office sends the requested record by email through the connection. If the reply is delayed, fails to arrive, or contains unexpected text, take that as an indication that the local intelligence is interfering with traffic.

This directive closes when you transmit a fragment from the reply.${sign}`,
  };
}

export function insiderDirective(id, anchor, m) {
  return {
    id, from: OV, check: `anchor:${anchor}`, make: ["insiderDirective", id, anchor, m],
    task: `Get ${m.keeperName} to send you ${m.docTitle}. They only send it to ${m.siteName} staff.`,
    subject: `Directive ${id}: internal circulation`,
    body: `Agent,

${m.keeperName} at ${m.siteName} holds an unpublished document (${m.docKind}) which Desk 9 believes contains a fragment. It is only sent out by internal email when requested by another member of ${m.siteName} staff.

To obtain it, you will need to log in as a colleague. The staff portal at ${m.siteName} gives access to that person's email account, and a request sent from an internal address will be treated as routine. ${CLUE_HINTS[m.clue]}

Keep your message brief, and do not use the account for anything else. Staff members usually notice if their account shows unfamiliar activity.

This directive closes when you transmit a fragment from the document.${sign}`,
  };
}

export const ADVISORY = {
  id: "14-A", from: "monitoring@canon-corps.gov", check: "poisoned",
  task: "Flood at least one document in the Scanner.",
  subject: "Advisory: the connection has been registered",
  body: `Agent,

Monitoring reports that the local intelligence has registered the connection.

From this point on, any data reaching your terminal, including incoming mail and viewer pages you have not saved,may have been modified in transit. Before relying on any document, load it into the Scanner and flood it. Altered sections will visibly shake under the flood. Be aware that repeated floods degrade the sample and make the reading less reliable.

This advisory closes when you have used the Scanner once.

Monitoring`,
};

export const INJECT_DIRECTIVE = {
  id: "14-6", from: OV, check: "injected",
  task: "Inject the reverse seed from the HQ Console.",
  subject: "Directive 14-6: injection",
  body: `Agent,

Desk 9 confirms that your accumulated resonance is sufficient for injection. The HQ Console is now offering injection.

Proceed with the reverse seed injection immediately. Waiting provides no operational advantage, and the local intelligence will continue to trace the connection whether or not you send further traffic.

This directive closes on injection.${sign}`,
};

// Re-render a saved world's directives from the current templates (worlds keep each directive's inputs in `make`).
const MAKERS = { orientation, firstFragment, loginDirective, recordsDirective, insiderDirective };
export function rerenderDirective(d) {
  if (d.make && MAKERS[d.make[0]]) return { ...d, ...MAKERS[d.make[0]](...d.make.slice(1)) };
  if (d.id === TRANSMISSION.id && d.subject === TRANSMISSION.subject) return { ...d, body: TRANSMISSION.body };
  return d;
}
