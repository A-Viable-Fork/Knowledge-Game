// Role: the external verifier (intake data model v3, Sections 11 and 15). Re-runs a decision from
//   its receipt plus the contribution and store state its hashes name, and reproduces every receipt
//   field byte-exactly; replays a window of contributions and checks the final state; and checks
//   resubmission idempotence. A distrusting party runs this as-is: it imports nothing outside Node's
//   standard library and the kernel's own pure modules.
// Contract: verifyDecision(receipt, contribution, storeView, versions) -> { result, first_divergent_field,
//   receipt_value, rederived_value }; windowReplay(startState, steps, tables, versions) -> { result,
//   final_state_hash, first_divergent_contribution }; resubmissionCheck(state, contribution, tables,
//   versions) -> { result, first_divergent_field }. Pure, ESM; kernel imports only kernel.
// Invariant: the verifier re-runs the same deterministic intake sequence and compares canonical bytes;
//   no float, no wall clock, no network, no dependency outside the standard library.
"use strict";
import { decide } from "./gate.mjs";
import { apply } from "../store/apply.mjs";
import { storeViewOf } from "../store/decay.mjs";
import { hashOf } from "../schema/canonical.mjs";

// the first field (as a path) where two receipt-shaped values diverge, walking in a stable order.
export function firstDivergence(a, b, path = "") {
  if (a === b) return null;
  const ta = typeof a, tb = typeof b;
  if (ta !== tb || a === null || b === null) return { path: path || "(root)", a, b };
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return { path: path || "(root)", a, b };
    if (a.length !== b.length) return { path: `${path}.length`, a: a.length, b: b.length };
    for (let i = 0; i < a.length; i++) { const d = firstDivergence(a[i], b[i], `${path}[${i}]`); if (d) return d; }
    return null;
  }
  if (ta === "object") {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    for (const k of keys) { const d = firstDivergence(a[k], b[k], path ? `${path}.${k}` : k); if (d) return d; }
    return null;
  }
  return { path: path || "(root)", a, b };
}

// Section 11: re-run one decision and compare every receipt field byte-exactly. The certificate hash
// (CERT-1) is one of those fields, so it is reproduced and compared like any other: it is the first-line
// integrity check, a single comparison over the sealed bundle (the grades, the bindings, the checking
// records, the state, and the ruleset that define the certification) that confirms the whole certified
// assembly at once. The certificate hash does not replace verification, it seals it: correspondence,
// that the grade follows from the grounding, is established by the gate's computation; the hash
// guarantees the assembly is the exact one that was certified, and expires (fails to match) when any
// bundled part changes. The field-by-field re-run remains the fallback that names exactly where a
// mismatch lies, so a certificate hash that does not reproduce is a divergence named like any other.
export function verifyDecision(receipt, contribution, storeView, versions = {}) {
  const rederived = decide(contribution, storeView, {
    rulesetVersion: receipt.ruleset_version, schemaVersion: receipt.schema_version, sourceVersion: versions.sourceVersion,
  });
  const d = firstDivergence(receipt, rederived);
  if (!d) return { result: "match" };
  return { result: "mismatch", first_divergent_field: d.path, receipt_value: d.a, rederived_value: d.b };
}

// Section 15: replay a window of contributions in a given (dependency-consistent) order, re-running
// intake against the evolving state, and land at a final state. Returns the final state hash and, on
// a decision that does not re-derive, the first contribution where the chain departs.
export function windowReplay(startState, steps, tables, versions = {}) {
  let state = startState;
  for (const step of steps) {
    const sv = storeViewOf(state, tables);
    const receipt = decide(step.contribution, sv, versions);
    if (step.expected_decision && receipt.decision !== step.expected_decision)
      return { result: "mismatch", first_divergent_contribution: step.contribution.hash, reason: `decision ${receipt.decision} != recorded ${step.expected_decision}` };
    if (receipt.decision === "declined") continue;
    state = apply(state, {
      entries: step.contribution.entries, links: step.contribution.links,
      withdrawn_records: step.withdrawn_records || [], contradiction_records: receipt.contradiction_records,
      corroboration_findings: receipt.corroboration_findings, supersession_records: step.supersession_records || [],
      applied_contribution_hash: step.contribution.hash, receipt_reference: hashOf(receipt),
    });
  }
  return { result: "ok", final_state_hash: state.state_hash, final_state: state };
}

// Section 15: idempotence from the outside. Resubmitting a recorded contribution re-derives the same
// decision and leaves the post-apply state hash identical to the pre-apply state hash.
export function resubmissionCheck(state, contribution, tables, versions = {}) {
  const sv = storeViewOf(state, tables);
  const receipt = decide(contribution, sv, versions);
  const after = receipt.decision === "declined" ? state : apply(state, {
    entries: contribution.entries, links: contribution.links,
    contradiction_records: receipt.contradiction_records, corroboration_findings: receipt.corroboration_findings,
    applied_contribution_hash: contribution.hash, receipt_reference: hashOf(receipt),
  });
  if (after.state_hash === state.state_hash) return { result: "unchanged" };
  const d = firstDivergence(state, after);
  return { result: "changed", first_divergent_field: d ? d.path : "(state_hash)" };
}
