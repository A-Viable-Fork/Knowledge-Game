// Role: the composition-layer record types (composition spec, records 1 and 4; grows across the
//   phases). A composite store holds these above the domain kernel: a cross-store citation names a
//   domain claim and copies the grade the domain store held for it, and a composite claim owns a set
//   of citations. Each builder validates the spec's fields, canonicalizes, and hashes, exactly as the
//   domain records do, so a composition record is a v3-shaped record on the same canonical form.
// Contract: citationRecord(raw), compositeClaimRecord(raw). Pure, ESM; kernel imports only kernel.
// Invariant: the boundary is visible in every record. A citation's carried_grade is COPIED from the
//   domain store, never assigned here (the copy happens in transfer.mjs; this only validates it as a
//   grade). Identity is content over the reference itself (which composite claim cites which domain
//   claim in which store), so a re-grade updates carried_grade and cited_state without changing the id.
"use strict";
import { canonicalize, normalizeString, hashOf, isExactDecimal } from "../schema/canonical.mjs";
import { isPosition } from "../schema/confidence.mjs";
import { termReference } from "./vocabulary.mjs";

// small private helpers, mirrored from schema/records.mjs (not exported there); kept local so the
// composition records stay self-contained and never reach past the schema they build on.
const req = (v, msg) => { if (v === undefined || v === null || v === "") throw new Error(msg); return v; };
const grade = (v, where) => { if (!isPosition(v)) throw new Error(`${where}: not a confidence-order position: ${JSON.stringify(v)}`); return v; };
function extensionsOf(raw, declaredNames) {
  const ext = Object.assign({}, raw.extensions || {});
  for (const k of Object.keys(raw)) if (k !== "extensions" && !declaredNames.includes(k)) ext[k] = raw[k];
  return ext;
}
function finalize(canonDeclared, extRaw) {
  const node = Object.assign({}, canonDeclared);
  if (Object.keys(extRaw).length) node.extensions = canonicalize(extRaw);
  return { canonical: node, hash: hashOf(node, { pre: true }) };
}

// ---- record 1: the cross-store citation ----
const CITATION_ROLES = ["necessary", "corroborating"];
const CITATION_FIELDS = ["citation_id", "citing_claim", "source_store", "cited_claim", "cited_state", "carried_grade", "role", "made_at", "term_ref"];
export function citationRecord(raw) {
  if (!CITATION_ROLES.includes(raw.role)) throw new Error(`citation: bad role ${raw.role}`);
  const citing_claim = normalizeString(String(req(raw.citing_claim, "citation: citing_claim required")));
  const source_store = normalizeString(String(req(raw.source_store, "citation: source_store required")));
  const cited_claim = normalizeString(String(req(raw.cited_claim, "citation: cited_claim required")));
  // identity is the reference itself: this composite claim, that domain claim, in that store. The
  // state pointer and the carried grade are the mutable value re-derivation updates, not the identity.
  const citation_id = hashOf({ citing_claim, source_store, cited_claim });
  const carried_grade = grade(raw.carried_grade, "citation.carried_grade");
  // the cited claim's shared quantity, copied when it declares one; the composite reads these to pick
  // the ceiling and to detect version skew, and never mints a term reference of its own.
  const term_ref = raw.term_ref !== undefined ? termReference(raw.term_ref) : undefined;
  const declared = {
    citation_id: canonicalize(citation_id),
    citing_claim: canonicalize(citing_claim),
    source_store: canonicalize(source_store),
    cited_claim: canonicalize(cited_claim),
    cited_state: canonicalize(String(req(raw.cited_state, "citation: cited_state required"))),
    carried_grade: canonicalize(carried_grade),
    role: canonicalize(raw.role),
    made_at: canonicalize(normalizeString(String(req(raw.made_at, "citation: made_at required")))),
  };
  if (term_ref !== undefined) declared.term_ref = canonicalize({ term_id: term_ref.term_id, term_version: term_ref.term_version });
  const { canonical, hash } = finalize(declared, extensionsOf(raw, CITATION_FIELDS));
  return {
    record_type: "citation", citation_id, citing_claim, source_store, cited_claim,
    cited_state: raw.cited_state, carried_grade, role: raw.role, made_at: raw.made_at, term_ref, canonical, hash,
  };
}

// ---- record 4 (base): the composite claim ----
// The base composite claim owns a set of citations. Its region names which side of the boundary it
// sits on: floor when it composes commensurable quantities to a domain floor, forum when it weighs
// across domains. Its grade is DERIVED by the record-2 transfer on read (transfer.mjs), never stored,
// the same discipline the domain model applies (grade is a derivation against the current state).
const COMPOSITE_REGIONS = ["floor", "forum"];
const COMPOSITE_CLAIM_FIELDS = ["claim_id", "statement", "region", "support"];
export function compositeClaimRecord(raw) {
  const statement = normalizeString(String(req(raw.statement, "composite claim: statement required")));
  if (!COMPOSITE_REGIONS.includes(raw.region)) throw new Error(`composite claim: bad region ${raw.region}`);
  const claim_id = hashOf({ statement }); // identity within the composite store
  const support = (raw.support || []).map((s) => String(s));
  const declared = {
    claim_id: canonicalize(claim_id),
    statement: canonicalize(statement),
    region: canonicalize(raw.region),
    support: canonicalize(support, "reference"), // citation ids, unordered, deduped
  };
  const { canonical, hash } = finalize(declared, extensionsOf(raw, COMPOSITE_CLAIM_FIELDS));
  return { record_type: "composite-claim", claim_id, statement, region: raw.region, support, canonical, hash };
}

// ---- record 4: the weighting, a value choice stated as such ----
// The weighting measures nothing. It is per-citation weights or a stated priority ordering plus a
// rationale, and it is flagged as a value choice in the record itself so the grade never reads it as
// a measurement. Weights are exact-decimal strings, off the float path.
const WEIGHTING_KINDS = ["weights", "priority"];
export function weightingRecord(raw) {
  if (!WEIGHTING_KINDS.includes(raw.kind)) throw new Error(`weighting: bad kind ${raw.kind}`);
  const out = { kind: raw.kind, rationale: normalizeString(String(raw.rationale || "")), value_choice: true };
  if (raw.kind === "weights") {
    const weights = {};
    for (const k of Object.keys(raw.weights || {})) {
      const w = normalizeString(String(raw.weights[k]));
      if (!isExactDecimal(w)) throw new Error(`weighting: weight for ${k} must be an exact-decimal string, got ${JSON.stringify(raw.weights[k])}`);
      weights[k] = w;
    }
    out.weights = weights;
  } else {
    out.ordering = (raw.ordering || []).map((s) => String(s)); // priority ordering of citation ids
  }
  return out;
}

// ---- record 4: the cross-domain claim (extends the base composite claim) ----
// A claim that weighs domain claims against one another under a value weighting. It lives in the
// composite forum because no single domain floor grounds a weighing across domains; its ceiling is
// structured-forum, and its grade is derived by the record-2 transfer on read.
const CROSS_DOMAIN_FIELDS = ["claim_id", "statement", "region", "support", "weighting", "frame_refs"];
export function crossDomainClaimRecord(raw) {
  const statement = normalizeString(String(req(raw.statement, "cross-domain claim: statement required")));
  const claim_id = hashOf({ statement });
  const support = (raw.support || []).map((s) => String(s));       // citation ids it weighs
  const frame_refs = (raw.frame_refs || []).map((s) => String(s)); // framing records it names (record 5)
  const weighting = weightingRecord(req(raw.weighting, "cross-domain claim: weighting required"));
  const declared = {
    claim_id: canonicalize(claim_id),
    statement: canonicalize(statement),
    region: canonicalize("forum"), // typed as forum at the composite level; fixed, not chosen per claim
    support: canonicalize(support, "reference"),
    weighting: canonicalize(weighting),
  };
  if (frame_refs.length) declared.frame_refs = canonicalize(frame_refs, "reference");
  const { canonical, hash } = finalize(declared, extensionsOf(raw, CROSS_DOMAIN_FIELDS));
  return { record_type: "cross-domain-claim", claim_id, statement, region: "forum", support, weighting, frame_refs, canonical, hash };
}
