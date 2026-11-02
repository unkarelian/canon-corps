// The Reality Viewer's first connection (seals in the blank frames), browsing, saving the first fragment.
export default async ({ js, sleep, demo, until }) => {
  await js(`CC.S.demi.busy = true`);
  await sleep(1500);
  await js(`demo.dbl(demo.byText(".icon", "Reality Viewer"))`);
  await until(`CC.S.viewerBooted`, 20000, "boot");
  await sleep(1500);
  await js(`demo.click(demo.byText(".viewer .screen a", "harrowgate-library.hg"))`);
  await sleep(3500);
  await js(`demo.click(demo.byText(".viewer .screen a", "archives"))`);
  await sleep(3500);
  await js(`demo.click(demo.byText(".viewer .screen a", "cen-1987"))`);
  await sleep(6000);
  await js(`demo.click(demo.byText(".viewer button", "Save page"))`);
  await sleep(4500);
};
