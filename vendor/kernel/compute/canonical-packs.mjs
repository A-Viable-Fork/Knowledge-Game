// Role: the canonical graph and algebra packs (COMPUTE-1). Graph and algebra transformations are
//   canonical: they already exist as kernel operations in kernel/composition/algebra.mjs under the
//   governing law (every operation returns a kernel, and none assigns a grade above what
//   recomputation confirms). This module wraps compose, project, diff, and recomputeGrade as
//   transformation entries, by reference, so the register has one shared description of what each
//   operation does and what it assumes; it never reimplements the algebra.
// Contract: exports CANONICAL_ENTRIES, an array of transformation entries ready for
//   register(entry) (kernel/compute/transforms.mjs). registerCanonicalPacks(registry) calls
//   registry.register(entry) for each of them.
// Invariant: kernel/composition/algebra.mjs is imported, never edited. Each entry's run calls the
//   imported function directly; the assumptions manifest documents what the wrapped operation already
//   guarantees structurally, it does not add a new rule the algebra does not already enforce.
"use strict";
import { compose, project, diff, recomputeGrade } from "../composition/algebra.mjs";

export const CANONICAL_ENTRIES = [
  {
    id: "graph.compose",
    pack: "graph",
    consumes: "kernel-pair",
    emits: "kernel",
    reversibility: "lossy",
    assumptions: [
      { id: "crossing-floors-b", statement: "every claim B contributes crosses into A untyped, at the ungraded floor, and grounds nothing until a local fork types it" },
    ],
    run: ({ a, b }) => compose(a, b),
  },
  {
    id: "graph.project",
    pack: "graph",
    consumes: "kernel",
    emits: "kernel",
    reversibility: "lossy",
    assumptions: [
      { id: "recompute-never-lift", statement: "grades are recomputed over the restricted subgraph and can only fall, never rise: a restriction never lifts a grade the wider kernel held" },
    ],
    run: ({ kernel, predicate }) => project(kernel, predicate),
  },
  {
    id: "graph.diff",
    pack: "graph",
    consumes: "kernel-pair",
    emits: "kernel",
    reversibility: "invertible",
    assumptions: [
      { id: "shared-claim-skeleton", statement: "the difference is read over the claim identities the two kernels share; a claim present in only one is reported as such, never synthesized into the other" },
    ],
    run: ({ a, b }) => diff(a, b),
  },
  {
    id: "algebra.recompute-grade",
    pack: "algebra",
    consumes: "kernel",
    emits: "value",
    reversibility: "invertible",
    assumptions: [
      { id: "confidence-lattice", statement: "the recomputed position is derived in the v3 confidence order (kernel/schema/confidence.mjs); it is read off the kernel's own structure, never asserted" },
    ],
    run: ({ kernel, id }) => recomputeGrade(kernel, id),
  },
];

export function registerCanonicalPacks(registry) {
  for (const entry of CANONICAL_ENTRIES) registry.register(entry);
}
