// Re-render the Corps text stored in saved worlds (game/worlds/*.json) from the current templates: the HQ mail
// (field brief, Allocations, office memo), the directives, the advisory and the injection directive.
//   node game/dev/migrate_text.mjs [--dry]
// Directives made after 2026-11-01 carry their inputs (`make`) and re-render directly. Older ones are parsed
// back out of the old wording once, and given a `make` so this never has to parse them again.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import * as T from "../js/templates.js";

const DIR = new URL("../worlds/", import.meta.url);
const dry = process.argv.includes("--dry");
const HINTS = { fond: /fond of/, default: /same password/, posted: /write passwords down/ };
const clueOf = (w, route, body) => w.generated?.plan?.clue?.[route] || Object.keys(HINTS).find((k) => HINTS[k].test(body));

function parse(w, d) {
  const b = d.body, g = (re) => b.match(re);
  let m;
  if (d.subject === "Directive 14-1: orientation" && (m = g(/recovered: ([^\n]*?)\. Reading is private/)))
    return ["orientation", { siteNames: [m[1]] }];
  if (d.subject === "Directive 14-2: first fragment" && (m = g(/picked up ([^\n]*?) in the pages of ([^\n]*?)\. In a young/)))
    return ["firstFragment", {}, { docKind: m[1], siteName: m[2] }];
  if (/restricted holdings/.test(d.subject) && (m = g(/\n\n([^\n]*?) holds a restricted file: ([^\n]*?)\. Desk 9/)))
    return ["loginDirective", d.id, d.check.split(":")[1], { siteName: m[1], docKind: m[2], docTitle: d.task.match(/restricted file \((.*)\) and transmit/)?.[1], clue: clueOf(w, "login", b) }];
  if (/records request/.test(d.subject) && (m = g(/\n\n([^\n]*?) keeps older records and releases copies on request, on ([^\n]*?)\. Desk 9 does not know which record you want\. ([^\n]*?) might\./)))
    return ["recordsDirective", d.id, d.check.split(":")[1], { officeName: m[1], formName: m[2], pointerSiteName: m[3] }];
  if (/internal circulation/.test(d.subject) && (m = g(/\n\n([^\n]*?) at ([^\n]*?) keeps ([^\n]*?)\. Desk 9 believes/)))
    return ["insiderDirective", d.id, d.check.split(":")[1], { keeperName: m[1], siteName: m[2], docKind: m[3], docTitle: d.task.match(/send you (.*)\. They only/)?.[1], clue: clueOf(w, "insider", b) }];
  return null;
}

for (const f of readdirSync(DIR).filter((f) => f.endsWith(".json"))) {
  const url = new URL(f, DIR);
  const w = JSON.parse(readFileSync(url, "utf8"));
  const notes = [];
  w.directives = (w.directives || []).map((d) => {
    if (!d.make) {
      const make = parse(w, d);
      if (make) d = { ...d, make };
      else if (d.subject !== T.TRANSMISSION.subject) notes.push(`could not parse ${d.id} "${d.subject}"`);
    }
    return T.rerenderDirective(d);
  });
  if (w.advisory) w.advisory = { ...w.advisory, body: T.ADVISORY.body };
  if (w.inject) w.inject = { ...w.inject, body: T.INJECT_DIRECTIVE.body };
  if (w.hqMail) {
    const office = Object.fromEntries(T.OFFICE.map((m) => [m.subject, m]));
    w.hqMail = w.hqMail.map((m) => {
      if (/field brief$/.test(m.subject) && w.cover) return { ...m, body: T.fieldBrief(w).body };
      if (m.subject === T.ALLOCATIONS.subject) return { ...m, body: T.ALLOCATIONS.body };
      if (office[m.subject]) return { ...m, body: office[m.subject].body };
      notes.push(`hq mail left as is: "${m.subject}"`);
      return m;
    });
  }
  const bad = JSON.stringify([w.directives, w.hqMail, w.advisory, w.inject]).match(/undefined|\$\{/g);
  if (bad) notes.push(`STILL HAS ${bad.join(",")}`);
  if (!dry) writeFileSync(url, JSON.stringify(w, null, 1));
  console.log(f, notes.length ? notes.join("; ") : "ok");
}
