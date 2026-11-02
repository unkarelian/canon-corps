// All model calls go through the local proxy (game/server.py), which holds the key.
// Model choices come from bench/ (Demiurge) and the NPC benchmark; pin exact versions.

export const MODELS = {
  demiurge: { id: "openai/gpt-6.1-terra", effort: "medium" },
  entity_idle: { id: "openai/gpt-6.1-terra", effort: "low" },   // its unprompted look-rounds
  npc: { id: "google/gemini-3.8-flash", effort: "low", tier: "flex" }, // NPC bench: 9.4/10, ~4s on flex
  classifier: { id: "openai/gpt-6.1-terra", effort: "low" },
  worldgen: { id: "openai/gpt-6.1-terra", effort: "medium" },   // town design: structure and consistency
  worldagent: { id: "openai/gpt-6.1-terra", effort: "medium" }, // the town designer that works with tools
  worldtext: { id: "google/gemini-3.8-flash", effort: "low" },  // page prose, in parallel
  solver: { id: "google/gemini-3.8-flash", effort: "medium" },  // reads a generated town cold and tries to solve it
};

// In the browser this is the local proxy; dev scripts under node set an absolute URL.
let API = "/api/llm";
export const setAPI = (url) => { API = url; };

export const usage = { cost: 0, calls: 0 };

export class Refused extends Error {}

// Account trouble (no key, key revoked, out of credit) is not a failure of the call: the page registers a
// handler that pauses the run and resolves once the player has fixed it, and every call waiting on it then
// goes again. Without a handler (node dev scripts) it throws.
let accountHandler = null, gate = null;
export const onAccountProblem = (fn) => { accountHandler = fn; };
function accountTrouble(kind, message) {
  if (!accountHandler) throw new Error(`OpenRouter account problem (${kind}): ${message}`);
  gate ??= Promise.resolve(accountHandler(kind)).finally(() => { gate = null; });
  return gate;
}
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

export async function chat(role, messages, { tools, maxTokens = 6000, json = false } = {}) {
  const m = MODELS[role];
  const body = { model: m.id, messages, max_tokens: maxTokens, usage: { include: true } };
  if (m.effort) body.reasoning = { effort: m.effort };
  if (tools) body.tools = tools;
  if (json) body.response_format = { type: "json_object" };
  let lastErr;
  for (let attempt = 0, waits = 0; attempt < 3; attempt++) {
    if (gate) await gate; // a run paused for account trouble: nothing new goes out until it is fixed
    // Flex first; if it fails, the retry goes to the standard tier.
    if (m.tier && attempt === 0) body.service_tier = m.tier; else delete body.service_tier;
    let data;
    try {
      const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      data = await r.json();
      // the proxies sort OpenRouter's refusals: `account` pauses the run, `wait` is a full in-flight budget
      const code = data.error?.code;
      if (!data.account && (code === 401 || code === 402)) data.account = code === 401 ? "bad_key" : "no_credit"; // an error inside a 200
      if (data.account) { await accountTrouble(data.account, data.error); attempt--; continue; }
      if (data.wait && waits++ < 20) { await sleep(data.wait * 1000); attempt--; continue; }
      if (!r.ok || data.error) throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      usage.cost += Number(data.usage?.cost || 0);
      usage.calls += 1;
      const msg = data.choices[0].message;
      if (msg.refusal) throw new Refused(String(msg.refusal).slice(0, 160));
      return msg;
    } catch (e) {
      if (e instanceof Refused || !accountHandler && data?.account) throw e;
      lastErr = e;
      await sleep(3000 * (attempt + 1));
    }
  }
  throw lastErr;
}
