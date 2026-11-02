// Notepad, Corps intranet, desktop leaks, living town updates, the visitor counter, the ambience mix.
// WORLD=0x5128 (Merrit).
export default async ({ js, shot, sleep, log }) => {
  await js(`CC.S.viewerBooted = true`);
  await js(`CC.open("notepad")`); await sleep(400);
  await js(`(() => { const t = document.querySelector(".notepad"); t.value = "lenw = Leonard Wirth, archive\\nscale minutes: town office, form R-2\\nfelix: surname + year?"; t.dispatchEvent(new Event("input")); })()`);
  await sleep(300); await shot("notepad");
  await js(`CC.open("intranet")`); await sleep(500); await shot("intranet-home");
  await js(`[...document.querySelectorAll(".intranet-page a")].find(a => a.textContent === "Staff directory").click()`); await sleep(400);
  await js(`CC.addNotice(65, "test")`); await sleep(300);
  for (const k of ["icon-order", "wallpaper", "directory", "referred", "shortcut", "memo-word", "clock", "title"]) log(k, await js(`String(CC.forceLeak(${JSON.stringify(k)}))`));
  await js(`CC.open("intranet")`); await sleep(300);
  await js(`[...document.querySelectorAll(".intranet-page a")].find(a => a.textContent === "Staff directory")?.click()`); await sleep(300);
  await js(`document.querySelector(".intranet-page").scrollTop = 400`); await sleep(300); await shot("leaks");
  log("leaks", await js(`JSON.stringify(CC.S.leaks.map(l => l.kind + ":" + l.detail))`));
  log("ambience", await js(`JSON.stringify(CC.audioState())`));
  await js(`CC.W.updates.forEach(u => { u.after = 0; })`); await sleep(2500);
  log("applied", await js(`CC.S.applied.size + "/" + CC.W.updates.length`));
  await js(`CC.open("viewer", "exchange.me/forum/t/336")`); await sleep(800);
  await js(`document.querySelector(".viewer .screen").scrollTop = 9999`); await sleep(300); await shot("living-forum");
  await js(`CC.open("viewer", "register.me")`); await sleep(800); await shot("living-news");
};
