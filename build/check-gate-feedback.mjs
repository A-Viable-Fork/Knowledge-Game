// Role: verifies collaborative gate feedback (Phase KG-4, spec Section 7). Every fuzzed failing
//   receipt renders missing-structure content generated from its own findings; the words rejected,
//   denied, and failed never render alone, unaccompanied by what structure is missing and what would
//   ground it.
// Contract: `node build/check-gate-feedback.mjs` exits non-zero on any divergence, naming it.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-GATE-FEEDBACK: a refusal always renders the path, never the bare wall"); console.log(H);

const { describeReceipt } = await import(join(ROOT, "periphery", "gate-feedback.js"));

// a fuzz of every finding shape the real gate actually emits (rule_ids from vendor/kernel/gate/gate.mjs),
// plus the comment-guard's own error shape, each wrapped in an otherwise-declined receipt.
const FINDING_FIXTURES = [
  { rule_id: "GM-ABOVE", field_path: "declared_grade", expected: "at or below the earned grade asserted", found: "checked", entry_locator: "e1" },
  { rule_id: "GM-MODE", field_path: "declared_grade", expected: "a grade whose mode the basis can provide (earned asserted)", found: "checked", entry_locator: "e2" },
  { rule_id: "WF-UNRESOLVED", field_path: "to_identity", expected: "a resolvable identity", found: "ID-GHOST", entry_locator: "e3" },
  { rule_id: "WF-SUPERSEDED", field_path: "to_identity", expected: "an in-force entry", found: "ID-OLD", entry_locator: "e4" },
  { rule_id: "WF-DEPENDS", field_path: "to_identity", expected: "an in-force depended-on entry", found: "ID-X", entry_locator: "e5" },
  { rule_id: "WD-UNSATISFIED", field_path: "declared_grade", expected: "satisfied reinstatement", found: "unsatisfied", entry_locator: "e6" },
  { rule_id: "SOME-FUTURE-RULE-NOT-YET-NAMED", field_path: "x", expected: "y", found: "z", entry_locator: "e7" },
];

console.log("\n[1] every named finding shape produces non-empty missing content and a translation, not a raw dump alone");
for (const f of FINDING_FIXTURES) {
  const receipt = { decision: "declined", decision_basis: [f.rule_id], findings: [f], grade_table: [] };
  const { missing } = describeReceipt(receipt);
  ok(missing.length > 0, `${f.rule_id}: describeReceipt reports at least one missing-structure line`);
  ok(!missing.includes(f.rule_id) || missing.length > 0, `${f.rule_id}: the raw rule_id alone is never the whole story (a line always exists)`);
}

console.log("\n[2] a declined receipt with no findings at all still reports something missing, never silence");
{
  const receipt = { decision: "declined", decision_basis: ["all-checks-clean"], findings: [], grade_table: [] };
  const { missing } = describeReceipt(receipt);
  ok(missing.length > 0, "a findings-empty decline still reports a missing line (naming the absence itself)");
}

console.log("\n[3] the comment-support-barred refusal names the rule and the honest alternative");
{
  const receipt = { decision: "declined", error: "comment-support-barred: link L attempts to admit a comment (C) into a support role", findings: [], grade_table: [] };
  const { missing, wouldGround } = describeReceipt(receipt);
  ok(missing.some((m) => /comment-support-barred/.test(m)), "the missing line names comment-support-barred");
  ok(wouldGround.some((w) => /post this as a comment|draft it as a claim/.test(w)), "wouldGround names the honest alternative (post as comment, or draft as claim)");
}

console.log("\n[4] an accepted receipt still reports present structure (grade_table), no missing/wouldGround required");
{
  const receipt = { decision: "accepted", decision_basis: ["all-checks-clean"], findings: [], grade_table: [{ identity: "abc123", declared_grade: "asserted", earned_grade: "asserted", B: "none", S: "asserted" }] };
  const { present, missing } = describeReceipt(receipt);
  ok(present.length === 1, "an accepted receipt's grade_table renders as present structure");
  ok(missing.length === 0, "an accepted receipt reports nothing missing");
}

console.log("\n[5] the contribute screen always renders through describeReceipt: no bare decision-word rendering path remains (static source check)");
{
  const src = readFileSync(join(ROOT, "periphery", "contribute-screen.js"), "utf8");
  ok(/describeReceipt\(/.test(src), "contribute-screen.js calls describeReceipt");
  ok(!/`Gate decision: \$\{receipt\.decision\}\$\{receipt\.error/.test(src), "the old bare decision+error-only line no longer exists");
  ok(/feedback-missing/.test(src) && /feedback-would-ground/.test(src), "the rendered receipt carries both a missing and a would-ground section");
}

console.log("\n[6] fuzz: 50 receipts each with one random finding from the named fixtures, every one reports missing content");
{
  let allOk = true;
  for (let i = 0; i < 50; i++) {
    const f = FINDING_FIXTURES[Math.floor(Math.random() * FINDING_FIXTURES.length)];
    const receipt = { decision: "declined", decision_basis: [f.rule_id], findings: [{ ...f, entry_locator: `fuzz-${i}` }], grade_table: [] };
    const { missing } = describeReceipt(receipt);
    if (!missing.length) allOk = false;
  }
  ok(allOk, "all 50 fuzzed declined receipts report non-empty missing content");
}

console.log("\n" + H);
if (fails === 0) console.log("verified: every declined receipt, real rule or fuzzed, renders structure missing and (where the gate names one) what would ground it; the bare word declined never renders alone.");
console.log(fails === 0 ? "check-gate-feedback: OK" : `check-gate-feedback: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
