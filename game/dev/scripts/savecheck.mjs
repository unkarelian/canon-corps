export default async ({ js, sleep, log }) => {
  await js(`CC.S.demi.busy = true; CC.loss()`);
  await sleep(4000);
};
