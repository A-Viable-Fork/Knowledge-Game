// Role: the kernel algebra (composition spec, "The kernel algebra"). Kernels are the objects and the
//   operations take kernels and return kernels, so they chain. compose is the crossing (transfer.mjs)
//   as the algebra's product: B's claims cross into A untyped at the floor, grounding nothing. project
//   restricts a kernel to a predicate's subgraph, its grades recomputed over the restriction and never
//   lifted. diff reads the structured difference of two kernels over the shared claim skeleton and
//   returns a diff-kernel. overlay, merge, subtract are specified (composition spec), not built here.
// Contract: asKernel(store) -> kernel; recomputeGrade(kernel, id) -> position; compose(A, B), project(
//   kernel, predicate), diff(A, B) -> kernel. A kernel is { store_id, state, tables, native, grades }.
//   Pure, ESM; kernel imports only kernel. No operation writes; each returns a new store.
// Invariant: THE GOVERNING LAW. Every operation returns a kernel, and no operation assigns any claim a
//   grade above what recomputation in the result kernel confirms (the no-grade-motion invariant lifted
//   from claims to operations). `native` is the set of locally-typed identities; a non-native
//   (crossed, untyped) claim grounds nothing and recomputes to the bottom, so compose floors every
//   claim it crosses and the laundering guard holds by construction, not by a check.
"use strict";
import { derivedGrade } from "../store/decay.mjs";
import { leqWithinMode } from "../schema/confidence.mjs";
import { hashOf, computeClaimIdentity } from "../schema/canonical.mjs";

const BOTTOM = "ungraded"; // the untyped floor: a crossed claim grounds nothing

// a state hash over the entry and link identity sets, order-independent, so compose is associative up
// to this hash: two kernels with the same entries, links, and native set hash the same regardless of
// the order they were composed in.
function stateHashOf(entries, links, native) {
  return hashOf({ entries: (entries || []).map((e) => e.identity).sort(), links: (links || []).map((l) => l.identity).sort(), native: [...native].sort() });
}

// recompute a claim's grade in a kernel: a native (locally-typed) claim recomputes from the kernel's
// own structure and tables; a non-native (crossed, untyped) claim grounds nothing. This is the single
// source of truth the governing law checks the assigned grades against.
export function recomputeGrade(K, id) {
  if (!K.native.has(id)) return BOTTOM;
  return derivedGrade(K.state, id, K.tables);
}

// fill the grades map from recomputation: the honest operation assigns exactly what recomputation
// confirms. Every built operation ends here, so the governing law holds by construction.
function gradesByRecompute(K) {
  const grades = new Map();
  for (const e of K.state.entries || []) grades.set(e.identity, recomputeGrade(K, e.identity));
  return grades;
}

// normalize a v3 store { store_id, state, tables } into an algebra kernel: every entry is native
// (locally typed and grounded), the grades are the store's own derivation.
export function asKernel(store) {
  const state = { entries: store.state.entries || [], links: store.state.links || [], withdrawn_records: store.state.withdrawn_records || [], supersession_records: store.state.supersession_records || [] };
  const native = new Set((state.entries).map((e) => e.identity));
  const K = { store_id: store.store_id, state, tables: store.tables, native };
  K.state.state_hash = stateHashOf(state.entries, state.links, native);
  K.grades = gradesByRecompute(K);
  return K;
}

// union entry/link lists by identity (first wins, so A's records survive a same-identity collision).
function unionById(a, b) {
  const seen = new Set(), out = [];
  for (const x of [...a, ...b]) if (!seen.has(x.identity)) { seen.add(x.identity); out.push(x); }
  return out;
}

// compose(A, B): the crossing as product. A stays itself; B's claims and links are added, but B's
// claims are NOT added to `native`, so they arrive untyped at the floor and ground nothing until a
// fork types them locally. Tables are A's (B did no attenuating here). The laundering guard is
// structural: a permissive B cannot lift standing into a strict A, because a crossed claim is untyped.
export function compose(A, B) {
  const entries = unionById(A.state.entries || [], B.state.entries || []);
  const links = unionById(A.state.links || [], B.state.links || []);
  const native = new Set(A.native); // only A's claims stay native; every B claim crosses untyped
  const state = { entries, links, withdrawn_records: A.state.withdrawn_records || [], supersession_records: A.state.supersession_records || [] };
  const K = { store_id: `compose(${A.store_id},${B.store_id})`, state, tables: A.tables, native };
  K.state.state_hash = stateHashOf(entries, links, native);
  K.grades = gradesByRecompute(K);
  return K;
}

// project(K, predicate): K restricted to the claims its entries satisfy predicate(entry, K). Links to
// a dropped claim become dangling and are dropped, so a support removed by the restriction lowers the
// claim it fed, exactly as the crossing handles a dangling citation. Grades recompute over the
// restriction and can only fall, never rise: project never lifts a restricted grade.
export function project(K, predicate) {
  const kept = (K.state.entries || []).filter((e) => predicate(e, K));
  const keptIds = new Set(kept.map((e) => e.identity));
  const links = (K.state.links || []).filter((l) => keptIds.has(l.from_identity) && keptIds.has(l.to_identity));
  const native = new Set([...K.native].filter((id) => keptIds.has(id)));
  const state = { entries: kept, links, withdrawn_records: K.state.withdrawn_records || [], supersession_records: K.state.supersession_records || [] };
  const P = { store_id: `project(${K.store_id})`, state, tables: K.tables, native };
  P.state.state_hash = stateHashOf(kept, links, native);
  P.grades = gradesByRecompute(P); // recomputed over the restricted subgraph, never the original
  return P;
}

// a diff record is a claim of a kind no kernel pins, so it grounds nothing (it reports, it does not
// assert): its grade in the diff-kernel is the bottom. The statement carries what was read.
function diffRecord(statement) {
  return { record_type: "claim", identity: computeClaimIdentity("diff-record", statement), kind: "diff-record", statement, source_id: "S-diff", contributor_id: "P-algebra", declared_grade: BOTTOM, checking_records: [] };
}

// diff(A, B): the structured difference over the shared claim-identity skeleton. Reports claims present
// in only one; claims present in both whose recomputed grades differ (both grades); and contradiction
// surfaces, a claim graded above the floor in one kernel while contradicted or undercut in the other.
// Returns a diff-kernel whose claims are the difference records, itself a readable, composable kernel
// that asserts nothing it did not read.
export function diff(A, B) {
  const aById = new Map((A.state.entries || []).map((e) => [e.identity, e]));
  const bById = new Map((B.state.entries || []).map((e) => [e.identity, e]));
  const ids = new Set([...aById.keys(), ...bById.keys()]);
  const attacked = (K, id) => (K.state.links || []).some((l) => (l.link_kind === "contradicts" || l.link_kind === "undercut") && (l.to_identity === id || l.from_identity === id));
  const aboveFloor = (g) => g !== BOTTOM && g !== "asserted";

  const findings = { only_in_a: [], only_in_b: [], grade_changed: [], contradiction_surfaces: [] };
  const records = [];
  for (const id of ids) {
    const inA = aById.has(id), inB = bById.has(id);
    const stmt = (aById.get(id) || bById.get(id)).statement;
    if (inA && !inB) { findings.only_in_a.push(id); records.push(diffRecord(`only in ${A.store_id}: ${stmt}`)); continue; }
    if (inB && !inA) { findings.only_in_b.push(id); records.push(diffRecord(`only in ${B.store_id}: ${stmt}`)); continue; }
    const ga = recomputeGrade(A, id), gb = recomputeGrade(B, id);
    if (ga !== gb) { findings.grade_changed.push({ id, grade_a: ga, grade_b: gb }); records.push(diffRecord(`grade differs (${A.store_id} ${ga}, ${B.store_id} ${gb}): ${stmt}`)); }
    // a contradiction surface: graded above the floor in one, attacked in the other
    if ((aboveFloor(ga) && attacked(B, id)) || (aboveFloor(gb) && attacked(A, id))) {
      findings.contradiction_surfaces.push({ id, grade_a: ga, grade_b: gb });
      records.push(diffRecord(`contradiction surface (above floor in one, contradicted or undercut in the other): ${stmt}`));
    }
  }
  const state = { entries: records, links: [], withdrawn_records: [], supersession_records: [] };
  const native = new Set(); // diff records ground nothing
  const D = { store_id: `diff(${A.store_id},${B.store_id})`, state, tables: A.tables, native, findings };
  D.state.state_hash = stateHashOf(records, [], native);
  D.grades = gradesByRecompute(D);
  return D;
}

// the governing law as a predicate, exported so the oracle asserts it independently: no claim's
// assigned grade exceeds what recomputation in the same kernel confirms.
export function governingLawHolds(K) {
  for (const [id, assigned] of K.grades) {
    const recomputed = recomputeGrade(K, id);
    const cmp = leqWithinMode(assigned, recomputed);
    if (!(cmp.comparable && cmp.leq)) return { ok: false, id, assigned, recomputed };
  }
  return { ok: true };
}
