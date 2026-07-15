// Role: the two first-wave demonstration extensions (spec Section 6), shipped as plain source text
//   loaded through the same public extension seam any third-party module uses, no shortcut. Each is a
//   standalone `extensionMain(input)` function: no import, no reference to anything outside the one
//   input value the sandbox hands it.
// Contract: LEARN_EFFICIENTLY_SOURCE (shape "ranker"): input {rows, links}, returns rows reordered by
//   how many "supports" links point from each row's identity, descending, tie-broken by identity, the
//   same reading api/ranking.js's built-in "learn-efficiently" component scores, extracted into a
//   loadable module. CONTESTABLE_DASHBOARD_SOURCE (shape "renderer"): input {rows}, returns
//   {tiles: [{identity, label, grade, kind}]} for every measurement-kind row, a structured descriptor
//   the host renders as a dashboard (contest/fork remain host-side live actions; the extension itself
//   never touches the DOM).
// Invariant: both are pure functions of their input; neither mutates a row nor introduces one that
//   was not in the input, the property build/check-extension-seam.mjs verifies at install time.
"use strict";

export const LEARN_EFFICIENTLY_SOURCE = `function extensionMain(input) {
  var rows = input.rows;
  var links = input.links || [];
  var countByIdentity = {};
  for (var i = 0; i < links.length; i++) {
    var l = links[i];
    if (l.link_kind === "supports") {
      countByIdentity[l.from_identity] = (countByIdentity[l.from_identity] || 0) + 1;
    }
  }
  var withCount = rows.map(function (r) { return { row: r, count: countByIdentity[r.identity] || 0 }; });
  withCount.sort(function (a, b) {
    if (b.count !== a.count) return b.count - a.count;
    return a.row.identity < b.row.identity ? -1 : (a.row.identity > b.row.identity ? 1 : 0);
  });
  return withCount.map(function (w) { return w.row; });
}`;

export const CONTESTABLE_DASHBOARD_SOURCE = `function extensionMain(input) {
  var rows = (input.rows || []).filter(function (r) { return r.kind === "measurement"; });
  var tiles = rows.map(function (r) {
    return { identity: r.identity, label: r.statement, grade: r.earned_grade, kind: r.kind };
  });
  return { tiles: tiles };
}`;
