// Role: the oracle for the front-page kernel and its span wiring (Phase KG-claim-lens). Verifies
//   every claim span in index.html resolves to a real claim by exact statement-text match, every
//   restatement link's target names a real mirrored governance claim that actually grounds, the
//   store builds through the real gate, and the emitted snapshot (app/fixtures/front-page.snapshot
//   .json, the one periphery/root-lens.js fetches) carries every claim and link intact. Reports the
//   grade distribution as the gate priced it, never tuned to a target.
// Contract: `node build/check-front-page-lens.mjs` exits non-zero on any violation, naming it.
// Invariant: every assertion reads the real gate's own computed state (build/front-page-build.mjs's
//   buildKernel()) or the real emitted snapshot file on disk; nothing here re-derives or hand-asserts
//   a grade.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-FRONT-PAGE-LENS: the front-page kernel and its span wiring"); console.log(H);

const { buildKernel } = await import("./front-page-build.mjs");
const built = buildKernel();

console.log("\n[1] the store builds through the real gate, decision accepted");
ok(built.receipt.decision === "accepted" || built.receipt.decision === "accepted-with-disagreement", `gate decision: ${built.receipt.decision}`);
ok(built.receipt.findings.length === 0, `zero well-formedness findings (found ${built.receipt.findings.length})`);

console.log("\n[2] every claim span in index.html resolves to a claim by exact statement match");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const spanRe = /<span class="claim-span" data-ref="([^"]+)">([^<]*)<\/span>/g;
const spans = [];
let m;
while ((m = spanRe.exec(html))) spans.push({ ref: m[1], text: m[2] });
ok(spans.length > 0, `at least one claim span found in index.html (found ${spans.length})`);
const byRef = new Map(built.claims.map((c) => [c.spec.ref, c]));
const byStatement = new Map(built.claims.map((c) => [c.rec.statement, c]));
for (const span of spans) {
  const claimByRef = byRef.get(span.ref);
  ok(!!claimByRef, `span data-ref="${span.ref}": names a claim the front-page kernel actually builds`);
  const claimByText = byStatement.get(span.text);
  ok(!!claimByText, `span data-ref="${span.ref}": its rendered text matches a claim's statement exactly (root-lens.js resolves by this match, not by data-ref)`);
  if (claimByRef && claimByText) ok(claimByRef.rec.identity === claimByText.rec.identity, `span data-ref="${span.ref}": the ref and the text-match agree on the same claim`);
}
// every non-mirrored front-page claim should appear as a span somewhere on the page (nothing orphaned)
const spanRefs = new Set(spans.map((s) => s.ref));
const frontPageOriginals = built.claims.filter(({ spec }) => !spec.origin_kernel);
for (const { spec } of frontPageOriginals) {
  ok(spanRefs.has(spec.ref), `${spec.ref}: appears as a claim span in index.html (no orphaned front-page claim)`);
}

console.log("\n[3] every restatement link's target is a real, grounded, mirrored governance claim");
const { createRequire } = await import("node:module");
const require = createRequire(import.meta.url);
const { STORE } = require("../kernel/front-page/corpora/front-page-data.js");
const linkSpecs = STORE.links || [];
ok(linkSpecs.length > 0, `at least one restatement link declared (found ${linkSpecs.length})`);
for (const l of linkSpecs) {
  ok(l.link_kind === "restatement", `${l.from} -> ${l.to}: link_kind is "restatement"`);
  const from = byRef.get(l.from);
  const to = byRef.get(l.to);
  // the gate has no semantic check that a restatement's target actually grounds the citing
  // claim's content (union-find joins any two identities a link names); this is the oracle's own
  // guard against that overclaim: restatement is reserved for the three app-behavior sentences
  // (kind "measurement", matching the governance claims they restate), never for an epistack-
  // artifact or protocol-declaration claim borrowing a governance claim's grounded standing it
  // never earned.
  ok(!!from && from.spec.kind === "measurement", `${l.from}: kind is "measurement" (only a measurement-kind claim may restate a governance claim)`);
  ok(!!from, `${l.from}: the restatement's own source claim exists`);
  ok(!!to, `${l.to}: the restatement's target exists as a real (mirrored) claim in this same build`);
  if (to) {
    ok(to.spec.origin_kernel === "knowledge-game", `${l.to}: labeled origin_kernel "knowledge-game" (a real cross-kernel hop, not a front-page original)`);
    const derived = built.view.earnedByIdentity.get(to.rec.identity);
    const earned = derived ? derived.earned : "ungraded";
    ok(earned !== "ungraded", `${l.to}: grounds (earns '${earned}', not ungraded)`);
  }
}

console.log("\n[4] the emitted snapshot carries every claim and link intact");
const snapshotPath = join(ROOT, "app", "fixtures", "front-page.snapshot.json");
let snapshot;
try {
  snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  ok(true, `${snapshotPath} reads as JSON`);
} catch (e) {
  ok(false, `${snapshotPath} reads as JSON (${e.message})`);
}
if (snapshot) {
  ok(snapshot.state.entries.length === built.claims.length, `the snapshot carries all ${built.claims.length} claims (found ${snapshot.state.entries.length})`);
  ok(snapshot.state.links.length === linkSpecs.length, `the snapshot carries all ${linkSpecs.length} links (found ${snapshot.state.links.length})`);
  for (const { rec } of built.claims) {
    ok(snapshot.state.entries.some((e) => e.identity === rec.identity), `claim ${rec.identity.slice(0, 12)}... is present in the emitted snapshot by identity`);
  }
}

console.log("\n[5] the grade distribution, as the gate priced it (never tuned)");
const dist = new Map();
for (const g of built.receipt.grade_table) dist.set(g.earned_grade, (dist.get(g.earned_grade) || 0) + 1);
for (const [grade, count] of [...dist.entries()].sort()) console.log(`      ${grade}: ${count}`);
ok(dist.size > 0, "grade distribution computed (non-empty)");

console.log("\n" + H);
if (fails === 0) console.log("verified: every span resolves, every restatement targets a real grounded claim, the store builds clean, and the emitted snapshot carries it all intact.");
console.log(fails === 0 ? "check-front-page-lens: OK" : `check-front-page-lens: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
