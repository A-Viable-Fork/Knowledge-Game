// Role: verifies the type filter's own contract (Phase KG-4, spec Section 6). Exclusion counts are
//   correct against fuzzed filter states and graphs; a filter changes no grade, no declared field, and
//   no identity, trivially (it is view-side set selection only) but stated and checked.
// Contract: `node build/check-filter.mjs` exits non-zero on any divergence, naming it.
"use strict";
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-FILTER: exclusion counts are honest, filtering moves no grade"); console.log(H);

const { kindsPresent, applyFilter, UNTYPED } = await import("../api/filter.js");

function randomRows(n, kindTable) {
  const kindNames = kindTable.map((k) => k.kind).concat(["crossing-arrival"]); // one name never in the table
  const grades = ["ungraded", "asserted", "supported", "corroborated", "checked"];
  const rows = [];
  for (let i = 0; i < n; i++) {
    const kind = kindNames[Math.floor(Math.random() * kindNames.length)];
    const grade = grades[Math.floor(Math.random() * grades.length)];
    rows.push({ identity: `id-${i}`, kind, statement: `s${i}`, declared_grade: grade, earned_grade: grade, source_id: `S${i % 3}` });
  }
  return rows;
}

const KIND_TABLE = [{ kind: "measurement", ceiling: "checked" }, { kind: "forum", ceiling: "corroborated" }, { kind: "comment", ceiling: "ungraded" }];

console.log("\n[1] kindsPresent counts and names every kind actually present, untyped last if present");
{
  const rows = randomRows(40, KIND_TABLE);
  const present = kindsPresent(rows, KIND_TABLE);
  const kindNames = new Set(KIND_TABLE.map((k) => k.kind));
  const manualCounts = new Map();
  for (const r of rows) {
    const k = kindNames.has(r.kind) ? r.kind : UNTYPED;
    manualCounts.set(k, (manualCounts.get(k) || 0) + 1);
  }
  for (const { kind, count } of present) ok(manualCounts.get(kind) === count, `kindsPresent count for '${kind}' matches a manual tally (${count})`);
  ok(present.reduce((s, p) => s + p.count, 0) === rows.length, "every row is counted exactly once across all kinds");
  const untypedIdx = present.findIndex((p) => p.kind === UNTYPED);
  ok(untypedIdx === -1 || untypedIdx === present.length - 1, "untyped, if present, is listed last");
}

console.log("\n[2] applyFilter's hidden counts and visible set are exhaustive and correct, fuzzed");
for (let trial = 0; trial < 30; trial++) {
  const rows = randomRows(1 + Math.floor(Math.random() * 30), KIND_TABLE);
  const kindNames = new Set(KIND_TABLE.map((k) => k.kind));
  const allKinds = [...new Set(rows.map((r) => (kindNames.has(r.kind) ? r.kind : UNTYPED)))];
  const excluded = allKinds.filter(() => Math.random() < 0.5);
  const { visible, hidden } = applyFilter(rows, excluded, KIND_TABLE);
  ok(visible.length + hidden.reduce((s, h) => s + h.count, 0) === rows.length, `trial ${trial}: visible + hidden accounts for every row (${rows.length})`);
  for (const row of visible) {
    const k = kindNames.has(row.kind) ? row.kind : UNTYPED;
    ok(!excluded.includes(k), `trial ${trial}: a visible row's kind (${k}) is never one of the excluded kinds`);
  }
  const hiddenByKind = new Map(hidden.map((h) => [h.kind, h.count]));
  for (const k of excluded) {
    const manual = rows.filter((r) => (kindNames.has(r.kind) ? r.kind : UNTYPED) === k).length;
    ok((hiddenByKind.get(k) || 0) === manual, `trial ${trial}: hidden count for excluded kind '${k}' matches a manual tally`);
  }
}

console.log("\n[3] filtering moves no grade: every visible row is the identical object, every declared/earned field untouched");
{
  const rows = randomRows(25, KIND_TABLE);
  const before = new Map(rows.map((r) => [r.identity, { declared_grade: r.declared_grade, earned_grade: r.earned_grade, kind: r.kind, statement: r.statement }]));
  const { visible } = applyFilter(rows, ["measurement"], KIND_TABLE);
  let untouched = true;
  for (const row of visible) {
    const b = before.get(row.identity);
    if (row.declared_grade !== b.declared_grade || row.earned_grade !== b.earned_grade || row.kind !== b.kind || row.statement !== b.statement) untouched = false;
  }
  ok(untouched, "every field of every visible row is byte-identical to before filtering");
  ok(visible.every((r) => rows.includes(r)), "every visible row is the SAME object reference as the input row (no copy, no mutation surface introduced)");
}

console.log("\n" + H);
if (fails === 0) console.log("verified: exclusion counts are always honest against a fuzzed graph, and the filter never touches a grade-bearing field.");
console.log(fails === 0 ? "check-filter: OK" : `check-filter: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
