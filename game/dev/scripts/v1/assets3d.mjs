// The pre-rendered additions: forum avatars, mail portraits, paper documents, the uplink, a landmark, Form 77-R,
// and the boot screen. Run with WORLD=merrit (forum + school + mail from townspeople).
export default async ({ js, shot, sleep, log }) => {
  await js(`CC.S.viewerBooted = true`);
  const forum = await js(`CC.W.pages.find(p => /^\\[[\\w.-]+\\] /m.test(p.content))?.url`);
  log("forum page", forum);
  await js(`CC.open("viewer", ${JSON.stringify(forum)})`); await sleep(1200); await shot("forum");
  const school = await js(`CC.W.roots.find(r => /school|exchange|town/.test(r))`);
  await js(`CC.open("viewer", ${JSON.stringify(school)})`); await sleep(1200); await shot("landmark");
  await js(`CC.S.mail.inbox.push({ id: "t1", from: Object.keys(CC.W.npcs)[0], fromName: Object.values(CC.W.npcs)[0].name, to: CC.W.cover.address, subject: "Re: the minutes", body: "Thank you for writing. The minutes are kept at the town office.", time: "10:02" }); CC.emit("change")`);
  await js(`CC.open("mail")`); await sleep(600);
  await js(`[...document.querySelectorAll(".mail .list div")].find(e => e.textContent.includes("Re: the minutes"))?.click()`); await sleep(600); await shot("mail");
  await js(`(() => { const f = CC.downloadPage(${JSON.stringify(forum)}); CC.open("doc", f); })()`); await sleep(800); await shot("doc");
  await js(`CC.open("hq")`); await sleep(600);
  await js(`(() => { const w = [...document.querySelectorAll("#windows .win")].find(w => w.textContent.includes("HQ Console")); const s = w.querySelector("select"); s.value = CC.S.files[0].id; s.dispatchEvent(new Event("change")); [...w.querySelectorAll("button")].find(b => b.textContent === "Transmit").click(); })()`);
  await sleep(1500); await shot("uplink");
  await sleep(3000); await shot("uplink-done");
  js(`CC.win()`);
  await sleep(6500); await shot("form77");
  await sleep(12000); await shot("closed");
  await js(`localStorage.setItem("cc-intro-seen", "1"); location.href = "/?world=merrit"`); await sleep(1400); await shot("boot");
};
