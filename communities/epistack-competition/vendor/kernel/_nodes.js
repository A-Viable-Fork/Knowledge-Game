// Role: the kernel node manifest for the typed repository map (build/repo-map.schema.js).
// Contract: exports an array of node records { path, type, group, flows? }; role and
//   contract are derived from each module's head comment by build/check-map.mjs.
// Invariant: pure data. One record per module; adding a module adds a record here.
"use strict";

module.exports = [
  {
    "path": "kernel/analysis/gaps.js",
    "type": "kernel",
    "group": "analysis",
    "flows": [
      {
        "type": "checked-by",
        "to": "build/check-gaps.mjs"
      }
    ]
  },
  {
    "path": "kernel/analysis/characterized-gaps.mjs",
    "type": "kernel",
    "group": "analysis"
  },
  {
    "path": "kernel/analysis/robustness.mjs",
    "type": "kernel",
    "group": "analysis"
  },
  {
    "path": "kernel/analysis/reconciliation.mjs",
    "type": "kernel",
    "group": "analysis",
    "flows": [
      {
        "type": "checked-by",
        "to": "build/check-reconcile.mjs"
      }
    ]
  },
  {
    "path": "kernel/composition/records.mjs",
    "type": "kernel",
    "group": "composition",
    "flows": [
      {
        "type": "checked-by",
        "to": "build/check-composition.mjs"
      }
    ]
  },
  {
    "path": "kernel/composition/transfer.mjs",
    "type": "kernel",
    "group": "composition",
    "flows": [
      {
        "type": "checked-by",
        "to": "build/check-composition.mjs"
      }
    ]
  },
  {
    "path": "kernel/composition/vocabulary.mjs",
    "type": "kernel",
    "group": "composition",
    "flows": [
      {
        "type": "checked-by",
        "to": "build/check-composition.mjs"
      }
    ]
  },
  {
    "path": "kernel/composition/framing.mjs",
    "type": "kernel",
    "group": "composition",
    "flows": [
      {
        "type": "checked-by",
        "to": "build/check-composition.mjs"
      }
    ]
  },
  {
    "path": "kernel/composition/notify.mjs",
    "type": "kernel",
    "group": "composition",
    "flows": [
      {
        "type": "checked-by",
        "to": "build/check-composition.mjs"
      }
    ]
  },
  {
    "path": "kernel/composition/profiles.mjs",
    "type": "kernel",
    "group": "composition",
    "flows": [
      {
        "type": "checked-by",
        "to": "build/check-composition.mjs"
      }
    ]
  },
  {
    "path": "kernel/composition/algebra.mjs",
    "type": "kernel",
    "group": "composition",
    "flows": [
      {
        "type": "checked-by",
        "to": "build/check-algebra.mjs"
      }
    ]
  },
  {
    "path": "kernel/gate/clean-json.js",
    "type": "kernel",
    "group": "gate"
  },
  {
    "path": "kernel/gate/gate.mjs",
    "type": "kernel",
    "group": "gate"
  },
  {
    "path": "kernel/gate/comment-guard.mjs",
    "type": "kernel",
    "group": "gate",
    "flows": [
      {
        "type": "checked-by",
        "to": "build/check-comment.mjs"
      }
    ]
  },
  {
    "path": "kernel/gate/immune.js",
    "type": "kernel",
    "group": "gate"
  },
  {
    "path": "kernel/gate/lifecycle.js",
    "type": "kernel",
    "group": "gate"
  },
  {
    "path": "kernel/gate/verify.mjs",
    "type": "kernel",
    "group": "gate"
  },
  {
    "path": "kernel/grounding/earned-grade.mjs",
    "type": "kernel",
    "group": "grounding"
  },
  {
    "path": "kernel/grounding/profile.js",
    "type": "kernel",
    "group": "grounding"
  },
  {
    "path": "kernel/grounding/resolve.js",
    "type": "kernel",
    "group": "grounding"
  },
  {
    "path": "kernel/motions/compare.js",
    "type": "kernel",
    "group": "motions"
  },
  {
    "path": "kernel/motions/decompose.js",
    "type": "kernel",
    "group": "motions"
  },
  {
    "path": "kernel/motions/perturb.js",
    "type": "kernel",
    "group": "motions",
    "flows": [
      {
        "type": "checked-by",
        "to": "build/check-perturb.mjs"
      }
    ]
  },
  {
    "path": "kernel/schema/canonical.mjs",
    "type": "kernel",
    "group": "schema"
  },
  {
    "path": "kernel/schema/confidence.mjs",
    "type": "kernel",
    "group": "schema"
  },
  {
    "path": "kernel/schema/edges.js",
    "type": "kernel",
    "group": "schema"
  },
  {
    "path": "kernel/schema/records.mjs",
    "type": "kernel",
    "group": "schema"
  },
  {
    "path": "kernel/schema/sha256.mjs",
    "type": "kernel",
    "group": "schema"
  },
  {
    "path": "kernel/schema/registers.js",
    "type": "kernel",
    "group": "schema"
  },
  {
    "path": "kernel/schema/registry.js",
    "type": "kernel",
    "group": "schema"
  },
  {
    "path": "kernel/schema/schema.js",
    "type": "kernel",
    "group": "schema"
  },
  {
    "path": "kernel/schema/type-hash.mjs",
    "type": "kernel",
    "group": "schema"
  },
  {
    "path": "kernel/schema/tables.mjs",
    "type": "kernel",
    "group": "schema"
  },
  {
    "path": "kernel/store/apply.mjs",
    "type": "kernel",
    "group": "store"
  },
  {
    "path": "kernel/store/decay.mjs",
    "type": "kernel",
    "group": "store"
  },
  {
    "path": "kernel/store/exclusion.js",
    "type": "kernel",
    "group": "store"
  },
  {
    "path": "kernel/store/graph.js",
    "type": "kernel",
    "group": "store"
  },
  {
    "path": "kernel/store/patch-ledger.js",
    "type": "kernel",
    "group": "store"
  },
  {
    "path": "kernel/store/state.mjs",
    "type": "kernel",
    "group": "store"
  }
];
