// Role: collaborative gate feedback (spec Section 7). Turns a decision receipt's own content into
//   what structure is present, what is missing, and what would ground the proposal, so a refusal
//   never renders as the bare word "declined"/"rejected"/"failed" alone.
// Contract: describeReceipt(receipt) -> { present: string[], missing: string[], wouldGround: string[] }.
//   present is always populated when the receipt carries a grade_table (whether accepted or declined);
//   missing and wouldGround are populated only from the receipt's own findings/error, never invented.
// Invariant: every line is derived from the receipt's own fields (grade_table, findings, error);
//   nothing here fabricates a finding the gate did not report, and an unrecognized rule_id still
//   renders (its raw expected/found), never silently dropped.
"use strict";

const RULE_EXPLANATIONS = {
  "GM-ABOVE": (f) => `declared grade is above what this entry currently earns (${f.expected})`,
  "GM-MODE": (f) => `declared grade's mode is not reachable from this entry's current basis (${f.expected})`,
  "WF-UNRESOLVED": (f) => `a link's ${f.field_path} points at an identity not present in this graph (${f.found})`,
  "WF-SUPERSEDED": (f) => `a link's ${f.field_path} points at an entry that has been superseded`,
  "WF-DEPENDS": () => "a depends-on target is not currently in force",
  "WD-UNSATISFIED": () => "this reintroduces a withdrawn claim without satisfying its reinstatement condition",
};

const RULE_ADVICE = {
  "GM-ABOVE": () => "lower the declared grade to at or below what this entry currently earns, or add a stronger support",
  "GM-MODE": () => "choose a declared grade whose mode this entry's basis can actually provide",
  "WF-UNRESOLVED": () => "point the link at an identity already present in this graph",
  "WF-SUPERSEDED": () => "point the link at the successor entry instead",
  "WF-DEPENDS": () => "depend on an entry that is currently in force",
  "WD-UNSATISFIED": () => "satisfy the withdrawal's reinstatement condition, or restate under a different statement",
};

export function describeReceipt(receipt) {
  const present = [];
  const missing = [];
  const wouldGround = [];

  for (const row of receipt.grade_table || []) {
    present.push(`${row.identity.slice(0, 12)}...: declared ${row.declared_grade}, earned ${row.earned_grade} (own basis ${row.B}, support delivery ${row.S})`);
  }

  if (receipt.error) {
    missing.push(receipt.error);
    if (/comment-support-barred/.test(receipt.error)) {
      wouldGround.push("post this as a comment on its own (comments-on / replies-to), or draft it as a claim instead");
    }
  }

  for (const f of receipt.findings || []) {
    const explain = RULE_EXPLANATIONS[f.rule_id];
    missing.push(explain ? explain(f) : `${f.rule_id}: expected ${f.expected}, found ${JSON.stringify(f.found)}`);
    const advice = RULE_ADVICE[f.rule_id];
    if (advice) wouldGround.push(advice(f));
  }

  if (receipt.decision === "declined" && !missing.length) missing.push("declined with no named finding; see the decision basis below");
  return { present, missing, wouldGround };
}
