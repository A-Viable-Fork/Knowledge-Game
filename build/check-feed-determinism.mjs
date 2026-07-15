// Role: verifies the null-objective order (api/feed.js) is genuinely deterministic: the same snapshot
//   produces the identical feed order across repeated runs, and across permutations of the input
//   records, since the order depends only on each claim's own grade and identity hash, never on
//   incidental array position. Grounds the "so the same snapshot always yields the identical feed"
//   half of spec Section 6's null-order definition.
// Contract: `node build/check-feed-determinism.mjs` exits non-zero on any divergence.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-FEED-DETERMINISM: same snapshot in, identical feed order out"); console.log(H);

const { createLocalProvider } = await import(join(ROOT, "vendor", "api", "providers", "local-provider.mjs"));
const { createClientApi } = await import(join(ROOT, "vendor", "api", "client-api.mjs"));
const { orderFeed } = await import(join(ROOT, "api", "feed.js"));

function shuffled(array, seed) {
  const a = array.slice();
  let s = seed;
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function orderOf(parsed) {
  const api = createClientApi(createLocalProvider(parsed));
  return orderFeed(api.read({})).map((r) => r.identity);
}

for (const name of ["knowledge-game", "math"]) {
  const fixture = join(ROOT, "app", "fixtures", `${name}.snapshot.json`);
  const original = JSON.parse(readFileSync(fixture, "utf8"));
  console.log(`\n[${name}] repeated runs over the unmodified snapshot`);
  const first = orderOf(original);
  for (let run = 0; run < 3; run++) {
    const again = orderOf(JSON.parse(readFileSync(fixture, "utf8")));
    ok(JSON.stringify(again) === JSON.stringify(first), `run ${run + 1}: identical order (${again.length} claims)`);
  }

  console.log(`\n[${name}] permutations of the input entries array`);
  for (let seed = 1; seed <= 3; seed++) {
    const permuted = JSON.parse(JSON.stringify(original));
    permuted.state.entries = shuffled(permuted.state.entries, seed * 7919);
    permuted.state.links = shuffled(permuted.state.links, seed * 104729);
    const order = orderOf(permuted);
    ok(JSON.stringify(order) === JSON.stringify(first), `permutation seed ${seed}: identical final order despite shuffled input arrays`);
  }
}

console.log("\n" + H);
if (fails === 0) console.log("verified: the null-objective order is identical across repeated runs and across permutations of the input records, for both fixtures.");
console.log(fails === 0 ? "check-feed-determinism: OK" : `check-feed-determinism: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
