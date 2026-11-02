export default async ({ js, sleep, demo, log }) => {
  await js(`CC.S.demi.busy = true; CC.S.viewerBooted = true; CC.open("viewer", "harrowgate-library.hg/staff")`);
  await sleep(1000);
  await js(`CC.open("mail")`); await sleep(500);
  log("new:", await js(`demo.click(demo.byText("#windows button", "New message")).then(() => "ok", e => "ERR " + e)`));
  await sleep(400);
  log("to:", await js(`demo.type(demo.win("New message").querySelectorAll("input")[0], "m.hale@harrowgate-library.hg", 200).then(() => "ok", e => "ERR " + e)`));
  log("body:", await js(`demo.type(demo.win("New message").querySelector("textarea"), "hi", 200).then(() => "ok", e => "ERR " + e)`));
  log("send:", await js(`demo.click(demo.byText("#windows button", "Send")).then(() => "ok", e => "ERR " + e)`));
  log("sent:", await js(`JSON.stringify(CC.S.mail.sent.map(m => m.to))`));
};
