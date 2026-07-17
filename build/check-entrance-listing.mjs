// Role: the oracle for the entrance listing (the org-root entrance page's own door, rendered from
//   this app's grounded governance claims rather than hand-written copy) and the front-page
//   decomposition it was extended to cover (Phase KG-front-page-claims, the same surfacing pattern,
//   never a second convention). Verifies every entrance-surfaced claim carries a valid role, that
//   every "status" listing references a real governance claim which itself grounds (never a missing
//   or floored one, which would let the front door overclaim), that every "front-page" claim carries
//   a unique span_ref and, where it restates a governance claim, that the restatement targets a real
//   claim which grounds and is itself of kind "measurement" (the gate has no semantic check that a
//   restatement's target actually grounds the citing claim's content; this is the oracle's own guard
//   against a claim borrowing standing it never earned), and that the emitted snapshot
//   (app/fixtures/knowledge-game.snapshot.json, the one both the entrance renderer and the front
//   page's own claim lens fetch) actually carries every listing and front-page claim intact.
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
console.log(H); console.log("CHECK-ENTRANCE-LISTING: the Knowledge Game entrance listing and front-page decomposition"); console.log(H);

const VALID_ROLES = ["title", "tagline", "status", "link", "front-page"];

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

console.log("\n[4] every 'front-page' claim carries a span_ref, unique, and every restatement targets a real, grounded, measurement-kind claim");
const frontPageClaims = listingClaims.filter(({ spec }) => spec.role === "front-page");
ok(frontPageClaims.length > 0, `at least one 'front-page' claim exists (found ${frontPageClaims.length})`);
const spanRefs = new Map();
for (const { spec } of frontPageClaims) {
  ok(!!spec.span_ref, `${spec.ref}: carries a span_ref`);
  if (spec.span_ref) {
    ok(!spanRefs.has(spec.span_ref), `${spec.ref}: span_ref '${spec.span_ref}' is unique (not already used by ${spanRefs.get(spec.span_ref)})`);
    spanRefs.set(spec.span_ref, spec.ref);
  }
}
// Scans every REAL link_kind "restatement" record whose source is a front-page claim (never just the
// claims that happen to carry a `restates` extension): the gate itself has no semantic check that a
// restatement's target actually grounds the citing claim's content, so a bogus link could exist on a
// claim this file's own `restates` field never mentions, and a check keyed only off that field would
// miss it entirely.
const byIdentity = new Map(built.claims.map((c) => [c.rec.identity, c]));
const restatementLinks = built.state.links.filter((l) => l.link_kind === "restatement");
const frontPageIdentities = new Set(frontPageClaims.map(({ rec }) => rec.identity));
const restatementsFromFrontPage = restatementLinks.filter((l) => frontPageIdentities.has(l.from_identity));
ok(restatementsFromFrontPage.length > 0, `at least one real restatement link from a front-page claim exists (found ${restatementsFromFrontPage.length})`);
for (const link of restatementsFromFrontPage) {
  const from = byIdentity.get(link.from_identity);
  const target = byIdentity.get(link.to_identity);
  const label = from ? from.spec.ref : link.from_identity.slice(0, 12) + "...";
  ok(!!from && from.spec.kind === "measurement", `${label}: the restating claim's own kind is 'measurement' (only a measurement-kind claim may restate a governance claim; a forum or declaration claim borrowing another's grounded standing is the overclaim this check exists to catch)`);
  ok(!!target, `${label}: restatement targets a claim that actually exists in this kernel`);
  if (target) {
    const derived = built.view.earnedByIdentity.get(target.rec.identity);
    const earned = derived ? derived.earned : "ungraded";
    ok(earned !== "ungraded", `${label}: the restated claim ('${target.spec.ref}') grounds (earns '${earned}', not ungraded/floored)`);
  }
  if (from) ok(from.spec.restates === target?.spec.ref, `${label}: the claim's own \`restates\` extension ('${from.spec.restates}') names the same target the real link resolves to ('${target ? target.spec.ref : "?"}'), so the two never disagree`);
}

console.log("\n[5] the grade distribution among front-page claims, as the gate priced it (never tuned)");
const dist = new Map();
for (const { rec } of frontPageClaims) {
  const derived = built.view.earnedByIdentity.get(rec.identity);
  const earned = derived ? derived.earned : "ungraded";
  dist.set(earned, (dist.get(earned) || 0) + 1);
}
for (const [grade, count] of [...dist.entries()].sort()) console.log(`      ${grade}: ${count}`);
ok(dist.size > 0, "front-page grade distribution computed (non-empty)");

console.log("\n[6] the emitted snapshot carries every front-page claim, with its span_ref intact");
if (snapshot) {
  for (const { spec, rec } of frontPageClaims) {
    const found = (snapshot.state.entries || []).find((e) => e.identity === rec.identity);
    ok(!!found, `${spec.ref} is present in the emitted snapshot by identity`);
    if (found) ok(found.canonical.extensions.span_ref === spec.span_ref, `${spec.ref}: the snapshot's own copy carries the same span_ref ('${found.canonical.extensions.span_ref}')`);
  }
}

console.log("\n" + H);
if (fails === 0) console.log("verified: every entrance-surfaced claim carries a valid role, every status listing references a real grounded governance claim, every front-page claim carries a unique span_ref, every restatement targets a real grounded measurement-kind claim, and the emitted snapshot carries every claim intact.");
console.log(fails === 0 ? "check-entrance-listing: OK" : `check-entrance-listing: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
