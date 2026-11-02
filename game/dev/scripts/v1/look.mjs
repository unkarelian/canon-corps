// Screenshots of the main surfaces, for judging art: logon, desktop, viewer on site home pages, HQ console, a memo.
export default async ({ js, sleep, shot }) => {
  await js(`CC.S.demi.busy = true`);
  await js(`(() => { const s = document.getElementById("splash"); s.hidden = false; s.classList.remove("leaving"); s.style.opacity = 1; })()`);
  await sleep(400); await shot("logon");
  await js(`document.getElementById("splash").hidden = true`);
  await sleep(200); await shot("desktop");
  await js(`CC.S.viewerBooted = true; CC.open("viewer")`); await sleep(900);
  const r = await js(`JSON.stringify(CC.W.roots)`); const roots = JSON.parse(r || "[]");
  for (const [i, u] of roots.entries()) { await js(`CC.open("viewer", ${JSON.stringify(u)})`); await sleep(500); await shot(`site-${i}`); }
  await js(`CC.open("mail")`); await sleep(500);
  await js(`document.querySelectorAll(".mail .list > div")[0]?.click()`); await sleep(500); await shot("memo");
  await js(`CC.open("hq")`); await sleep(700); await shot("hq");
  await js(`CC.S.stage = "FIXED"; CC.emit("change")`); await sleep(500); await shot("hq-fixed");
};
