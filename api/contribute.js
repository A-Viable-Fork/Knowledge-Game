// Role: the contribution draft path (Level 3). Builds a proposed claim, optionally with one link
//   (supports, undercut, or refines/qualification) to an existing target claim already in the
//   community's graph, through the real vendored schema builders, then runs it through the real gate
//   via decide() against the community's own current state, exactly the primitive
//   vendor/api/providers/local-provider.mjs itself calls. Also surfaces contestType and forkType
//   (vendor/api/contest.js, vendor/api/fork.js) for a claim's type, and exportContribution
//   (vendor/api/contribution.js) once the gate has decided. Phase KG-4 adds draftComment (the only
//   path this module offers to build a comments-on/replies-to link; it exposes no way to build a
//   comment-to-support link at all) and draftPromoteToClaim (lifts a comment's text into a new
//   claim, linked back from the comment via comments-on, a non-support role). Phase KG-6b: each
//   draft*'s successful (gate-run) return also carries extraSources, the citation source object
//   actually used in that decision if any, empty otherwise; the outbox (api/outbox.js) stores this
//   alongside a queued bundle so re-gating against a later, fresh snapshot can reconstruct the
//   identical source table a resubmission would need, without inventing a citation the draft never
//   made.
// Contract: draftProposal(community, draft) -> { proposal: {entries, links}, receipt }. community is
//   what api/community.js's fetchCommunity() returns (needs .raw = {state, sources, kinds}). draft =
//   { statement, kind, contributorId?, declaredGrade?, citation?, action: "new"|"support"|"undercut"|
//   "qualification", targetIdentity? }. draftComment(community, { statement, contributorId?,
//   citation?, targetIdentity?, replyToIdentity? }) -> { proposal, receipt }: exactly one of
//   targetIdentity (comments-on) or replyToIdentity (replies-to) is used, always kind "comment",
//   always declared_grade "ungraded". draftPromoteToClaim(community, { commentIdentity, statement,
//   kind, contributorId?, declaredGrade?, citation? }) -> { proposal, receipt }: a new claim, linked
//   from the existing comment via comments-on. draftContest(community, targetKind, contest) and
//   draftFork(community, targetKind, overrides) surface contest.js/fork.js over a row's kind. bundle()
//   wraps a decided proposal via vendor/api/contribution.js.
// Invariant: schema validation is the real claimRecord/linkRecord throwing on a bad shape; the gate
//   decision is the real decide() over the community's own tables, never a second grounding
//   implementation. A pasted citation always becomes a testimony-class source and NEVER carries a
//   checking_records entry: there is no path in this module from citation input to an independence
//   attribute, structurally, so a citation cannot become an independent confirmation by being pasted.
//   Every path here that can build a "supports" link (draftProposal's support/undercut/qualification
//   actions) runs the real vendored comment-support guard (kernel/gate/comment-guard.mjs) before
//   decide(), the same call local-provider.mjs makes; this app's own write path does not route
//   through local-provider.mjs's propose(), so the guard is called here directly rather than inherited
//   for free. draftComment never constructs a "supports" link at all: it has no action parameter and
//   no code path that emits one, so the guard is defense in depth here, not the only thing standing
//   between a comment and the support role.
// Governs: claim-4: this module imports nothing from vault/ or api/settings.js, so there is no code
//   path here through which a personal profile field could reach an exported bundle.
// Governs: claim-12: citationSource always mints a testimony-class source with zero checking_records;
//   no field this module writes can turn a pasted citation into an independent confirmation.
// Governs: claim-17: contributionId (re-exported from vendor/api/contribution.js) hashes the canonical
//   patch form, so bundle identity is content-derived and invariant under construction-order
//   permutation, never dependent on a durable patch history this module does not keep.
"use strict";
import { claimRecord, linkRecord } from "../vendor/kernel/schema/records.mjs";
import { makeSourceTable, makeKindTable } from "../vendor/kernel/schema/tables.mjs";
import { storeViewOf } from "../vendor/kernel/store/decay.mjs";
import { decide } from "../vendor/kernel/gate/gate.mjs";
import { hashTypeBundle } from "../vendor/kernel/schema/type-hash.mjs";
import { rejectCommentSupport } from "../vendor/kernel/gate/comment-guard.mjs";
import { contestType } from "../vendor/api/contest.js";
import { forkType } from "../vendor/api/fork.js";
import { exportContribution, contributionId } from "../vendor/api/contribution.js";

const LINK_KIND_OF_ACTION = { support: "supports", undercut: "undercut", qualification: "refines" };

function slug(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

// a pasted citation's source: always testimony-class, always carrying zero checking_records. This is
// the whole of claim 12's structural guarantee: there is no field on this object a caller could set to
// make a citation look independently checked, because independence is simply never written here.
function citationSource(citation) {
  const cited = citation && String(citation).trim();
  if (!cited) return null;
  return { source_id: "contributor:cite:" + slug(cited), source_class: "testimony", description: cited, rests_on: [] };
}

export function draftProposal(community, draft) {
  const raw = community.raw;
  const d = draft || {};
  if (!d.statement) throw new Error("draftProposal: statement required");
  if (!d.kind) throw new Error("draftProposal: kind required");
  const contributor_id = d.contributorId || "contributor";
  const action = d.action || "new";

  const citeSource = citationSource(d.citation);
  const source_id = citeSource ? citeSource.source_id : "contributor:unsourced";
  const source_class = citeSource ? citeSource.source_class : "testimony";
  const declared_grade = d.declaredGrade || "asserted";

  let claim;
  try {
    claim = claimRecord({ kind: d.kind, statement: d.statement, source_id, contributor_id, declared_grade });
  } catch (e) {
    return { proposal: null, receipt: { decision: "declined", error: "malformed claim: " + e.message, findings: [], grade_table: [] } };
  }

  const links = [];
  if (action !== "new") {
    if (!d.targetIdentity) throw new Error(`draftProposal: action '${action}' requires targetIdentity`);
    const link_kind = LINK_KIND_OF_ACTION[action];
    if (!link_kind) throw new Error(`draftProposal: unknown action '${action}'`);
    try {
      links.push(linkRecord({
        link_kind, from_identity: claim.identity, to_identity: d.targetIdentity,
        support_group: link_kind === "supports" ? "g:" + d.targetIdentity + "/" + claim.identity : undefined,
        source_id, contributor_id, declared_grade: link_kind === "supports" ? (d.linkGrade || "corroborated") : "asserted",
      }));
    } catch (e) {
      return { proposal: null, receipt: { decision: "declined", error: "malformed link: " + e.message, findings: [], grade_table: [] } };
    }
  }

  const sourcesForDecision = citeSource ? [...raw.sources, citeSource] : raw.sources;
  const tables = { kindTable: makeKindTable(raw.kinds), sourceTable: makeSourceTable(sourcesForDecision) };
  const contribution = { hash: claim.hash, entries: [claim], links };
  const view = storeViewOf(raw.state, tables);
  try {
    rejectCommentSupport(contribution, view);
  } catch (e) {
    return { proposal: null, receipt: { decision: "declined", error: e.message, findings: [], grade_table: [] } };
  }
  const receipt = decide(contribution, view, {});
  receipt.proposed_identity = claim.identity;
  return { proposal: { entries: [claim], links }, receipt, extraSources: citeSource ? [citeSource] : [] };
}

// draftComment: the only path this module offers to build a comments-on/replies-to link. Always
// kind "comment", always declared_grade "ungraded" (a comment is never offered a grade selector: its
// ceiling is the lattice floor, so nothing here would move by declaring higher). Exactly one of
// targetIdentity (comments-on: this comment attaches to any existing record) or replyToIdentity
// (replies-to: this comment replies to another comment) is honored; there is no "action" parameter
// and no code path in this function that could emit a "supports" link.
export function draftComment(community, draft) {
  const raw = community.raw;
  const d = draft || {};
  if (!d.statement) throw new Error("draftComment: statement required");
  if (!d.targetIdentity && !d.replyToIdentity) throw new Error("draftComment: targetIdentity or replyToIdentity required");
  const contributor_id = d.contributorId || "contributor";

  const citeSource = citationSource(d.citation);
  const source_id = citeSource ? citeSource.source_id : "contributor:unsourced";

  let comment;
  try {
    comment = claimRecord({ kind: "comment", statement: d.statement, source_id, contributor_id, declared_grade: "ungraded" });
  } catch (e) {
    return { proposal: null, receipt: { decision: "declined", error: "malformed comment: " + e.message, findings: [], grade_table: [] } };
  }

  const link_kind = d.replyToIdentity ? "replies-to" : "comments-on";
  const to_identity = d.replyToIdentity || d.targetIdentity;
  let link;
  try {
    link = linkRecord({ link_kind, from_identity: comment.identity, to_identity, source_id, contributor_id, declared_grade: "ungraded" });
  } catch (e) {
    return { proposal: null, receipt: { decision: "declined", error: "malformed link: " + e.message, findings: [], grade_table: [] } };
  }

  const sourcesForDecision = citeSource ? [...raw.sources, citeSource] : raw.sources;
  const tables = { kindTable: makeKindTable(raw.kinds), sourceTable: makeSourceTable(sourcesForDecision) };
  const contribution = { hash: comment.hash, entries: [comment], links: [link] };
  const view = storeViewOf(raw.state, tables);
  try {
    rejectCommentSupport(contribution, view);
  } catch (e) {
    return { proposal: null, receipt: { decision: "declined", error: e.message, findings: [], grade_table: [] } };
  }
  const receipt = decide(contribution, view, {});
  receipt.proposed_identity = comment.identity;
  return { proposal: { entries: [comment], links: [link] }, receipt, extraSources: citeSource ? [citeSource] : [] };
}

// draftPromoteToClaim: lifts an existing comment's text into a new, ordinarily-graded claim, linked
// back from the comment via comments-on (comment to any record; the new claim qualifies), the honest
// non-support link. The comment itself is untouched, still in the graph, still ungraded; this adds a
// new claim and one new link, never edits or removes the comment.
export function draftPromoteToClaim(community, draft) {
  const raw = community.raw;
  const d = draft || {};
  if (!d.commentIdentity) throw new Error("draftPromoteToClaim: commentIdentity required");
  if (!d.statement) throw new Error("draftPromoteToClaim: statement required");
  if (!d.kind) throw new Error("draftPromoteToClaim: kind required");
  const contributor_id = d.contributorId || "contributor";

  const citeSource = citationSource(d.citation);
  const source_id = citeSource ? citeSource.source_id : "contributor:unsourced";
  const declared_grade = d.declaredGrade || "asserted";

  let claim;
  try {
    claim = claimRecord({ kind: d.kind, statement: d.statement, source_id, contributor_id, declared_grade });
  } catch (e) {
    return { proposal: null, receipt: { decision: "declined", error: "malformed claim: " + e.message, findings: [], grade_table: [] } };
  }
  let link;
  try {
    link = linkRecord({ link_kind: "comments-on", from_identity: d.commentIdentity, to_identity: claim.identity, source_id, contributor_id, declared_grade: "ungraded" });
  } catch (e) {
    return { proposal: null, receipt: { decision: "declined", error: "malformed link: " + e.message, findings: [], grade_table: [] } };
  }

  const sourcesForDecision = citeSource ? [...raw.sources, citeSource] : raw.sources;
  const tables = { kindTable: makeKindTable(raw.kinds), sourceTable: makeSourceTable(sourcesForDecision) };
  const contribution = { hash: claim.hash, entries: [claim], links: [link] };
  const view = storeViewOf(raw.state, tables);
  try {
    rejectCommentSupport(contribution, view);
  } catch (e) {
    return { proposal: null, receipt: { decision: "declined", error: e.message, findings: [], grade_table: [] } };
  }
  const receipt = decide(contribution, view, {});
  receipt.proposed_identity = claim.identity;
  return { proposal: { entries: [claim], links: [link] }, receipt, extraSources: citeSource ? [citeSource] : [] };
}

// the type-hash of an existing row's kind, looked up from the community's own kind table (never
// invented): the bundle the crossing hashes is exactly {kind, ceiling, compatibility_rule_id: null,
// atlas_refs: []}, the shape every kind row in this protocol's kernels is generated with.
export function typeHashOfKind(community, kindName) {
  const row = (community.raw.kinds || []).find((k) => k.kind === kindName);
  if (!row) throw new Error(`typeHashOfKind: kind '${kindName}' not in this community's kind table`);
  const bundle = { kind: row.kind, ceiling: row.ceiling, compatibility_rule_id: null, atlas_refs: [] };
  return { bundle, hash: hashTypeBundle(bundle) };
}

// contestType's own contract says the caller runs its contribution through the ordinary gate, no
// bypass: this is that run, so a contest carries a real ladder state like any other proposal, over
// the exact same decide() this module's other drafts use.
export function draftContest(community, kindName, contest) {
  const raw = community.raw;
  const { hash } = typeHashOfKind(community, kindName);
  const drafted = contestType(hash, contest);
  const tables = { kindTable: makeKindTable(raw.kinds), sourceTable: makeSourceTable(raw.sources.some((s) => s.source_id === drafted.claim.source_id) ? raw.sources : [...raw.sources, { source_id: drafted.claim.source_id, source_class: "testimony", description: "contest claim", rests_on: [] }]) };
  const receipt = decide(drafted.contribution, storeViewOf(raw.state, tables), {});
  receipt.proposed_identity = drafted.claim.identity;
  return { proposal: { entries: drafted.contribution.entries, links: drafted.contribution.links }, contestReceipt: drafted.receipt, receipt };
}

export function draftFork(community, kindName, overrides) {
  const { bundle } = typeHashOfKind(community, kindName);
  return forkType(bundle, overrides);
}

// bundle a decided proposal for export, via the real vendor/api/contribution.js. Refuses a proposal
// the gate declined: an export is a portable GATE-PASSED bundle, never a rejected one dressed as one.
// "accepted" and "accepted-with-disagreement" both pass the gate structurally (gate.mjs); only
// "declined" is a refusal.
const PASSED_DECISIONS = new Set(["accepted", "accepted-with-disagreement"]);
export function bundleProposal(proposal, receipt, origin) {
  if (!proposal || !receipt || !PASSED_DECISIONS.has(receipt.decision))
    throw new Error("bundleProposal: only a gate-passed proposal may be exported");
  return exportContribution(proposal, receipt, origin);
}

export { contributionId };
