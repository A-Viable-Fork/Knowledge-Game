// Role: verifies the semantic guarantees Phase KG-12 makes about the-registry, distinct from
//   build/check-the-registry.mjs's generated, purely structural "does the kernel build and does the
//   gate accept" oracle. This one checks the content: every seed entry's conformance citation
//   actually resolves to something real, one sandbox-executable oracle reproduces its cited result
//   byte-for-byte when re-run right now, a register-an-artifact bundle validates against a real
//   admission fixture (and a doctored one is rejected, naming the mismatch), the app's own client
//   entry carries the conformance-pair citation, and no registry surface (app code or the-registry's
//   own authored content, not its pinned vendor copy) asserts "safe", "good", or "trusted" about an
//   artifact outside an explicit ceiling negation ("does not warrant... good").
// Contract: `node build/check-registry.mjs` exits non-zero on any failure.
// Invariant: every assertion here is against a real re-run (checkConformance, checkSkinConformance,
//   fetchCommunity, importContribution) or a real file on disk; nothing is asserted from the corpus's
//   own say-so alone.
"use strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { claimRecord, linkRecord } from "../vendor/kernel/schema/records.mjs";
import { makeSourceTable, makeKindTable } from "../vendor/kernel/schema/tables.mjs";
import { storeViewOf } from "../vendor/kernel/store/decay.mjs";
import { decide } from "../vendor/kernel/gate/gate.mjs";
import { hashOf } from "../vendor/kernel/schema/canonical.mjs";
import { sha256Hex } from "../vendor/kernel/schema/sha256.mjs";
import { exportContribution, importContribution } from "../vendor/api/contribution.js";
import { checkConformance } from "../api/extension.js";
import { checkSkinConformance } from "../api/skin-conformance.js";
import { SKINS } from "../api/skins.js";
import { draftRegistryArtifact } from "../api/register-artifact.js";
import { bundleProposal } from "../api/contribute.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { KINDS, SOURCES } = require(join(ROOT, "communities", "the-registry", "corpus", "tables.js"));
const { STORE } = require(join(ROOT, "communities", "the-registry", "corpus", "the-registry-data.js"));

let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-REGISTRY: the-registry's semantic guarantees (Phase KG-12)"); console.log(H);

console.log("\n[1] every seed entry's conformance citation resolves");
function checkerFilesOf(checkerId) {
  // a checker_id is either "path/to/file.ext#symbol" or "path/a.mjs + path/b.mjs" (a pair)
  return checkerId.split("+").map((p) => p.trim().split("#")[0].trim());
}
for (const c of STORE.claims) {
  // "conformance is recomputable or it is not evidence": an artifact-card claim (identified by
  // carrying artifact_hash) must never display a conformance status with no citation behind it.
  if (c.artifact_hash) {
    ok(!!(c.checking_records && c.checking_records.length), `${c.ref} (${c.kind}): an artifact-card claim carrying artifact_hash also carries a real checking_records citation, never a status with none`);
  }
  if (c.checking_records && c.checking_records.length) {
    for (const cr of c.checking_records) {
      const files = checkerFilesOf(cr.checker_id);
      for (const f of files) {
        ok(existsSync(join(ROOT, f)), `${c.ref} (${c.kind}): checker_id names a real file on disk (${f})`);
      }
      ok(["confirms", "disconfirms"].includes(cr.outcome) || /^confirms-with-noted-limits/.test(cr.outcome), `${c.ref}: checking record outcome is a real, well-formed value (${cr.outcome})`);
    }
  }
}

// a contract-bundle's own required_oracle is itself a citation: it names an oracle by hash, and that
// hash must resolve to the real file(s) it claims to be, right now, not just at seed time.
const ORACLE_FILES_OF_CONTRACT = {
  "The ranker contract: a candidate ranker must pass the ranking-separation fuzz.": ["api/extension.js"],
  "The skin contract: a candidate skin must pass token completeness, grade-scale monotonicity, and contrast.": ["api/skin-conformance.js"],
  "The client contract: a candidate client must reproduce the reference client's reads and, if proposing, its admission path.": ["build/check-conformance-read.mjs", "build/check-conformance-write.mjs"],
};
for (const c of STORE.claims) {
  if (c.kind !== "contract-bundle") continue;
  const files = ORACLE_FILES_OF_CONTRACT[c.statement];
  ok(!!files, `${c.ref}: this contract's required_oracle has a known real file mapping this check can independently recompute`);
  if (files) {
    const fresh = files.map((f) => sha256Hex(readFileSync(join(ROOT, f), "utf8"))).join(":");
    ok(fresh === c.required_oracle, `${c.ref}: required_oracle resolves to a fresh hash of the real file(s) it names (${files.join(", ")}), matching the cited hash`);
  }
}
// contract linkage: every contract_hash must name a real contract-bundle claim's identity. Claim
// identities are only known once the kernel is actually built (identity = hash of kind+statement),
// so this is checked against the built kernel in section [2]'s own import, not the raw corpus refs.

console.log("\n[2] building the kernel fresh, to check identities and re-run one sandbox oracle live");
const { buildKernel } = await import("./the-registry-build.mjs");
const built = buildKernel();
ok(built.receipt.decision === "accepted" || built.receipt.decision === "accepted-with-disagreement", `the kernel's own contribution is accepted by the real gate (got ${built.receipt.decision})`);

const contractIdentities = new Set(built.state.entries.filter((e) => e.kind === "contract-bundle").map((e) => e.identity));
for (const e of built.state.entries) {
  const ext = (e.canonical && e.canonical.extensions) || {};
  if (ext.contract_hash) {
    ok(contractIdentities.has(ext.contract_hash), `claim ${e.identity.slice(0, 12)}... (${e.kind}): its contract_hash names a real contract-bundle claim in this kernel`);
  }
}

// byte-for-byte re-run: the "ledger" skin's conformance oracle is pure and sandbox-free, so re-running
// it right now must reproduce the exact cited method string, not just the same pass/fail boolean.
const ledgerClaim = STORE.claims.find((c) => c.kind === "skin" && /ledger/.test(c.statement));
ok(!!ledgerClaim, "the-registry's corpus carries the ledger skin's own artifact-card claim");
if (ledgerClaim) {
  const skin = SKINS.find((s) => s.id === "ledger");
  const fresh = checkSkinConformance(skin);
  const citedMethod = ledgerClaim.checking_records[0].method;
  const freshMethod = `${fresh.checks.length} numeric assertions re-run live against "ledger"'s own token set, this run: pass=${fresh.pass}`;
  ok(freshMethod === citedMethod, `re-running the ledger skin's conformance oracle in this app right now reproduces the cited method string byte-for-byte ("${freshMethod}" === "${citedMethod}")`);
  ok(sha256Hex(JSON.stringify(skin.variants)) === ledgerClaim.artifact_hash, "the ledger skin's own current token set still hashes to the cited artifact_hash");
}

console.log("\n[3] a register-an-artifact bundle validates against a real admission fixture, and a doctored one is rejected");
const community = { raw: { state: built.state, sources: SOURCES, kinds: KINDS }, kernelId: "the-registry", snapshotHash: hashOf({ state: built.state, sources: SOURCES, kinds: KINDS }) };
const trellis = SKINS.find((s) => s.id === "trellis");
const trellisResult = checkSkinConformance(trellis);
const draft = draftRegistryArtifact(community, {
  statement: "check-registry.mjs's own admission fixture: the trellis skin's real token set, drafted fresh for this check run only.",
  kind: "skin", artifactHash: sha256Hex(JSON.stringify(trellis.variants)),
  checkingRecords: [{
    checker_id: "api/skin-conformance.js#checkSkinConformance", method_class: "direct-measurement",
    method: `admission-fixture re-run, this run: pass=${trellisResult.pass}`, checked_at_state: "this-deployment@working-tree",
    outcome: trellisResult.pass ? "confirms" : "disconfirms", independence: "distinct-party",
  }],
});
ok(draft.receipt.decision === "accepted" || draft.receipt.decision === "accepted-with-disagreement", `the fixture's own draft is gate-accepted against the-registry's real current state (got ${draft.receipt.decision})`);
if (draft.proposal) {
  const bundle = bundleProposal(draft.proposal, draft.receipt, { kernel_id: community.kernelId, state_id: community.snapshotHash });
  let importedOk = false;
  try { importContribution(bundle); importedOk = true; } catch (e) { importedOk = false; }
  ok(importedOk, "a well-formed register-an-artifact bundle round-trips through importContribution (the real admission-side re-validation) without a mismatch");

  // the negative fixture: doctor the exported bundle's own cited artifact_hash after the fact (as a
  // register flow attaching a real conformance run to one artifact, then quietly pointing the claim
  // at a different one, would), and confirm the admission-side re-validation rejects it by recomputed
  // contribution id, naming the mismatch, never silently accepting a citation for a different artifact
  // than the one actually re-executed.
  const doctored = JSON.parse(JSON.stringify(bundle));
  doctored.proposal.entries[0].canonical.extensions.artifact_hash = "doctored-" + doctored.proposal.entries[0].canonical.extensions.artifact_hash;
  let rejected = false, rejectionMessage = "";
  try { importContribution(doctored); } catch (e) { rejected = true; rejectionMessage = e.message; }
  ok(rejected && /mismatch/.test(rejectionMessage), `a bundle doctored after export (its own cited artifact_hash pointed at a different artifact than the one actually re-executed) is rejected by admission-side re-validation, naming the mismatch ("${rejectionMessage}")`);
}

console.log("\n[4] the app's own client entry carries the conformance-pair citation, no privileged placement");
const ownEntry = STORE.claims.find((c) => c.kind === "client" && /Knowledge-Game/.test(c.statement));
ok(!!ownEntry, "the-registry's corpus carries this app's own client-kind artifact-card claim");
if (ownEntry) {
  const cr = ownEntry.checking_records[0];
  ok(/check-conformance-read\.mjs/.test(cr.checker_id) && /check-conformance-write\.mjs/.test(cr.checker_id), "this app's own entry cites the identical conformance-pair oracle, by name, that every other client entry cites");
  const otherClient = STORE.claims.find((c) => c.kind === "client" && c.ref !== ownEntry.ref);
  ok(!!otherClient && otherClient.contract_hash === ownEntry.contract_hash, "this app's own entry depends on the identical client contract as the independent minimal client, no privileged placement");
}

console.log("\n[5] no registry surface asserts \"safe\", \"good\", or \"trusted\" about an artifact");
const FORBIDDEN_WORDS = /\b(safe|good|trusted)\b/gi;
// a match is exempt when it sits inside an explicit negation of the ceiling word itself (a
// ceiling_statement's own "does not warrant... good", this discipline's own self-description quoting
// the forbidden words to name them, or the pre-existing codebase idiom "browser-safe ESM" describing
// module portability, never an artifact's trustworthiness) rather than an unqualified assertion.
const EXEMPT_NEARBY = ["does not warrant", "never described as", "described as safe, good, or trusted", "ceiling word", "browser-safe"];
const SURFACE_FILES = [
  "communities/the-registry/corpus/the-registry-data.js",
  "communities/the-registry/community-card.json",
  "communities/the-registry/README.md",
  "communities/the-registry/PUBLISH-WALKTHROUGH.md",
  "communities/the-registry/founding-config.json",
  "api/registry.js",
  "api/register-artifact.js",
  "periphery/registry-screen.js",
  "periphery/register-artifact-screen.js",
];
for (const rel of SURFACE_FILES) {
  const path = join(ROOT, rel);
  if (!existsSync(path)) { ok(false, `${rel}: file exists (cannot scan a missing file)`); continue; }
  const text = readFileSync(path, "utf8");
  let m; let clean = true; let firstBad = "";
  FORBIDDEN_WORDS.lastIndex = 0;
  while ((m = FORBIDDEN_WORDS.exec(text))) {
    const windowStart = Math.max(0, m.index - 200);
    const nearby = text.slice(windowStart, m.index + m[0].length + 40).toLowerCase();
    if (!EXEMPT_NEARBY.some((phrase) => nearby.includes(phrase))) { clean = false; firstBad = m[0]; break; }
  }
  ok(clean, `${rel}: no unqualified "safe"/"good"/"trusted" about an artifact${clean ? "" : ` (found "${firstBad}" without a preceding "does not warrant")`}`);
}

console.log("\n" + H);
console.log(fails === 0 ? "check-registry: OK" : `check-registry: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
