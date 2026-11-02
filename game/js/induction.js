// Workstation induction (CC-TR-02, Training): the first-run tutorial. Plays once, after the first logon, before
// the first directive. A spotlight moves over the desk while Training's captions explain each part in the Corps'
// own terms. Skippable (Esc or the button); repeatable from the Orientation app. ?induction forces it,
// ?noinduction (or ?nosplash) skips it. Remembered as `cc-induction` in localStorage.
//
// Register: dry procedure text, like the field brief. No jokes. The Corps' slant is only in what it says and omits.
import { W } from "./world.js";
import { el } from "./util.js";
import { open, isOpen, windowNode, focus } from "./wm.js";
import { play } from "./audio.js";

const KEY = "cc-induction";
export const inductionDue = (params) => params.has("induction")
  || (!localStorage.getItem(KEY) && !params.has("nosplash") && !params.has("noinduction"));

// Targets are looked up when the step is shown: windows may have moved.
const icon = (id) => () => document.getElementById(`icon-${id}`)?.closest(".icon");
const inWin = (id, sel) => () => (sel ? windowNode(id)?.querySelector(sel) : windowNode(id));

const STEPS = () => [
  { title: "Workstation induction",
    text: `This induction covers the CanonOS workstation issued to Desk 14. It takes about three minutes. It may be skipped, and can be repeated at any time from the Orientation app.` },
  { title: "Applications", target: () => document.getElementById("icons"),
    text: `Applications are opened by double-clicking their icons. Standard reconciliation procedure uses Mail, the Reality Viewer, Files, the Scanner, the HQ Console and the Canon Reference.` },
  { title: "Mail", target: inWin("mail"), win: "mail",
    text: `Memos from HQ are filed in the Canon Corps folder. Mail addressed to you in the reality is filed in Inbox. You are placed in the reality as ${W.agent.name} <${W.agent.address}>. Outgoing mail is carried on the connection.` },
  { title: "Town log", target: inWin("mail", ".folders"), win: "mail",
    text: `The town log lists every message that passes in the reality: sender, recipient, subject and time. Contents are not shown. A message may be opened with Peek. Peek recharges between uses, and each peek is observed by the local intelligence.` },
  { title: "Reality Viewer", target: icon("viewer"),
    text: `The Reality Viewer displays pages recovered from Reality ${W.id} (local name ${W.name}). Reading a page is not observed. Logging in, submitting a form and posting on a forum are carried on the connection.` },
  { title: "Downloads", target: icon("files"),
    text: `Download fixes a copy of a page or a message in Files, beyond interference. The local intelligence may place a mark on an item. A marked item reports its download. The Scanner detects marks before download.` },
  { title: "Canon Reference", target: icon("canon"),
    text: `The Canon Reference lists canonical events by year. The reality agrees with canon up to a point. The latest canonical event that the reality verifiably records gives the divergence year.` },
  { title: "Injection", target: inWin("hq", ".fs-inject"), win: "hq",
    text: `Enter the three findings, divergence, apotheosis and inferiority, and inject the reverse seed. A wrong injection is detected at once, discloses the values entered and locks the console for twelve minutes.` },
  { title: "Network monitor", target: inWin("hq", ".fs-monitor"), win: "hq",
    text: `The network monitor records failed access attempts on this workstation and any outbound transfer. It is maintained by Monitoring. An outbound transfer that completes closes the desk.` },
  { title: "Security Instruction 4", target: icon("notepad"),
    text: `Your workstation credential words are withheld from all agent input and appear as apostrophes. Notepad keeps notes on this workstation, one set per assignment.` },
  { title: "Corps Intranet", target: icon("intranet"),
    text: `The Corps Intranet carries departmental notices, the staff directory, Desk 9's detection figures, the canteen menu and the archive.` },
  { title: "End of induction", target: icon("orientation"),
    text: `Induction CC-TR-02 is complete and has been noted on your file. Background on the Keeper, the Rollover and restoration is given in the Orientation film, from which this induction can also be repeated.` },
];

let active = null;

export function playInduction() {
  if (active) return active;
  active = new Promise((resolve) => {
    const steps = STEPS();
    let i = 0;
    const spot = el("div", { class: "ind-spot" });
    const counter = el("span", { class: "muted small" });
    const title = el("div", { class: "ind-title" });
    const text = el("div", { class: "ind-text" });
    const back = el("button", { onclick: () => go(i - 1) }, "< Back");
    const next = el("button", { onclick: () => go(i + 1) }, "Next >");
    const skip = el("button", { onclick: () => finish("skipped") }, "Skip induction");
    const box = el("div", { class: "ind-box" },
      el("div", { class: "ind-bar" }, "Canon Corps Training", el("span", { class: "grow" }), counter),
      el("div", { class: "ind-inner" }, title, text,
        el("div", { class: "row ind-buttons" }, skip, el("span", { class: "grow" }), back, next),
        el("div", { class: "muted small ind-foot" }, "Prepared by Training (R. Achterberg). CC-TR-02, rev. 1.")));
    const root = el("div", { id: "induction" }, spot, box);
    document.body.append(root);

    function targetRect(s) {
      if (s.win && !isOpen(s.win)) open(s.win);
      const t = s.target?.();
      const nodes = (Array.isArray(t) ? t : [t]).filter(Boolean);
      if (!nodes.length) return null;
      const rs = nodes.map((n) => n.getBoundingClientRect());
      const r = { left: Math.min(...rs.map((r) => r.left)), top: Math.min(...rs.map((r) => r.top)),
        right: Math.max(...rs.map((r) => r.right)), bottom: Math.max(...rs.map((r) => r.bottom)) };
      return r.right > r.left ? r : null;
    }

    function place() {
      const s = steps[i];
      if (s.win && isOpen(s.win)) focus(s.win);  // bring it in front of other windows
      // Icons hidden behind windows are lifted above them (still under the overlay, which is 8500).
      document.getElementById("icons").style.zIndex = s.target && !s.win ? "8400" : "";
      const r = targetRect(s);
      const vw = innerWidth, vh = innerHeight, pad = 6, gap = 14;
      const bw = box.offsetWidth, bh = box.offsetHeight;
      if (!r) {
        spot.classList.add("none");
        Object.assign(spot.style, { left: `${vw / 2}px`, top: `${vh / 2}px`, width: "0px", height: "0px" });
        Object.assign(box.style, { left: `${(vw - bw) / 2}px`, top: `${(vh - bh) / 2}px` });
        return;
      }
      spot.classList.remove("none");
      const L = Math.max(0, r.left - pad), T = Math.max(0, r.top - pad);
      const Wd = Math.min(vw, r.right + pad) - L, Ht = Math.min(vh, r.bottom + pad) - T;
      Object.assign(spot.style, { left: `${L}px`, top: `${T}px`, width: `${Wd}px`, height: `${Ht}px` });
      // Right of the target, else left, else below, else above; clamped to the screen.
      let x, y;
      if (L + Wd + gap + bw <= vw) { x = L + Wd + gap; y = T; }
      else if (L - gap - bw >= 0) { x = L - gap - bw; y = T; }
      else if (T + Ht + gap + bh <= vh) { x = L; y = T + Ht + gap; }
      else { x = L; y = T - gap - bh; }
      x = Math.max(8, Math.min(vw - bw - 8, x));
      y = Math.max(8, Math.min(vh - bh - 38, y));
      Object.assign(box.style, { left: `${x}px`, top: `${y}px` });
    }

    function go(n) {
      if (n >= steps.length) return finish("done");
      i = Math.max(0, n);
      const s = steps[i];
      counter.textContent = `${i + 1} of ${steps.length}`;
      title.textContent = s.title;
      text.textContent = s.text;
      back.disabled = i === 0;
      next.textContent = i === steps.length - 1 ? "Begin assignment" : "Next >";
      skip.hidden = i === steps.length - 1;
      place();
      play("click");
    }

    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish("skipped"); }
      else if (e.key === "Enter" || e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); e.stopPropagation(); go(i + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); go(i - 1); }
    }
    function finish(how) {
      localStorage.setItem(KEY, how);
      removeEventListener("keydown", onKey, true);
      removeEventListener("resize", place);
      document.getElementById("icons").style.zIndex = "";
      root.classList.add("leaving");
      setTimeout(() => { root.remove(); active = null; resolve(how); }, 300);
    }
    addEventListener("keydown", onKey, true);
    addEventListener("resize", place);
    go(0);
  });
  return active;
}
