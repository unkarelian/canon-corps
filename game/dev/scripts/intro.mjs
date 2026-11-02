// The opening cinematic: reload with ?intro, press a key, hurry through and screenshot panels; then Orientation.
export default async ({ js, sleep, shot }) => {
  await js(`location.search = location.search + "&intro"`);
  await sleep(2500);
  await js(`dispatchEvent(new KeyboardEvent("keydown", { key: "x" }))`);
  for (let p = 0; p < 10; p++) {
    await sleep(2600); await shot(`intro-${p}`);
    for (let i = 0; i < 6; i++) { await js(`dispatchEvent(new KeyboardEvent("keydown", { key: " " }))`); await sleep(250); }
    await sleep(700);
  }
  await sleep(3000);
  await js(`document.getElementById("splash").hidden = true`);
  await js(`CC.open("orientation")`); await sleep(800);
  await js(`document.querySelectorAll(".orient .chapters button")[3].click()`); await sleep(1500); await shot("orient-4");
  await js(`document.querySelectorAll(".orient .chapters button")[4].click()`); await sleep(2500); await shot("orient-5");
};
