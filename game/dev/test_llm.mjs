// The model-call wrapper's account handling, against a scripted fake proxy: account trouble pauses (and
// is not counted as a failed attempt), a full in-flight budget waits, concurrent calls share one pause.
//   node dev/test_llm.mjs
import * as L from "../js/llm.js";

let pass = 0;
const ok = (c, what) => { if (!c) { console.error("FAIL", what); process.exit(1); } pass++; };
const reply = (content) => ({ ok: true, json: async () => ({ choices: [{ message: { content } }], usage: { cost: 0.01 } }) });
const fail = (status, body) => ({ ok: false, status, json: async () => body });

let script = [], seen = 0;
globalThis.fetch = async () => { seen++; return script.shift()(); };
const origTimeout = globalThis.setTimeout; // the wrapper's back-off sleeps: run them at once
globalThis.setTimeout = (fn) => origTimeout(fn, 0);

// 1. no handler: account trouble throws instead of hanging
script = [() => fail(402, { error: "out", account: "no_credit" })];
try { await L.chat("npc", []); ok(false, "should throw"); } catch (e) { ok(/no_credit/.test(e.message), "throws without handler"); }

// 2. with a handler: pauses, resumes, retries, and the pause does not use up an attempt
const kinds = [];
L.onAccountProblem((k) => { kinds.push(k); return new Promise((r) => origTimeout(r, 30)); });
script = [() => fail(402, { account: "no_credit" }), () => fail(500, { error: "x" }), () => fail(500, { error: "x" }), () => reply("hi")];
seen = 0;
ok((await L.chat("npc", [])).content === "hi", "resumes after pause and still gets 3 real attempts");
ok(seen === 4 && kinds.join() === "no_credit", "one pause, four requests");

// 3. two calls hit trouble at once: one pause shared
kinds.length = 0;
script = [() => fail(401, { account: "bad_key" }), () => fail(401, { account: "bad_key" }), () => reply("a"), () => reply("b")];
const both = await Promise.all([L.chat("npc", []), L.chat("npc", [])]);
ok(both.map((m) => m.content).sort().join() === "a,b" && kinds.length === 1, "concurrent calls share one pause");

// 4. in-flight budget: waits, no pause, no attempt used
kinds.length = 0;
script = [() => fail(402, { wait: 1 }), () => fail(402, { wait: 1 }), () => reply("w")];
ok((await L.chat("npc", [])).content === "w" && kinds.length === 0, "in-flight budget just waits");

// 5. a 402 inside a 200 body still pauses
script = [() => ({ ok: true, json: async () => ({ error: { code: 402, message: "x" } }) }), () => reply("z")];
ok((await L.chat("npc", [])).content === "z" && kinds.join() === "no_credit", "402 in a 200 body pauses");

console.log(`${pass} passed`);
