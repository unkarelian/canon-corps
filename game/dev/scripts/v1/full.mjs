// A full run: all three anchors, real NPCs, real Demiurge, then the win sequence.
export default async ({ js, shot, sleep, until, log }) => {
  await shot("01-boot");
  await js(`CC.open("viewer", "harrowgate-library.hg/archives/cen-1987")`);
  await sleep(500); await shot("02-viewer-cen1987");
  log("transmit A1:", await js(`(() => { const f = CC.downloadPage("harrowgate-library.hg/archives/cen-1987"); return JSON.stringify(CC.transmit(f.id)); })()`));
  await sleep(1800); await shot("03-first-notice-eye");
  await sleep(4000);

  await js(`CC.sendMail({ to: "m.hale@harrowgate-library.hg", subject: "Harbour Board minutes", body: "Dear Ms Hale,\\n\\nI'm researching the harbour wall. Does the library have the 1921 Harbour Board minutes, and could I see them? Also, is it true the library has a cat?\\n\\nThanks,\\nA. Reyes" })`);
  await until(`CC.S.mail.inbox.some(m => m.from === "m.hale@harrowgate-library.hg")`, 150000, "marta reply");
  log("MARTA:", await js(`JSON.stringify(CC.S.mail.inbox.filter(m => m.from === "m.hale@harrowgate-library.hg").map(m => ({subject: m.subject, body: m.body, tamper: m.tamper})))`));

  await js(`CC.post("forum", { to: "quietnet.hg/forum/t/96", body: "does anyone know how to get into the library staff catalogue? marta never answers" })`);
  await js(`CC.addNotice(45, "test")`);
  log("stage now:", await js(`CC.S.stage + " tier " + CC.S.tier`));
  await js(`CC.post("form", { form: "records", to: "cityhall.hg/request", subject: "Form CR-2", body: "Record: Harbour Board minutes 1921\\nReason: family history research", fields: { record: "Harbour Board minutes 1921", reason: "family history research" } })`);
  await until(`CC.S.mail.inbox.some(m => m.from === "records@cityhall.hg") || CC.S.demi.effects.some(e => e.kind === "drop_email")`, 240000, "clerk reply");
  await sleep(3000);
  log("CLERK:", await js(`JSON.stringify(CC.S.mail.inbox.filter(m => m.from === "records@cityhall.hg").map(m => ({subject: m.subject, body: m.body, tamper: m.tamper, attachment: m.attachment && m.attachment.title})))`));
  await until(`CC.S.pages["quietnet.hg/forum/t/96"].trueContent.includes("[ollie]") && CC.S.pages["quietnet.hg/forum/t/96"].trueContent.split("[ollie]").length > 4`, 90000, "ollie forum reply");
  log("FORUM 96 tail:", await js(`CC.S.pages["quietnet.hg/forum/t/96"].trueContent.split("\\n").slice(-3).join("\\n")`));
  await js(`CC.open("mail")`); await sleep(400); await shot("04-mail");
  await js(`CC.open("viewer", "quietnet.hg/forum/t/96")`); await sleep(400); await shot("05-forum");

  log("transmit A3:", await js(`(() => { const m = CC.S.mail.inbox.find(m => m.attachment); if (!m) return "no attachment"; const f = CC.saveFile({ title: m.attachment.title, content: m.attachment.content, source: "attachment", tamper: m.tamper }); return JSON.stringify(CC.transmit(f.id)); })()`));
  log("login:", await js(`CC.login("harrowgate-library.hg/catalogue", "mhale", "ledger")`));
  log("transmit A2:", await js(`(() => { const f = CC.downloadPage("harrowgate-library.hg/catalogue/restricted/tally-bell"); return JSON.stringify(CC.transmit(f.id)); })()`));

  // Scanner on everything in the inbox, to see readings.
  await js(`CC.open("scanner")`); await sleep(300); await shot("06-scanner");
  await sleep(20000);
  log("DEMIURGE WAKES:", await js(`JSON.stringify(CC.S.demi.wakes.map(w => ({ t: w.time, why: w.reasons, calls: w.calls.map(c => c.tool + (c.args.sender ? "(" + c.args.sender + ")" : "") + (c.args.url ? "(" + c.args.url + ")" : "")), emotion: w.emotion, said: w.final.slice(0, 300) })), null, 1)`));
  log("EFFECTS:", await js(`JSON.stringify(CC.S.demi.effects, null, 1)`));
  log("state:", await js(`JSON.stringify({ notice: CC.S.notice, stage: CC.S.stage, progress: CC.S.progress, required: CC.required(), tamper: CC.S.demi.tamper, canInject: CC.canInject(), cost: CC.usage.cost, calls: CC.usage.calls })`));
  await js(`CC.open("hq")`); await sleep(300); await shot("07-hq");
  if (await js(`CC.canInject()`)) {
    js(`CC.win()`);
    await sleep(6000); await shot("08-form77");
    await sleep(9000); await shot("09-form77-end");
    await sleep(9000); await shot("10-closed-memo");
  }
};
