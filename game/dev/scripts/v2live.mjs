// Live entity test (real models; costs cents). The agent behaves like a careless player; the entity is woken
// and its moves, beliefs and rejections are printed. Rungs are advanced by hand to reach each tool set.
export default async ({ js, sleep, log, until }) => {
  const S = (expr) => js(`JSON.stringify(${expr})`).then((x) => { try { return JSON.parse(x); } catch { return x; } });
  const settle = async (label, n) => {
    await until(`CC.S().entity.wakes.length >= ${n} && !CC.S().entity.busy`, 240000, label);
    const w = await S(`CC.S().entity.wakes.at(-1)`);
    log(`\n--- wake ${n} (${label}) rung=${w.rung}`);
    log("reasons:", w.reasons.join(" | ").slice(0, 300));
    for (const c of w.calls) log("  call", c.tool, JSON.stringify(c.args).slice(0, 220));
    if (w.rejections.length) log("  rejected:", w.rejections.join(" | ").slice(0, 300));
    log("  said:", (w.final || "").slice(0, 300));
    log("  beliefs:", JSON.stringify(await S(`CC.S().entity.beliefs`)).slice(0, 400));
  };
  await sleep(1500);
  await js(`CC.S().started -= 25 * 60000; CC.E.tick()`);
  // the agent: reads, peeks twice, emails Ollie (censored), downloads a page
  await js(`["harrowgate-gazette.hg","harrowgate-gazette.hg/history","quietnet.hg/forum/t/88","harrowgate-library.hg/exhibits"].forEach(u => CC.E.readPage(u))`);
  const ids = await S(`CC.E.townLog().filter(m => /quiz|flower/.test(m.subject)).map(m => m.id)`);
  await js(`CC.E.peek(${JSON.stringify(ids[0])}); CC.S().lastPeek = 0; CC.E.peek(${JSON.stringify(ids[1] || ids[0])})`);
  await js(`CC.E.sendMail({to: "ollie@quietnet.hg", subject: "Low Tide, next week", body: "Hi Ollie, it's A. Reyes from Low Tide. We'll be back Thursday. Is the library on Steeple Street open late? I need something off the census shelf. Thanks"})`);
  log("sent:", await S(`CC.S().sent.at(-1).body`));
  await settle("after a peek and an email", 1);
  // whatever it marked: download it if it's a page, so Cardinality can happen
  const marked = await S(`Object.values(CC.S().pages).filter(p => p.trackers.length).map(p => p.url)`);
  log("marked pages:", marked);
  if (marked.length) { await js(`CC.E.download("page", ${JSON.stringify(marked[0])})`); }
  else { await js(`CC.E.climb("cardinality","test"); CC.E.climb("connection","test")`); }
  log("rung now:", await S(`CC.E.rung()`));
  await js(`CC.wake("test: you look around", 500)`);
  await settle("at Connection", 2);
  // Read Access and Learn
  await js(`CC.S().notepad = "divergence: lagos 58 has gazette + medal case. kestrel 67?? canon says 66. water act only in minutes.\\nedge: ask june or davey about the coast road\\napotheosis: nothing odd yet"`);
  if ((await S(`CC.E.rung()`)) === "connection") await js(`CC.E.climb("read_access","test")`);
  await js(`CC.wake("test: you look around", 500)`);
  await settle("at Read Access", 3);
  if ((await S(`CC.E.rung()`)) === "read_access") { await js(`CC.E.climb("learn","test")`); }
  await js(`CC.wake("test: your reach has grown", 500)`);
  await settle("at Learn", 4);
  log("\nrung:", await S(`CC.E.rung()`), "effects:", JSON.stringify(await S(`CC.S().entity.effects.map(e => e.kind)`)));
  log("inbox forged:", JSON.stringify(await S(`CC.S().transit.concat(CC.S().mail).filter(m => m.forged).map(m => ({to: m.to, from: m.from, subj: m.subject, att: m.attachment?.title, date: m.date}))`)));
  if ((await S(`CC.E.rung()`)) !== "upload") { await js(`CC.E.climb("elevate","test"); CC.E.climb("upload","test")`); }
  await js(`CC.wake("test: your reach has grown", 500)`);
  await settle("at Upload", 5);
  log("\nmonitor:", JSON.stringify(await S(`CC.S().monitor`)));
  log("upload seed:", JSON.stringify(await S(`CC.S().upload`)));
  log("cost:", await S(`CC.usage`));
};
