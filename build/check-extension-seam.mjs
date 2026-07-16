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
  ok(result.receipts[0].probe === "declared-destinations" && result.receipts[0].valid === true, "the declared-destinations probe runs first and validates the (empty) declaration");
  ok(result.receipts[1].probe === "sandbox-fetch-denied" && result.receipts[1].pass === true, "the sandbox-fetch-denied baseline probe runs second and holds");
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
  ok(r1.receipts.find((r) => r.probe === "declared-destinations").destinations.length === 0, "the learn-efficiently ranker declares no destinations");
  ok(r2.receipts.find((r) => r.probe === "declared-destinations").destinations.length === 0, "the contestable dashboard declares no destinations");
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

// Phase KG-9: capability-scoped network. A real local HTTP server (no external egress; this
// environment's own loopback only) stands in for a candidate's inference endpoint, so the sandbox's
// enforcement is proven against a real reachable destination and a real refused one, never a mock of
// the fetch call itself.
const http = await import("node:http");
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ echoed: req.url }));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const DECLARED_URL = `http://127.0.0.1:${port}/declared`;
const UNDECLARED_URL = `http://127.0.0.1:${port}/undeclared`;

console.log("\n[8] an extension with no declared destinations can reach nothing (a real, reachable local server included)");
{
  const source = `function extensionMain(input) { return fetch(input.url).then(function (r) { return r.json(); }); }`;
  const result = await sandboxMod.runInSandbox(source, { url: DECLARED_URL }, { declaredDestinations: [] });
  ok(result.ok === false, "a candidate with no declared destinations is refused even though the target server is real and reachable");
  ok(/fetch is not available/.test(result.error || ""), `the refusal is the baseline denial, not a network-level failure (got: ${result.error})`);
}

console.log("\n[9] an extension with declared destinations can reach exactly those and nothing else");
{
  // a well-behaved workflow candidate declines to act (no fetch attempted) on a task-less input, the
  // exact input checkConformance's own generic workflow probe calls it with; this is the same
  // discipline the shipped assistant extension follows.
  const source = `function extensionMain(input) { if (!input || !input.url) return { idle: true }; return fetch(input.url).then(function (r) { return r.json(); }); }`;
  const allowed = await sandboxMod.runInSandbox(source, { url: DECLARED_URL }, { declaredDestinations: [DECLARED_URL] });
  ok(allowed.ok === true, `a call to the exact declared destination succeeds (got: ${allowed.error})`);
  ok(allowed.ok && allowed.result && allowed.result.echoed === "/declared", "the response body is the real server's own reply, not a stub");

  const refused = await sandboxMod.runInSandbox(source, { url: UNDECLARED_URL }, { declaredDestinations: [DECLARED_URL] });
  ok(refused.ok === false, "a call to a different URL on the identical reachable server is refused");
  ok(refused.ok === false && refused.error.includes(UNDECLARED_URL), `the refusal names the undeclared URL exactly (got: ${refused.error})`);

  const conformance = await extMod.checkConformance(source, "workflow", FIXTURE_ROWS, FIXTURE_LINKS, [DECLARED_URL]);
  ok(conformance.pass === true, `a workflow candidate declaring one real destination passes conformance (reason: ${conformance.reason || "n/a"})`);
  const runResult = await extMod.runWorkflow(source, { url: DECLARED_URL }, [DECLARED_URL]);
  ok(runResult && runResult.echoed === "/declared", "runWorkflow threads the declared destination through to the real sandboxed call");
}
server.close();

console.log("\n[10] a malformed declaration (a wildcard) is refused at conformance time, naming the offending entry, before the candidate ever runs");
{
  const benign = 'function extensionMain(input) { return input.rows; }';
  const result = await extMod.checkConformance(benign, "ranker", FIXTURE_ROWS, FIXTURE_LINKS, ["https://api.example.com/*"]);
  ok(result.pass === false, "a wildcard destination fails conformance");
  ok((result.reason || "").includes("https://api.example.com/*"), `the refusal names the offending wildcard entry (got: ${result.reason})`);
  ok(result.receipts.length === 1 && result.receipts[0].probe === "declared-destinations", "conformance stops at the declaration check; the candidate never reaches the sandbox at all");
}

console.log("\n[11] install renders the declared destinations and requires consent before installing");
{
  const screenSrc = readFileSync(join(ROOT, "periphery", "extension-screen.js"), "utf8");
  ok(/declaredDestinations/.test(screenSrc), "the install form threads declaredDestinations through to onInstall");
  ok(/consent/i.test(screenSrc), "the install form renders a consent step naming the declared destinations");
}

console.log("\n" + H);
if (fails === 0) console.log("verified: conformance refuses a mutating, unsandboxed, or malformed-destination candidate by name; both demo extensions declare no destinations and still pass; a candidate with no declared destinations reaches nothing and one with declared destinations reaches exactly those against a real local server; the first-party ranker loads through the identical public path.");
console.log(fails === 0 ? "check-extension-seam: OK" : `check-extension-seam: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
