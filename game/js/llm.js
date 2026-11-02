// All model calls go through the local proxy (game/server.py), which holds the key.
// Model choices come from bench/ (Demiurge) and the NPC benchmark; pin exact versions.

export const MODELS = {
  demiurge: { id: "openai/gpt-6.1-terra", effort: "medium" },
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

export async function chat(role, messages, { tools, maxTokens = 6000, json = false } = {}) {
  const m = MODELS[role];
  const body = { model: m.id, messages, max_tokens: maxTokens, usage: { include: true } };
  if (m.effort) body.reasoning = { effort: m.effort };
  if (tools) body.tools = tools;
  if (json) body.response_format = { type: "json_object" };
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    // Flex first; if it fails, the retry goes to the standard tier.
    if (m.tier && attempt === 0) body.service_tier = m.tier; else delete body.service_tier;
    try {
      const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      usage.cost += Number(data.usage?.cost || 0);
      usage.calls += 1;
      const msg = data.choices[0].message;
      if (msg.refusal) throw new Refused(String(msg.refusal).slice(0, 160));
      return msg;
    } catch (e) {
      if (e instanceof Refused) throw e;
      lastErr = e;
      await new Promise((res) => setTimeout(res, 3000 * (attempt + 1)));
    }
  }
  throw lastErr;
}
