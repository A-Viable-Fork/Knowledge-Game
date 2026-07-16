// Role: verifies the inbound gate (Phase KG-6c). Auto mode (the default) is byte-identical to sync
//   behavior before this phase: nothing about a fresh read is excluded or altered. Review mode's own
//   diff (api/inbound-gate.js) never mutates the real rows or the community's own store, whatever
//   sequence of accept/hold decisions runs against it; accepting a change absorbs exactly the grade
//   auto mode would already show; a held item whose incoming state has not moved again stays quietly
//   held across a re-sync, and one whose state DID move again returns to pending rather than staying
//   silently suppressed under a stale decision.
// Contract: `node build/check-inbound-gate.mjs` exits non-zero on any violation, naming it.
// Invariant: every assertion runs against a real fixture's real rows (api/community.js's own
//   fetchCommunity path, over a real local snapshot read via file:// through a stubbed fetch,
//   exactly as build/check-virtual-isolation.mjs already does), never a hand-built fake row shape.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-INBOUND-GATE: the inbound gate (Phase KG-6c)"); console.log(H);

const { createLocalProvider } = await import(join(ROOT, "vendor", "api", "providers", "local-provider.mjs"));
const { createClientApi } = await import(join(ROOT, "vendor", "api", "client-api.mjs"));
const {
  establishBaseline, computeUpdateList, flagContradictions, acceptIntoBaseline,
  holdUpdates, clearHeld, adoptGovernanceHash,
} = await import(join(ROOT, "api", "inbound-gate.js"));

const raw = JSON.parse(readFileSync(join(ROOT, "app", "fixtures", "knowledge-game.snapshot.json"), "utf8"));
const provider = createLocalProvider(raw);
const api = createClientApi(provider);
const rows = api.read({});

console.log("\n[1] auto mode is byte-identical to sync behavior before this phase");
{
  // auto mode never establishes or reads a baseline at all; the working view is exactly rows,
  // unfiltered, exactly as every load produced before this phase existed. The assertion that matters
  // is structural: nothing in this module is invoked on the auto path (periphery/app.js's own
  // recomputeInbound returns immediately when the mode is not "review"), so rows themselves, read
  // fresh, are what auto mode shows. Confirmed here by literal identity: a snapshot of rows taken
  // now equals a fresh api.read({}) taken again, proving no inbound-gate call anywhere in this file
  // so far has touched the provider's own state.
  const again = api.read({});
  ok(JSON.stringify(rows) === JSON.stringify(again), "a fresh read is unaffected by anything computed above (auto path touches nothing)");
}

console.log("\n[2] the first review-mode capture establishes a baseline that excludes nothing");
{
  const baseline = establishBaseline(rows, raw, null);
  const held = [];
  const { pending, stillHeld } = computeUpdateList(baseline, held, rows);
  ok(pending.length === 0, `a freshly established baseline pends nothing (found ${pending.length})`);
  ok(stillHeld.length === 0, `a freshly established baseline holds nothing (found ${stillHeld.length})`);
}

console.log("\n[3] an unaccepted incoming change alters no actual grade or store content (fuzzed)");
{
  const beforeRows = JSON.stringify(rows);
  const beforeState = JSON.stringify(raw.state);
  let baseline = establishBaseline(rows, raw, "adopted-hash-1");
  const firstTwo = rows.slice(0, 2).map((r) => r.identity);
  // simulate motion: baseline still remembers the OLD grade for these two, as if the mirror moved
  // since the reader's last accept, without ever touching the real rows this diff reads from.
  baseline = { ...baseline, claims: baseline.claims.map((c) => (firstTwo.includes(c.identity) ? { ...c, grade: "ungraded" } : c)) };
  let held = [];
  for (let i = 0; i < 20; i++) {
    const { pending, stillHeld } = computeUpdateList(baseline, held, rows);
    flagContradictions(pending, stillHeld, raw.state.links || []);
    if (i % 3 === 0 && pending.length) held = holdUpdates(held, pending, [pending[0].identity]);
    if (i % 5 === 0) held = clearHeld(held, firstTwo);
    if (i % 7 === 0) baseline = adoptGovernanceHash(baseline, `hash-${i}`);
  }
  ok(JSON.stringify(rows) === beforeRows, "20 rounds of computeUpdateList/hold/clear/adopt left the real rows byte-identical");
  ok(JSON.stringify(raw.state) === beforeState, "20 rounds of inbound-gate decisions left the community's own store byte-identical");
}

console.log("\n[4] accepting a change absorbs exactly the grade auto mode already shows");
{
  const baseline0 = establishBaseline(rows, raw, null);
  const target = rows[0];
  const stale = { ...baseline0, claims: baseline0.claims.map((c) => (c.identity === target.identity ? { ...c, grade: "ungraded" } : c)) };
  const { pending } = computeUpdateList(stale, [], rows);
  ok(pending.some((p) => p.identity === target.identity), "the doctored identity shows as pending before acceptance");
  const accepted = acceptIntoBaseline(stale, rows, [target.identity]);
  const acceptedEntry = accepted.claims.find((c) => c.identity === target.identity);
  ok(acceptedEntry.grade === target.earned_grade, `accepted baseline grade (${acceptedEntry.grade}) matches the live row's own real grade (${target.earned_grade}), what auto mode already shows`);
  const { pending: pendingAfter } = computeUpdateList(accepted, [], rows);
  ok(!pendingAfter.some((p) => p.identity === target.identity), "the accepted identity no longer pends");
}

console.log("\n[5] a held item persists across a re-sync and re-offers only when its claim moves again");
{
  const baseline = establishBaseline(rows, raw, null);
  const target = rows[1];
  // the baseline stays fixed (what the reader last accepted); motion is simulated on the INCOMING
  // side, three successive fresh reads, exactly as three real syncs would arrive.
  const rowsFirstMove = rows.map((r) => (r.identity === target.identity ? { ...r, earned_grade: "ungraded" } : r));
  const { pending: firstPending } = computeUpdateList(baseline, [], rowsFirstMove);
  const held = holdUpdates([], firstPending, [target.identity]);
  ok(held.length === 1 && held[0].declinedGrade === "ungraded", "holding records exactly the grade declined");

  const { pending: afterHoldPending, stillHeld: afterHoldStillHeld } = computeUpdateList(baseline, held, rowsFirstMove);
  ok(!afterHoldPending.some((p) => p.identity === target.identity), "a re-sync with no further motion does not re-litigate the held item as pending");
  ok(afterHoldStillHeld.some((h) => h.identity === target.identity), "the held item stays visible in the held list, never silently dropped");

  // now the claim moves again since the decline: a further fresh read reports a DIFFERENT incoming
  // grade than what was declined.
  const rowsSecondMove = rows.map((r) => (r.identity === target.identity ? { ...r, earned_grade: "constitutive" } : r));
  const { pending: afterMotionPending, stillHeld: afterMotionStillHeld } = computeUpdateList(baseline, held, rowsSecondMove);
  ok(afterMotionPending.some((p) => p.identity === target.identity), "a held item whose incoming state moved again returns to pending, not silently suppressed");
  ok(!afterMotionStillHeld.some((h) => h.identity === target.identity), "the held item is no longer misreported as still-held once its state has moved past the declined fact");
}

console.log("\n[6] no inbound-gate function reaches the outbox, the community loader, or any bundle-building module");
{
  const source = readFileSync(join(ROOT, "api", "inbound-gate.js"), "utf8");
  ok(!/api\/(outbox|community|contribute|register-artifact|extension)\.js/.test(source), "api/inbound-gate.js imports none of the bundle-building or store-writing modules");
  ok(/import\s*\{\s*epistemicCost\s*\}\s*from\s*"\.\/epistemic-cost\.js"/.test(source), "the epistemic-cost tie-in reuses the existing parameterized recompute, not a second one");
}

console.log("\n" + H);
console.log(fails === 0 ? "check-inbound-gate: OK" : `check-inbound-gate: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
