// The opening cinematic: green line-art panels with the Corps' account as subtitles. Plays before
// the first logon; ?intro replays it, ?nointro (or ?nosplash) skips it, and the Orientation app can replay it.
// Space, Enter or a click moves on to the next subtitle; Esc skips the rest.
import { OPENING, LOOPING } from "./lore.js";
import { music, ready } from "./audio.js";
import { el } from "./util.js";

const SEEN = "cc-intro-seen";
const LINE_HOLD = 1500, PANEL_FADE = 500;
// How long a subtitle stays up before the next beat: about the time the old typewriter took to type it.
const readTime = (line) => Math.max(1800, line.length * 48);

export const introDue = (params) => params.has("intro") || (!localStorage.getItem(SEEN) && !params.has("nosplash") && !params.has("nointro"));

export function playIntro() {
  return new Promise((resolve) => {
    const video = el("video", { muted: true, playsinline: true, preload: "auto" });
    video.muted = true;
    const text = el("div", { class: "intro-text" });
    const prompt = el("div", { class: "intro-prompt" }, "PRESS ANY KEY");
    const frame = el("div", { class: "intro-frame" }, video, text);  // subtitles sit on the picture, under the CRT
    const root = el("div", { id: "intro" }, frame, prompt, el("div", { class: "intro-skip" }, "Esc  skip"));
    document.body.append(root);

    let hurry = null, done = false;
    const wait = (ms) => new Promise((r) => { const t = setTimeout(r, ms); hurry = () => { clearTimeout(t); r(); }; });
    const finish = () => {
      if (done) return;
      done = true;
      localStorage.setItem(SEEN, "1");
      music(null, { fade: 2.5 });
      root.classList.add("leaving");
      setTimeout(() => { root.remove(); resolve(); }, 900);
      removeEventListener("keydown", onKey, true);
    };
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); finish(); return; }
      if (e.key === " " || e.key === "Enter" || e.key === "z") { e.preventDefault(); hurry?.(); }
    };
    root.addEventListener("click", () => hurry?.());

    const start = async () => {
      prompt.remove();
      addEventListener("keydown", onKey, true);
      await ready;
      music("intro_kept", { fade: 1.5, offsetFromCurrent: false });
      for (const panel of OPENING) {
        if (done) return;
        if (panel.music) music(panel.music, { fade: 2, offsetFromCurrent: false });
        video.src = `assets/film/${panel.shot}.webm`;
        video.loop = LOOPING.has(panel.shot);
        video.currentTime = 0;
        video.play().catch(() => {});
        frame.classList.remove("dim");
        text.textContent = "";
        for (const line of panel.lines) {
          if (done) return;
          text.replaceChildren(el("div", {}, line));  // subtitles pop up whole, like a fansub
          await wait(readTime(line));
          if (panel.cut && line === panel.lines.at(-1)) music(null, { fade: 0.02 }); // dead stop, once "halted." is read
          await wait(LINE_HOLD);
        }
        await wait(1200);
        frame.classList.add("dim");
        await new Promise((r) => setTimeout(r, PANEL_FADE));
      }
      finish();
    };
    const begin = (e) => {
      if (e.type === "keydown" && e.key === "Escape") { removeEventListener("keydown", begin, true); removeEventListener("pointerdown", begin, true); finish(); return; }
      removeEventListener("keydown", begin, true);
      removeEventListener("pointerdown", begin, true);
      start();
    };
    addEventListener("keydown", begin, true);
    addEventListener("pointerdown", begin, true);
  });
}
