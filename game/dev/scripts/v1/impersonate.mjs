// Impersonation in Harrowgate: log in as Marta, ask the Clerk for the 1921 minutes from her account
// (the Clerk sends copies to library staff), then have her notice and lock the agent out.
export default async ({ js, sleep, log, shot, until }) => {
  await js(`CC.S.demi.busy = true`);
  const ok = await js(`CC.login("harrowgate-library.hg/catalogue", "mhale", "ledger")`);
  log("login", ok, "identities", JSON.stringify(await js(`CC.S.identities`)));
  await js(`CC.TUNE.impersonationNoticedChance = 1; CC.TUNE.impersonationNoticedAfterSec = [40, 40]`);
  await js(`CC.sendMail({ from: "m.hale@harrowgate-library.hg", to: "records@cityhall.hg", subject: "Harbour Board minutes 1921",
    body: "Could you email me a certified copy of the Harbour Board minutes for 1921? Ours were never scanned and I have a reader asking. Thank you.\\n- M. Hale, Archives" })`);
  log("sent; post log from:", await js(`CC.S.postLog.at(-1).from`), "impersonating:", await js(`CC.S.postLog.at(-1).impersonating`));
  await until(`CC.S.mail.inbox.some(m => m.to === "m.hale@harrowgate-library.hg")`, 120000, "clerk reply");
  const r = await js(`(() => { const m = CC.S.mail.inbox.find(m => m.to === "m.hale@harrowgate-library.hg"); return m && { from: m.from, subject: m.subject, attach: m.attachment?.title, body: m.body }; })()`);
  log("reply to Marta's box:", JSON.stringify(r, null, 1));
  await js(`CC.open("mail")`); await sleep(500);
  await shot("impersonate-mail");
  await until(`!CC.S.identities["m.hale@harrowgate-library.hg"].active`, 90000, "revoked");
  log("revoked:", JSON.stringify(await js(`CC.S.identities`)), "notice", await js(`CC.S.notice`));
  log("login again:", await js(`CC.login("harrowgate-library.hg/catalogue", "mhale", "ledger")`));
  await until(`CC.S.pages["quietnet.hg/forum/t/96"].content.split("[m.hale]").length > 3`, 90000, "forum post");
  log("t/96 now:\\n" + await js(`CC.S.pages["quietnet.hg/forum/t/96"].content`));
  await js(`CC.open("compose")`); await sleep(400);
  await shot("impersonate-after");
};
