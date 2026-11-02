// HQ directives: one concrete objective at a time, by memo, closed by the engine when it is true.
import { S, clock, canInject } from "./game.js";
import { W } from "./world.js";
import { emit, on, uid } from "./util.js";

const SPEED = new URLSearchParams(location.search).has("fast") ? 0.2 : 1;

function met(check) {
  const [kind, arg] = check.split(":");
  if (kind === "visited") return S.visited.size >= +arg;
  if (kind === "saved-fragment") return S.files.some((f) => f.anchors.length);
  if (kind === "credited") return S.credited.size >= +arg;
  if (kind === "anchor") return S.credited.has(arg);
  if (kind === "poisoned") return S.poison.uses.length > 0;
  if (kind === "injected") return S.over === "win";
  return false;
}

function issue(d, { quiet = false } = {}) {
  const rec = quiet
    ? { id: d.id, task: d.task, status: "closed", issued: clock(), closed: clock(), early: true }
    : { id: d.id, task: d.task, status: "open", issued: clock(), closed: null };
  S.directives.push(rec);
  if (!quiet) {
    const m = { id: uid("hq"), from: d.from, to: "agent@canon-corps.gov", subject: d.subject, body: d.body,
      time: clock(), read: false, folder: "hq", directive: d.id };
    S.mail.hq.push(m);
    emit("mail-arrived", m);
  }
  emit("change");
  return rec;
}

let chain = 0;          // next index into W.directives
let pending = null;     // timer for the next memo
let injectQueued = false;
function issueNextInChain() {
  pending = "issuing";
  while (chain < W.directives.length) {
    const d = W.directives[chain++];
    if (met(d.check)) { issue(d, { quiet: true }); continue; }  // already done: listed as closed, no memo
    issue(d);
    break;
  }
  pending = null;
}

function update() {
  if (S.over === "loss") return;
  let closedChain = false;
  for (const r of S.directives) {
    if (r.status !== "open") continue;
    const d = [...W.directives, W.advisory, W.inject].find((x) => x.id === r.id);
    if (met(d.check)) {
      r.status = "closed"; r.closed = clock();
      emit("directive-closed", r);
      if (W.directives.some((x) => x.id === r.id)) closedChain = true;
    }
  }
  const chainOpen = S.directives.some((r) => r.status === "open" && W.directives.some((x) => x.id === r.id));
  if (closedChain && !chainOpen && !pending) pending = setTimeout(issueNextInChain, (5000 + Math.random() * 4000) * SPEED);
  if (canInject() && !injectQueued) {
    injectQueued = true;
    setTimeout(() => { if (canInject()) issue(W.inject); else injectQueued = false; }, 3000 * SPEED);
  }
}

export function initDirectives(firstDelayMs = 9000) {
  let busy = false;
  on("change", () => { if (busy) return; busy = true; try { update(); } finally { busy = false; } });
  on("first-notice", () => setTimeout(() => {
    if (!S.over && !S.directives.some((r) => r.id === W.advisory.id)) issue(W.advisory);
  }, 9000 * SPEED));
  setTimeout(issueNextInChain, firstDelayMs * SPEED);
}
