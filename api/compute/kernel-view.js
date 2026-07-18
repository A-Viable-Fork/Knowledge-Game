// Role: builds the algebra kernel shape (vendor/kernel/composition/algebra.mjs's own K object) from a
//   community's raw snapshot (KG-GRAPH Step 3). algebra.recompute-grade and graph.project both consume
//   { kernel, ... }, a normalized store, not the bare { entries, links } shape community.raw.state
//   already exposes to periphery. Building that normalization needs the vendored asKernel plus the
//   source and kind tables, kernel-internal helpers periphery cannot import directly (periphery
//   reaches vendor only through api/); this module is that one api/-side seam, wrapping the vendored
//   functions by reference, never reimplementing them.
// Contract: kernelViewOf(raw) -> the K object vendor/kernel/composition/algebra.mjs's own operations
//   expect (store_id, state, tables, native, grades), built from raw.state/raw.sources/raw.kinds (the
//   same fields vendor/api/providers/local-provider.mjs itself reads to build its own tables).
// Invariant: pure, no grounding computed here beyond what asKernel already does (a recompute-by-
//   construction over the raw state, per algebra.mjs's own gradesByRecompute). Read-only; this module
//   proposes nothing and mutates no input.
"use strict";
import { asKernel } from "../../vendor/kernel/composition/algebra.mjs";
import { makeSourceTable, makeKindTable } from "../../vendor/kernel/schema/tables.mjs";

export function kernelViewOf(raw) {
  const kindTable = makeKindTable(raw.kinds);
  const sourceTable = makeSourceTable(raw.sources);
  return asKernel({ store_id: raw.kernel_id || "community", state: raw.state, tables: { sourceTable, kindTable } });
}
