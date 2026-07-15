// Role: the knowledge-game kernel store: the governance claims from spec Sections 2, 5, and 9,
//   entered as an author fills the scaffolder's generated empty skeleton. Claims 1 through 18 enter
//   bare, with no support and no checking record, so the gate floors them at "asserted", their honest
//   floor. Claim 19 carries a real checking record citing build/check-substrate.mjs, the one claim
//   this Stage 2 entry can honestly ground today.
// Contract: exports STORE = { store_id, claims, links }. Pure data; imports nothing.
// Invariant: no grade is asserted by hand; declared_grade on every bare claim equals its honest floor
//   (asserted), and claim 19's declared_grade (checked) is at or below what its checking record
//   actually earns, verified by the real gate in build/check-knowledge-game.mjs, not by this comment.
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
      declared_grade: "asserted"
    },
    {
      ref: "claim-2",
      kind: "measurement",
      statement: "The active ranking objective is always visible to the user.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "asserted"
    },
    {
      ref: "claim-3",
      kind: "measurement",
      statement: "Behavioral observation is opt-in and default off.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "asserted"
    },
    {
      ref: "claim-4",
      kind: "measurement",
      statement: "Personal profile records cannot enter public contribution patches.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "asserted"
    },
    {
      ref: "claim-5",
      kind: "measurement",
      statement: "Profile data is local by default.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "asserted"
    },
    {
      ref: "claim-6",
      kind: "measurement",
      statement: "No telemetry endpoint exists beyond the capability manifest's declarations, which declare none.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "asserted"
    },
    {
      ref: "claim-7",
      kind: "measurement",
      statement: "No undeclared network egress exists.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "asserted"
    },
    {
      ref: "claim-8",
      kind: "measurement",
      statement: "The periphery imports no kernel or store module; the API is the sole membrane.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "asserted"
    },
    {
      ref: "claim-9",
      kind: "measurement",
      statement: "This client holds no capability any client with the snapshot lacks.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "asserted"
    },
    {
      ref: "claim-10",
      kind: "measurement",
      statement: "Artifacts produced by the founding flow are client-neutral: no reference to this app in any kernel, snapshot, card, or contribution target it emits.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "asserted"
    },
    {
      ref: "claim-11",
      kind: "measurement",
      statement: "Admission judges bundles, never the producing client.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "asserted"
    },
    {
      ref: "claim-12",
      kind: "measurement",
      statement: "A citation cannot become an independent confirmation by being pasted.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "asserted"
    },
    {
      ref: "claim-13",
      kind: "measurement",
      statement: "Gate passage, admission, and semantic acceptance render as three distinct states, and no rendering implies the next.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "asserted"
    },
    {
      ref: "claim-14",
      kind: "measurement",
      statement: "A release's declared artifact hash matches the built artifact.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "asserted"
    },
    {
      ref: "claim-15",
      kind: "measurement",
      statement: "A client can switch providers without presentation changes.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "asserted"
    },
    {
      ref: "claim-16",
      kind: "measurement",
      statement: "The credential seam exists; identity thresholds are stored inactive and nothing evaluates them.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "asserted"
    },
    {
      ref: "claim-17",
      kind: "measurement",
      statement: "The patch-history seam exists; bundle identity is content-derived and nothing depends on durable history.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "asserted"
    },
    {
      ref: "claim-18",
      kind: "measurement",
      statement: "The standing-economy seam exists; the reserved fields are read by nothing.",
      source_id: "S-kg-spec-v2",
      contributor_id: "P-knowledge-game",
      declared_grade: "asserted"
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
    }
  ],
  links: []
};

module.exports = { STORE };
