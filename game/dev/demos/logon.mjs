// Logon, the Corps chime, the hold music, and the first directive arriving.
export default async ({ js, sleep, demo, until }) => {
  await js(`CC.S.demi.busy = true`);
  await sleep(1800);
  await demo.click("#logon");
  await sleep(5000);
  await until(`CC.S.mail.hq.some(m => m.directive === "14-1")`, 20000, "14-1");
  await sleep(1500);
  await js(`demo.click(demo.byText(".mail .list div", "Directive 14-1"))`);
  await sleep(7000);
  await js(`demo.dbl(demo.byText(".icon", "HQ Console"))`);
  await sleep(4000);
};
