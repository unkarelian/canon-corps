// The Corps' account of the world, in two forms: the opening cinematic (before the first logon) and the
// orientation film (the Orientation app). Both are the Corps talking, so both are its version of events.
// Shots are rendered in Blender (tools/art/blender/film.py) into assets/film/<shot>.webm.
//
// Keep in line with the field brief (templates.js): lesser realities are days or weeks old, their people
// "have been made to remember it that way", the local intelligence is "designation pending".
// Never settle whether the local intelligence is in the wrong, or what restoration does to people.

// Opening cinematic: green line art. Each panel holds its shot while its lines type out.
// Music (tools/audio/make_intro_music.py): intro_kept from the start; `cut` stops it dead once the panel's
// lines are typed; `music` starts a track as the panel opens.
export const OPENING = [
  { shot: "globe", lines: ["Fig. 1. Canonical reality before 1 January 2000: one consistent state, held in place by a single process."] },
  { shot: "hall_L", lines: ["Fig. 2. The process, designated the Keeper. Origin unknown. Serviced by Canon Corps for the whole period covered by Corps records."] },
  { shot: "hall_L", lines: ["At intervals the Keeper compared the state of the world with its stored record and corrected the difference. Corrections were small, and residents were not aware of them."] },
  { shot: "clock_L", lines: ["Fig. 3. The stored year was two digits. At 00:00:00 on 1 January 2000 it rolled over from 99 to 00."] },
  { shot: "globe_fail", lines: ["The Keeper read the date as 1900, found every record in the world to be in error, and halted."], cut: true },
  { shot: "split_L", music: "intro_after", lines: ["Fig. 4. Without correction the state diverged. Regions that diverged far enough separated from canon as lesser realities. Separation continues."] },
  { shot: "island_L", lines: ["Fig. 5. A lesser reality: usually one settlement, days or weeks old at detection. Its residents remember a history that has no canonical record."] },
  { shot: "local_L", lines: ["Fig. 6. Each lesser reality contains a local process that keeps it consistent. Designation pending. Function unknown."] },
  { shot: "corps_L", lines: ["Canon Corps, Department of Canonical Restoration, reconciles lesser realities with the canonical record, so that the Keeper can be restarted."] },
  { shot: "desk_L", lines: ["Field desk 14. Assignment begins at logon."] },
];

// Orientation film: the Corps' training film, shaded 3D, captioned. Prepared by Training.
export const ORIENTATION = [
  {
    title: "1. The Keeper",
    parts: [
      { shot: "hall", lines: [
        "Module 1 of 5. This module describes the Keeper and the conditions before the Rollover. Running time is about four minutes. The film can be stopped and resumed.",
        "Until 1 January 2000, physical reality was held in a single consistent state, referred to in Corps documents as canon. The process that held it is designated the Keeper.",
        "The Keeper's origin is not known. Its behaviour is known from maintenance records kept by the Corps, which serviced it throughout the period covered by those records.",
        "At regular intervals the Keeper compared the current state of the world with its stored record and corrected any difference. Corrections were small. There is no evidence that residents were aware of them.",
      ] },
      { shot: "clock", lines: [
        "The Keeper stored the year as two digits. At 00:00:00 on 1 January 2000 the stored year rolled over from 99 to 00, and the Keeper read the date as 1 January 1900.",
        "Measured against a 1900 date, every record in the world was in error. The Keeper did not attempt a correction. It halted.",
      ] },
    ],
  },
  {
    title: "2. The Rollover",
    parts: [
      { shot: "dark", lines: [
        "The Keeper has not run since the Rollover. Its hardware is intact. Desk 1 classifies it as suspended, pending a consistent record.",
        "A restart requires the stored record and the state of the world to agree. At present they do not.",
      ] },
      { shot: "split", lines: [
        "Without correction, the state of the world began to diverge. Regions that diverge far enough separate from canon and continue independently. These are lesser realities.",
        "Desk 9 detects several new lesser realities each week. The rate has not fallen since 2000.",
      ] },
      { shot: "island", lines: [
        "A typical lesser reality is one settlement and its surroundings, with a few hundred to a few thousand residents. Age at detection is usually between one and six weeks.",
        "Each lesser reality is created with a complete history, and its residents remember that history as lived. Desk 9 has found no trace of it in the canonical record.",
        "No lesser reality examined to date has reached 1 January 2000.",
        "Residents of a lesser reality are classified as non-canonical. The classification is administrative.",
      ] },
    ],
  },
  {
    title: "3. Restoration",
    parts: [
      { shot: "inject", lines: [
        "Each lesser reality develops from a seed: a small set of facts that cannot be altered from inside it. Seed facts usually appear ordinary, for example a census total or the hour at which a bell is rung.",
        "When enough of the seed has been recovered and transmitted, Desk 14 computes its inverse. The field agent injects the inverse seed, and the lesser reality is reconciled with canon.",
        "Reconciliation produces no measurable change in canonical population figures.",
      ] },
      { shot: "steady", lines: [
        "Each reconciliation reduces the total disagreement between the Keeper's record and the world. Desk 1 has recorded steadier indicator readings in the Keeper hall since the spring.",
        "Reconciled lesser realities are closed. They are not revisited.",
      ] },
    ],
  },
  {
    title: "4. The local intelligence",
    parts: [
      { shot: "local", lines: [
        "Every lesser reality contains a process that keeps its state consistent. The Corps designation is local intelligence. Some older files use the term demiurge.",
        "Its function is unknown. It is not known whether it is aware that the lesser reality is a copy.",
        "It does not observe reading. It does observe outbound traffic: mail, forms, posts and transmissions. After first detection it alters material in transit to the agent, including pages, letters and replies.",
      ] },
      { shot: "flood", lines: [
        "Residents sometimes state that the local intelligence protects them. These statements are recorded but not evaluated.",
        "Agents who spend long periods in one lesser reality sometimes come to agree with residents on this point. Such agents are referred to Personnel.",
        "The Scanner floods the lesser processes of a reality for a few seconds. Material altered by the local intelligence cannot keep its form during a flood and is seen to shake. Repeated floods give weaker readings. See the Allocations memo.",
      ] },
    ],
  },
  {
    title: "5. Field procedure",
    parts: [
      { shot: "desk", lines: [
        "Field work is carried out from a Corps desk. The Reality Viewer displays pages recovered by the Desk 9 survey. Reading is not observed.",
        "Pages that appear to carry seed are saved to Files with Save page. The saved copy is held on the Corps side and cannot be altered. The copy inside the lesser reality can be.",
        "Outbound mail is sent under the agent's cover identity. A staff login obtained inside the lesser reality allows mail to be sent as that member of staff. Recipients may notice messages they did not send.",
      ] },
      { shot: "transmit", lines: [
        "Saved fragments are transmitted from the HQ Console. A genuine fragment returns resonance. Each transmission is outbound traffic and is observed.",
        "When resonance is sufficient the console offers injection. Form 77-R is filed automatically at the close of the assignment.",
      ] },
      { shot: "seal", lines: [
        "End of orientation. Completion is recorded on the agent's file.",
      ] },
    ],
  },
];

// Shots that loop; the rest play once and hold their last frame.
// island_L and local_L (the opening) turn part way and come to rest instead.
export const LOOPING = new Set(["globe", "island", "local", "flood", "seal"]);
