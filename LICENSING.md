# Licensing

Canon Corps is split into code and content, under two licenses.

## Code: GPL-3.0-or-later

Everything not listed under Content below, including the game engine, the desktop app, world generation,
the model prompts, the build and asset scripts, tests and the benchmark harness. Full text: [LICENSE](LICENSE).

## Content: CC BY-NC-SA 4.0

The game's art, music, sound, voice, writing and worlds. You may share and adapt them for non-commercial
purposes, with credit, under the same license. Full text: [LICENSE-CONTENT](LICENSE-CONTENT).

- `game/assets/` (images, music, sound, film)
- `game/worlds/` (the generated towns)
- The writing in `game/js/lore.js`, `game/js/canon.js`, `game/js/canon_entries.js`, `game/js/harrowgate.js`,
  `game/js/intranet_pages.js` and `game/js/templates.js`
- `game/DESIGN-v2.md` and `game/PLAN-v2.md`
- `tools/audio/voice/*.wav` and `tools/audio/voice/*.json`
- `bench/results/`

Where one of those `.js` files also contains code, the code is GPL-3.0-or-later and the text is CC BY-NC-SA 4.0.

## Third-party

- `tools/art/blender/data/coast110.geojson`: Natural Earth 110m coastlines, public domain.
- The desktop builds include Electron and Chromium under their own licenses (shipped alongside the app).

## Selling builds

The GPL allows anyone to sell builds of the code, but the content is non-commercial. A build that includes the
content therefore can't be sold by anyone other than the copyright holder. You are welcome to build the game
for yourself and your friends.

"Canon Corps" is the name of this game; please don't use it for forks or other releases.

Copyright © 2026 Kurvaz.
