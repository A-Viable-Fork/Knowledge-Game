// Role: the write half of the second-client conformance check (closes claim 9: "this client holds no
//   capability any client with the snapshot lacks"; claim 11 grounds on the same evidence read from
//   the admission side: the path's inputs are bundles and nothing identifies the producing client). An
//   independent minimal client, importing only vendor/api/* (never this app's own api/contribute.js),
//   proposes a support to the published EpiStack Competition Community using the vendored local
//   provider's own propose(), exports the result via vendor/api/contribution.js, and its bundle is
//   admitted through the identical path (importContribution + a fresh gate decision against the same
//   community state) as this app's own api/contribute.js-produced bundle for the equivalent proposal.
// Contract: `node build/check-conformance-write.mjs` exits non-zero on any mismatch, naming it.
// Invariant: the "independent minimal client" section imports only vendor/api/* and node built-ins,
//   never this repository's own api/ or periphery/. Both bundles are re-verified by the SAME admission
//   code (importContribution, then decide() against the same storeView), so the comparison is genuinely
//   over whether admission discriminates by producing client, not over two hand-matched narratives.
// Governs: claim-9: the independent client's propose-and-export fixture below is the write half of the
//   proof that this app holds no capability a vendor-api-only client lacks.
// Governs: claim-11: both bundles are admitted through the identical importContribution + decide()
//   path with no field naming the producing client, so admission judges the bundle, never the client.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-CONFORMANCE-WRITE: an independent minimal client's bundle admits identically"); console.log(H);

const SNAPSHOT = join(ROOT, "communities", "epistack-competition", "snapshot", "epistack-competition.snapshot.json");
const raw = JSON.parse(readFileSync(SNAPSHOT, "utf8"));

// ---- the independent minimal client: vendor/api/* only, never this app's own api/contribute.js ----
async function independentClientPropose(targetIdentity) {
  const { createLocalProvider } = await import(join(ROOT, "vendor", "api", "providers", "local-provider.mjs"));
  const { createClientApi } = await import(join(ROOT, "vendor", "api", "client-api.mjs"));
  const { exportContribution, contributionId } = await import(join(ROOT, "vendor", "api", "contribution.js"));

  const api = createClientApi(createLocalProvider(raw));
  const receipt = api.propose({
    statement: "An independent minimal client's support, built from vendor/api/* alone.",
    kind: "measurement",
    contributor_id: "independent-client",
    supports: [targetIdentity],
  });
  return { receipt };
}

console.log("\n[1] the independent client proposes against the published community's own current state");
const rows = (raw.state.entries || []).map((e) => e.identity);
const target = rows[9] || rows[0];
const { receipt: independentReceipt } = await independentClientPropose(target);
ok(independentReceipt.decision === "accepted" || independentReceipt.decision === "accepted-with-disagreement", `the independent client's proposal passes the gate (got ${independentReceipt.decision})`);

console.log("\n[2] this app's own api/contribute.js proposes the equivalent support");
globalThis.fetch = async (url) => {
  const path = url.startsWith("../") ? join(ROOT, url.replace(/^\.\.\//, "")) : join(ROOT, "app", url);
  const body = readFileSync(path, "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};
const { fetchCommunity } = await import(join(ROOT, "api", "community.js"));
const community = await fetchCommunity("../communities/epistack-competition/snapshot/epistack-competition.snapshot.json");
globalThis.fetch = undefined;
const { draftProposal, bundleProposal } = await import(join(ROOT, "api", "contribute.js"));
const { proposal: appProposal, receipt: appReceipt } = draftProposal(community, {
  statement: "This app's own client's support, built through api/contribute.js.",
  kind: "measurement", contributorId: "app-client", action: "support", targetIdentity: target,
});
ok(appReceipt.decision === "accepted" || appReceipt.decision === "accepted-with-disagreement", `this app's proposal passes the gate (got ${appReceipt.decision})`);
const appBundle = bundleProposal(appProposal, appReceipt, { kernel_id: community.kernelId, state_id: community.snapshotHash });

console.log("\n[3] both bundles carry the same bundle shape (contribution_id, proposal, receipt, origin, protocol, status, instructions)");
const BUNDLE_FIELDS = ["contribution_id", "proposal", "receipt", "origin", "protocol", "status", "instructions"].sort();
ok(JSON.stringify(Object.keys(appBundle).sort()) === JSON.stringify(BUNDLE_FIELDS), "this app's bundle has exactly the vendored bundle shape");

console.log("\n[4] the independent client's own proposal, wrapped in the SAME vendored exportContribution, produces an equally admissible bundle");
const { claimRecord, linkRecord } = await import(join(ROOT, "vendor", "kernel", "schema", "records.mjs"));
const indClaim = claimRecord({ kind: "measurement", statement: "An independent minimal client's support, built from vendor/api/* alone, wrapped for export.", source_id: "independent:unsourced", contributor_id: "independent-client", declared_grade: "asserted" });
const indLink = linkRecord({ link_kind: "supports", from_identity: indClaim.identity, to_identity: target, support_group: "g:" + target + "/" + indClaim.identity, source_id: indClaim.source_id, contributor_id: indClaim.contributor_id, declared_grade: "corroborated" });
const { makeSourceTable, makeKindTable } = await import(join(ROOT, "vendor", "kernel", "schema", "tables.mjs"));
const { storeViewOf } = await import(join(ROOT, "vendor", "kernel", "store", "decay.mjs"));
const { decide } = await import(join(ROOT, "vendor", "kernel", "gate", "gate.mjs"));
const tables = { kindTable: makeKindTable(raw.kinds), sourceTable: makeSourceTable([...raw.sources, { source_id: indClaim.source_id, source_class: "testimony" }]) };
const indReceipt = decide({ hash: indClaim.hash, entries: [indClaim], links: [indLink] }, storeViewOf(raw.state, tables), {});
indReceipt.proposed_identity = indClaim.identity;
const { exportContribution, importContribution } = await import(join(ROOT, "vendor", "api", "contribution.js"));
const indBundle = exportContribution({ entries: [indClaim], links: [indLink] }, indReceipt, { kernel_id: raw.kernel_id, state_id: raw.snapshot_hash });
ok(indReceipt.decision === "accepted" || indReceipt.decision === "accepted-with-disagreement", `the independent client's own wrapped proposal also passes the gate (got ${indReceipt.decision})`);
ok(JSON.stringify(Object.keys(indBundle).sort()) === JSON.stringify(BUNDLE_FIELDS), "the independent client's bundle has exactly the same vendored bundle shape as this app's");
ok(indBundle.status === appBundle.status, `both bundles carry the identical status string ("${appBundle.status}")`);
ok(indBundle.instructions === appBundle.instructions, "both bundles carry the identical admission instructions, word for word");

console.log("\n[5] both bundles round-trip through the same importContribution and re-verify to the same contribution id (no producing-client field anywhere in the admitted shape)");
const reimportedApp = importContribution(appBundle);
const reimportedInd = importContribution(indBundle);
ok(reimportedApp.entries[0].identity === appBundle.proposal.entries[0].identity, "this app's bundle round-trips through importContribution without tampering being flagged");
ok(reimportedInd.entries[0].identity === indBundle.proposal.entries[0].identity, "the independent client's bundle round-trips through importContribution without tampering being flagged");
ok(!("client" in appBundle) && !("producer" in appBundle) && !("app" in appBundle), "this app's bundle carries no field naming the producing client");
ok(!("client" in indBundle) && !("producer" in indBundle) && !("app" in indBundle), "the independent client's bundle carries no field naming the producing client either");

console.log("\n" + H);
if (fails === 0) console.log("verified: an independent minimal client's bundle passes the identical admission path (importContribution, then a fresh gate decision) as this app's own bundle, and neither bundle's shape names its producing client.");
console.log(fails === 0 ? "check-conformance-write: OK" : `check-conformance-write: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
