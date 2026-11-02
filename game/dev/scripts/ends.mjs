// The v2 endings, one after another (reloads between). Screenshots: win (Form 77-R), severed (epilogue),
// closed at both ends, loss (eye, seed, I FOUND YOU). Only the win's classifier may call a model.
export default async ({ js, sleep, shot, log }) => {
  const fresh = async () => { await js(`location.reload()`); await sleep(3500); };
  // win
  await js(`CC.E.inject({ year: CC.W.divergence.year, apotheosis: CC.W.apotheosis, inferiority: CC.W.inferiority.class })`);
  await sleep(9000); await shot("end-win"); await sleep(9000); await shot("end-win-closed");
  // severed
  await fresh();
  await js(`(async () => { const SV = await import("./js/severance.js");
    ["theanchor.hg","stbrendans.hg","cityhall.hg"].forEach(u => CC.E.readPage(u));
    ["cardinality","connection","read_access","learn"].forEach(r => CC.E.climb(r, "t"));
    CC.S().entity.readBranchRule = "21:00"; CC.S().entity.busy = true; SV.maybeStart();
    for (const u of SV.neededPages()) { SV.show(u, [...Array(CC.S().pages[u].trueContent.split("\\n").length).keys()]); SV.accept(CC.S().severance.shown.at(-1).id); } })()`);
  await sleep(4000); await shot("end-severed");
  // closed at both ends
  await fresh();
  await js(`(async () => { const SV = await import("./js/severance.js");
    ["cardinality","connection","read_access","learn"].forEach(r => CC.E.climb(r, "t"));
    CC.S().entity.readBranchRule = "21:00"; CC.S().entity.busy = true; SV.maybeStart(); CC.S().severance.deadline = Date.now(); })()`);
  await sleep(12000); await shot("end-closed");
  // loss
  await fresh();
  await js(`CC.S().entity.busy = true; ["cardinality","connection","read_access","learn"].forEach(r => CC.E.climb(r, "t")); CC.E.dateTrick(); CC.E.entityInject({year: 1900, apotheosis: 5, inferiority: "the building"}); CC.S().upload.startedAt -= 600000`);
  await sleep(9000); await shot("end-loss-eye"); await sleep(12000); await shot("end-loss-seed"); await sleep(9000); await shot("end-loss-found");
  log("done");
};
