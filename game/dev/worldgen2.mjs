// Generate v2 worlds into game/worlds/ (js/worldgen2.js).
//   node game/dev/worldgen2.mjs [count=1] [--seed N] [--dump]
// Requires game/server.py on :8077 (it holds the key). Worlds that fail their checks are written to
// worlds/rejected/ instead, for reading.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setAPI, usage } from "../js/llm.js";
import { generateWorld2 } from "../js/worldgen2.js";

const args = process.argv.slice(2);
const count = Number(args.find((a) => /^\d+$/.test(a)) || 1);
const seedArg = args.includes("--seed") ? Number(args[args.indexOf("--seed") + 1]) : null;
const dump = args.includes("--dump");
setAPI("http://localhost:8077/api/llm");
const dir = fileURLToPath(new URL("../worlds/", import.meta.url));
mkdirSync(dir + "rejected", { recursive: true });

await Promise.all(Array.from({ length: count }, async (_, i) => {
  const c0 = usage.cost, t0 = Date.now();
  try {
    const w = await generateWorld2({ seed: seedArg != null ? seedArg + i : undefined, onProgress: (s) => console.log(`[${i}] ${s}`), log: (s) => console.log(`[${i}]   ${s}`) });
    const file = `${w.generated.ok ? "" : "rejected/"}${w.id}-${w.town.toLowerCase().replace(/[^a-z]+/g, "-")}.json`;
    writeFileSync(dir + file, JSON.stringify(w, null, 1));
    const p = w.generated.plan;
    console.log(`\n[${i}] ${w.name} (${w.id}) -> worlds/${file}  ${((Date.now() - t0) / 1000).toFixed(0)}s  $${(usage.cost - c0).toFixed(3)}`);
    console.log(`    ${p.setting.place} | ${p.genre.name} | ${p.tone.name}`);
    console.log(`    answers: divergence ${w.divergence.year}, apotheosis ${w.apotheosis}, class ${w.inferiority.class} (${w.inferiority.edge.distanceMiles} mi); password ${w.password.join(" ")}; agent ${w.agent.name} <${w.agent.address}>`);
    console.log(`    ${w.pages.length} pages, ${Object.keys(w.npcs).length} people, ${w.traffic.length} emails; edge: ${w.inferiority.edge.road}`);
    console.log(`    warnings: ${w.generated.warnings.join("; ") || "none"}`);
    if (dump) {
      for (const pg of w.pages) console.log(`\n=== ${pg.url}\n${pg.content}`);
      for (const t of w.traffic) console.log(`\n--- ${t.at}m ${t.from} -> ${t.to}: ${t.subject}\n${t.body}`);
      console.log(`\nEDGE: ${w.inferiority.edge.whatTheyFind}`);
    }
  } catch (e) { console.log(`[${i}] FAILED: ${e.stack || e}`); }
}));
console.log(`\ntotal $${usage.cost.toFixed(3)}`);
