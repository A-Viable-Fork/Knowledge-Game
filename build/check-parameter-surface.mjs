// Role: verifies the founding flow's parameter surface (spec Section 5's deliverable list) matches
//   the vendored parameters-register exactly, derived at check time from vendor/scaffolder/kernel-
//   config.schema.json's own x-tier annotations (build/parameter-surface.mjs's classifyParameterSurface),
//   never a second hand-listed copy that could drift from the schema silently.
// Contract: `node build/check-parameter-surface.mjs` exits non-zero on any divergence, naming it.
// Invariant: "the founding flow's editable parameter set" is read structurally from
//   build/found-community.mjs's own scaffoldConfig object literal (the exact set of keys a founder's
//   config actually reaches the vendored scaffolder through), never redeclared by this check. A field
//   the schema marks "local" (free) must appear there; a field the schema marks anything else (fixed,
//   composition-required) must also appear there, present but its acceptable values enforced downstream
//   by the real vendored primitive (hashTypeBundle for adopted kind hashes, makeSourceTable's closed
//   source_class menu for sources), never by an unconstrained local acceptance. An upstream schema
//   change (a field added, removed, or retiered) surfaces here as a failure naming the field, not as
//   silent drift, because both sides of the comparison are read fresh from the schema and the flow.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-PARAMETER-SURFACE: the founding flow's parameter set matches the vendored register"); console.log(H);

const { classifyParameterSurface } = await import(join(ROOT, "build", "parameter-surface.mjs"));
const schema = JSON.parse(readFileSync(join(ROOT, "vendor", "scaffolder", "kernel-config.schema.json"), "utf8"));
const { free, fixed } = classifyParameterSurface(schema);
const schemaNames = new Set([...free.map((f) => f.name), ...fixed.map((f) => f.name)]);

console.log(`\nfree (a founder's to set): ${free.map((f) => f.name).join(", ")}`);
console.log(`fixed for composition (present, not editable): ${fixed.map((f) => `${f.name} [${f.tier}]`).join(", ")}`);

const foundSrc = readFileSync(join(ROOT, "build", "found-community.mjs"), "utf8");
const scaffoldMatch = foundSrc.match(/const scaffoldConfig = \{([\s\S]*?)\n {2}\};/);

console.log("\n[1] the founding flow declares a scaffoldConfig object literal to inspect");
ok(!!scaffoldMatch, "build/found-community.mjs contains a `const scaffoldConfig = { ... }` block");

// depth-0 keys only: a nested object literal's own keys (e.g. time_lock's default { setting: ... })
// are not top-level scaffoldConfig keys and must not be counted as part of the founder's surface.
function topLevelKeys(objectLiteralBody) {
  const keys = new Set();
  let depth = 0;
  const keyRe = /([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g;
  let m;
  while ((m = keyRe.exec(objectLiteralBody))) {
    const before = objectLiteralBody.slice(0, m.index);
    depth = (before.match(/\{/g) || []).length - (before.match(/\}/g) || []).length;
    if (depth === 0) keys.add(m[1]);
  }
  return keys;
}
const flowKeys = scaffoldMatch ? topLevelKeys(scaffoldMatch[1]) : new Set();
console.log(`founding flow's editable-surface keys: ${[...flowKeys].sort().join(", ")}`);

console.log("\n[2] no more: the founding flow declares no key absent from the vendored schema");
for (const k of flowKeys) {
  ok(schemaNames.has(k), `founding-flow key '${k}' is a real vendored schema property`);
}

console.log("\n[3] no fewer: every schema property, free or fixed, is present in the founding flow's surface");
for (const name of schemaNames) {
  ok(flowKeys.has(name), `schema property '${name}' is present in the founding flow's scaffoldConfig`);
}

console.log("\n[4] composition-required (fixed) fields are present but not freely editable: real substrate");
console.log("    enforcement exists downstream, never a local unconstrained acceptance");
{
  ok(fixed.some((f) => f.name === "adopted_type_hashes"), "adopted_type_hashes is classified fixed (shared-adopted), not free");
  ok(/hashTypeBundle/.test(foundSrc), "build/found-community.mjs imports and uses hashTypeBundle, the real vendored hash-pinning primitive");
  ok(/the pinned hash for.*matches the shared subtree/.test(foundSrc), "the generated per-kernel check template asserts the pinned hash matches the shared subtree, not merely accepting the config's claim");
  const tablesSrc = readFileSync(join(ROOT, "vendor", "kernel", "schema", "tables.mjs"), "utf8");
  ok(/SOURCE_CLASSES\s*=\s*\[/.test(tablesSrc) && /bad source_class/.test(tablesSrc), "the vendored makeSourceTable throws on a source_class outside its closed menu, the real enforcement for the substrate-inherited tier");
}

console.log("\n[5] the free tier is exactly what docs/parameters-register.md calls local policy: kernel_id,");
console.log("    local_kinds, sources, and time_lock, nothing more");
{
  const freeNames = new Set(free.map((f) => f.name));
  const expectedFree = ["kernel_id", "local_kinds", "sources", "time_lock"];
  for (const name of expectedFree) ok(freeNames.has(name), `free tier includes '${name}'`);
  ok(freeNames.size === expectedFree.length, `free tier has exactly ${expectedFree.length} members (got ${freeNames.size}: ${[...freeNames].join(", ")})`);
}

console.log("\n" + H);
if (fails === 0) console.log("verified: the founding flow's editable parameter set equals the vendored register's free list exactly, and composition-required fields are present but enforced downstream, never freely accepted.");
console.log(fails === 0 ? "check-parameter-surface: OK" : `check-parameter-surface: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
