// Generate worlds into game/worlds/ (the pool the game draws unplayed assignments from).
//   node game/dev/worldgen.mjs [count=1] [--seed N] [--dump] [--quick] [--quiet]
// By default the designer agent builds each town (js/worldagent.js); --quick uses the fixed pipeline.
// Requires game/server.py on :8077 (it holds the key). --dump prints every page and person for reading.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setAPI, usage } from "../js/llm.js";
import { generateWorld } from "../js/worldgen.js";
import { designWorld } from "../js/worldagent.js";

const args = process.argv.slice(2);
const count = Number(args.find((a) => /^\d+$/.test(a)) || 1);
const seedArg = args.includes("--seed") ? Number(args[args.indexOf("--seed") + 1]) : null;
const dump = args.includes("--dump"), quick = args.includes("--quick"), quiet = args.includes("--quiet");
setAPI("http://localhost:8077/api/llm");
const dir = fileURLToPath(new URL("../worlds/", import.meta.url));
mkdirSync(dir, { recursive: true });

await Promise.all(Array.from({ length: count }, async (_, i) => {
  const c0 = usage.cost, t0 = Date.now();
  try {
    const make = quick ? generateWorld : designWorld;
    const w = await make({ seed: seedArg != null ? seedArg + i : undefined,
      onProgress: (s) => console.log(`[${i}] ${s}`), log: (s) => quiet || console.log(`[${i}]   ${s}`) });
    const file = `${w.id}-${w.town.toLowerCase().replace(/[^a-z]+/g, "-")}.json`;
    writeFileSync(dir + file, JSON.stringify(w, null, 1));
    const g = w.generated;
    console.log(`\n[${i}] ${w.name} (${w.id}) -> worlds/${file}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    console.log(`    ${g.plan.setting.place} | ${g.plan.genre.name} | ${g.plan.tone.name}  ${w.pages.length} pages, ${Object.keys(w.npcs).length} people, $${(usage.cost - c0).toFixed(3)}${g.calls ? `, ${g.calls.length} tool calls` : ""}`);
    if (w.story) console.log(`    story: ${w.story}`);
    console.log(`    routes ${g.plan.routes.join(", ")}  clues ${JSON.stringify(g.plan.clue)}  pattern: ${w.pattern}`);
    console.log(`    anchors: ${Object.values(w.anchors).join(" | ")}`);
    console.log(`    logins: ${Object.entries(w.credentials).map(([s, c]) => `${s} ${c.user}/${c.pass}`).join("; ") || "-"}`);
    console.log(`    solver: ${g.solver.failures.length ? "FAILED " + g.solver.failures.join("; ") : "solved"}`);
    console.log(`    warnings: ${g.warnings.length ? "\n      " + g.warnings.join("\n      ") : "none"}`);
    if (dump) {
      for (const p of w.pages) console.log(`\n=== ${p.url}${p.requiresLogin ? " (restricted)" : ""}\n${p.content}`);
      for (const [k, d] of Object.entries(w.docs)) console.log(`\n=== DOC ${k}: ${d.title}\n${d.content}`);
      for (const [a, n] of Object.entries(w.npcs)) console.log(`\n--- ${n.name} <${a}>\n${n.persona}\n${n.knows.map((k) => "  + " + k).join("\n")}`);
    }
  } catch (e) { console.log(`[${i}] FAILED: ${e.stack || e}`); }
}));
console.log(`\ncost $${usage.cost.toFixed(4)} over ${usage.calls} calls`);
