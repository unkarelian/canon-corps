"""Blind, shuffled comparison of renders by an audio model. Prints each round and a rank tally.
  python3 tools/audio/judge.py --rounds 3 --prompt-file brief.md A=path B=path C=path
"""
import argparse, json, random, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from listen import listen

ap = argparse.ArgumentParser()
ap.add_argument("clips", nargs="+")
ap.add_argument("--rounds", type=int, default=3)
ap.add_argument("--prompt-file", required=True)
ap.add_argument("--question", required=True)
ap.add_argument("--model", default="google/gemini-4-argon")
a = ap.parse_args()
clips = dict(c.split("=", 1) for c in a.clips)
brief = Path(a.prompt_file).read_text()
tally = {k: [] for k in clips}
total = 0.0
for r in range(a.rounds):
    order = list(clips); random.Random(r * 7 + 1).shuffle(order)
    q = (brief + "\n\n" + a.question + f"\n\nThere are {len(order)} clips, CLIP 1..{len(order)}. Reply as JSON: "
         '{"notes": {"1": "...", ...}, "ranking": [best clip number, ..., worst], "why": "..."}. '
         "In notes, describe what you actually hear in each clip that serves or fails the brief; quote moments by time.")
    text, cost = listen([Path(clips[k]) for k in order], q, a.model, as_json=True)
    total += cost
    try:
        d = json.loads(re.search(r"\{.*\}", text, re.S).group(0))
    except Exception:
        print("unparsed:", text[:500]); continue
    print(f"\n=== round {r + 1}  order: {' '.join(f'{i+1}={k}' for i, k in enumerate(order))}")
    for i, k in enumerate(order):
        print(f"  [{k}] {d['notes'].get(str(i + 1), '')}")
    rank = [order[int(x) - 1] for x in d["ranking"]]
    for pos, k in enumerate(rank):
        tally[k].append(pos + 1)
    print("  ranking:", " > ".join(rank), "\n  why:", d.get("why", ""))
print("\nmean rank:", {k: round(sum(v) / len(v), 2) for k, v in tally.items() if v}, f"  cost ${total:.3f}")
