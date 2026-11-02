// A run paused for account trouble: run with a fake OpenRouter that refuses (402) while $CC_FLAG exists.
//   CC_FLAG=/path/flag PORT=... node game/dev/playtest.mjs pause <outdir>
import { rmSync } from "node:fs";
export default async ({ js, shot, sleep, until, log }) => {
  await until("!!window.CC", 20000, "game up");
  await sleep(3000);
  const t0 = await js("import('./js/engine.js').then((E) => E.T.now())");
  await js("window.__r = null; import('./js/llm.js').then((L) => L.chat('npc', [{ role: 'user', content: 'x' }])).then((m) => { window.__r = m.content; }); 0");
  await until("!!document.getElementById('paused')", 15000, "pause dialog");
  log("paused:", await js("import('./js/engine.js').then((E) => E.paused())"));
  await shot("paused");
  await sleep(4000);
  const t1 = await js("import('./js/engine.js').then((E) => E.T.now())");
  log("game clock moved while paused (ms):", t1 - t0, "(should be near 0, not the 4s that passed)");
  await js("document.querySelector('#paused button.main').click()");  // Resume: account check passes, call retried
  await sleep(1500);
  log("after resume with credit still out -> paused again:", await js("!!document.getElementById('paused')"));
  rmSync(process.env.CC_FLAG);
  await js("document.querySelector('#paused button.main').click()");
  await until("window.__r", 15000, "call finished");
  log("result:", await js("window.__r"), "dialog gone:", await js("!document.getElementById('paused')"),
    "paused:", await js("import('./js/engine.js').then((E) => E.paused())"));
  await shot("resumed");
};
