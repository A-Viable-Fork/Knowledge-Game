// Role: the null-objective order (spec Section 6): the deterministic default a reader gets with
//   ranking off. Grounding-sorted by the lattice order (stronger computed standing first), then
//   recency, then the claim's own identity hash as the total-order tiebreak, so the same snapshot
//   always yields the identical feed, on every device, every time, regardless of the order its
//   records happen to be serialized in.
// Contract: orderFeed(claims) -> claims, sorted. `claims` are api.read() rows (each carrying identity
//   and earned_grade).
// Invariant: no ranking objective is consulted here; this module is called only when ranking is off,
//   the shipped default (no ranking module exists yet in this phase). The order depends only on each
//   claim's own content (its grade, its identity hash), never on its position in any array, so it is
//   invariant under any permutation of the input records: build/check-feed-determinism.mjs proves
//   this directly. Recency is named honestly as void in this phase: the v3 claim record carries no
//   timestamp field and no other content-derived temporal signal exists yet, so there is nothing to
//   sort by between grouping and the hash tiebreak. Filling recency with the snapshot's incidental
//   array order was tried and rejected here (design axiom T0-3's spirit applied to ordering: a value
//   whose origin is an array position is not a value with real content), because it would make the
//   feed depend on serialization order, breaking the permutation invariance the null order promises.
// SORRY: recency is void; see trellis/sorry-ledger.md SK-20 for the closing condition.
"use strict";
import { POSITIONS } from "../vendor/kernel/schema/confidence.mjs";

function rankOf(grade) {
  const p = POSITIONS[grade];
  return p ? p.collapsedRank : -1;
}

export function orderFeed(claims) {
  return claims.slice().sort((a, b) => {
    const byGrade = rankOf(b.earned_grade) - rankOf(a.earned_grade); // stronger grounding first
    if (byGrade !== 0) return byGrade;
    // recency: void in this phase (see the module head); nothing to compare, falls through
    return a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0; // total-order tiebreak
  });
}

// the why-this-card string for the null order, honest and small, per spec Section 6.
export function whyThisCard(position) {
  return `null order: grounding, then recency, position ${position}`;
}
