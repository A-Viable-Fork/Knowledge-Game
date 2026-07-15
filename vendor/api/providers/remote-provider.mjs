// Role: a stub remote provider behind the same propose/read contract (Prompt 10). It stands in for a
//   hosted kernel: a real one would POST the proposed claim to an endpoint and return the receipt the
//   server computed. This stub imports NO kernel module, holds no grounding logic, and returns a
//   fixed receipt, so it demonstrates the seam: the client drives it identically to the local
//   provider by changing one import, with no change to the widget.
// Contract: createRemoteProvider(config) -> { kind, propose(proposedClaim) -> receipt, read(query)
//   -> [claim] }. config.endpoint is where a real provider would call. ESM; no kernel, no DOM.
// Invariant: a remote provider touches no kernel. It computes nothing; on a live deployment the
//   server runs the same gate and returns the same shape. Here the shape is canned, and labelled so.
"use strict";

// a fixed, well-formed receipt in the Section-11 shape, so the client renders it exactly as a real
// one. A hosted provider would return the server's computed receipt in this same shape instead.
function stubReceipt(proposedClaim) {
  const identity = "remote-stub-identity";
  return {
    ruleset_version: "remote-stub",
    schema_version: "v3",
    store_state: "remote-stub-state",
    contribution_hash: "remote-stub",
    proposed_identity: identity,
    provider_note: "stub remote provider: a fixed receipt standing in for a hosted kernel; no gate ran here",
    findings: [],
    binding_table: [],
    grade_table: [
      { identity, ceiling: "corroborated", ceiling_mode: null, declared_grade: (proposedClaim && proposedClaim.declared_grade) || "asserted", earned_grade: "supported", earned_mode: null, S: "supported", B: "none" },
    ],
    restatement_closures: [[identity]],
    withdrawn_matches: [],
    corroboration_findings: [],
    contradiction_records: [],
    decision: "accepted",
    decision_basis: ["remote-stub"],
  };
}

export function createRemoteProvider(config) {
  const cfg = config || {};
  return {
    kind: "remote",
    // a real remote provider would POST here and await the server's receipt; the stub returns a
    // fixed one synchronously so the file:// artifact makes no network call.
    //   async propose(c){ const r = await fetch(cfg.endpoint, {method:"POST", body: JSON.stringify(c)}); return r.json(); }
    propose: (proposedClaim) => stubReceipt(proposedClaim),
    // a hosted provider would return the server's robustness reading; the stub returns a fixed one.
    robustness: () => [
      { identity: "remote-stub-identity", statement: "(the hosted map's robustness would be read from " + (cfg.endpoint || "the remote endpoint") + ")", grade: "supported", robustness: "supported", fragile: false, single_points_of_failure: [], correlated_evidence_flag: null, presupposition: { closure: [], shared: [] } },
    ],
    gaps: () => [], // a hosted provider would return the server's gap reading; the stub reports none
    characterizedGaps: () => [], // likewise the characterized gaps; the stub reports none
    reconciliations: () => [], // likewise the disagreements and their cruxes; the stub reports none
    read: () => [
      { identity: "remote-stub-identity", kind: "claim", statement: "(the hosted map would be read from " + (cfg.endpoint || "the remote endpoint") + ")", source_id: "remote", declared_grade: "asserted", earned_grade: "supported", in_force: true },
    ],
  };
}
