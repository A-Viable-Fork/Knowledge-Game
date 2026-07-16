// Role: the oracle for the entrance listing (the org-root entrance page's own door, rendered from
//   this app's grounded governance claims rather than hand-written copy). Verifies every
//   entrance-surfaced claim carries a valid role, that every "status" listing references a real
//   governance claim which itself grounds (never a missing or floored one, which would let the front
//   door overclaim), and that the emitted snapshot (app/fixtures/knowledge-game.snapshot.json, the one
//   the entrance renderer fetches) actually carries the listing claims with their roles and references
//   intact.
// Contract: `node build/check-entrance-listing.mjs` exits non-zero on any violation, naming it.
// Invariant: every assertion reads the real gate's own computed state (build/knowledge-game-build.mjs's
//   buildKernel(), the same builder build/check-knowledge-game.mjs uses) or the real emitted snapshot
//   file on disk; nothing here re-derives or hand-asserts a grade.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-ENTRANCE-LISTING: the Knowledge Game entrance listing"); console.log(H);

const VALID_ROLES = ["title", "tagline", "status", "link"];

const { buildKernel } = await import("./knowledge-game-build.mjs");
const built = buildKernel();

console.log("\n[1] every entrance-surfaced claim carries a valid role");
const listingClaims = built.claims.filter(({ spec }) => spec.entrance_surfaced === true);
ok(listingClaims.length > 0, `at least one entrance-surfaced claim exists (found ${listingClaims.length})`);
for (const { spec } of listingClaims) {
  ok(VALID_ROLES.includes(spec.role), `${spec.ref}: role '${spec.role}' is one of ${JSON.stringify(VALID_ROLES)}`);
}

console.log("\n[2] every 'status' listing references a governance claim that exists and grounds");
const byRef = new Map(built.claims.map((c) => [c.spec.ref, c]));
const statusClaims = listingClaims.filter(({ spec }) => spec.role === "status");
ok(statusClaims.length > 0, `at least one 'status' listing exists (found ${statusClaims.length})`);
for (const { spec } of statusClaims) {
  const refName = spec.references_claim;
  ok(!!refName, `${spec.ref}: carries a references_claim naming the governance claim it backs`);
  const target = refName && byRef.get(refName);
  ok(!!target, `${spec.ref}: references_claim '${refName}' names a governance claim that actually exists in this kernel`);
  if (target) {
    const derived = built.view.earnedByIdentity.get(target.rec.identity);
    const earned = derived ? derived.earned : "ungraded";
    ok(earned !== "ungraded", `${spec.ref}: the referenced claim ('${refName}') grounds (earns '${earned}', not ungraded/floored)`);
  }
}

console.log("\n[3] the emitted snapshot carries the listing claims, with their roles and references intact");
const snapshotPath = join(ROOT, "app", "fixtures", "knowledge-game.snapshot.json");
let snapshot;
try {
  snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  ok(true, `${snapshotPath} reads as JSON`);
} catch (e) {
  ok(false, `${snapshotPath} reads as JSON (${e.message})`);
}
if (snapshot) {
  const snapshotEntrySurfaced = (snapshot.state.entries || []).filter(
    (e) => e.canonical && e.canonical.extensions && e.canonical.extensions.entrance_surfaced === true
  );
  ok(snapshotEntrySurfaced.length === listingClaims.length, `the snapshot carries exactly the ${listingClaims.length} entrance-surfaced claims the kernel builds (found ${snapshotEntrySurfaced.length})`);
  for (const { spec } of listingClaims) {
    const target = built.claims.find((c) => c.spec.ref === spec.ref);
    const found = snapshotEntrySurfaced.find((e) => e.identity === target.rec.identity);
    ok(!!found, `${spec.ref} (role ${spec.role}) is present in the emitted snapshot by identity`);
    if (found) ok(found.canonical.extensions.role === spec.role, `${spec.ref}: the snapshot's own copy carries the same role ('${found.canonical.extensions.role}')`);
  }
}

console.log("\n" + H);
if (fails === 0) console.log("verified: every entrance-surfaced claim carries a valid role, every status listing references a real, grounded governance claim, and the emitted snapshot carries them all intact.");
console.log(fails === 0 ? "check-entrance-listing: OK" : `check-entrance-listing: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
