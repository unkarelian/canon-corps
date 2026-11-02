// The first-run workstation induction: every step screenshotted, then skip and repeat checks.
export default async ({ js, sleep, log, shot, until }) => {
  await js(`localStorage.setItem("cc-intro-seen", "1"); localStorage.removeItem("cc-induction"); history.replaceState(null, "", "/?fast&noboot&norefill&world=harrowgate"); location.reload()`);
  await sleep(2500);
  await until(`!document.getElementById("logon").disabled`, 20000, "logon ready");
  await js(`document.getElementById("logon").click()`);
  await until(`!!document.getElementById("induction")`, 10000, "induction shown");
  await sleep(500);
  const n = await js(`document.querySelector("#induction .ind-bar .muted").textContent`);
  log("steps", n);
  for (let i = 0; i < 20; i++) {
    if (!(await js(`!!document.getElementById("induction")`))) break;
    await shot(`step-${String(i + 1).padStart(2, "0")}`);
    log(i + 1, await js(`document.querySelector("#induction .ind-title").textContent`));
    await js(`[...document.querySelectorAll("#induction button")].find((b) => /Next|Begin/.test(b.textContent)).click()`);
    await sleep(500);
  }
  log("stored", await js(`localStorage.getItem("cc-induction")`), "directives", await js(`CC.S.directives.length`));
  await until(`CC.S.directives.length > 0`, 8000, "first directive after induction");
  log("directives after", await js(`CC.S.directives.map((d) => d.id).join(",")`));
  // A reload does not replay it.
  await js(`location.reload()`); await sleep(2500);
  await until(`!document.getElementById("logon").disabled`, 20000, "logon ready 2");
  await js(`document.getElementById("logon").click()`); await sleep(5000);
  log("replayed on second run?", await js(`!!document.getElementById("induction")`));
  // Repeat from Orientation, then Esc skips.
  await js(`CC.open("orientation")`); await sleep(500);
  await js(`[...document.querySelectorAll("button")].find((b) => b.textContent === "Repeat induction").click()`); await sleep(600);
  log("repeat shown", await js(`!!document.getElementById("induction")`));
  await shot("repeat");
  await js(`dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))`); await sleep(600);
  log("after esc", await js(`!!document.getElementById("induction")`), await js(`localStorage.getItem("cc-induction")`));
};
