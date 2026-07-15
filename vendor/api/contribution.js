// Role: the contribution export. Packages a proposed contribution (claims plus links), once the gate
//   has decided it, as a portable bundle: the canonical patch, a content-derived contribution id, the
//   gate receipt, and admission instructions. This is the durable contribution path's middle steps
//   (immutable patch identity, export, external admission) without the patch ledger, because identity
//   is not history: the id is the one named hash over the canonical form, and the append-only ledger
//   ([4.5]) stays Stage 4, specified not built.
// Contract: exportContribution(proposal, receipt, origin) -> bundle; contributionId(proposal) -> hex;
//   importContribution(bundle) -> proposal. Pure, node-builtin-free (browser-importable); api imports
//   kernel and api, never the periphery. Reuses the existing canonical form and the one named hash; no
//   second canonicalization and no second hash.
// Invariant: a bundle is a GATE-PASSED PROPOSAL, never an admitted claim. Structural gate passage is
//   not semantic acceptance; admission is the target kernel's act. The id is order-independent (sort by
//   each record's own hash), so the same proposal has the same id however it was constructed, and a
//   bundle whose id does not match its content is rejected loudly, never repaired.
"use strict";
import { hashOf, canonicalize, encode } from "../kernel/schema/canonical.mjs";
import { claimRecord, linkRecord } from "../kernel/schema/records.mjs";

const PROTOCOL = "v3"; // the schema identity a target re-runs the gate under; not a second hash
const STATUS = "gate-passed, not admitted";
// the fixed admission instructions. They name re-check by the target as the admission step, and draw
// the line the bundle must never blur: structural gate passage here is not semantic acceptance there.
const INSTRUCTIONS =
  "This bundle is a proposal that passed the origin kernel's gate structurally; it is not admitted anywhere. " +
  "To submit it, open a pull request carrying the bundle to a target kernel: the target's own suite re-runs the gate over the patch, " +
  "admission is the target's act, and semantic judgement of whether the cited support holds of the world is its community's, never asserted here.";

// the proposal, normalized to { entries, links }: accept an entries array, a single `claim`, or `claims`.
function normalize(proposal) {
  const p = proposal || {};
  const entries = p.entries || (p.claim ? [p.claim] : p.claims) || [];
  const links = p.links || [];
  return { entries, links };
}

// the contribution id: the one named hash over the canonical form of the proposal. Records are ordered
// by their own hash so the id is order-independent (permuting the input leaves the id unchanged). The
// canonical form is exactly each record's already-computed canonical node, so nothing is re-canonicalized.
export function contributionId(proposal) {
  const { entries, links } = normalize(proposal);
  const byHash = (a, b) => (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0);
  const nodes = (recs) => recs.slice().sort(byHash).map((r) => r.canonical);
  return hashOf({ entries: nodes(entries), links: nodes(links) }, { pre: true });
}

export function exportContribution(proposal, receipt, origin) {
  const { entries, links } = normalize(proposal);
  if (!entries.length) throw new Error("exportContribution: a proposal must carry at least one claim");
  const o = origin || {};
  return {
    contribution_id: contributionId({ entries, links }),
    proposal: { entries, links },
    receipt: receipt || null,
    origin: { kernel_id: o.kernel_id || null, state_id: o.state_id || null },
    protocol: PROTOCOL,
    status: STATUS,
    instructions: INSTRUCTIONS,
  };
}

// ---- import: rebuild the records from their declared inputs, so a tampered field is caught by the id ----
// A record's declared inputs are re-run through the record builders, ignoring the stored canonical and
// hash, so editing any semantic field (a statement, a grade, a source) changes the recomputed record and
// therefore the recomputed contribution id, which no longer matches the bundle's. The stored id is the
// sole integrity anchor, recomputed from semantics rather than trusted.
function rawCheck(c) {
  return { checker_id: c.checker_id, method_class: c.method_class, method: c.method, checked_at_state: c.checked_at_state, outcome: c.outcome, independence: c.independence };
}
// reverse canonicalize for the JSON-safe subset, so an extension map round-trips through the builder.
// A decimal node returns its exact-decimal string; strings, booleans, arrays, and objects are identity.
// (A genuinely numeric extension would return as its decimal string, out of scope here where extensions
// are string-valued; the gate proposals this packages carry none.)
function decodeCanonical(node) {
  if (node && typeof node === "object" && typeof node.$dec === "string") return node.$dec;
  if (Array.isArray(node)) return node.map(decodeCanonical);
  if (node && typeof node === "object") { const o = {}; for (const k of Object.keys(node)) o[k] = decodeCanonical(node[k]); return o; }
  return node;
}
function extensionsOf(r) {
  const ext = r.canonical && r.canonical.extensions ? decodeCanonical(r.canonical.extensions) : {};
  return Object.keys(ext).length ? { ...ext } : {};
}
function rebuildClaim(r) {
  const raw = { kind: r.kind, statement: r.statement, source_id: r.source_id, contributor_id: r.contributor_id, declared_grade: r.declared_grade, ...extensionsOf(r) };
  if (r.checking_records && r.checking_records.length) raw.checking_records = r.checking_records.map(rawCheck);
  if (r.closing_condition) raw.closing_condition = r.closing_condition;
  return claimRecord(raw);
}
function rebuildLink(r) {
  const raw = { link_kind: r.link_kind, from_identity: r.from_identity, to_identity: r.to_identity, source_id: r.source_id, contributor_id: r.contributor_id, declared_grade: r.declared_grade, ...extensionsOf(r) };
  if (r.support_group !== undefined) raw.support_group = r.support_group;
  if (r.checking_records && r.checking_records.length) raw.checking_records = r.checking_records.map(rawCheck);
  return linkRecord(raw);
}

export function importContribution(bundle) {
  if (!bundle || !bundle.proposal) throw new Error("importContribution: bundle carries no proposal");
  const { entries, links } = normalize(bundle.proposal);
  const proposal = { entries: entries.map(rebuildClaim), links: links.map(rebuildLink) };
  const id = contributionId(proposal);
  if (id !== bundle.contribution_id)
    throw new Error(`importContribution: id mismatch (bundle ${bundle.contribution_id}, recomputed ${id}); the bundle content does not match its contribution id, rejected`);
  return proposal;
}

// exposed so a target's tooling can re-derive the canonical bytes without importing the whole module set.
export { canonicalize, encode };
