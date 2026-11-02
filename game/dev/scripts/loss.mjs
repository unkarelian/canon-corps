// Jump straight to the end of the search and watch it find you.
export default async ({ js, shot, sleep }) => {
  await js(`CC.addNotice(100, "test")`);
  await js(`CC.S.searchStartedAt = Date.now() - 147000`);
  await sleep(2000); await shot("L1-searching");
  await sleep(3000); await shot("L2-eye");
  await sleep(1800); await shot("L3-found");
  await sleep(3000); await shot("L4-black");
  await sleep(5500); await shot("L5-after");
};
