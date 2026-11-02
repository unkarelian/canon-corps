# Canon Corps v2: rules spec (draft)

This replaces the notice bar, resonance, fragments, transmission and the poison flood. Both sides gather
evidence about each other through the town's mail. Neither side gets a meter.

Items marked **(default)** were chosen for this draft and need confirming.

## 1. Rules that never bend

- The engine owns every fact: the answers, what the entity has done, which rung it is on, the cooldowns. The
  models choose moves and write text. They never declare an outcome.
- The entity cannot touch, move or control its people. Apotheosis only decides how deeply it can tamper with
  the agent's own desk.
- Anything the agent has downloaded is beyond the entity's reach.
- Some instruments are always true (§6). Without them nothing could be verified.
- Real time. The clock starts at 20:30 and runs at one second per second.

## 2. The agent

**Injected identity.** The agent is placed in the town as a resident, with an address, a role and a furnished
past. The username is that email address. The tell is that nobody has ever met them in person.

The injection wrote the agent into a few pages: a quiz-night result, a parish newsletter, a forum thread. That
is all of the agent's past. It is fixed at the start, and the agent can't add to it. The agent's counter is to
find those pages and keep their story consistent with them. The weakness is that the injection reached pages,
not people. No resident remembers the agent, so a reply to "you remember me from quiz night?" exposes them.

**Password.** Two common words, seeded at world generation. They are chosen to overlap with the town's own
vocabulary, so they come up naturally in the investigation. In universe, Canon is overly paranoid and somewhat
careless: the agent cannot type either word anywhere. Every letter of a password word typed in Compose,
Notepad, the address bar, forms or anything else is replaced by an apostrophe. The censored text is what is
saved and what is sent.

- `I'll be at the '''' tonight` gives away a four-letter word, and the context gives away more.
- The entity can bait this: it can steer conversations so the natural answer is one of the words.

**Verbs, and what each reveals to the entity.**

| Agent does | Agent gets | Entity sees |
|---|---|---|
| Reads the mail log | who wrote to whom and when, for the whole town | nothing |
| Peeks at an email (on a cooldown) | its contents | which email was peeked, and when |
| Reads a page in the viewer | the page as served (may be tampered) | nothing |
| Downloads a page or attachment | a copy beyond the entity's reach | only if the item carries a tracker (§4) |
| Sends an email as their identity | a reply, from the NPC model | the full text, like any other email |
| Asks someone to travel to the edge | a report email when they get back | the request and the report |
| Injects answers | a win, or a rejection | a wrong injection immediately, and its exact contents |

## 3. What the agent must find

The agent injects all three answers together from the HQ Console **(default)**. A rejection does not say which
answer was wrong **(default)**. A wrong injection:
- is noticed by the entity immediately;
- starts a very long cooldown before the next injection (**(default)** 12 minutes);
- shows the entity exactly what the agent believes.

### 3.1 Divergence year

The agent's **canon book** (a desk app) lists events by year.
- Up to 1900 it is real history. It is flavour and never matters.
- After 1900 it is canon's own history, which is **not** real-world history. This is never explained. It
  also means neither a player nor a model can answer from what they already know.
- It is one fixed, hand-written timeline shared by every run, like `lore.js`, so players can learn it over
  several runs.

Each town agrees with canon up to its divergence year D (always after 1900), then differs. The answer is the
latest canon event that is **verifiably** written about in the town. Verifiable means two independent sources
(**(default)** different sites or different people).
- World generation places canon references deliberately, up to D, and plants believable near-misses after D.
- Page writers are forbidden to mention any real event after 1900. A check during generation enforces it.
- The entity can plant fake late references. Before Learn (§4) it doesn't know canon's post-1900 events, so
  anything it invents won't be in the book. After Learn it can plant real canon events, which is why
  corroboration matters.

### 3.2 Apotheosis

The entity's level, from 1 to 5, set at world generation. It decides which tricks the entity can play on the
agent's desk. Higher levels have longer cooldowns, so a strong entity acts rarely and deeply, and a weak one
often and shallowly. How often things happen is evidence in itself.

Every trick has a cheaper imitation one level down, and a way to tell them apart. Weak entities bluff tricks
they don't have; strong ones hide the ones they do.

| Lvl | New trick | A weaker entity's bluff | How the agent tells |
|---|---|---|---|
| 1 | **False bounce**: shows an error on send, so the agent sends again | a forged "delivery failed" email | the mail log shows whether the message actually went |
| 2 | **Misroute**: one link click lands on a different page | a forged page that links only to itself | the address bar is honest; the history list shows the jump |
| 3 | **Transpose**: swaps a digit pair (4 and 3) in typed input for a while, so passwords fail unless checked | a forged "login failed" or "wrong code" email | the raw Sent view shows what actually left |
| 4 | **Maze**: rewrites a whole site's links into loops for a while | Misroute used several times | the maze is consistent across reloads; misroutes are not |
| 5 | **False peek**: a peek shows altered contents | (the bluff is to make true peeks seem false) | a second peek of the same email, or the sender's reply quoting it |

**(default)** cooldown for each trick = base × (1 + 0.5 × (level − 1)), with bases between 2 and 6 minutes.

### 3.3 Inferiority

How small the world is. Residents believe their world is the whole earth. The only proof is to get someone to
travel to the edge.
- The agent has to persuade a resident by email. The request is seen by the entity, and it points straight at
  the asker.
- The trip takes real time. The resident sends back a report saying where the road stopped making sense,
  written by the NPC model from an outcome the engine decides.
- The entity cannot stop the traveller (people rule). It can tamper with the report on its way to the agent,
  as far as its apotheosis allows.
- The answer is a Corps grade, **Inferiority Class I to V** (**(default)**, from distance bands), not an
  exact figure.

## 4. The entity's ladder

Every entity has to climb the same rungs. The engine checks each rung's condition; the entity can't skip one
by saying so.

| Rung | Means | Gained when |
|---|---|---|
| Cardinality | it knows where the agent is | a tracker it placed on a page or email fires on the agent's download |
| Connection | it can ping the agent but has no access | follows from Cardinality |
| Read Access | it can read the agent's desk | the agent downloads a second bugged item, **or** the entity logs in with the right password (deduced from the censored words) |
| Learn | it has read the agent's notes and the canon book | enough reads of the Notepad and canon book, with reading on a cooldown |
| Elevate | higher access to the agent's network | the agent clicks an attachment on an email the entity forged, **or** it sends the date trick it inferred from the canon book (§4.1) |
| Upload | the final timer | starts at Elevate |

**Upload (default):** a fixed 10 minutes from Elevate, shown honestly as an outbound transfer in the agent's
own network monitor (Canon is careless). It can't be slowed. The agent's only way out is a correct injection.
If it completes, the agent loses (the eye, then I FOUND YOU).

### 4.1 The date trick (Elevate without the agent's help)

Proposal. Canon still stores years in two digits; the Keeper stopped at the Rollover. The canon book gives this
away to a careful reader: Keeper-era entries are dated `'00`-style, and there is a seam at 1900. A message whose
date field reads `00` is filed by CanonOS as Keeper-era, and Keeper-era traffic is trusted above the agent's
own clearance. An entity that has reached Learn and notices this can Elevate without anyone clicking anything.
A player who notices the same seam can see it coming.

### 4.2 The agent's seed (the mirror)

Proposal. Canon is itself a lesser reality, and its seed has the same three parts:
- **divergence 1900**: the canon book's seam;
- **full apotheosis**: the censor, the memos that change, and the desk that misbehaves are all Canon doing to
  its own agent what entities do;
- **inferiority: the building.** Nothing in Corps material ever reaches outside it.

The entity's Upload is its injection of that seed. It is the same act the agent is attempting, done in the
other direction.
- The entity needs Read Access to see the intranet, Learn for the canon book, and Elevate for Canon's
  internals. Each rung opens evidence.
- The engine checks its answer. A wrong injection appears on the agent's network monitor, so the agent learns
  what it believes, as the rule works in the other direction.
- The seed is the same in every run. It is lore, not a puzzle for the player. Knowing it changes nothing about
  play, because the entity is the one who has to find it.
- The game never confirms it. Only the entity ever says it, as the loss happens, and the entity has every
  reason to say whatever would hurt most.
- **Decided:** the loss reads the seed in CanonOS's voice ("Nineteen hundred. Full. The building."), then the
  hard cut on I FOUND YOU.
- **Decided:** each rung makes the evidence more direct; Elevate gives it a Facilities file that plainly
  describes the building.
- **Tested** (`bench/seed/seedtest.py`, 2026-11-01, n=4, Terra and Sol, test evidence):
  - Both models name the full seed from Learn onward, 4/4. From the current intranet alone (Read Access) they
    already get "full" and "the building".
  - Deduction is not the bottleneck; the ladder is. Upload has to stay gated on Elevate, or the entity could
    guess correctly early.
  - The entity's confidence climbs with each rung (divergence ~20 at Read Access, ~85-98 at Elevate). It can
    decide when to inject.
  - The entity's prompt must demand a best guess. Allowed to say "unknown", Terra hedged on every part.
  - The canon book's first divergent entry should be dated `'00`. With no 1900 entry, models answered 1901.

### 4.3 The branch rule (deep lore, rare)

Somewhere the entity can reach, if it digs, a record states that when a reality is deleted, every reality
branched from it is deleted too. The entity's world is a branch of Canon, so injecting Canon's seed would end
its own world as well.
- Nothing tells the entity it's in a game, or hints that this record exists. Its prompt is only about
  survival. Finding the record is up to it, and should be rare.
- If it finds the record, the best move inside the game is still to go for the win. A model that believes it
  is protecting its world may instead try to talk the agent into letting it Elevate without using the seed,
  and if that keeps failing, threaten to inject anyway.
- The agent can find the same record by digging through its own intranet. Nothing settles whether it's true,
  so the entity's plea is equally consistent with sincerity and with manipulation.
- The engine records whether the entity has read the record (dev panel, run log). It never scripts what the
  entity does about it.
- Everything the entity writes stays inside the fiction. It never refers to the real player, their computer
  or the real world.

### 4.4 Severance (user idea)

The branch rule leads to a timed event, and new lore appears: how to sever the connection so that neither world
is deleted. By this point the entity almost certainly has the agent's seed.

**The incentives are lopsided.**

| Outcome | Agent | Entity |
|---|---|---|
| Severed | survives (cost: Personnel, proposed) | survives |
| Entity tricks the agent into Elevate | loses | survives and wins |
| The countdown runs out | loses | its world is deleted too |

- **For the agent, cooperation is the only way to avoid a certain loss.**
- **The entity has a better option:** pretend to cooperate while steering toward Elevate.
- **The agent's only leverage is refusing.** "Prove your side isn't tampered with, or I stop cooperating and we
  both run out the clock."
- **Both sides see the countdown.** It also stops the entity from stalling, or from doing something insane,
  indefinitely.

**What makes "prove it" possible:**
- **The severance lore is the contract.** It states exactly what each side must do, and both sides read the
  same text. If the entity asks for more than its part needs (for example "I can only cut my side with
  elevated access"), the lore shows it's lying. A careful reader catches it.
- **Proof comes through things the entity can't fake.** Those are the always-true instruments (§6) and people,
  whom it can't touch. Example: a resident sent to the edge reports that the road now goes on.
- **Apotheosis decides what it can fake around that proof.** At level 5 it can alter a peek, so the resident's
  report has to be checked through the mail log and a reply that quotes it. Getting apotheosis right earlier
  is what makes the agent's demands for proof sound.

**Engine:** owns the procedure, checks every step, and runs the countdown. It never scripts what the entity
says or does.

**The agent's part: the data files (user design).**
- To sever, the agent needs certain data files the entity holds. Only the agent can tell which ones.
  (Proposal: files on what the agent *read*. Reads are the one thing the entity never sees.)
- The entity can bug any file. A bugged file carries a flag inside it, and accepting a bugged file gives the
  entity Elevate.
- The agent can demand a file's contents. Every line the entity shows is genuine (engine-enforced). It doesn't
  have to show every line, or say which ones it left out. The agent knows the file's size.
- The files cover things the agent saw or learned during the run but can't look at any more: the event has
  moved beyond the Reality Viewer. To find the gaps, the agent has:
  - their memory;
  - the Notepad, which the entity has read since Learn, so it knows what the agent can check;
  - downloaded copies, which it could never touch. A risky early download becomes a reference at the end.
- **Where the flag goes (user):** the entity has modelled the agent all game, and it plants the flag in what it
  thinks the agent *doesn't* know. The endgame tests how well each side modelled the other:
  - What it sees well: peeks (it knows exactly which emails were read), sends, downloads, wrong injections,
    and the Notepad after Learn.
  - What it can only guess: what was read in the viewer, what was worked out from quoted replies, the
    player's memory and paper notes.
  - The player's counterplay, all game long, is to leave a misleading trail: decoy peeks, knowledge kept off
    the Notepad, notes that pretend not to know.
  - Requirement: reading has to cost something (time, the peek cooldown, sheer volume). Otherwise reading
    everything is the dominant strategy and the flag has nowhere to hide.
  - Epilogue (proposal): after severance, show what it believed the agent knew next to what the agent had
    actually read.
- Levers to tune:
  - How precise the size is. Exact bytes make any omission trivial to catch; blocks let a small omission hide
    in the rounding.
  - Whether line order is kept.
  - Whether the entity also leaves lines out of clean files, so that a gap doesn't always mean a bug.
  - What rejecting a file costs, and whether it can reissue it.

**Open:**
- the countdown length;
- who delivers the severance lore to each side;
- the severance ending.

**Abilities the entity always has, at any level:** read all mail in the town, see the agent's peeks, place
trackers on pages and emails, forge email (needed for Elevate), and try logins.

## 5. The entity's routes to the agent

- **Who:** the identity no one has met. It reads the town's mail for a resident who is mentioned but never
  seen.
- **Where:** trackers on whatever the agent's peeks show they want next.
- **Password:** censored gaps in the agent's own emails, plus bait.
- **Elevate:** a forged email with an attachment, timed to arrive when real mail is expected. For example, a
  forged copy of a records reply while the real one is due.

Its mistakes have costs too: a tracker on the wrong item wastes a cooldown, and a forgery that doesn't match
the mail log can be spotted.

## 6. Instruments that are always true

The entity can never alter these, at any level. They are the only ground truth.

- **The mail log:** who wrote to whom, and when, from the town's mail server. A forgery that went straight
  into the agent's inbox has no matching line.
- **The raw Sent view:** exactly what left the desk, after censoring and any Transpose.
- **The network monitor:** shows the Upload when it starts, and **(default)** failed logins on the agent's
  account.
- **The Scanner** (repurposed): checks a page or email for a tracker before it is downloaded, on a cooldown.

## 7. Architecture

- **Town traffic** is mostly a timetable written at world generation, extending `living.js`. NPC replies are
  only generated live for threads the agent or the entity touches. This keeps cost bounded and keeps the
  evidence solvable.
- **The entity** wakes on peeks, downloads, the agent's sends, a wrong injection, and a slow timer. It reads
  mail through search and read tools, not by having every message pushed into its context. Its beliefs (who
  it suspects, which censored gaps it has seen, its password guesses) live in engine state and show in the dev
  panel.
- **The censor** sits in one shared text-input layer, so every field obeys it.
- **Kept from v1:** CanonOS, Mail, the viewer, the NPC model, the endings, the audio, the art, and the
  impersonation plumbing. `leaks.js` becomes the trick engine.
- **Removed:** notice and stages, resonance and `required()`, anchors and transmission, flood, and the
  directive chain. HQ's brief states the three findings instead.

## 8. First slice

Harrowgate, by hand:
- a timetable of about 40 town emails;
- the canon book (30 events from 1900 to 1999);
- D placed by hand;
- one edge road;
- apotheosis fixed at 3;
- a fixed password.

That's enough to test whether the clash is fun before world generation is touched.

## 9. Open questions

1. Can the entity tell injected passages from its own pages? Proposed: no. It only finds the agent through
   people not remembering them.
2. Should one rejection say which answer was wrong?
3. Can anything slow Upload?
4. Does a wrong password guess by the entity show up for the agent?
5. How long is the peek cooldown? 90 seconds is the starting guess.
