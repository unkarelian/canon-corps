CanonOS's voice. `tts.py` is the game's own speech synthesizer: retro formant speech, made into a chorus;
`speak()` is the angelic version, `dread()` the threatening one (see the docstrings). Nothing in it is
licensed from anyone: espeak-ng is used at build time only, to turn text into phonemes.

Rendered lines are kept here so the game build does not need to re-synthesize them:

    uv run --with numpy --with scipy python tools/audio/voice/tts.py "I found you." tools/audio/voice/i_found_you.wav --dread=1

That also writes `i_found_you.json` (`preroll`: how long the reversed swell runs before the first word).
`make_sfx.py found()` places the first word where the Corps chime's missing fourth note would land.
