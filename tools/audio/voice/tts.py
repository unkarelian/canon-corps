"""CanonOS's own voice: a small formant speech synthesizer, written for this game.

Retro by construction: a buzz-and-hiss source through a cascade of formant resonators (the method of
the 1980 Klatt synthesizer and the DECtalk), run at 11 kHz in 8 bits, its parameters stepped every 10 ms
rather than glided, and its pitch dead level -- no human wobble anywhere.

Angelic by arrangement: the line is not spoken but intoned, by a small choir of the same voice on a
chord (by default F major, the note the Corps chime leaves out). The higher voices get smaller, younger
vocal tracts and sing only the vowels; each is a few cents off, so the chord shimmers. Then a long,
dark, clean hall that stays low under the words and blooms after them: the voices stay crunchy, only
the space around them is smooth.

Threatening by choice: dread() keeps the machine and the chorus but sours them -- the copies out of
step, every pitch sagging, a growling body an octave down, a tritone where the major chord was, the hall
swelling in reversed before the words. The game's "I found you" is dread(level=1): still believably
angelic, and frightening. The higher levels were judged to try too hard.

Text becomes phonemes through espeak-ng (`--ipa`, US English) at build time only: we take its
pronunciations, never its audio, and nothing of it ships. Everything that makes sound is below.

  uv run --with numpy --with scipy python tools/audio/voice/tts.py "I found you." out.wav [--dry] [--solo]
                                                                  [--lead=HZ] [--tract=SCALE] [--unison=N]
                                                                  [--spread_ms=MS] [--drift=FRACTION]
  ... --dread=1|2|3 [--lead=HZ]   the threatening version (see dread()); also writes out.json (preroll)
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import wave
from pathlib import Path
from dataclasses import dataclass

import numpy as np
from scipy.signal import butter, fftconvolve, lfilter, sosfilt

VSR = 11025          # the voice's own sample rate
SR = 44100           # the output's
FRAME = 0.010        # parameters step every 10 ms
RATE = 1.35          # slower than speech: intoned, not said


# ---- phonemes ----------------------------------------------------------------------------------
@dataclass
class Ph:
    f: tuple                 # formant targets (F1, F2, F3); a pair of them for a glide (diphthong)
    dur: float               # seconds, before RATE
    voiced: float = 1.0      # voicing amplitude
    fric: tuple | None = None  # (lo, hi, amp): a band of noise
    stop: tuple | None = None  # (burst lo, burst hi, burst amp, aspirated)
    nasal: bool = False
    asp: float = 0.0         # breath through the formants (h)


V = lambda f1, f2, f3, d=0.13: Ph(((f1, f2, f3),), d)
G = lambda a, b, d=0.22: Ph((a, b), d)
PH = {
    # vowels (adult male formants; smaller tracts scale them up)
    "i": V(270, 2290, 3010), "ɪ": V(390, 1990, 2550, .09), "ɛ": V(530, 1840, 2480, .1), "æ": V(660, 1720, 2410),
    "ɑ": V(730, 1090, 2440), "ɔ": V(570, 840, 2410), "ʊ": V(440, 1020, 2240, .09), "u": V(300, 870, 2240),
    "ʌ": V(640, 1190, 2390, .1), "ə": V(500, 1500, 2500, .07), "ɐ": V(560, 1400, 2450, .08), "ɚ": V(490, 1350, 1690),
    "ɜ": V(490, 1350, 1690), "a": V(730, 1090, 2440), "ɒ": V(600, 900, 2400),
    # diphthongs: a glide from one vowel to another
    "aɪ": G((730, 1090, 2440), (330, 2100, 2800)), "aʊ": G((730, 1090, 2440), (420, 900, 2250)),
    "eɪ": G((480, 1900, 2500), (300, 2200, 2900)), "oʊ": G((500, 900, 2400), (350, 800, 2300)),
    "ɔɪ": G((570, 840, 2410), (330, 2050, 2700)), "əʊ": G((500, 1100, 2400), (350, 800, 2300)),
    # glides and liquids
    "j": Ph(((260, 2070, 3020),), .06), "w": Ph(((300, 610, 2200),), .06),
    "l": Ph(((360, 1300, 2700),), .07, .7), "ɹ": Ph(((420, 1300, 1600),), .07, .8), "r": Ph(((420, 1300, 1600),), .07, .8),
    # nasals (F2 at the place of articulation)
    "m": Ph(((250, 1100, 2300),), .08, .55, nasal=True), "n": Ph(((250, 1700, 2600),), .1, .6, nasal=True),
    "ŋ": Ph(((250, 2300, 2700),), .09, .55, nasal=True),
    # fricatives
    "f": Ph(((340, 1100, 2300),), .12, 0, fric=(900, 4800, .34)), "v": Ph(((340, 1100, 2300),), .08, .45, fric=(1200, 5000, .1)),
    "θ": Ph(((340, 1400, 2500),), .1, 0, fric=(1300, 5000, .26)), "ð": Ph(((340, 1400, 2500),), .06, .45, fric=(1500, 5000, .07)),
    "s": Ph(((320, 1700, 2600),), .12, 0, fric=(3800, 5400, .5)), "z": Ph(((320, 1700, 2600),), .09, .4, fric=(3800, 5400, .3)),
    "ʃ": Ph(((320, 1900, 2500),), .12, 0, fric=(1900, 5000, .45)), "ʒ": Ph(((320, 1900, 2500),), .09, .4, fric=(1900, 5000, .25)),
    "h": Ph(((500, 1500, 2500),), .07, 0, asp=.55),
    # stops: (burst band, burst amp, aspirated)
    "p": Ph(((250, 800, 2200),), .08, 0, stop=(400, 1600, .5, True)), "b": Ph(((250, 800, 2200),), .07, .25, stop=(400, 1600, .4, False)),
    "t": Ph(((250, 1700, 2600),), .08, 0, stop=(2800, 5400, .6, True)), "d": Ph(((250, 1700, 2600),), .08, .25, stop=(2500, 5400, .7, False)),
    "k": Ph(((250, 2200, 2700),), .09, 0, stop=(1500, 3200, .6, True)), "ɡ": Ph(((250, 2200, 2700),), .08, .25, stop=(1500, 3200, .45, False)),
    "g": Ph(((250, 2200, 2700),), .08, .25, stop=(1500, 3200, .45, False)),
    "tʃ": Ph(((320, 1900, 2500),), .12, 0, stop=(2800, 5400, .5, False), fric=(1900, 5000, .4)),
    "dʒ": Ph(((320, 1900, 2500),), .1, .3, stop=(2800, 5400, .4, False), fric=(1900, 5000, .25)),
    " ": Ph(((500, 1500, 2500),), .018, 0),  # between words: barely a break, as old machines ran words together
}
# espeak-ng's other spellings of sounds we already have
for alias, k in {"ᵻ": "ɪ", "ɨ": "ɪ", "ɝ": "ɚ", "ɫ": "l", "ɾ": "d", "o": "oʊ", "e": "eɪ", "ɐ": "ɐ"}.items():
    PH.setdefault(alias, PH[k])
LONG = "ː"
VOWELS = set("iɪɛæɑɔʊuʌəɐɚɜaɒᵻɨɝ")


def phonemes(text: str) -> list[tuple[str, bool, bool]]:
    """-> [(symbol, stressed, long)] from espeak-ng's US-English IPA."""
    ipa = subprocess.run(["espeak-ng", "-q", "-v", "en-us", "--ipa", text], capture_output=True, text=True).stdout
    ipa = re.sub(r"[̩̯͡]", "", ipa.strip().replace("\n", " "))
    keys = sorted((k for k in PH if k != " "), key=len, reverse=True)
    out, i, stress = [], 0, False
    while i < len(ipa):
        c = ipa[i]
        if c in "ˈˌ":
            stress, i = c == "ˈ", i + 1
            continue
        if c.isspace():
            out.append((" ", False, False))
            i += 1
            continue
        k = next((k for k in keys if ipa.startswith(k, i)), None)
        if not k:
            i += 1  # a symbol we have no shape for: skip it
            continue
        i += len(k)
        long = i < len(ipa) and ipa[i] == LONG
        i += long
        out.append((k, stress, long))
        if k in VOWELS or len(PH[k].f) == 2:
            stress = False  # stress belongs to the syllable's vowel
    while out and out[-1][0] == " ":
        out.pop()
    return out


# ---- synthesis ---------------------------------------------------------------------------------
def tracks(seq, scale, rate=RATE):
    """Per-frame parameters for one voice: formants, voicing, breath, nasal; plus noise events."""
    keys, av, asp, nas, events = [], [], [], [], []
    t = 0.0
    last_vowel = max((i for i, (k, *_) in enumerate(seq) if len(PH[k].f) == 2 or k in VOWELS), default=-1)
    for i, (k, stressed, long) in enumerate(seq):
        p = PH[k]
        d = p.dur * rate * (1.25 if stressed else 1) * (1.4 if long else 1) * (1.6 if i == last_vowel else 1)
        f0, f1 = p.f[0], p.f[-1]
        keys += [(t + 0.25 * d, f0), (t + 0.75 * d, f1)]
        if p.stop:  # closure (silence, or a voice bar), then the burst, then breath if aspirated
            lo, hi, amp, aspirated = p.stop
            close = 0.6 * d
            av += [(t, p.voiced * 0.3), (t + close, p.voiced * 0.3)]
            events.append((t + close, 0.012, lo, hi, amp))
            asp += [(t, 0), (t + close, 0), (t + close + 0.01, 0.5 if aspirated else 0), (t + d, 0.3 if aspirated else 0)]
            if p.fric:
                events.append((t + close, d - close, *p.fric))
            av += [(t + close + 0.01, p.voiced), (t + d, p.voiced)]
        else:
            av += [(t, p.voiced), (t + d, p.voiced)]
            asp += [(t, p.asp), (t + d, p.asp)]
            if p.fric:
                events.append((t, d, *p.fric))
        nas += [(t, float(p.nasal)), (t + d, float(p.nasal))]
        t += d
    n = int(np.ceil((t + 0.05) / FRAME))
    ft = np.arange(n) * FRAME
    kt = np.array([k[0] for k in keys])
    F = np.stack([np.interp(ft, kt, [k[1][j] for k in keys]) for j in range(3)], 1) * scale
    lerp = lambda pts: np.interp(ft, [p[0] for p in pts], [p[1] for p in pts])
    return F, lerp(av), lerp(asp), lerp(nas), events, t


def resonate(x, freqs, bw, block):
    """A formant resonator whose frequency steps once per block (the 10 ms zipper)."""
    y, zi = np.zeros_like(x), np.zeros(2)
    T = 1 / VSR
    for b, f in enumerate(freqs):
        s = slice(b * block, (b + 1) * block)
        if s.start >= len(x):
            break
        C = -np.exp(-2 * np.pi * bw * T)
        B = 2 * np.exp(-np.pi * bw * T) * np.cos(2 * np.pi * min(f, VSR * 0.45) * T)
        A = 1 - B - C
        y[s], zi = lfilter([A], [1, -B, -C], x[s], zi=zi)
    return y


def glottal(f0, n, rng, growl=0.0):
    """A Rosenberg pulse train, differentiated: the buzz. f0 is a pitch, or a pitch per sample.
    growl > 0 weakens every other pulse and roughens the rest: period doubling, a fry, a throat."""
    f = np.broadcast_to(np.asarray(f0, dtype=float), (n,)) if np.ndim(f0) == 0 else np.asarray(f0)[:n]
    cyc = np.cumsum(f / VSR)
    ph, idx = cyc % 1.0, cyc.astype(int)
    open_, close = 0.55, 0.15
    g = np.where(ph < open_, 0.5 * (1 - np.cos(np.pi * ph / open_)),
                 np.where(ph < open_ + close, np.cos(0.5 * np.pi * (ph - open_) / close), 0.0))
    x = np.diff(g, prepend=0) * 8
    if growl:
        rough = 1 + growl * 0.35 * rng.standard_normal(idx.max() + 2)
        x = x * (1 - growl * 0.8 * (idx % 2)) * rough[idx]
    return x


def voice(seq, f0, scale, breath, rng, consonants=True, rate=RATE, sag=0.0, growl=0.0, whisper=False):
    """One voice. Without consonants it only sings the vowels: the halo voices, which must not smear the words.
    sag: semitones the pitch droops by the end of the phrase. whisper: breath only, no buzz."""
    F, av, asp, nas, events, dur = tracks(seq, scale, rate)
    block = int(FRAME * VSR)
    n = len(av) * block
    if sag:
        f0 = f0 * 2 ** (-sag * (np.arange(n) / n) ** 1.5 / 12)
    hold = lambda a: np.repeat(a, block)[:n]  # stepped, not interpolated
    if not consonants:
        av = np.where(av >= 0.99, av, 0.0)  # vowels, glides and liquids only; no voice bars, no nasals
        av = av * (1 - nas)
        asp, events = asp * 0, []
    if whisper:
        src = rng.standard_normal(n) * (hold(asp) + hold(av) * 0.9) * 0.35
    else:
        src = glottal(f0, n, rng, growl) * hold(av) + rng.standard_normal(n) * (hold(asp) + hold(av) * breath) * 0.35
    x = src
    for j, bw in enumerate((80, 110, 160)):
        bws = bw * (1 + 0.8 * nas) if j == 0 else bw
        x = resonate(x, F[:, j], float(np.mean(bws)) if np.ndim(bws) else bws, block)
    x = resonate(x, np.full(len(av), 3500 * scale), 250, block)
    # nasal murmur: a low fixed resonance in parallel, and the vowel formants damped
    murmur = resonate(src * hold(nas), np.full(len(av), 270), 100, block)
    x = x * (1 - 0.7 * hold(nas)) + murmur * 0.6
    # Level the vowels before the consonants go in, so their balance holds at any pitch: a low voice's
    # pulses carry less energy, and its consonants would otherwise swamp it. (1.04 is F3's own level.)
    voiced = hold(av) > 0.9
    if voiced.any():
        x = x / max(1e-6, np.sqrt(np.mean(x[voiced] ** 2))) * 1.04
    for t, d, lo, hi, amp in events:  # frication and bursts: shaped noise, in parallel
        a, m = int(t * VSR), int(d * VSR)
        if m < 4:
            continue
        hi = min(hi, VSR * 0.45)
        noise = sosfilt(butter(2, [lo, hi], "band", fs=VSR, output="sos"), rng.standard_normal(m))
        edge = min(m // 2, int(0.012 * VSR))
        w = np.ones(m)
        w[:edge], w[m - edge:] = np.linspace(0, 1, edge), np.linspace(1, 0, edge)
        x[a:a + m] += noise[: len(x[a:a + m])] * w[: len(x[a:a + m])] * amp * 3.6
    return x / max(1e-6, np.abs(x).max())


def hall(x, seconds=4.2, seed=7):
    """A long dark hall: decaying noise, getting darker as it goes, a little predelay."""
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-6.9 * t / seconds)
    dark = sosfilt(butter(1, 1800, fs=SR, output="sos"), ir)
    ir = ir * np.exp(-t * 1.5) + dark * (1 - np.exp(-t * 1.5))
    ir = np.concatenate([np.zeros(int(0.07 * SR)), ir])  # the consonants land before the hall answers
    wet = fftconvolve(x, ir)[: len(x) + len(ir)]
    return wet / max(1e-6, np.abs(wet).max())


CHORD = [  # (Hz, level, tract scale, cents off, ms late): F3 leads (low enough for its vowels to read);
    # F4, A4 and C5 are a halo above it, in smaller, younger tracts
    (174.61, 1.0, 1.08, 0, 0), (349.23, 0.3, 1.16, -4, 4), (440.00, 0.18, 1.2, +6, 7), (523.25, 0.2, 1.24, +3, 5),
]


def speak(text: str, dry: bool = False, solo: bool = False, lead: float | None = None, tract: float | None = None,
          unison: int = 1, spread_cents: float = 18, spread_ms: float = 8, drift: float = 0.0,
          seed: int = 11) -> np.ndarray:
    """lead: the lead voice's pitch in Hz; tract: its formant scale (below 1 = a bigger, deeper body).
    unison: how many copies of the lead say the words together -- each a different size, a few cents off
    (spread evenly across +-spread_cents) and up to spread_ms late: one voice that is many.
    drift: each copy speaks at its own speed, up to +-drift (0.06 = 6%), so they start the phrase
    together and come apart as it goes."""
    seq = phonemes(text)
    rng = np.random.default_rng(seed)
    parts = []
    chord = list(CHORD)
    if lead or tract:
        hz0, lv0, sc0, c0, l0 = chord[0]
        chord[0] = (lead or hz0, lv0, tract or sc0, c0, l0)
    hz0, lv0, sc0, c0, l0 = chord[0]
    spread = np.random.default_rng(seed + 1)
    copies = [(hz0, lv0 / np.sqrt(unison), sc0 * (1 + (spread.uniform(-.05, .05) if u else 0)),
               c0 + (spread_cents * (2 * u / (unison - 1) - 1) if unison > 1 else 0), l0 + (spread.uniform(0, spread_ms) if u else 0))
              for u in range(unison)]
    for i, (hz, level, scale, cents, late) in enumerate(copies + ([] if solo else chord[1:])):
        lead = i < len(copies)
        rate = RATE * (1 + drift * (2 * i / (unison - 1) - 1)) if lead and unison > 1 else RATE
        v = voice(seq, hz * 2 ** (cents / 1200), scale, breath=0.12 if lead else 0.3, rng=rng, consonants=lead, rate=rate) * level
        parts.append(np.concatenate([np.zeros(int(late / 1000 * VSR)), v]))
    n = max(len(p) for p in parts)
    choir = sum(np.pad(p, (0, n - len(p))) for p in parts)
    choir /= np.abs(choir).max()
    choir = np.round(choir * 127) / 127  # 8 bits
    up = choir[(np.arange(int(len(choir) * SR / VSR)) * VSR // SR).astype(int)]  # sample-and-hold to 44.1k
    up = sosfilt(butter(2, 7000, fs=SR, output="sos"), up)  # tame the fizz a little, not all of it
    if dry:
        return up / np.abs(up).max()
    wet = hall(up)
    # The hall stays low while the words are said, so it cannot cover them, and swells after the last one.
    speech_end = len(up) / SR - 0.05
    t = np.arange(len(wet)) / SR
    swell = 0.1 + 0.4 * np.clip((t - speech_end + 0.25) / 0.6, 0, 1)
    out = np.pad(up, (0, len(wet) - len(up))) + wet * swell
    return out / np.abs(out).max()


# ---- dread: the same machine, made threatening -------------------------------------------------
DREAD = {  # intensity -> settings; the mess the user liked (copies up to ~140 ms apart), made worse
    1: dict(main=7, sub=3, whispers=0, sag=2.0, growl=0.5, rate=1.45, pre=0.35),
    2: dict(main=7, sub=3, whispers=3, sag=3.0, growl=0.7, rate=1.5, pre=0.5),
    3: dict(main=7, sub=5, whispers=5, sag=5.0, growl=0.9, rate=1.65, pre=0.7),
}


def dread(text: str, level: int = 2, lead: float = 130.81, seed: int = 13) -> tuple[np.ndarray, float]:
    """The words said by many things at once, out of step: a chorus of the voice on `lead`, a body an
    octave below it with a growl in its throat, whispers trailing, every pitch sagging at its own rate,
    and a sour high rub (a tritone and a semitone) where the angelic version had its major chord.
    The hall swells INTO the first word (reversed) and closes short and dark after the last.
    Returns (audio, preroll): preroll is how long the swell runs before the first word."""
    cfg = DREAD[level]
    seq = phonemes(text)
    rng, spread = np.random.default_rng(seed), np.random.default_rng(seed + 1)
    parts = []

    def add(hz, level_, scale, late_ms, **kw):
        v = voice(seq, hz, scale, rng=rng, rate=cfg["rate"] * spread.uniform(0.97, 1.03), **kw) * level_
        parts.append(np.concatenate([np.zeros(int(late_ms / 1000 * VSR)), v]))

    m = cfg["main"]
    for u in range(m):  # the chorus
        add(lead * 2 ** ((24 * (2 * u / (m - 1) - 1)) / 1200), 1 / np.sqrt(m), 0.95 * spread.uniform(0.95, 1.05),
            spread.uniform(0, 140) if u else 0, breath=0.15, sag=cfg["sag"] * spread.uniform(0.4, 1.6), growl=cfg["growl"] * 0.3)
    for u in range(cfg["sub"]):  # the body underneath
        add(lead / 2 * 2 ** (spread.uniform(-20, 20) / 1200), 0.8 / np.sqrt(cfg["sub"]), 0.8 * spread.uniform(0.96, 1.04),
            spread.uniform(0, 140), breath=0.1, sag=cfg["sag"] * spread.uniform(0.8, 1.8), growl=cfg["growl"])
    for u in range(cfg["whispers"]):  # breath, late
        add(lead, 0.7 / np.sqrt(max(1, cfg["whispers"])), spread.uniform(0.95, 1.2), spread.uniform(60, 260), breath=0, whisper=True)
    for hz in (493.88, 523.25):  # the sour halo: B against F (a tritone), B against C (a semitone)
        add(hz, 0.09, 1.22, spread.uniform(0, 40), breath=0.3, consonants=False, sag=cfg["sag"] * 0.5)

    n = max(len(p) for p in parts)
    choir = sum(np.pad(p, (0, n - len(p))) for p in parts)
    choir /= np.abs(choir).max()
    choir = np.round(choir * 127) / 127  # 8 bits
    up = choir[(np.arange(int(len(choir) * SR / VSR)) * VSR // SR).astype(int)]
    up = sosfilt(butter(2, 6500, fs=SR, output="sos"), up)
    up /= np.abs(up).max()
    pre = hall(up[::-1], seconds=1.4)[::-1]  # the reverse swell: it rises into the words
    preroll = (len(pre) - len(up)) / SR
    after = hall(up, seconds=1.8)
    after = sosfilt(butter(2, 1500, fs=SR, output="sos"), after)  # short and dark: a room, not a cathedral
    total = len(pre) + len(after) - len(up)
    out = np.zeros(total)
    lead_in = len(pre) - len(up)
    out[:len(pre)] += pre * cfg["pre"]
    out[lead_in:lead_in + len(up)] += up
    out[lead_in:lead_in + len(after)] += after * 0.22
    return out / np.abs(out).max(), preroll


def write(path: str, x: np.ndarray) -> None:
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767 * 0.95).astype(np.int16).tobytes())


if __name__ == "__main__":
    opt = lambda name: float(next((a.split("=", 1)[1] for a in sys.argv if a.startswith(f"--{name}=")), 0)) or None
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    text, out = args[0], args[1]
    print(" ".join(k for k, *_ in phonemes(text)))
    if opt("dread"):  # the threatening voice; writes OUT.json beside it with the preroll before the first word
        x, preroll = dread(text, int(opt("dread")), lead=opt("lead") or 130.81)
        write(out, x)
        Path(out).with_suffix(".json").write_text(json.dumps({"preroll": round(preroll, 4)}))
        sys.exit()
    write(out, speak(text, dry="--dry" in sys.argv, solo="--solo" in sys.argv, lead=opt("lead"), tract=opt("tract"),
                     unison=int(opt("unison") or 1), spread_ms=opt("spread_ms") or 8, drift=opt("drift") or 0.0))
