// Which reality a run is given, and the pool of generated ones.
//
//   ?world=harrowgate     the hand-built town
//   ?world=<id or file>   a particular generated world from game/worlds/
//   ?world=new            generate a fresh one now (about a minute)
//   (nothing)             the newest generated world this browser has not played; if there is none,
//                         generate one now with the quick pipeline. Harrowgate if generation fails.
// Spare worlds for the pool are built by the designer agent (slower, richer); the quick pipeline is for
// when a player is waiting.
import { HARROWGATE } from "./world.js";
import { generateWorld } from "./worldgen.js";
import { designWorld } from "./worldagent.js";

const PLAYED = "cc-played";
export const played = () => { try { return JSON.parse(localStorage.getItem(PLAYED) || "[]"); } catch { return []; } };
export const markPlayed = (id) => localStorage.setItem(PLAYED, JSON.stringify([...new Set([...played(), id])]));

async function pool() {
  try { return (await (await fetch("/api/worlds")).json()).worlds || []; } catch { return []; }
}
const unplayed = async () => (await pool()).filter((w) => w.solved && !played().includes(w.id));
const load = async (file) => (await fetch(`worlds/${encodeURIComponent(file)}`)).json();

export function saveWorld(w) {
  return fetch("/api/worlds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(w) }).catch(() => {});
}

export async function chooseWorld(params, status = () => {}) {
  const want = params.get("world");
  if (want === "harrowgate") return HARROWGATE;
  if (want && want !== "new") {
    const f = (await pool()).find((x) => x.id === want || x.file === want || x.file.startsWith(want));
    if (f) return load(f.file);
    console.warn(`no world "${want}" in the pool`);
  }
  if (want !== "new") {
    const next = (await unplayed())[0];
    if (next) return load(next.file);
  }
  try {
    status("Desk 9 is surveying a new reality");
    const w = await generateWorld({ onProgress: (s) => status(`Desk 9 survey: ${s}`), log: (s) => console.log("worldgen:", s) });
    saveWorld(w);
    return w;
  } catch (e) {
    console.warn("world generation failed; assigning Harrowgate", e);
    return HARROWGATE;
  }
}

// Keep a spare unplayed world ready, so the next run starts at once. Runs quietly in the background.
export async function refill(minSpare = 1) {
  if ((await unplayed()).length >= minSpare) return;
  try { await saveWorld(await designWorld({ log: (s) => console.log("worldgen (spare):", s) })); }
  catch (e) {
    console.warn("designer failed; spare world from the quick pipeline", e);
    try { await saveWorld(await generateWorld({ log: (s) => console.log("worldgen (spare):", s) })); } catch (e2) { console.warn(e2); }
    return;
  }
}
