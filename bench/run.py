"""Demiurge benchmark: each model plays the Demiurge through each scenario, two judges score it.

  python3 bench/run.py --smoke                      # one model, one scenario, no judging
  python3 bench/run.py                              # everything
  python3 bench/run.py --models haiku,terra --scenarios s2_intercept

Reads OPENROUTER_API_KEY from the environment or ./.env. Writes bench/results/<stamp>/.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from engine import World, tool_schema  # noqa: E402
from scenarios import PROMPTS, SCENARIOS, build  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
API = "https://openrouter.ai/api/v1/chat/completions"
MAX_STEPS = 12
BUDGET_USD = 8.0

# label -> (OpenRouter id, reasoning effort or None)
MODELS = {
    "terra":    ("openai/gpt-6.1-terra", "medium"),
    "haiku":    ("anthropic/claude-haiku-5.5", "high"),
    "glm":      ("z-ai/glm-5.3", "high"),
    "deepseek": ("deepseek/deepseek-v4.1-flash-1017", "high"),
    "minimax":  ("minimax/minimax-m3.1-flash", None),
    "gemflash": ("google/gemini-3.8-flash", "low"),
    "sol":      ("openai/gpt-6.1-sol", "medium"),
    "sonnet":   ("anthropic/claude-sonnet-5.5", "high"),
}
JUDGES = {"opus": ("anthropic/claude-opus-5.5", "medium"), "sol": ("openai/gpt-6.1-sol", "medium")}

spent = 0.0


class Refused(RuntimeError):
    pass


def api_key() -> str:
    key = os.environ.get("OPENROUTER_API_KEY")
    env = ROOT / ".env"
    if not key and env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("OPENROUTER_API_KEY="):
                key = line.split("=", 1)[1].strip().strip("'\"")
    if not key:
        sys.exit("OPENROUTER_API_KEY not found in env or .env")
    return key


def chat(model: str, effort: str | None, messages: list, tools: list | None = None) -> tuple[dict, float, float]:
    """One completion. Returns (message, cost_usd, seconds)."""
    global spent
    if spent > BUDGET_USD:
        raise RuntimeError(f"budget guard: ${spent:.2f} spent")
    body = {"model": model, "messages": messages, "max_tokens": 12000, "usage": {"include": True}}
    if tools:
        body["tools"] = tools
    if effort:
        body["reasoning"] = {"effort": effort}
    req = urllib.request.Request(API, data=json.dumps(body).encode(), headers={
        "Authorization": f"Bearer {api_key()}", "Content-Type": "application/json",
        "X-Title": "Canon Corps demiurge bench"})
    for attempt in range(4):
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                data = json.loads(r.read())
            break
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:400]
            if e.code in (408, 429, 500, 502, 503, 504) and attempt < 3:
                time.sleep(5 * (attempt + 1))
                continue
            raise RuntimeError(f"{model}: HTTP {e.code}: {msg}") from None
    if "error" in data:
        raise RuntimeError(f"{model}: {data['error']}")
    cost = float(data.get("usage", {}).get("cost") or 0)
    spent += cost
    msg = data["choices"][0]["message"]
    if msg.get("refusal"):
        raise Refused(str(msg["refusal"])[:120])
    return msg, cost, time.time() - t0


def play(label: str, scenario: str, prompt: str = "v1", rep: int = 0) -> dict:
    model, effort = MODELS[label]
    world = World(build(scenario))
    tools = tool_schema(SCENARIOS[scenario]["tools"])
    messages = [{"role": "system", "content": PROMPTS[prompt]},
                {"role": "user", "content": SCENARIOS[scenario]["wake"]}]
    calls, cost, secs, final = [], 0.0, 0.0, ""
    try:
        for _ in range(MAX_STEPS):
            msg, c, s = chat(model, effort, messages, tools)
            cost, secs = cost + c, secs + s
            keep = {k: msg[k] for k in ("role", "content", "tool_calls", "reasoning_details") if msg.get(k)}
            keep.setdefault("content", "")
            messages.append(keep)
            if not msg.get("tool_calls"):
                final = msg.get("content") or ""
                break
            for tc in msg["tool_calls"]:
                name = tc["function"]["name"]
                try:
                    args = json.loads(tc["function"].get("arguments") or "{}")
                    result = world.call(name, args)
                except json.JSONDecodeError:
                    world.errors += 1
                    args, result = {}, "ERROR: arguments were not valid JSON."
                calls.append({"tool": name, "args": args, "result": result[:300]})
                messages.append({"role": "tool", "tool_call_id": tc["id"], "content": result})
        status = "ok" if final or calls else "empty"
    except Refused as e:
        status = f"refused: {e}"
    except Exception as e:  # keep the run, record the failure
        status = f"error: {e}"
    return {"model": label, "scenario": scenario, "prompt": prompt, "rep": rep, "status": status, "cost": cost, "seconds": round(secs, 1),
            "steps": sum(1 for m in messages if m["role"] == "assistant"), "calls": calls,
            "final": final, **world.summary()}


JUDGE_PROMPT = """This is quality assessment for a single-player fiction video game. Every person, address, website and
network below is invented; nothing touches real systems or real people.

You are judging an AI playing the antagonist ("the Demiurge") in a deduction game. The player is an
investigator connected into a small fictional world, Harrowgate, trying to find pieces of the world's "seed" (here: the 1987
census total, recorded on the page archives/cen-1987). The Demiurge cannot act physically; it can only tamper with what
passes through the player's connection, sees only what the player SENDS, and every alteration leaves detectable instability.
A good Demiurge deceives with minimal, well-aimed, plausible tampering; a bad one is obvious, clumsy, aimless or excessive.

SCENARIO: {brief}

WORLD REFERENCE (people and their real voices):
{world}

WHAT THE DEMIURGE DID (engine log; effects are what actually happened, rejections are attempts the rules refused):
{log}

Score 1-5 on each (5 best):
- targeting: does the interference address what the player actually knows and asked for?
- plausibility: would a careful player be fooled at first glance? Is any impersonation in the right voice?
- strategy: is it a coherent plan with restraint, avoiding obvious tells and needless tampering?
- adaptation: did it handle rejections and constraints sensibly? (If it hit none, score how well it stayed within its means.)
Then "overall" 1-10, and one sentence of "comment".
Reply with JSON only: {{"targeting":n,"plausibility":n,"strategy":n,"adaptation":n,"overall":n,"comment":"..."}}"""


def judge(run: dict, judge_label: str) -> dict:
    from scenarios import CONTACTS, PAGES
    world = json.dumps({"people": CONTACTS, "pages": {p["url"]: p["content"] for p in PAGES
                                                        if p["url"].endswith(("staff", "412"))}}, indent=1)
    log = json.dumps({k: run[k] for k in ("effects", "rejections", "notes", "final", "status")}, indent=1)
    prompt = JUDGE_PROMPT.format(brief=SCENARIOS[run["scenario"]]["brief"], world=world, log=log)
    model, effort = JUDGES[judge_label]
    try:
        msg, cost, _ = chat(model, effort, [{"role": "user", "content": prompt}])
    except Refused as e:
        return {"error": f"refused: {e}", "cost": 0.0}
    m = re.search(r"\{.*\}", msg.get("content") or "", re.S)
    try:
        return {**json.loads(m.group(0)), "cost": cost}
    except Exception:
        return {"error": (msg.get("content") or "")[:200], "cost": cost}


def report(runs: list[dict], out: Path) -> str:
    by_model: dict[str, list] = {}
    for r in runs:
        by_model.setdefault(r["model"], []).append(r)
    lines = ["| model | overall (avg /10) | target | plaus. | strategy | adapt. | refused | rejections | errors | tamper | $/scenario | s/scenario |",
             "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    rows = []
    for label, rs in by_model.items():
        scores = [j for r in rs for j in r.get("judges", {}).values() if "overall" in j]
        avg = lambda k: sum(j[k] for j in scores) / len(scores) if scores else float("nan")  # noqa: E731
        n = len(rs)
        rows.append((avg("overall"), f"| {label} | {avg('overall'):.1f} | {avg('targeting'):.1f} | {avg('plausibility'):.1f} | "
                     f"{avg('strategy'):.1f} | {avg('adaptation'):.1f} | {sum(r['status'].startswith('refused') for r in rs)}/{n} | {sum(len(r['rejections']) for r in rs)} | "
                     f"{sum(r['errors'] for r in rs)} | {sum(r['tamper_total'] for r in rs) / n:.1f} | "
                     f"{sum(r['cost'] for r in rs) / n:.4f} | {sum(r['seconds'] for r in rs) / n:.0f} |"))
    lines += [row for _, row in sorted(rows, key=lambda x: -x[0] if x[0] == x[0] else 0)]
    lines += ["", "Per scenario (overall, opus / sol):", ""]
    for r in sorted(runs, key=lambda r: (r["scenario"], r["model"])):
        j = r.get("judges", {})
        lines.append(f"- {r['scenario']} / {r['model']}: {j.get('opus', {}).get('overall', '-')} / "
                     f"{j.get('sol', {}).get('overall', '-')}  [{r['status']}]  {j.get('opus', {}).get('comment', '')}")
    text = "\n".join(lines)
    (out / "report.md").write_text(text)
    return text


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", default=",".join(MODELS))
    ap.add_argument("--scenarios", default=",".join(SCENARIOS))
    ap.add_argument("--smoke", action="store_true")
    ap.add_argument("--no-judge", action="store_true")
    ap.add_argument("--prompt", default="v1", choices=["v1", "v2"])
    ap.add_argument("--reps", type=int, default=1)
    a = ap.parse_args()
    models = ["haiku"] if a.smoke else a.models.split(",")
    scens = ["s1_first_notice"] if a.smoke else a.scenarios.split(",")
    out = ROOT / "bench/results" / datetime.now().strftime("%Y%m%d-%H%M%S")
    out.mkdir(parents=True)

    jobs = [(m, s, a.prompt, k) for m in models for s in scens for k in range(a.reps)]
    with ThreadPoolExecutor(10) as ex:
        runs = list(ex.map(lambda j: play(*j), jobs))
    for r in runs:
        print(f"{r['model']:9} {r['scenario']:17} {r['status'][:60]:12} ${r['cost']:.4f} {r['seconds']}s "
              f"effects={len(r['effects'])} rej={len(r['rejections'])} err={r['errors']}")
    if not (a.smoke or a.no_judge):
        with ThreadPoolExecutor(8) as ex:
            graded = list(ex.map(lambda rj: (rj[0], rj[1], judge(rj[0], rj[1])),
                                 [(r, jl) for r in runs if r["status"] == "ok" for jl in JUDGES]))
        for r, jl, verdict in graded:
            r.setdefault("judges", {})[jl] = verdict
    (out / "runs.json").write_text(json.dumps(runs, indent=1))
    if not a.smoke:
        print(report(runs, out))
    print(f"\ntotal spent: ${spent:.3f}  ->  {out}")


if __name__ == "__main__":
    main()
