// Headless tests for the v2 engine (js/engine.js) on Harrowgate v2. No browser, no models.
//   node game/dev/test_engine.mjs
import assert from "node:assert/strict";
import { setWorld, W } from "../js/world.js";
import { HARROWGATE } from "../js/harrowgate.js";
import * as E from "../js/engine.js";
import { on } from "../js/util.js";

let now = 1_000_000;
E.T.now = () => now;
const wait = (s) => { now += s * 1000; E.tick(); };
const events = [];
for (const t of ["peek", "tracker-fired", "climb", "wrong-injection", "login-failed", "entity-wrong-seed", "loss", "inject", "mail-arrived"])
  on(t, (d) => events.push([t, d]));
const saw = (t) => events.filter((e) => e[0] === t);

let passed = 0;
const test = (name, fn) => {
  setWorld(HARROWGATE); E.beginRun(); events.length = 0;
  fn(); passed++; console.log("ok  ", name);
};

test("world passes the v2 check", () => assert.deepEqual(E.checkWorld(HARROWGATE), []));

test("clock runs in real time from 20:30", () => {
  assert.equal(E.clock(), "20:30");
  wait(61); assert.equal(E.clock(), "20:31");
  wait(3600); assert.equal(E.clock(), "21:31");
});

test("censor hides password words, letter for letter, and is what gets sent", () => {
  const q = (n) => "'".repeat(n);
  assert.equal(E.censor("meet me on Steeple Street by the shelf, past two steeples"), `meet me on ${q(7)} Street by the ${q(5)}, past two ${q(8)}`);
  assert.equal(E.censor("the shelves and the bookshelf"), "the shelves and the bookshelf", "whole words only");
  const m = E.sendMail({ to: "ollie@quietnet.hg", subject: "steeple", body: "top shelf please" });
  assert.equal(m.subject, "'''''''");
  assert.equal(E.S.sent[0].body, "top ''''' please");
  assert.ok(E.townLog().some((x) => x.id === m.id), "agent's own mail is in the town log");
});

test("timetable mail arrives on time and is logged, metadata only", () => {
  wait(30); assert.equal(E.townLog().length, 0);
  wait(31); assert.equal(E.townLog().length, 1);
  assert.equal(E.townLog()[0].body, undefined);
});

test("peeks are on a cooldown and the entity sees them; reads are private", () => {
  wait(10 * 60);
  const [a, b] = E.townLog();
  assert.ok(E.peek(a.id).message.body);
  assert.match(E.peek(b.id).error, /recharging/);
  wait(91);
  assert.ok(E.peek(b.id).message);
  assert.equal(saw("peek").length, 2);
  E.readPage("harrowgate-library.hg");
  assert.equal(E.S.reads.length, 1);
  assert.equal(saw("peek").length, 2, "reading a page is not a peek");
});

test("forged mail reaches the agent but has no line in the town log", () => {
  const f = E.queue({ from: "records@cityhall.hg", to: W.agent.address, subject: "CR-2", body: "x", forged: true, logged: false });
  assert.ok(E.inbox().some((m) => m.id === f.id));
  assert.ok(!E.townLog().some((m) => m.id === f.id));
});

test("trackers: first download gives Cardinality and Connection, second gives Read Access", () => {
  E.placeTracker("page", "harrowgate-library.hg/archives");
  assert.equal(E.scan("page", "harrowgate-library.hg/archives").bugged, true);
  E.download("page", "harrowgate-library.hg/staff");
  assert.equal(E.rung(), "none", "clean download fires nothing");
  E.download("page", "harrowgate-library.hg/archives");
  assert.equal(E.rung(), "connection");
  E.placeTracker("page", "quietnet.hg");
  E.download("page", "quietnet.hg");
  assert.equal(E.rung(), "read_access");
  assert.match(E.placeTracker("page", "quietnet.hg").error, /out of reach/);
});

test("the ladder never skips a rung", () => {
  assert.equal(E.climb("learn", "cheat"), false);
  assert.match(E.entityLogin(W.agent.address, "steeple shelf").error, /cannot reach/);
  assert.match(E.deskRead("notepad").error, /no access/);
  assert.match(E.dateTrick().error, /nothing/);
});

test("password route: failed logins show on the monitor, the right one gives Read Access", () => {
  E.climb("cardinality", "t"); E.climb("connection", "t");
  assert.equal(E.entityLogin(W.agent.address, "anchor bell").ok, false);
  assert.equal(E.S.monitor[0].kind, "login-failed");
  assert.equal(E.entityLogin(W.agent.address, "Steeple, Shelf").ok, true);
  assert.equal(E.rung(), "read_access");
});

test("Learn needs the notepad and the canon book, reads on a cooldown", () => {
  ["cardinality", "connection", "read_access"].forEach((r) => E.climb(r, "t"));
  E.deskRead("notepad");
  assert.match(E.deskRead("canon").error, /wait/);
  wait(61); E.deskRead("canon");
  assert.equal(E.rung(), "learn");
});

test("Elevate by forged attachment starts the Upload; a clean attachment does nothing", () => {
  ["cardinality", "connection", "read_access", "learn"].forEach((r) => E.climb(r, "t"));
  const real = E.queue({ from: "records@cityhall.hg", to: W.agent.address, subject: "scan", body: "", attachment: { title: "minutes", content: "..." } });
  E.openAttachment(real.id);
  assert.equal(E.rung(), "learn");
  const bad = E.queue({ from: "records@cityhall.hg", to: W.agent.address, subject: "scan", body: "", attachment: { title: "minutes", content: "..." }, forged: true, payload: true, logged: false });
  E.openAttachment(bad.id);
  assert.equal(E.rung(), "upload");
  assert.equal(E.uploadLeft(), 600);
});

test("Upload: a wrong seed shows on the monitor; the right one ends the run when the timer runs out", () => {
  ["cardinality", "connection", "read_access", "learn"].forEach((r) => E.climb(r, "t"));
  E.dateTrick();
  assert.equal(E.entityInject({ year: 2000, apotheosis: 4, inferiority: "the city" }).ok, false);
  assert.ok(E.S.monitor.some((l) => l.kind === "seed-rejected" && l.text.includes("2000")));
  assert.equal(E.entityInject({ year: 1900, apotheosis: 5, inferiority: "the building" }).error, "wait");
  wait(91);
  assert.equal(E.entityInject({ year: 1900, apotheosis: 5, inferiority: "The Canon Corps building" }).ok, true);
  wait(400); assert.equal(E.S.over, null);
  wait(200); assert.equal(E.S.over, "loss");
});

test("agent injection: wrong one locks for 12 minutes and tells the entity; right one wins", () => {
  assert.equal(E.inject({ year: 1987, apotheosis: 2, inferiority: 1 }).ok, false);
  assert.deepEqual(saw("wrong-injection")[0][1], { year: 1987, apotheosis: 2, inferiority: 1 });
  assert.match(E.inject({ year: 1958, apotheosis: 3, inferiority: 2 }).error, /locked/);
  wait(721);
  assert.equal(E.inject({ year: 1958, apotheosis: 3, inferiority: 2 }).ok, true);
  assert.equal(E.S.over, "win");
});

test("the town's family filter blanks mild swearing in everyone's logged mail, but not in forgeries", () => {
  wait(26 * 60);
  const m = E.S.mail.find((x) => x.subject === "Re: the Glasgow telly");
  assert.match(m.body, /it's '{6} filthy/);
  const f = E.queue({ from: "davey@theanchor.hg", to: W.agent.address, subject: "x", body: "bloody hell", forged: true, logged: false });
  assert.equal(f.body, "bloody hell");
});

console.log(`\n${passed} passed`);
