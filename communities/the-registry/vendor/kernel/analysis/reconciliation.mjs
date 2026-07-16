// Role: the reconciliation reading (Prompt 22). Contradictions are held as structure; this computes
//   what a disagreement turns on, its crux, and holds the pair as a first-class disagreement record.
//   The crux comes in two kinds. A within-domain contradiction has both sides on one domain floor and
//   its crux is empirical: walk each cone and the point where they stop sharing structure is the crux
//   candidate set, the shared claims the resolved sub-region. A cross-domain disagreement's crux is
//   the framing node (the denominator and weights), read off the composite forum (Phase B), not a cone.
// Contract: supportCone(graph, id), withinDomainCrux(graph, aId, bId), disagreements(graph),
//   disagreementRecord(...). graph = { entries, links, tables }. Pure, deterministic; kernel imports
//   only kernel; mutates nothing. The crux is a CANDIDATE marked as such, not a verdict.
// Invariant: HONEST BOUND. The frontier is only as findable as the cones are represented; a divergence
//   out of the graph (a shared assumption neither cone names) is missed until it is reified as a node,
//   the same limit robustness carries and the same remedy. A shallow frontier is therefore a finding,
//   not a failure: it reports that the disagreement needs an explicit node before the crux computes
//   meaningfully, and this reading names that rather than forcing a false frontier.
"use strict";
import { derivedGrade } from "../store/decay.mjs";

const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// the support cone of a claim: every claim reachable by following supports links backward (to -> from),
// with each claim's direct supports recorded, excluding the claim itself. This is the reliability
// structure the grounding fold reads, walked here to find where two cones diverge.
export function supportCone(graph, id) {
  const supportsInto = new Map();
  for (const l of graph.links || []) {
    if (l.link_kind !== "supports") continue;
    if (!supportsInto.has(l.to_identity)) supportsInto.set(l.to_identity, []);
    supportsInto.get(l.to_identity).push(l.from_identity);
  }
  const members = new Set();
  const directOf = new Map();
  const stack = [id];
  const seen = new Set([id]);
  while (stack.length) {
    const cur = stack.pop();
    const direct = supportsInto.get(cur) || [];
    directOf.set(cur, direct.slice().sort(byId));
    for (const from of direct) {
      if (!members.has(from)) members.add(from);
      if (!seen.has(from)) { seen.add(from); stack.push(from); }
    }
  }
  return { members, directOf, supportsInto };
}

// the within-domain crux: from the two contradicting claims, walk each cone and compute the divergence
// frontier, the claims each side rests on that the other does not, at the boundary of the shared
// structure. The resolved sub-region is the claims both cones share. When the cones share no structure
// the frontier is at the top (the contradicting claims themselves) and the result is a finding: the
// disagreement needs an explicit node before the crux computes meaningfully.
export function withinDomainCrux(graph, aId, bId) {
  const coneA = supportCone(graph, aId);
  const coneB = supportCone(graph, bId);
  const shared = [...coneA.members].filter((m) => coneB.members.has(m)).sort(byId);
  const aOnly = [...coneA.members].filter((m) => !coneB.members.has(m)).sort(byId);
  const bOnly = [...coneB.members].filter((m) => !coneA.members.has(m)).sort(byId);

  // structurally disjoint: the cones share nothing, so there is no frontier inside the shared region.
  // The crux is at the top. `shallow` marks the special case where both cones are empty, so the
  // contradiction rests on bare claims and the confounder, if any, is not yet a node either side names.
  if (shared.length === 0) {
    const shallow = coneA.members.size === 0 && coneB.members.size === 0;
    return {
      reading: "within-domain-crux", kind: "within-domain",
      structurally_disjoint: true, shallow,
      frontier_candidates: [aId, bId].sort(byId), // the crux at the top, the contradicting claims themselves
      resolved_sub_region: [],
      a_only: aOnly, b_only: bOnly,
      candidate: true,
      note: shallow
        ? "the two support cones are empty: the contradiction rests on bare claims. The frontier is at the top, and the confounder the disagreement turns on is not yet a node either side names. This is a finding: reify the confounder as an explicit claim both sides rest on before the crux computes meaningfully (the same bound robustness carries, the same remedy)."
        : "the two support cones share no structure: structurally disjoint. The crux is at the top; there is no shared frontier to point at.",
    };
  }

  // the frontier: the divergent claims (a-only or b-only) at the boundary of the shared structure, the
  // claims each side rests on differently. These are the points past which the cones stop sharing.
  const inSharedRegion = new Set([...shared, aId, bId]);
  // a boundary divergent claim is one that a claim in the shared region (or a contradicting claim)
  // rests on: the point where a side's cone leaves the shared structure.
  const boundary = (only, cone) => only.filter((c) => {
    for (const [to, froms] of cone.supportsInto) if (froms.includes(c) && inSharedRegion.has(to)) return true;
    return false;
  });
  let frontier = [...new Set([...boundary(aOnly, coneA), ...boundary(bOnly, coneB)])].sort(byId);
  // if no divergent claim hangs directly off the shared region, the divergence is deeper; fall back to
  // the full divergent set so a candidate is always surfaced rather than an empty (misleading) frontier.
  if (frontier.length === 0) frontier = [...new Set([...aOnly, ...bOnly])].sort(byId);

  return {
    reading: "within-domain-crux", kind: "within-domain",
    structurally_disjoint: false, shallow: false,
    frontier_candidates: frontier,   // the crux the structure points at, marked candidate
    resolved_sub_region: shared,      // the claims the two cones agree on
    a_only: aOnly, b_only: bOnly,
    candidate: true,
    note: "the frontier is the crux the structure points at, a candidate set, not a decided crux; which candidate is decisive is a judgment the record invites.",
  };
}

// the reconciliation register: a contradicts-linked pair held as a first-class disagreement record,
// carrying both sides, their grades, and the crux. The grade is derived on read (never stored), the
// same discipline grounding and robustness keep.
function gradeOf(graph, id) {
  return derivedGrade({ entries: graph.entries, links: graph.links }, id, graph.tables);
}
export function disagreementRecord(graph, aId, bId, linkIdentity) {
  const crux = withinDomainCrux(graph, aId, bId); // within-domain by default; Phase B routes cross-domain
  return {
    record_type: "disagreement",
    kind: crux.kind,
    link_identity: linkIdentity || null,
    side_a: { identity: aId, grade: gradeOf(graph, aId) },
    side_b: { identity: bId, grade: gradeOf(graph, bId) },
    crux,
  };
}

// every contradicts-linked pair in the graph, as disagreement records with their computed crux. The
// pair is oriented by identity order so the record is deterministic regardless of link direction.
export function disagreements(graph) {
  const out = [];
  for (const l of graph.links || []) {
    if (l.link_kind !== "contradicts") continue;
    const [aId, bId] = [l.from_identity, l.to_identity].sort(byId);
    out.push(disagreementRecord(graph, aId, bId, l.identity));
  }
  return out.sort((x, y) => byId(x.side_a.identity + x.side_b.identity, y.side_a.identity + y.side_b.identity));
}

// the cross-domain crux: for a disagreement whose sides weigh claims across domains, the crux is not a
// frontier inside any domain. It is the framing node the weighing depends on, the denominator and the
// weights, read off the composite forum. Named, not computed from a cone; the weighing shares no unit.
export function crossDomainCrux(weighing) {
  const frames = (weighing.frame_refs || []).slice().sort(byId);
  return {
    reading: "cross-domain-crux", kind: "cross-domain",
    framing_crux: frames,                    // the framing node(s) the weighing rests on: the crux
    weighting: weighing.weighting || null,   // the weights are part of the crux, a stated value choice
    candidate: true,
    note: "the crux is the incommensurable weighing itself, the denominator and the weights read off the composite forum, not a divergence frontier inside any domain.",
  };
}

// the two-kind router: a disagreement is EITHER a within-domain contradicts pair (both sides on one
// domain floor) OR a cross-domain weighing (a composite-forum claim weighing across domains). The
// router picks by the shape of the input so neither kind is run through the other's method. A
// within-domain input carries { graph, a, b }; a cross-domain input carries { weighing }.
export function reconcile(input) {
  if (input && input.weighing) {
    const w = input.weighing;
    return {
      record_type: "disagreement", kind: "cross-domain",
      subject: w.claim_id || null, statement: w.statement || null,
      crux: crossDomainCrux(w),
    };
  }
  return disagreementRecord(input.graph, input.a, input.b, input.link_identity);
}
