// Directive chain without LLM calls: the Demiurge is kept asleep.
export default async ({ js, sleep, log, shot }) => {
  await js(`CC.S.demi.busy = true`);
  const dirs = async () => JSON.stringify(await js(`CC.S.directives.map(d => d.id + ":" + d.status + (d.early ? "(early)" : ""))`));
  const memos = async () => JSON.stringify(await js(`CC.S.mail.hq.filter(m => m.directive).map(m => m.directive)`));
  await sleep(2600);
  log("t+3s", await dirs(), await memos());
  await js(`CC.open("viewer")`); await sleep(9000);
  for (const u of ["harrowgate-library.hg", "harrowgate-library.hg/archives", "quietnet.hg"]) { await js(`CC.open("viewer", "${u}")`); await sleep(400); }
  await sleep(2500);
  log("after reading", await dirs(), await memos());
  await js(`CC.open("viewer", "harrowgate-library.hg/archives/cen-1987")`); await sleep(300);
  await js(`CC.downloadPage("harrowgate-library.hg/archives/cen-1987")`); await sleep(2500);
  log("after save", await dirs(), await memos());
  await js(`CC.transmit(CC.S.files[0].id)`); await sleep(2500);
  log("after transmit", await dirs(), await memos());
  // Do 14-4 out of order... it is next anyway; then trigger first notice for the advisory.
  await js(`CC.login("harrowgate-library.hg/catalogue", "mhale", "ledger")`);
  await js(`CC.downloadPage("harrowgate-library.hg/catalogue/restricted/tally-bell")`);
  await js(`CC.transmit(CC.S.files.at(-1).id)`); await sleep(2500);
  log("after A2", await dirs(), await memos());
  await js(`CC.addNotice(15, "test")`); await sleep(3000);
  log("after notice", await dirs(), await memos());
  await js(`CC.S.progress += 34`); await js(`CC.emit ? CC.emit("change") : CC.addNotice(0, "x")`); await sleep(1500);
  log("after progress", await dirs(), "canInject", await js("CC.canInject()"));
  await js(`CC.open("hq")`); await sleep(500);
  await shot("hq-directives");
};
