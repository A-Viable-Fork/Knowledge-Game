// Role: the kernel designer's computational core (Phase KG-10, spec Section 7 step 2-3: "set the free
//   parameters" and "type", upgraded from functional skeleton to founder experience). Everything here
//   is pure, browser-safe computation: the three starting presets, plain-language guidance for every
//   lattice grade / source class / license option, a bundled sample claim set drawn from this
//   deployment's own real fixtures, and the live preview recompute, which runs the identical vendored
//   provider/client-api path api/community.js uses to read a real community, never a hand-rolled
//   illustration of what a grade would be.
// Contract: PRESETS (three complete config objects, adopt-then-modify starting points);
//   GRADE_GUIDANCE, SOURCE_CLASS_GUIDANCE, LICENSE_OPTIONS, LICENSE_ENFORCEMENT_NOTE (every guidance
//   string the designer renders, keyed so a caller can iterate them exhaustively for review);
//   forkKindFromShared(kindName) -> {kind, ceiling} draft copied from the shared subtree;
//   hashLocalKind({kind, ceiling}) -> hex sha256 via the real vendored type-hash primitive;
//   buildSampleCorpus() -> {entries, links, sources}, this module's one bundled preview corpus, built
//   through the real claimRecord/linkRecord builders so every identity and hash is the genuine kernel
//   form, never hand-written; recomputeSamplePreview(kindRows) -> [{identity, statement, kind,
//   declared_grade, earned_grade}], one row per sample claim, computed by createLocalProvider +
//   createClientApi over the sample corpus under the caller's own draft kind table, the same client
//   path a real community's read() uses.
// Invariant: recomputeSamplePreview never re-implements grading; it constructs the identical snapshot
//   shape (state, sources, kinds) fetchCommunity's own provider expects and asks the real provider,
//   so "computed by the same recurrence the gate runs" (the designer's own preview caption) is a fact
//   about this function's implementation, not a claim it merely displays. The sample corpus's
//   "crossing arrival" claim (kind "hypothesis") is deliberately absent from every preset's own kind
//   table: vendor/kernel/schema/tables.mjs's ceilingFor returns null for an unrecognized kind, and
//   vendor/kernel/store/decay.mjs's derivedGrade then caps that claim's ceiling at "asserted"
//   regardless of its own declared grade or checking records, a real kernel behavior this module
//   relies on rather than simulates, until a matching local kind is authored or adopted for it.
// Governs: claim-20 (the founding flow's parameter surface equal to the register's free list):
//   PRESETS' own scaffoldable fields (adopted_type_hashes, local_kinds, sources, time_lock) never
//   exceed api/parameter-surface.js's free list; corpus_content_license, identity_thresholds, and
//   standing_economy live outside that surface exactly as build/found-community.mjs's own config
//   object already does, never smuggled into the scaffolder-facing subset.
"use strict";
import { POSITIONS } from "../vendor/kernel/schema/confidence.mjs";
import { hashTypeBundle } from "../vendor/kernel/schema/type-hash.mjs";
import { claimRecord, linkRecord } from "../vendor/kernel/schema/records.mjs";
import { createLocalProvider } from "../vendor/api/providers/local-provider.mjs";
import { createClientApi } from "../vendor/api/client-api.mjs";

// the shared subtree's own bundles (vendor/corpora/_shared/common-types.js), duplicated here as a
// plain-data mirror since that file is a CommonJS module (module.exports, no named ESM export) and
// this deployment's own build/found-community.mjs already reads it the same way through the scaffolder
// rather than importing it directly; the ceiling values are the same constants that module declares,
// checked against it structurally by build/check-designer.mjs so a drift there is caught, not silent.
const SHARED_KIND_CEILINGS = { measurement: "checked", forum: "corroborated", declaration: "constitutive", comment: "ungraded" };

export function forkKindFromShared(kindName) {
  const ceiling = SHARED_KIND_CEILINGS[kindName];
  if (!ceiling) throw new Error(`forkKindFromShared: '${kindName}' is not a shared kind`);
  return { kind: kindName, ceiling };
}

export function hashLocalKind(kindDef) {
  return hashTypeBundle({ kind: kindDef.kind, ceiling: kindDef.ceiling, compatibility_rule_id: null, atlas_refs: [] });
}

// ---- guidance: plain language over real semantics, one to two sentences, accurate to the spec ----
export const GRADE_GUIDANCE = {
  ungraded: "The floor. Nothing has supported, checked, or corroborated this claim yet; it renders, but nothing may rest on it.",
  asserted: "Stated with a source, nothing more. Enough to enter the graph, not enough to found another claim's own standing on.",
  supported: "At least one other graded claim supports this one. Standing has begun, short of a real check.",
  corroborated: "Independent supports converge on this claim from more than one direction. Stronger than a single support, still short of a direct check.",
  checked: "A real, direct-measurement checking record exists: something ran, executed, or independently measured this claim and confirmed it. The floor to require before a claim is load-bearing.",
  "independently-rechecked": "A second, distinct-party checking record confirms the same claim independently of the first: the strongest position on the empirical branch.",
  constitutive: "Not empirically checked: true by definition, axiom, or the kernel's own construction. Incomparable to the empirical branch, neither above nor below checked.",
};

export const SOURCE_CLASS_GUIDANCE = {
  "primary-measurement": "Direct observation or measurement by the party making the claim: the strongest single footing this menu offers.",
  "peer-reviewed": "Published after independent review by others in the field: a real footing, though the review itself is a source being trusted.",
  preprint: "Published but not yet independently reviewed: real work claimed, without the peer-review footing yet attached.",
  dataset: "A structured collection of recorded observations: as strong as its own collection method, which this menu does not itself verify.",
  "institutional-report": "An organization's own report on its own activity: real, though self-reported, so weight it as such.",
  testimony: "A person's account, including any pasted citation. Never treated as independent confirmation by this kernel's own rule, regardless of who states it.",
};

export const LICENSE_OPTIONS = [
  { id: "gift", label: "Gift", sentence: "Given freely; anyone may use, fork, or build on this community's claims with no obligation back." },
  { id: "attribution-required", label: "Attribution-required", sentence: "Free to use and fork, provided the fork visibly credits this community as the source." },
  { id: "share-alike", label: "Share-alike", sentence: "Free to use and fork, provided any derivative publishes its own changes back under the same terms; a fork that keeps its changes private is out of compliance with its own declared license, the derivative-verification-must-publish teeth this option carries." },
  { id: "non-commercial", label: "Non-commercial", sentence: "Free to use and fork for non-commercial purposes only; commercial use requires separate terms from this community." },
  { id: "named-commercial-term", label: "Named commercial term", sentence: "Use requires a specific commercial agreement this community names; read its own documentation for the actual term before building on its claims." },
];
export const LICENSE_ENFORCEMENT_NOTE =
  "Enforcement here is legal and normative, never mechanical: nothing in this app checks compliance with a declared license. The declaration travels visibly inside the governance-hash, so any fork's terms are legible to whoever reads them.";

// ---- the three presets: complete config objects, adopt-then-modify starting points ----
export const PRESETS = [
  {
    id: "open-commons",
    label: "Open commons",
    description: "Gift-licensed, no identity thresholds, permissive kinds. The lightest starting point: anyone may found, contribute, and fork with nothing held back.",
    config: {
      frame: { name: "Open Commons", domain: "general knowledge", purpose: "a permissive home for claims anyone may contribute to, fork, or build on" },
      adopted_type_hashes: ["measurement", "forum"],
      local_kinds: [],
      sources: [{ source_id: "src:founder-testimony", source_class: "testimony", description: "the founder's own initial account, pending real sources as members contribute" }],
      time_lock: { setting: "light" },
      identity_thresholds: {},
      standing_economy: {},
      corpus_content_license: "gift",
    },
  },
  {
    id: "attested-evidence",
    label: "Attested evidence",
    description: "Attribution-required licensing, corroboration-leaning kinds, identity thresholds collected for contest and vouch (inactive until the credential seam activates). For a community that wants real names behind its strongest actions, later.",
    config: {
      frame: { name: "Attested Evidence", domain: "measured claims requiring corroboration", purpose: "a community whose claims are expected to carry real, checkable evidence" },
      adopted_type_hashes: ["measurement"],
      local_kinds: [{ kind: "corroborated-finding", ceiling: "independently-rechecked" }],
      sources: [{ source_id: "src:founder-measurement", source_class: "primary-measurement", description: "the founder's own initial direct measurement, pending member-contributed sources" }],
      time_lock: { setting: "standard" },
      identity_thresholds: { contest: "identity-verified", vouch: "identity-verified" },
      standing_economy: {},
      corpus_content_license: "attribution-required",
    },
  },
  {
    id: "stake-gated",
    label: "Stake-gated",
    description: "Share-alike licensing, identity thresholds and stake fields collected across every action, all inactive. The fullest demonstration of designing a regime that only activates once the credential and standing-economy seams do.",
    config: {
      frame: { name: "Stake-Gated Commons", domain: "high-stakes claims", purpose: "a community that designs its full contest regime in advance, activating it only once the seams it depends on do" },
      adopted_type_hashes: ["measurement", "forum"],
      local_kinds: [],
      sources: [{ source_id: "src:founder-report", source_class: "institutional-report", description: "the founder's own initial institutional report, pending member-contributed sources" }],
      time_lock: { setting: "heavy" },
      identity_thresholds: { propose: "identity-verified", contest: "identity-verified", vouch: "identity-verified" },
      standing_economy: { time_lock_cost: "high", decay_rate: "slow" },
      corpus_content_license: "share-alike",
    },
  },
];

// ---- the bundled sample claim set: real kernel records, drawn loosely from this deployment's own
// math fixture in style and content, never invented grading behavior. Built once, module-level,
// since the corpus itself is fixed; only the draft kind table the caller supplies varies the preview.
const SAMPLE_SOURCES = [
  { source_id: "src:sample-measurement", source_class: "primary-measurement", description: "a direct measurement, this preview's own base evidence" },
  { source_id: "src:sample-support", source_class: "peer-reviewed", description: "an independent, peer-reviewed corroborating source" },
  { source_id: "src:sample-testimony", source_class: "testimony", description: "an unverified account, this preview's weakest source" },
];

function buildSampleClaim({ statement, kind, source_id, declared_grade, checking_records }) {
  return claimRecord({ kind, statement, source_id, contributor_id: "preview:designer", declared_grade, checking_records });
}

export function buildSampleCorpus() {
  // a: standalone, own basis only (a real distinct-party checking record, no incoming support), so
  // the settled-not-inherited rule's first row applies (noSupports) and its earned grade is exactly
  // capByCeiling("checked", the measurement kind's own ceiling): a clean demonstration of the ceiling
  // moving this claim's grade directly as a founder adjusts it, unclouded by any support delivery.
  const a = buildSampleClaim({
    statement: "A differential-test harness confirms the recurrence's output against a random-graph sweep.",
    kind: "measurement", source_id: "src:sample-measurement", declared_grade: "checked",
    checking_records: [{ checker_id: "preview:differential-test", method_class: "direct-measurement", method: "a differential-test harness run against the recurrence", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" }],
  });
  // b: its own basis (checked, standalone), then supports c: the support shape. b's own derived grade
  // (settled tier) flows through the supports link into c, lifting c from bare asserted to
  // corroborated purely via the support chain, never c's own checking record (it has none).
  const b = buildSampleClaim({
    statement: "An independently published account confirms the same result from a second angle.",
    kind: "measurement", source_id: "src:sample-support", declared_grade: "checked",
    checking_records: [{ checker_id: "preview:second-measurement", method_class: "direct-measurement", method: "an independent, second measurement of the same quantity", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" }],
  });
  const c = buildSampleClaim({
    statement: "A community member's own account of a related observation, offered without further evidence of its own.",
    kind: "forum", source_id: "src:sample-testimony", declared_grade: "asserted", checking_records: [],
  });
  const bSupportsC = linkRecord({
    link_kind: "supports", from_identity: b.identity, to_identity: c.identity,
    support_group: `g:${c.identity}/${b.identity}`, source_id: "src:sample-support", contributor_id: "preview:designer", declared_grade: "corroborated",
  });
  // the crossing arrival: kind "hypothesis" is deliberately absent from every preset's own kind
  // table, so ceilingFor(kindTable, "hypothesis") returns null and derivedGrade caps its earned grade
  // at "asserted" regardless of this own declared grade or checking record, until a founder authors or
  // adopts a matching local kind for it.
  const crossing = buildSampleClaim({
    statement: "A claim arriving from outside this kernel's own type system, honestly unrecognized until typed here.",
    kind: "hypothesis", source_id: "src:sample-measurement", declared_grade: "checked",
    checking_records: [{ checker_id: "preview:crossing-source-kernel", method_class: "direct-measurement", method: "checked in the kernel this claim crossed in from", checked_at_state: "ST0", outcome: "confirms", independence: "distinct-party" }],
  });
  return {
    entries: [a, b, c, crossing],
    links: [bSupportsC],
    sources: SAMPLE_SOURCES,
  };
}

export function recomputeSamplePreview(kindRows) {
  const corpus = buildSampleCorpus();
  const snapshotLike = { kernel_id: "preview", state: { entries: corpus.entries, links: corpus.links }, sources: corpus.sources, kinds: kindRows };
  const provider = createLocalProvider(snapshotLike);
  const api = createClientApi(provider);
  return api.read({});
}
