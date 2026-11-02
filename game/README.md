# Canon Corps: playable prototype

A browser prototype of the full loop: generated realities (plus the hand-built HARROWGATE), LLM-driven
people, impersonation, the Demiurge as a real tool-using agent, reality poison, the eye, and both endings.

## Run it

```
python3 game/server.py        # reads OPENROUTER_API_KEY from ./.env
```

Open http://localhost:8077. Add `?fast` to the URL to make every email arrive five times sooner.

Which reality you get: the newest generated world in `game/worlds/` that this browser hasn't played. If the
pool is empty, the quick pipeline generates one behind the logon screen (about a minute, about 4 cents). About
90 seconds into a run, the designer agent quietly builds a spare for next time, unless the pool already has
one (`?norefill` turns that off). `?world=harrowgate` gives the hand-built town, `?world=<id>` a particular pool world,
`?world=new` a fresh one. Played worlds are remembered in localStorage (`cc-played`).

Double-click desktop icons to open apps. Press <kbd>`</kbd> for the dev panel (hidden numbers, what the
Demiurge actually did each wake, LLM spend). With the panel open, <kbd>[</kbd> adds 10 notice and <kbd>]</kbd>
adds 34 resonance.

A typical run costs a few cents in API calls; the HQ console shows the running total.

## Run logs

When a run ends (win, loss, or closing the tab) the game posts its whole state to the server, which writes
`runs/<date>_<time>.json`: every mail, page, file, and each Demiurge wake with its tool calls, effects and
classified reaction. `runs/` is gitignored.

## World generation

Every town gets a setting, a genre and a tone, drawn from seeded lists in `js/worldgen.js`:

- 40 settings across Britain, Ireland, North America, Australia, New Zealand, the Nilgiris, the Karoo and the
  Falklands, with spelling to match;
- 13 genres, which set the story the town is in the middle of: cozy mystery, small-town noir, folk custom,
  ghost story, civic feud, disappearance, company town, revival, scientific oddity, sporting obsession,
  inheritance, homecoming, election;
- 9 tones for how the town sounds on its own pages: boosterish, officious, neighbourly, weary, homemade,
  guarded, pious, tense, sleepy.

The story runs across the sites and people, unresolved; it is not the puzzle. The seeded plan also fixes:

- the pattern, the routes, each login's password clue, the passwords and the username rule;
- name initials for the cast, so towns don't converge on the same names;
- how big the town must be.

Variety comes from the plan, not from asking a model to be original.

There are two generators.

**The designer agent** (`js/worldagent.js`; GPT-6.1 Terra with tools) builds the pool. It takes about 2
minutes and 8–10 cents a town, and produces 25–36 pages, 11–12 people and 7–8 sites.

- **Design.** It founds the town and adds sites, people, routes, pages and forum threads. It decides
  everything the plan doesn't: which extra sites the town has (a feed store, a grange kitchen, a hill club,
  someone's own home page), who knows what about the story and what they think of each other, and which
  site keeps the restricted file.
- **Check.** `check` lists what's wrong. The engine refuses to write pages until the design passes. It
  checks:
  - every route is complete and people work where their route needs them;
  - the size targets are met;
  - each clue really carries its password;
  - each anchor appears only in its own document;
  - each anchor names its own distinct thing. "four siren blasts" and "siren sounded four times" are
    rejected as one fact twice.
- **Write.** `write_pages` has Gemini 3.8 Flash write every site in parallel.
- **Read and fix.** The agent reads the pages that matter and fixes them with `edit_page` or
  `rewrite_pages`.
- **Playtest and finish.** `playtest` runs the cold solver, and `finish` is refused until the town solves.

The engine makes every page the mechanics need: login pages, restricted files, the request form, staff
lists, clue threads, document copies. It puts back any required line the writer dropped and links every page
from its site's home page, so the agent can't break the puzzle by forgetting something.

**The quick pipeline** (`generateWorld` in `js/worldgen.js`) is used when a player is waiting and the pool is
empty. It takes about 50 seconds and 4 cents. It makes the same kind of town at the old size: 5 sites, 4–6
people, 3 fragments. Its steps:

1. one Terra call writes the town's bible;
2. Flash writes the pages;
3. the engine assembles and repairs them;
4. the solver checks the town, and the clues are rewritten once if it fails.

Routes to a fragment. The first is always public. The quick pipeline draws two of the other three; the
agent draws two, or all three about a third of the time. A four-route town needs only three fragments to
win, so the player can choose.

| Route | What the player does |
|---|---|
| public | Finds an old record linked from the archive's index. |
| login | Works out a staff login from the public pages. The username rule is on the login page. Where the password comes from: see the next table. |
| records | Learns from a public page which record to ask for, files the office's request form, and gets the copy by email. |
| insider | One person emails an internal document only to colleagues. The player opens a colleague's staff webmail and asks as them. |

Password clues (the agent also uses "scheme"):

| Clue | Where the password comes from |
|---|---|
| fond | A forum refusal to change it ("it's my dog's name") plus a page that names the dog. |
| default | The forum host complaining that every login got the same starting password, plus the holder admitting they never changed theirs. |
| posted | A note legible in a photo caption. |
| scheme | Starting passwords were surname plus year started; the host explains the scheme, the holder admits they never changed it, and a public page gives the year. |

To generate into the pool from the command line (server running):

```
node game/dev/worldgen.mjs 4 [--quick] [--dump] [--quiet]
```

Saved worlds keep their own copy of HQ's text (field brief, memos, directives). After editing `js/templates.js`,
run `node game/dev/migrate_text.mjs` to re-render it in every pool world. Each directive stores its inputs
(`make`) for this.

`dev/scripts/genwin.mjs` plays a pool world end to end with real NPC replies:
`WORLD=0x6EAF node game/dev/playtest.mjs genwin /tmp/out`.

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

## Workstation induction

The first-run tutorial (`js/induction.js`) is Training's procedure CC-TR-02. It plays once, after the first logon
and before the first directive memo. A spotlight moves over the desk in 14 steps: the icons, Mail, the viewer,
seed fragments and Files, then directives, transmission, resonance and the observation index on the HQ Console,
then the Scanner, staff accounts, Notepad and the Intranet. Each step has a caption in the same dry register as
the field brief. The Corps' slant comes from what it chooses to say: if the SEARCHING countdown completes, "the desk is closed
and the assignment is passed to Personnel". Next/Back, Enter or arrow keys move through it. **Skip induction**
or Esc ends it. The Orientation app's **Repeat induction** plays it again. `?induction` forces it, and
`?noinduction` or `?nosplash` skips it. It is remembered as `cc-induction` (`done` or `skipped`). To test:
`node game/dev/playtest.mjs induction /tmp/out`.

## Impersonation

A staff login also opens that person's mail. Mail gets a folder for the account, and Compose gets a From
picker. People trust mail from colleagues: some documents are only sent to particular addresses or domains
(`holds` on an NPC, enforced by the engine; the model only decides whether to attach). In Harrowgate, the
City Clerk will email the 1921 minutes to library staff without a form.

It is still sent through the connection, and the Demiurge is told whose account it came from. Each message
sent as someone else has a 30% chance (`TUNE.impersonationNoticed*`) that they notice a few minutes later, and
a reply arriving for something they never sent is noticed for certain. When they notice, they change their
password: the account and its restricted pages close, mail still on its way to that account never reaches the
agent, notice rises, and they post about it on the forum. They also remember it if you email them later.

## Directives

HQ gives the agent one concrete objective at a time by memo (Canon Corps folder in Mail), and the HQ Console
lists the open ones at the top. Each memo says what closes it; the engine closes it when that is true, stamps
it, and the next one arrives a few seconds later. They can be done in any order: a directive that is
already complete when its turn comes is listed as closed with no memo. Two arrive out of sequence: an
advisory to use the Scanner once the local intelligence first notices you, and the injection directive
as soon as resonance is sufficient. Text is in `DIRECTIVES` (world.js), logic in `js/directives.js`.

## The desk and the town around it

- **Notepad** (`js/desk.js`): the agent's own notes, kept per assignment in `localStorage` (`cc-notes-<id>`).
  Nothing in the game reads it or alters it.
- **Corps Intranet** (`js/desk.js`, pages in `js/intranet_pages.js`): the department's own pages: notices, staff
  directory (field desks list their former occupants, all "Referred to Personnel"), Desk 9's detections by cycle,
  Desk 1's Keeper hall bulletin, the canteen menu, Personnel's referral procedure (bring "any notebooks used
  during the current cycle"), reconciliations closed (Desk 14's figure counts this browser's wins, `cc-closed`),
  Facilities notices. Drafted with Gemini 4 Argon in the dry register, edited.
- **Leaks** (`js/leaks.js`): as notice rises, small wrong things happen on the agent's own desktop, more often at
  each stage: the tray clock a minute out, two desktop icons swapped, the unread count off by one, the HQ
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

## How to win Harrowgate (spoilers)

Three seed fragments, each reached a different way. Save each to Files and transmit it from the HQ Console.

1. **Public page.** The 1987 census scan is linked from the library's archives index.
2. **Login puzzle.** The Tally Bell file is in the staff catalogue. The username rule is on the login page; the
   password is in an old forum thread (or ask Ollie).
3. **Records request.** The Gazette and Marta both point to the City Clerk. File form CR-2 for the 1921 Harbour
   Board minutes; the scan arrives by email, which the Demiurge can intercept, delay or destroy.

The resonance needed starts at 100 (all three fragments) and drops as the Demiurge tampers, but the console
never shows the threshold. Notice rises with everything you send, with poison use and, once it has stirred,
slowly on its own. At maximum it searches, and after 150 seconds it finds you.

## Architecture

| File | Role |
|---|---|
| `server.py` | Static server + `/api/llm` proxy. The key never reaches the browser. In the shipped app this becomes the Tauri backend (BYOK) or the credits server. |
| `js/world.js` | `W`, the current reality, and HARROWGATE, the hand-built one. A world is plain data: pages, people (what each knows and doesn't, what they hold and for whom), anchors, credentials, documents, directives, HQ mail. |
| `js/worldgen.js`, `js/worldagent.js`, `js/worlds.js` | World generation (the seeded plan and quick pipeline; the designer agent), and choosing a world for a run (the pool in `game/worlds/`, served by `/api/worlds`). |
| `js/templates.js` | HQ's side of every assignment: the field brief, office memos, the directive templates. |
| `js/game.js` | State and rules: notice and stages, the POST log, mail in transit, pages (served vs true content), files, transmission, the threshold. |
| `js/npc.js` | One prompt per reply. NPCs remember only what really passed between them and the player, so a forgery never enters their memory. |
| `js/demiurge.js` | The agent: tools gated by tier, rejections enforced by the engine, an authoritative record of its actions in every wake, and the reaction-log classifier. |
| `js/apps.js`, `js/wm.js` | CanonOS: Mail, Reality Viewer, Files, Scanner, HQ Console, windowing. |
| `js/fx.js` | The eye on first notice; the loss (small eyes opening all over the screen, the central eye turning real, all of them finding your cursor, I FOUND YOU); Form 77-R / FEAR. |
| `js/directives.js` | HQ directives: issues memos, checks their conditions, closes them. |
| `js/audio.js` | WebAudio: sound effects, room tone, and the stage music (one hold-music loop per notice stage, crossfaded at the same bar position). Volume lives under SND in the tray. |
| `dev/record.mjs` | Records a demo video (screen + the game's own audio) from a script in `dev/demos/`: `node game/dev/record.mjs live media/demos/03-live.mp4 "nosplash&fast"`. |
| `dev/playtest.mjs` | Headless Chromium driver. `node game/dev/playtest.mjs full /tmp/out` runs `dev/scripts/full.mjs`. |

Models (`js/llm.js`) come from `bench/`: GPT-6.1 Terra for the Demiurge and the classifier, Gemini 3.8 Flash on
flex for people.

## Sound and look

Nothing in the game says so, but normalcy is tilted a few degrees: the Corps is a little like a cult, and
it shows in the sound and the art, never in the text.

- **Music** (`tools/audio/make_music.py`): the agency's hold music. MusicStudio writes the notes;
  `tools/audio/synth.py` voices them like a late-90s office PC (FM e-piano, motor vibes, fretless bass, GM
  strings, a beige speaker, 12-bit). F major but solemn, phrases of seven bars, a wordless choir and an organ
  fifth buried in the mix, and the **Corps chime** (C A D F) at every loop point over a minor plagal Amen.
  Each notice stage is the same tune, worse, and the chime goes wrong first. Searching is the chime stuck
  repeating like a chant.
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

- Generated worlds always have three fragments and the same five kinds of website; Harrowgate's extras (a
  pointer from two people at once, the census figure echoed in the council minutes) are not generated yet.
- "Breaking the internet" (bulk crawling as a second path to the seed).
- Impersonation on the forum (posting as someone else); only mail for now.
- Save/load, settings, BYOK key entry, credits, Tauri packaging, the web demo.
- The later eye variant (high-notice scan).
- Balance. The numbers in `TUNE` (game.js) are first guesses.
