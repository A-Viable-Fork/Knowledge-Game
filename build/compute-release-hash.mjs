// Role: computes this deployment's release provenance (claim 14: a release's declared artifact hash
//   matches the built artifact). Since no build tooling exists (no bundler, no transpiler, per
//   manifests/build-provenance.json's own note), the deployed artifact IS the checked-out working
//   tree, so "the build" is exactly the set of files git tracks (plus untracked-but-not-ignored files,
//   so this also catches a file the operator forgot to add). Writes a per-file sha256 map and one
//   combined hash over that sorted map into manifests/build-provenance.json.
// Contract: `node build/compute-release-hash.mjs` writes source_commit, artifact_hash, and
//   file_hashes into manifests/build-provenance.json. Exported computeFileHashes() for check-release
//   to call, so the check recomputes with the identical function rather than a parallel one.
// Invariant: manifests/build-provenance.json itself is excluded from the hashed file set (a checksum
//   manifest does not checksum itself; this avoids the circularity of a file whose own content encodes
//   its own hash). source_commit names the commit this hash was computed against, at generation time;
//   it is honest about naming a point in history, not a live guarantee about uncommitted changes.
// Governs: claim-14: computeFileHashes/artifact_hash are the declared hash; build/check-release.mjs
//   calls the identical function fresh and fails if it diverges from what is declared.
"use strict";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXCLUDE = new Set(["manifests/build-provenance.json"]);

export function computeFileHashes() {
  const listing = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" });
  const paths = listing.split("\n").filter(Boolean).filter((p) => !EXCLUDE.has(p)).sort();
  const file_hashes = {};
  for (const p of paths) {
    try {
      const content = readFileSync(join(ROOT, p));
      file_hashes[p] = createHash("sha256").update(content).digest("hex");
    } catch (e) {
      void e; // a listed path that is a submodule gitlink or otherwise unreadable as a plain file: skip
    }
  }
  const artifact_hash = createHash("sha256").update(JSON.stringify(file_hashes)).digest("hex");
  return { file_hashes, artifact_hash };
}

if (process.argv[1] && process.argv[1].endsWith("compute-release-hash.mjs")) {
  const { file_hashes, artifact_hash } = computeFileHashes();
  const manifestPath = join(ROOT, "manifests", "build-provenance.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  let source_commit = null;
  try { source_commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(); } catch (e) { void e; }
  manifest.source_commit = source_commit;
  manifest.artifact_hash = artifact_hash;
  manifest.file_hashes = file_hashes;
  manifest.artifact_hash_note = "artifact_hash is a sha256 over the sorted JSON of file_hashes, itself a sha256 per file over every file `git ls-files --cached --others --exclude-standard` lists (the deployed tree, since no build step compiles source into output), excluding this manifest itself. Recomputed and compared by build/check-release.mjs.";
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`wrote manifests/build-provenance.json: ${Object.keys(file_hashes).length} files, artifact_hash ${artifact_hash.slice(0, 16)}..., source_commit ${source_commit ? source_commit.slice(0, 12) : "null"}`);
}
