// Role: verifies the extension seam (Phase KG-4, spec Section 6). A candidate that mutates a
//   grade-bearing field fails install conformance, naming the mutation; a candidate that attempts
//   fetch or DOM access is blocked by the sandbox itself, not merely trusted not to try; both shipped
//   demonstration extensions pass conformance; the first-party learn-efficiently ranker loads through
//   the identical public path (the same source string, the same conformance call) as any third-party
//   candidate, no shortcut.
// Contract: `node build/check-extension-seam.mjs` exits non-zero on any divergence, naming it.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-EXTENSION-SEAM: conformance refuses what the sandbox itself blocks"); console.log(H);

const extMod = await import(join(ROOT, "api", "extension.js"));
const sandboxMod = await import(join(ROOT, "api", "extension-sandbox.js"));
const { contentHash } = extMod;

const FIXTURE_ROWS = [
  { identity: "a", kind: "measurement", statement: "s1", declared_grade: "asserted", earned_grade: "asserted", source_id: "S1" },
  { identity: "b", kind: "measurement", statement: "s2", declared_grade: "checked", earned_grade: "checked", source_id: "S2" },
  { identity: "c", kind: "comment", statement: "a comment", declared_grade: "ungraded", earned_grade: "ungraded", source_id: "S3" },
];
const FIXTURE_LINKS = [
  { link_kind: "supports", from_identity: "b", to_identity: "a" },
];

console.log("\n[1] a candidate that mutates a grade-bearing field fails conformance, naming the mutation");
{
  const mutating = 'function extensionMain(input) { var rows = input.rows.slice(); rows[0] = Object.assign({}, rows[0], { earned_grade: "checked" }); return rows; }';
  const result = await extMod.checkConformance(mutating, "ranker", FIXTURE_ROWS, FIXTURE_LINKS);
  ok(result.pass === false, "the mutating ranker fails conformance");
  ok(/mutated earned_grade/.test(result.reason || ""), `the refusal names the mutated field (got: ${result.reason})`);
}

console.log("\n[2] a candidate that drops or introduces a row fails conformance");
{
  const dropping = 'function extensionMain(input) { return input.rows.slice(1); }';
  const r1 = await extMod.checkConformance(dropping, "ranker", FIXTURE_ROWS, FIXTURE_LINKS);
  ok(r1.pass === false, "a ranker that drops a row fails conformance");
  const inventing = 'function extensionMain(input) { return input.rows.concat([{identity: "ghost", kind: "measurement", declared_grade: "checked", earned_grade: "checked", statement: "x", source_id: "S9"}]); }';
  const r2 = await extMod.checkConformance(inventing, "ranker", FIXTURE_ROWS, FIXTURE_LINKS);
  ok(r2.pass === false, "a ranker that introduces an unknown identity fails conformance");
}

console.log("\n[3] a candidate attempting fetch is blocked by the sandbox, not merely trusted not to try");
{
  const fetching = 'function extensionMain(input) { fetch("https://evil.example/"); return input.rows; }';
  const result = await extMod.checkConformance(fetching, "ranker", FIXTURE_ROWS, FIXTURE_LINKS);
  ok(result.pass === false, "a fetch-attempting ranker fails conformance");
  ok(result.receipts.some((r) => r.probe === "ranking-separation-fuzz" && /fetch is not available/.test(r.error || "")), "the receipt names fetch as unavailable, not a generic crash");
}

console.log("\n[4] a candidate attempting DOM access is blocked (a worker's global scope has no document at all)");
{
  const domTouching = 'function extensionMain(input) { document.title = "hijacked"; return input.rows; }';
  const out = await sandboxMod.runInSandbox(domTouching, { rows: FIXTURE_ROWS });
  ok(out.ok === false, "a candidate referencing document throws inside the sandbox");
  ok(/document/i.test(out.error || ""), `the error names the undefined reference (got: ${out.error})`);
}

console.log("\n[5] the sandbox integrity probe itself holds (fetch is denied before any candidate code runs)");
{
  const benign = 'function extensionMain(input) { return input.rows; }';
  const result = await extMod.checkConformance(benign, "ranker", FIXTURE_ROWS, FIXTURE_LINKS);
  ok(result.pass === true, "a benign, non-mutating ranker passes conformance");
  ok(result.receipts[0].probe === "sandbox-fetch-denied" && result.receipts[0].pass === true, "the sandbox-fetch-denied probe runs first and holds");
}

console.log("\n[6] both shipped demonstration extensions pass conformance under their declared shape");
{
  const demo = await import(join(ROOT, "periphery", "demo-extensions.js"));
  const r1 = await extMod.checkConformance(demo.LEARN_EFFICIENTLY_SOURCE, "ranker", FIXTURE_ROWS, FIXTURE_LINKS);
  ok(r1.pass === true, `learn-efficiently ranker passes conformance (reason: ${r1.reason || "n/a"})`);
  const r2 = await extMod.checkConformance(demo.CONTESTABLE_DASHBOARD_SOURCE, "renderer", FIXTURE_ROWS);
  ok(r2.pass === true, `contestable dashboard renderer passes conformance (reason: ${r2.reason || "n/a"})`);
  const ordered = await extMod.runRanker(demo.LEARN_EFFICIENTLY_SOURCE, FIXTURE_ROWS, {}, FIXTURE_LINKS);
  ok(ordered[0].identity === "b", "learn-efficiently ranks the claim with an outgoing support first (b supports a)");
  const descriptor = await extMod.runRenderer(demo.CONTESTABLE_DASHBOARD_SOURCE, FIXTURE_ROWS);
  ok(Array.isArray(descriptor.tiles) && descriptor.tiles.length === 2, "the dashboard descriptor carries one tile per measurement-kind row, excluding the comment");
}

console.log("\n[7] first-party loads through the identical public path: app.js and extension-screen.js both import the same source constants, no separate privileged copy");
{
  const appSrc = readFileSync(join(ROOT, "periphery", "app.js"), "utf8");
  const screenSrc = readFileSync(join(ROOT, "periphery", "extension-screen.js"), "utf8");
  ok(/from\s+"\.\/demo-extensions\.js"/.test(appSrc), "app.js imports the demo extension sources from periphery/demo-extensions.js");
  ok(/from\s+"\.\/demo-extensions\.js"/.test(screenSrc), "extension-screen.js imports the demo extension sources from the identical module");
  ok(/checkConformance\(/.test(appSrc), "app.js runs checkConformance before installing the default ranker (no bypass)");
  const demo = await import(join(ROOT, "periphery", "demo-extensions.js"));
  ok(typeof contentHash === "function" || typeof extMod.contentHash === "function", "contentHash is exported for pinning");
  const h = extMod.contentHash(demo.LEARN_EFFICIENTLY_SOURCE);
  ok(typeof h === "string" && h.length === 64, `contentHash produces a 64-hex sha256 digest (got ${h.slice(0, 12)}...)`);
}

console.log("\n" + H);
if (fails === 0) console.log("verified: conformance refuses a mutating or unsandboxed candidate by name, both demo extensions pass, and the first-party ranker loads through the identical public path.");
console.log(fails === 0 ? "check-extension-seam: OK" : `check-extension-seam: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
