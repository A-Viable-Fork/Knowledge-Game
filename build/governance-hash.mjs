// Role: the community card's governance-hash (Phase KG-4, spec Section 7): the one named hash over a
//   community's canonical parameter record (pinned type hashes, identity thresholds, standing-economy
//   fields, the null-objective order), the community's durable content-addressed identity. kernel_id
//   demotes to a human label over this hash, exactly as a kind name is a label over a type-hash.
// Contract: canonicalParameterRecord(config, pinnedTypeHashes) -> the record this hashes;
//   governanceHash(config, pinnedTypeHashes) -> hex sha256 via the vendored canonical hash. Pure;
//   imports only the vendored canonical form.
// Invariant: the record excludes kernel_id, frame, fetch_locations, and contribution_target: none of
//   those are governance parameters (a label and transport hints), and none of them may move the
//   hash. Reuses vendor/kernel/schema/canonical.mjs's hashOf, the one named hash this protocol already
//   uses, so this is not a second hashing scheme invented locally; canonicalize sorts keys, so the
//   hash is permutation-invariant over field order.
// DEPARTURE: computed app-side. The upstream coordination layer is specified to compute this itself
//   once it lands (docs/coordination-layer-spec.md); until then this is a local, checked
//   implementation of an upstream-specified format, not a vendored module.
// SORRY: standing_economy's numeric fields (time_lock_cost, decay_rate) are null in every community
//   founded so far; the vendored canonical form (Section 1's exact-decimal discipline) rejects a raw
//   JS number, so a future community that sets one of these to a real value must pass it as an
//   exact-decimal string, not a float, or this hash throws rather than silently truncating it.
"use strict";
import { hashOf } from "../vendor/kernel/schema/canonical.mjs";

// the null-objective order this app currently ships (api/feed.js's orderFeed): one fixed default,
// not yet a per-community free parameter, included honestly as such rather than omitted.
export const NULL_OBJECTIVE_ORDER_DESCRIPTOR = "grounding-rank, then recency, then identity-hash tiebreak";

export function canonicalParameterRecord(config, pinnedTypeHashes) {
  return {
    pinned_type_hashes: pinnedTypeHashes || {},
    identity_thresholds: config.identity_thresholds || {},
    standing_economy: config.standing_economy || {},
    null_objective_order: NULL_OBJECTIVE_ORDER_DESCRIPTOR,
  };
}

export function governanceHash(config, pinnedTypeHashes) {
  return hashOf(canonicalParameterRecord(config, pinnedTypeHashes));
}
