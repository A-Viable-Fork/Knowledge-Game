// Role: the framing record and the presupposition edge (composition spec, record 5). This is the
//   denominator seam: a domain claim presupposes a frame, a choice of comparison unit or baseline or
//   relevant population, and that choice is made visible and swappable while the measurement stands.
//   A framing record carries a status, not a grade; the presupposition edge is CHECKED (the frame is
//   in-force), never GRADED. The edge enters no grade computation, so the domain claim keeps the
//   grade its own floor gives it, whatever happens to the frame.
// Contract: framingRecord(raw), presuppositionEdge(raw), checkPresupposition(edge, frame),
//   frameOrphaned(edges, framesById), swapFrame(edge, successorFrame). Pure, ESM; kernel imports
//   only kernel.
// Invariant: the presupposition edge is not a support or depends-on link; it never reaches the
//   earned-grade fold. A fallen frame flags the claim frame-orphaned and leaves its grade untouched.
"use strict";
import { canonicalize, normalizeString, hashOf } from "../schema/canonical.mjs";

const FRAMING_STATUSES = ["in-force", "superseded", "withdrawn"];
const req = (v, msg) => { if (v === undefined || v === null || v === "") throw new Error(msg); return v; };

// ---- record 5: the framing record, a composite-level forum record carrying status, not a grade ----
const FRAMING_FIELDS = ["framing_id", "statement", "alternatives", "status", "successor", "region"];
export function framingRecord(raw) {
  if (!FRAMING_STATUSES.includes(raw.status)) throw new Error(`framing: bad status ${raw.status}`);
  const framing_id = normalizeString(String(req(raw.framing_id, "framing: framing_id required")));
  const statement = normalizeString(String(req(raw.statement, "framing: statement required")));
  const alternatives = (raw.alternatives || []).map((s) => normalizeString(String(s))); // other frames that could hold
  if (raw.status === "superseded" && !raw.successor) throw new Error("framing: a superseded frame records its successor");
  const declared = {
    framing_id: canonicalize(framing_id),
    statement: canonicalize(statement),
    alternatives: canonicalize(alternatives, "reference"),
    status: canonicalize(raw.status),
    region: canonicalize("forum"), // a choice, held in the composite forum; it carries status, not a grade
  };
  if (raw.successor !== undefined) declared.successor = canonicalize(normalizeString(String(raw.successor)));
  const canonical = declared;
  return {
    record_type: "framing", framing_id, statement, alternatives, status: raw.status,
    successor: raw.successor, region: "forum", canonical, hash: hashOf(canonical, { pre: true }),
  };
}

// ---- record 5: the presupposition edge, from a domain claim up to a composite-level frame ----
// kind is fixed presupposition, distinguishing it from a support edge. Its identity is content over
// (from_store, from_claim, to_framing), so re-pointing to a successor frame yields a new edge.
export function presuppositionEdge(raw) {
  const from_store = normalizeString(String(req(raw.from_store, "presupposition edge: from_store required")));
  const from_claim = normalizeString(String(req(raw.from_claim, "presupposition edge: from_claim required")));
  const to_framing = normalizeString(String(req(raw.to_framing, "presupposition edge: to_framing required")));
  const edge_id = hashOf({ from_store, from_claim, to_framing });
  const canonical = canonicalize({ edge_id, from_store, from_claim, to_framing, kind: "presupposition" });
  return { record_type: "presupposition-edge", edge_id, from_store, from_claim, to_framing, kind: "presupposition", canonical, hash: hashOf(canonical, { pre: true }) };
}

// the check: the framing record the edge points to is in-force. The edge enters no grade computation,
// so this returns a standing, not a grade. A frame that is not in-force flags the claim frame-orphaned.
export function checkPresupposition(edge, frame) {
  if (!frame || frame.framing_id !== edge.to_framing) throw new Error("presupposition check: frame does not match the edge's to_framing");
  const in_force = frame.status === "in-force";
  return { edge_id: edge.edge_id, from_store: edge.from_store, from_claim: edge.from_claim, to_framing: edge.to_framing, in_force, frame_orphaned: !in_force };
}

// the domain claims newly frame-orphaned: every edge whose framing record is not in-force. framesById
// maps framing_id to the framing record. An edge to an in-force frame is not reported.
export function frameOrphaned(edges, framesById) {
  const out = [];
  for (const e of edges || []) {
    const f = framesById.get ? framesById.get(e.to_framing) : framesById[e.to_framing];
    if (!f || f.status !== "in-force") out.push({ from_store: e.from_store, from_claim: e.from_claim, to_framing: e.to_framing, edge_id: e.edge_id });
  }
  return out;
}

// swap the frame: adopt a successor framing record and re-point the edge to it. The domain claim and
// its store are unchanged; only the edge's target moves, and the measurement's grade never entered here.
export function swapFrame(edge, successorFrame) {
  if (successorFrame.status !== "in-force") throw new Error("swapFrame: the successor frame must be in-force");
  return presuppositionEdge({ from_store: edge.from_store, from_claim: edge.from_claim, to_framing: successorFrame.framing_id });
}
