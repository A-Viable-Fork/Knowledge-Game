// Role: the front-page kernel store: the root front page's own six-question argument, decomposed
//   into typed claims (Phase KG-claim-lens). Each sentence or clause the page asserts becomes a
//   claim, kind chosen honestly: "declaration" (ceiling constitutive) for definitional or
//   protocol-shape statements this deployment simply stipulates, "forum" (ceiling corroborated) for
//   interpretive weighings the epistack submission's own docs ground at a citation's honest floor,
//   "measurement" (ceiling checked, shared with kernel/governance) for the three app-behavior
//   sentences (Q6 and the footer) that restate a real governance claim already grounded there.
// Restatement (fp-16, fp-17, fp-19, fp-20): each carries a real link_kind "restatement" to the
//   governance claim identity that actually grounds the fact (claim-9, claim-1, claim-19). The
//   mechanical effect of a restatement link in the real gate (vendor/kernel/gate/gate.mjs's
//   restatementClosure/earnedOf) is to join the two identities for supports-sharing purposes, not
//   to copy a co-closure member's already-stored grade onto the new entry; a front-page claim's own
//   earned_grade computes from its own checking_records regardless (honestly "asserted", its own
//   floor, absent local evidence). The lens (periphery/root-lens.js) reads the restated identity's
//   OWN row from this same snapshot (mirrored in below as a verbatim, identically-keyed entry) and
//   displays THAT row's earned_grade as the carried standing, the same indirection the entrance
//   listing's claim-26/27 references_claim extension already established, now backed by a real,
//   schema-validated link instead of a bare string pointer.
// Mirrored governance entries: claim-1, claim-9, and claim-19 below are NOT front-page originals;
//   their kind/statement/source_id/contributor_id/declared_grade/checking_records are copied
//   verbatim from kernel/governance/corpora/knowledge-game-data.js (computeClaimIdentity hashes
//   kind+statement alone, so an exact copy produces the identical identity the governance kernel's
//   own snapshot already carries for the same ref). build/front-page-build.mjs pulls these directly
//   from that file at build time rather than retyping them by hand, so the two can never drift.
// Contract: exports STORE = { store_id, claims, links }. Pure data; imports nothing. The `mirrors`
//   array names which claim refs are pulled from governance rather than authored here, read by
//   build/front-page-build.mjs and build/check-front-page-lens.mjs.
// Invariant: no grade is asserted by hand; every claim's declared_grade is at or below what the real
//   gate actually earns it, verified by build/check-front-page-lens.mjs, not by this comment.
"use strict";

const STORE = {
  store_id: "front-page",
  mirrors: ["claim-1", "claim-9", "claim-19"],
  claims: [
    {
      ref: "fp-1",
      kind: "forum",
      statement: "The competition asked for epistemic tooling on hard contested questions, its three named cases being pandemic origins, black holes, and eggs: turn messy sources into typed claims tied to their origins, make the relations among claims legible, tell a reader what to believe and what to look at next, scale with better AI, and compound across people and teams.",
      source_id: "S-fp-epistack-submission",
      contributor_id: "P-front-page",
      declared_grade: "asserted",
      url: "https://github.com/A-Viable-Fork/epistack/blob/main/docs/criteria-to-architecture-map.md"
    },
    {
      ref: "fp-2",
      kind: "forum",
      statement: "This submission reads all of that as one goal: knowledge that survives attenuation.",
      source_id: "S-fp-epistack-submission",
      contributor_id: "P-front-page",
      declared_grade: "asserted",
      url: "https://github.com/A-Viable-Fork/epistack/blob/main/docs/the-minimum-constitution.md"
    },
    {
      ref: "fp-3",
      kind: "declaration",
      statement: "A claim counts as knowledge when it still stands after trust in whoever produced it is dialed down toward zero, and work compounds exactly when communities' claims compose without importing each other's authority.",
      source_id: "S-fp-epistack-submission",
      contributor_id: "P-front-page",
      declared_grade: "constitutive",
      url: "https://github.com/A-Viable-Fork/epistack/blob/main/docs/the-minimum-constitution.md"
    },
    {
      ref: "fp-4",
      kind: "forum",
      statement: "The internet, in three configurations, carrying claims on a substrate that sees only packets.",
      source_id: "S-fp-epistack-submission",
      contributor_id: "P-front-page",
      declared_grade: "asserted",
      url: "https://github.com/A-Viable-Fork/epistack/blob/main/docs/the-tcpip-counterexample.md"
    },
    {
      ref: "fp-5",
      kind: "forum",
      statement: "A cooperative kernel where social accountability supplied the verification; the same contracts meeting an adversarial population; a patched kernel where authorities compensate for standing that does not recompute.",
      source_id: "S-fp-epistack-submission",
      contributor_id: "P-front-page",
      declared_grade: "asserted",
      url: "https://github.com/A-Viable-Fork/epistack/blob/main/docs/the-tcpip-counterexample.md"
    },
    {
      ref: "fp-6",
      kind: "forum",
      statement: "Each era, encoded as a kernel and run through the protocol's conformance checker, violates exactly the invariants the contracts fix, with each violation mapped to a documented failure, so the recentralization is derived rather than asserted.",
      source_id: "S-fp-epistack-submission",
      contributor_id: "P-front-page",
      declared_grade: "asserted",
      url: "https://github.com/A-Viable-Fork/epistack/blob/main/docs/the-tcpip-counterexample.md"
    },
    {
      ref: "fp-7",
      kind: "forum",
      statement: "The same trajectory is now beginning one layer up, over claims themselves.",
      source_id: "S-fp-epistack-submission",
      contributor_id: "P-front-page",
      declared_grade: "asserted",
      url: "https://github.com/A-Viable-Fork/epistack/blob/main/docs/the-minimum-constitution.md#the-internet-already-ran-this-experiment"
    },
    {
      ref: "fp-8",
      kind: "forum",
      statement: "The history above is what recursive modelers do to fixed trust signals: model them, aim at them, and manufacture them cheaper than the substance they once certified.",
      source_id: "S-fp-epistack-submission",
      contributor_id: "P-front-page",
      declared_grade: "asserted",
      url: "https://github.com/A-Viable-Fork/epistack/blob/main/docs/the-asymmetric-weapon.md"
    },
    {
      ref: "fp-9",
      kind: "declaration",
      statement: "The division that survives this: fix the little that composition and adversaries require, as contracts, and leave every semantic judgment free, as parameters, because semantic controls spend the exact variety communities need for judging.",
      source_id: "S-fp-epistack-submission",
      contributor_id: "P-front-page",
      declared_grade: "constitutive",
      url: "https://github.com/A-Viable-Fork/epistack/blob/main/docs/contract-register.md"
    },
    {
      ref: "fp-10",
      kind: "declaration",
      statement: "Eleven fixed contracts and a gate.",
      source_id: "S-fp-epistack-submission",
      contributor_id: "P-front-page",
      declared_grade: "constitutive",
      url: "https://github.com/A-Viable-Fork/epistack/blob/main/docs/contract-register.md"
    },
    {
      ref: "fp-11",
      kind: "declaration",
      statement: "Claims are typed and content-addressed; a grade recomputes from the public graph; an import grounds nothing until a local fork types it; views move no grade.",
      source_id: "S-fp-epistack-submission",
      contributor_id: "P-front-page",
      declared_grade: "constitutive",
      url: "https://github.com/A-Viable-Fork/epistack/blob/main/docs/contract-register.md"
    },
    {
      ref: "fp-12",
      kind: "declaration",
      statement: "Everything else, the type systems, the standing rules, the forums, the licenses, is a free parameter, and a boundary linter holds the two registers disjoint.",
      source_id: "S-fp-epistack-submission",
      contributor_id: "P-front-page",
      declared_grade: "constitutive",
      url: "https://github.com/A-Viable-Fork/epistack/blob/main/docs/contract-register.md"
    },
    {
      ref: "fp-13",
      kind: "forum",
      statement: "Every mature institution runs these mechanisms by hand: precedent chains in common law, dependency graphs in software, replication in science, load orders in game modding, slashing in decentralized finance.",
      source_id: "S-fp-epistack-submission",
      contributor_id: "P-front-page",
      declared_grade: "asserted",
      url: "https://github.com/A-Viable-Fork/epistack/tree/main/corpora/lineage"
    },
    {
      ref: "fp-14",
      kind: "forum",
      statement: "The lineage corpus grounds that record and one conjecture: nothing yet composes all five axes for empirical and contested knowledge.",
      source_id: "S-fp-epistack-submission",
      contributor_id: "P-front-page",
      declared_grade: "asserted",
      url: "https://github.com/A-Viable-Fork/epistack/tree/main/corpora/lineage"
    },
    {
      ref: "fp-15",
      kind: "declaration",
      statement: "A feed over typed claims",
      source_id: "S-fp-self-declared",
      contributor_id: "P-front-page",
      declared_grade: "constitutive"
    },
    {
      ref: "fp-16",
      kind: "measurement",
      statement: "every grade computed on your device from the public graph",
      source_id: "S-fp-self-declared",
      contributor_id: "P-front-page",
      declared_grade: "asserted",
      restates: "claim-9"
    },
    {
      ref: "fp-17",
      kind: "measurement",
      statement: "the ranking set by you and moving no grade",
      source_id: "S-fp-self-declared",
      contributor_id: "P-front-page",
      declared_grade: "asserted",
      restates: "claim-1"
    },
    {
      ref: "fp-18",
      kind: "declaration",
      statement: "The repository's checks rerun in about two minutes",
      source_id: "S-fp-self-declared",
      contributor_id: "P-front-page",
      declared_grade: "constitutive"
    },
    {
      ref: "fp-19",
      kind: "measurement",
      statement: "the substrate is pinned to the protocol by commit and hash",
      source_id: "S-fp-self-declared",
      contributor_id: "P-front-page",
      declared_grade: "asserted",
      restates: "claim-19"
    },
    {
      ref: "fp-20",
      kind: "measurement",
      statement: "Grades are computed on device from the public graph.",
      source_id: "S-fp-self-declared",
      contributor_id: "P-front-page",
      declared_grade: "asserted",
      restates: "claim-9"
    },
    {
      ref: "fp-21",
      kind: "declaration",
      statement: "A grade is a computed reading, never a claim of truth.",
      source_id: "S-fp-self-declared",
      contributor_id: "P-front-page",
      declared_grade: "constitutive"
    }
  ],
  links: [
    { link_kind: "restatement", from: "fp-16", to: "claim-9", source_id: "S-fp-self-declared", contributor_id: "P-front-page", declared_grade: "asserted" },
    { link_kind: "restatement", from: "fp-17", to: "claim-1", source_id: "S-fp-self-declared", contributor_id: "P-front-page", declared_grade: "asserted" },
    { link_kind: "restatement", from: "fp-19", to: "claim-19", source_id: "S-fp-self-declared", contributor_id: "P-front-page", declared_grade: "asserted" },
    { link_kind: "restatement", from: "fp-20", to: "claim-9", source_id: "S-fp-self-declared", contributor_id: "P-front-page", declared_grade: "asserted" }
  ]
};

module.exports = { STORE };
