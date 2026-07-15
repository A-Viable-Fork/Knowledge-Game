// Role: grounding transfer across the store boundary (composition spec, record 2). The weakest-link
//   rule that governs support inside a store governs it across the boundary: a composite claim is no
//   more grounded than its weakest necessary cited claim. This module copies the domain store's grade
//   into a citation (the composite never assigns a grade for a claim it does not own) and folds the
//   necessary carried grades under one min, capped by the composite claim's ceiling.
// Contract: domainGradeOf(state, id, tables), citeDomainClaim(domainStore, ref), compositeGrade({
//   ceiling, citations }), isStale(citation, sourceCurrentStateId). Pure, ESM; kernel imports kernel.
// Invariant: the min is the v3 `meet`, which collapses the settled tier to one floor rank, so the
//   cross-boundary min is well defined even across settled grades that are incomparable within their
//   modes. The composite grade therefore lives on the collapsed working line (one floor rank), which
//   is the reconciliation the composition layer rests on. Corroborating citations are excluded.
// GROUNDED: the crossing properties (thm.crossing-min, thm.untyped-floor) are grounded in the math
//   kernel at checked by differential testing (build/check-math-differential.mjs): the composite grade
//   is min over the necessary carried grades capped by ceiling, and an unpinned crossing arrives
//   untyped and grounds nothing until a fork restores standing.
"use strict";
import { COLLAPSED, collapse, meet, isPosition } from "../schema/confidence.mjs";
import { derivedGrade } from "../store/decay.mjs";
import { citationRecord } from "./records.mjs";

// the grade the domain store holds for a claim at a state: the domain's own derivation. The composite
// reads this and copies it; it is the domain model computing its own grade, not the composite's.
export function domainGradeOf(state, claimIdentity, tables) {
  return derivedGrade(state, claimIdentity, tables);
}

// build a citation by COPYING the domain store's grade at its current state. This is the one place a
// carried_grade is produced, and it is a copy of the domain's derivation, never an assignment.
export function citeDomainClaim(domainStore, { citing_claim, cited_claim, role, made_at, term_ref }) {
  const carried_grade = domainGradeOf(domainStore.state, cited_claim, domainStore.tables);
  return citationRecord({
    citing_claim, source_store: domainStore.store_id, cited_claim,
    cited_state: domainStore.state.state_hash, carried_grade, role, made_at, term_ref,
  });
}

// a ceiling on the collapsed working line: "settled" is the top of scale (a commensurable composite),
// and a concrete grade like "corroborated" (a cross-domain weighing's structured-forum) collapses to
// itself. Either way the ceiling is read on the same line the min runs on.
function collapsedCeiling(c) {
  if (COLLAPSED.includes(c)) return c;   // already a collapsed-line position, including "settled" (top)
  if (isPosition(c)) return collapse(c); // a concrete grade -> its collapsed rank
  throw new Error(`composite grade: bad ceiling ${JSON.stringify(c)}`);
}

// record 2: grade(C) = min( ceiling(C), min over necessary citations k of carried_grade(k) ).
// The fold starts from the top of scale ("settled"), the identity for min, so with no necessary
// citation the grade is just the ceiling; each necessary carried grade can only lower it.
const TOP = "settled";
export function compositeGrade({ ceiling, citations }) {
  let fold = TOP;
  for (const c of citations || []) {
    if (c.role !== "necessary") continue; // corroborating citations are visible but not computed
    fold = meet(fold, c.carried_grade); // GROUNDED thm.crossing-min: min over the necessary carried grades
  }
  return meet(collapsedCeiling(ceiling), fold); // capped by the ceiling, the cross-boundary min
}

// a citation is stale when the state it was made against trails the source store's current state.
// Staleness is a comparison computed on read; it changes nothing about the citation record itself,
// which remains a true record of what was cited (composition spec, record 1).
export function isStale(citation, sourceCurrentStateId) {
  return citation.cited_state !== sourceCurrentStateId;
}
