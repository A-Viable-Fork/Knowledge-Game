// Role: the no-grade-motion theorem's next instance (claim 1). Fuzzes objective vectors over both
//   fixtures and asserts every grade, receipt-shape read, and the underlying support structure stays
//   byte-identical before and after any number of ranking passes; separately verifies statically that
//   api/ranking.js and api/feed.js import nothing that can write (no vault, no provider write
//   surface, no vendor module beyond the read-only lattice order).
// Contract: `node build/check-ranking-separation.mjs` exits non-zero on any mutation or forbidden
//   import, naming it.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-RANKING-SEPARATION: ranking moves nothing but positions"); console.log(H);

const { createLocalProvider } = await import(join(ROOT, "vendor", "api", "providers", "local-provider.mjs"));
const { createClientApi } = await import(join(ROOT, "vendor", "api", "client-api.mjs"));
const { orderByObjective, COMPONENTS } = await import(join(ROOT, "api", "ranking.js"));

function rngFrom(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}
function randomWeights(rand) {
  const w = {};
  for (const c of COMPONENTS) if (rand() > 0.5) w[c.id] = Math.floor(rand() * 4);
  return w;
}

console.log("\n[1] fuzzing objective vectors over both fixtures: no grade, receipt read, or support structure moves");
for (const name of ["knowledge-game", "math"]) {
  const raw = JSON.parse(readFileSync(join(ROOT, "app", "fixtures", `${name}.snapshot.json`), "utf8"));
  const before = JSON.stringify(raw); // the whole snapshot, byte for byte: entries, links, sources, kinds
  const api = createClientApi(createLocalProvider(raw));
  const readBefore = JSON.stringify(api.read({}));
  const reconBefore = JSON.stringify(api.reconciliations({}));
  const gapsBefore = JSON.stringify(api.gaps({}));

  const rand = rngFrom(name.length * 7919 + 13);
  for (let trial = 0; trial < 25; trial++) {
    const weights = randomWeights(rand);
    const rows = api.read({});
    orderByObjective(rows, weights, raw.state, { reconciliations: api.reconciliations({}) });
  }

  const after = JSON.stringify(raw);
  const readAfter = JSON.stringify(api.read({}));
  const reconAfter = JSON.stringify(api.reconciliations({}));
  const gapsAfter = JSON.stringify(api.gaps({}));

  ok(before === after, `${name}: the raw snapshot (entries, links, sources, kinds) is byte-identical after 25 ranking passes`);
  ok(readBefore === readAfter, `${name}: api.read() (every grade) is byte-identical after 25 ranking passes`);
  ok(reconBefore === reconAfter, `${name}: api.reconciliations() is byte-identical after 25 ranking passes`);
  ok(gapsBefore === gapsAfter, `${name}: api.gaps() is byte-identical after 25 ranking passes`);
}

console.log("\n[2] the ranker's own modules import nothing that can write");
const ALLOWED = new Set(["../vendor/kernel/schema/confidence.mjs", "./feed.js"]);
for (const file of ["api/ranking.js", "api/feed.js"]) {
  const source = readFileSync(join(ROOT, file), "utf8");
  const specs = [...source.matchAll(/import\s+[^"']*["']([^"']+)["']/g)].map((m) => m[1]);
  for (const spec of specs) {
    ok(ALLOWED.has(spec), `${file}: import "${spec}" is read-only (no vault, no provider write surface)`);
  }
}

console.log("\n" + H);
if (fails === 0) console.log("verified: ranking mutates no grade, receipt, or support structure across a fuzz of objective vectors, and imports nothing that can write.");
console.log(fails === 0 ? "check-ranking-separation: OK" : `check-ranking-separation: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
