// Role: the transformation store (COMPUTE-1). A transformation is a named operation over a graph or
//   over values; this module fixes the entry shape every transformation carries and the register that
//   validates and runs them. The load-bearing field is not the formula, it is the assumptions
//   manifest: "multiply these factors" and "multiply these factors assuming independence" are
//   different entries even when the arithmetic is identical, because one declares the assumption and
//   one hides it. Both the manifest and the reversibility mark are required from the first entry, so
//   the second entry into this register is never a migration.
// Contract: validateTransform(entry) -> entry, throws on violation. makeRegister() -> { register(
//   entry), get(id), list(pack?), run(id, input) }. An entry is { id, pack, consumes, emits,
//   assumptions, reversibility, run }, per the shape below.
// Invariant: the split follows the fixed-invariant versus free-parameter line the kernel already
//   keeps. Graph and algebra transformations are canonical (kernel/composition/algebra.mjs, wrapped
//   by reference, never reimplemented here). Statistics transformations are plural and forkable, so a
//   statistics-pack entry never emits a kernel and never carries a grade on its output: a stat
//   produces a value, never standing, and landing its result as a claim is a separate typing act
//   through the gate (rung 2 of the extension ladder, docs/extending-the-kernel.md), not something a
//   transformation does. The register enforces this mechanically, at validation and at run time, so a
//   stat that assigns standing is refused rather than merely discouraged.
"use strict";

const PACKS = ["graph", "algebra", "statistics"];
const CONSUMES = ["kernel", "kernel-pair", "values"];
const EMITS = ["kernel", "value", "flag"];
const REVERSIBILITY = ["invertible", "lossy"];
const GRADE_FIELDS = ["grade", "declared_grade", "earned"];

function isNonEmptyString(v) {
  return typeof v === "string" && v.length > 0;
}

// validateTransform(entry): throws on any shape violation, naming the field. An empty assumptions
// manifest is a hard failure on its own, never a warning: a transformation that declares no
// assumptions is exactly the object this corpus condemns.
export function validateTransform(entry) {
  if (!entry || typeof entry !== "object") throw new Error("validateTransform: entry must be an object");
  if (!isNonEmptyString(entry.id)) throw new Error("validateTransform: id required, a non-empty string");
  if (!PACKS.includes(entry.pack)) throw new Error(`validateTransform: ${entry.id}: pack must be one of ${JSON.stringify(PACKS)}, got ${JSON.stringify(entry.pack)}`);
  if (!CONSUMES.includes(entry.consumes)) throw new Error(`validateTransform: ${entry.id}: consumes must be one of ${JSON.stringify(CONSUMES)}, got ${JSON.stringify(entry.consumes)}`);
  if (!EMITS.includes(entry.emits)) throw new Error(`validateTransform: ${entry.id}: emits must be one of ${JSON.stringify(EMITS)}, got ${JSON.stringify(entry.emits)}`);
  if (typeof entry.run !== "function") throw new Error(`validateTransform: ${entry.id}: run must be a function`);
  if (!REVERSIBILITY.includes(entry.reversibility)) throw new Error(`validateTransform: ${entry.id}: reversibility must be one of ${JSON.stringify(REVERSIBILITY)}, got ${JSON.stringify(entry.reversibility)}`);
  if (!Array.isArray(entry.assumptions) || entry.assumptions.length === 0)
    throw new Error(`validateTransform: ${entry.id}: assumptions must be a non-empty array; a transformation that declares no assumptions is refused, not merely flagged`);
  for (const a of entry.assumptions) {
    if (!a || !isNonEmptyString(a.id) || !isNonEmptyString(a.statement))
      throw new Error(`validateTransform: ${entry.id}: every assumption needs a non-empty id and statement, got ${JSON.stringify(a)}`);
  }
  // the no-standing rule at the shape level: a statistics transformation cannot return a kernel, and
  // it only ever consumes values (never a kernel or kernel-pair, which are graph-shaped inputs).
  if (entry.pack === "statistics") {
    if (entry.emits === "kernel") throw new Error(`validateTransform: ${entry.id}: a statistics transformation never emits "kernel" (a stat produces a value, never standing)`);
    if (entry.consumes !== "values") throw new Error(`validateTransform: ${entry.id}: a statistics transformation consumes "values" (got ${JSON.stringify(entry.consumes)})`);
  }
  return entry;
}

// the no-grade-assignment rule, checked at run time against a statistics entry's actual output: a
// stat's result carries no grade field under any of the names the kernel's grade concept goes by.
function assertNoGradeFields(id, output) {
  if (!output || typeof output !== "object") return;
  for (const field of GRADE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(output, field))
      throw new Error(`makeRegister: ${id}: a statistics transformation's output carries a "${field}" field; a stat produces a value, never standing, and this is the false-confidence move the corpus refuses mechanically`);
  }
}

export function makeRegister() {
  const byId = new Map();
  return {
    register(entry) {
      validateTransform(entry);
      byId.set(entry.id, entry);
      return entry;
    },
    get(id) {
      return byId.get(id);
    },
    list(pack) {
      const all = [...byId.values()];
      return pack ? all.filter((e) => e.pack === pack) : all;
    },
    run(id, input) {
      const entry = byId.get(id);
      if (!entry) throw new Error(`makeRegister.run: no transformation registered at id ${JSON.stringify(id)}`);
      const output = entry.run(input);
      if (entry.pack === "statistics") assertNoGradeFields(id, output);
      return output;
    },
  };
}
