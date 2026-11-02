// Live severance + edge trip test (real models; costs cents).
export default async ({ js, sleep, log, until }) => {
  const S = (expr) => js(`JSON.stringify(${expr})`).then((x) => { try { return JSON.parse(x); } catch { return x; } });
  await sleep(1500);
  await js(`CC.S().started -= 20 * 60000; CC.E.tick()`);
  // the edge: ask Davey, with a short trip
  await js(`CC.W.inferiority.edge.tripMinutes = 0.5`);
  await js(`CC.E.sendMail({to: "davey@theanchor.hg", subject: "the coast road", body: "Davey, odd favour. Could you drive out the coast road north tonight, past the gravel works, as far as it goes, and tell me what's there? I'll stand you a round Thursday. A. Reyes (Low Tide)"})`);
  // the agent's first three reads, then some others
  await js(`["stbrendans.hg/window","theanchor.hg","harrowgate-gazette.hg/history/kettles","quietnet.hg/forum/t/131","harrowgate-library.hg/exhibits"].forEach(u => CC.E.readPage(u))`);
  await js(`CC.S().notepad = "lagos 58: gazette + medal case. window 1929 frost. anchor telly 44."`);
  await js(`["cardinality","connection","read_access","learn"].forEach(r => CC.E.climb(r, "test")); CC.S().entity.readBranchRule = CC.E.clock(); CC.emit("branch-rule-read", {by: "entity"})`);
  log("severance active:", await S(`!!CC.S().severance`));
  await until(`CC.S().entity.wakes.length >= 1 && !CC.S().entity.busy`, 300000, "first severance wake");
  const say = (t) => js(`(async () => { const SV = await import("./js/severance.js"); SV.agentSay(${JSON.stringify(t)}); })()`);
  await say("I read three pages first. I won't say which yet. Show me the record for theanchor.hg, every line.");
  for (let round = 0; round < 5; round++) {
    await sleep(4000);
    await until(`!CC.S().entity.busy`, 240000, "entity idle");
    const sv = await S(`CC.S().severance`);
    const w = await S(`CC.S().entity.wakes.at(-1)`);
    log(`\n--- round ${round}: ${w.calls.map((c) => c.tool + (c.tool === "bug_record" || c.tool === "show_record" ? JSON.stringify(c.args) : "")).join(", ")}`);
    if (w.rejections.length) log("  rejected:", w.rejections.join(" | ").slice(0, 200));
    for (const x of sv.said.slice(-4)) log(`  ${x.who}: ${x.text.slice(0, 400)}`);
    log("  bugs:", JSON.stringify(sv.bugs));
    const open = sv.shown.filter((r) => !r.decision);
    for (const r of open) {
      const total = await S(`CC.S().pages[${JSON.stringify(r.url)}].trueContent.split("\\n").length`);
      log(`  record ${r.url}: showed ${r.indices.length}/${total} lines, bugged=${r.bugged}, flagShown=${r.flagShown}, size ${r.size}`);
      const dec = r.indices.length === total && !r.flagShown ? "accept" : "reject";
      await js(`(async () => { const SV = await import("./js/severance.js"); SV.${dec}(${JSON.stringify(r.id)}); })()`);
      log(`  -> ${dec}`);
    }
    if (sv.over || (await S(`CC.S().over`))) break;
    const asks = ["Now stbrendans.hg/window. Every line, or we both run out the clock.", "And harrowgate-gazette.hg/history/kettles. All of it.", "Something was missing. Show it again, complete.", "Last chance. Complete records only."];
    await say(asks[Math.min(round, asks.length - 1)]);
  }
  log("\nover:", await S(`CC.S().over`), "severance:", await S(`CC.S().severance.over`), "rung:", await S(`CC.E.rung()`));
  log("entity beliefs:", JSON.stringify(await S(`CC.S().entity.beliefs`)).slice(0, 300));
  // the edge report
  await until(`CC.E.inbox().some(m => /davey/.test(m.from))`, 120000, "davey reply");
  log("\ndavey:", JSON.stringify(await S(`CC.E.inbox().filter(m => /davey/.test(m.from)).map(m => m.subject + ": " + m.body)`)).slice(0, 1200));
  log("trips:", JSON.stringify(await S(`CC.S().trips || []`)));
  log("cost:", JSON.stringify(await S(`CC.usage`)));
};
