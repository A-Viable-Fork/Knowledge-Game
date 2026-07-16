// Role: the characterized-gap reading (Prompt 18). A characterized gap is the honest unit of
//   progress made first-class: a claim in the open line whose ceiling is a floor, held at the grade
//   its support delivers, carrying a closing condition that names the one measurement, proof, or
//   direct study that would ground it. It is not a new mode; it is an ordinary open-line claim with
//   a floor ceiling (a real debt) plus the sorry as a first-class field. This reading lists them as
//   their own category and distinguishes three claims that look similar at low grade: a characterized
//   gap (a debt with its closing condition), a bare assertion (low, nothing owed named), and a
//   settled claim (at its ceiling, nothing owed).
// Contract: characterizedGaps(graph) -> [gap]; characterization(graph, identity) -> one of
//   "characterized-gap" | "bare-assertion" | "settled" | "unknown". graph = { entries, links,
//   tables:{sourceTable, kindTable} }. Pure, deterministic; ESM, kernel imports only kernel.
// Invariant: the transfer that carries a leap is an ordinary `supports` edge, not a new edge kind;
//   its grade caps the claim through the existing contamination path (earned-grade), so a weak
//   transfer earns a low open grade, which is correct. This reading computes no grade; it reads the
//   derived earned grade and the kind ceiling, and reports the debt.
"use strict";
import { tierOf, collapsedRank } from "../schema/confidence.mjs";
import { ceilingFor } from "../schema/tables.mjs";
import { derivedGrade } from "../store/decay.mjs";

const byId = (a, b) => (a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0);
// a floor is a settled-tier position (a measurement/proof/declaration floor); the open line is below.
const ceilingIsFloor = (pos) => tierOf(pos) === "settled";

// the earned grade of a claim over the graph, read as decay reads it over a store state (a graph is
// a store with no withdrawn/supersession records, so every claim is in force).
function earnedOf(graph, identity, cache) {
  return derivedGrade({ entries: graph.entries, links: graph.links }, identity, graph.tables, cache);
}

// the three-way distinction for a single claim.
export function characterization(graph, identity) {
  const e = (graph.entries || []).find((x) => x.identity === identity);
  if (!e) return "unknown";
  const ceil = ceilingFor(graph.tables.kindTable, e.kind);
  if (!ceil) return "unknown";
  const earned = earnedOf(graph, identity, new Map());
  // at (or above) the ceiling: the claim is as settled as its kind allows and owes nothing. This is
  // the settled forum claim at its structured-forum ceiling, and equally a floor claim at its floor.
  if (collapsedRank(earned) >= collapsedRank(ceil.position)) return "settled";
  // below the ceiling with a closing condition on a floor-ceiling (empirical) claim: a real debt,
  // characterized. The closing condition is what separates an honest leap from an unsupported claim.
  if (e.closing_condition && ceilingIsFloor(ceil.position)) return "characterized-gap";
  // below the ceiling with nothing owed named: a bare assertion.
  return "bare-assertion";
}

// every characterized gap in the graph, each with its closing condition and its transfer source(s):
// the `supports` edges it provisionally rests on, whose grade caps it.
export function characterizedGaps(graph) {
  const cache = new Map();
  const out = [];
  for (const e of graph.entries || []) {
    const ceil = ceilingFor(graph.tables.kindTable, e.kind);
    if (!ceil || !ceilingIsFloor(ceil.position)) continue; // must have a floor ceiling to owe a floor
    if (!e.closing_condition) continue;                     // must name what would close it
    const earned = earnedOf(graph, e.identity, cache);
    if (collapsedRank(earned) >= collapsedRank(ceil.position)) continue; // already at the floor: no debt
    const transfers = (graph.links || [])
      .filter((l) => l.link_kind === "supports" && l.to_identity === e.identity)
      .map((l) => ({ from_identity: l.from_identity, transfer_grade: l.declared_grade, source_id: l.source_id }))
      .sort((a, b) => (a.from_identity < b.from_identity ? -1 : a.from_identity > b.from_identity ? 1 : 0));
    out.push({
      category: "characterized-gap",
      identity: e.identity,
      statement: e.statement,
      kind: e.kind,
      ceiling: ceil.position,        // the floor it owes
      earned_grade: earned,          // the open-line grade its transfer delivers
      closing_condition: e.closing_condition, // the one thing that would ground it
      transfer_sources: transfers,   // the supports edges it provisionally rests on
    });
  }
  return out.sort(byId);
}
