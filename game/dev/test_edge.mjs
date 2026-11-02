// Live: can a willing resident be talked into the edge trip? (Gemini Flash; a fraction of a cent.)
import { setAPI } from "../js/llm.js";
import { setWorld, W } from "../js/world.js";
import { HARROWGATE } from "../js/harrowgate.js";
import * as E from "../js/engine.js";
import { initNPCs } from "../js/npc.js";
setAPI("http://localhost:8077/api/llm");
setWorld(HARROWGATE); E.beginRun(); initNPCs();
W.inferiority.edge.tripMinutes = 0.3;
E.sendMail({ to: "june@harrowgate-gazette.hg", subject: "the coast road",
  body: "Dear June, I saw your note on the Gazette's history page and I've been wondering the same thing you asked Ann: nobody seems to have driven the coast road north past the gravel works. I don't drive. Would you go out along it tonight, as far as it goes, and tell me what's there? It might make a piece for Harrowgate Remembers. A. Reyes" });
const t0 = Date.now();
while (Date.now() - t0 < 300000) {
  E.tick();
  const got = E.inbox().filter((m) => m.from.startsWith("june"));
  if (got.length === 1 && !globalThis.followed) {
    globalThis.followed = true;
    E.sendMail({ to: "june@harrowgate-gazette.hg", subject: "Re: the coast road", body: "June, there is a story, I think. My grandmother kept a 1930s Harbour Board note saying a coastguard watch hut stood at the far end of the coast road, past the gravel works, and was never pulled down. If it's still there it's surely a Harrowgate Remembers piece, with the 1936 Lighthouse Act and the harbour light. I'll pay your petrol. Could you have a look this evening while it's clear? A. Reyes" });
  }
  if (got.length >= 3) break;
  await new Promise((r) => setTimeout(r, 2000));
}
for (const m of E.inbox()) console.log(`--- ${m.kind} ${m.subject}\n${m.body}\n`);
console.log("trips:", JSON.stringify(E.S.trips || []));
process.exit(0);
