// Role: the grounding profiles (composition spec, record 7). A read, never a mutation: input is a
//   store at a state, output is a profile record. The two shapes differ deliberately. A domain store
//   answers "what floors am I standing on": its floor distribution (the settled tier, where v3 records
//   the measurement/proof/declaration floors as its settled positions) and its forum distribution. A
//   composite store answers "how much of me is inherited ground and how much is my own forum": its
//   cited grounding by inherited grade, its forum residents, the health of its citations, and the
//   condition of its frame layer.
// Contract: domainProfile(store), compositeProfile(store, ctx). Pure, ESM; kernel imports kernel.
// Invariant: a profile computes nothing new about grades; it reads the derived grade (domain) and the
//   record-2 composite grade (composite), and counts. No ranking, no ordering by importance.
"use strict";
import { tierOf } from "../schema/confidence.mjs";
import { derivedGrade } from "../store/decay.mjs";
import { isStale } from "./transfer.mjs";
import { frameOrphaned } from "./framing.mjs";
import { readCompositeGrades } from "./notify.mjs";

// a domain store's floors and forum. floor_distribution counts claims whose derived grade is in the
// settled tier (v3's floors: the measurement/proof floors are the empirical settled grades, the
// declaration floor is constitutive), keyed by the settled position; forum_distribution counts the
// rest by their open-line grade.
export function domainProfile(store) {
  const floor_distribution = {};
  const forum_distribution = {};
  for (const e of store.state.entries || []) {
    const g = derivedGrade(store.state, e.identity, store.tables);
    const bucket = tierOf(g) === "settled" ? floor_distribution : forum_distribution;
    bucket[g] = (bucket[g] || 0) + 1;
  }
  return { record_type: "domain-grounding-profile", store: store.store_id, state: store.state.state_hash, floor_distribution, forum_distribution };
}

// a composite store's inherited ground and its own forum. ctx = { sourceStates, dangling }:
// sourceStates maps a source store id to its current state id (for staleness), dangling is the set of
// citation ids with no live target.
export function compositeProfile(store, ctx = {}) {
  const dangling = ctx.dangling || new Set();
  const sourceStates = ctx.sourceStates || {};
  const { grades } = readCompositeGrades(store.claims || [], store.citations || [], dangling);

  const cited_grounding = {}; // composite claims by inherited grade (or "suspended")
  let forum_resident = 0;
  for (const c of store.claims || []) {
    const g = grades[c.claim_id];
    const key = g === undefined ? "ungrounded" : String(g);
    cited_grounding[key] = (cited_grounding[key] || 0) + 1;
    if (c.region === "forum") forum_resident += 1;
  }

  const citation_health = { current: 0, stale: 0, dangling: 0 };
  for (const cit of store.citations || []) {
    if (dangling.has(cit.citation_id)) citation_health.dangling += 1;
    else if (sourceStates[cit.source_store] !== undefined && isStale(cit, sourceStates[cit.source_store])) citation_health.stale += 1;
    else citation_health.current += 1;
  }

  const framesById = {};
  for (const f of store.frames || []) framesById[f.framing_id] = f;
  const framing_in_force = (store.frames || []).filter((f) => f.status === "in-force").length;
  const frame_orphaned_dependents = frameOrphaned(store.edges || [], framesById).length;

  return {
    record_type: "composite-grounding-profile", store: store.store_id, state: ctx.state || "current",
    cited_grounding, forum_resident, citation_health,
    framing_in_force: { in_force: framing_in_force, frame_orphaned_dependents },
  };
}
