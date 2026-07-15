// Role: the v3 confidence order (intake data model v3, Section 9). An enumerated lattice: the
//   bottom and the open grades form a line; the settled tier is a branch, an empirical axis
//   (checked < independently-rechecked) and a constitutive position incomparable to it. For every
//   combination step all settled positions collapse to one level `settled`, giving the working
//   line 0 < 1 < 2 < 3 < settled with meet, join, and floor-collapse.
// Contract: POSITIONS, modeOf, tierOf, collapse, collapsedRank, meet, join, leqWithinMode,
//   comparableWithinMode. Pure, ESM; kernel imports only kernel.
// Invariant: no numbers on the epistemic path here either, grades are named positions. This is the
//   one canonical grounding order; the Stage 1 trellis lattice that once sat beside it (a different
//   vocabulary of untyped/forum tiers/floors) was retired in Prompt 16, leaving this the sole order.
// GROUNDED: the lattice laws over the grade set (meet, join, capByCeiling) are grounded in the math
//   kernel at proof-floor by exhaustion (corpora/math/: thm.meet-*, thm.join-*, thm.absorption,
//   thm.lattice, thm.mode-incomparable-welldefined; proved by build/check-math-exhaustion.mjs).
"use strict";

// each grade: its collapsed line rank (0..4), its tier, and its mode within the settled branch.
export const POSITIONS = {
  ungraded: { collapsedRank: 0, tier: "bottom", mode: null },
  asserted: { collapsedRank: 1, tier: "open", mode: null },
  supported: { collapsedRank: 2, tier: "open", mode: null },
  corroborated: { collapsedRank: 3, tier: "open", mode: null },
  checked: { collapsedRank: 4, tier: "settled", mode: "empirical", empiricalRank: 1 },
  "independently-rechecked": { collapsedRank: 4, tier: "settled", mode: "empirical", empiricalRank: 2 },
  constitutive: { collapsedRank: 4, tier: "settled", mode: "constitutive" },
};

// the collapsed line, low to high, used by every combination step.
export const COLLAPSED = ["ungraded", "asserted", "supported", "corroborated", "settled"];
const COLLAPSED_RANK = { ungraded: 0, asserted: 1, supported: 2, corroborated: 3, settled: 4 };

export function isPosition(p) {
  return Object.prototype.hasOwnProperty.call(POSITIONS, p);
}
export function tierOf(p) {
  return POSITIONS[p] ? POSITIONS[p].tier : null;
}
export function modeOf(p) {
  return POSITIONS[p] ? POSITIONS[p].mode : null;
}
// collapse a grade to its position on the working line: every settled grade -> "settled".
export function collapse(p) {
  if (p === "settled") return "settled";
  const e = POSITIONS[p];
  if (!e) throw new Error(`unknown grade: ${p}`);
  return e.tier === "settled" ? "settled" : p;
}
export function collapsedRank(p) {
  const c = p === "settled" ? "settled" : collapse(p);
  return COLLAPSED_RANK[c];
}

// meet (weakest-of) and join (strongest-of) on the collapsed line; inputs and output are collapsed
// positions (one of COLLAPSED). These are the only combinators the earned-grade fold uses.
export function meet(a, b) {
  // GROUNDED thm.meet-* / thm.absorption: the greatest lower bound on the collapsed line, proved
  // commutative, associative, idempotent, and absorptive by exhaustion (check-math-exhaustion.mjs).
  return collapsedRank(a) <= collapsedRank(b) ? collapse(a) : collapse(b);
}
export function join(a, b) {
  // GROUNDED thm.join-* / thm.absorption: the least upper bound on the collapsed line, the dual of meet.
  return collapsedRank(a) >= collapsedRank(b) ? collapse(a) : collapse(b);
}

// within-mode comparison for the gate (Section 9). Two settled positions in different modes are
// incomparable; comparing them is undefined, which the gate reads as a decline, not a failed test.
export function comparableWithinMode(a, b) {
  const ea = POSITIONS[a], eb = POSITIONS[b];
  if (!ea || !eb) throw new Error(`unknown grade: ${!ea ? a : b}`);
  if (ea.tier === "settled" && eb.tier === "settled") return ea.mode === eb.mode;
  return true; // open/bottom grades are on the shared line and compare freely
}
// cap a concrete earned position by a concrete ceiling position (Section 9, "Earned never exceeds
// ceiling"). Drops to the ceiling when the earned rank exceeds it; on the empirical settled axis the
// finer empiricalRank decides. Ceiling fixes mode, so a settled earned only meets a settled ceiling
// of the same mode by construction of the basis.
export function capByCeiling(pos, ceiling) {
  const rp = collapsedRank(pos), rc = collapsedRank(ceiling);
  if (rp < rc) return pos;
  if (rp > rc) return ceiling;
  const ep = POSITIONS[pos], ec = POSITIONS[ceiling];
  if (ep.tier === "settled" && ec.tier === "settled" && ep.mode === "empirical" && ec.mode === "empirical")
    return ep.empiricalRank <= ec.empiricalRank ? pos : ceiling;
  return pos;
}

// declared <= earned within a mode. Returns { comparable, leq }. On the empirical settled axis the
// finer empiricalRank decides; otherwise the collapsed rank decides.
export function leqWithinMode(declared, earned) {
  if (!comparableWithinMode(declared, earned)) return { comparable: false, leq: false };
  const ed = POSITIONS[declared], ee = POSITIONS[earned];
  if (ed.tier === "settled" && ee.tier === "settled") {
    if (ed.mode === "empirical" && ee.mode === "empirical")
      return { comparable: true, leq: ed.empiricalRank <= ee.empiricalRank };
    return { comparable: true, leq: true }; // same settled mode, e.g. constitutive == constitutive
  }
  return { comparable: true, leq: collapsedRank(declared) <= collapsedRank(earned) };
}
