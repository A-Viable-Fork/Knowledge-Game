// Role: the two reference tables (intake data model v3, Section 10) and the source-footprint
//   closure (Design Decision B). The source table and the kind-ceiling table are TRUSTED INPUTS
//   that enter every check; this module holds their shape and the reflexive-transitive closure that
//   corroboration and checker-independence read over source dependencies.
// Contract: makeSourceTable(rows), makeKindTable(rows); sourceClass, ceilingFor, footprintClosure.
//   Pure, ESM; kernel imports only kernel.
// Invariant: the dependency relation is required acyclic by governance; a cycle nevertheless present
//   is read as one source per strongly connected component (the conservative reading), so the
//   closure never undercounts a footprint. Governing these tables is the model's named trust boundary.
"use strict";
import { isPosition, modeOf } from "./confidence.mjs";

const SOURCE_CLASSES = ["primary-measurement", "peer-reviewed", "preprint", "dataset", "institutional-report", "testimony"];

export function makeSourceTable(rows) {
  const byId = new Map();
  for (const r of rows || []) {
    if (!r.source_id) throw new Error("source row missing source_id");
    if (!SOURCE_CLASSES.includes(r.source_class)) throw new Error(`source ${r.source_id}: bad source_class ${r.source_class}`);
    byId.set(r.source_id, { source_id: r.source_id, source_class: r.source_class, description: r.description || "", rests_on: (r.rests_on || []).slice() });
  }
  return { byId, classes: SOURCE_CLASSES.slice() };
}
export function sourceClass(table, id) {
  const r = table.byId.get(id);
  return r ? r.source_class : null;
}

export function makeKindTable(rows) {
  const byKind = new Map();
  for (const r of rows || []) {
    if (!r.kind) throw new Error("kind row missing kind");
    if (!isPosition(r.ceiling)) throw new Error(`kind ${r.kind}: bad ceiling ${r.ceiling}`);
    byKind.set(r.kind, { kind: r.kind, ceiling: r.ceiling, compatibility_rule_id: r.compatibility_rule_id || null });
  }
  return { byKind };
}
export function ceilingFor(kindTable, kind) {
  const r = kindTable.byKind.get(kind);
  if (!r) return null;
  return { position: r.ceiling, mode: modeOf(r.ceiling) };
}

// the reflexive-transitive closure of a set of source ids over `rests_on`. A cycle is naturally
// absorbed (every member is reachable from every other), which is the one-source-per-SCC reading:
// the footprint is never smaller than the truth, so an intersection can only over-count shared-ness,
// which is the conservative direction the coverage note names.
export function footprintClosure(table, sourceIds) {
  const out = new Set();
  const stack = [...(sourceIds || [])];
  while (stack.length) {
    const id = stack.pop();
    if (out.has(id)) continue;
    out.add(id);
    const row = table.byId.get(id);
    for (const dep of (row && row.rests_on) || []) if (!out.has(dep)) stack.push(dep);
  }
  return out;
}
