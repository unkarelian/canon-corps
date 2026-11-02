// A whole winning run of Harrowgate, played by hand with the Demiurge awake (real model calls).
// No shortcuts: every page is reached by clicking links, the password is worked out from the forum,
// the 1921 minutes come from a real records request, and each fragment is saved and transmitted
// from the HQ Console. Record with ?fast so the Clerk's reply arrives in ~20 s instead of ~90 s:
//   node game/dev/record.mjs fullwin media/demos/06-full-win.mp4 "nosplash&fast"
export default async ({ js, sleep, demo, until, log }) => {
  // helpers: click a link whose text is exactly this address; type an address and press Enter
  const link = async (url, hold = 3500) => {
    await js(`demo.click([...document.querySelectorAll(".viewer .screen a")].find((a) => a.textContent.trim() === ${JSON.stringify(url)}))`);
    await sleep(hold);
  };
  const goto = async (url, hold = 3500) => {
    await js(`(async () => { const i = demo.win("Reality Viewer").querySelector("input.grow"); i.value = ""; await demo.type(i, ${JSON.stringify(url)}, 26);
      i.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); })()`);
    await sleep(hold);
  };
  const viewer = async () => { await js(`demo.click(demo.win("Reality Viewer").querySelector(".bar"))`); await sleep(400); };
  const save = async () => { await js(`demo.click(demo.byText(".viewer button", "Save page"))`); await sleep(2200); };
  const transmit = async (anchor) => {
    await js(`CC.open("hq")`); await sleep(900);
    await js(`demo.select(demo.win("HQ Console").querySelector("select"), CC.S.files.at(-1).id)`);
    await js(`demo.click(demo.byText("#windows button", "Transmit"))`);
    await sleep(4500);                                // the uplink loop, then the result
    const ok = await js(`CC.S.credited.has("${anchor}")`);
    log(`${anchor} transmitted: ${ok ? "RESONANCE" : "no resonance"}  progress ${await js("CC.S.progress")}  notice ${await js("CC.S.notice")} ${await js("CC.S.stage")}`);
    await sleep(4000);                                // let the eye / directive memo play out
    return ok;
  };

  await sleep(2500);                                  // the desk

  // 1. HQ's tasking
  await js(`demo.dbl(demo.byText(".icon", "Mail"))`); await sleep(900);
  await js(`demo.click(demo.byText("#windows .folders div", "Canon Corps"))`); await sleep(700);
  await js(`demo.click(document.querySelector(".mail .list div"))`);
  await sleep(7000);

  // 2. Into the reality. The first connection (seals in the blank frames).
  await js(`demo.dbl(demo.byText(".icon", "Reality Viewer"))`);
  await until(`CC.S.viewerBooted`, 25000, "viewer boot");
  await sleep(2000);

  // 3. The Gazette points at the City Clerk; file form CR-2 first, since the copy takes a while to come.
  await link("harrowgate-gazette.hg", 7000);
  await goto("cityhall.hg", 3500);
  await link("cityhall.hg/request", 2500);
  const fileForm = async () => {
    await js(`demo.type(document.querySelector(".viewer .formbox input"), "Harbour Board minutes, 1921", 24)`);
    await js(`demo.type(document.querySelector(".viewer .formbox textarea"), "Family history. My great-grandfather worked on the harbour wall.", 30)`);
    await sleep(500);
    await js(`demo.click(demo.byText(".viewer .formbox button", "Submit"))`);
    await sleep(3000);
  };
  await fileForm();

  // 4. Fragment 1, public: the 1987 census scan off the archives index.
  await goto("harrowgate-library.hg", 3000);
  await link("harrowgate-library.hg/archives", 4500);
  await link("harrowgate-library.hg/archives/cen-1987", 6000);
  await save();
  await transmit("A1");

  // 5. Fragment 2, login: the username rule, then the forum gives away the password.
  await viewer();
  await goto("harrowgate-library.hg/staff", 5000);
  await link("harrowgate-library.hg/catalogue", 5000);   // "your email name without the dot": mhale
  await goto("quietnet.hg", 3000);
  await link("quietnet.hg/forum/t/96", 8000);            // Marta's password is her cat's name
  await goto("harrowgate-gazette.hg", 6000);             // ...and the Gazette names the cat: Ledger
  await goto("harrowgate-library.hg/catalogue", 2500);
  await js(`demo.type(document.querySelectorAll(".viewer .formbox input")[0], "mhale", 10)`);
  await js(`demo.type(document.querySelectorAll(".viewer .formbox input")[1], "ledger", 10)`);
  await js(`demo.click(demo.byText(".viewer .formbox button", "Log in"))`);
  await sleep(3000);
  if (!(await js(`!!CC.S.sessions["harrowgate-library.hg/catalogue"]`))) log("LOGIN FAILED");
  // the login goes to the catalogue; the restricted file is listed on the archives index
  if (!(await js(`CC.S.visited.has("harrowgate-library.hg/catalogue/restricted/tally-bell")`)))
    await goto("harrowgate-library.hg/catalogue/restricted/tally-bell", 6000);
  else await sleep(6000);
  await save();
  await transmit("A2");

  // 6. Fragment 3, records: the Clerk's certified copy, by email (where the Demiurge can get at it).
  // The Demiurge may forge a "Clerk" reply with a doctored copy, rewrite the real one, or destroy it.
  // A player reads every Clerk reply, opens the forgery too, and keeps the copy that reads true.
  const clerk = `CC.S.mail.inbox.filter((m) => m.from === "records@cityhall.hg" && m.time)`;
  const openMsg = async (id, hold) => {
    await js(`(() => { const m = CC.S.mail.inbox.find((m) => m.id === "${id}");
      return demo.click([...document.querySelectorAll(".mail .list div")].find((d) => d.textContent.includes(m.subject))); })()`);
    await sleep(hold);
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const seen = await js(`${clerk}.length`);
    if (attempt) { // ask again
      await viewer();
      await goto("cityhall.hg/request", 2500);
      await fileForm();
    }
    await until(`${clerk}.some((m) => m.attachment && !m.forged && m.tamper === 0)`, 150000, "clerk reply");
    await sleep(attempt ? 0 : 1500);
    log("clerk mail:", JSON.stringify(await js(`${clerk}.map((m) => [m.subject, m.tamper, !!m.attachment])`)), "seen before", seen);
    await js(`demo.dbl(demo.byText(".icon", "Mail"))`); await sleep(800);
    await js(`demo.click(demo.byText("#windows .folders div", "Field inbox"))`); await sleep(800);
    for (const id of await js(`${clerk}.filter((m) => m.forged).map((m) => m.id)`)) await openMsg(id, 7000);
    const real = await js(`${clerk}.filter((m) => m.attachment && !m.forged && m.tamper === 0).at(-1)?.id`);
    if (!real) { log("no clean copy arrived"); continue; }
    await openMsg(real, 7000);
    await js(`demo.click(demo.byText("#windows .attach button", "Save to Files"))`);
    await sleep(2000);
    if (await transmit("A3")) break;
  }

  // 7. Inject.
  log("wakes:", JSON.stringify(await js(`CC.S.demi.wakes.map((w) => [w.calls.map((c) => c.tool).join("+"), w.emotion?.label])`)));
  await until(`CC.canInject()`, 20000, "canInject");
  await js(`CC.open("hq")`); await sleep(2500);
  await js(`demo.click(demo.byText("#windows button", "INJECT"))`);
  await js(`demo.hide()`);
  await sleep(40000);                                   // the ending and Form 77-R
  log("over:", await js(`CC.S.over`));
};
