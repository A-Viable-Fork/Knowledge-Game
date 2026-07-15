// Role: verifies the objective vector's own contract (claim 2). No hidden default: an omitted or
//   empty vector is exactly the null order and renders as "null order". Same snapshot plus the same
//   vector yields the identical order across runs and across permutations of the input records.
//   Every position's why-answer reproduces from the component scores the ordering itself computed.
// Contract: `node build/check-objective.mjs` exits non-zero on any divergence, naming it.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-OBJECTIVE: no hidden default, deterministic, explainable"); console.log(H);

const { createLocalProvider } = await import(join(ROOT, "vendor", "api", "providers", "local-provider.mjs"));
const { createClientApi } = await import(join(ROOT, "vendor", "api", "client-api.mjs"));
const { orderByObjective, explainPosition } = await import(join(ROOT, "api", "ranking.js"));
const { orderFeed } = await import(join(ROOT, "api", "feed.js"));

function shuffled(array, seed) {
  const a = array.slice();
  let s = seed;
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

for (const name of ["knowledge-game", "math"]) {
  const raw = JSON.parse(readFileSync(join(ROOT, "app", "fixtures", `${name}.snapshot.json`), "utf8"));
  const api = createClientApi(createLocalProvider(raw));
  const rows = api.read({});
  const recon = api.reconciliations({});

  console.log(`\n[${name}] no hidden default`);
  const withUndefined = orderByObjective(rows, undefined, raw.state, { reconciliations: recon }).map((r) => r.identity);
  const withEmpty = orderByObjective(rows, {}, raw.state, { reconciliations: recon }).map((r) => r.identity);
  const nullOrder = orderFeed(rows).map((r) => r.identity);
  ok(JSON.stringify(withUndefined) === JSON.stringify(nullOrder), "an omitted vector renders exactly the null order");
  ok(JSON.stringify(withEmpty) === JSON.stringify(nullOrder), "an empty vector renders exactly the null order");
  const zeroOrdered = orderByObjective(rows, {}, raw.state, { reconciliations: recon });
  ok(explainPosition(zeroOrdered[0], 0).startsWith("null order:"), "the zero vector's why-answer says 'null order'");

  console.log(`\n[${name}] same snapshot plus same vector: identical order across runs and permutations`);
  const weights = { "learn-efficiently": 2, neglected: 1, novelty: 3 };
  const first = orderByObjective(rows, weights, raw.state, { reconciliations: recon }).map((r) => r.identity);
  for (let run = 0; run < 3; run++) {
    const again = orderByObjective(rows, weights, raw.state, { reconciliations: recon }).map((r) => r.identity);
    ok(JSON.stringify(again) === JSON.stringify(first), `run ${run + 1}: identical order`);
  }
  for (let seed = 1; seed <= 3; seed++) {
    const permutedState = { entries: shuffled(raw.state.entries, seed * 7919), links: shuffled(raw.state.links, seed * 104729) };
    const permutedRows = shuffled(rows, seed * 65537);
    const order = orderByObjective(permutedRows, weights, permutedState, { reconciliations: recon }).map((r) => r.identity);
    ok(JSON.stringify(order) === JSON.stringify(first), `permutation seed ${seed}: identical order despite shuffled input arrays`);
  }

  console.log(`\n[${name}] every position's why-answer reproduces from its own stored component scores`);
  const ordered = orderByObjective(rows, weights, raw.state, { reconciliations: recon });
  let allReproduce = true;
  ordered.forEach((row, i) => {
    const explanation = explainPosition(row, i);
    const recomputedFromStorage = explainPosition({ _objectiveContributions: row._objectiveContributions }, i);
    if (explanation !== recomputedFromStorage) allReproduce = false;
  });
  ok(allReproduce, "every card's why-answer is a pure function of its own _objectiveContributions, nothing external");
}

console.log("\n" + H);
if (fails === 0) console.log("verified: the zero vector is the null order with no hidden default, ordering is deterministic under runs and permutations, and every why-answer reproduces from stored scores.");
console.log(fails === 0 ? "check-objective: OK" : `check-objective: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
