// Prints every directive a world would issue, to check the text builds (no "undefined", placeholders filled).
export default async ({ js, log }) => {
  const r = await js(`JSON.stringify((CC.W.directives || []).map(d => d.id + " | " + d.subject + " | " + /undefined|\\$\\{/.test(d.body)))`);
  log(r);
  log(await js(`(CC.W.directives || []).find(d => /restricted/.test(d.subject))?.body.split("\\n\\n")[2]`));
};
