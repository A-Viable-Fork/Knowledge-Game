// Role: verifies the virtual layer's own isolation guarantee (Phase KG-6b): the mirror is the
//   community's truth, and nothing a device's own outbox or virtual lens computes ever mutates it.
//   Fuzzes a range of outbox and lens states over a real fixture snapshot and proves, to the byte,
//   that every actual grade and the mirror's own store stay identical throughout, and that no virtual
//   record's identity or statement ever appears inside the mirror's own state.
// Contract: `node build/check-virtual-isolation.mjs` exits non-zero on any divergence, naming it.
// Invariant: api/virtual.js's virtualRowsFor and computeLensImpact are the two functions under test;
//   both are called repeatedly, with the real community's own api.read() output and raw.state
//   serialized before and after every call and compared byte-for-byte (JSON.stringify equality, over
//   the real, canonical-form-bearing objects, not a hand-rolled diff).
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-VIRTUAL-ISOLATION: the mirror is the community's truth"); console.log(H);

const { createLocalProvider } = await import(join(ROOT, "vendor", "api", "providers", "local-provider.mjs"));
const { createClientApi } = await import(join(ROOT, "vendor", "api", "client-api.mjs"));
const { claimRecord } = await import(join(ROOT, "vendor", "kernel", "schema", "records.mjs"));
const { virtualRowsFor, computeLensImpact } = await import(join(ROOT, "api", "virtual.js"));

const raw = JSON.parse(readFileSync(join(ROOT, "app", "fixtures", "knowledge-game.snapshot.json"), "utf8"));
const provider = createLocalProvider(raw);
const api = createClientApi(provider);
const community = { api, kernelId: raw.kernel_id, snapshotHash: raw.snapshot_hash, raw, url: "fixture" };

function fuzzEntry(i, status) {
  const claim = claimRecord({
    kind: "measurement", statement: `fuzz claim ${i}: this device's own draft, never the mirror's`,
    source_id: "contributor:unsourced", contributor_id: "fuzzer", declared_grade: "asserted",
  });
  return {
    contributionId: `fuzz-contribution-${i}`,
    communityId: "knowledge-game",
    bundle: { proposal: { entries: [claim], links: [] }, receipt: { decision: "accepted", proposed_identity: claim.identity } },
    extraSources: [],
    status,
    queuedAt: Date.now() - i * 1000,
    lastRegate: status === "submitted" ? { at: Date.now(), snapshotHash: raw.snapshot_hash, receipt: { decision: "accepted", proposed_identity: claim.identity } } : null,
  };
}

const STATUS_CYCLE = ["queued", "submitted", "draft"];
const fuzzedEntries = Array.from({ length: 12 }, (_, i) => fuzzEntry(i, STATUS_CYCLE[i % STATUS_CYCLE.length]));

console.log("\n[1] baseline: the real read() output and the mirror's own state, before anything virtual runs");
const baselineRead = JSON.stringify(api.read({}));
const baselineState = JSON.stringify(raw.state);

console.log("\n[2] fuzzing virtualRowsFor and computeLensImpact over many outbox subsets and orders");
for (let trial = 0; trial < 20; trial++) {
  const subset = fuzzedEntries.filter((_, i) => (trial + i) % 3 !== 0); // a different subset each trial
  const shuffled = subset.slice().sort(() => Math.random() - 0.5); // and a different order each trial

  const virtualRows = virtualRowsFor(shuffled);
  ok(virtualRows.every((r) => r.virtual === true), `trial ${trial}: every row virtualRowsFor produced is marked virtual: true`);

  const impact = computeLensImpact(community, shuffled);
  ok(impact instanceof Map, `trial ${trial}: computeLensImpact returns a Map`);

  ok(JSON.stringify(api.read({})) === baselineRead, `trial ${trial}: api.read() is still byte-identical to the pre-fuzz baseline`);
  ok(JSON.stringify(raw.state) === baselineState, `trial ${trial}: the mirror's own state object is still byte-identical to the pre-fuzz baseline`);
}

console.log("\n[3] no virtual record's identity ever appears inside the mirror's own state");
const mirrorIdentities = new Set((raw.state.entries || []).map((e) => e.identity));
for (const entry of fuzzedEntries) {
  const claim = entry.bundle.proposal.entries[0];
  ok(!mirrorIdentities.has(claim.identity), `fuzz claim's identity (${claim.identity.slice(0, 12)}...) never entered the mirror's own state.entries`);
}
const mirrorStatements = JSON.stringify(raw.state);
for (const entry of fuzzedEntries) {
  const claim = entry.bundle.proposal.entries[0];
  ok(!mirrorStatements.includes(claim.statement), `fuzz claim's statement text never appears anywhere in the mirror's serialized state`);
}

console.log("\n[4] a final full read/state comparison after all fuzzing");
ok(JSON.stringify(api.read({})) === baselineRead, "api.read() is byte-identical to the baseline after the full fuzz run");
ok(JSON.stringify(raw.state) === baselineState, "the mirror's own state is byte-identical to the baseline after the full fuzz run");

console.log("\n" + H);
if (fails === 0) console.log("verified: fuzzed outbox and lens states never mutate the real read() output or the mirror's own state, and no virtual record's identity or statement ever enters it.");
console.log(fails === 0 ? "check-virtual-isolation: OK" : `check-virtual-isolation: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
