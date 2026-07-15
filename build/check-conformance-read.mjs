// Role: the read half of the second-client conformance check (claim 9: "this client holds no
//   capability any client with the snapshot lacks"). An independent minimal client, importing only
//   vendor/api/* (deliberately never this app's own api/community.js or api/feed.js), fetches the
//   same fixture, verifies the same hash, and derives grounding for every claim using nothing but the
//   vendored public contract. Its results are compared byte-identically against what the app's own
//   data layer derives from the same file. This narrows claim 9's gap to the write half (Phase B: an
//   independent client's exported contribution passing the same admission path).
// Contract: `node build/check-conformance-read.mjs` exits non-zero on any mismatch, naming the claim.
// Invariant: the "independent minimal client" section of this file imports only vendor/api/* and
//   node built-ins; it never imports anything from this repository's own api/ or periphery/. The
//   "app" side actually exercises this app's real api/community.js (under a stubbed fetch, so this
//   runs headless), never a second hand-written copy of the same vendor calls.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-CONFORMANCE-READ: an independent minimal client reproduces the app's reads"); console.log(H);

const FIXTURE = join(ROOT, "app", "fixtures", "knowledge-game.snapshot.json");

// ---- the independent minimal client: vendor/api/* only, never this app's own api/ ----
async function independentClientRead(fixturePath) {
  const { hashOf } = await import(join(ROOT, "vendor", "kernel", "schema", "canonical.mjs"));
  const { createLocalProvider } = await import(join(ROOT, "vendor", "api", "providers", "local-provider.mjs"));
  const { createClientApi } = await import(join(ROOT, "vendor", "api", "client-api.mjs"));

  const parsed = JSON.parse(readFileSync(fixturePath, "utf8"));
  const recomputed = hashOf({ state: parsed.state, sources: parsed.sources, kinds: parsed.kinds });
  if (recomputed !== parsed.snapshot_hash) throw new Error(`hash mismatch: declared ${parsed.snapshot_hash}, recomputed ${recomputed}`);

  const api = createClientApi(createLocalProvider(parsed));
  return { rows: api.read({}), hash: recomputed };
}

// ---- the app's own data layer, actually exercised through api/community.js under a fetch stub ----
async function appClientRead(fixturePath) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => JSON.parse(readFileSync(fixturePath, "utf8")) });
  try {
    const { fetchCommunity } = await import(join(ROOT, "api", "community.js"));
    const community = await fetchCommunity("fixtures/knowledge-game.snapshot.json");
    return { rows: community.api.read({}), hash: community.snapshotHash };
  } finally {
    globalThis.fetch = realFetch;
  }
}

console.log("\n[1] both clients verify the same hash and derive the same grounding");
const independent = await independentClientRead(FIXTURE);
const app = await appClientRead(FIXTURE);
ok(independent.hash === app.hash, `both compute the same snapshot hash (${independent.hash.slice(0, 16)}...)`);
ok(independent.rows.length === 20, `the independent client reads 20 claims (got ${independent.rows.length})`);
ok(JSON.stringify(independent.rows) === JSON.stringify(app.rows), "the independent client's read is byte-identical (JSON-stable) to the app's data layer's read");

console.log("\n[2] every claim's earned grade matches between the two, one comparison per claim");
const appByIdentity = new Map(app.rows.map((r) => [r.identity, r]));
for (const row of independent.rows) {
  const counterpart = appByIdentity.get(row.identity);
  ok(!!counterpart && counterpart.earned_grade === row.earned_grade, `${row.identity.slice(0, 12)}... earns '${row.earned_grade}' identically in both clients`);
}

console.log("\n" + H);
if (fails === 0) console.log("verified: an independent minimal client built from vendor/api/* alone reproduces the app's reads byte-identically, narrowing claim 9's gap to the write half (Phase B).");
console.log(fails === 0 ? "check-conformance-read: OK" : `check-conformance-read: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
