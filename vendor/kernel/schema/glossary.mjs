// Role: the self-describing vocabulary (DESCRIBE-1). Every grade in the confidence order, every
//   claim kind the shared root pins in common, every link kind the schema carries, and the
//   declared-versus-earned concept, each with a plain-language description, authored once here and
//   rendered by every client instead of hand-written per surface. The load-bearing entry is
//   declared-vs-earned: a grade selector reads as a confidence knob the composer controls, and it is
//   not one. The composer declares what they claim; the gate prices what it earns; the divergence is
//   a finding, not a failure.
// Contract: exports GRADES, KINDS, LINKS, CONCEPTS, glossary() -> the four as one frozen object, and
//   completenessAgainst(realKinds, realLinks) -> { grades, kinds, links }, each a { missing, extra }
//   pair, for a caller (build/check-glossary.mjs) to verify against the real schema. Pure data plus
//   one accessor and one checker; imports only POSITIONS. ESM; kernel imports only kernel.
// Invariant: keyed to the schema by identity, not by a hand-copied list. GRADES is checked against
//   POSITIONS directly (imported here); KINDS and LINKS are checked against the real schema by the
//   caller, since a claim kind's canonical home is corpora/_shared/common-types.js (kernel imports
//   only kernel, so it cannot be imported here) and LINK_KINDS is not exported from records.mjs. This
//   module never authors a description a client renders differently; a client renders, it never
//   retypes.
"use strict";
import { POSITIONS } from "./confidence.mjs";

// one entry per grade in the confidence order (kernel/schema/confidence.mjs POSITIONS). description
// names the standing the grade advertises; whenToUse names what a composer declaring it is claiming
// and what the gate needs to grant it, so the pair together corrects the confidence-knob misreading.
export const GRADES = {
  ungraded: {
    description: "the floor. Nothing grounds this entry yet: no citation, no resting claim, no check.",
    whenToUse: "a composer declaring ungraded is claiming nothing beyond the bare statement; the gate grants this to any well-formed entry with no basis, and it is where every entry starts.",
  },
  asserted: {
    description: "a claim standing on its own say-so, above the floor by declaration alone.",
    whenToUse: "a composer declaring asserted is claiming only their own word backs the statement; the gate grants this once the entry is well-formed, before any citation or resting claim lifts it further.",
  },
  supported: {
    description: "a claim lifted above bare assertion by at least one citation or resting claim.",
    whenToUse: "a composer declaring supported is claiming some real grounding lifts the statement; the gate grants this when a checking record or a supports link into the claim actually raises the fold.",
  },
  corroborated: {
    description: "a claim lifted by more than one independent line of support, each resting on a distinct footprint.",
    whenToUse: "a composer declaring corroborated is claiming independent lines agree; the gate grants this only when the corroboration-independence reading finds genuinely disjoint support, not the same source counted twice.",
  },
  checked: {
    description: "the empirical settled floor: a measurement verified by a checking record from a distinct party.",
    whenToUse: "a composer declaring checked is claiming their measurement was independently verified; the gate grants this to a measurement-kind claim once a distinct-party checking record confirms it.",
  },
  "independently-rechecked": {
    description: "the empirical settled ceiling: checked again by a second distinct party, past the first check.",
    whenToUse: "a composer declaring independently-rechecked is claiming two separate parties verified it; the gate grants this only when a second, distinct-party recheck lands on top of an already-checked claim.",
  },
  constitutive: {
    description: "the settled position for declarations: true by construction and definition, not by empirical outcome.",
    whenToUse: "a composer declaring constitutive is claiming their statement holds by stipulation; the gate grants this to a declaration-kind claim that holds by construction, on a settled axis a measurement never reaches.",
  },
};

// one entry per claim kind the shared root pins in common (corpora/_shared/common-types.js
// COMMON_BUNDLES), the kinds more than one kernel adopts by reference rather than minting locally.
// A kernel-local kind (a corpus's own extension, for example the math kernel's "theorem") is not
// shared-root vocabulary and carries no entry here, the same split the compute layer draws between
// the canonical packs and a corpus-forkable one.
export const KINDS = {
  measurement: {
    description: "a claim closed by a direct observation of the world, the empirical floor a case rests on.",
    ceiling: "checked",
  },
  forum: {
    description: "a contested interpretation or evaluative thesis, open to disagreement and never settled.",
    ceiling: "corroborated",
  },
  declaration: {
    description: "a constitutive definition or stipulation, true by construction rather than by empirical check.",
    ceiling: "constitutive",
  },
  comment: {
    description: "discussion attached to a claim, a link, or another comment; never itself a claim and never citable as support, so a thread travels with the graph and moves no grade.",
    ceiling: "ungraded",
  },
};

// one entry per link kind the schema carries (kernel/schema/records.mjs LINK_KINDS), naming what
// computation each one routes to. Only supports enters the gate's earned-grade fold; the others are
// inert with respect to grading by construction, each routed to its own reading instead.
export const LINKS = {
  supports: {
    description: "the sole route by which a claim rests on another claim or a checking record; it is the only link kind the gate's earned-grade fold reads, so what a claim rests on is exactly what it names here.",
  },
  "depends-on": {
    description: "names a precondition that must be in force for this entry to stand; the gate's currency check declines a contribution whose depends-on target is missing or superseded.",
  },
  contradicts: {
    description: "marks two claims as opposed positions on shared evidence; it routes to the contradiction register and the reconciliation reading, entering no grade fold of its own.",
  },
  refines: {
    description: "marks one claim as a narrower or more specific version of another, disaggregating a general finding into a qualifying case, without adding support.",
  },
  restatement: {
    description: "marks one claim as the same content restated; the gate closes a restatement pair into one identity before folding support, so a claim and its restatement share one earned grade.",
  },
  undercut: {
    description: "attacks a support link's own grounding rather than adding a competing claim; the robustness reading lowers the confidence the attacked leg transmits, entering no grade fold of its own.",
  },
  "comments-on": {
    description: "attaches a comment to a claim or a link for discussion; the comment-support guard bars any comment from entering a supports role, so the thread moves no grade.",
  },
  "replies-to": {
    description: "attaches a comment to another comment, continuing a thread; it carries no support role by construction, the same as comments-on.",
  },
};

// the load-bearing concept: a grade selector reads as a confidence knob, and it is not one.
export const CONCEPTS = {
  "declared-vs-earned": {
    description: "a composer declares the grade they believe their statement deserves; the gate independently prices what the entry actually earns from its citations, its resting claims, and its checks. The two can differ: a claim declared corroborated might earn only asserted, or a claim entered without ceremony might earn more once support lands. That divergence is reported as a finding, not corrected as an error and not treated as a failure. The grade selector is a declaration the gate checks against the graph, not a dial that sets the outcome.",
  },
};

// completeness against the real schema. GRADES is checked here directly, against the imported
// POSITIONS; KINDS and LINKS are checked against whatever real sets the caller supplies, since
// neither list can be imported into this kernel module without either crossing the trust boundary
// (KINDS lives in corpora/_shared) or a symbol that records.mjs does not export (LINK_KINDS). One
// function, so a caller never re-derives the missing/extra logic per surface.
export function completenessAgainst(realKinds, realLinks) {
  const missing = (real, have) => real.filter((k) => !have.includes(k));
  const extra = (real, have) => have.filter((k) => !real.includes(k));
  const gradeReal = Object.keys(POSITIONS);
  const gradeHave = Object.keys(GRADES);
  const kindHave = Object.keys(KINDS);
  const linkHave = Object.keys(LINKS);
  return {
    grades: { missing: missing(gradeReal, gradeHave), extra: extra(gradeReal, gradeHave) },
    kinds: { missing: missing(realKinds, kindHave), extra: extra(realKinds, kindHave) },
    links: { missing: missing(realLinks, linkHave), extra: extra(realLinks, linkHave) },
  };
}

// the whole glossary as one frozen object, the shape every client renders unchanged.
export function glossary() {
  return Object.freeze({
    GRADES: Object.freeze(Object.assign({}, GRADES)),
    KINDS: Object.freeze(Object.assign({}, KINDS)),
    LINKS: Object.freeze(Object.assign({}, LINKS)),
    CONCEPTS: Object.freeze(Object.assign({}, CONCEPTS)),
  });
}
