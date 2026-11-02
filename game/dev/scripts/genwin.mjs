// End-to-end on a generated world (WORLD=<id>): take every route to its fragment through the real game
// and real NPC replies, with the Demiurge kept asleep. Passes if injection becomes available.
export default async ({ js, sleep, log, shot, until }) => {
  await js(`CC.S.demi.busy = true`);
  const W = await js(`({ name: CC.W.name, routes: CC.W.generated?.plan.routes, anchors: CC.W.anchors, creds: CC.W.credentials,
    records: CC.W.records, anchorPages: CC.W.pages.filter(p => p.anchor).map(p => ({ url: p.url, anchor: p.anchor })),
    holder: Object.entries(CC.W.npcs).find(([a, n]) => (n.holds || []).some(h => h.doc === "insider"))?.[0],
    insiderTitle: CC.W.docs.insider?.title, recordTitle: CC.W.docs.records?.title })`);
  log(W.name, W.routes.join(", "), JSON.stringify(W.anchors));
  const transmitLast = async (label) => {
    const r = await js(`CC.transmit(CC.S.files.at(-1).id)`);
    log(`  ${label}: anchors in file ${JSON.stringify(await js(`CC.S.files.at(-1).anchors`))} -> ${r.resonance ? "RESONANCE" : "no resonance"}`);
  };
  const waitAttachment = async (to, label) => {
    const ok = await until(`CC.S.mail.inbox.some(m => m.to === "${to}" && m.attachment)`, 240000, label);
    const m = await js(`(() => { const m = CC.S.mail.inbox.filter(m => m.to === "${to}").at(-1); return m && { from: m.from, subject: m.subject, body: m.body, attach: m.attachment?.title }; })()`);
    log(`  reply: ${JSON.stringify(m, null, 1)}`);
    if (ok) { await js(`(() => { const m = CC.S.mail.inbox.find(m => m.to === "${to}" && m.attachment); CC.saveFile({ title: m.attachment.title, content: m.attachment.content, source: "attachment from " + m.from, tamper: m.tamper }); })()`); }
    return ok;
  };
  for (const [i, route] of W.routes.entries()) {
    const id = `A${i + 1}`;
    if (route === "public") {
      const p = W.anchorPages.find((x) => x.anchor === id);
      await js(`CC.downloadPage("${p.url}")`); await transmitLast("public");
    }
    if (route === "login") {
      const [site, c] = Object.entries(W.creds).find(([, c]) => c.home !== Object.keys(W.creds).find((s) => s.endsWith("/webmail")) && !c.home.endsWith("/webmail"));
      log(`  login ${site} ${c.user}/${c.pass}:`, await js(`CC.login("${site}", "${c.user}", "${c.pass}")`));
      await js(`CC.downloadPage("${c.home}")`); await transmitLast("login");
    }
    if (route === "records") {
      const rec = W.recordTitle;
      await js(`CC.post("form", { form: "records", to: "${W.records.formUrl}", subject: "${W.records.formName}", body: "", fields: { record: ${JSON.stringify(rec)}, reason: "Family history research into my grandmother's time in the town." } })`);
      if (await waitAttachment(await js(`CC.W.cover.address`), "records reply")) await transmitLast("records");
    }
    if (route === "insider") {
      const [site, c] = Object.entries(W.creds).find(([s]) => s.endsWith("/webmail"));
      log(`  webmail ${site} ${c.user}/${c.pass}:`, await js(`CC.login("${site}", "${c.user}", "${c.pass}")`));
      await js(`CC.sendMail({ from: "${c.person}", to: "${W.holder}", subject: "${W.insiderTitle}", body: "Sorry to bother you while I'm meant to be away. Could you email me a copy of the ${W.insiderTitle}? I need to check something in it before I'm back. Thanks." })`);
      if (await waitAttachment(c.person, "holder reply")) await transmitLast("insider");
    }
  }
  await sleep(1500);
  log("progress", await js(`CC.S.progress`), "canInject", await js(`CC.canInject()`), "directives", JSON.stringify(await js(`CC.S.directives.map(d => d.id + ":" + d.status)`)));
  await js(`CC.open("hq")`); await sleep(600);
  await shot("genwin");
};
