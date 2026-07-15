// Role: the oracle for the knowledge-game kernel, generated empty by scaffolder/new-kernel.mjs
//   (Stage 1) and evolved by hand as the kernel's own stages progress, exactly the precedent
//   upstream's own math kernel set ("check-math was evolved to assert this stage-two floor state",
//   kernel-workflow-guide.md). Verifies every adopted kind's pinned hash still matches the shared
//   subtree, the source and kind tables build, the gate accepts the contribution, and that every one
//   of the 19 governance claims now computes to "checked" from a real checking record: Stage 3's
//   grounding is complete as of Phase B/C. No grade is asserted by this script; every one is read from
//   the real gate's own computed state.
// Contract: `node build/check-knowledge-game.mjs` exits non-zero on any failure, naming the claim.
"use strict";
import { createRequire } from "node:module";
import { hashTypeBundle } from "../vendor/kernel/schema/type-hash.mjs";

const require = createRequire(import.meta.url);
const { KINDS, SOURCES, ADOPTED, ADOPTED_HASHES } = require("../kernel/governance/corpora/tables.js");
const { COMMON_TYPE_HASHES } = require("../vendor/corpora/_shared/common-types.js");

let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-KNOWLEDGE-GAME: the generated kernel and its Stage 2 governance claims"); console.log(H);

console.log("\n[1] every adopted kind is in the shared subtree and its pinned hash matches");
for (const name of ADOPTED) {
  const shared = COMMON_TYPE_HASHES[name];
  ok(shared !== undefined, `adopts common kind '${name}', which is present in the shared subtree`);
  if (shared !== undefined) {
    ok(ADOPTED_HASHES[name] === shared, `the pinned hash for '${name}' still matches the shared subtree`);
    const row = KINDS.find((k) => k.kind === name);
    ok(!!row && hashTypeBundle({ kind: row.kind, ceiling: row.ceiling, compatibility_rule_id: null, atlas_refs: [] }) === shared, `the '${name}' kind row implies the adopted hash`);
  }
}

console.log("\n[2] the source table and kind table build, and the gate accepts the contribution");
let built = null;
try {
  const mod = await import("./knowledge-game-build.mjs");
  built = mod.buildKernel();
  ok(true, "the kernel builds: source table, kind table, and the store all valid");
} catch (e) {
  ok(false, `the kernel fails to build: ${e.message}`);
}
if (built) {
  ok(built.state.entries.length === 19, `the kernel carries 19 governance claims (got ${built.state.entries.length})`);
  ok(built.receipt.decision === "accepted", `the contribution is accepted by the real gate (got ${built.receipt.decision})`);
}

console.log("\n[3] every claim computes to 'checked', read from the real gate's state (Stage 3's grounding, complete as of Phase B/C)");
if (built) {
  for (const { rec, spec } of built.claims) {
    const derived = built.view.earnedByIdentity.get(rec.identity);
    const earned = derived ? derived.earned : "ungraded";
    ok(earned === "checked", `${spec.ref} (${rec.identity.slice(0, 12)}...) earns 'checked': ${spec.statement.slice(0, 60)}...`);
    ok(spec.declared_grade === earned, `${spec.ref} declared_grade ('${spec.declared_grade}') equals its earned grade ('${earned}'), asserting nothing above what the checking record earns`);
  }
}

console.log("\n" + H);
if (fails === 0) console.log("verified: the kernel is coherent, the gate accepts all 19 claims, and every one of them computes checked from a real checking record.");
console.log(fails === 0 ? "check-knowledge-game: OK" : `check-knowledge-game: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
