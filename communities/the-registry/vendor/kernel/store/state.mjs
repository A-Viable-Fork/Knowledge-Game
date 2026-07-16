// Role: the store-state record and the history chain (intake data model v3, Section 13). A store
//   state is the full contents at a point plus a hash that chains to its predecessor: because the
//   predecessor's hash is inside the preimage, a rewritten past announces itself in the first
//   mismatched link of the chain.
// Contract: genesis(); makeState(fields) -> a state with its computed state_hash; verifyChain(states)
//   -> { ok, firstBreak }. Pure, ESM; kernel imports only kernel.
// Invariant: DETERMINISM, each set is canonicalized as an unordered array (elements canonicalized,
//   sorted by canonical byte order, deduped), fields ordered by byte order, hashed over the whole
//   sequence with prior_state_hash included. The change-evidence property is all this record claims.
"use strict";
import { canonicalize, encode, hashBytes, byteCompare } from "../schema/canonical.mjs";

export const GENESIS_MARKER = "GENESIS";
const SETS = ["entries", "links", "withdrawn_records", "contradiction_records", "corroboration_findings", "supersession_records"];

// a canonical node for one stored element: entries/links carry their own canonical form; standing
// records are canonicalized here (they contain no decimals, so generic canonicalization is exact).
function elementNode(el) {
  return el && el.canonical ? el.canonical : canonicalize(el);
}
// a set canonicalized as an unordered array: sort by canonical byte order, drop exact duplicates.
function canonSet(elements) {
  const nodes = (elements || []).map(elementNode);
  nodes.sort((a, b) => byteCompare(encode(a), encode(b)));
  const out = [];
  let last = null;
  for (const n of nodes) { const e = encode(n); if (e !== last) out.push(n); last = e; }
  return out;
}

// the state-hash preimage: prior_state_hash included, applied_contribution_hash and receipt_reference
// present when not genesis, each set as its canonical array. Hashed by byte-ordered field encoding.
function stateHash(fields) {
  const pre = { prior_state_hash: fields.prior_state_hash };
  if (fields.applied_contribution_hash !== undefined) pre.applied_contribution_hash = fields.applied_contribution_hash;
  if (fields.receipt_reference !== undefined) pre.receipt_reference = fields.receipt_reference;
  for (const s of SETS) pre[s] = canonSet(fields[s]);
  return hashBytes(encode(pre));
}

export function makeState(fields) {
  const f = {
    prior_state_hash: fields.prior_state_hash,
    applied_contribution_hash: fields.applied_contribution_hash,
    receipt_reference: fields.receipt_reference,
  };
  for (const s of SETS) f[s] = (fields[s] || []).slice();
  return Object.assign(f, { state_hash: stateHash(f) });
}

export function genesis() {
  return makeState({ prior_state_hash: GENESIS_MARKER });
}

// recompute a state's hash from its contents; a state is self-consistent iff it matches state_hash.
export function recompute(state) {
  return stateHash(state);
}

// verify a chain: every state's hash matches its contents, and every prior_state_hash points at the
// predecessor's state_hash. Returns the first state (by index) where the chain breaks, or null.
export function verifyChain(states) {
  for (let i = 0; i < states.length; i++) {
    if (recompute(states[i]) !== states[i].state_hash) return { ok: false, firstBreak: i, reason: "contents do not match state_hash" };
    if (i > 0 && states[i].prior_state_hash !== states[i - 1].state_hash) return { ok: false, firstBreak: i, reason: "prior_state_hash does not point at the predecessor" };
  }
  return { ok: true, firstBreak: null };
}
