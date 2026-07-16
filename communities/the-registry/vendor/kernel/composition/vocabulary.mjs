// Role: the shared vocabulary (composition spec, record 3, design decision B) and the ceiling
//   selection (design decision A). Units and definitions that must mean the same thing in every store
//   are declared once, here, and referenced by identity. Two claims agree on a quantity exactly when
//   their term references share a term_id: identity at the layer is the proof, with no name-matching.
//   A composite's ceiling follows from its cited quantities: the top of scale when they resolve to a
//   single shared term, structured-forum when they weigh across distinct terms.
// Contract: sharedTerm(raw), termReference(raw), sameQuantity(a, b), detectVersionSkew(citations),
//   detectCacheDrift(term, cachedDefinition), requireTermReference(slot), ceilingForCitations(cits).
//   Pure, ESM; kernel imports only kernel.
// Invariant: a version is an exact-decimal string (never a JS number, held off the canonical path).
//   The three divergence modes each have a check with a location: version skew at citation
//   validation, cache drift against the definition hash, schema violation at intake.
"use strict";
import { canonicalize, normalizeString, hashOf, isExactDecimal } from "../schema/canonical.mjs";

const TERM_KINDS = ["unit", "definition", "quantity-type"];
const req = (v, msg) => { if (v === undefined || v === null || v === "") throw new Error(msg); return v; };
// a version is the integer as an exact-decimal string (no fraction), kept off the float path.
function version(v, where) {
  const s = normalizeString(String(req(v, `${where}: version required`)));
  if (!isExactDecimal(s) || s.includes(".")) throw new Error(`${where}: version must be an integer string, got ${JSON.stringify(v)}`);
  return s;
}

// ---- record 3: the shared term, declared once at the layer ----
// definition_hash is a digest of the definition text at this version; a store that caches the
// definition recomputes this and compares, so a drifted local copy is a detected corruption.
export function sharedTerm(raw) {
  if (!TERM_KINDS.includes(raw.kind)) throw new Error(`shared term: bad kind ${raw.kind}`);
  const term_id = normalizeString(String(req(raw.term_id, "shared term: term_id required")));
  const name = normalizeString(String(req(raw.name, "shared term: name required")));
  const definition = normalizeString(String(req(raw.definition, "shared term: definition required")));
  const v = version(raw.version, "shared term");
  const definition_hash = hashOf({ definition });
  const canonical = canonicalize({ term_id, kind: raw.kind, name, definition, version: v, definition_hash });
  return { record_type: "shared-term", term_id, kind: raw.kind, name, definition, version: v, definition_hash, canonical, hash: hashOf(canonical, { pre: true }) };
}

// ---- record 3: the term reference, carried on a claim that uses a shared quantity ----
export function termReference(raw) {
  const term_id = normalizeString(String(req(raw.term_id, "term reference: term_id required")));
  const term_version = version(raw.term_version, "term reference");
  return { term_id, term_version };
}

// provable same-reference: two claims refer to the same quantity exactly when their term references
// share a term_id. There is no fuzzy reconciliation; the identity is the proof.
export function sameQuantity(a, b) {
  return !!a && !!b && a.term_id === b.term_id;
}

// divergence 1: version skew. The same term_id at different term_versions across two citations
// composed together, detected at citation validation before the composite claim is recorded.
export function detectVersionSkew(citations) {
  const byTerm = new Map();
  for (const c of citations || []) {
    if (!c.term_ref) continue;
    const t = c.term_ref.term_id;
    if (!byTerm.has(t)) byTerm.set(t, new Set());
    byTerm.get(t).add(c.term_ref.term_version);
  }
  const skews = [];
  for (const [term_id, versions] of byTerm) if (versions.size > 1) skews.push({ term_id, versions: [...versions].sort() });
  return skews; // empty means no skew
}

// divergence 2: cache drift. A store that caches a definition recomputes the hash and compares it to
// the layer's for that term; a mismatch is a detected corruption, never a silent one.
export function detectCacheDrift(term, cachedDefinition) {
  const recomputed = hashOf({ definition: normalizeString(String(cachedDefinition)) });
  return { drift: recomputed !== term.definition_hash, recomputed, expected: term.definition_hash };
}

// divergence 3: schema violation. A local definition string in a slot that requires a term reference
// is rejected at intake; only a well-formed (term_id, term_version) reference is admitted.
export function requireTermReference(slot) {
  if (typeof slot === "string") throw new Error("term slot: a local definition string is not allowed where a term reference is required (composition spec, record 3)");
  return termReference(slot);
}

// design decision A: the ceiling from the cited quantities. Distinct term_ids among the necessary
// citations decide it: one shared term is the floor-band ceiling (top of scale), distinct terms cap
// at structured-forum. Absent a proven single term, the conservative ceiling is structured-forum.
export function ceilingForCitations(citations) {
  const terms = new Set();
  let sawRef = false;
  for (const c of citations || []) {
    if (c.role !== "necessary") continue;
    if (!c.term_ref) continue;
    sawRef = true;
    terms.add(c.term_ref.term_id);
  }
  if (sawRef && terms.size === 1) return "settled";       // single shared term: top of scale
  return "corroborated";                                    // distinct terms (or unproven): structured-forum
}
