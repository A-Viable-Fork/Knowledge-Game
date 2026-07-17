// Role: the builder for the front-page kernel: builds its v3 store through the real gate from the
//   pure data in kernel/front-page/corpora, exactly as build/knowledge-game-build.mjs builds the
//   governance kernel. Departs from that pattern in one way: it also pulls the specific governance
//   claims kernel/front-page/corpora/front-page-data.js's own `mirrors` array names (claim-1,
//   claim-9, claim-19) verbatim from kernel/governance/corpora/knowledge-game-data.js, so the
//   front-page claims that restate them (fp-16, fp-17, fp-19, fp-20) resolve against a real,
//   identically-hashed sibling entry in this same build rather than declining as unresolved.
// Contract: buildKernel() -> { store_id, tables, claims, refId, state, view, receipt }.
// Invariant: grades are the kernel's own derivation; this builder adds no rule of its own. The
//   mirrored entries are copied, never re-typed, so front-page and governance can never drift; a
//   changed governance claim's kind or statement here is caught by build/check-front-page-lens.mjs
//   (the mirrored identity would stop matching the governance snapshot's own).
"use strict";
import { createRequire } from "node:module";
import { claimRecord, linkRecord } from "../vendor/kernel/schema/records.mjs";
import { makeSourceTable, makeKindTable } from "../vendor/kernel/schema/tables.mjs";
import { genesis } from "../vendor/kernel/store/state.mjs";
import { apply } from "../vendor/kernel/store/apply.mjs";
import { storeViewOf } from "../vendor/kernel/store/decay.mjs";
import { decide } from "../vendor/kernel/gate/gate.mjs";

const require = createRequire(import.meta.url);
const { KINDS, SOURCES } = require("../kernel/front-page/corpora/tables.js");
const { STORE } = require("../kernel/front-page/corpora/front-page-data.js");
const { SOURCES: GOV_SOURCES } = require("../kernel/governance/corpora/tables.js");
const { STORE: GOV_STORE } = require("../kernel/governance/corpora/knowledge-game-data.js");

const CLAIM_NAMED_FIELDS = ["ref", "kind", "statement", "source_id", "contributor_id", "declared_grade", "checking_records", "closing_condition"];

export function buildKernel() {
  const govById = new Map(GOV_STORE.claims.map((c) => [c.ref, c]));
  const mirroredSpecs = (STORE.mirrors || []).map((ref) => {
    const spec = govById.get(ref);
    if (!spec) throw new Error(`front-page-build: mirrors names ${ref}, absent from the governance corpus`);
    // origin_kernel: an ordinary extension field (never read by the gate), so the lens can label a
    // followed hop honestly as leaving the front-page kernel into the app's own governance kernel,
    // rather than presenting a mirrored entry as if it were front-page's own.
    return { ...spec, origin_kernel: "knowledge-game" };
  });
  const govSourceIds = new Set(mirroredSpecs.map((s) => s.source_id));
  const mergedSources = SOURCES.concat(GOV_SOURCES.filter((s) => govSourceIds.has(s.source_id)));

  const tables = { sourceTable: makeSourceTable(mergedSources), kindTable: makeKindTable(KINDS) };
  const refId = new Map();
  const allSpecs = STORE.claims.concat(mirroredSpecs);
  const claims = allSpecs.map((spec) => {
    const extra = {};
    for (const k of Object.keys(spec)) if (!CLAIM_NAMED_FIELDS.includes(k)) extra[k] = spec[k];
    const rec = claimRecord({ kind: spec.kind, statement: spec.statement, source_id: spec.source_id, contributor_id: spec.contributor_id, declared_grade: spec.declared_grade, checking_records: spec.checking_records, closing_condition: spec.closing_condition, ...extra });
    refId.set(spec.ref, rec.identity);
    return { rec, spec };
  });
  const links = (STORE.links || []).map((l) => linkRecord({ link_kind: l.link_kind, from_identity: refId.get(l.from), to_identity: refId.get(l.to), support_group: l.support_group, source_id: l.source_id, contributor_id: l.contributor_id, declared_grade: l.declared_grade }));
  const entries = claims.map((c) => c.rec);
  const state = apply(genesis(), { entries, links, applied_contribution_hash: STORE.store_id, receipt_reference: STORE.store_id });
  const view = storeViewOf(state, tables);
  const receipt = decide({ hash: STORE.store_id, entries, links }, storeViewOf(genesis(), tables), {});
  return { store_id: STORE.store_id, tables, claims, refId, mergedSources, state, view, receipt };
}
