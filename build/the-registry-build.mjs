// Role: the generated builder for the the-registry kernel: builds its v3 store through the real gate from
//   the pure data in communities/the-registry/corpus, exactly as build/knowledge-game-build.mjs builds
//   knowledge-game (Stage 1's relocation of the scaffolder's own template).
// Contract: buildKernel() -> { store_id, tables, claims, refId, state, view, receipt }. Imports the
//   kernel and communities/the-registry/corpus; pure over the corpus.
// Invariant: grades are the kernel's own derivation; the scaffolder adds no rule of its own.
// DEPARTURE from the scaffolder's own generated template (Phase KG-12): the artifact-card and
//   contract-bundle claim shapes carry structured extension fields (artifact_hash, contract_hash,
//   interface_identity, required_oracle, ceiling_statement) that claimRecord's own extensionsOf()
//   already handles generically; the scaffolder's default template only forwards the six named claim
//   fields, so this build script also spreads every other key each corpus spec object carries,
//   documented here rather than silently hand-edited.
"use strict";
import { createRequire } from "node:module";
import { claimRecord, linkRecord } from "../vendor/kernel/schema/records.mjs";
import { makeSourceTable, makeKindTable } from "../vendor/kernel/schema/tables.mjs";
import { genesis } from "../vendor/kernel/store/state.mjs";
import { apply } from "../vendor/kernel/store/apply.mjs";
import { storeViewOf } from "../vendor/kernel/store/decay.mjs";
import { decide } from "../vendor/kernel/gate/gate.mjs";

const require = createRequire(import.meta.url);
const { KINDS, SOURCES } = require("../communities/the-registry/corpus/tables.js");
const { STORE } = require("../communities/the-registry/corpus/the-registry-data.js");

const CLAIM_NAMED_FIELDS = ["ref", "kind", "statement", "source_id", "contributor_id", "declared_grade", "checking_records", "closing_condition"];

export function buildKernel() {
  const tables = { sourceTable: makeSourceTable(SOURCES), kindTable: makeKindTable(KINDS) };
  const refId = new Map();
  const claims = STORE.claims.map((spec) => {
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
  return { store_id: STORE.store_id, tables, claims, refId, state, view, receipt };
}
