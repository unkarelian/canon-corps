// Gather all three anchors quickly (forcing A3), let a few real wakes happen, then inject.
export default async ({ js, shot, sleep, until, log }) => {
  log(await js(`(() => { const f = CC.downloadPage("harrowgate-library.hg/archives/cen-1987"); return JSON.stringify(CC.transmit(f.id)); })()`));
  await js(`CC.sendMail({ to: "ollie@quietnet.hg", subject: "hi from a newcomer", body: "hey ollie, new in town. who would know about the tally bell?" })`);
  await sleep(30000);
  await js(`CC.addNotice(25, "test")`);
  await js(`CC.login("harrowgate-library.hg/catalogue", "mhale", "ledger")`);
  log(await js(`(() => { const f = CC.downloadPage("harrowgate-library.hg/catalogue/restricted/tally-bell"); return JSON.stringify(CC.transmit(f.id)); })()`));
  await until(`CC.S.demi.wakes.length >= 3 && !CC.S.demi.busy`, 120000, "wakes");
  await sleep(8000);
  log(await js(`(async () => { const w = await import("./js/world.js"); const f = CC.saveFile({ title: w.HARBOUR_MINUTES.title, content: w.HARBOUR_MINUTES.content, source: "attachment", tamper: 0 }); return JSON.stringify(CC.transmit(f.id)); })()`));
  log("wakes:", await js(`JSON.stringify(CC.S.demi.wakes.map(w => [w.time, w.reasons[0], w.emotion, w.calls.length]))`));
  log("canInject", await js(`CC.canInject()`), await js(`CC.S.progress + "/" + CC.required()`));
  js(`CC.win()`);
  await sleep(4500); await shot("W1-form");
  await sleep(2300); await shot("W2-fear");
  await sleep(4500); await shot("W3-black");
  await sleep(4000); await shot("W4-memo");
};
