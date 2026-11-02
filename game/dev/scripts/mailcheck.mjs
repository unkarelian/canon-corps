// Reproduce Mail problems: scroll position and selection across the per-second tick; layout with real mail.
export default async ({ js, sleep, shot, log }) => {
  await sleep(1500);
  await js(`CC.S().entity.busy = true; CC.S().started -= 60 * 60000; CC.E.tick()`);
  await js(`CC.E.queue({ from: "records@cityhall.hg", fromName: "Office of the City Clerk", to: CC.W.agent.address, subject: "Your CR-2 request: Harbour Board minutes, 1921", body: "Dear A. Reyes,\\n\\nPlease find attached the certified copy.\\n\\nOffice of the City Clerk", attachment: { title: "Harbour Board minutes, 1921", content: "..." } })`);
  await js(`document.querySelectorAll(".mail .folders div")[2].click()`); await sleep(300);
  await js(`document.querySelector(".mail .list").scrollTop = 300`); await sleep(100);
  log("list scrollTop before:", await js(`document.querySelector(".mail .list").scrollTop`));
  await sleep(2500);
  log("list scrollTop after 2.5s:", await js(`document.querySelector(".mail .list").scrollTop`));
  await js(`document.querySelectorAll(".mail .list > div")[5].click()`); await sleep(300);
  await js(`[...document.querySelectorAll(".mail .read button")].find(b => /Peek/.test(b.textContent))?.click()`); await sleep(300);
  await shot("mail-town-peek");
  await js(`document.querySelectorAll(".mail .folders div")[1].click()`); await sleep(300);
  await js(`document.querySelectorAll(".mail .list > div")[0].click()`); await sleep(400);
  await shot("mail-inbox");
  await js(`document.querySelectorAll(".mail .folders div")[0].click()`); await sleep(300);
  await js(`document.querySelectorAll(".mail .list > div")[0].click()`); await sleep(400);
  await shot("mail-hq");
};
