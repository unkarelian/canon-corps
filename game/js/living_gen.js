// Writing a town's timetable of small updates (see js/living.js). No browser imports, so dev scripts can use it.
const RANK = { QUIET: 0, STIRRING: 1, WATCHFUL: 2, FIXED: 3, SEARCHING: 4 };
const POST = /^\[([\w.-]+)\] /m;

// ---- writing the timetable (once per town) --------------------------------------------------------------
const NUM = "(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\\d+)";
const SEEDLIKE = new RegExp(`\\b${NUM}\\s+(?:of|out of|in)\\s+(?:the\\s+)?${NUM}\\b`, "i");

export function checkUpdates(w, list) {
  const pages = new Map(w.pages.map((p) => [p.url, p]));
  const handles = new Set(Object.values(w.npcs).map((n) => n.handle));
  for (const p of w.pages) for (const m of p.content.matchAll(new RegExp(POST, "gm"))) handles.add(m[1]);
  const secrets = [...Object.values(w.anchors || {}), ...Object.values(w.credentials || {}).flatMap((c) => [c.user, c.pass])]
    .filter((s) => s && String(s).length > 2).map((s) => String(s).toLowerCase());
  const urlRe = new RegExp(`[a-z0-9-]+\\.${w.tld}\\b|@`, "i");
  const ok = [], why = [];
  for (const u of list || []) {
    const p = pages.get(u.url);
    const text = String(u.text || "").replace(/\s+/g, " ").trim();
    const bad = !p ? "no such page" : p.requiresLogin ? "restricted page"
      : !["post", "news", "notice"].includes(u.kind) ? "kind"
      : u.kind === "post" && !(POST.test(p.content) && handles.has(u.handle)) ? "post needs a forum thread and a known handle"
      : text.length < 20 || text.length > 360 ? "length"
      : SEEDLIKE.test(text) ? "reads like a seed fragment"
      : secrets.some((s) => text.toLowerCase().includes(s)) ? "carries a secret"
      : urlRe.test(text) ? "addresses" : /password|canon corps|intruder|agent\b/i.test(text) ? "forbidden word" : null;
    if (bad) { why.push(`${u.url}: ${bad}`); continue; }
    ok.push({ after: Math.max(2, Math.min(120, Number(u.after) || 10)), stage: RANK[u.stage] ? u.stage : undefined,
      url: u.url, kind: u.kind, ...(u.kind === "post" ? { handle: u.handle } : {}), text });
  }
  return { ok: ok.sort((a, b) => a.after - b.after), why };
}

export async function townUpdates(w, chat, role = "worldtext") {
  const threads = w.pages.filter((p) => POST.test(p.content) && !p.requiresLogin);
  const roots = w.roots.map((r) => w.pages.find((p) => p.url === r)).filter(Boolean);
  const people = Object.values(w.npcs).map((n) => `${n.handle} (${n.name}, ${n.role})`).join("; ");
  const prompt = `You are writing the timetable of small things that happen on a town's websites over one evening, for a game.
The town: ${w.name}. ${w.story || ""}
Tone: ${typeof w.tone === "string" ? w.tone : JSON.stringify(w.tone)}. It is about 1999; the sites read like small-town websites of that time.

People and their forum handles: ${people}

Home pages (for news and notices):
${roots.map((p) => `- ${p.url}: ${p.title}`).join("\n")}

Forum threads (replies go at the end, as "[handle] text"):
${threads.map((p) => `--- ${p.url}\n${p.content.slice(0, 700)}`).join("\n")}

Write 10 to 12 updates as JSON: {"updates": [{"after": minutes, "stage": null|"STIRRING"|"WATCHFUL"|"FIXED", "url": "...", "kind": "post"|"news"|"notice", "handle": "for posts only", "text": "..."}]}
- Spread "after" between 3 and 90 minutes. Most have stage null.
- kind "post": a reply in one of the threads above, by one of those handles, in their voice, carrying the thread or the town's story on a little (opinions, small news, errands, the weather, who said what). 1 to 3 sentences.
- kind "news": a short item for a newspaper or noticeboard home page. kind "notice": a short notice for another home page (opening hours changed, a lost dog, a meeting moved). 1 to 2 sentences.
- Exactly three updates have a stage, one each of STIRRING, WATCHFUL, FIXED, and come later (after 25+). They are residents noticing small wrong things, stated plainly, not dramatically: an email that arrived late or not at all, a page that looked different yesterday, a phone that rang once, the feeling of being looked at, a word in a document they don't remember writing. Never say who or what is behind it, and never mention strangers, outsiders, investigators or anything the player may not have done.
- Never mention passwords, logins, web addresses, email addresses, or old records' contents. No numbers in the form "X of Y". No new people.
- Plain text, no markdown. Keep each person's way of writing from the threads.`;
  const msg = await chat(role, [{ role: "user", content: prompt }], { json: true, maxTokens: 4000 });
  const raw = JSON.parse(msg.content.slice(msg.content.indexOf("{"), msg.content.lastIndexOf("}") + 1));
  return checkUpdates(w, raw.updates);
}
