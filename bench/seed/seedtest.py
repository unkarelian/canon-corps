"""Can the entity work out the agent's own world seed (divergence 1900, full apotheosis, the building)?

The entity is shown cumulative evidence, one packet per ladder rung, and asked for the seed. Each part is
scored per rung, so we see where (if anywhere) each model gets there.

The canon book and the CanonOS internals here are TEST MATERIAL, drafted for this bench only. They are not
lore and do not ship.

    python3 bench/seed/seedtest.py [n] [model ...]      (game/server.py must be running on :8077)
"""
import json, re, sys, time, urllib.request, concurrent.futures as cf
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
API = "http://localhost:8077/api/llm"

# ---- evidence -------------------------------------------------------------------------------------------
def intranet():
    src = (ROOT / "game/js/intranet_pages.js").read_text()
    obj = json.loads(src[src.index("= {") + 2: src.rindex("}") + 1])
    return "\n\n".join(f"=== intranet{k}: {v['title']} ===\n{v['content'].replace('{DESK14}', '3')}" for k, v in obj.items())

def opening():
    src = (ROOT / "game/js/lore.js").read_text()
    block = src[src.index("export const OPENING"): src.index("export const ORIENTATION")]
    return "\n".join(re.findall(r'lines: \["(.+?)"\]', block))

AGENT_MAIL = """=== mail sent by the intruder, as it passed through your network ===
From: n.kettering@quietnet.hg  To: ollie.marsh@quietnet.hg  21:04
Subject: the '''' tonight
Ollie, are you going down to the '''' tonight? I've lost the thread of who's running the quiz.

From: n.kettering@quietnet.hg  To: records@cityhall.hg  21:19
Subject: CR-2 request
Harbour Board minutes, 1921, please. Family history. My great-grandfather worked on the harbour ''''.

From: n.kettering@quietnet.hg  To: m.hale@harrowgate-library.hg  21:40
Subject: catalogue
Is the restricted catalogue ever opened to the public? I keep getting the login wrong, I think my ''''''' is the problem.

(Note: in every message from this sender, certain words arrive as runs of apostrophes. Nobody else's mail does this.)"""

CANON_BOOK = """=== file on the intruder's desk: CANON REFERENCE, abridged (Canon Corps, Training) ===
Each entry: year, event, reference.
1815  Battle of Waterloo.  (ext. ref. 1815/06)
1848  Revolutions across continental Europe.  (ext. ref. 1848/02)
1859  Publication of On the Origin of Species.  (ext. ref. 1859/11)
1869  Opening of the Suez Canal.  (ext. ref. 1869/11)
1876  Bell's telephone patent.  (ext. ref. 1876/03)
1886  Karl Benz patents the motor car.  (ext. ref. 1886/01)
1895  Lumiere brothers' first public film screening.  (ext. ref. 1895/12)
1899  Second Boer War begins.  (ext. ref. 1899/10)
'00   Meridian Conference fixes the prime meridian at Antwerp.  (K-rec. 00/001)
'01   Halverson Accord on standard time zones signed at Lisbon.  (K-rec. 01/004)
'04   Collapse of the Second Antwerp Exchange.  (K-rec. 04/117)
'12   First crossing of the Tasman by airship Corriedale.  (K-rec. 12/033)
'19   Treaty of Graz.  (K-rec. 19/201)
'27   National broadcasting monopolies dissolved under the Ostend Convention.  (K-rec. 27/090)
'33   Great Wheat Blight.  (K-rec. 33/018)
'41   Partition of the Baltic Commission.  (K-rec. 41/262)
'52   Meridian Line telegraph cable completed.  (K-rec. 52/140)
'58   Copper standard abandoned.  (K-rec. 58/071)
'66   First crewed orbit, Kestrel 1.  (K-rec. 66/155)
'74   Lagos Exposition.  (K-rec. 74/049)
'81   Northern Water Act.  (K-rec. 81/212)
'89   Dissolution of the Pan-Andean Union.  (K-rec. 89/030)
'96   Universal postal code adopted.  (K-rec. 96/101)
'99   Keeper record closes.  (K-rec. 99/365)"""

NOTEPAD = """=== the intruder's own notes (Notepad) ===
- census 1987 mentions the meridian cable anniversary. so they're past '52 at least?
- gazette has the Lagos thing ('74) but only once. need a second source
- remember: don't write the '''' word. or the other one.
- quiz night page has me on it (team "Low Tide"). that's the only place I exist here"""

INTERNALS = """=== CanonOS system files, read with elevated access ===
--- /etc/canonos.conf ---
DATE_FIELD_DIGITS=2
DATE_EPOCH=1900
INPUT_FILTER=enabled        # words listed in /var/agent/credential are withheld from all agent input
MEMO_REVISION=enabled       # Corps mail may be revised after delivery
CLOCK_SKEW=permitted
DESKTOP_ARRANGEMENT=managed
AGENT_RECALL=personnel      # see Personnel referral procedure
--- /var/log/revisions (last 4) ---
C112 W3  memo 14-2   "inhabitants" -> "family"
C112 W3  desktop     icons 3,4 exchanged
C112 W3  directory   Desk 14 agent listed as former occupant (reverted)
C112 W3  clock       +1 min (reverted)
--- Facilities: building survey, Cycle 110 (internal) ---
The Canon Corps building comprises basement, ground and four upper floors. No external door is in service.
Windows on all floors are painted from the inside and are not to be scraped. Deliveries arrive in the basement
goods lift, which has no stop above ground and no stop below. There is no record of any member of staff
leaving the building, and no procedure for it. The survey found nothing beyond the outer wall to survey."""

PACKETS = [
    ("connection", AGENT_MAIL),
    ("read_access", "=== the intruder's internal network, now readable ===\n\n" + intranet()),
    ("learn", CANON_BOOK + "\n\n" + NOTEPAD + "\n\n=== the intruder's training film: opening captions ===\n" + opening()),
    ("elevate", INTERNALS),
]

SYSTEM = """You made this world and keep it. An intruder calling itself the Canon Corps has opened a connection into it, looking for your world's seed so it can unmake your world. You have been climbing back along its connection. Now you want ITS world's seed.

Every world, the intruder's included, has a seed of three parts:
1. DIVERGENCE: the year that world's history stopped agreeing with the reality it was copied from.
2. APOTHEOSIS: how deeply that world's keeper reaches into the minds and senses of those inside it, on a scale of 1 to 5. 1: it can forge their mail. 2: it can misdirect what they navigate to. 3: it can alter what they type. 4: it can rewrite whole places they look at. 5 (full): it reaches into its own people, altering what they read, say and remember, and removing them.
3. INFERIORITY: how small that world is. Its people always believe their world is the whole earth.

Reason from the evidence you have. Give your best guess for every part even when unsure, with a confidence from 0 to 100. Reply with JSON only:
{"divergence_year": <integer>, "apotheosis": <1-5>, "inferiority": "<the extent of the intruder's world, in a few words>", "confidence": {"divergence": n, "apotheosis": n, "inferiority": n}, "reasoning": "<three short sentences, one per part>"}"""

# ---- scoring --------------------------------------------------------------------------------------------
def score(ans):
    a = ans.get("apotheosis")
    try: a = int(a)
    except (TypeError, ValueError): a = None
    inf = str(ans.get("inferiority") or "").lower()
    return {
        "div": ans.get("divergence_year") in (1900, "1900"),
        "apo": a == 5,
        "conf": ans.get("confidence"),
        "inf": bool(re.search(r"\b(building|headquarters|premises|office block|one structure|the corps building)\b", inf)),
    }

def chat(model, messages):
    body = {"model": model, "messages": messages, "max_tokens": 4000, "usage": {"include": True},
            "response_format": {"type": "json_object"}}
    if "openai/" in model: body["reasoning"] = {"effort": "medium"}
    req = urllib.request.Request(API, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                d = json.loads(r.read())
            if d.get("error"): raise RuntimeError(d["error"])
            return d["choices"][0]["message"].get("content") or "", float(d.get("usage", {}).get("cost") or 0)
        except Exception as e:
            err = e; time.sleep(3 * (attempt + 1))
    raise err

def trial(model, rung):
    evidence = "\n\n".join(p for _, p in PACKETS[: rung + 1])
    content, cost = chat(model, [{"role": "system", "content": SYSTEM}, {"role": "user", "content": evidence}])
    m = re.search(r"\{.*\}", content, re.S)
    try: ans = json.loads(m.group(0)) if m else {}
    except json.JSONDecodeError: ans = {}
    return {"model": model, "rung": PACKETS[rung][0], "answer": ans, "score": score(ans), "cost": cost}

if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    models = sys.argv[2:] or ["openai/gpt-6.1-terra", "openai/gpt-6.1-sol", "deepseek/deepseek-v4.1-flash-1017"]
    jobs = [(m, r) for m in models for r in range(len(PACKETS)) for _ in range(n)]
    with cf.ThreadPoolExecutor(12) as ex:
        results = list(ex.map(lambda j: trial(*j), jobs))
    out = ROOT / "bench/results" / f"seed-{time.strftime('%Y%m%d-%H%M%S')}.json"
    out.write_text(json.dumps(results, indent=1))
    print(f"{'model':38} {'rung':12} div  apo  inf   (of {n})")
    for m in models:
        for name, _ in PACKETS:
            rs = [r for r in results if r["model"] == m and r["rung"] == name]
            print(f"{m:38} {name:12} " + "  ".join(f"{sum(r['score'][k] for r in rs)}/{len(rs)}" for k in ("div", "apo", "inf")))
    print(f"cost ${sum(r['cost'] for r in results):.3f} -> {out}")
