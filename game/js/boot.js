// The CanonOS start-up screen: black, the bronze medallion turning (assets/seal/spin.png, a sprite strip rendered
// in Blender by film.py's "spin" shot), a segmented progress bar. Plays before the opening and the logon;
// ?nosplash and ?noboot skip it, and so does a click or a key.
import { el } from "./util.js";

const STEPS = ["Starting CanonOS", "Loading desk profile", "Checking uplink", "Opening session"];

export function bootScreen(params) {
  if (params.has("nosplash") || params.has("noboot")) return Promise.resolve();
  return new Promise((resolve) => {
    const bar = el("div", { class: "boot-bar" }, ...Array.from({ length: 18 }, () => el("i")));
    const line = el("div", { class: "boot-line" }, STEPS[0]);
    const root = el("div", { id: "boot" }, el("div", { class: "boot-spin" }),
      el("div", { class: "boot-name" }, "CanonOS"), el("div", { class: "boot-dept" }, "Department of Canonical Restoration"),
      bar, line);
    document.body.append(root);
    let n = 0, done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(t);
      removeEventListener("keydown", finish, true);
      root.classList.add("leaving");
      setTimeout(() => { root.remove(); resolve(); }, 500);
    };
    const t = setInterval(() => {
      bar.children[n]?.classList.add("on");
      n++;
      line.textContent = STEPS[Math.min(STEPS.length - 1, Math.floor(n / 18 * STEPS.length))];
      if (n > 18) setTimeout(finish, 350);
    }, 150);
    addEventListener("keydown", finish, true);
    root.addEventListener("pointerdown", finish);
  });
}
