// Logon splash and the viewer's first connection: screenshots along the way, including a seal frame.
export default async ({ js, sleep, log, shot }) => {
  await js(`history.replaceState(null, "", "/?fast"); location.reload()`);
  await sleep(2500);
  await shot("splash");
  await js(`document.getElementById("logon").dispatchEvent(new PointerEvent("pointerdown", {bubbles:true})); document.getElementById("logon").click()`);
  await sleep(1200);
  await shot("desktop");
  await js(`CC.open("viewer")`);
  // Watch for a seal frame and capture it.
  let got = 0;
  for (let i = 0; i < 400 && got < 2; i++) {
    const vis = await js(`(() => { const s = document.querySelector(".viewer .seal"); return s && !s.hidden ? s.src.split("/").pop() : ""; })()`);
    if (vis) { await shot(`seal-${got}-${vis}`); got++; await sleep(150); }
    await sleep(10);
  }
  await sleep(6000);
  log("booted", await js("CC.S.viewerBooted"), "music", JSON.stringify(await js("CC.audioState()")));
  await shot("viewer-after");
};
