// Role: the v3 record types (intake data model v3, Sections 2, 4, 5, 6, 7, 8) plus the checking
//   record (Design Decision A). Each builder validates the spec's exact fields and allowed values,
//   routes undeclared fields into the tamper-evident extension area, and produces the canonical form
//   and hash. Claims and links compute their content identity; every traversal is capped by the
//   grade of the link it crosses.
// Contract: claimRecord, linkRecord, checkingRecord, wellFormednessFinding, referenceBindingRow,
//   contradictionRecord, withdrawnClaimRecord, reinstatementCondition, corroborationFinding. Pure,
//   ESM; kernel imports only kernel.
// Invariant: DETERMINISM, fields canonicalized per Section 1; the extension map is hashed and read
//   by no check. Grades are named positions (Section 9), never numbers. A supports link is the sole
//   source of truth for what a claim rests on; the claim record carries no references field.
"use strict";
import { canonicalize, normalizeString, hashOf, computeClaimIdentity, computeLinkIdentity } from "./canonical.mjs";
import { isPosition } from "./confidence.mjs";

// undercut (edge taxonomy [1.5]): attacks a support edge's grounding rather than adding support. It
// enters no grade fold in the gate (inert here, like contradicts routes to the register); a dedicated
// undercut reading over the graph lowers the confidence the attacked leg transmits.
// comments-on / replies-to (the comment kind): discussion links, never a support role by construction.
// A comment attaches to any record via comments-on, and to another comment via replies-to; neither
// enters the gate's support fold (only link_kind "supports" ever does), so a thread travels with the
// graph and moves no grade. The dedicated check is kernel/gate/comment-guard.mjs, gate-adjacent
// because the schema here has no rules field to carry a per-kind link-role restriction (see its
// own header note and docs/sorry-ledger.md, the rules-vocabulary seam).
const LINK_KINDS = ["supports", "depends-on", "contradicts", "refines", "restatement", "undercut", "comments-on", "replies-to"];
const METHOD_CLASSES = ["replication", "derivation-audit", "data-audit", "direct-measurement"];
const INDEPENDENCE = ["distinct-party", "self"];
const BINDING_RESOLUTIONS = ["bound", "bound-superseded", "unresolved"];
const PRESENT_IN = ["a-only", "b-only", "both-different-grouping"];
const CONDITION_KINDS = ["entry-of-kind", "entry-at-grade", "citation-into-class"];
const CLOSING_CONDITION_KINDS = ["measurement-on-the-system", "proof", "direct-study"];
const VERDICTS = ["shared", "disjoint"];

const req = (v, msg) => { if (v === undefined || v === null || v === "") throw new Error(msg); return v; };
const grade = (v, where) => { if (!isPosition(v)) throw new Error(`${where}: not a confidence-order position: ${JSON.stringify(v)}`); return v; };

// collect undeclared top-level fields (plus any explicit `extensions`) into one extension map.
function extensionsOf(raw, declaredNames) {
  const ext = Object.assign({}, raw.extensions || {});
  for (const k of Object.keys(raw)) if (k !== "extensions" && !declaredNames.includes(k)) ext[k] = raw[k];
  return ext;
}
// build the canonical node from already-canonicalized declared fields plus the raw extension map.
function finalize(canonDeclared, extRaw) {
  const node = Object.assign({}, canonDeclared);
  if (Object.keys(extRaw).length) node.extensions = canonicalize(extRaw); // generic, sorted, hashed, unread
  return { canonical: node, hash: hashOf(node, { pre: true }) };
}

// ---- the checking record (Design Decision A) ----
const CHECKING_FIELDS = ["checker_id", "method_class", "method", "checked_at_state", "outcome", "independence"];
export function checkingRecord(raw) {
  req(raw.checker_id, "checking record: checker_id required");
  if (!METHOD_CLASSES.includes(raw.method_class)) throw new Error(`checking record: bad method_class ${raw.method_class}`);
  if (!INDEPENDENCE.includes(raw.independence)) throw new Error(`checking record: bad independence ${raw.independence}`);
  const outcome = normalizeString(String(req(raw.outcome, "checking record: outcome required")));
  if (!/^confirms(-with-noted-limits\b.*)?$/.test(outcome) && outcome !== "confirms") throw new Error(`checking record: bad outcome ${outcome}`);
  const declared = {
    checker_id: canonicalize(raw.checker_id),
    method_class: canonicalize(raw.method_class),
    method: canonicalize(raw.method || ""),
    checked_at_state: canonicalize(req(raw.checked_at_state, "checking record: checked_at_state required")),
    outcome: canonicalize(outcome),
    independence: canonicalize(raw.independence),
  };
  const { canonical, hash } = finalize(declared, extensionsOf(raw, CHECKING_FIELDS));
  return { checker_id: raw.checker_id, method_class: raw.method_class, method: raw.method || "", checked_at_state: raw.checked_at_state, outcome, independence: raw.independence, canonical, hash };
}

// ---- the closing-condition record (Prompt 18) ----
// The sorry made a first-class field: on a claim honestly held as a characterized gap, the specific
// thing that would ground it. Mirrors the reinstatement condition on a withdrawn claim: a typed
// record naming the missing measurement, proof, or direct study, with the target described. It does
// not enter the claim's identity (identity is kind + statement), only its record.
export function closingCondition(raw) {
  if (!CLOSING_CONDITION_KINDS.includes(raw.condition_kind)) throw new Error(`closing condition: bad condition_kind ${raw.condition_kind}`);
  const c = {
    condition_kind: raw.condition_kind,
    target: normalizeString(String(req(raw.target, "closing condition: target (what must be produced) required"))),
  };
  if (raw.system !== undefined) c.system = normalizeString(String(raw.system)); // the specific system a measurement/study is on
  return c;
}

// ---- the claim record (Section 2) ----
const CLAIM_FIELDS = ["identity", "kind", "statement", "source_id", "contributor_id", "declared_grade", "checking_records", "closing_condition"];
export function claimRecord(raw) {
  const kind = normalizeString(req(raw.kind, "claim: kind required"));
  const statement = normalizeString(req(raw.statement, "claim: statement required"));
  const identity = computeClaimIdentity(kind, statement);
  const declared_grade = grade(raw.declared_grade, "claim.declared_grade");
  const checks = (raw.checking_records || []).map(checkingRecord);
  const closing = raw.closing_condition !== undefined ? closingCondition(raw.closing_condition) : undefined;
  const declared = {
    identity: canonicalize(identity),
    kind: canonicalize(kind),
    statement: canonicalize(statement),
    source_id: canonicalize(req(raw.source_id, "claim: source_id required")),
    contributor_id: canonicalize(req(raw.contributor_id, "claim: contributor_id required")),
    declared_grade: canonicalize(declared_grade),
  };
  if (raw.checking_records !== undefined) declared.checking_records = canonicalize(checks.map((c) => c.canonical), "child");
  if (closing !== undefined) declared.closing_condition = canonicalize(closing);
  const { canonical, hash } = finalize(declared, extensionsOf(raw, CLAIM_FIELDS));
  return {
    record_type: "claim", identity, kind, statement, source_id: raw.source_id, contributor_id: raw.contributor_id,
    declared_grade, checking_records: checks, closing_condition: closing, canonical, hash,
  };
}

// ---- the link record (Section 2) ----
const LINK_FIELDS = ["identity", "link_kind", "from_identity", "to_identity", "support_group", "source_id", "contributor_id", "declared_grade", "checking_records"];
export function linkRecord(raw) {
  if (!LINK_KINDS.includes(raw.link_kind)) throw new Error(`link: bad link_kind ${raw.link_kind}`);
  const from_identity = req(raw.from_identity, "link: from_identity required");
  const to_identity = req(raw.to_identity, "link: to_identity required");
  if (raw.support_group !== undefined && raw.link_kind !== "supports") throw new Error("link: support_group present only on supports links");
  const identity = computeLinkIdentity(raw.link_kind, from_identity, to_identity);
  const declared_grade = grade(raw.declared_grade, "link.declared_grade");
  const checks = (raw.checking_records || []).map(checkingRecord);
  const declared = {
    identity: canonicalize(identity),
    link_kind: canonicalize(raw.link_kind),
    from_identity: canonicalize(from_identity),
    to_identity: canonicalize(to_identity),
    source_id: canonicalize(req(raw.source_id, "link: source_id required")),
    contributor_id: canonicalize(req(raw.contributor_id, "link: contributor_id required")),
    declared_grade: canonicalize(declared_grade),
  };
  if (raw.support_group !== undefined) declared.support_group = canonicalize(raw.support_group);
  if (raw.checking_records !== undefined) declared.checking_records = canonicalize(checks.map((c) => c.canonical), "child");
  const { canonical, hash } = finalize(declared, extensionsOf(raw, LINK_FIELDS));
  return {
    record_type: "link", identity, link_kind: raw.link_kind, from_identity, to_identity,
    support_group: raw.support_group, source_id: raw.source_id, contributor_id: raw.contributor_id,
    declared_grade, checking_records: checks, canonical, hash,
  };
}

// ---- the well-formedness finding (Section 4) ----
export function wellFormednessFinding(raw) {
  if (String(raw.field_path || "").startsWith("extensions")) throw new Error("WF finding: field_path never points into extensions");
  return {
    finding_type: "well-formedness",
    contribution_hash: req(raw.contribution_hash, "WF: contribution_hash required"),
    entry_locator: req(raw.entry_locator, "WF: entry_locator required"),
    field_path: raw.field_path === undefined ? "absent" : raw.field_path,
    rule_id: req(raw.rule_id, "WF: rule_id required"),
    expected: raw.expected === undefined ? "absent" : normalizeString(String(raw.expected)),
    found: raw.found === undefined ? "absent" : (typeof raw.found === "string" ? normalizeString(raw.found) : raw.found),
  };
}

// ---- the reference-binding row (Section 5) ----
export function referenceBindingRow(raw) {
  if (!BINDING_RESOLUTIONS.includes(raw.resolution)) throw new Error(`binding: bad resolution ${raw.resolution}`);
  const row = {
    finding_type: "binding",
    reference_locator: req(raw.reference_locator, "binding: reference_locator required"),
    target_identity: req(raw.target_identity, "binding: target_identity required"),
    resolution: raw.resolution,
    asserted_grade: raw.asserted_grade === undefined ? "absent" : grade(raw.asserted_grade, "binding.asserted_grade"),
  };
  if (raw.resolution === "bound" || raw.resolution === "bound-superseded") {
    row.bound_state = req(raw.bound_state, "binding: bound_state required when bound");
    row.stored_grade = grade(req(raw.stored_grade, "binding: stored_grade required when bound"), "binding.stored_grade");
  }
  return row;
}

// ---- the contradiction record (Section 6) ----
export function divergencePoint(raw) {
  if (!PRESENT_IN.includes(raw.present_in)) throw new Error(`divergence: bad present_in ${raw.present_in}`);
  return { point_identity: req(raw.point_identity, "divergence: point_identity required"), present_in: raw.present_in, group_context: raw.group_context === undefined ? "absent" : raw.group_context };
}
export function contradictionRecord(raw) {
  const a = req(raw.identity_a, "contradiction: identity_a required");
  const b = req(raw.identity_b, "contradiction: identity_b required");
  if (a === b) throw new Error("contradiction: identity_a and identity_b must be distinct");
  return {
    record_type: "contradiction",
    identity_a: a, identity_b: b,
    link_identity: req(raw.link_identity, "contradiction: link_identity required"),
    grade_a: grade(raw.grade_a, "contradiction.grade_a"),
    grade_b: grade(raw.grade_b, "contradiction.grade_b"),
    divergence_points: (raw.divergence_points || []).map(divergencePoint),
  };
}

// ---- the withdrawn-claim record and its reinstatement condition (Section 7) ----
export function reinstatementCondition(raw) {
  if (!CONDITION_KINDS.includes(raw.condition_kind)) throw new Error(`reinstatement: bad condition_kind ${raw.condition_kind}`);
  const c = { condition_kind: raw.condition_kind };
  if (raw.condition_kind === "entry-of-kind") c.required_kind = req(raw.required_kind, "reinstatement entry-of-kind: required_kind required");
  if (raw.condition_kind === "entry-at-grade") {
    c.target_identity = req(raw.target_identity, "reinstatement entry-at-grade: target_identity required");
    c.minimum_grade = grade(req(raw.minimum_grade, "reinstatement entry-at-grade: minimum_grade required"), "reinstatement.minimum_grade");
  }
  if (raw.condition_kind === "citation-into-class") c.required_source_class = req(raw.required_source_class, "reinstatement citation-into-class: required_source_class required");
  if (raw.target_identity !== undefined) c.target_identity = raw.target_identity; // optional otherwise
  if (raw.required_kind !== undefined) c.required_kind = raw.required_kind;
  return c;
}
export function withdrawnClaimRecord(raw) {
  return {
    record_type: "withdrawn",
    claim_identity: req(raw.claim_identity, "withdrawn: claim_identity required"),
    withdrawn_at_state: req(raw.withdrawn_at_state, "withdrawn: withdrawn_at_state required"),
    withdrawn_by: req(raw.withdrawn_by, "withdrawn: withdrawn_by required"),
    reason: normalizeString(raw.reason || ""),
    reinstatement_condition: reinstatementCondition(req(raw.reinstatement_condition, "withdrawn: reinstatement_condition required")),
    reintroduced_by: raw.reintroduced_by, // annotation, added on satisfied reintroduction; record itself stays
  };
}

// ---- the corroboration-independence finding (Section 8) ----
const COVERAGE_PREFIX = "computed over the source table at version";
export function coverageNote(version) {
  return `${COVERAGE_PREFIX} ${version}; dependencies absent from the table are invisible to this check`;
}
// ---- the supersession record, decay finding, currency finding (Section 14) ----
export function supersessionRecord(raw) {
  return {
    record_type: "supersession",
    superseded_identity: req(raw.superseded_identity, "supersession: superseded_identity required"),
    successor_identity: req(raw.successor_identity, "supersession: successor_identity required"),
    at_state: req(raw.at_state, "supersession: at_state required"),
    reason: normalizeString(raw.reason || ""),
  };
}
export function decayFinding(raw) {
  return {
    finding_type: "decay",
    entry_identity: req(raw.entry_identity, "decay: entry_identity required"),
    declared_grade: grade(raw.declared_grade, "decay.declared_grade"),
    current_earned_grade: grade(raw.current_earned_grade, "decay.current_earned_grade"),
    cause: req(raw.cause, "decay: cause reference required"),
  };
}
export function currencyFinding(raw) {
  return {
    finding_type: "currency",
    entry_identity: req(raw.entry_identity, "currency: entry_identity required"),
    declared_grade: grade(raw.declared_grade, "currency.declared_grade"),
    standing: "ill-formed", // a fallen frame breaks form, not grade
    cause: req(raw.cause, "currency: cause reference required"),
  };
}

export function corroborationFinding(raw) {
  if (!VERDICTS.includes(raw.verdict)) throw new Error(`corroboration: bad verdict ${raw.verdict}`);
  req(raw.coverage_note, "corroboration: coverage_note mandatory");
  const f = {
    finding_type: "corroboration",
    identity: req(raw.identity, "corroboration: identity required"),
    closure_members: (raw.closure_members || []).slice(),
    support_groups: raw.support_groups || [],
    verdict: raw.verdict,
    // Section 1: numbers are exact-decimal strings, never JS numbers (which the canonical path rejects)
    effective_count: String(req(raw.effective_count, "corroboration: effective_count required")),
    coverage_note: raw.coverage_note,
  };
  if (raw.verdict === "shared") f.shared_source_ids = (raw.shared_source_ids || []).slice();
  if (raw.verdict === "disjoint") f.disjoint_footprints = raw.disjoint_footprints || [];
  return f;
}
