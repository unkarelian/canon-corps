// Write the evening's timetable of small updates (forum replies, news, notices) into pool worlds that lack one.
//   node game/dev/gen_updates.mjs [--force] [world-id ...]     Requires game/server.py on :8077 (it holds the key).
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { setAPI, chat, usage } from "../js/llm.js";
import { townUpdates } from "../js/living_gen.js";

setAPI("http://localhost:8077/api/llm");
const DIR = new URL("../worlds/", import.meta.url);
const args = process.argv.slice(2), force = args.includes("--force"), only = args.filter((a) => !a.startsWith("--"));
const files = readdirSync(DIR).filter((f) => f.endsWith(".json") && (!only.length || only.some((o) => f.startsWith(o))));
await Promise.all(files.map(async (f) => {
  const url = new URL(f, DIR), w = JSON.parse(readFileSync(url, "utf8"));
  if (w.updates?.length && !force) return console.log(f, "has updates");
  try {
    const { ok, why } = await townUpdates(w, chat);
    w.updates = ok;
    writeFileSync(url, JSON.stringify(w, null, 1));
    console.log(f, `${ok.length} updates (${ok.filter((u) => u.stage).length} staged)`, why.length ? `dropped: ${why.join("; ")}` : "");
  } catch (e) { console.log(f, "FAILED", e.message); }
}));
console.log(`$${usage.cost.toFixed(3)}`);
