// Role: the apply contract (intake data model v3, Section 14). Apply changes structure only: the
//   only verbs are union (of entries and links, byte-identical duplicates merging by identity so
//   resubmission adds nothing) and append (of standing records). Everything that looks like change,
//   withdrawal, supersession, decay, is a NEW record pointing at an old one; apply never edits a
//   stored declared grade, never removes or edits an entry, a link, or any standing record already
//   in history, and never recomputes anything into storage.
// Contract: apply(state, accepted) -> newState; inForce(state, identity) -> boolean. Pure, ESM;
//   kernel imports only kernel.
// Invariant: earned grade is derived, never stored. "In force" means present, not withdrawn, and not
//   the superseded side of any supersession record.
"use strict";
import { canonicalize, encode } from "../schema/canonical.mjs";
import { makeState } from "./state.mjs";

function unionById(existing, incoming) {
  const map = new Map((existing || []).map((e) => [e.identity, e])); // existing wins: never overwritten
  for (const e of incoming || []) if (!map.has(e.identity)) map.set(e.identity, e);
  return [...map.values()];
}
function appendDedup(existing, incoming) {
  const key = (r) => encode(canonicalize(r));
  const seen = new Set((existing || []).map(key));
  const out = (existing || []).slice();
  for (const r of incoming || []) { const k = key(r); if (!seen.has(k)) { seen.add(k); out.push(r); } }
  return out;
}

export function apply(state, accepted) {
  const next = {
    entries: unionById(state.entries, accepted.entries),
    links: unionById(state.links, accepted.links),
    withdrawn_records: appendDedup(state.withdrawn_records, accepted.withdrawn_records),
    contradiction_records: appendDedup(state.contradiction_records, accepted.contradiction_records),
    corroboration_findings: appendDedup(state.corroboration_findings, accepted.corroboration_findings),
    supersession_records: appendDedup(state.supersession_records, accepted.supersession_records),
  };
  // idempotence (Section 15): union and append that add nothing produce no new state. The store's
  // growth is a function of content, so a resubmission returns the same state, same hash.
  const unchanged = next.entries.length === (state.entries || []).length && next.links.length === (state.links || []).length
    && next.withdrawn_records.length === (state.withdrawn_records || []).length && next.contradiction_records.length === (state.contradiction_records || []).length
    && next.corroboration_findings.length === (state.corroboration_findings || []).length && next.supersession_records.length === (state.supersession_records || []).length;
  if (unchanged) return state;
  return makeState({ prior_state_hash: state.state_hash, applied_contribution_hash: accepted.applied_contribution_hash, receipt_reference: accepted.receipt_reference, ...next });
}

export function inForce(state, identity) {
  if (!(state.entries || []).some((e) => e.identity === identity)) return false;
  if ((state.withdrawn_records || []).some((w) => w.claim_identity === identity)) return false;
  if ((state.supersession_records || []).some((s) => s.superseded_identity === identity)) return false;
  return true;
}
