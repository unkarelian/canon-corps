// The Canon Reference: a Keeper-era entry opens when clicked.
export default async ({ js, sleep, shot, log }) => {
  await sleep(1500);
  await js(`CC.S().entity.busy = true; CC.open("canon")`); await sleep(400);
  await js(`[...document.querySelectorAll(".canon-row.opens")].find(r => r.textContent.includes("'58"))?.click()`); await sleep(400);
  await js(`document.querySelector(".canon-row.sel")?.scrollIntoView()`); await sleep(200);
  log("open entry:", (await js(`document.querySelector(".centry")?.textContent`) || "none").slice(0, 120));
  await shot("canon-open");
};
