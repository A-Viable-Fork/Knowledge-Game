// Role: the objective vector (spec Section 6). Eleven documented, deterministic scoring components
//   over the frozen claim records the provider already computed; a reader's objective is a weight per
//   component, and the feed order is the weighted composition. The zero vector is exactly the null
//   order (api/feed.js's orderFeed), used both as that case and as the tiebreak for equal weighted
//   scores, so a fully-specified but tied objective still resolves deterministically.
// Contract: COMPONENTS (the eleven, each {id, label, scoreOf(row, ctx) -> number in [0,1] or null});
//   orderByObjective(claims, weights, ctx) -> claims, each carrying `_objectiveContributions` (id ->
//   {label, weight, score, contribution, inert}) and `_objectiveTotal`, sorted by total descending,
//   the null order breaking ties. buildContext(claims, rawState, extra) -> ctx, the shared read-only
//   data every component scores against.
// Invariant: PURE. Every scoreOf reads only what buildContext derives from the provider's own frozen
//   records, links, and reads (reconciliations); it computes no grade, mutates nothing, and writes
//   nowhere. This module imports nothing that can write (no vault, no provider write surface, no
//   vendor module beyond the read-only lattice order feed.js already depends on); the import-graph
//   oracle and build/check-ranking-separation.mjs both verify this statically and empirically. A
//   component whose backing data does not exist (recent changes: no timestamp field anywhere in the
//   v3 record; validation-expertise match and followed topics: no expertise or follow data this
//   phase) returns null, never an invented approximation, and null is rendered distinctly from a real
//   zero so a reader is never told a component voted against a card when it never voted at all.
// Governs: claim-1: this module computes only reordering, never a grade, receipt, robustness figure,
//   or support structure; build/check-ranking-separation.mjs fuzzes arbitrary weight vectors and
//   asserts every one of those fields byte-identical before and after.
// Governs: claim-2: orderByObjective attaches `_objectiveContributions` and `_objectiveTotal` to every
//   row, so the panel that renders the active objective (periphery/objective-panel.js) always has the
//   real per-component data to show, never a description standing in for the actual computation.
"use strict";
import { POSITIONS } from "../vendor/kernel/schema/confidence.mjs";
import { orderFeed } from "./feed.js";

function rankOf(grade) {
  const p = POSITIONS[grade];
  return p ? p.collapsedRank : -1;
}
function normalize01(value, max) {
  if (!max || max <= 0) return 0;
  return Math.max(0, Math.min(1, value / max));
}
function supportsInto(ctx, identity) {
  return (ctx.linksByTarget.get(identity) || []).filter((l) => l.link_kind === "supports");
}
function supportsFrom(ctx, identity) {
  return (ctx.linksByFrom.get(identity) || []).filter((l) => l.link_kind === "supports");
}
function contradictions(ctx, identity) {
  return (ctx.linksByTarget.get(identity) || []).filter((l) => l.link_kind === "contradicts")
    .concat((ctx.linksByFrom.get(identity) || []).filter((l) => l.link_kind === "contradicts"));
}

export const COMPONENTS = [
  {
    id: "learn-efficiently",
    label: "Learn efficiently: many other claims rest on this one",
    scoreOf(row, ctx) { return normalize01(supportsFrom(ctx, row.identity).length, ctx.maxDependents); },
  },
  {
    id: "unresolved-cruxes",
    label: "Unresolved cruxes: this claim is a side of an open disagreement",
    scoreOf(row, ctx) {
      return ctx.reconciliations.some((r) => r.side_a.identity === row.identity || r.side_b.identity === row.identity) ? 1 : 0;
    },
  },
  {
    id: "weak-but-influential",
    label: "Weak but influential: many things rest on a claim with a low grade",
    scoreOf(row, ctx) {
      const weakness = 1 - normalize01(rankOf(row.earned_grade), 4);
      return normalize01(supportsFrom(ctx, row.identity).length, ctx.maxDependents) * weakness;
    },
  },
  {
    id: "strongest-opposition",
    label: "Strongest opposition: the best-grounded side of a contradiction",
    scoreOf(row, ctx) {
      if (!contradictions(ctx, row.identity).length) return 0;
      return normalize01(rankOf(row.earned_grade), 4);
    },
  },
  {
    id: "neglected",
    label: "Neglected: few supports, checking records, or dependents",
    scoreOf(row, ctx) {
      const attention = supportsFrom(ctx, row.identity).length + supportsInto(ctx, row.identity).length
        + (ctx.checkingRecordCountByIdentity.get(row.identity) || 0);
      return 1 - normalize01(attention, ctx.maxAttention);
    },
  },
  {
    id: "recent-changes",
    label: "Recent changes: inert, no timestamp or change-log field exists in the v3 claim record (see trellis/sorry-ledger.md SK-20)",
    alwaysInert: true,
    scoreOf() { return null; },
  },
  {
    id: "breadth",
    label: "Breadth: rarer kinds in the current set score higher",
    scoreOf(row, ctx) { return normalize01(1, ctx.kindCounts.get(row.kind) || 1); },
  },
  {
    id: "novelty",
    label: "Novelty: a source no other surfaced claim cites",
    scoreOf(row, ctx) { return normalize01(1, ctx.sourceCounts.get(row.source_id) || 1); },
  },
  {
    id: "validation-expertise-match",
    label: "Validation-expertise match: inert, no declared-expertise data exists in the vault yet",
    alwaysInert: true,
    scoreOf() { return null; },
  },
  {
    id: "followed-topics",
    label: "Followed topics: inert, no follow data exists yet",
    alwaysInert: true,
    scoreOf() { return null; },
  },
  {
    id: "engagement-sufficient-to-continue",
    label: "Engagement: inert while observation is off; a light nudge from opt-in dwell and expand history when on",
    inertWhileObservationOff: true,
    scoreOf(row, ctx) {
      if (!ctx.observation || !ctx.observation.enabled) return null;
      const log = ctx.observation.log || [];
      if (!log.length) return 0;
      const engagedKinds = new Set(log.map((e) => e.kind).filter(Boolean));
      return engagedKinds.has(row.kind) ? 1 : 0;
    },
  },
];

// the shared read-only context every component scores against, derived once from the provider's own
// frozen records and reads; nothing here is mutated after construction.
export function buildContext(claims, rawState, extra) {
  const linksByTarget = new Map();
  const linksByFrom = new Map();
  for (const l of (rawState && rawState.links) || []) {
    if (!linksByTarget.has(l.to_identity)) linksByTarget.set(l.to_identity, []);
    linksByTarget.get(l.to_identity).push(l);
    if (!linksByFrom.has(l.from_identity)) linksByFrom.set(l.from_identity, []);
    linksByFrom.get(l.from_identity).push(l);
  }
  const checkingRecordCountByIdentity = new Map(
    ((rawState && rawState.entries) || []).map((e) => [e.identity, (e.checking_records || []).length])
  );
  const kindCounts = new Map();
  const sourceCounts = new Map();
  for (const row of claims) {
    kindCounts.set(row.kind, (kindCounts.get(row.kind) || 0) + 1);
    sourceCounts.set(row.source_id, (sourceCounts.get(row.source_id) || 0) + 1);
  }
  const dependentsCounts = claims.map((row) => supportsFromMap(linksByFrom, row.identity));
  const attentionCounts = claims.map((row) =>
    supportsFromMap(linksByFrom, row.identity) + supportsFromMap(linksByTarget, row.identity)
    + (checkingRecordCountByIdentity.get(row.identity) || 0)
  );
  return {
    linksByTarget, linksByFrom, checkingRecordCountByIdentity, kindCounts, sourceCounts,
    maxDependents: Math.max(1, ...dependentsCounts),
    maxAttention: Math.max(1, ...attentionCounts),
    reconciliations: (extra && extra.reconciliations) || [],
    observation: (extra && extra.observation) || null,
    expertise: (extra && extra.expertise) || null,
    follows: (extra && extra.follows) || null,
  };
}
function supportsFromMap(map, identity) {
  return (map.get(identity) || []).filter((l) => l.link_kind === "supports").length;
}

function contributionsFor(row, weights, ctx, zeroVector) {
  const out = {};
  for (const c of COMPONENTS) {
    const weight = weights[c.id] || 0;
    const score = zeroVector ? null : c.scoreOf(row, ctx);
    out[c.id] = { label: c.label, weight, score, inert: score === null, contribution: score === null ? 0 : weight * score };
  }
  return out;
}

// orderByObjective: the weighted composition. The zero vector (every weight 0, including the
// default fresh-profile vector) is exactly the null order; every component reports honestly inert
// in that case too, since no component was actually consulted.
export function orderByObjective(claims, weights, rawState, extra) {
  const w = weights || {};
  const anyNonzero = COMPONENTS.some((c) => (w[c.id] || 0) !== 0);
  if (!anyNonzero) {
    return orderFeed(claims).map((row) => ({ ...row, _objectiveContributions: contributionsFor(row, w, null, true), _objectiveTotal: 0 }));
  }
  const ctx = buildContext(claims, rawState, extra);
  const scored = claims.map((row) => {
    const contributions = contributionsFor(row, w, ctx, false);
    const total = Object.values(contributions).reduce((sum, c) => sum + c.contribution, 0);
    return { row, total, contributions };
  });
  scored.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    const nullPair = orderFeed([a.row, b.row]);
    return nullPair[0].identity === a.row.identity ? -1 : 1;
  });
  return scored.map((s) => ({ ...s.row, _objectiveContributions: s.contributions, _objectiveTotal: s.total }));
}

// the why-answer for one card: which components actually contributed, in contribution order, plus
// the ones requested (nonzero weight) but inert for lack of data, stated plainly rather than omitted.
export function explainPosition(row, position) {
  const contributions = row._objectiveContributions || {};
  const active = Object.entries(contributions).filter(([, c]) => c.weight !== 0);
  if (!active.length) return `null order: grounding, then recency, position ${position}`;
  const contributing = active.filter(([, c]) => !c.inert).sort((a, b) => b[1].contribution - a[1].contribution);
  const inertButRequested = active.filter(([, c]) => c.inert);
  const parts = contributing.map(([id, c]) => `${id} (+${c.contribution.toFixed(2)})`);
  let text = parts.length ? `position ${position}: ${parts.join(", ")}` : `position ${position}: no requested component could score this card`;
  if (inertButRequested.length) {
    text += `; requested but inert: ${inertButRequested.map(([id]) => id).join(", ")}`;
  }
  return text;
}
