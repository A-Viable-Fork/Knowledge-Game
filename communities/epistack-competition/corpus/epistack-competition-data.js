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
    },
    {
      ref: "claim-20",
      kind: "declaration",
      statement: "synthesis: a single reasoner's integrated answer, reading everything and tying each claim to its source, but still one viewpoint's reach.",
      source_id: "S-epistack-vocabulary",
      contributor_id: "P-epistack-vocabulary",
      declared_grade: "constitutive"
    },
    {
      ref: "claim-21",
      kind: "declaration",
      statement: "typed claim graph: claims labeled by what kind of thing they are and connected to what they rest on, with one rule doing the work.",
      source_id: "S-epistack-vocabulary",
      contributor_id: "P-epistack-vocabulary",
      declared_grade: "constitutive"
    },
    {
      ref: "claim-22",
      kind: "declaration",
      statement: "grounding rule: a claim is as grounded as its weakest necessary support, recomputable by any party trusting no one.",
      source_id: "S-epistack-vocabulary",
      contributor_id: "P-epistack-vocabulary",
      declared_grade: "constitutive"
    },
    {
      ref: "claim-23",
      kind: "declaration",
      statement: "gate: the sole write path, admitting a contribution only if it holds together with what is already there and rechecking every declared grade on every change.",
      source_id: "S-epistack-vocabulary",
      contributor_id: "P-epistack-vocabulary",
      declared_grade: "constitutive"
    },
    {
      ref: "claim-24",
      kind: "declaration",
      statement: "forum: the contested region of the ordering, tiered from raw through structured, where claims are weighed rather than verified.",
      source_id: "S-epistack-vocabulary",
      contributor_id: "P-epistack-vocabulary",
      declared_grade: "constitutive"
    },
    {
      ref: "claim-25",
      kind: "declaration",
      statement: "characterized gap: an open claim carrying its location, its bounds, and the instance that would close it, so an open line is a located object.",
      source_id: "S-epistack-vocabulary",
      contributor_id: "P-epistack-vocabulary",
      declared_grade: "constitutive"
    },
    {
      ref: "claim-26",
      kind: "declaration",
      statement: "standing: a claim's grounded grade in the ordering, computed from the structure rather than granted by an authority.",
      source_id: "S-epistack-vocabulary",
      contributor_id: "P-epistack-vocabulary",
      declared_grade: "constitutive"
    },
    {
      ref: "claim-27",
      kind: "declaration",
      statement: "producer: anything that emits claims into the kernel, whether a person, an organization, a model, or a pipeline of these.",
      source_id: "S-epistack-vocabulary",
      contributor_id: "P-epistack-vocabulary",
      declared_grade: "constitutive"
    },
    {
      ref: "claim-28",
      kind: "declaration",
      statement: "crossing: a claim moving from one kernel into another, arriving as the untyped type and losing its local attenuation.",
      source_id: "S-epistack-vocabulary",
      contributor_id: "P-epistack-vocabulary",
      declared_grade: "constitutive"
    },
    {
      ref: "claim-29",
      kind: "declaration",
      statement: "untyped type: the one type every schema shares, holding foreign imports and locally untyped claims alike, not a floor, so nothing grounds through it.",
      source_id: "S-epistack-vocabulary",
      contributor_id: "P-epistack-vocabulary",
      declared_grade: "constitutive"
    },
    {
      ref: "claim-30",
      kind: "declaration",
      statement: "type hash: the deterministic, meaning-sensitive fingerprint of a type bundle, so two kernels that perform the same attenuation pin the same hash.",
      source_id: "S-epistack-vocabulary",
      contributor_id: "P-epistack-vocabulary",
      declared_grade: "constitutive"
    },
    {
      ref: "claim-31",
      kind: "declaration",
      statement: "knowledge kernel: a fixed core of typed claims, a gate that checks them, and shared subtrees others fork, opening two markets over one grounding.",
      source_id: "S-epistack-vocabulary",
      contributor_id: "P-epistack-vocabulary",
      declared_grade: "constitutive"
    },
    {
      ref: "claim-32",
      kind: "declaration",
      statement: "typing: subjecting a claim to a type's attenuation, driving its dependence on its author down and staking the agent's standing on the claim holding.",
      source_id: "S-epistack-vocabulary",
      contributor_id: "P-epistack-vocabulary",
      declared_grade: "constitutive"
    },
    {
      ref: "claim-33",
      kind: "declaration",
      statement: "declared grade: the grade a claim advertises for itself, admitted only when at or below the earned grade.",
      source_id: "S-epistack-vocabulary",
      contributor_id: "P-epistack-vocabulary",
      declared_grade: "constitutive"
    },
    {
      ref: "claim-34",
      kind: "declaration",
      statement: "earned grade: the grade a claim actually achieves given what it rests on, computed from the graph alone by the grounding rule.",
      source_id: "S-epistack-vocabulary",
      contributor_id: "P-epistack-vocabulary",
      declared_grade: "constitutive"
    },
    {
      ref: "claim-35",
      kind: "declaration",
      statement: "structural attenuation: the kernel's half, driving trust in the producer to zero with respect to structure so a claim's grade recomputes from its cited support by arithmetic anyone can check.",
      source_id: "S-epistack-vocabulary",
      contributor_id: "P-epistack-vocabulary",
      declared_grade: "supported"
    },
    {
      ref: "claim-36",
      kind: "declaration",
      statement: "semantic attenuation: the community's function, judging whether the cited support is true of the world (whether a measurement happened, a checker exists, claimed independence is real), which the kernel makes checkable rather than performs.",
      source_id: "S-epistack-vocabulary",
      contributor_id: "P-epistack-vocabulary",
      declared_grade: "supported"
    },
    {
      ref: "claim-37",
      kind: "declaration",
      statement: "view: the presentation of a claim fitted to a reader, register, and purpose, separated from the trust that makes the claim hold.",
      source_id: "S-epistack-vocabulary",
      contributor_id: "P-epistack-vocabulary",
      declared_grade: "constitutive"
    },
    {
      ref: "claim-38",
      kind: "declaration",
      statement: "agent: any entity that makes claims and models other claim-makers, a person, an organization, a model, or a pipeline of these.",
      source_id: "S-epistack-vocabulary",
      contributor_id: "P-epistack-vocabulary",
      declared_grade: "constitutive"
    },
    {
      ref: "claim-39",
      kind: "declaration",
      statement: "measurement: a floor type where attenuation approaches a floor without reaching zero, so one measurement is testimony and many independent ones are knowledge.",
      source_id: "S-epistack-vocabulary",
      contributor_id: "P-epistack-vocabulary",
      declared_grade: "constitutive"
    },
    {
      ref: "claim-40",
      kind: "declaration",
      statement: "knowledge: the invariant left as the model is attenuated, knower-independent warranted standing rather than truth.",
      source_id: "S-epistack-vocabulary",
      contributor_id: "P-epistack-vocabulary",
      declared_grade: "constitutive"
    },
    {
      ref: "claim-41",
      kind: "measurement",
      statement: "In the typed claim graph every claim is independently typed, hashed, and graded from its own support, so a failure is isolable to the claim that failed.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-submission-transcription",
      declared_grade: "supported",
      checking_records: [
        { checker_id: "build/check-gate.mjs", method_class: "direct-measurement", method: "test-execution evidence: the named oracle runs green in this repository", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" }
      ]
    },
    {
      ref: "claim-42",
      kind: "measurement",
      statement: "In the eggs corpus, nutritional epidemiology walked through the gate sorts into claims that ground to their floors, contested weighings held at the forum tier, and characterized gaps each carrying its closing study.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-submission-transcription",
      declared_grade: "supported",
      checking_records: [
        { checker_id: "build/check-eggs.mjs", method_class: "direct-measurement", method: "test-execution evidence: the named oracle runs green in this repository", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" }
      ]
    },
    {
      ref: "claim-43",
      kind: "measurement",
      statement: "The gate recomputes a claim's standing from its support structure, and who proposed it never enters the computation.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-submission-transcription",
      declared_grade: "supported",
      checking_records: [
        { checker_id: "build/check-gate.mjs", method_class: "direct-measurement", method: "test-execution evidence: the named oracle runs green in this repository", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" }
      ]
    },
    {
      ref: "claim-44",
      kind: "measurement",
      statement: "An imported claim arrives untyped at the floor and re-earns under local judgment, so shared meaning is exactly shared hash and nothing composes by accident.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-submission-transcription",
      declared_grade: "supported",
      checking_records: [
        { checker_id: "build/check-crossing.mjs", method_class: "direct-measurement", method: "test-execution evidence: the named oracle runs green in this repository", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" },
        { checker_id: "build/check-type-hash.mjs", method_class: "direct-measurement", method: "test-execution evidence: the named oracle runs green in this repository", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" }
      ]
    },
    {
      ref: "claim-45",
      kind: "measurement",
      statement: "The repository carries working corpora for the three cases, a mathematics kernel, and a vocabulary kernel that defines the submission's own terms as graded claims.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-submission-transcription",
      declared_grade: "supported",
      checking_records: [
        { checker_id: "build/check-lhc.mjs", method_class: "direct-measurement", method: "test-execution evidence: the named oracle runs green in this repository", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" },
        { checker_id: "build/check-eggs.mjs", method_class: "direct-measurement", method: "test-execution evidence: the named oracle runs green in this repository", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" },
        { checker_id: "build/check-covid.mjs", method_class: "direct-measurement", method: "test-execution evidence: the named oracle runs green in this repository", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" },
        { checker_id: "build/check-math.mjs", method_class: "direct-measurement", method: "test-execution evidence: the named oracle runs green in this repository", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" },
        { checker_id: "build/check-vocabulary.mjs", method_class: "direct-measurement", method: "test-execution evidence: the named oracle runs green in this repository", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" }
      ]
    },
    {
      ref: "claim-46",
      kind: "measurement",
      statement: "Standing moves only through typing acts, so a market layer references grades and provably cannot move them.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-submission-transcription",
      declared_grade: "supported",
      checking_records: [
        { checker_id: "build/check-fork-contest.mjs", method_class: "direct-measurement", method: "test-execution evidence: the named oracle runs green in this repository", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" }
      ]
    },
    {
      ref: "claim-47",
      kind: "forum",
      statement: "A synthesis concentrates reasoning into a document, so when any part of it is wrong the whole document and everyone who trusted it are wrong together.",
      source_id: "S-epistack-submission-argument",
      contributor_id: "P-submission-transcription",
      declared_grade: "asserted"
    },
    {
      ref: "claim-48",
      kind: "forum",
      statement: "The one financial constraint fixed at protocol level is that penalties trigger on provable fault only, never on being wrong or unpopular.",
      source_id: "S-epistack-submission-argument",
      contributor_id: "P-submission-transcription",
      declared_grade: "asserted"
    },
    {
      ref: "claim-49",
      kind: "measurement",
      statement: "A declared grade above what the published structure delivers is caught deterministically, as GM-ABOVE, by anyone recomputing.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-submission-transcription",
      declared_grade: "supported",
      checking_records: [
        { checker_id: "build/check-gate.mjs", method_class: "direct-measurement", method: "test-execution evidence: the named oracle runs green in this repository", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" }
      ]
    },
    {
      ref: "claim-50",
      kind: "forum",
      statement: "Recomputation cannot catch attestation fraud, because the gate checks structure and not correspondence to the world, so a perfect forgery that no one re-checks stands.",
      source_id: "S-epistack-submission-argument",
      contributor_id: "P-submission-transcription",
      declared_grade: "asserted"
    },
    {
      ref: "claim-51",
      kind: "forum",
      statement: "Any mechanism that performed semantic attenuation at the claim level would be a semantic judge inside the kernel, which is a reintroduced trusted producer, a fixed Goodhart target, and a centralized fraud surface.",
      source_id: "S-epistack-submission-argument",
      contributor_id: "P-submission-transcription",
      declared_grade: "asserted"
    },
    {
      ref: "claim-52",
      kind: "measurement",
      statement: "The gate admits a contribution only if it holds together with what is already there, and rechecks every declared grade on every change.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-submission-transcription",
      declared_grade: "supported",
      checking_records: [
        { checker_id: "build/check-gate.mjs", method_class: "direct-measurement", method: "test-execution evidence: the named oracle runs green in this repository", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" }
      ]
    },
    {
      ref: "claim-53",
      kind: "measurement",
      statement: "Input that arrives untyped is admitted and sits at the floor, grounding nothing, until someone types it and owns the typing.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-submission-transcription",
      declared_grade: "supported",
      checking_records: [
        { checker_id: "build/check-crossing.mjs", method_class: "direct-measurement", method: "test-execution evidence: the named oracle runs green in this repository", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" }
      ]
    },
    {
      ref: "claim-54",
      kind: "measurement",
      statement: "The gate checks a claim's structure, never its agent's identity or nature, so a person, an organization, a model, or a pipeline are checked exactly the same way.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-submission-transcription",
      declared_grade: "supported",
      checking_records: [
        { checker_id: "build/check-gate.mjs", method_class: "direct-measurement", method: "test-execution evidence: the named oracle runs green in this repository", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" }
      ]
    },
    {
      ref: "claim-55",
      kind: "measurement",
      statement: "In the LHC case, making the shared assumption an explicit node reprices the apparent convergence as one assumption wearing several coats.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-submission-transcription",
      declared_grade: "supported",
      checking_records: [
        { checker_id: "build/check-lhc.mjs", method_class: "direct-measurement", method: "test-execution evidence: the named oracle runs green in this repository", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" },
        { checker_id: "build/check-demo.mjs", method_class: "direct-measurement", method: "test-execution evidence: the named oracle runs green in this repository", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" }
      ]
    },
    {
      ref: "claim-56",
      kind: "measurement",
      statement: "In the eggs case, swapping the presupposed frame swaps the verdict while every measurement underneath keeps its grade.",
      source_id: "S-epistack-protocol-spec",
      contributor_id: "P-submission-transcription",
      declared_grade: "supported",
      checking_records: [
        { checker_id: "build/check-eggs.mjs", method_class: "direct-measurement", method: "test-execution evidence: the named oracle runs green in this repository", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" },
        { checker_id: "build/check-demo.mjs", method_class: "direct-measurement", method: "test-execution evidence: the named oracle runs green in this repository", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" }
      ]
    },
    {
      ref: "claim-57",
      kind: "forum",
      statement: "From inside a single synthesis you cannot tell which parts are the world and which are the viewer, because the viewer is woven through every sentence.",
      source_id: "S-epistack-submission-argument",
      contributor_id: "P-submission-transcription",
      declared_grade: "asserted"
    }
  ],
  links: [
    { link_kind: "supports", from: "claim-19", to: "claim-10", support_group: "g:claim-10/claim-19", source_id: "S-epistack-protocol-spec", contributor_id: "P-epistack-competition-contributor-1", declared_grade: "corroborated" },
    { link_kind: "depends-on", from: "claim-47", to: "claim-20", source_id: "S-epistack-submission-argument", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-41", to: "claim-21", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-41", to: "claim-22", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-42", to: "claim-23", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-42", to: "claim-24", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-42", to: "claim-25", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-43", to: "claim-23", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-43", to: "claim-26", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-43", to: "claim-27", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-44", to: "claim-28", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-44", to: "claim-29", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-44", to: "claim-30", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-45", to: "claim-31", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-46", to: "claim-26", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-46", to: "claim-32", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-48", to: "claim-26", source_id: "S-epistack-submission-argument", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-49", to: "claim-23", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-49", to: "claim-33", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-49", to: "claim-34", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-50", to: "claim-35", source_id: "S-epistack-submission-argument", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-50", to: "claim-36", source_id: "S-epistack-submission-argument", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-51", to: "claim-36", source_id: "S-epistack-submission-argument", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-51", to: "claim-35", source_id: "S-epistack-submission-argument", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-57", to: "claim-20", source_id: "S-epistack-submission-argument", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-57", to: "claim-37", source_id: "S-epistack-submission-argument", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-52", to: "claim-23", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-52", to: "claim-33", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-53", to: "claim-29", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-53", to: "claim-32", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-54", to: "claim-27", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-54", to: "claim-38", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-55", to: "claim-39", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" },
    { link_kind: "depends-on", from: "claim-56", to: "claim-24", source_id: "S-epistack-protocol-spec", contributor_id: "P-submission-transcription", declared_grade: "asserted" }
  ]
};

module.exports = { STORE };
