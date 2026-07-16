// Role: the knowledge-game kernel store: the governance claims from spec Sections 2, 5, 6, and 9,
//   entered as an author fills the scaffolder's generated empty skeleton, then grounded phase by phase
//   as their own checks landed (Stage 2 through Phase KG-4). Every claim now carries a real checking
//   record citing the check that grounds it; none is asserted by hand above its honest floor. Claim-20
//   is the first entered through the app's own contribution path (api/contribute.js's draftProposal),
//   not hand-authored directly here: it drafted at "asserted" against the fixture snapshot, was
//   bundled and exported (kernel/governance/contributions/0001-the-extension-seam.json), and is
//   admitted here, grounded, exactly as that draft computed it (same identity, same statement, same
//   source), the checking record and declared_grade added once build/check-extension-seam.mjs existed
//   to ground it.
// Contract: exports STORE = { store_id, claims, links }. Pure data; imports nothing.
// Invariant: no grade is asserted by hand; every claim's declared_grade is at or below what its
//   checking record actually earns, verified by the real gate in build/check-knowledge-game.mjs, not
//   by this comment.
// The entrance listing (claim-21 through claim-27): the org-root entrance page renders this app's own
//   door from these grounded claims rather than from hand-written copy. Every listing claim carries a
//   `role` field ("title", "tagline", "status", or "link") and an `entrance_surfaced: true` marker; both
//   are ordinary extension fields (vendor/kernel/schema/records.mjs's own extensionsOf/finalize
//   mechanism, the same one the-registry's contract-bundle claims already use for interface_identity
//   etc.), never a new kind field the gate itself reads, moves no grade, and adds no rule. `title` and
//   `tagline` are of kind "identity" (ceiling constitutive, this file's own local kind, documented in
//   kernel/governance/kernel-config.json and kernel/governance/corpora/tables.js): a stipulation about
//   this deployment's own name, adopted not evidenced, exactly as a contract-bundle claim's own
//   ceiling-constitutive kind is grounded by adoption alone. `link` claims are the same kind, each
//   carrying a `url` extension alongside its label statement. `status` claims are of kind "measurement"
//   (this file's original kind, ceiling checked) with declared_grade "asserted" and no checking records
//   of their own: they carry no independent evidence, only a `references_claim` extension naming the
//   real governance claim ref that backs the capability they list (claim-9 for the unprivileged-client
//   status, claim-1 for the ranking-cannot-move-standing status); the entrance renderer displays THAT
//   claim's own computed standing, never the listing claim's bare "asserted" floor, so the front door is
//   gated by the same mechanism it advertises and can never overclaim beyond what the kernel grounds.
"use strict";

const STORE = {
  store_id: "knowledge-game",
  claims: [
    {
      ref: "claim-1",
      kind: "measurement",
      statement: "Ranking cannot modify canonical standing, grades, receipts, robustness, or support structure.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "build/check-ranking-separation.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence (kernel/governance/local-source-classes.md, the no-grade-motion property test named there): fuzzes 25 random objective vectors per fixture and asserts the raw snapshot, api.read(), api.reconciliations(), and api.gaps() stay byte-identical before and after; statically verifies api/ranking.js and api/feed.js import nothing that can write",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-2",
      kind: "measurement",
      statement: "The active ranking objective is always visible to the user.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "build/check-objective.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence (kernel/governance/local-source-classes.md, the objective-visibility test named there): asserts an omitted or empty objective vector renders exactly the null order with no hidden default, that the same snapshot and vector yield an identical order across repeated runs and permutations of the input, and that every rendered position's why-answer reproduces purely from that card's own stored component scores",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-3",
      kind: "measurement",
      statement: "Behavioral observation is opt-in and default off.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "build/check-vault.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence (kernel/governance/local-source-classes.md, the opt-in-observation-default test named there): asserts a fresh vault profile reports observation disabled with an empty log, and that five simulated observation events while the toggle is off write zero records",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-4",
      kind: "measurement",
      statement: "Personal profile records cannot enter public contribution patches.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "build/check-profile-leak.mjs",
          method_class: "direct-measurement",
          method: "static-analysis evidence combined with test-execution evidence (kernel/governance/local-source-classes.md): statically scans the bundle-building modules (api/contribute.js, vendor/api/contribution.js) and asserts neither imports vault/ or api/settings.js, then fills the vault with canary values and asserts no canary reaches any bundle produced across a fuzz of draft inputs",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-5",
      kind: "measurement",
      statement: "Profile data is local by default.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "build/check-vault.mjs",
          method_class: "direct-measurement",
          method: "static-analysis evidence (kernel/governance/local-source-classes.md) combined with test-execution evidence: statically scans every file under periphery/, api/, vault/, and app/ and asserts only vault/vault.js touches a storage API, then asserts a fresh profile writes nothing until exported and that export/delete-all round-trip exactly what the vault holds",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-6",
      kind: "measurement",
      statement: "No telemetry endpoint exists beyond the capability manifest's declarations, which declare none.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "build/check-egress.mjs",
          method_class: "direct-measurement",
          method: "observed-network-behavior evidence (kernel/governance/local-source-classes.md): runs api/community.js under a stubbed global fetch and asserts every URL it actually requests is one of manifests/network.json's declared destinations, which declare no telemetry endpoint",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-7",
      kind: "measurement",
      statement: "No undeclared network egress exists.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "build/check-egress.mjs",
          method_class: "direct-measurement",
          method: "observed-network-behavior evidence (kernel/governance/local-source-classes.md): runs api/community.js under a stubbed global fetch and asserts every URL it actually requests is one of manifests/network.json's declared destinations",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-8",
      kind: "measurement",
      statement: "The periphery imports no kernel or store module; the API is the sole membrane.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "build/check-imports.mjs",
          method_class: "direct-measurement",
          method: "static-analysis evidence (kernel/governance/local-source-classes.md): statically parses every import statement in periphery/, api/, and kernel/governance/ and asserts each stays within its membrane zone (periphery reaches vendor/kernel only through api/; api/ imports only vendor/ and itself)",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-9",
      kind: "measurement",
      statement: "This client holds no capability any client with the snapshot lacks.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "build/check-conformance-read.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence (kernel/governance/local-source-classes.md): an independent minimal client built from vendor/api/* alone reproduces this app's reads byte-identically over the same snapshot",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        },
        {
          checker_id: "build/check-conformance-write.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence (kernel/governance/local-source-classes.md): an independent minimal client built from vendor/api/* alone proposes, exports, and admits a bundle through the identical admission path (importContribution, then a fresh gate decision) as this app's own bundle for the equivalent proposal",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-10",
      kind: "measurement",
      statement: "Artifacts produced by the founding flow are client-neutral: no reference to this app in any kernel, snapshot, card, or contribution target it emits.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "build/check-neutrality.mjs",
          method_class: "direct-measurement",
          method: "static-analysis evidence (kernel/governance/local-source-classes.md): walks every artifact the founding flow emitted for the founded EpiStack Competition Community and fails on any of this deployment's own name-shaped strings, with one documented, narrow transport-hint exemption",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-11",
      kind: "measurement",
      statement: "Admission judges bundles, never the producing client.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "build/check-conformance-write.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence (kernel/governance/local-source-classes.md), read from the admission side of the same evidence claim 9 cites: both an independent minimal client's bundle and this app's own bundle carry no field naming the producing client and admit through the identical path",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-12",
      kind: "measurement",
      statement: "A citation cannot become an independent confirmation by being pasted.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "build/check-citation.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence (kernel/governance/local-source-classes.md): fuzzes citation text across many shapes through the real draft builder and asserts the resulting source is always testimony-class and the resulting claim never carries a checking_records entry",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-13",
      kind: "measurement",
      statement: "Gate passage, admission, and semantic acceptance render as three distinct states, and no rendering implies the next.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "build/check-ladder.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence (kernel/governance/local-source-classes.md): asserts the contribution ladder carries exactly three distinct-labeled states, forbidden words absent from the first two states' renderings, and no lower state's rendering contains a higher state's own label",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-14",
      kind: "measurement",
      statement: "A release's declared artifact hash matches the built artifact.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "build/check-release.mjs",
          method_class: "data-audit",
          method: "recomputes a sha256 per file over the deployed working tree and one combined hash over that sorted map, comparing both against manifests/build-provenance.json's declared values, naming any added, missing, or changed file",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-15",
      kind: "measurement",
      statement: "A client can switch providers without presentation changes.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "build/check-provider-contract.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence (kernel/governance/local-source-classes.md, the provider-swap snapshot test named there): a second provider built independently from the vendored gate primitives (never importing local-provider.mjs) is compared against the vendored local provider; read() output and both null-order and weighted-objective rankings are byte-identical, and renderCard is a pure function of that identical row data (visual confirmation via a separate browser smoke test)",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-16",
      kind: "measurement",
      statement: "The credential seam exists; identity thresholds are stored inactive and nothing evaluates them.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "build/check-seams.mjs",
          method_class: "direct-measurement",
          method: "static-analysis evidence (kernel/governance/local-source-classes.md): asserts vendor/api/credential.js is a pure stub and that no local module reads a community's stored identity_thresholds as a property to gate any behavior",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-17",
      kind: "measurement",
      statement: "The patch-history seam exists; bundle identity is content-derived and nothing depends on durable history.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "build/check-seams.mjs",
          method_class: "direct-measurement",
          method: "static-analysis evidence combined with test-execution evidence (kernel/governance/local-source-classes.md): asserts vendor/kernel/store/patch-ledger.js is a pure stub referenced by no local module, and that a contribution's id is unchanged under permutation of its construction order",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-18",
      kind: "measurement",
      statement: "The standing-economy seam exists; the reserved fields are read by nothing.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "build/check-seams.mjs",
          method_class: "direct-measurement",
          method: "static-analysis evidence (kernel/governance/local-source-classes.md): asserts the founded community's parameter record carries a reserved standing_economy field and that no local module reads it as a property to gate any behavior",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-19",
      kind: "measurement",
      statement: "All inherited substrate code matches the lock.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "build/check-substrate.mjs",
          method_class: "data-audit",
          method: "recomputes the sha256 of every vendored file and compares it to upstream/lock.json; recomputes the upstream/epistack submodule's checked-out commit and compares it to lock.commit_hash",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-20",
      kind: "measurement",
      statement: "An installed extension cannot modify canonical standing, and cannot execute outside its sandbox.",
      source_id: "contributor:cite:knowledgegamespecv2-md-section-6-the-extension-s",
      contributor_id: "P-knowledge-game",
      declared_grade: "checked",
      checking_records: [
        {
          checker_id: "build/check-extension-seam.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence (Phase KG-4; egress contract amended Phase KG-9): a candidate that mutates a grade-bearing field, drops a row, or introduces an unknown identity fails install-time conformance naming the violation; a candidate referencing document is blocked by the sandbox itself (a worker's global scope has no document at all), never merely trusted not to try; network access is capability-scoped as of Phase KG-9, a candidate declaring no destinations reaches nothing even against a real reachable local server, one declaring exact destinations reaches exactly those and nothing else (proven against a real local server, both the allowed and the refused call), a wildcard declaration fails conformance before the candidate ever runs, and install renders the declared destinations and requires consent; both shipped demonstration extensions still declare no destinations and still pass, and the first-party ranker installs through the identical public conformance path a third-party candidate uses",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        },
        {
          checker_id: "build/check-assistant.mjs",
          method_class: "direct-measurement",
          method: "test-execution evidence (Phase KG-9): the shipped assistant extension, the worked example the capability-scoped seam exists for, declares exactly one destination at every real call site; under a real reachable local server its calls reach only that destination, a call to any other path on the identical server is refused by name; with no key or endpoint configured it renders its inert setup state and calls nothing (static assertion, consistent with this repository's no-DOM-in-Node discipline for periphery modules); its output cannot reach any store except through the ordinary draft path, proven both by import-graph structure (no import of vault, settings, or the outbox) and by a runtime fuzz showing its parsing layer never touches storage and never fabricates a bundle-shaped object even when fed adversarial, bundle-shaped input",
          checked_at_state: "ST0",
          outcome: "confirms",
          independence: "distinct-party"
        }
      ]
    },
    {
      ref: "claim-21",
      kind: "identity",
      statement: "The Knowledge Game",
      source_id: "S-kg-self-stipulated",
      contributor_id: "P-knowledge-game",
      declared_grade: "constitutive",
      role: "title",
      entrance_surfaced: true
    },
    {
      ref: "claim-22",
      kind: "identity",
      statement: "the first app for the protocol: a feed whose algorithm answers to the reader",
      source_id: "S-kg-self-stipulated",
      contributor_id: "P-knowledge-game",
      declared_grade: "constitutive",
      role: "tagline",
      entrance_surfaced: true,
      revisable: true
    },
    {
      ref: "claim-23",
      kind: "identity",
      statement: "Open the app",
      source_id: "S-kg-self-stipulated",
      contributor_id: "P-knowledge-game",
      declared_grade: "constitutive",
      role: "link",
      entrance_surfaced: true,
      url: "https://a-viable-fork.github.io/Knowledge-Game/app/"
    },
    {
      ref: "claim-24",
      kind: "identity",
      statement: "Submit a claim",
      source_id: "S-kg-self-stipulated",
      contributor_id: "P-knowledge-game",
      declared_grade: "constitutive",
      role: "link",
      entrance_surfaced: true,
      url: "https://a-viable-fork.github.io/Knowledge-Game/app/#view=submission"
    },
    {
      ref: "claim-25",
      kind: "identity",
      statement: "View the repository",
      source_id: "S-kg-self-stipulated",
      contributor_id: "P-knowledge-game",
      declared_grade: "constitutive",
      role: "link",
      entrance_surfaced: true,
      url: "https://github.com/A-Viable-Fork/Knowledge-Game"
    },
    {
      ref: "claim-26",
      kind: "measurement",
      statement: "This app's listed status: unprivileged, holding no capability any client with the snapshot lacks.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "asserted",
      role: "status",
      entrance_surfaced: true,
      references_claim: "claim-9"
    },
    {
      ref: "claim-27",
      kind: "measurement",
      statement: "This app's listed status: ranking cannot move canonical standing.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "asserted",
      role: "status",
      entrance_surfaced: true,
      references_claim: "claim-1"
    }
  ],
  links: []
};

module.exports = { STORE };
