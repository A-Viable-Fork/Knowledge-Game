// Role: KG's own forkable statistics pack (KG-COMPUTE). The vendored kernel default registry is
//   canonical-only (vendor/kernel/compute/registry.mjs: graph and algebra, wrapping the algebra by
//   reference), because there is no canonical aggregation; a statistics transformation is a contested
//   modeling choice, plural by nature, so it lives as this client's own store content, not shared
//   root. This pack is authored here, in KG's own tree, never imported from the epistack corpus
//   (upstream/epistack/corpora/compute/stats-pack.js): a fork of this app may ship a different
//   statistics pack, or none, and the kernel canonizes neither. That two packs happen to make the same
//   pedagogical point today (naive-multiply versus dependence-aware, disagreeing over one
//   shared-mechanism input) is not a reason to share the file; it is the same lesson landing twice,
//   independently, because the lesson is real.
// Contract: exports KG_STATS_PACK, an array of two entries conforming to the vendored transformation
//   shape (vendor/kernel/compute/transforms.mjs: id, pack, consumes, emits, reversibility,
//   assumptions, run). Both entries pass the vendored validateTransform unmodified.
// Invariant: neither entry ever emits "kernel" or attaches a grade field to its output; each carries
//   a non-empty assumptions manifest, checked at registration by the shared-root validator, not by
//   client courtesy. The demo input these entries are exercised over (periphery/compute-screen.js) is
//   illustrative and labeled as such: the numbers stand in for a debate's shared-mechanism factors,
//   not a corpus-anchored value: only the disagreement itself is under demonstration.
"use strict";

export const KG_STATS_PACK = [
  {
    id: "statistics.naive-multiply",
    pack: "statistics",
    consumes: "values",
    emits: "value",
    reversibility: "lossy",
    assumptions: [
      { id: "independence", statement: "the factors are treated as conditionally independent and multiplied" },
    ],
    // input: an array of numeric factors. Multiplies them unconditionally, the compounding move a
    // dependence-aware read of the same factors refuses when they share a mechanism.
    run: (factors) => {
      const product = (factors || []).reduce((acc, f) => acc * f, 1);
      return { value: product, manifest: KG_STATS_PACK[0].assumptions };
    },
  },
  {
    id: "statistics.dependence-aware",
    pack: "statistics",
    consumes: "values",
    emits: "flag",
    reversibility: "lossy",
    assumptions: [
      { id: "declared-dependence", statement: "factors sharing a mechanism group are not compounded; undeclared independence is refused, not assumed" },
    ],
    // input: an array of { factor, mechanism }. Refuses to compound two or more factors that declare
    // the same mechanism, naming it; otherwise multiplies the factors, exactly as naive-multiply would,
    // since nothing here objects to compounding factors that are genuinely independent.
    run: (entries) => {
      const manifest = KG_STATS_PACK[1].assumptions;
      const byMechanism = new Map();
      for (const e of entries || []) {
        if (!byMechanism.has(e.mechanism)) byMechanism.set(e.mechanism, []);
        byMechanism.get(e.mechanism).push(e.factor);
      }
      for (const [mechanism, factors] of byMechanism) {
        if (factors.length >= 2) {
          return { flag: "refused", reason: `factors ${JSON.stringify(factors)} share the declared mechanism "${mechanism}", not compounded as independent`, manifest };
        }
      }
      const product = (entries || []).reduce((acc, e) => acc * e.factor, 1);
      return { value: product, manifest };
    },
  },
];
