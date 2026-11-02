// Mail portrait and a new landmark (run with WORLD=0x0E5D, Cresscombe: it has a primary school).
export default async ({ js, shot, sleep, log }) => {
  await js(`CC.S.viewerBooted = true`);
  await js(`CC.open("viewer", "school.cc")`); await sleep(1200); await shot("school");
  const npc = await js(`JSON.stringify(Object.entries(CC.W.npcs)[0])`);
  log(npc.slice(0, 120));
  await js(`(() => { const [a, n] = Object.entries(CC.W.npcs)[0]; CC.S.mail.inbox.push({ id: "t1", from: a, fromName: n.name, to: CC.W.cover.address, subject: "Re: the minutes", body: "Thank you for writing. The minutes are kept at the town office.", time: "10:02" }); CC.emit("change"); })()`);
  await js(`CC.open("mail")`); await sleep(600);
  await js(`[...document.querySelectorAll(".mail div")].find(e => e.textContent.trim().startsWith("Field inbox"))?.click()`); await sleep(500);
  await js(`[...document.querySelectorAll(".mail .list div")].reverse().find(e => e.textContent.includes("Re: the minutes"))?.click()`); await sleep(600); await shot("mail");
};
