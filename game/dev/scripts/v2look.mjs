// v2 smoke test: the desk comes up on Harrowgate v2, the town log fills, peek, censor, download, scan, inject.
// No model calls (the entity's first idle wake is minutes away; NPC mail is not sent).
export default async ({ js, sleep, shot, log }) => {
  await sleep(1500);
  await shot("v2-desktop");
  await js(`CC.S().started -= 10 * 60000; CC.E.tick()`);           // ten minutes in: the timetable delivers
  log("town log:", await js(`JSON.stringify(CC.E.townLog().map(m => m.subject))`));
  await js(`document.querySelectorAll(".mail .folders div")[2].click()`); await sleep(300);
  await js(`document.querySelectorAll(".mail .list > div")[0].click()`); await sleep(300);
  await shot("v2-townlog");
  await js(`[...document.querySelectorAll(".mail .read button")].find(b => /Peek/.test(b.textContent))?.click()`); await sleep(400);
  await shot("v2-peek");
  log("peeks:", await js(`CC.S().peeks.length`));
  // censor: type into compose
  await js(`CC.open("compose")`); await sleep(300);
  const r = await js(`(() => { const t = document.querySelector(".win textarea"); t.focus(); t.value = "meet me on Steeple Street by the shelf tonight"; t.dispatchEvent(new Event("input", {bubbles:true})); return t.value; })()`);
  log("censored compose:", r);
  await shot("v2-compose");
  await js(`CC.S().viewerBooted = true; CC.open("viewer", CC.W.agent.injected[0])`); await sleep(600);
  await shot("v2-viewer");
  await js(`CC.E.placeTracker("page", "harrowgate-library.hg")`);
  await js(`CC.open("scanner")`); await sleep(300);
  await shot("v2-scanner");
  await js(`CC.open("hq")`); await sleep(300);
  await js(`CC.E.inject({year: 1901, apotheosis: 1, inferiority: 1})`); await sleep(300);
  await js(`CC.S().monitor.push({time: CC.E.clock(), kind: "login-failed", text: "Failed login for "+CC.W.agent.address+""}); CC.emit("change")`); await sleep(300);
  await shot("v2-hq");
  await js(`CC.open("canon")`); await sleep(300);
  await shot("v2-canon");
  await js(`CC.open("intranet")`); await sleep(300);
  log("errors so far checked in console.log");
};
