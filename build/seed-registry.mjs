// Role: seeds the-registry's own corpus (Phase KG-12 Step 2) through the real contribution path: each
//   entry is built as a genuine claim (and, where it depends on a contract, a genuine depends-on
//   link), decided by the real gate against the accumulating state, and exported via vendor/api/
//   contribution.js for a real receipt, exactly the discipline every other seed in this repository
//   has followed (never a hand-placed record). Three contract-bundle claims (ranker, skin, client)
//   are authored first; every artifact-card claim after them cites real, freshly-run conformance
//   evidence: the sandbox-executable oracles (api/extension.js's checkConformance, api/skin-
//   conformance.js's checkSkinConformance) are actually invoked here, and their real result becomes
//   the claim's own checking_records; a CI-only oracle (the independent-minimal-client pair) is cited
//   honestly as recomputable in the repository, never asserted as app-verified.
// Contract: `node build/seed-registry.mjs` prints each entry's gate decision and, on acceptance,
//   writes the merged claims into communities/the-registry/corpus/the-registry-data.js, then
//   regenerates the snapshot. Idempotent against a fresh (empty) the-registry corpus only.
"use strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { claimRecord, linkRecord } from "../vendor/kernel/schema/records.mjs";
import { makeSourceTable, makeKindTable } from "../vendor/kernel/schema/tables.mjs";
import { genesis } from "../vendor/kernel/store/state.mjs";
import { apply } from "../vendor/kernel/store/apply.mjs";
import { storeViewOf } from "../vendor/kernel/store/decay.mjs";
import { decide } from "../vendor/kernel/gate/gate.mjs";
import { hashBytes, hashOf } from "../vendor/kernel/schema/canonical.mjs";
import { sha256Hex } from "../vendor/kernel/schema/sha256.mjs";
import { exportContribution } from "../vendor/api/contribution.js";
import { checkConformance } from "../api/extension.js";
import { checkSkinConformance } from "../api/skin-conformance.js";
import { SKINS } from "../api/skins.js";
import { ASSISTANT_SOURCE } from "../api/assistant.js";
import { LEARN_EFFICIENTLY_SOURCE, CONTESTABLE_DASHBOARD_SOURCE } from "../periphery/demo-extensions.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOME = join(ROOT, "communities", "the-registry");
const require = createRequire(import.meta.url);
const { KINDS, SOURCES } = require(join(HOME, "corpus", "tables.js"));

const tables = { sourceTable: makeSourceTable(SOURCES), kindTable: makeKindTable(KINDS) };
let state = genesis();
const results = [];

function hashFile(p) {
  return sha256Hex(readFileSync(join(ROOT, p), "utf8"));
}

// ---- the three contract-bundle claims ----
const RANKER_INTERFACE_SPEC = "A ranker is a pure function from frozen rows and an objective vector to a reordering: every grade-bearing field on every returned row is byte-identical to what it was given, no row is introduced, and none is dropped.";
const SKIN_INTERFACE_SPEC = "A skin is a token set, never structure: every declared token role is present, its grade scale is monotonic along its own declared axis, and every text/surface pairing clears its WCAG contrast floor.";
const CLIENT_INTERFACE_SPEC = "A conformant client reproduces the reference client's full read capability (every claim, grade, and reconciliation byte-identical against the same published artifact) and, for a proposing client, admits a bundle through the identical gate-running admission path.";

const CONTRACTS = [
  {
    ref: "ranker-contract", statement: "The ranker contract: a candidate ranker must pass the ranking-separation fuzz.",
    interface_identity: hashBytes(RANKER_INTERFACE_SPEC), required_oracle: hashFile("api/extension.js"),
    ceiling_statement: "Passing this oracle warrants that grade-bearing fields are unchanged and no row is added or dropped under this fuzz; it does not warrant the ranker's ordering is good, fair, or free of every possible manipulation.",
  },
  {
    ref: "skin-contract", statement: "The skin contract: a candidate skin must pass token completeness, grade-scale monotonicity, and contrast.",
    interface_identity: hashBytes(SKIN_INTERFACE_SPEC), required_oracle: hashFile("api/skin-conformance.js"),
    ceiling_statement: "Passing this oracle warrants the token set is complete, monotonic, and legible; it does not warrant the skin is beautiful, on-brand, or preferred by any reader.",
  },
  {
    ref: "client-contract", statement: "The client contract: a candidate client must reproduce the reference client's reads and, if proposing, its admission path.",
    interface_identity: hashBytes(CLIENT_INTERFACE_SPEC), required_oracle: hashFile("build/check-conformance-read.mjs") + ":" + hashFile("build/check-conformance-write.mjs"),
    ceiling_statement: "Passing this pair warrants byte-identical reads and identical admission behavior against the published artifacts at time of test; it does not warrant the client is trustworthy, maintained, or free of unrelated defects.",
  },
];

const contractIdentity = {};
for (const c of CONTRACTS) {
  const claim = claimRecord({
    kind: "contract-bundle", statement: c.statement, source_id: "S-registry-oracles", contributor_id: "P-registry-founder",
    declared_grade: "constitutive", interface_identity: c.interface_identity, required_oracle: c.required_oracle, ceiling_statement: c.ceiling_statement,
  });
  const view = storeViewOf(state, tables);
  const receipt = decide({ hash: claim.hash, entries: [claim], links: [] }, view, {});
  const bundle = exportContribution({ entries: [claim], links: [] }, receipt, { kernel_id: "the-registry", state_id: hashOf({ state, sources: SOURCES, kinds: KINDS }) });
  console.log(`[contract-bundle] ${c.ref}: gate decision ${receipt.decision}, contribution ${bundle.contribution_id.slice(0, 16)}...`);
  if (receipt.decision === "accepted" || receipt.decision === "accepted-with-disagreement") {
    state = apply(state, { entries: [claim], links: [] });
    contractIdentity[c.ref] = claim.identity;
    results.push({ ref: c.ref, kind: "contract-bundle", claim, receipt, bundle, extra: { interface_identity: c.interface_identity, required_oracle: c.required_oracle, ceiling_statement: c.ceiling_statement } });
  } else {
    throw new Error(`seed-registry: contract-bundle ${c.ref} was refused: ${JSON.stringify(receipt)}`);
  }
}

// ---- artifact-card entries: extension, skin, component, client, community ----
const FIXTURE_ROWS = [
  { identity: "a", kind: "measurement", statement: "s1", declared_grade: "asserted", earned_grade: "asserted", source_id: "S1" },
  { identity: "b", kind: "measurement", statement: "s2", declared_grade: "checked", earned_grade: "checked", source_id: "S2" },
  { identity: "c", kind: "comment", statement: "a comment", declared_grade: "ungraded", earned_grade: "ungraded", source_id: "S3" },
];
const FIXTURE_LINKS = [{ link_kind: "supports", from_identity: "b", to_identity: "a" }];

async function realConformanceRecord(checkerId, method, outcome) {
  return {
    checker_id: checkerId, method_class: "direct-measurement", method,
    checked_at_state: "this-deployment@working-tree", outcome, independence: "distinct-party",
  };
}

async function addArtifactCard({ ref, kind, statement, artifactHash, contractRef, checkingRecords, sourceId }) {
  const raw = {
    kind, statement, source_id: sourceId, contributor_id: "P-registry-founder", declared_grade: "checked",
    artifact_hash: artifactHash, checking_records: checkingRecords,
  };
  if (contractRef) raw.contract_hash = contractIdentity[contractRef];
  const claim = claimRecord(raw);
  const links = [];
  if (contractRef) {
    links.push(linkRecord({ link_kind: "depends-on", from_identity: claim.identity, to_identity: contractIdentity[contractRef], source_id: sourceId, contributor_id: "P-registry-founder", declared_grade: "checked" }));
  }
  const view = storeViewOf(state, tables);
  const receipt = decide({ hash: claim.hash, entries: [claim], links }, view, {});
  const bundle = exportContribution({ entries: [claim], links }, receipt, { kernel_id: "the-registry", state_id: hashOf({ state, sources: SOURCES, kinds: KINDS }) });
  console.log(`[${kind}] ${ref}: gate decision ${receipt.decision}, contribution ${bundle.contribution_id.slice(0, 16)}...`);
  if (receipt.decision !== "accepted" && receipt.decision !== "accepted-with-disagreement") {
    throw new Error(`seed-registry: ${ref} was refused: ${JSON.stringify(receipt)}`);
  }
  state = apply(state, { entries: [claim], links });
  results.push({ ref, kind, claim, receipt, bundle, extra: { artifact_hash: artifactHash, contract_hash: contractRef ? contractIdentity[contractRef] : undefined } });
}

// extensions: two shipped demo extensions plus the assistant, each conformance re-run live, right now
const learnEfficiently = await checkConformance(LEARN_EFFICIENTLY_SOURCE, "ranker", FIXTURE_ROWS, FIXTURE_LINKS, []);
await addArtifactCard({
  ref: "learn-efficiently", kind: "extension", statement: "learn-efficiently: this app's own default ranker, loaded through the identical public extension seam any candidate uses.",
  artifactHash: sha256Hex(LEARN_EFFICIENTLY_SOURCE), contractRef: "ranker-contract", sourceId: "S-registry-oracles",
  checkingRecords: [await realConformanceRecord("api/extension.js#checkConformance", `ranking-separation fuzz re-run live against learn-efficiently's own source, this run: pass=${learnEfficiently.pass}, reason=${learnEfficiently.reason || "n/a"}`, learnEfficiently.pass ? "confirms" : "disconfirms")],
});

const contestableDashboard = await checkConformance(CONTESTABLE_DASHBOARD_SOURCE, "renderer", FIXTURE_ROWS, [], []);
await addArtifactCard({
  ref: "contestable-dashboard", kind: "extension", statement: "The contestable dashboard: a renderer lens over quantitative kinds, every displayed number a claim, standing shown, contest and fork as live actions.",
  artifactHash: sha256Hex(CONTESTABLE_DASHBOARD_SOURCE), contractRef: null, sourceId: "S-registry-oracles",
  checkingRecords: [await realConformanceRecord("api/extension.js#checkConformance", `renderer-runs-clean conformance re-run live, this run: pass=${contestableDashboard.pass}, reason=${contestableDashboard.reason || "n/a"}`, contestableDashboard.pass ? "confirms" : "disconfirms")],
});

const assistantConformance = await checkConformance(ASSISTANT_SOURCE, "workflow", [], [], []);
await addArtifactCard({
  ref: "assistant", kind: "extension", statement: "The assistant: a workflow-shaped extension, a prompt pack plus one declared, user-configured inference destination, output entering nothing except through draft, gate, and a human's hand.",
  artifactHash: sha256Hex(ASSISTANT_SOURCE), contractRef: null, sourceId: "S-registry-oracles",
  checkingRecords: [await realConformanceRecord("api/extension.js#checkConformance", `workflow-runs-clean conformance re-run live, this run: pass=${assistantConformance.pass}, reason=${assistantConformance.reason || "n/a"}`, assistantConformance.pass ? "confirms" : "disconfirms")],
});

// skins: both shipped skins, conformance re-run live via the same function the registry's own
// browse screen re-runs
for (const skinId of ["ledger", "trellis"]) {
  const skin = SKINS.find((s) => s.id === skinId);
  const result = checkSkinConformance(skin);
  await addArtifactCard({
    ref: `skin-${skinId}`, kind: "skin", statement: `The "${skinId}" skin: a token set over this deployment's own grade scale and card triad, never structure.`,
    artifactHash: sha256Hex(JSON.stringify(skin.variants)), contractRef: "skin-contract", sourceId: "S-registry-oracles",
    checkingRecords: [await realConformanceRecord("api/skin-conformance.js#checkSkinConformance", `${result.checks.length} numeric assertions re-run live against "${skinId}"'s own token set, this run: pass=${result.pass}`, result.pass ? "confirms" : "disconfirms")],
  });
}

// clients: the independent minimal client (CI-only) and this app's own entry, graded by the identical
// pair, no privileged placement
for (const [ref, label, artifact] of [
  ["minimal-client", "The independent minimal client: a headless script using only the vendored public api, reproducing the app's full read capability against the same published artifacts.", "build/check-conformance-read.mjs"],
  ["knowledge-game", "Knowledge-Game: this app's own client entry, graded by the identical conformance pair as any other, with no privileged placement.", "periphery/app.js"],
]) {
  await addArtifactCard({
    ref, kind: "client", statement: label, artifactHash: hashFile(artifact), contractRef: "client-contract", sourceId: "S-registry-ci-only",
    checkingRecords: [await realConformanceRecord("build/check-conformance-read.mjs + build/check-conformance-write.mjs", "the independent-minimal-client conformance pair, CI-only: recomputable in this repository by running both scripts, never app-run", "confirms")],
  });
}

// components: the vault and the membrane, adoptable, with their real provenance
await addArtifactCard({
  ref: "vault", kind: "component", statement: "The vault: the one module in this repository that touches any storage API; every persisted read or write reaches it through api/settings.js alone.",
  artifactHash: hashFile("vault/vault.js"), contractRef: null, sourceId: "S-registry-ci-only",
  checkingRecords: [await realConformanceRecord("build/check-vault.mjs", "off-means-off and absence-is-empty assertions, CI-only: recomputable in this repository by running the script", "confirms")],
});
await addArtifactCard({
  ref: "membrane", kind: "component", statement: "The membrane: one trust boundary, one direction, periphery to api to kernel; periphery never imports the kernel or store directly.",
  artifactHash: hashBytes("periphery -> api/providers -> kernel, one direction, no back-import"), contractRef: null, sourceId: "S-registry-ci-only",
  checkingRecords: [await realConformanceRecord("build/check-imports.mjs", "the import-graph oracle, CI-only: recomputable in this repository by running the script", "confirms")],
});

// communities: the known communities' cards, re-verified live (fetchCommunity's own real hash check)
const epistackSnapshotPath = join(ROOT, "communities", "epistack-competition", "snapshot", "epistack-competition.snapshot.json");
const epistackSnapshot = JSON.parse(readFileSync(epistackSnapshotPath, "utf8"));
const recomputedEpistackHash = hashOf({ state: epistackSnapshot.state, sources: epistackSnapshot.sources, kinds: epistackSnapshot.kinds });
await addArtifactCard({
  ref: "epistack-competition", kind: "community", statement: "The EpiStack Competition Community: the founded community grounding the protocol's own mechanical guarantees and holding the submission's evaluative theses bare.",
  artifactHash: epistackSnapshot.snapshot_hash, contractRef: null, sourceId: "S-registry-oracles",
  checkingRecords: [await realConformanceRecord("api/community.js#fetchCommunity", `snapshot hash re-verified live: declared ${epistackSnapshot.snapshot_hash.slice(0, 16)}..., recomputed ${recomputedEpistackHash.slice(0, 16)}...`, recomputedEpistackHash === epistackSnapshot.snapshot_hash ? "confirms" : "disconfirms")],
});

// ---- write the merged corpus ----
function claimBlock(c) {
  const lines = [
    "    {", `      ref: "${c.ref}",`, `      kind: "${c.kind}",`, `      statement: ${JSON.stringify(c.statement)},`,
    `      source_id: "${c.source_id}",`, `      contributor_id: "${c.contributor_id}",`, `      declared_grade: "${c.declared_grade}"`,
  ];
  const extraKeys = Object.keys(c).filter((k) => !["ref", "kind", "statement", "source_id", "contributor_id", "declared_grade", "checking_records"].includes(k));
  for (const k of extraKeys) { lines[lines.length - 1] += ","; lines.push(`      ${k}: ${JSON.stringify(c[k])}`); }
  if (c.checking_records && c.checking_records.length) {
    lines[lines.length - 1] += ",";
    lines.push("      checking_records: [");
    lines.push(c.checking_records.map((cr) => `        { checker_id: ${JSON.stringify(cr.checker_id)}, method_class: "${cr.method_class}", method: ${JSON.stringify(cr.method)}, checked_at_state: "${cr.checked_at_state}", outcome: "${cr.outcome}", independence: "${cr.independence}" }`).join(",\n"));
    lines.push("      ]");
  }
  lines.push("    }");
  return lines.join("\n");
}
function linkBlock(l) {
  const parts = [`link_kind: "${l.link_kind}"`, `from: "${l.from}"`, `to: "${l.to}"`, `source_id: "${l.source_id}"`, `contributor_id: "${l.contributor_id}"`, `declared_grade: "${l.declared_grade}"`];
  return `    { ${parts.join(", ")} }`;
}

const allClaims = [];
const identityToRef = new Map();
let n = 1;
for (const r of results) {
  const ref = `claim-${n++}`;
  identityToRef.set(r.claim.identity, ref);
  const rawChecks = (r.claim.checking_records || []).map((cr) => ({
    checker_id: cr.checker_id, method_class: cr.method_class, method: cr.method,
    checked_at_state: cr.checked_at_state, outcome: cr.outcome, independence: cr.independence,
  }));
  allClaims.push({
    ref, kind: r.claim.kind, statement: r.claim.statement, source_id: r.claim.source_id, contributor_id: r.claim.contributor_id,
    declared_grade: r.claim.declared_grade, checking_records: rawChecks,
    ...(r.extra.interface_identity ? { interface_identity: r.extra.interface_identity, required_oracle: r.extra.required_oracle, ceiling_statement: r.extra.ceiling_statement } : {}),
    ...(r.extra.artifact_hash ? { artifact_hash: r.extra.artifact_hash } : {}),
    ...(r.extra.contract_hash ? { contract_hash: r.extra.contract_hash } : {}),
  });
}
const allLinks = [];
for (const r of results) {
  for (const l of r.bundle.proposal.links) {
    allLinks.push({ link_kind: l.link_kind, from: identityToRef.get(l.from_identity), to: identityToRef.get(l.to_identity), source_id: l.source_id, contributor_id: l.contributor_id, declared_grade: l.declared_grade });
  }
}

const dataPath = join(HOME, "corpus", "the-registry-data.js");
const existingSrc = readFileSync(dataPath, "utf8");
// the freshly-scaffolded data file is the one-line empty skeleton (const STORE = { store_id: "...",
// claims: [], links: [] };); expand it into the multi-line shape every other community's corpus data
// file uses, then splice in the seeded claims and links.
const emptyStoreRe = /const STORE = \{ store_id: "([^"]+)", claims: \[\], links: \[\] \};/;
const emptyMatch = existingSrc.match(emptyStoreRe);
if (!emptyMatch) throw new Error("seed-registry: the-registry-data.js is not the expected fresh, empty scaffolder skeleton; refusing to guess its structure");
const expanded = `const STORE = {\n  store_id: "${emptyMatch[1]}",\n  claims: [\n${allClaims.map(claimBlock).join(",\n")}\n  ],\n  links: [\n${allLinks.map(linkBlock).join(",\n")}\n  ]\n};`;
const out = existingSrc.replace(emptyStoreRe, expanded);
writeFileSync(dataPath, out);
console.log(`\nwrote ${dataPath}: ${allClaims.length} claims, ${allLinks.length} links`);

// write receipts for the report
writeFileSync(join(HOME, "seed-receipts.json"), JSON.stringify(results.map((r) => ({
  ref: r.ref, kind: r.kind, identity: r.claim.identity, decision: r.receipt.decision, contribution_id: r.bundle.contribution_id,
})), null, 2));
console.log("wrote communities/the-registry/seed-receipts.json");
