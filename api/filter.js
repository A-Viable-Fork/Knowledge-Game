// Role: the type filter (spec Section 6). A set-selector over the kinds present in the active
//   graph, with `untyped` as a first-class pseudo-type for any claim whose kind the current
//   community's own kind table does not name (a crossing arrival, filterable rather than invisible).
// Contract: kindsPresent(rows, kindTable) -> [{kind, count}], named kinds sorted, `untyped` last if
//   present; applyFilter(rows, excludedKinds, kindTable) -> { visible, hidden } where `hidden` is
//   exactly the [{kind, count}] the exclusion set hid, so a filter bar can always state its own
//   exclusions rather than occlude silently.
// Invariant: pure, no grade or receipt read or touched. Filtering selects a set; it composes with
//   ranking by running first (a caller orders `visible`, never the reverse), so a filter can only
//   ever change what is shown, never what anything is worth.
"use strict";

export const UNTYPED = "untyped";

export function kindOf(row, kindNames) {
  return kindNames.has(row.kind) ? row.kind : UNTYPED;
}

function sortedByKindName(entries) {
  return entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

export function kindsPresent(rows, kindTable) {
  const kindNames = new Set((kindTable || []).map((k) => k.kind));
  const counts = new Map();
  for (const row of rows || []) {
    const k = kindOf(row, kindNames);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const named = sortedByKindName([...counts.entries()].filter(([k]) => k !== UNTYPED));
  const out = named.map(([kind, count]) => ({ kind, count }));
  if (counts.has(UNTYPED)) out.push({ kind: UNTYPED, count: counts.get(UNTYPED) });
  return out;
}

export function applyFilter(rows, excludedKinds, kindTable) {
  const kindNames = new Set((kindTable || []).map((k) => k.kind));
  const excluded = new Set(excludedKinds || []);
  const visible = [];
  const hiddenCounts = new Map();
  for (const row of rows || []) {
    const k = kindOf(row, kindNames);
    if (excluded.has(k)) hiddenCounts.set(k, (hiddenCounts.get(k) || 0) + 1);
    else visible.push(row);
  }
  const hidden = sortedByKindName([...hiddenCounts.entries()]).map(([kind, count]) => ({ kind, count }));
  return { visible, hidden };
}
