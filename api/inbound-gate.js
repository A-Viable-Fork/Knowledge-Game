// Role: the inbound gate (Phase KG-6c), symmetric to the outbound outbox/virtual layer (KG-6b).
//   Auto mode (the default, per community) is the existing sync, untouched: a fresh fetch's rows
//   are the working view, exactly as before this phase. Review mode holds a per-community baseline
//   (the last-accepted working view, a lightweight ledger of {identity, kind, grade} plus the kind
//   and source tables and governance hash captured when it was taken) and diffs a fresh read against
//   it: a claim absent from the baseline is new; a claim present whose grade differs has moved.
//   Neither case re-decides whether a claim grounds (the community's own gate already did that; a
//   grade this module reports is always the real, already-computed earned_grade); this module only
//   decides what the reader has absorbed into their own working view.
// Contract: establishBaseline(freshRows, freshRaw, governanceHash) -> baseline, the silent first
//   capture taken the moment review mode first has something to diff against (so switching a
//   community into review mode never itself produces a false "everything is new" list).
//   computeUpdateList(baseline, held, freshRows) -> {pending, stillHeld}: pending is every new or
//   grade-moved claim not matched by a still-current hold; stillHeld is a declined claim whose
//   incoming state has not moved again since it was declined. flagContradictions(pending, stillHeld,
//   links) -> pending, each entry additionally carrying contradictsHeld (a held identity) when a
//   "contradicts" link connects it to something the reader has already declined. acceptIntoBaseline
//   (baseline, freshRows, identities) -> baseline with those identities absorbed at their current
//   grade. holdUpdates(held, pendingEntries, identities) -> held with those identities' current
//   incoming grade recorded as declined. clearHeld(held, identities) -> held with those identities
//   removed (an explicit accept supersedes any prior decline on the same identity).
//   adoptGovernanceHash(baseline, newHash) -> baseline with its own recorded governance hash updated
//   (the reader-side "adopt this parameter set" act). recomputeUnderAdoptedParameters(pending,
//   freshRaw, baseline) -> api/epistemic-cost.js's own report, reusing its exact parameterized
//   recompute over the baseline's own kind and source tables rather than inventing a second one.
// Invariant: pure throughout; every function reads only what its caller passes and returns a new
//   object, never mutating baseline, held, or freshRows in place. No function here writes to the
//   community's own store, or to any outbound bundle; the mirror's own real grades are untouched by
//   any decision this module or its caller renders. build/check-inbound-gate.mjs asserts this by
//   construction: an unaccepted pending entry is never mixed into computeUpdateList's own effect on
//   what the caller renders solid, since the caller (periphery/app.js) excludes every identity this
//   module reports as pending or held from the solid ranked feed, rendering it only as a ghost card.
"use strict";
import { epistemicCost } from "./epistemic-cost.js";

export function establishBaseline(freshRows, freshRaw, governanceHash) {
  return {
    claims: freshRows.map((r) => ({ identity: r.identity, kind: r.kind, grade: r.earned_grade })),
    kinds: freshRaw.kinds || [],
    sources: freshRaw.sources || [],
    governanceHash: governanceHash || null,
  };
}

// computeUpdateList: the honest diff. A row identical to the baseline (same grade) is already
// absorbed and renders normally; nothing about it appears here. A held record whose declinedGrade
// still matches the fresh grade stays quietly in stillHeld, browsable but not re-litigated; a held
// record whose declinedGrade no longer matches has been overtaken by new motion the reader has not
// seen yet, and returns to pending rather than staying silently suppressed under a stale decision.
export function computeUpdateList(baseline, held, freshRows) {
  const baselineByIdentity = new Map((baseline.claims || []).map((c) => [c.identity, c]));
  const heldByIdentity = new Map((held || []).map((h) => [h.identity, h]));
  const pending = [];
  const stillHeld = [];
  for (const row of freshRows) {
    const known = baselineByIdentity.get(row.identity);
    if (known && known.grade === row.earned_grade) continue;
    const type = known ? "grade-moved" : "new";
    const fromGrade = known ? known.grade : null;
    const entry = { identity: row.identity, kind: row.kind, statement: row.statement, type, fromGrade, toGrade: row.earned_grade };
    const heldRecord = heldByIdentity.get(row.identity);
    if (heldRecord && heldRecord.declinedGrade === row.earned_grade) {
      stillHeld.push({ ...entry, declinedGrade: heldRecord.declinedGrade, declinedAt: heldRecord.declinedAt });
    } else {
      pending.push(entry);
    }
  }
  return { pending, stillHeld };
}

export function flagContradictions(pending, stillHeld, links) {
  const heldIdentities = new Set(stillHeld.map((h) => h.identity));
  const contradictsLinks = (links || []).filter((l) => l.link_kind === "contradicts");
  return pending.map((p) => {
    const hit = contradictsLinks.find(
      (l) => (l.from_identity === p.identity && heldIdentities.has(l.to_identity)) ||
             (l.to_identity === p.identity && heldIdentities.has(l.from_identity))
    );
    return hit ? { ...p, contradictsHeld: hit.from_identity === p.identity ? hit.to_identity : hit.from_identity } : p;
  });
}

export function acceptIntoBaseline(baseline, freshRows, identities) {
  const idSet = new Set(identities);
  const byIdentity = new Map(freshRows.map((r) => [r.identity, r]));
  const nextClaims = (baseline.claims || []).filter((c) => !idSet.has(c.identity));
  for (const id of idSet) {
    const row = byIdentity.get(id);
    if (row) nextClaims.push({ identity: row.identity, kind: row.kind, grade: row.earned_grade });
  }
  return { ...baseline, claims: nextClaims };
}

export function clearHeld(held, identities) {
  const idSet = new Set(identities);
  return (held || []).filter((h) => !idSet.has(h.identity));
}

export function holdUpdates(held, pendingEntries, identities) {
  const idSet = new Set(identities);
  const byIdentity = new Map(pendingEntries.map((p) => [p.identity, p]));
  const next = (held || []).filter((h) => !idSet.has(h.identity));
  for (const id of idSet) {
    const p = byIdentity.get(id);
    if (p) next.push({ identity: p.identity, kind: p.kind, statement: p.statement, declinedGrade: p.toGrade, declinedAt: Date.now() });
  }
  return next;
}

export function adoptGovernanceHash(baseline, newHash) {
  return { ...baseline, governanceHash: newHash };
}

// the epistemic-cost tie-in (Step 5): "your parameters" are the kind and source tables the reader's
// own baseline was last taken under (spec's own adoption-as-parameters, read from the reader's side).
// Reuses api/epistemic-cost.js's exact recompute rather than a second implementation: freshRaw's real
// state and links stand as activeRaw (the graph a grade is derived over never changes here), while
// otherRaw substitutes the baseline's own kind/source tables in place of the fresh community's
// current ones, surfacing only the pending claims so the report reads as "these N pending changes,
// under what you've adopted so far."
export function recomputeUnderAdoptedParameters(pending, freshRaw, baseline) {
  const surfacedRows = pending.map((p) => ({ identity: p.identity, kind: p.kind, earned_grade: p.toGrade }));
  const otherRaw = { kinds: baseline.kinds || [], sources: baseline.sources || [] };
  return epistemicCost(surfacedRows, freshRaw, otherRaw);
}
