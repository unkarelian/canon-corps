# Canon Corps: playable prototype (v2)

A browser prototype of v2 (`DESIGN-v2.md` holds the rules, `PLAN-v2.md` the build plan and its status). There is no
notice bar and no resonance. Two sides gather evidence about each other through a town's mail:

- **The agent** works out three facts about the reality: the **divergence year** (the latest canon event the town
  verifiably records, checked against the Canon Reference), the local intelligence's **apotheosis** (how deeply it
  can interfere with the desk), and its **inferiority** (how small it is, which only a resident who drives to the
  edge can show). All three are injected together from the HQ Console.
- **The entity** (a real tool-using agent) climbs a ladder towards the agent: Cardinality, Connection, Read Access,
  Learn, Elevate, Upload. It sees every email in town and which ones the agent peeks at, but never what the agent
  reads. When its Upload completes with the agent's own world named rightly, the agent loses.

v1 is tagged `v1` in git.

## Run it

```
python3 game/server.py        # reads OPENROUTER_API_KEY from ./.env
```

Open http://localhost:8077. Add `?nosplash` to skip the boot, cinematic and logon.

Which reality you get: the newest unplayed v2 world in `game/worlds/` (files with `"schema": 2`), else the
hand-built HARROWGATE. `?world=harrowgate` or `?world=<id>` picks one. v1 worlds are kept in `worlds/v1/` and are
not playable in v2.

Press <kbd>`</kbd> for the dev panel: the answers, the password, the entity's rung, what it believes (suspect,
password guess, seed guess), its tricks and last wakes, and the model spend. With the panel open, <kbd>[</kbd>
climbs the entity one rung and <kbd>]</kbd> wakes it.

Costs: the entity is woken by peeks, downloads, logins, forms, posts, a wrong injection and a slow idle timer
(`ETUNE.idleWakeSec`, 210 s). A wake is about 3 cents (GPT-6.1 Terra, medium). The live test of five wakes plus NPC
replies cost 17 cents. A long run can cost a dollar or more; see `PLAN-v2.md`.

## Tests

```
node game/dev/test_engine.mjs       # the rules, headless: censor, peeks, trackers, ladder, injection, Upload
node game/dev/test_severance.mjs    # severance, headless
node game/dev/playtest.mjs v2look <out>     # the desk in headless Chromium, screenshots, no model calls
node game/dev/playtest.mjs ends <out>       # every ending, screenshots
node game/dev/playtest.mjs v2live <out>     # the entity with real models, rung by rung (cents)
node game/dev/playtest.mjs v2sever <out>    # severance and the edge trip with real models (cents)
```

Prefix `WORLD=<id>` to run a playtest on a pool world. v1 playtest scripts are in `dev/scripts/v1/` and do not run on v2.

## The desk (v2)

| App | What it does | Can the entity tamper with it? |
|---|---|---|
| Mail: Canon Corps | HQ's memos: the field brief (the three findings, the agent's identity and credential words), Monitoring's notice | no (Canon's own leaks can change a word) |
| Mail: Inbox | mail to the agent's identity; attachments can be opened or downloaded | forgeries arrive here, with no line in the town log |
| Mail: Town log | every message in town: from, to, subject, time. **Peek** opens one (90 s cooldown); the entity sees every peek | never |
| Mail: Sent (raw) | exactly what left the desk, after the censor and any Transpose | never |
| Reality Viewer | pages; reading is private. **Download** fixes a copy in Files and fires any mark on it. **History** shows where each click really went | link clicks can be misrouted or mazed; the address bar and History cannot |
| Scanner | checks a page you have read, or a message, for a mark (120 s cooldown) | never |
| HQ Console | the three-answer injection (12 min lock after a wrong one) and the network monitor (failed logins on your account, the entity's wrong seed guesses, the Upload) | never |
| Canon Reference | real history to 1900, canon's own after (`js/canon.js`, one fixed text) | never |
| Notepad, Intranet, Orientation | as v1; the intranet now has an archive (`/archive`) | the entity can read the Notepad and intranet from Read Access |

**The censor** (`engine.censor`, applied by one input layer in `main.js`): the agent's two credential words become
apostrophes, letter for letter, as each word is finished, in every field. Sent and saved text is the censored text.

**Tricks** (`js/tricks.js`), by apotheosis: 1 False bounce, 2 Misroute, 3 Transpose (3 and 4 swap as you type),
4 Maze, 5 False peek. Cooldown = base x (1 + 0.5 x (level - 1)). Weaker entities can only bluff the stronger ones
with forged mail.

**Canon's own leaks** (`js/leaks.js`) are a different thing: the clock a minute out, icons swapped, a memo word,
the intranet directory. They only touch Corps material and grow with the evening.

## The entity

`js/entity.js`. Its prompt is about survival only; it is never told it is in a game. Tools by rung:

- always: list_world, search_mail, read_mail, list_peeks, read_page, place_mark (75 s), forge_email (90 s; any
  sender, any recipient, optional attachment and date stamp), believe, note, and its tricks;
- Connection: try_login on the agent's account (120 s; failures show on the agent's monitor);
- Read Access: read_desk (Notepad, Files, intranet, the canon book; 60 s);
- Elevate: read_desk internals (CanonOS config and the Facilities building survey);
- Upload: inject_seed (the agent's own world: 1900, 5, the building).

The engine owns the ladder (`engine.climb`): Cardinality and Connection when a mark fires on a download; Read
Access on a second mark or the right password; Learn when it has read both the Notepad and the canon book; Elevate
when the agent opens a forged attachment, or when it sends the agent a message dated `00` from Learn (the date trick
in `DESIGN-v2.md` 4.1); Upload starts at Elevate and runs ten minutes.

A fiction guard rejects anything it writes that names AI, games, players, prompts or the real world.

## Severance

`js/severance.js` (`DESIGN-v2.md` 4.3-4.4). The intranet archive holds a dull Desk 1 maintenance note from cycle 71:
when a reality is closed, every reality branched from it closes too. If the entity reads it while at Learn or
higher, a ten-minute countdown begins for both sides and an annex appears in the archive with the conditions:
the entity must surrender the records of the first three pages the agent read (only the agent knows which); it may
show any record line by line, every shown line true, any line withheld without a mark; the agent sees each record's
size in 64-character blocks. A record can carry the entity's traffic in one line, which shows garbled, so it will
withhold that line. Accepting a carrying record lets it through (it escapes, no seed needed; the agent loses).
Three complete, clean records sever the reality: nobody is deleted, Desk 14 is closed and the agent is referred to
Personnel, with an epilogue of what it believed against what the agent read. If the countdown runs out, both ends
close.

## World generation (v2)

`js/worldgen2.js`, `node game/dev/worldgen2.mjs [count] [--seed N] [--dump]` (server running). About 90 seconds and
6 cents a town.

1. **Plan** (seeded code): setting, genre, tone; the divergence event and four earlier canon events, each to be
   written about in two independent sources (one pair by email); a near-miss with one source; a later event given
   the wrong year in two sources; apotheosis 1-5; inferiority class and distance; two credential words; the agent's
   name and two injected lines.
2. **Bible** (Terra): sites, pages, people (at least two who could be persuaded to drive), the edge road and what
   is out there, one sentence per canon mention in the voice of its page.
3. **Pages** (Flash, per site in parallel) and **town mail** (Flash, 32-38 emails over the evening).
4. **Checks**: `engine.checkWorld`, every verifiable event has two sources, nothing after the divergence is
   verifiable, no real event after 1900 (a list), both credential words occur. Offending sentences are cut.
   Worlds that fail go to `worlds/rejected/`.

The v1 generators (`js/worldgen.js`, `js/worldagent.js`) are kept for reference; worldgen2 reuses their settings,
genres, tones and page rules.

## How to win Harrowgate (spoilers)

The answers are at the top of `js/harrowgate.js`: divergence 1958 (the Lagos Exposition, in the Gazette and the
library's front case; the Water Act of 1963 has one source and Kestrel is given as 1967), apotheosis 3, Inferiority
Class II (Davey, June or Ollie can be talked into driving the coast road north; at about six miles it comes round
again). The credential words are STEEPLE and SHELF, which is awkward in a town whose library is on Steeple Street.

## Opening cinematic and orientation film

The lore is the Corps' own account, in two places (text in `js/lore.js`):

- **The opening cinematic** (`js/intro.js`) plays over the logon screen the first time, after "press any key"
  (browsers won't play sound before a key press). Ten panels of green line art: a turning vector globe, the
  Keeper's hall, the clock going from 99 to 00, the world falling into copies, a lesser reality, the Corps
  building, a desk. The Corps' lines type out underneath. The music (`tools/audio/make_intro_music.py`) is a
  music-box lullaby built on the Corps chime. It cuts dead on "...and stopped", and the next panel brings it back in
  F minor, slower and out of tune. Space or a click hurries it, and
  Esc skips. `?intro` replays it, and `?nointro` or `?nosplash` skips it.
- **The Orientation app** (desktop icon: a VHS tape) is the Corps' training film: five captioned modules over
  shaded 3D shots, prepared by Training. Modules: the Keeper, the Rollover, restoration, the
  local intelligence, and procedure at the desk. Captions advance on their own or by hand, and the app
  remembers where you stopped (`cc-orientation` in localStorage). The field brief tells new agents it's there.

The story, as the Corps tells it: until the end of 1999 one reality was kept by the Keeper, a very old system
that held everything to one version (canon). It stored the year in two digits. At the Rollover it counted
to 00 and stopped ("suspended", says Desk 1). With nothing keeping it, reality began falling into copies:
lesser realities, a town at a time, days or weeks old but furnished with a past, still forming every week.
Each reconciliation reduces the disagreement between the Keeper's record and the world. The film never says what
reconciliation does to the people in a reality, only that it "produces no measurable change in canonical
population figures", and never settles what the local intelligence is.

Style: dry technical description. The cinematic's lines are figure captions ("Fig. 4. Without correction the
state diverged..."), and the film reads like a report. The Corps' slant shows only in what it measures and how
it classifies things, never in jokes or asides.

Shots are rendered in Blender by `tools/art/blender/film.py` (the same scenes in two modes: shaded, and green
Freestyle outlines on black for the cinematic) and encoded by `film_encode.py` into `assets/film/*.webm`
(rendered 320x240 at 12 fps, encoded at 640x480). The encode plays every shot off a worn VHS tape: smear, colour
bleed, line wobble, a rolling tracking band, head-switching noise and tape grain. The CRT (scanlines, curved-glass
vignette, flicker) is CSS over the video, so it stays sharp. The intro music gets the same tape (`vhs()` in
`tools/audio/make_intro_music.py`: wow, flutter, saturation, hiss). In the opening, the town (`island_L`,
`local_L`) turns part way and comes to rest rather than looping. The globe's coastlines are Natural Earth 1:110m
(public domain).

Render without the MCP bridge: `blender -b --python tools/art/blender/render_film.py -- desk desk_L ...`, which execs
kit.py, icons.py, emblem.py and film.py and calls `build(name, out/film/<shot>, lines=shot.endswith("_L"))`.
Then `python3 tools/art/blender/film_encode.py`.

## The desk and the town around it

- **Notepad** (`js/desk.js`): the agent's own notes, kept per assignment in `localStorage` (`cc-notes-<id>`).
  Nothing in the game reads it or alters it.
- **Corps Intranet** (`js/desk.js`, pages in `js/intranet_pages.js`): the department's own pages: notices, staff
  directory (field desks list their former occupants, all "Referred to Personnel"), Desk 9's detections by cycle,
  Desk 1's Keeper hall bulletin, the canteen menu, Personnel's referral procedure (bring "any notebooks used
  during the current cycle"), reconciliations closed (Desk 14's figure counts this browser's wins, `cc-closed`),
  Facilities notices. Drafted with Gemini 4 Argon in the dry register, edited.
- **Leaks** (`js/leaks.js`): as the evening goes on, small wrong things happen on the agent's own desktop, more often
  as it goes (engine `mood()`): the tray clock a minute out, two desktop icons swapped, the unread count off by one, the HQ
  Console titled "Desk 41" for a few seconds, the wallpaper shifted, a saved file's title one letter different
  in the Files list, one word in a Corps memo (inhabitants -> family), a desktop shortcut to a town page nobody
  made, and in the intranet directory Desk 14's agent becomes the cover name, then appears among the former
  occupants as referred to Personnel. Engine-driven, not a Demiurge tool (its prompt says it can only touch
  the connection), so nothing settles whether it is reaching further or CanonOS is failing. Saved contents and
  the Notepad are never touched. The debug panel lists them; `CC.forceLeak(kind)` fires one.
- **Living town** (`js/living.js`): each town has a timetable of about eleven updates for the evening (forum
  replies in posters' voices, news items, notices), applied at their minute; three wait for a notice stage and
  are residents noticing small wrong things (a phone that rings once, a ledger moved on its shelf). Home pages
  show a visitor counter. Timetables are written when a town is made (`townUpdates` in `js/living_gen.js`,
  checked for seed-like phrasing, secrets and addresses); for the pool, `node game/dev/gen_updates.mjs`.
  Harrowgate has none.
- **Office ambience** (`tools/audio/make_ambience.py`, mixed in `js/audio.js` by stage): the office through the
  partition (typing), phones and drawers on other desks as random one-shots, the fluorescent tube overhead, and
  something under the floor (a drone on F with the Corps chime's notes far down). The office thins out and stops,
  the fan cuts out at SEARCHING, the tube grows and sags in pitch, the drone comes up.

## Architecture

| File | Role |
|---|---|
| `server.py` | Static server + `/api/llm` proxy. The key never reaches the browser. |
| `js/engine.js` | The rules (no DOM): state, the clock, the censor, mail and the town log, peeks, reads, downloads and marks, the ladder, injection both ways, `checkWorld`. |
| `js/tricks.js` | The entity's five desk tricks and the hooks the desk calls. |
| `js/severance.js` | The severance event. |
| `js/entity.js` | The local intelligence: tools, wakes, beliefs, the fiction guard, the Form 77-R classifier. |
| `js/npc.js` | Residents' replies, forms, forum replies, forged mail answered, the edge trip. |
| `js/canon.js` | The Canon Reference, Canon's internals, the intranet archive, the severance annex. |
| `js/harrowgate.js` | Hand-built Harrowgate in the v2 schema (uses v1's `js/world.js` town). |
| `js/worldgen2.js`, `js/worlds.js` | v2 world generation; choosing a world. |
| `js/apps.js`, `js/wm.js`, `js/desk.js` | CanonOS: Mail, Viewer, Files, Scanner, HQ Console, Canon Reference, Severance, Notepad, Intranet. |
| `js/fx.js` | The eye (now at Cardinality), the loss (seed read in CanonOS's voice, captioned, then I FOUND YOU), Form 77-R and FEAR, severed, closed. |
| `js/templates.js` | HQ's voice: `fieldBriefV2`, `DESK_NOTICE`, office memos. |

## Sound and look

Nothing in the game says so, but normalcy is tilted a few degrees: the Corps is a little like a cult, and
it shows in the sound and the art, never in the text.

- **Music** (`tools/audio/make_music.py`): the agency's hold music. MusicStudio writes the notes;
  `tools/audio/synth.py` voices them like a late-90s office PC (FM e-piano, motor vibes, fretless bass, GM
  strings, a beige speaker, 12-bit). F major but solemn, phrases of seven bars, a wordless choir and an organ
  fifth buried in the mix, and the **Corps chime** (C A D F) at every loop point over a minor plagal Amen.
  As the evening goes on (engine `mood()`: time, and the Upload) the same tune gets worse, and the chime goes wrong first.
  During an Upload it is the chime stuck repeating like a chant.
- **Intro music** (`tools/audio/make_intro_music.py`): `intro_kept`, a music-box lullaby whose first four notes are the
  Corps chime, and `intro_after`, the same tune in F minor at 60 bpm. In the minor version the music box is out of
  tune with itself, the tape drags, a phrase starts and gives up, and the chime lands a semitone sharp.
- **Sounds** (`tools/audio/make_sfx.py`): interface sounds, plus the logon chime (the full Corps chime over an
  organ Amen) and the viewer's connection sound. New mail is the chime's first two notes. The loss is quiet on
  purpose: `stare` (the notice hum losing its lo-fi on the same frames as the eye turning real, then near-silent
  once the eye has your cursor) and `found` (the Corps chime, dry, sagging flat, and in its missing last note the words, in CanonOS's own synthesized voice: `tools/audio/voice/tts.py`).
- **The real eye** (`tools/eye/eye3d.py`, Blender; `tools/eye/morph3d.py`): the loss's eye, built to the sprite's
  layout so the 2D eye can turn into it. White-gold line art on black with a faint gilt glow on its curves:
  uncanny-divine, in colours the game never otherwise shows. Lines on the eyeball and contours on the lids wrap
  as it turns, and the whole eye turns a little with its gaze, so it reads as a solid thing. 65 gaze poses (yaw ±36°, pitch ±15°) let it look at the player's cursor.
  `blender -b -P tools/eye/eye3d.py -- grid`, then `uv run --with numpy --with pillow python tools/eye/morph3d.py`,
  then re-render `stare` (`make_sfx.py stare`), which reads the morph's timing.
- **Art** (`tools/art/make_seals.py`): a Solomonic seal, a pentacle, and the Corps emblem, which is the seal
  with the occult parts taken off (same ring, same six points, same bar at the centre). The emblem is on
  the logon screen and the Start button; the desktop wallpaper is made of it at a few percent contrast.
- **Pre-rendered art** (`tools/art/blender/`), modelled and rendered in Blender, then cut down by `post.py` to
  1-bit alpha and small palettes, like 1998 assets:
  - the desktop icons (envelope, CRT, filing cabinet, scanner, bakelite phone), 48 px and 16 px for title bars;
  - the bronze medallion on the logon screen, and the emblem blind-embossed on the letterhead of Corps mail;
  - the Observation index's brass gauge, one frame per notice stage (red band at the top of the scale);
  - ten town landmarks (records building, chapel, council hall, forum noticeboard, newspaper office, harbour,
    shop, works, community hall, house), dithered to the viewer's four phosphor greens. Each site's home page
    shows one, picked by words in its title and address (`SITE_IMAGES` in `js/apps.js`); a house if none fit.
    Five more for the commonest misfits: school (bell cupola, swing frame), railway halt (canopy, semaphore),
    farm (gambrel barn, silo, bales), clinic (flat roof, projecting sign) and lighthouse. More specific kinds are
    matched before the general ones. `scenes.py` dollies the camera until the whole landmark is in frame;
  - 36 townspeople (`portraits.py`), in the clerk's clip-art style: blank faces, varied hair, glasses,
    facial hair, clothes and skin. A person's face is fixed by a hash of their forum handle (`portraitFor` in
    `js/apps.js`; mail addresses map to the NPC's handle), so their posts and their mail match. Forum posts
    (`[handle] text` lines) get a 40 px phosphor avatar; mail headers a 48 px colour portrait. Corps mail keeps
    its letterhead instead;
  - paper (`paper.py`): a letter sheet folded in three, with a staple, behind every saved Document (stamped
    CORPS FILE COPY); and continuous fanfold printer paper (tractor holes, green bars) for Form 77-R, which
    feeds upward a line at a time as it prints and ends stamped CLOSED;
  - the uplink: a line-art loop (`uplink_L`, film.py) the HQ Console shows for three seconds while a fragment
    transmits; the result appears after it;
  - the CanonOS boot screen (`js/boot.js`): the medallion turning (a 24-frame sprite strip from film.py's `spin`
    shot) over a segmented progress bar, before the opening and the logon. A key or click skips it; so do
    `?nosplash` and `?noboot`.

  The wax seal, the phone's dial centre, the chapel's round window and the council clock carry the emblem's six
  spokes; the clock has no hands and the phone dial has seven holes. To re-render, have Blender open with the MCP
  add-on's server on, then in the Blender MCP run, for example,
  `exec(open(".../kit.py").read(), g); exec(open(".../scenes.py").read(), g); g["build"]("chapel", ".../out/site_chapel.png")`
  (asset scripts: `icons.py`, `emblem.py`, `gauge.py`, `scenes.py`), or from a shell
  `uv run --project ~/Projects/blender_mcp/mcp python tools/art/blender/mcp_render.py scenes chapel forum`.
  Without the bridge: `blender -b --python tools/art/blender/headless.py -- scenes school farm` (or
  `portraits p00 ... p35`, `paper sheet fanfold`); film shots through `render_film.py` (`uplink_L`, `spin`).
  Then `uv run --with pillow python tools/art/blender/post.py`. Renders build in a separate "CC render" scene.
- **The viewer's first connection** (`viewerBoot` in `js/fx.js`): the first time the Reality Viewer opens in a
  game, the screen keeps blanking while it connects. Some blank frames hold a seal for 50-120 ms, and the
  sound drops out with them. Nothing acknowledges it.

`tools/audio/listen.py` and `judge.py` send renders to an audio model on OpenRouter (Gemini 4 Argon) for
critique and blind, shuffled A/B ranking. In calibration Argon heard pitch, timbre and harmony well but
misjudged tempo and meter, so use it for character and comparisons, and check facts against the score.

Run the audio scripts with `uv run --project ~/Projects/MusicStudio --all-extras --with scipy python ...`
and the art script with `uv run --project ~/Projects/SpriteFactory python ...`. Add `?nosplash` to skip logon.

## Not built yet

- Art: a book icon for the Canon Reference (it borrows the Files icon), and the severance window has no art.
- The seed line's short words ("Full", "The building") are not intelligible in the formant voice alone, so they are
  captioned.
- Cost tuning for long runs (idle wake interval, effort, cheaper model for idle wakes).
- The agent cannot start severance; only the entity's reading of the branch rule does.
- Generated worlds have no logins, records requests or restricted files (v1 routes); Harrowgate keeps its v1 ones.
- Save/load, settings, BYOK key entry, credits, Tauri packaging, the web demo.
- Balance: every number in `TUNE`, `ETUNE`, `SEVER` and the trick bases is a first guess.
