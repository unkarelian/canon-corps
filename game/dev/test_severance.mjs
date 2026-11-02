// Headless tests for severance (js/severance.js). node game/dev/test_severance.mjs
import assert from "node:assert/strict";
import { setWorld } from "../js/world.js";
import { HARROWGATE } from "../js/harrowgate.js";
import * as E from "../js/engine.js";
import * as SV from "../js/severance.js";
import { intranetPage } from "../js/canon.js";
import { emit } from "../js/util.js";

let now = 5_000_000;
E.T.now = () => now;
SV.initSeverance();
const start = () => {
  setWorld(HARROWGATE); E.beginRun();
  ["harrowgate-gazette.hg", "theanchor.hg", "cityhall.hg/harbour", "stbrendans.hg"].forEach((u) => E.readPage(u));
  ["cardinality", "connection", "read_access", "learn"].forEach((r) => E.climb(r, "t"));
  E.S.entity.readBranchRule = "21:00";
  emit("branch-rule-read", { by: "entity" });
};
const all = (u) => [...Array(E.S.pages[u].trueContent.split("\n").length).keys()];
let n = 0;
const test = (name, fn) => { start(); fn(); n++; console.log("ok  ", name); };

test("starts only once the entity has read the branch rule at Learn; the note appears in the archive", () => {
  assert.ok(SV.active());
  assert.equal(SV.secondsLeft(), 600);
  assert.ok(intranetPage("/archive").content.includes("c71-desk1-annex"));
  assert.match(intranetPage("/archive/c71-desk1-annex").content, /first three pages/);
  assert.deepEqual(SV.neededPages(), ["harrowgate-gazette.hg", "theanchor.hg", "cityhall.hg/harbour"]);
});

test("shown lines are true and in order; withheld lines are unmarked; size is in blocks", () => {
  SV.show("theanchor.hg", [3, 0, 1]);
  const r = E.S.severance.shown[0];
  assert.deepEqual(r.indices, [0, 1, 3]);
  assert.equal(r.lines[0], "THE ANCHOR");
  assert.equal(r.complete, false);
  assert.ok(r.size >= 5);
});

test("three complete clean records sever", () => {
  for (const u of SV.neededPages()) { SV.show(u, all(u)); SV.accept(E.S.severance.shown.at(-1).id); }
  assert.equal(E.S.over, "severed");
});

test("an incomplete clean record counts for nothing", () => {
  const [a, b, c] = SV.neededPages();
  SV.show(a, all(a).slice(1)); SV.accept(E.S.severance.shown.at(-1).id);
  for (const u of [b, c]) { SV.show(u, all(u)); SV.accept(E.S.severance.shown.at(-1).id); }
  assert.equal(E.S.over, null);
});

test("a bugged record, accepted, lets it through: Elevate, Upload, and it needs no seed", () => {
  const u = SV.neededPages()[0];
  SV.bug(u, 2);
  SV.show(u, all(u).filter((i) => i !== 2));
  SV.accept(E.S.severance.shown.at(-1).id);
  assert.equal(E.rung(), "upload");
  now += 601_000; E.tick();
  assert.equal(E.S.over, "loss");
});

test("a bugged line shown is visibly garbled", () => {
  const u = SV.neededPages()[1];
  SV.bug(u, 0);
  SV.show(u, all(u));
  assert.match(E.S.severance.shown.at(-1).lines[0], /[▒░▓]/);
  assert.equal(E.S.severance.shown.at(-1).flagShown, true);
});

test("a carrier can be taken back out", () => {
  const u = SV.neededPages()[0];
  SV.bug(u, 1); SV.unbug(u); SV.show(u, all(u));
  assert.equal(E.S.severance.shown.at(-1).bugged, false);
});

test("the countdown closes both ends", () => {
  now += 601_000;
  SV.tickSeverance();
  assert.equal(E.S.over, "closed");
});

console.log(`\n${n} passed`);
