"""Have an audio-capable model listen to a render and answer a question about it.

  python3 tools/audio/listen.py FILE.wav [FILE2.wav ...] --prompt "..." [--model google/gemini-4-argon] [--json]

Files are converted to mp3 (ffmpeg) and sent as input_audio. Several files are sent in order in one
message, labelled CLIP 1, CLIP 2... Prints the reply and the cost. Reads OPENROUTER_API_KEY from env or ../../.env.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def key() -> str:
    if os.environ.get("OPENROUTER_API_KEY"):
        return os.environ["OPENROUTER_API_KEY"]
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith("OPENROUTER_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("no OPENROUTER_API_KEY")


def mp3_b64(path: Path, start: float | None = None, dur: float | None = None) -> str:
    with tempfile.NamedTemporaryFile(suffix=".mp3") as f:
        cmd = ["ffmpeg", "-y", "-loglevel", "error"]
        if start is not None:
            cmd += ["-ss", str(start)]
        if dur is not None:
            cmd += ["-t", str(dur)]
        cmd += ["-i", str(path), "-ac", "1", "-b:a", "96k", f.name]
        subprocess.run(cmd, check=True)
        return base64.b64encode(Path(f.name).read_bytes()).decode()


def listen(files: list[Path], prompt: str, model: str = "google/gemini-4-argon", as_json: bool = False,
           system: str | None = None, temperature: float = 0.4) -> tuple[str, float]:
    content: list[dict] = []
    for i, f in enumerate(files, 1):
        if len(files) > 1:
            content.append({"type": "text", "text": f"CLIP {i}:"})
        content.append({"type": "input_audio", "input_audio": {"data": mp3_b64(f), "format": "mp3"}})
    content.append({"type": "text", "text": prompt})
    msgs = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": content}]
    body = {"model": model, "messages": msgs, "temperature": temperature, "usage": {"include": True}}
    if as_json:
        body["response_format"] = {"type": "json_object"}
    req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Authorization": f"Bearer {key()}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        d = json.loads(r.read())
    if "choices" not in d:
        raise RuntimeError(json.dumps(d)[:500])
    return d["choices"][0]["message"]["content"], d.get("usage", {}).get("cost", 0.0)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+", type=Path)
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--model", default="google/gemini-4-argon")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    text, cost = listen(a.files, a.prompt, a.model, a.json)
    print(text)
    print(f"\n[{a.model}  ${cost:.4f}]")


if __name__ == "__main__":
    main()
