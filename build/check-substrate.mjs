// Role: the repository's first check. Verifies that every vendored file's hash matches the value
//   recorded in upstream/lock.json, and that the lock's commit_hash matches the upstream/epistack
//   submodule's actual checked-out commit. This is the mechanical half of "the repository can
//   always answer which protocol version, which code inherited, which changed" (spec Section 3).
// Contract: `node build/check-substrate.mjs` exits non-zero on any failure, naming the file (or the
//   commit mismatch) that caused it. No argument.
// Invariant: a vendored file's hash is recomputed from vendor/<path> on disk, never trusted from a
//   cached value; the submodule's commit is read from git itself, never from a stored string other
//   than the lock's own commit_hash field. A single byte changed in any vendored file, or a
//   submodule checked out to any commit other than the lock's, fails this check by name.
// Governs: claim-19: this file is claim 19's own checker; every vendored file's hash and the
//   submodule's checked-out commit are verified here against upstream/lock.json on every run.
"use strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const H = "=".repeat(80);
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };

console.log(H);
console.log("CHECK-SUBSTRATE: vendored files match upstream/lock.json, lock matches the submodule");
console.log(H);

const lock = JSON.parse(readFileSync(join(ROOT, "upstream", "lock.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(ROOT, "build", "substrate-manifest.json"), "utf8"));

// --- 1. the lock's commit_hash matches the submodule's actual checked-out commit ---
console.log("\n[1] the lock's commit_hash matches the upstream/epistack submodule");
{
  let actual = null;
  try {
    actual = execFileSync("git", ["-C", join(ROOT, "upstream", "epistack"), "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch (e) {
    ok(false, `could not read the submodule's checked-out commit: ${e.message}`);
  }
  if (actual !== null) {
    ok(actual === lock.commit_hash, `submodule HEAD (${actual}) matches lock.commit_hash (${lock.commit_hash})`);
  }
}

// --- 2. the manifest and the lock name exactly the same files ---
console.log("\n[2] the manifest and the lock agree on which files are vendored");
{
  const manifestSet = new Set(manifest.files);
  const lockSet = new Set(Object.keys(lock.extracted_files));
  const missingFromLock = manifest.files.filter((f) => !lockSet.has(f));
  const extraInLock = Object.keys(lock.extracted_files).filter((f) => !manifestSet.has(f));
  ok(missingFromLock.length === 0, `every manifest file has a lock entry${missingFromLock.length ? " (missing: " + missingFromLock.join(", ") + ")" : ""}`);
  ok(extraInLock.length === 0, `the lock names no file outside the manifest${extraInLock.length ? " (extra: " + extraInLock.join(", ") + ")" : ""}`);
}

// --- 3. every vendored file's hash matches the lock, recomputed from disk, one failure per file ---
console.log("\n[3] every vendored file's hash matches upstream/lock.json");
{
  for (const rel of manifest.files) {
    const dest = join(ROOT, "vendor", rel);
    if (!existsSync(dest)) { ok(false, `vendor/${rel} is named in the manifest but does not exist on disk`); continue; }
    const data = readFileSync(dest);
    const actualHash = createHash("sha256").update(data).digest("hex");
    const expectedHash = lock.extracted_files[rel];
    ok(actualHash === expectedHash, `vendor/${rel} hash matches (${actualHash.slice(0, 12)}...)`);
  }
}

// --- 4. the lock states it is provisional and carries the re-pin obligation ---
console.log("\n[4] the lock is honestly marked provisional with a dated re-pin obligation");
{
  ok(lock.provisional === true, "lock.provisional is true (this pin has not yet been re-pinned at the freeze)");
  ok(typeof lock.repin_obligation === "string" && lock.repin_obligation.length > 0, "lock.repin_obligation names the standing obligation");
  ok(Array.isArray(lock.local_patches) && lock.local_patches.length === 0, "lock.local_patches is empty (no local departure from upstream)");
}

console.log("\n" + H);
if (fails === 0) console.log("verified: every vendored file matches its locked hash, the lock matches the pinned submodule commit, and the pin is honestly marked provisional.");
console.log(fails === 0 ? "check-substrate: OK" : `check-substrate: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
