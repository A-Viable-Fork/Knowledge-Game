// Role: the epistack-competition kernel store: the competition community's founding claims, entered
//   in two honestly separated registers. Twelve mechanical claims (kind measurement) are supportable
//   today: each carries a real checking record citing a named check from the pinned reference
//   implementation's own suite (upstream/epistack@674e7b62, the same commit build/check-substrate.mjs
//   locks this deployment's vendored copy to), run directly against that pinned commit and computing
//   to `checked`. Six evaluative claims (kind forum) are the submission's own theses, entered bare,
//   with no support and no checking record, so the gate floors them at `asserted`, their honest floor:
//   these await semantic acceptance by the judges and participants who alone can give it, the
//   community this kernel is founded to hold open for.
// Contract: exports STORE = { store_id, claims, links }. Pure data; imports nothing.
// Invariant: no grade is asserted by hand; declared_grade on every mechanical claim is at or below
//   what its checking record actually earns, and every evaluative claim's declared_grade is asserted,
//   its honest unsupported floor, both verified by the real gate in build/check-epistack-competition.mjs,
//   not by this comment.
"use strict";

const STORE = {
  store_id: "epistack-competition",
  claims: [
    // ---- mechanical protocol claims: verification-shaped, checked against the pinned commit's own suite ----
    {
      ref: "claim-1",
      kind: "measurement",
      statement: "The v3 gate's canonical form is deterministic: a re-run of the same input produces a byte-exact canonical form, with no floating-point value on the path.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-epistack-competition",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "upstream/epistack/build/check-gate.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence: runs the pinned reference implementation's own gate oracle (build/check-gate.mjs) against upstream/epistack@674e7b62, phases A through D, asserting byte-exact canonical forms and no float on the path",
          checked_at_state: "upstream-epistack@674e7b62",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-2",
      kind: "measurement",
      statement: "The gate admits a claim only when its declared grade is covered by the grade the earned-grade recurrence actually derives from its support structure, never above it.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-epistack-competition",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "upstream/epistack/build/check-gate.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence: the same gate oracle run asserts the gate never admits a claim above what its own recurrence derives from its cited supports",
          checked_at_state: "upstream-epistack@674e7b62",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-3",
      kind: "measurement",
      statement: "A type bundle's content-address hashes deterministically, and any change to a meaning-bearing field changes the hash: two parties mean the same type exactly when they pin the same hash.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-epistack-competition",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "upstream/epistack/build/check-type-hash.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence: runs the pinned reference implementation's type-hash oracle, asserting determinism and that every meaning-bearing field is load-bearing in the hash",
          checked_at_state: "upstream-epistack@674e7b62",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-4",
      kind: "measurement",
      statement: "A claim of a type both kernels pin composes natively and losslessly across the crossing between them.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-epistack-competition",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "upstream/epistack/build/check-crossing.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence: runs the pinned reference implementation's crossing oracle over four independent kernels pinning type-hashes, asserting native composition for a shared-pin type",
          checked_at_state: "upstream-epistack@674e7b62",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-5",
      kind: "measurement",
      statement: "A claim of a type the target kernel did not pin arrives untyped and grounds nothing there, until the target forks the type in for itself.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-epistack-competition",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "upstream/epistack/build/check-crossing.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence: the same crossing oracle run asserts an unpinned type arrives untyped and grounds nothing until the target adopts it by fork",
          checked_at_state: "upstream-epistack@674e7b62",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-6",
      kind: "measurement",
      statement: "A gate-decided contribution bundle carries a content-derived identity, order-independent over its constituent records, so a tampered bundle's recomputed id no longer matches its declared one.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-epistack-competition",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "upstream/epistack/build/check-contribution.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence: runs the pinned reference implementation's contribution-export oracle, asserting the bundle id is content-derived and order-independent and that a tampered bundle is rejected loudly",
          checked_at_state: "upstream-epistack@674e7b62",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-7",
      kind: "measurement",
      statement: "A kernel snapshot emits as a static file whose declared hash verifies against its own content, loadable by a fat client that runs the real gate over it with no server.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-epistack-competition",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "upstream/epistack/build/check-contribution.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence: the same oracle run asserts the standalone snapshot's declared hash verifies against its own content and a mutated snapshot fails verification",
          checked_at_state: "upstream-epistack@674e7b62",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-8",
      kind: "measurement",
      statement: "A type fork is a deterministic snapshot operation naming its parent type-hash and its exact departure; the parent bundle is never mutated by forking it.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-epistack-competition",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "upstream/epistack/build/check-fork-contest.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence: runs the pinned reference implementation's fork-and-contest oracle, asserting forkType is a deterministic snapshot fork naming its parent and departure and never mutating the parent",
          checked_at_state: "upstream-epistack@674e7b62",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-9",
      kind: "measurement",
      statement: "Admitting a contest claim against a type already in use moves no pre-existing claim's earned grade or certificate: a contest is recorded at its own standing and changes no one else's.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-epistack-competition",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "upstream/epistack/build/check-fork-contest.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence: the same oracle run asserts admitting a contest against a type in use leaves every pre-existing claim's earned grade and certificate byte-identical",
          checked_at_state: "upstream-epistack@674e7b62",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-10",
      kind: "measurement",
      statement: "A claim's single points of failure are found by re-derivation over its actual support structure, never by an asserted importance or priority field.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-epistack-competition",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "upstream/epistack/build/check-robustness.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence: runs the pinned reference implementation's robustness oracle over synthetic fixtures and migrated cases, asserting fragility and single points of failure are re-derived, not asserted",
          checked_at_state: "upstream-epistack@674e7b62",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-11",
      kind: "measurement",
      statement: "A characterized gap carries no importance, score, weight, or priority field: gap detection is a distinct function from ranking, and the objective/subjective boundary between them is structural.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-epistack-competition",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "upstream/epistack/build/check-gaps.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence: runs the pinned reference implementation's gap-detector oracle, asserting the detector reproduces the sorry ledger, adds no false gap, and ranks nothing",
          checked_at_state: "upstream-epistack@674e7b62",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-12",
      kind: "measurement",
      statement: "In the pinned reference implementation itself, every periphery module reaches the graph only through the read and propose contract, never past it to the kernel's own truth fields.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-epistack-competition",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "upstream/epistack/build/check-map.mjs",
          method_class: "direct-measurement",
          method: "static-analysis evidence: runs the pinned reference implementation's own import-graph oracle, asserting every periphery import edge satisfies its trust boundary and every flow is supported",
          checked_at_state: "upstream-epistack@674e7b62",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },

    // ---- evaluative claims: the submission's own theses, entered bare, floor = asserted, awaiting
    // the judges' and participants' semantic acceptance, never mechanically checkable ----
    {
      ref: "claim-13",
      kind: "forum",
      statement: "Uplift is trust composed with view: a kernel establishes trust once, computed and checkable, a periphery supplies a view fitted to one reader, and the uplift is the composition of the two.",
      source_id: "S-epistack-submission-argument",
      contributor_id: "P-epistack-competition",
      declared_grade: "asserted"
    },
    {
      ref: "claim-14",
      kind: "forum",
      statement: "A market of views over one shared trust base lets many specialized interfaces compete on how to show the same knowledge while agreeing on the knowledge itself, which a synthesis cannot support because it fuses trust and view into one artifact.",
      source_id: "S-epistack-submission-argument",
      contributor_id: "P-epistack-competition",
      declared_grade: "asserted"
    },
    {
      ref: "claim-15",
      kind: "forum",
      statement: "The periphery is minimal by design: an existence proof that the interface is cheap to build once the underlying structure is checkable, not a limitation on what could be built.",
      source_id: "S-epistack-submission-argument",
      contributor_id: "P-epistack-competition",
      declared_grade: "asserted"
    },
    {
      ref: "claim-16",
      kind: "forum",
      statement: "The contribution of this submission is properly located in the kernel, not in the periphery's thickness; a thicker periphery would misrepresent a protocol's checkable core as a finished product.",
      source_id: "S-epistack-submission-argument",
      contributor_id: "P-epistack-competition",
      declared_grade: "asserted"
    },
    {
      ref: "claim-17",
      kind: "forum",
      statement: "Knowledge is the invariant left as the model is attenuated: what a claim's dependence on any one knower reduces to as trust in the asserter is subtracted.",
      source_id: "S-epistack-submission-argument",
      contributor_id: "P-epistack-competition",
      declared_grade: "asserted"
    },
    {
      ref: "claim-18",
      kind: "forum",
      statement: "Verification and convergence are the two forms typing-attenuation takes depending on whether a type self-secures: a proof's attenuation completes to zero, while a measurement's attenuation approaches a floor without reaching it.",
      source_id: "S-epistack-submission-argument",
      contributor_id: "P-epistack-competition",
      declared_grade: "asserted"
    },
    // ---- claim-19: the first admitted contribution (Phase B/C Step 4), a support attaching a real
    // check run to claim-10, submitted through this app's own contribution path (bundle
    // communities/epistack-competition/contributions/0001-*.json), admitted here by this community. ----
    {
      ref: "claim-19",
      kind: "measurement",
      statement: "The ranking/objective perturbation overlay's consequence cascade is computed from the support graph and reproduces the authored cascade fixture, rather than being asserted; the overlay is non-destructive and deterministic across repeated runs.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-epistack-competition-contributor-1",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "upstream/epistack/build/check-perturb.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence: runs the pinned reference implementation's perturbation oracle over the LHC case, asserting the computed cascade reproduces the authored one and the overlay is non-destructive and deterministic",
          checked_at_state: "upstream-epistack@674e7b62",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    }
  ],
  links: [
    { link_kind: "supports", from: "claim-19", to: "claim-10", support_group: "g:claim-10/claim-19", source_id: "S-epistack-protocol-spec", contributor_id: "P-epistack-competition-contributor-1", declared_grade: "corroborated" }
  ]
};

module.exports = { STORE };
