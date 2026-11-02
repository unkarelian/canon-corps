// Two desk apps: the agent's own Notepad, and the Corps intranet.
// The Notepad is the player's: nothing in the game reads it or alters it. Notes are kept per assignment.
// The intranet is the department's own pages (js/intranet_pages.js); a few of its lines are left to js/leaks.js.
import { register, setTitle } from "./wm.js";
import { W } from "./world.js";
import { S } from "./engine.js";
import { el, emit } from "./util.js";
import { intranetPage, BRANCH_RULE_PAGE } from "./canon.js";

// ---- Notepad ----------------------------------------------------------------------------------
const notesKey = () => `cc-notes-${W.id}`;
register("notepad", {
  title: "Notepad", w: 360, h: 430, x: 860, y: 60,
  render(body, _arg, w) {
    setTitle(w, `Notepad - ${W.id}`);
    if (!S.notepad) S.notepad = localStorage.getItem(notesKey()) || "";
    const t = el("textarea", { class: "notepad", spellcheck: "false", placeholder: "Notes for this assignment." });
    t.value = S.notepad;
    t.addEventListener("input", () => { S.notepad = t.value; localStorage.setItem(notesKey(), t.value); });
    body.replaceChildren(t);
    setTimeout(() => t.focus(), 0);
  },
});

// ---- Corps intranet -----------------------------------------------------------------------------
export const closedCount = () => +(localStorage.getItem("cc-closed") || 0);
export const recordClosed = () => localStorage.setItem("cc-closed", String(closedCount() + 1));

const net = { path: "/home", back: [] };
// Lines js/leaks.js may change once notice is high. Kept here so the page text stays the Corps' own.
export const intranetLeaks = { desk14Agent: null, desk14Former: null };

function pageText(path) {
  let t = intranetPage(path)?.content;
  if (!t) return null;
  t = t.replace("{DESK14}", String(closedCount()));
  if (path === "/directory") {
    if (intranetLeaks.desk14Agent) t = t.replace("Agent: (assigned), Room 215", `Agent: ${intranetLeaks.desk14Agent}, Room 215`);
    if (intranetLeaks.desk14Former) t = t.replace(/(Desk 14 \(Canonical Restoration\)[\s\S]*?Former occupants:\n(?:- .*\n)*)/, `$1- ${intranetLeaks.desk14Former}\n`);
  }
  return t;
}

function go(path) {
  if (path !== net.path) net.back.push(net.path);
  net.path = path;
  if (path === BRANCH_RULE_PAGE) { S.agentReadBranchRule ??= true; emit("branch-rule-read", { by: "agent" }); }
  render();
}
let current = null;
function render() { if (current) draw(current.body, current.w); }

function draw(body, w) {
  current = { body, w };
  const t = pageText(net.path);
  setTitle(w, `Corps Intranet - ${intranetPage(net.path)?.title || "not found"}`);
  const page = el("div", { class: "intranet-page" });
  if (!t) page.append(`No page at ${net.path}.`);
  else for (const line of t.split("\n")) {
    const m = line.match(/^> (.+?)\s{2,}(\/[\w/-]+)\s*$/);
    page.append(m ? el("div", {}, "> ", el("a", { onclick: () => go(m[2]) }, m[1])) : el("div", {}, line || " "));
  }
  body.replaceChildren(
    el("div", { class: "row" },
      el("button", { onclick: () => { if (net.back.length) { net.path = net.back.pop(); render(); } } }, "<"),
      el("button", { onclick: () => go("/home") }, "Home"),
      el("input", { class: "grow", value: `corps://intranet${net.path}`, readonly: true })),
    page);
}

register("intranet", {
  title: "Corps Intranet", w: 560, h: 480, x: 240, y: 70,
  render(body, _arg, w) { draw(body, w); },
});
