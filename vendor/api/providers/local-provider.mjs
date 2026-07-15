// Role: the local provider behind the propose/read contract (Prompt 10). Runs the REAL v3 gate over
//   a frozen snapshot of the migrated corpus, in-process: propose builds the judge's claim and its
//   supports, runs `decide` against the snapshot store view, and returns the full receipt; read walks
//   the snapshot and returns claims with their derived grounding. This is the ONE API-layer module
//   that touches the kernel; a remote provider satisfies the same contract touching no kernel module.
// Contract: createLocalProvider(snapshot) -> { kind, propose(proposedClaim) -> receipt, read(query)
//   -> [claim] }. snapshot = { state, sources, kinds }. ESM; api imports kernel (never the reverse).
// Invariant: the gate is the real one, not a mock; no grounding step is re-implemented here. The
//   provider computes no grade, price, or refusal, it asks `decide` and reports what comes back.
"use strict";
import { decide } from "../../kernel/gate/gate.mjs";
import { claimRecord, linkRecord } from "../../kernel/schema/records.mjs";
import { makeSourceTable, makeKindTable } from "../../kernel/schema/tables.mjs";
import { storeViewOf } from "../../kernel/store/decay.mjs";
import { hashOf } from "../../kernel/schema/canonical.mjs";
import { analyzeRobustness, analyzePresupposition } from "../../kernel/analysis/robustness.mjs";
import { characterizedGaps as kernelCharacterizedGaps } from "../../kernel/analysis/characterized-gaps.mjs";
import { disagreements as kernelDisagreements } from "../../kernel/analysis/reconciliation.mjs";
import { leqWithinMode } from "../../kernel/schema/confidence.mjs";

function slug(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

export function createLocalProvider(snapshot) {
  const state = snapshot.state;
  const kindTable = makeKindTable(snapshot.kinds);
  const baseTables = { sourceTable: makeSourceTable(snapshot.sources), kindTable };
  const baseView = storeViewOf(state, baseTables); // derived grounding for read, computed once
  const claimByIdentity = new Map((state.entries || []).map((e) => [e.identity, e]));

  // a claim projected for a client: its declared grade, its derived earned grade, its in-force flag.
  function project(e, view) {
    const g = view.earnedByIdentity.get(e.identity) || {};
    return {
      identity: e.identity, kind: e.kind, statement: e.statement, source_id: e.source_id,
      declared_grade: e.declared_grade, earned_grade: g.earned || "ungraded", in_force: g.inForce !== false,
    };
  }

  // read(query): claims with their grounding. query filters by identity / kind / substring.
  function read(query) {
    query = query || {};
    let claims = (state.entries || []).map((e) => project(e, baseView));
    if (query.identity) claims = claims.filter((c) => c.identity === query.identity);
    if (query.kind) claims = claims.filter((c) => c.kind === query.kind);
    if (query.contains) {
      const q = String(query.contains).toLowerCase();
      claims = claims.filter((c) => c.statement.toLowerCase().includes(q));
    }
    return claims;
  }

  // propose(proposedClaim): build the judge's claim + supports, run the gate, return the receipt.
  //   proposedClaim = { statement, kind, citation?, contributor_id?, declared_grade?,
  //                      supports?: [ identity | { to_identity, declared_grade? } ] }
  function propose(proposedClaim) {
    const p = proposedClaim || {};
    if (!p.statement) return { decision: "declined", error: "a claim needs a statement", findings: [], grade_table: [] };
    const kind = p.kind || "claim";
    const contributor_id = p.contributor_id || "judge";
    // a citation becomes the claim's own basis: a distinct-party checking record on a cited source,
    // which is what raises an otherwise-asserted claim. No citation, no checking record, so asserted.
    const cited = p.citation && String(p.citation).trim();
    const source_id = cited ? "judge:cite:" + slug(cited) : "judge:unsourced";
    const source_class = cited ? "peer-reviewed" : "testimony";
    const checking_records = cited
      ? [{ checker_id: "judge-citation", method_class: "data-audit", method: String(cited), checked_at_state: "snapshot", outcome: "confirms", independence: "distinct-party" }]
      : undefined;
    const declared_grade = p.declared_grade || (cited ? "checked" : "asserted");

    let claim;
    try {
      claim = claimRecord({ kind, statement: p.statement, source_id, contributor_id, declared_grade, checking_records });
    } catch (e) {
      return { decision: "declined", error: "malformed claim: " + e.message, findings: [], grade_table: [] };
    }

    // supports: existing snapshot claims the judge rests the new claim on. Each support keeps the
    // supporting claim's own source footprint and sits in its own group, so independent supports lift.
    const supports = (p.supports || []).map((s) => (typeof s === "string" ? { to_identity: s } : s));
    const links = [];
    for (const s of supports) {
      const from = claimByIdentity.get(s.to_identity);
      if (!from) continue; // a support into a claim not in the snapshot is dropped, not invented
      links.push(linkRecord({
        link_kind: "supports", from_identity: from.identity, to_identity: claim.identity,
        support_group: "g:" + claim.identity + "/" + from.identity,
        source_id: from.source_id, contributor_id, declared_grade: s.declared_grade || "corroborated",
      }));
    }

    // the judge's source enters the table for this decision so the gate can price it; the snapshot
    // sources are unchanged (adding a row leaves every existing claim's derivation identical).
    const tables = { kindTable, sourceTable: makeSourceTable([...snapshot.sources, { source_id, source_class, rests_on: [] }]) };
    const contribution = { hash: claim.hash, entries: [claim], links };
    const receipt = decide(contribution, storeViewOf(state, tables), {});
    receipt.proposed_identity = claim.identity; // so the client can find its row in the grade table
    return receipt;
  }

  // robustness(query): the fragility reading alongside grounding, obtained the same way `read` is.
  //   query.identity restricts to one claim; otherwise every claim is read. Each reading carries the
  //   grade, the robustness (grade after the worst single removal), whether it is fragile, its single
  //   points of failure, the correlated-evidence flag, and the distinct presupposition reading.
  const graph = { entries: state.entries || [], links: state.links || [], tables: baseTables };
  function robustness(query) {
    query = query || {};
    let targets = (state.entries || []).map((e) => e.identity);
    if (query.identity) targets = targets.filter((id) => id === query.identity);
    return targets.map((id) => {
      const rob = analyzeRobustness(graph, id);
      const pre = analyzePresupposition(graph, id);
      const e = claimByIdentity.get(id);
      return {
        identity: id, statement: e ? e.statement : "", grade: rob.grade, robustness: rob.robustness,
        fragile: !rob.fragility.empty, single_points_of_failure: rob.single_points_of_failure,
        worst_removal: rob.worst_removal, group_count: rob.group_count,
        correlated_evidence_flag: rob.correlated_evidence_flag,
        presupposition: { closure: pre.presupposition_closure, shared: pre.shared_presuppositions },
      };
    });
  }

  // gaps(query): the open gaps in the graph, read the v3 way, a claim in force whose declared grade
  //   is not covered by its derived earned grade (the decay reading). query.prefix scopes by the
  //   node-id prefix of a claim's statement. The migrated corpus is closed, so this is empty.
  function gaps(query) {
    query = query || {};
    var entries = (state.entries || []);
    if (query.prefix) entries = entries.filter(function (e) { return e.statement.indexOf(query.prefix) === 0; });
    var out = [];
    entries.forEach(function (e) {
      var g = baseView.earnedByIdentity.get(e.identity) || {};
      var cmp = leqWithinMode(e.declared_grade, g.earned || "ungraded");
      if (!cmp.comparable || !cmp.leq) out.push({ identity: e.identity, statement: e.statement, kind: "decay", declared_grade: e.declared_grade, earned_grade: g.earned || "ungraded" });
    });
    return out;
  }

  // characterizedGaps(query): the claims held as characterized gaps, an open-line claim with a floor
  //   ceiling, a grade its transfer delivers, and a closing condition naming what would ground it.
  //   Each carries its closing condition and its transfer source. The migrated corpus carries none.
  function characterizedGaps(query) {
    var list = kernelCharacterizedGaps(graph);
    query = query || {};
    if (query.identity) list = list.filter(function (g) { return g.identity === query.identity; });
    if (query.prefix) list = list.filter(function (g) { return g.statement.indexOf(query.prefix) === 0; });
    return list;
  }

  // reconciliations(query): each contradicts-linked disagreement in the graph with its computed crux,
  //   the within-domain divergence frontier from the cone walk. The migrated corpus carries no
  //   contradicts links, so this reads none; the eggs CVD contradiction is surfaced in its own reading.
  function reconciliations(query) {
    var list = kernelDisagreements(graph);
    query = query || {};
    if (query.identity) list = list.filter(function (d) { return d.side_a.identity === query.identity || d.side_b.identity === query.identity; });
    return list;
  }

  return { kind: "local", propose, read, robustness, gaps, characterizedGaps, reconciliations };
}
