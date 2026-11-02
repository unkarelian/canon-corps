// The opening cinematic, played through at normal speed.  node game/dev/record.mjs intro out.mp4 intro
export default async ({ js, sleep, until }) => {
  await js(`document.getElementById("demo-cursor").style.display = "none"`);
  await sleep(5000); // the CanonOS boot screen runs first
  await js(`dispatchEvent(new KeyboardEvent("keydown", { key: "x" }))`);
  await sleep(3000);
  await until(`!document.getElementById("intro")`, 240000, "intro end");
  await sleep(2500);
};
