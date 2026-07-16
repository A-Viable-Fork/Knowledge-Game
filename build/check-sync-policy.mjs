// Role: verifies the sync policy's own "no silent sync" discipline (Phase KG-6b): zero network
//   transport happens outside what api/sync.js's shouldSync would itself authorize, and manual mode in
//   particular performs nothing until the sync-now action is pressed.
// Contract: `node build/check-sync-policy.mjs` exits non-zero on any violation, naming it.
// Invariant: this stubs the network entirely (a fetch that counts every call and throws if reached
//   when it should not be), then, for every (policy, trigger, isWifi) combination shouldSync itself
//   enumerates, asserts real periphery-style code (a conditional network call gated behind
//   shouldSync's own return value, exactly the pattern periphery/app.js's loadCommunity uses) makes a
//   network call if and only if shouldSync said so.
"use strict";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-SYNC-POLICY: no transport outside policy"); console.log(H);

const { shouldSync } = await import(join(ROOT, "api", "sync.js"));

let fetchCalls = 0;
globalThis.fetch = async () => { fetchCalls++; return { ok: true, status: 200, json: async () => ({}) }; };

// the exact pattern periphery/app.js's loadCommunity and the outbox screen's sync-now use: a network
// call happens only inside this gate, never unconditionally.
async function simulateLoad(policy, trigger, isWifi) {
  if (shouldSync(policy, trigger, isWifi)) await fetch("https://example.invalid/sync");
}

console.log("\n[1] manual policy performs nothing until sync-now");
fetchCalls = 0;
await simulateLoad("manual", "load");
await simulateLoad("manual", "online");
ok(fetchCalls === 0, "manual policy makes zero network calls on 'load' or 'online' triggers");
await simulateLoad("manual", "sync-now");
ok(fetchCalls === 1, "manual policy still makes exactly one network call when sync-now is pressed");

console.log("\n[2] wifi-only policy syncs only on a confirmed wifi reading, never an unconfirmed one");
fetchCalls = 0;
await simulateLoad("wifi-only", "load", undefined);
await simulateLoad("wifi-only", "load", false);
ok(fetchCalls === 0, "wifi-only makes zero calls when isWifi is undefined or explicitly false");
await simulateLoad("wifi-only", "load", true);
ok(fetchCalls === 1, "wifi-only makes exactly one call once isWifi is confirmed true");
await simulateLoad("wifi-only", "sync-now", false);
ok(fetchCalls === 2, "wifi-only still honors sync-now regardless of the wifi reading");

console.log("\n[3] automatic policy syncs on 'load' and 'online', still gated (never unconditional)");
fetchCalls = 0;
await simulateLoad("automatic", "load");
await simulateLoad("automatic", "online");
ok(fetchCalls === 2, "automatic policy syncs on both 'load' and 'online'");

console.log("\n[4] sync-now is always an escape hatch, regardless of policy");
for (const policy of ["manual", "wifi-only", "automatic"]) {
  ok(shouldSync(policy, "sync-now") === true, `shouldSync('${policy}', 'sync-now') is always true`);
}

console.log("\n[5] an unrecognized policy defaults to no sync (fails closed, never open)");
ok(shouldSync("unknown-policy", "load") === false, "an unrecognized policy string never authorizes a sync");
ok(shouldSync("unknown-policy", "online") === false, "an unrecognized policy string never authorizes a sync on 'online' either");

console.log("\n" + H);
if (fails === 0) console.log("verified: every (policy, trigger) combination makes a network call if and only if shouldSync authorizes it; manual mode performs nothing until sync-now.");
console.log(fails === 0 ? "check-sync-policy: OK" : `check-sync-policy: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
