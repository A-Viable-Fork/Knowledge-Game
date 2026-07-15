// Role: cross-boundary notification and the re-derivation contract (composition spec, record 6). A
//   change to a cited claim or a framing record issues a notification; re-derivation updates the
//   affected citations (re-graded, re-pointed to a successor on acceptance, or marked dangling),
//   recomputes composite grades by the record-2 rule, propagates transitively through internal
//   composite support, and emits an auditable re-derivation report that is itself a record.
// Contract: changeNotification(raw), rederive(notification, ctx) -> { report, citations, dangling,
//   suspended, grades, frame_orphaned }, rederivationReport(raw). Pure, ESM; kernel imports kernel.
// Invariant: a withdrawal without successor dangles the citation and suspends the citing claim; a
//   frame-status-change touches no grade, only the presupposition checks. The report records old and
//   new grade for every affected claim, so a re-derivation is auditable.
"use strict";
import { canonicalize, normalizeString, hashOf } from "../schema/canonical.mjs";
import { isPosition, meet } from "../schema/confidence.mjs";
import { citationRecord } from "./records.mjs";
import { compositeGrade } from "./transfer.mjs";
import { ceilingForCitations } from "./vocabulary.mjs";
import { frameOrphaned } from "./framing.mjs";

const CHANGES = ["withdrawn", "superseded", "regraded", "frame-status-change"];
const req = (v, msg) => { if (v === undefined || v === null || v === "") throw new Error(msg); return v; };
const grade = (v, where) => { if (!isPosition(v)) throw new Error(`${where}: not a confidence-order position: ${JSON.stringify(v)}`); return v; };

// ---- record 6: the change notification ----
export function changeNotification(raw) {
  if (!CHANGES.includes(raw.change)) throw new Error(`notification: bad change ${raw.change}`);
  const source_store = normalizeString(String(req(raw.source_store, "notification: source_store required")));
  const subject = normalizeString(String(req(raw.subject, "notification: subject required")));
  const new_state = normalizeString(String(req(raw.new_state, "notification: new_state required")));
  const out = {
    record_type: "change-notification",
    notification_id: hashOf({ source_store, subject, change: raw.change, new_state }),
    source_store, subject, change: raw.change,
    old_state: normalizeString(String(req(raw.old_state, "notification: old_state required"))),
    new_state,
    issued_at: normalizeString(String(req(raw.issued_at, "notification: issued_at required"))),
  };
  if (raw.change === "regraded") { out.old_grade = grade(raw.old_grade, "notification.old_grade"); out.new_grade = grade(raw.new_grade, "notification.new_grade"); }
  if (raw.change === "superseded") { out.successor = normalizeString(String(req(raw.successor, "notification: successor required on supersession"))); if (raw.new_grade !== undefined) out.new_grade = grade(raw.new_grade, "notification.new_grade"); }
  out.canonical = canonicalize(out);
  out.hash = hashOf(out.canonical, { pre: true });
  return out;
}

// ---- record 6: the re-derivation report, itself a record ----
const sortStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export function rederivationReport(raw) {
  const affected = (raw.affected || []).slice().sort((a, b) => sortStr(a.claim_id, b.claim_id));
  const out = {
    record_type: "rederivation-report",
    notification_id: req(raw.notification_id, "report: notification_id required"),
    affected, // [{ claim_id, old_grade, new_grade }]
    dangling: (raw.dangling || []).slice().sort(sortStr),          // citation ids now dangling
    suspended: (raw.suspended || []).slice().sort(sortStr),        // claim ids pending a replacement citation
    frame_orphaned: (raw.frame_orphaned || []).slice().sort((a, b) => sortStr(a.from_claim, b.from_claim)),
  };
  out.canonical = canonicalize(out);
  out.hash = hashOf(out.canonical, { pre: true });
  return out;
}

// recompute every composite claim's grade over the current citations, to a fixpoint through internal
// support. A necessary citation that is dangling, or a necessary internal support that is suspended,
// suspends the claim (pending a replacement). Returns { grades, suspended }.
function computeGrades(claims, citationsById, danglingSet) {
  const grades = {};
  const suspended = new Set();
  let changed = true, guard = 0;
  while (changed && guard++ < (claims.length + 2)) {
    changed = false;
    for (const c of claims) {
      const nec = (c.support || []).map((id) => citationsById[id]).filter((x) => x && x.role === "necessary");
      let suspend = nec.some((x) => danglingSet.has(x.citation_id));
      let g = suspend ? null : compositeGrade({ ceiling: ceilingForCitations(nec), citations: nec });
      for (const supId of c.internal_support || []) {
        if (suspended.has(supId)) { suspend = true; break; }
        const sg = grades[supId];
        if (sg === undefined || sg === "suspended") { if (sg === "suspended") { suspend = true; break; } continue; }
        g = g === null ? null : meet(g, sg);
      }
      const val = suspend ? "suspended" : g;
      if (suspend) suspended.add(c.claim_id);
      if (grades[c.claim_id] !== val) { grades[c.claim_id] = val; changed = true; }
    }
  }
  return { grades, suspended };
}

// a read of every composite claim's grade over a citation set (a profile and a re-derivation both
// need it). danglingSet names citations with no live target; the return is { grades, suspended }.
export function readCompositeGrades(claims, citations, danglingSet = new Set()) {
  return computeGrades(claims || [], Object.fromEntries((citations || []).map((c) => [c.citation_id, c])), danglingSet);
}

// the re-derivation contract. ctx = { claims, citations, edges, framesById, acceptSuccessor }.
// acceptSuccessor(citation) decides, per citing author-of-record, whether to re-point on supersession.
export function rederive(notification, ctx) {
  const claims = ctx.claims || [];
  const before = computeGrades(claims, Object.fromEntries((ctx.citations || []).map((c) => [c.citation_id, c])), new Set());

  // frame-status-change: no grade moves, only the presupposition checks re-run
  if (notification.change === "frame-status-change") {
    const edges = (ctx.edges || []).filter((e) => e.to_framing === notification.subject);
    const orphans = frameOrphaned(edges, ctx.framesById || {});
    const report = rederivationReport({ notification_id: notification.notification_id, affected: [], dangling: [], suspended: [], frame_orphaned: orphans });
    return { report, citations: ctx.citations || [], dangling: new Set(), suspended: before.suspended, grades: before.grades, frame_orphaned: orphans };
  }

  // a cited-claim change: update the affected citations, then recompute
  const dangling = new Set();
  const accept = ctx.acceptSuccessor || (() => true);
  const citations = (ctx.citations || []).map((c) => {
    if (c.cited_claim !== notification.subject) return c;
    if (notification.change === "regraded")
      return citationRecord({ citing_claim: c.citing_claim, source_store: c.source_store, cited_claim: c.cited_claim, cited_state: notification.new_state, carried_grade: notification.new_grade, role: c.role, made_at: c.made_at, term_ref: c.term_ref });
    if (notification.change === "superseded" && accept(c) && notification.successor)
      return citationRecord({ citing_claim: c.citing_claim, source_store: c.source_store, cited_claim: notification.successor, cited_state: notification.new_state, carried_grade: notification.new_grade || c.carried_grade, role: c.role, made_at: c.made_at, term_ref: c.term_ref });
    // withdrawn without successor, or supersession the author-of-record declines: the citation dangles
    dangling.add(c.citation_id);
    return c;
  });

  const after = computeGrades(claims, Object.fromEntries(citations.map((c) => [c.citation_id, c])), dangling);
  const affected = [];
  for (const c of claims) {
    const o = before.grades[c.claim_id], n = after.grades[c.claim_id];
    if (o !== n) affected.push({ claim_id: c.claim_id, old_grade: String(o), new_grade: String(n) });
  }
  const report = rederivationReport({ notification_id: notification.notification_id, affected, dangling: [...dangling], suspended: [...after.suspended], frame_orphaned: [] });
  return { report, citations, dangling, suspended: after.suspended, grades: after.grades, frame_orphaned: [] };
}
