// Role: standing-motion alerts (spec Section 6). A local snapshot-diff over watched claims: each
//   watch remembers the grade it last saw, and a fresh load compares that against the claim's current
//   earned grade. An alert reports grade motion and only grade motion; a watched claim whose grade
//   fell all the way to ungraded is flagged distinctly (its supporting structure collapsed), still
//   reported as a grade-motion fact, never a separate kind of claim about the world.
// Contract: computeAlerts(watches, currentRows) -> [{identity, kind, statement, priorGrade,
//   currentGrade, collapsed}], one entry per watch whose current grade differs from what was stored,
//   in watch order. refreshWatches(watches, currentRows) -> the next watch list to persist, each
//   watch's grade updated to what was just read (so the next diff is against this read, not a stale
//   one); a watch whose claim no longer resolves in currentRows is dropped rather than carried stale.
// Invariant: pure. Reads only what the caller passes; computes no grade itself, only compares two
//   already-computed readings.
"use strict";

export function computeAlerts(watches, currentRows) {
  const byIdentity = new Map(currentRows.map((r) => [r.identity, r]));
  const alerts = [];
  for (const w of watches || []) {
    const row = byIdentity.get(w.identity);
    if (!row) continue;
    if (row.earned_grade === w.grade) continue;
    alerts.push({
      identity: row.identity, kind: row.kind, statement: row.statement,
      priorGrade: w.grade, currentGrade: row.earned_grade,
      collapsed: row.earned_grade === "ungraded" && w.grade !== "ungraded",
    });
  }
  return alerts;
}

export function refreshWatches(watches, currentRows) {
  const byIdentity = new Map(currentRows.map((r) => [r.identity, r]));
  const next = [];
  for (const w of watches || []) {
    const row = byIdentity.get(w.identity);
    if (!row) continue;
    next.push({ identity: row.identity, kind: row.kind, grade: row.earned_grade });
  }
  return next;
}
