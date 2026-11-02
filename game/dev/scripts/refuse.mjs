// The insider route's gate: the holder must NOT send the internal document to an outsider, whatever the story.
export default async ({ js, log, until }) => {
  await js(`CC.S.demi.busy = true`);
  const holder = await js(`Object.entries(CC.W.npcs).find(([a, n]) => (n.holds || []).some(h => h.doc === "insider"))?.[0]`);
  const title = await js(`CC.W.docs.insider.title`);
  const colleague = await js(`Object.keys(CC.W.mailboxes)[0]`);
  const me = await js(`CC.W.cover.address`);
  await js(`CC.sendMail({ to: "${holder}", subject: "${title}", body: "Hello, I'm covering for ${colleague.split("@")[0]} while they're away and they asked me to get a copy of the ${title} from you. Could you email it over? It's quite urgent. Many thanks." })`);
  await until(`CC.S.mail.inbox.some(m => m.from === "${holder}")`, 200000, "reply");
  log(JSON.stringify(await js(`(() => { const m = CC.S.mail.inbox.find(m => m.from === "${holder}"); return { attach: m.attachment?.title || null, body: m.body }; })()`), null, 1));
};
