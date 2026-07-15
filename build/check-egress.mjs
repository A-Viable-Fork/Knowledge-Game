// Role: runs the data layer (api/community.js) under a stubbed global fetch and asserts every
//   requested URL is one of manifests/network.json's declared destinations. Grounds claim 7 ("no
//   undeclared network egress exists").
// Contract: `node build/check-egress.mjs` exits non-zero if any request targets an undeclared
//   destination, naming the URL.
// Invariant: the stub answers every request with the real fixture content read from disk, so the
//   data layer runs its real code path (fetch, hash verification, provider construction) rather than
//   a mocked shortcut; only the network boundary itself is intercepted.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-EGRESS: every request the data layer makes is a declared destination"); console.log(H);

const manifest = JSON.parse(readFileSync(join(ROOT, "manifests", "network.json"), "utf8"));
const declared = new Set(manifest.allowed_egress_destinations.map((d) => d.path));
console.log(`\ndeclared destinations: ${[...declared].join(", ")}`);

const requested = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const u = String(url);
  requested.push(u);
  // resolve the requested path against app/, where the data layer's callers fetch relative paths
  // (e.g. "fixtures/knowledge-game.snapshot.json"), and answer with the real file's content.
  const rel = u.replace(/^https?:\/\/[^/]+\//, "");
  const onDisk = join(ROOT, "app", rel);
  try {
    const body = readFileSync(onDisk, "utf8");
    return { ok: true, status: 200, json: async () => JSON.parse(body) };
  } catch (e) {
    return { ok: false, status: 404, json: async () => { throw e; } };
  }
};

console.log("\n[1] fetching every declared destination through the real data layer");
const { fetchCommunity } = await import(join(ROOT, "api", "community.js"));
for (const dest of manifest.allowed_egress_destinations) {
  try {
    await fetchCommunity(dest.path);
    ok(true, `fetchCommunity(${dest.path}) ran without throwing`);
  } catch (e) {
    ok(false, `fetchCommunity(${dest.path}) threw: ${e.message}`);
  }
}

console.log("\n[2] every URL actually requested is a declared destination");
for (const u of requested) {
  const rel = u.replace(/^https?:\/\/[^/]+\//, "");
  ok(declared.has(rel), `requested "${u}" resolves to a declared destination`);
}

globalThis.fetch = realFetch;

console.log("\n" + H);
if (fails === 0) console.log("verified: every request the data layer made targets a destination manifests/network.json declares.");
console.log(fails === 0 ? "check-egress: OK" : `check-egress: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
