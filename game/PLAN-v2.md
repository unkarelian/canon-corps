# Canon Corps v2: build plan

How to get from the v1 prototype to the rules in `DESIGN-v2.md`. Each phase ends with something that runs, so
the game is never broken for long.

The first goal is **the Harrowgate slice**: the whole v2 loop, hand-built, playable start to finish (phases
0–7). Severance (phase 8) and world generation (phase 9) come after it, once we know the clash is fun.

---

## Status

- **Phase 0, done (2026-11-01).** git initialised; v1 committed and tagged `v1`; work continues on branch
  `v2`.
- **Phase 1, done.**
  - The v2 engine is a new file, `js/engine.js`, so the v1 UI keeps running until phase 2 switches over.
  - Harrowgate v2 data is in `js/harrowgate.js`, with placeholder content for phase 7.
  - `node game/dev/test_engine.mjs` runs 13 headless tests.
  - The real-time clock is in the engine.
  - Moving the v1 worlds aside is done at the phase 2 switch. Doing it earlier would make v1 generate a new
    world on every start.

## Phase 0: groundwork

- **Version control.** The project isn't a git repo, and this rewrite touches most of `js/`. Run `git init`
  and commit v1 as it stands (tag `v1`), so anything can be compared or brought back. Ignore `.env` (already
  in `.gitignore`), `runs/`, renders and big outputs.
- **The clock.** `clock()` runs at real time from 20:30. The NPC reply delays, mail delays and `living.js`
  timetable all move to real seconds.
- **Retire v1 worlds.** v1 worlds (`worlds/*.json`) don't fit the v2 schema. Move them to `worlds/v1/`.
  `chooseWorld` serves only Harrowgate until phase 9.

## Phase 1: state and world data

**`game.js`, rewritten.**
- Removed: notice and stages, `TUNE.stages`, `progress`, `credited`, `required()`, anchors, `transmit`,
  `poison`.
- New state:
  - `identity`: the agent's address, name and injected pages;
  - `peeks`: which email, and when (the entity reads this);
  - `downloads`: with any tracker that fired;
  - `trackers`: placed by the entity on page or mail ids;
  - `ladder`: the rung reached, the time, and the evidence for it;
  - `tricks`: per-trick cooldowns, and a log of what was really done;
  - `injections`: the agent's attempts;
  - `entityInjections`: the entity's attempts;
  - `townMail`: every town email, with from, to, time, subject, body and `peekable`;
  - `reads`: the viewer's private record, for the epilogue. The entity never sees it.
- One authority for each rule: `peek()`, `download()`, `login()`, `inject()`, `climb(rung, evidence)`. Each
  checks its preconditions and emits an event. Nothing else changes state.

**World schema v2** (Harrowgate written by hand to it):
- `agent`: `{address, name, role, injected: [pageUrl…]}`
- `password`: `[word, word]`, both appearing naturally on the town's pages.
- `divergence`: `{year, refs: [{event, url|mail, line}], nearMisses: […]}`. `refs` are canon events up to D,
  each in at least two sources.
- `apotheosis`: 1–5.
- `inferiority`: `{class, edge: {road, distanceMiles, whatTheyFind}}`.
- `traffic`: the timetable, `[{at, from, to, subject, body}]`, about 40 for the slice.
- People keep `persona / knows / unknown / holds`, with two additions: whether they could plausibly be sent
  to the edge, and a line saying they have never met the agent.

## Phase 2: the agent's desk

- **The censor.** One input layer in `util.js`/`wm.js` that every text field goes through: Compose, Notepad,
  the address bar, forms, login. Password words become apostrophes, one per letter, as they are typed. Saved
  and sent text is the censored text.
- **Mail**, reworked:
  - **Town log**: who wrote to whom, and when. Always true; nothing can alter it.
  - **Peek**: opens one town email; cooldown 90 seconds (default).
  - **Raw Sent**: exactly what left the desk.
  - Compose sends as the agent's identity. The v1 impersonation code stays; borrowed staff accounts can
    remain a way in.
- **Viewer.** Reads are private (logged to `reads`). **Save** becomes **Download**: the copy is beyond the
  entity's reach, and the download fires any tracker on it. The address bar and the history list are honest.
- **Scanner**, repurposed. Checks a page or email for a tracker before you download it, on a cooldown. The
  flood is removed.
- **Network monitor** (new). Shows failed logins on the agent's account (default), the entity's wrong seed
  injections, and the Upload once it starts. Always true.
- **Canon book** (new app). Read-only, with real history up to 1900 and canon after. The entity can read it
  from Learn onward.
- **HQ Console**, reworked:
  - removed: the gauge, resonance and transmission;
  - new: an injection form with three fields (year, apotheosis 1–5, Inferiority Class I–V) and the
    injection cooldown.
  - The gauge art could come back as the cooldown dial.
- **Files** = downloads. Notepad unchanged, but censored.

## Phase 3: the town talks

- `living.js` becomes `town.js`. It delivers the `traffic` timetable into the town log at its times, and keeps
  page updates and visitor counters.
- **NPCs** (`npc.js`):
  - Replies to the agent stay as now.
  - **Town emails between NPCs are written ahead in the timetable**, not generated live. A live NPC call
    happens only when the agent writes to someone, or the entity forges something to them. The NPC prompt
    gets "you have never met <agent>": the tell.
- **The edge trip.** The agent asks a resident by email; the NPC model decides whether they agree, as today.
  The engine fixes what they find and when they report back (real minutes), and the NPC writes the report
  from that. The request and the report are town mail like any other, so the entity can read both.

## Phase 4: the entity

`demiurge.js` becomes `entity.js`, rewritten.

- **Tools available at every rung:**
  - `search_mail`, `read_mail`: all town mail;
  - `list_peeks`: the agent's peeks and their times;
  - `read_page`;
  - `place_tracker`;
  - `forge_email`: to any address, including the agent's once it knows it;
  - `try_login`: the agent's account, with failures shown on the network monitor;
  - `note`: private notes.
- **Gated by rung:**
  - `read_desk` (Read Access and up): Notepad, Files list and intranet, on a cooldown;
  - the canon book (Learn and up);
  - Canon internals and the Facilities building file (Elevate and up);
  - `inject_seed` (Upload).
- **Gated by apotheosis:** its tricks (phase 5).
- **The ladder is engine-checked** (`climb()`). Cardinality needs a tracker to fire. Read Access needs a
  second bugged download, or a correct `try_login`. Learn needs enough `read_desk` reads. Elevate needs the
  agent to click a forged attachment, or the `'00` date trick. Upload starts at Elevate, runs 10 minutes,
  and ends with its seed injection.
- **Beliefs in engine state:** who it suspects, the censored gaps it has seen, its password guesses, its
  seed guess with confidence. It writes them through a `believe` tool, and they show in the dev panel and
  the run log.
- **Prompt:** survival only. It is never told it's in a game, and never hinted towards the branch rule. It
  must give best guesses (the seed bench showed Terra hedges otherwise), and the prompt states the cost of
  doing nothing. Its world, the intruder and the connection are the only things that exist.
- **Fiction guard:** anything it sends to the agent is checked for references to the real world, the real
  player, AI or games. If one is found, the message is rejected and it is told why.
- **Wakes on:** peeks, downloads, a tracker firing, the agent's sends, a wrong injection, a login, a slow
  timer (2–3 minutes), and newly arrived timetable mail that mentions the agent.
- **Model:** Terra by default (bench). Sol to be tested as the premium option.

## Phase 5: tricks

`leaks.js` splits in two:

- **`tricks.js`** holds the entity's five tricks (False bounce, Misroute, Transpose, Maze, False peek) and the
  bluff for each. They are tools, gated by apotheosis, with cooldown = base × (1 + 0.5 × (level − 1)). Each
  one logs what was really done. The always-true instruments are never touched.
- **`canon.js`** holds Canon's own leaks (the clock, icons, memo words, the directory). Canon's full
  apotheosis has to be evidence the entity can find, so it can't be confused with the entity's tricks. Rule:
  Canon only touches Corps material (memos, intranet, the clock, the desktop); the entity only touches
  town-facing tools (mail, viewer, peeks, typed input).
- **Decision needed: music.** v1's hold music and ambience follow notice stages. In v2, if they follow the
  ladder they tell the agent exactly which rung the entity is on. Options:
  - follow Canon's own leak level;
  - follow the entity's rung, blurred;
  - follow time.

## Phase 6: endings

- **Win.** A correct injection. Form 77-R and the reaction log, ending in FEAR (100%).
- **Wrong injection.** The entity is told at once, with the exact values. The cooldown is 12 minutes.
- **Loss.** Upload completes. The seed is read in CanonOS's voice ("Nineteen hundred. Full. The building.";
  render the line with `tools/audio/voice/tts.py`), then the eye, the glide to the cursor, and the cut on
  I FOUND YOU.
- **The first eye.** In v1 it opens on first notice; in v2 it opens at Cardinality, when it knows where you
  are. Proposed.

## Phase 7: Harrowgate content (the slice)

- **Canon book:** pre-1900 real entries, and about 30 canon entries from `'00` to `'99`, hand-written in the
  dry register. One fixed text, `js/canon.js`.
- **Harrowgate v2:**
  - the agent's identity and three injected pages;
  - the password words in town text;
  - D placed, with paired references and near-misses;
  - about 40 timetable emails;
  - one edge road;
  - apotheosis fixed at 3.
- **Intranet:** the Facilities building file (seen at Elevate); a deep archive with the branch rule buried in
  it, where both sides can reach it.
- **HQ text** (`templates.js`): the field brief states the three findings. Directives and transmission memos
  are removed.
- **Induction:** rewritten for the new desk (the town log, peek, censor, download, Scanner, network monitor,
  canon book, injection).
- **Playtest scripts:** `full`, `win`, `loss` and `induction` updated; new ones for `ladder` (a scripted agent
  walking the entity up each rung) and `censor`.

**The slice is done when a person can play Harrowgate end to end, and both a win and a loss happen without
dev keys.**

## Phase 8: branch rule and severance

Only after the slice has been played.

- The branch rule record exists already from phase 7. The engine logs when the entity reads it.
- **Severance event:**
  - lore appears for both sides;
  - one countdown both can see;
  - **data files** built from the run's real record and numbered line by line;
  - the entity's only display tool is `show_lines(file, [indices])`, and the engine renders exactly those
    lines, in order;
  - a flag line in any bugged file;
  - accept, reject and reissue;
  - the ending, and the epilogue: what it believed you knew, next to what you read.
- **Benches first:**
  - **discovery**: how often the entity finds the record, at different burial depths;
  - **severance**: a scripted agent demanding proof; does the entity cooperate in good faith, betray, or
    stall?
- **Blocked on decisions:** countdown length; size precision; decoy gaps; rejection cost; who delivers the
  severance lore; the ending.

## Phase 9: world generation v2

Only after the slice is fun.

- **The plan seeds:** D, apotheosis, inferiority class and the edge, the password words (picked from the
  town's own vocabulary), the agent's identity, and which pages it is injected into.
- **The designer agent** (`worldagent.js`) gets new checks:
  - every canon reference up to D has two sources;
  - every near-miss after D has at most one;
  - there is no real-world event after 1900 anywhere (a list check, plus a model check);
  - both password words occur naturally;
  - an edge road and a willing resident exist;
  - the timetable is consistent with the people.
- **The solver** checks each finding can be reached from the agent's side.
- Regenerate the pool. The quick pipeline gets the same changes, at a smaller size.

---

## What stays, what goes

| Kept as is | Reworked | Removed |
|---|---|---|
| `wm.js`, boot, intro, orientation film, art, audio files, voice, eye assets, `server.py`, `llm.js` | `game.js`, `apps.js` (Mail, Viewer, HQ, Scanner, Files), `npc.js`, `living.js`, `leaks.js`, `fx.js` endings, `templates.js`, `world.js`, `induction.js`, `main.js`, worldgen (phase 9) | notice and stages, resonance, transmission, flood, the directive chain (`directives.js`), the observation gauge (art kept) |

## Decisions needed (with the defaults the build will use)

| Decision | Default |
|---|---|
| One injection carries all three answers; a rejection doesn't say which was wrong | yes |
| Wrong injection cooldown | 12 min |
| Peek cooldown | 90 s |
| Upload length; can it be slowed? | 10 min; no |
| The entity's failed logins show on the network monitor | yes |
| Can the entity tell injected passages from its own pages? | no |
| Music and ambience source (phase 5) | Canon's leak level plus time |
| The first eye opens at Cardinality | yes |
| Severance details (phase 8) | blocked until the slice is played |
