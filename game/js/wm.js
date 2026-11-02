import { el, emit } from "./util.js";
import { play } from "./audio.js";

const wins = new Map(); // id -> {node, app, title}
let z = 10, cascade = 0;
export const apps = {};

export function register(id, app) { apps[id] = app; }
const ICON16 = new Set(["mail", "viewer", "files", "scanner", "hq", "orientation", "notepad", "intranet", "canon"]); // assets/icons/<id>16.png, rendered in Blender

export function open(id, arg) {
  const app = apps[id];
  const key = app.multi ? `${id}-${Math.random().toString(36).slice(2, 6)}` : id;
  if (wins.has(key)) { focus(key); app.onOpen?.(wins.get(key).body, arg); return wins.get(key); }
  const body = el("div", { class: "body" });
  const node = el("div", { class: "win", style: `left:${app.x ?? 150 + cascade * 26}px;top:${app.y ?? 30 + cascade * 22}px;width:${app.w}px;height:${app.h}px` },
    el("div", { class: "bar" }, ICON16.has(id) ? el("img", { class: "ico", src: `assets/icons/${id}16.png`, alt: "" }) : "", el("span", { class: "t" }, app.title), el("button", { onclick: () => close(key), title: "Close" }, "x")),
    body);
  cascade = (cascade + 1) % 6;
  document.getElementById("windows").append(node);
  const w = { key, node, body, app, title: app.title };
  wins.set(key, w);
  drag(node, node.querySelector(".bar"));
  node.addEventListener("mousedown", () => focus(key));
  focus(key);
  play("open");
  app.render(body, arg, w);
  renderTasks();
  return w;
}

export function close(key) {
  const w = wins.get(key);
  if (!w) return;
  w.app.onClose?.(w);
  play("close");
  w.node.remove();
  wins.delete(key);
  renderTasks();
}

export function focus(key) {
  for (const [k, w] of wins) w.node.classList.toggle("focus", k === key);
  const w = wins.get(key);
  if (w) w.node.style.zIndex = ++z;
  renderTasks();
}

export function rerender(id) {
  const w = wins.get(id);
  if (w) w.app.render(w.body, undefined, w);
}
export const isOpen = (id) => wins.has(id);
export const windowNode = (id) => wins.get(id)?.node;
export const setTitle = (w, t) => { w.node.querySelector(".t").textContent = t; w.title = t; renderTasks(); };

function renderTasks() {
  const tasks = document.getElementById("tasks");
  tasks.replaceChildren(...[...wins.values()].map((w) =>
    el("div", { class: `task ${w.node.classList.contains("focus") ? "active" : ""}`, onclick: () => focus(w.key) }, w.title)));
  emit("wm");
}

function drag(node, handle) {
  handle.addEventListener("mousedown", (e) => {
    if (e.target.tagName === "BUTTON") return;
    const ox = e.clientX - node.offsetLeft, oy = e.clientY - node.offsetTop;
    const move = (ev) => {
      node.style.left = `${Math.max(-node.offsetWidth + 60, ev.clientX - ox)}px`;
      node.style.top = `${Math.max(0, ev.clientY - oy)}px`;
    };
    const up = () => { removeEventListener("mousemove", move); removeEventListener("mouseup", up); };
    addEventListener("mousemove", move);
    addEventListener("mouseup", up);
  });
}
