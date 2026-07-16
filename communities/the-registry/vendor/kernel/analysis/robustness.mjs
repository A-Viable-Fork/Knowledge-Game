// Role: the robustness reading over the support graph (intake data model v3). Grounding says how high
//   a claim reaches; robustness says how much survives the loss of one support (a single point of
//   failure is a support-closure claim whose removal lowers the earned grade; robustness is the grade
//   after the worst single removal). A distinct reading runs over the depends-on closure, where a
//   single point of failure breaks well-formedness rather than lowering the grade; a third, over the
//   undercut edges, lowers the confidence an attacked claim transmits without touching its grade.
// Contract: analyzeRobustness / analyzePresupposition / analyzeUndercuts (graph, targetId) -> reading.
//   graph = { entries:[claim], links:[link], tables:{sourceTable, kindTable} }. Pure, deterministic
//   (sorted, byte-identical re-run); ESM, kernel imports only kernel; mutates nothing.
// Invariant: HONEST BOUND. Disjoint dependence WITHIN the graph certifies STRUCTURAL independence,
//   not true independence: two claims can be correlated through a common cause that is not a node in
//   the graph, and this analysis cannot see it. The remedy is the operation that exposes it, reifying
//   the suspected common cause as a node both paths depend on, after which the analysis finds it as a
//   shared point of failure. The reading is as good as the graph is complete and improves as more is
//   represented; it reports structural fragility and never claims to certify true independence.
"use strict";
import { earnedGrade } from "../grounding/earned-grade.mjs";
import { POSITIONS, COLLAPSED, collapse, collapsedRank } from "../schema/confidence.mjs";
import { ceilingFor, footprintClosure } from "../schema/tables.mjs";

// a total order on positions for "lower" and "minimum": collapsed rank first, then, within the
// settled empirical axis, the finer empirical rank. Unknown positions sort below everything.
function totalRank(pos) {
  const p = POSITIONS[pos];
  return p ? p.collapsedRank * 10 + (p.empiricalRank || 0) : -1;
}
const isLower = (a, b) => totalRank(a) < totalRank(b);
const minPos = (a, b) => (totalRank(a) <= totalRank(b) ? a : b);
const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// index the graph once: claims by identity, supports and depends-on links grouped by their target.
function indexGraph(graph) {
  const entriesById = new Map((graph.entries || []).map((e) => [e.identity, e]));
  const supportsInto = new Map();
  const dependsInto = new Map();
  for (const l of graph.links || []) {
    const bucket = l.link_kind === "supports" ? supportsInto : l.link_kind === "depends-on" ? dependsInto : null;
    if (!bucket) continue;
    if (!bucket.has(l.to_identity)) bucket.set(l.to_identity, []);
    bucket.get(l.to_identity).push(l);
  }
  return { entriesById, supportsInto, dependsInto, sourceTable: graph.tables.sourceTable, kindTable: graph.tables.kindTable };
}

// the earned grade of every claim, derived over the support links, with `removed` claims treated as
// not in force (a removed claim delivers ungraded up its links). Returns the target's full earned
// object { earned, mode, S, B }. One fresh memo per call, so each removal is a clean re-derivation.
function computeEarned(idx, targetId, removed) {
  const memo = new Map();
  const active = new Set(); // cycle guard: a claim on the current path delivers asserted, not a loop
  function eg(id) {
    if (removed.has(id)) return { earned: "ungraded" };
    if (memo.has(id)) return memo.get(id);
    if (active.has(id)) return { earned: "asserted" };
    active.add(id);
    const entry = idx.entriesById.get(id);
    if (!entry) { active.delete(id); const r = { earned: "ungraded" }; memo.set(id, r); return r; }
    const supports = (idx.supportsInto.get(id) || []).map((l) => ({
      group: l.support_group,
      linkGrade: l.declared_grade,
      supportEarned: eg(l.from_identity).earned,
      footprint: footprintClosure(idx.sourceTable, [l.source_id]),
      linkIdentity: l.identity,
    }));
    const ceil = ceilingFor(idx.kindTable, entry.kind);
    const r = earnedGrade({
      ceiling: ceil ? ceil.position : "asserted",
      constitutive: !!(ceil && ceil.mode === "constitutive"),
      checkingRecords: entry.checking_records,
      supports,
    });
    active.delete(id);
    memo.set(id, r);
    return r;
  }
  return eg(targetId);
}

// every claim reachable from `startId` by following supports links downward (to -> from). `include`
// controls whether startId itself is in the result.
function supportClosure(idx, startId, include) {
  const seen = new Set(), out = [];
  const stack = [startId];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    if (id !== startId || include) out.push(id);
    for (const l of idx.supportsInto.get(id) || []) if (!seen.has(l.from_identity)) stack.push(l.from_identity);
  }
  return out;
}

// the analysis over the support graph: grade, robustness, fragility, single points of failure, and
// the correlated-evidence flag. Robustness is the minimum re-derived grade over each single removal
// from the support closure; the definition is re-derivation, exactly as a support falling out.
export function analyzeRobustness(graph, targetId) {
  const idx = indexGraph(graph);
  const grade = computeEarned(idx, targetId, new Set()).earned;
  const closure = supportClosure(idx, targetId, false).sort(byId);

  let robustness = grade;
  const spofs = [];
  for (const c of closure) {
    const e = computeEarned(idx, targetId, new Set([c])).earned;
    if (isLower(e, grade)) spofs.push({ identity: c, lowered_to: e });
    robustness = minPos(robustness, e);
  }
  const fragile = isLower(robustness, grade);
  // the worst single removal, tie-broken by identity, for a concrete "this is the weak point".
  let worst = null;
  for (const s of spofs) if (!worst || isLower(s.lowered_to, worst.lowered_to) || (s.lowered_to === worst.lowered_to && s.identity < worst.identity)) worst = s;

  // the target's direct support groups, and the support closure reachable through each group. A claim
  // in two or more group closures sits across the apparent redundancy.
  const directGroups = new Map();
  for (const l of idx.supportsInto.get(targetId) || []) {
    const g = l.support_group == null ? "g:" + l.from_identity : l.support_group;
    if (!directGroups.has(g)) directGroups.set(g, new Set());
    for (const id of supportClosure(idx, l.from_identity, true)) directGroups.get(g).add(id);
  }
  const groups = [...directGroups.keys()].sort(byId);
  const groupsContaining = (id) => groups.filter((g) => directGroups.get(g).has(id));

  // the correlated-evidence flag: apparent redundancy (>= 2 groups) whose robustness still falls
  // because one claim sits across the groups. Name every such shared point of failure.
  let correlated = null;
  if (groups.length >= 2 && spofs.length) {
    const shared = spofs.filter((s) => groupsContaining(s.identity).length >= 2).map((s) => s.identity).sort(byId);
    if (shared.length) correlated = { shared_points: shared, group_count: groups.length };
  }

  return {
    reading: "robustness",
    target: targetId,
    grade,
    robustness,
    fragility: { grade, robustness, empty: !fragile },
    single_points_of_failure: spofs.slice().sort((a, b) => byId(a.identity, b.identity)),
    worst_removal: worst,
    group_count: groups.length,
    correlated_evidence_flag: correlated,
    support_closure: closure,
  };
}

// claims reachable from the target by following depends-on links (to -> from), with the direct
// dependents that reach each one, so a claim reached by two or more paths is a shared presupposition.
function presuppositionReach(idx, targetId) {
  const reachedVia = new Map(); // presupposed id -> Set of the target's direct depends-on claims it sits under
  const directs = (idx.dependsInto.get(targetId) || []).map((l) => l.from_identity);
  for (const d of directs) {
    for (const id of supportClosureViaDepends(idx, d)) {
      if (!reachedVia.has(id)) reachedVia.set(id, new Set());
      reachedVia.get(id).add(d);
    }
  }
  return reachedVia;
}
// every claim reachable from startId by depends-on links, including startId.
function supportClosureViaDepends(idx, startId) {
  const seen = new Set(), out = [];
  const stack = [startId];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id); out.push(id);
    for (const l of idx.dependsInto.get(id) || []) if (!seen.has(l.from_identity)) stack.push(l.from_identity);
  }
  return out;
}

// the analysis over the depends-on graph, kept separate from the grounding reading as the routing
// table keeps the two link kinds separate. A single point of well-formedness failure is a presupposed
// claim whose removal makes the target ill-formed (rather than merely lowering its grade); depends-on
// does not deliver into the grade, so this fragility is distinct from the robustness fragility.
export function analyzePresupposition(graph, targetId) {
  const idx = indexGraph(graph);
  const reachedVia = presuppositionReach(idx, targetId);
  const closure = [...reachedVia.keys()].sort(byId);
  // removing any presupposed claim breaks the frame: each is a single point of well-formedness
  // failure. A claim reached through two or more direct paths is a shared presupposition.
  const spofs = closure.map((id) => ({ identity: id, shared: reachedVia.get(id).size >= 2 }));
  const shared = spofs.filter((s) => s.shared).map((s) => s.identity);
  return {
    reading: "presupposition",
    target: targetId,
    well_formed: true, // well-formed as given: every presupposed claim is present in the graph
    presupposition_closure: closure,
    single_points_of_wellformedness_failure: spofs,
    shared_presuppositions: shared,
  };
}

// one step down the collapsed line, floored at asserted (a leg carrying live objections is qualified,
// never annihilated). settled positions collapse to the line first.
function down(pos) {
  const r = collapsedRank(pos);
  return COLLAPSED[Math.max(1, r - 1)];
}

// the undercut reading (edge taxonomy [1.5], built as a reading, not a grade-fold change). An undercut
// attacks a support edge's grounding rather than adding support: it enters no gate fold, so the target
// keeps the grounding grade its support earned, and this reading reports the CONFIDENCE that survives
// the attack. Each in-force undercut into the target lowers that confidence one step; the undercuts are
// listed with the link grade they carry (their discovery grade), most-attacked first. A target with no
// undercut carries confidence equal to its grade: the reading is empty, correctly, not a miss.
export function analyzeUndercuts(graph, targetId) {
  const idx = indexGraph(graph);
  const grade = collapse(computeEarned(idx, targetId, new Set()).earned);
  const ucs = (graph.links || [])
    .filter((l) => l.link_kind === "undercut" && l.to_identity === targetId && idx.entriesById.has(l.from_identity))
    .map((l) => ({ identity: l.from_identity, link_grade: l.declared_grade }))
    .sort((a, b) => byId(a.identity, b.identity));
  let confidence = grade;
  for (let i = 0; i < ucs.length; i++) confidence = down(confidence);
  return {
    reading: "undercut",
    target: targetId,
    grade,
    confidence_after_undercuts: confidence,
    lowered: collapsedRank(confidence) < collapsedRank(grade),
    undercuts: ucs,
  };
}
