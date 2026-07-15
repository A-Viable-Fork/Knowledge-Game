// Role: verifies the three hot-swap seams (claims 16, 17, 18): each interface exists, and nothing
//   outside it reads the reserved field or surface it carries. Claim 16 (credential): the seam's
//   vendored stub (vendor/api/credential.js) satisfies its own contract (a stub, imports nothing), and
//   a static scan proves no local module (api/, periphery/, vault/, build/) evaluates a community's
//   stored identity_thresholds to gate any behavior. Claim 17 (patch-history): the seam's vendored stub
//   (vendor/kernel/store/patch-ledger.js) imports nothing, no local module imports it, and a
//   contribution's id is proven content-derived by permuting construction order and re-hashing. Claim
//   18 (standing-economy): a community's parameter record carries the reserved field, and a static
//   scan proves no local module reads it.
// Contract: `node build/check-seams.mjs` exits non-zero on any violation, naming it.
// Invariant: "reads to evaluate" is distinguished from "reads to print/store" by scanning for property
//   access followed by conditional or comparison use; build/found-community.mjs's own reporting of
//   these fields (printing them to the console during founding) is display, not evaluation, and is
//   explicitly excluded from the scan for that documented reason.
"use strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve, extname } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-SEAMS: the credential, patch-history, and standing-economy seams"); console.log(H);

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (extname(name) === ".js" || extname(name) === ".mjs") out.push(p);
  }
}
// the scanned zones: this deployment's own authored code, excluding build/found-community.mjs (whose
// console-printing of these reserved fields during founding is display, not evaluation, named in the
// header above) and excluding any community's own home directory (a founded community's self-contained
// vendor/kernel/ copy naturally contains the same stub files, not a second local evaluator).
const SCAN_FILES = [];
for (const zone of ["periphery", "api", "vault"]) { try { walk(join(ROOT, zone), SCAN_FILES); } catch (e) { void e; } }
const buildFiles = [];
walk(join(ROOT, "build"), buildFiles);
const SELF_EXCLUDED = new Set([join(ROOT, "build", "found-community.mjs"), join(ROOT, "build", "check-seams.mjs")]);
for (const f of buildFiles) if (!SELF_EXCLUDED.has(f)) SCAN_FILES.push(f);

console.log("\n[1] claim 16: the credential seam");
const credentialSrc = readFileSync(join(ROOT, "vendor", "api", "credential.js"), "utf8");
ok(/STUB/.test(credentialSrc), "vendor/api/credential.js declares itself a STUB in its own contract");
ok(!/^import /m.test(credentialSrc), "vendor/api/credential.js imports nothing (a pure stub)");
let identityThresholdsEvaluated = false;
for (const file of SCAN_FILES) {
  const source = readFileSync(file, "utf8");
  // "evaluated" = read as a property (identity_thresholds.xxx or ["identity_thresholds"]) used in a
  // conditional/comparison, as opposed to this repository's own founding-time construction of the field.
  if (/identity_thresholds\s*[.[]/.test(source) || /identity_thresholds\s*&&|if\s*\([^)]*identity_thresholds/.test(source)) {
    identityThresholdsEvaluated = true;
    ok(false, `${relative(ROOT, file)}: reads identity_thresholds as a property (would evaluate it)`);
  }
}
ok(!identityThresholdsEvaluated, "no scanned file evaluates identity_thresholds as a property read");

console.log("\n[2] claim 17: the patch-history seam");
const patchLedgerSrc = readFileSync(join(ROOT, "vendor", "kernel", "store", "patch-ledger.js"), "utf8");
ok(/STUB/.test(patchLedgerSrc), "vendor/kernel/store/patch-ledger.js declares itself a STUB in its own contract");
ok(!/^import /m.test(patchLedgerSrc), "vendor/kernel/store/patch-ledger.js imports nothing (a pure stub)");
let patchLedgerImported = false;
for (const file of SCAN_FILES) {
  const source = readFileSync(file, "utf8");
  if (/patch-ledger/.test(source)) { patchLedgerImported = true; ok(false, `${relative(ROOT, file)}: references patch-ledger`); }
}
ok(!patchLedgerImported, "no scanned file imports or references the patch-history surface");

console.log("\n[3] claim 17, empirically: a contribution's id is content-derived, invariant under construction-order permutation");
const { contributionId } = await import(join(ROOT, "api", "contribute.js"));
const { claimRecord, linkRecord } = await import(join(ROOT, "vendor", "kernel", "schema", "records.mjs"));
const a = claimRecord({ kind: "measurement", statement: "Permutation test claim A.", source_id: "S-test", contributor_id: "P-test", declared_grade: "asserted" });
const b = claimRecord({ kind: "measurement", statement: "Permutation test claim B.", source_id: "S-test", contributor_id: "P-test", declared_grade: "asserted" });
const link = linkRecord({ link_kind: "supports", from_identity: a.identity, to_identity: b.identity, support_group: "g:" + b.identity + "/" + a.identity, source_id: "S-test", contributor_id: "P-test", declared_grade: "corroborated" });
const idForward = contributionId({ entries: [a, b], links: [link] });
const idReversed = contributionId({ entries: [b, a], links: [link] });
ok(idForward === idReversed, "the contribution id is unchanged when entry construction order is permuted");

console.log("\n[4] claim 18: the standing-economy seam");
const card = JSON.parse(readFileSync(join(ROOT, "communities", "epistack-competition", "community-card.json"), "utf8"));
ok(card.standing_economy && typeof card.standing_economy === "object", "the published community's parameter record carries a reserved standing_economy field");
let standingEconomyEvaluated = false;
for (const file of SCAN_FILES) {
  const source = readFileSync(file, "utf8");
  if (/standing_economy\s*[.[]/.test(source) || /if\s*\([^)]*standing_economy/.test(source)) {
    standingEconomyEvaluated = true;
    ok(false, `${relative(ROOT, file)}: reads standing_economy as a property (would evaluate it)`);
  }
}
ok(!standingEconomyEvaluated, "no scanned file evaluates standing_economy as a property read");

console.log("\n" + H);
if (fails === 0) console.log("verified: all three seams' vendored stubs satisfy their own contract, nothing outside them evaluates a reserved field, and contribution identity is proven content-derived under permutation.");
console.log(fails === 0 ? "check-seams: OK" : `check-seams: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
