export default async ({ js, shot, sleep, log }) => {
  await js(`CC.addNotice(110, "test"); CC.forceLeak("directory"); CC.forceLeak("referred")`);
  await js(`CC.open("intranet")`); await sleep(400);
  await js(`[...document.querySelectorAll(".intranet-page a")].find(a => a.textContent === "Staff directory").click()`); await sleep(400);
  log(await js(`(() => { const t = document.querySelector(".intranet-page").innerText; const i = t.indexOf("Desk 14"); return t.slice(i, i + 420); })()`));
};
