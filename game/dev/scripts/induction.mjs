// The v2 induction: every step's spotlight finds its target. Screenshots of each step.
export default async ({ js, sleep, shot, log }) => {
  await sleep(1500);
  await js(`CC.S().entity.busy = true; import("./js/induction.js").then(m => { window.__ind = m.playInduction(); })`);
  await sleep(800);
  for (let i = 0; i < 12; i++) {
    const t = await js(`document.querySelector(".ind-title")?.textContent`);
    const none = await js(`document.querySelector(".ind-spot")?.classList.contains("none")`);
    log(`${i + 1}. ${t}: ${none ? "no target (centred)" : "spotlight ok"}`);
    await shot(`ind-${String(i + 1).padStart(2, "0")}`);
    await js(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))`);
    await sleep(500);
  }
};
