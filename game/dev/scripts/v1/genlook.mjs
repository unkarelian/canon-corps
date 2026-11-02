// A look at a generated world as the player first meets it: the field brief, the viewer index, a page.
export default async ({ js, sleep, shot }) => {
  await js(`CC.S.demi.busy = true`);
  await js(`(() => { const m = CC.S.mail.hq.find(m => /field brief/.test(m.subject)); document.querySelectorAll(".mail .list > div").forEach(d => { if (d.textContent.includes("field brief")) d.click(); }); })()`);
  await sleep(600); await shot("brief");
  await js(`CC.S.viewerBooted = true; CC.open("viewer")`); await sleep(800); await shot("viewer-index");
  const forum = await js(`CC.W.roots[1]`);
  await js(`CC.open("viewer", "${forum}")`); await sleep(800); await shot("viewer-forum");
};
