// Which music is playing as the cinematic moves through its panels.
export default async ({ js, sleep, log }) => {
  await js(`location.search = location.search + "&intro"`);
  await sleep(2500);
  await js(`dispatchEvent(new KeyboardEvent("keydown", { key: "x" }))`);
  for (let p = 0; p < 10; p++) {
    await sleep(1800);
    log(`panel ${p}: ${await js(`document.querySelector(".intro-text")?.textContent.slice(0, 40)`)} | music=${await js(`CC.audioState().music`)}`);
    for (let i = 0; i < 6; i++) { await js(`dispatchEvent(new KeyboardEvent("keydown", { key: " " }))`); await sleep(250); }
    await sleep(600);
  }
};
