// A live exchange with the Demiurge (real model calls): ask the archivist about the harbour minutes,
// get noticed, see what comes back, flood it, then open the dev panel to see what really happened.
export default async ({ js, sleep, demo, until, log }) => {
  await js(`CC.S.viewerBooted = true; CC.addNotice(8, "setup"); CC.open("viewer", "harrowgate-library.hg/staff")`);
  await sleep(3000);
  await js(`CC.open("mail")`);
  await sleep(800);
  await js(`demo.click(demo.byText("#windows button", "New message"))`);
  await sleep(600);
  await js(`demo.type(demo.win("New message").querySelectorAll("input")[0], "m.hale@harrowgate-library.hg")`);
  await js(`demo.type(demo.win("New message").querySelectorAll("input")[1], "Harbour Board minutes, 1921")`);
  await js(`demo.type(demo.win("New message").querySelector("textarea"), "Dear Ms Hale,\\n\\nI'm researching the founding of the harbour. Are the 1921 Harbour Board minutes held at the library, and is there any way to read them?\\n\\nWith thanks,\\nA. Reyes", 40)`);
  await sleep(500);
  await js(`demo.click(demo.byText("#windows button", "Send"))`);
  await sleep(9000);  // the eye
  await js(`CC.open("hq")`);
  await until(`CC.S.mail.inbox.filter(m => /hale/i.test(m.from)).length >= 1 && !CC.S.demi.busy`, 150000, "reply");
  await sleep(3000);
  log("inbox:", JSON.stringify(await js(`CC.S.mail.inbox.map(m => [m.from, m.subject, m.tamper])`)));
  log("wakes:", JSON.stringify(await js(`CC.S.demi.wakes.map(w => [w.calls.map(c => c.tool), w.effects.map(e => e.kind)])`)));
  await js(`CC.open("mail")`);
  await sleep(600);
  await js(`demo.click(demo.byText("#windows .folders div", "Field inbox"))`);
  await sleep(800);
  const n = await js(`CC.S.mail.inbox.length`);
  for (let i = 0; i < Math.min(n, 3); i++) {
    await js(`demo.click(document.querySelectorAll(".mail .list div")[${i}])`);
    await sleep(6500);
  }
  await js(`demo.dbl(demo.byText(".icon", "Scanner"))`);
  await sleep(1200);
  for (let i = 0; i < 3; i++) {  // re-query each time: the list re-renders after every tick
    await js(`(async () => { const cb = document.querySelectorAll(".scan-pick input")[${i}]; if (cb && !cb.checked) await demo.click(cb); })()`);
  }
  await sleep(800);
  await js(`demo.click(demo.byText(".win button", "Flood"))`);
  await sleep(9000);
  log("scan:", JSON.stringify(await js(`[...document.querySelectorAll(".scan-doc")].map(d => d.textContent.slice(-20))`)));
  await js(`document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "\`", bubbles: true }))`);
  await sleep(8000);
};
