// Role: the earned-grade rule (intake data model v3, Section 9). Support delivery S over supports
//   links grouped by support_group, own basis B from checking records / constitutive kind, then the
//   two-row rule capped by the kind's ceiling. Settledness is not inherited: a claim resting on
//   settled support delivers S = settled, which converts to corroborated, never into the settled
//   tier; only a claim's own basis (a distinct-party checking record, or a constitutive kind) reaches
//   the settled tier, and only when its supports do not drag it down.
// Contract: earnedGrade({ kind, ceiling, constitutive, checkingRecords, supports, independenceLift })
//   -> { earned, mode, S, B }. Pure, ESM; kernel imports only kernel.
// Invariant: no numbers on the path; grades are named positions. Each support contributes
//   min(collapse(support earned), collapse(link grade)); within a group weakest-of, across groups
//   strongest-of; independence lifts delivery to corroborated and no further.
// GROUNDED: the recurrence properties (thm.earned-recurrence, thm.earned-linear, thm.ungrouped-singleton,
//   thm.settled-not-inherited, thm.determinism) are grounded in the math kernel at checked by differential
//   testing (build/check-math-differential.mjs, code-versus-extracted agreement over random graphs). The
//   lift to proof-floor by a formal proof is a characterized gap (docs/sorry-ledger.md, G-D).
"use strict";
import { collapse, collapsedRank, meet, join, capByCeiling, POSITIONS } from "../schema/confidence.mjs";

// footprints are Sets of source ids; two are disjoint when their intersection is empty.
function disjoint(a, b) {
  for (const x of a) if (b.has(x)) return false;
  return true;
}

// support delivery S, a collapsed position (one of ungraded/asserted/supported/corroborated/settled).
export function supportDelivery(supports) {
  if (!supports || supports.length === 0) return "asserted"; // support from nothing is nothing
  const groups = new Map();
  for (const s of supports) {
    // GROUNDED thm.ungrouped-singleton: a support with no group is its own singleton, so ungrouped
    // supports combine strongest-of (independent), not weakest-of. Pinned by the differential harness.
    const g = s.group == null ? s.linkIdentity || Symbol() : s.group;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(s);
  }
  const groupDelivery = new Map();
  for (const [g, members] of groups) {
    // per support: min(collapse of support earned, collapse of link grade); within group: weakest-of
    let d = "settled";
    for (const m of members) d = meet(d, meet(collapse(m.supportEarned), collapse(m.linkGrade)));
    groupDelivery.set(g, d);
  }
  // across groups: strongest-of
  let S = "ungraded";
  for (const d of groupDelivery.values()) S = join(S, d);
  // independence lift: two or more groups delivering >= supported with disjoint footprints -> S >= corroborated
  const eligible = [...groups.keys()].filter((g) => collapsedRank(groupDelivery.get(g)) >= 2);
  let lifted = false;
  for (let i = 0; i < eligible.length && !lifted; i++)
    for (let j = i + 1; j < eligible.length && !lifted; j++) {
      const fi = footprintOfGroup(groups.get(eligible[i]));
      const fj = footprintOfGroup(groups.get(eligible[j]));
      if (disjoint(fi, fj)) lifted = true;
    }
  if (lifted) S = join(S, "corroborated");
  return S;
}
function footprintOfGroup(members) {
  const f = new Set();
  for (const m of members) for (const s of m.footprint || []) f.add(s);
  return f;
}

// own basis B: a settled position (checked / independently-rechecked / constitutive) or "none".
export function ownBasis({ constitutive, checkingRecords }) {
  if (constitutive) return "constitutive";
  const distinct = (checkingRecords || []).filter((c) => c.independence === "distinct-party");
  if (distinct.length >= 2) {
    for (let i = 0; i < distinct.length; i++)
      for (let j = i + 1; j < distinct.length; j++)
        if (disjoint(new Set(distinct[i].footprint || []), new Set(distinct[j].footprint || [])))
          return "independently-rechecked";
  }
  if (distinct.length >= 1) return "checked";
  return "none";
}

// the two-row rule, capped by the ceiling.
export function earnedGrade({ ceiling, constitutive, checkingRecords, supports }) {
  const S = supportDelivery(supports);
  const B = ownBasis({ constitutive, checkingRecords });
  const Bsettled = B !== "none" && POSITIONS[B] && POSITIONS[B].tier === "settled";
  const noSupports = !supports || supports.length === 0;
  let earned;
  // GROUNDED thm.settled-not-inherited: the ceiling cap is the load-bearing detail. A settled S from
  // settled support becomes corroborated (below), so settledness is not inherited; only an own basis
  // reaches the settled tier, capped by the kind ceiling. Pinned by the differential harness.
  if (Bsettled && (collapsedRank(S) >= 3 /* corroborated */ || noSupports)) {
    earned = capByCeiling(B, ceiling); // first row: the basis stands, supports permitting
  } else {
    // second row: S, capped at corroborated (a settled S from settled support becomes corroborated)
    const sCapped = collapsedRank(S) >= 4 ? "corroborated" : (S === "settled" ? "corroborated" : S);
    earned = capByCeiling(sCapped, ceiling);
  }
  return { earned, mode: POSITIONS[earned] ? POSITIONS[earned].mode : null, S, B };
}
