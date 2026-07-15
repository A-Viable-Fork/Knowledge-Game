// Role: verifies the provider seam (claim 15: "a client can switch providers without presentation
//   changes"). A second, independently-constructed in-memory provider, built directly from the
//   vendored gate and grounding primitives rather than by importing api/providers/local-provider.mjs,
//   answers the same propose/read contract. Its read() output is compared against the vendored local
//   provider's, and both are fed through the same ranking function to prove the periphery's own logic
//   (ordering, and by extension rendering, which is a pure function of ordered row data) produces the
//   identical result regardless of which provider answered.
// Contract: `node build/check-provider-contract.mjs` exits non-zero on any divergence.
// Invariant: the second provider computes no grade of its own; it calls the same real
//   storeViewOf/decide primitives vendor/kernel exposes, just assembled independently of
//   local-provider.mjs's own code, so this proves the CONTRACT is what the periphery depends on, not
//   one specific module. The comparison is at the data layer (read() output and ordered identity
//   sequence), not a rendered-DOM diff: this repository's checks run in plain Node, with no DOM
//   available, so a byte-for-byte HTML comparison is not performed here. Since periphery/card.js's
//   renderCard is a pure function of exactly this row data (no field it does not read), an identical
//   row sequence implies an identical render; the actual visual rendering was confirmed separately by
//   a browser smoke test (see the report), not re-claimed as proven by this headless check.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-PROVIDER-CONTRACT: the periphery is provider-agnostic"); console.log(H);

const { createLocalProvider } = await import(join(ROOT, "vendor", "api", "providers", "local-provider.mjs"));
const { createClientApi } = await import(join(ROOT, "vendor", "api", "client-api.mjs"));
const { makeSourceTable, makeKindTable } = await import(join(ROOT, "vendor", "kernel", "schema", "tables.mjs"));
const { storeViewOf } = await import(join(ROOT, "vendor", "kernel", "store", "decay.mjs"));
const { orderByObjective } = await import(join(ROOT, "api", "ranking.js"));

// the second provider: built directly from the vendored primitives, never importing
// local-provider.mjs, so it is a structurally independent implementation of the same contract.
function makeSecondProvider(raw) {
  const tables = { sourceTable: makeSourceTable(raw.sources), kindTable: makeKindTable(raw.kinds) };
  const view = storeViewOf(raw.state, tables);
  function project(e) {
    const g = view.earnedByIdentity.get(e.identity) || {};
    return { identity: e.identity, kind: e.kind, statement: e.statement, source_id: e.source_id, declared_grade: e.declared_grade, earned_grade: g.earned || "ungraded", in_force: g.inForce !== false };
  }
  return {
    kind: "second-in-memory",
    read: (query) => {
      query = query || {};
      let claims = (raw.state.entries || []).map(project);
      if (query.identity) claims = claims.filter((c) => c.identity === query.identity);
      return claims;
    },
    propose: () => { throw new Error("second-provider: propose is not exercised by this contract test"); },
    robustness: () => [], gaps: () => [], characterizedGaps: () => [], reconciliations: () => [],
  };
}

for (const name of ["knowledge-game", "math"]) {
  console.log(`\n[${name}]`);
  const raw = JSON.parse(readFileSync(join(ROOT, "app", "fixtures", `${name}.snapshot.json`), "utf8"));
  const apiA = createClientApi(createLocalProvider(raw));
  const apiB = createClientApi(makeSecondProvider(raw));

  ok(apiA.providerKind() === "local", "provider A reports its real kind ('local')");
  ok(apiB.providerKind() === "second-in-memory", "provider B reports its real kind ('second-in-memory'), diagnostic only");

  const readA = apiA.read({});
  const readB = apiB.read({});
  ok(JSON.stringify(readA) === JSON.stringify(readB), "read() is byte-identical between the two independently-constructed providers");

  const orderA = orderByObjective(readA, {}, raw.state, { reconciliations: [] }).map((r) => r.identity);
  const orderB = orderByObjective(readB, {}, raw.state, { reconciliations: [] }).map((r) => r.identity);
  ok(JSON.stringify(orderA) === JSON.stringify(orderB), "the null-order ranking of provider A's and provider B's output is identical");

  const weights = { "learn-efficiently": 2, neglected: 1 };
  const weightedA = orderByObjective(readA, weights, raw.state, { reconciliations: [] }).map((r) => r.identity);
  const weightedB = orderByObjective(readB, weights, raw.state, { reconciliations: [] }).map((r) => r.identity);
  ok(JSON.stringify(weightedA) === JSON.stringify(weightedB), "a weighted-objective ranking of both providers' output is identical");
}

console.log("\n" + H);
if (fails === 0) console.log("verified: an independently-constructed second provider satisfying the same contract produces byte-identical reads and identical rankings; renderCard is a pure function of this data (visual confirmation: browser smoke test, reported separately).");
console.log(fails === 0 ? "check-provider-contract: OK" : `check-provider-contract: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
