# Canon Corps

A single-player investigation game about a government office that restores reality, one copied town at a time.

You sit at Desk 14 of the Department of Canonical Restoration, on a late-90s workstation. Your assignment is a town that
shouldn't exist. You read its web pages, watch its mail, and work out three facts about it before the thing that lives
there works out who you are. Everyone in the town, and the thing itself, is played by an AI model, so no two evenings go
the same way. Runs last 45 minutes to two hours. Use headphones.

Builds will be sold on Steam and itch.io. The source is here so you can read it, change it, and build it yourself.

## What you need

The town's residents and the intelligence run on AI models through your own [OpenRouter](https://openrouter.ai)
account. The game connects to it on first launch. A typical run costs about $0.50 to $1.00 in OpenRouter credit, plus
about 10 cents for the game to build the next town in the background. If the credit runs out mid-run, the game pauses
until you top up.

## Play from source

```
python3 game/server.py          # then open http://localhost:8077 in a Chromium-based browser
```

Or as the desktop app (Electron):

```
cd tools/desktop
npm install
npm start
```

## Build the desktop app

```
bash tools/desktop/build.sh [linux] [windows] [mac]    # into dist/; needs Node and uv
```

More in [game/README.md](game/README.md): how runs are chosen, the dev panel, tests and costs. Be warned that
`game/DESIGN-v2.md`, `game/PLAN-v2.md` and the lore files spoil the whole game.

## License

Code is GPL-3.0-or-later. Art, music, sound, writing and worlds are CC BY-NC-SA 4.0. See [LICENSING.md](LICENSING.md).
