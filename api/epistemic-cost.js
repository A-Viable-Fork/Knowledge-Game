// Role: the epistemic-cost report (spec Section 6). Recomputes the active feed's surfaced claims
//   against another available community's pinned type table and reports the honest structure: how
//   many claims share a type (kind bundle hash) with the other community and recompute there, and
//   how many arrive untyped because no hash is shared. This is the crossing (composition-spec.md, the
//   untyped type and the content-addressed crossing) rendered as a ranking feature, not a new rule.
// Contract: epistemicCost(surfacedRows, activeRaw, otherRaw) -> { recompute: [{identity, before,
//   after}], lowered: [...], untyped: [identity...], summary: string }. `surfacedRows` are the top-N
//   ordered rows to report on; `activeRaw`/`otherRaw` are the two communities' parsed snapshots.
// Invariant: a claim "recomputes" only when its kind's bundle hash under the active community's kind
//   table equals the bundle hash of a same-named kind in the other community's table (shared meaning
//   is shared hash, composition-spec.md); the recomputed grade is then the real gate's own derivation
//   under the other community's tables, never invented. A claim whose kind is not hash-shared arrives
//   untyped and is reported at "ungraded", the protocol's own stated floor for the untyped type
//   (docs/composition-spec.md: "the untyped type grounds nothing"), overriding what the vendored
//   derivedGrade would otherwise default an unrecognized kind to (it falls back to an "asserted"
//   ceiling for convenience inside a single corpus, a default this report does not inherit, since a
//   foreign kind crossing a real community boundary is not the same case as an in-corpus omission).
"use strict";
import { hashTypeBundle } from "../vendor/kernel/schema/type-hash.mjs";
import { makeSourceTable, makeKindTable } from "../vendor/kernel/schema/tables.mjs";
import { storeViewOf } from "../vendor/kernel/store/decay.mjs";

function bundleHash(kindRow) {
  return hashTypeBundle({ kind: kindRow.kind, ceiling: kindRow.ceiling, compatibility_rule_id: kindRow.compatibility_rule_id || null, atlas_refs: [] });
}

export function epistemicCost(surfacedRows, activeRaw, otherRaw) {
  const activeKindByName = new Map((activeRaw.kinds || []).map((k) => [k.kind, k]));
  const otherKindByName = new Map((otherRaw.kinds || []).map((k) => [k.kind, k]));

  const sharedKindNames = new Set();
  for (const [name, activeRow] of activeKindByName) {
    const otherRow = otherKindByName.get(name);
    if (otherRow && bundleHash(activeRow) === bundleHash(otherRow)) sharedKindNames.add(name);
  }

  const otherTables = { sourceTable: makeSourceTable(otherRaw.sources), kindTable: makeKindTable(otherRaw.kinds) };
  const otherView = storeViewOf(activeRaw.state, otherTables);

  const recompute = [];
  const untyped = [];
  for (const row of surfacedRows) {
    if (sharedKindNames.has(row.kind)) {
      const derived = otherView.earnedByIdentity.get(row.identity);
      const after = derived ? derived.earned : "ungraded";
      recompute.push({ identity: row.identity, kind: row.kind, before: row.earned_grade, after });
    } else {
      untyped.push({ identity: row.identity, kind: row.kind, before: row.earned_grade, after: "ungraded" });
    }
  }

  const rankOrder = ["ungraded", "asserted", "supported", "corroborated", "checked", "independently-rechecked", "constitutive"];
  const rankIndex = (g) => rankOrder.indexOf(g);
  const lowered = recompute.filter((r) => rankIndex(r.after) < rankIndex(r.before));

  return { recompute, lowered, untyped, sharedKindNames: [...sharedKindNames] };
}

// the copy pattern from spec Section 6, rendered from the report's own numbers, never hand-tuned.
export function epistemicCostSummary(otherLabel, report, surfacedCount) {
  const recomputeCount = report.recompute.length;
  const loweredCount = report.lowered.length;
  const untypedCount = report.untyped.length;
  const loweredNote = loweredCount ? ` (${loweredCount} lower)` : "";
  return `Under ${otherLabel}: ${recomputeCount} of your top ${surfacedCount} recompute${loweredNote}, ${untypedCount} arrive untyped.`;
}
