// Role: verifies the service worker's precache list against a fresh walk of the real import graph
//   (build/shell-files.mjs), so the list can never go stale (naming a file that no longer exists or a
//   reference no longer reached) or go missing an entry (a new import the list was never updated for).
//   Phase KG-6b extends this to pinned communities: a reader's own pinned snapshot lives in a SEPARATE
//   cache (api/pins.js's "kg-pins-v1"), never the static shell precache, so this check instead proves
//   sw.js's activate handler will not delete that cache as an unrecognized one, and that the two
//   files' literal cache-name constants have not silently drifted apart.
// Contract: `node build/check-offline-shell.mjs` exits non-zero on any mismatch, naming the file.
// Invariant: this proves the precache LIST is complete and accurate, and that the pins cache survives
//   the service worker's own cleanup; it does not itself prove the browser actually serves cached
//   content correctly offline (a service worker's install/activate/fetch lifecycle cannot be
//   exercised headlessly in plain Node). True offline behavior, pinned communities included, was
//   smoke-tested by hand in a real browser (network disabled, hard reload); the report says so
//   plainly rather than claiming this check proves more than a list comparison and a textual
//   cross-check.
"use strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-OFFLINE-SHELL: the precache list matches a fresh import-graph walk"); console.log(H);

const { computeShellFiles } = await import(join(ROOT, "build", "shell-files.mjs"));

console.log("\n[1] the service worker exists at the repository root");
const swPath = join(ROOT, "sw.js");
ok(existsSync(swPath), "sw.js exists at the repo root (required for scope: see sw.js's own header comment)");

console.log("\n[2] extracting the precache list from sw.js");
const swSource = readFileSync(swPath, "utf8");
const match = swSource.match(/const PRECACHE_URLS = \[([\s\S]*?)\];/);
ok(!!match, "sw.js declares a PRECACHE_URLS array");
const precache = match ? [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort() : [];

console.log("\n[3] comparing against a fresh walk of the real import graph");
const computed = computeShellFiles(ROOT);
const precacheSet = new Set(precache);
const computedSet = new Set(computed);

const missing = computed.filter((f) => !precacheSet.has(f));
const stale = precache.filter((f) => !computedSet.has(f));
ok(missing.length === 0, `no file the app actually needs is missing from the precache list${missing.length ? ": " + missing.join(", ") : ""}`);
ok(stale.length === 0, `no stale entry in the precache list names a file the app no longer needs${stale.length ? ": " + stale.join(", ") : ""}`);

console.log("\n[4] every listed file actually exists on disk");
for (const f of precache) {
  ok(existsSync(join(ROOT, f)), `precached file exists: ${f}`);
}

console.log("\n[5] the pins cache (Phase KG-6b) survives the service worker's own cleanup");
const pinsMatch = swSource.match(/const PINS_CACHE_NAME = "([^"]+)"/);
ok(!!pinsMatch, "sw.js declares a PINS_CACHE_NAME constant");
const activateMatch = swSource.match(/self\.addEventListener\("activate"[\s\S]*?\}\);/);
ok(!!activateMatch && activateMatch[0].includes("PINS_CACHE_NAME"), "sw.js's activate handler's cleanup filter names PINS_CACHE_NAME alongside CACHE_NAME, so it is never deleted as an unrecognized cache");

const pinsSource = readFileSync(join(ROOT, "api", "pins.js"), "utf8");
const apiCacheMatch = pinsSource.match(/const CACHE_NAME = "([^"]+)"/);
ok(!!apiCacheMatch, "api/pins.js declares its own CACHE_NAME constant");
ok(!!pinsMatch && !!apiCacheMatch && pinsMatch[1] === apiCacheMatch[1], `sw.js's PINS_CACHE_NAME and api/pins.js's CACHE_NAME are the same literal value (sw.js: ${pinsMatch && pinsMatch[1]}, api/pins.js: ${apiCacheMatch && apiCacheMatch[1]})`);

console.log("\n" + H);
if (fails === 0) console.log("verified: sw.js's precache list exactly matches a fresh walk of the real import graph from app/index.html, no stale or missing entries. True offline behavior was smoke-tested by hand in a browser, not by this check.");
console.log(fails === 0 ? "check-offline-shell: OK" : `check-offline-shell: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
