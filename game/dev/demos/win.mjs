// A win with the Demiurge awake (real model calls), so Form 77-R reports its real classified reactions.
// For time, the third fragment is credited directly instead of played through the records request.
export default async ({ js, sleep, demo, until, log }) => {
  await js(`CC.S.viewerBooted = true; CC.addNotice(4, "setup"); CC.open("viewer", "harrowgate-library.hg/archives/cen-1987")`);
  await sleep(2500);
  await js(`demo.click(demo.byText(".viewer button", "Save page"))`);
  await sleep(1500);
  await js(`CC.open("hq")`); await sleep(800);
  await js(`demo.select(demo.win("HQ Console").querySelector("select"), CC.S.files[0].id)`);
  await js(`demo.click(demo.byText("#windows button", "Transmit"))`);
  await sleep(9000);   // uplink, RESONANCE, and the eye
  await js(`CC.login("harrowgate-library.hg/catalogue", "mhale", "ledger"); CC.open("viewer", "harrowgate-library.hg/catalogue/restricted/tally-bell")`);
  await sleep(2500);
  await js(`demo.click(demo.byText(".viewer button", "Save page"))`);
  await sleep(1200);
  await js(`CC.open("hq")`); await sleep(800);
  await js(`demo.select(demo.win("HQ Console").querySelector("select"), CC.S.files.at(-1).id)`);
  await js(`demo.click(demo.byText("#windows button", "Transmit"))`);
  await sleep(4000);
  await until(`!CC.S.demi.busy && CC.S.demi.wakes.length && CC.S.demi.wakes.every(w => w.emotion || !(w.calls.length || w.final))`, 120000, "demiurge");
  log("wakes:", JSON.stringify(await js(`CC.S.demi.wakes.map(w => [w.reasons[0].slice(0, 40), w.emotion?.label])`)));
  await js(`CC.S.credited.add("A3"); CC.S.progress += 34; CC.emit("change")`);
  await sleep(4000);
  await js(`demo.click(demo.byText("#windows button", "INJECT"))`);
  await sleep(36000);
};
