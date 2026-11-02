// Audio smoke test: everything loads, music follows the stage, the endings cut it. No LLM calls
// (the Demiurge is kept busy so stage changes don't wake it).
export default async ({ js, sleep, log, shot }) => {
  await sleep(1500);
  await js(`document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))`);
  await sleep(1500);
  log("start", JSON.stringify(await js("CC.audioState()")));
  await js(`CC.S.demi.busy = true; CC.S.demi.wake = () => {}`);
  for (const n of [12, 23, 25, 40]) {
    await js(`CC.addNotice(${n}, "test")`);
    await sleep(800);
    log("notice", await js("CC.S.notice"), await js("CC.S.stage"), JSON.stringify(await js("CC.audioState()")));
  }
  for (const s of ["click", "mail", "flood", "transmit", "save", "print"]) log("play", s, !!(await js(`!!CC.play("${s}")`)));
  await js(`document.querySelector("#tray-snd").click()`);
  await sleep(300);
  await shot("snd-panel");
};
