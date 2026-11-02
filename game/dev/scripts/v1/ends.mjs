export default async ({ js, sleep, log, shot }) => {
  await js(`document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))`);
  await sleep(1500);
  await js(`CC.S.demi.wakes.push({ time: "20:41", reasons: ["the intruder emailed ollie@harrowgate.hg"], calls: [{tool:"plan"}], effects: [], final: "x", emotion: { label: "CURIOSITY", confidence: 71 } })`);
  js("CC.win()");
  await sleep(4500);
  log("win form", JSON.stringify(await js("CC.audioState()")));
  await sleep(4500);
  log("after FEAR", JSON.stringify(await js("CC.audioState()")));
  await shot("fear");
  await sleep(6500);
  log("memo", JSON.stringify(await js("CC.audioState()")));
  await shot("memo");
};
