// Role: reads a founded registry community's rows and joins each with the extension fields the
//   vendored provider's own project() never forwards (artifact_hash, contract_hash,
//   interface_identity, required_oracle, ceiling_statement). This is the same direct-raw-read pattern
//   periphery/app.js already uses for links (community.raw.state.links): community.raw.state.entries
//   carries canonical.extensions per row; community.api.read()'s row shape does not, by the vendored
//   client-api's own contract, so a registry-specific reader must look here instead of asking for a
//   wider provider contract the pinned vendor code does not offer.
// Contract: registryRows(community) -> the same rows community.api.read({}) returns, each with an
//   added `extensions` object (possibly empty) carrying whatever extension fields that row's claim
//   declared, plus `checkingRecords` (the claim's own checking_records array, also never forwarded
//   by project()). contractsByIdentity(rows) -> Map(identity -> row) restricted to kind
//   "contract-bundle", for looking up a contract row's own interface_identity/required_oracle/
//   ceiling_statement from an artifact-card row's contract_hash. Browser-safe ESM; imports nothing
//   (pure over its argument).
// Invariant: PURE. No network, no storage, no DOM; this module only reshapes what fetchCommunity
//   already verified and returned.
"use strict";

export function registryRows(community) {
  const byIdentity = new Map((community.raw.state.entries || []).map((e) => [e.identity, e]));
  return community.api.read({}).map((row) => {
    const entry = byIdentity.get(row.identity);
    const extensions = (entry && entry.canonical && entry.canonical.extensions) || {};
    const checkingRecords = (entry && entry.checking_records) || [];
    return { ...row, extensions, checkingRecords };
  });
}

export function contractsByIdentity(rows) {
  return new Map(rows.filter((r) => r.kind === "contract-bundle").map((r) => [r.identity, r]));
}
