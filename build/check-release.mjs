// Role: verifies claim 14 (a release's declared artifact hash matches the built artifact). Recomputes
//   the same per-file sha256 map build/compute-release-hash.mjs computes (calling its own exported
//   function, not a second implementation) and compares it, file by file, against what
//   manifests/build-provenance.json declares.
// Contract: `node build/check-release.mjs` exits non-zero on any mismatch, naming the file: added,
//   missing, or changed.
// Invariant: manifests/build-provenance.json's own artifact_hash and file_hashes are read as declared,
//   never recomputed and silently written by this check; a mismatch is reported, not repaired.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { computeFileHashes } from "./compute-release-hash.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-RELEASE: the declared artifact hash matches a fresh rebuild"); console.log(H);

const manifest = JSON.parse(readFileSync(join(ROOT, "manifests", "build-provenance.json"), "utf8"));
ok(typeof manifest.artifact_hash === "string" && manifest.artifact_hash.length > 0, "manifests/build-provenance.json declares a non-null artifact_hash");
ok(manifest.file_hashes && typeof manifest.file_hashes === "object", "manifests/build-provenance.json declares a file_hashes map");

console.log("\n[1] recomputing the same file-hash map fresh");
const { file_hashes: fresh, artifact_hash: freshHash } = computeFileHashes();

console.log("\n[2] comparing declared vs fresh, file by file");
const declaredPaths = new Set(Object.keys(manifest.file_hashes || {}));
const freshPaths = new Set(Object.keys(fresh));
const missing = [...declaredPaths].filter((p) => !freshPaths.has(p));
const added = [...freshPaths].filter((p) => !declaredPaths.has(p));
for (const p of missing) ok(false, `declared but now missing: ${p}`);
for (const p of added) ok(false, `now present but not declared (stale manifest): ${p}`);
let changed = 0;
for (const p of declaredPaths) {
  if (!freshPaths.has(p)) continue;
  const same = manifest.file_hashes[p] === fresh[p];
  if (!same) { changed++; ok(false, `changed since declared: ${p}`); }
}
ok(missing.length === 0, `no declared file is missing (${missing.length} missing)`);
ok(added.length === 0, `no fresh file is undeclared (${added.length} added; the manifest is current)`);
ok(changed === 0, `no declared file's content changed (${changed} changed)`);

console.log("\n[3] the combined artifact_hash matches");
ok(freshHash === manifest.artifact_hash, `combined artifact_hash matches (declared ${manifest.artifact_hash.slice(0, 16)}..., fresh ${freshHash.slice(0, 16)}...)`);

console.log("\n" + H);
if (fails === 0) console.log("verified: the declared artifact hash and every declared per-file hash match a fresh rebuild of the working tree.");
console.log(fails === 0 ? "check-release: OK" : `check-release: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
