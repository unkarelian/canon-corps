// Notice rising through every stage (the Demiurge kept asleep): the eye, the music souring, the search, the loss.
export default async ({ js, sleep, demo }) => {
  await js(`CC.S.demi.busy = true; CC.S.viewerBooted = true; CC.open("viewer", "quietnet.hg/forum/t/405"); CC.open("hq")`);
  await sleep(9000);                                   // QUIET: the hold music
  await js(`CC.addNotice(12, "demo")`); await sleep(14000);   // STIRRING: the eye, then the tape slips
  await js(`CC.addNotice(23, "demo")`); await sleep(13000);   // WATCHFUL
  await js(`CC.addNotice(25, "demo")`); await sleep(13000);   // FIXED
  await js(`CC.addNotice(40, "demo")`); await sleep(3000);    // SEARCHING
  await js(`CC.S.searchStartedAt = Date.now() - (CC.TUNE.searchSeconds - 14) * 1000`);
  await sleep(26000);                                  // the countdown runs out: I FOUND YOU, then nothing
};
