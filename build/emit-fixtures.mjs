// Role: emits the two development fixtures into app/fixtures/, using the pinned submodule's own
//   emit-snapshot tooling unmodified, never a local reimplementation of snapshot serialization or
//   hashing.
// Contract: `node build/emit-fixtures.mjs`. Writes app/fixtures/knowledge-game.snapshot.json and
//   app/fixtures/math.snapshot.json, and prints each snapshot_hash for the capability manifest.
// Invariant: the math corpus is emitted by running upstream/epistack/build/emit-snapshot.mjs
//   directly (the submodule already carries corpora/math and build/math-build.mjs, the one legacy
//   corpus that exports buildKernel(), the scaffolder-generated shape emit-snapshot.mjs expects; the
//   eggs corpus, considered first, exports buildEggs() instead and is not emittable this way, reported
//   rather than worked around). The knowledge-game kernel has no such home inside the submodule (it is
//   this repository's own content), so it is emitted the same way Stage 1 generated it: a scratch
//   workspace shaped like the submodule's own sibling tree, running the identical unmodified
//   emit-snapshot.mjs and vendor-kernel.mjs there, then copying the one output file into
//   app/fixtures/. Neither vendor/ nor upstream/ is written to.
"use strict";
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES_DIR = join(ROOT, "app", "fixtures");
mkdirSync(FIXTURES_DIR, { recursive: true });

function readHash(path) {
  return JSON.parse(readFileSync(path, "utf8")).snapshot_hash;
}

// ---- math: the submodule already carries everything emit-snapshot.mjs needs; run it in place ----
console.log("[1] emitting math (upstream content corpus, run directly from the pinned submodule)");
const mathDest = join(FIXTURES_DIR, "math.snapshot.json");
execFileSync("node", [join(ROOT, "upstream", "epistack", "build", "emit-snapshot.mjs"), "math", mathDest], { stdio: "inherit" });
const mathHash = readHash(mathDest);
console.log(`    math snapshot_hash: ${mathHash}`);
// vendor-kernel.mjs stages vendor/<id>/kernel-snapshot.json as a side effect, relative to wherever
// it runs; run in place inside the submodule, that side effect lands inside the submodule itself.
// The submodule is never left holding build residue, so it is removed immediately.
const submoduleStaging = join(ROOT, "upstream", "epistack", "vendor", "math");
if (existsSync(submoduleStaging)) rmSync(submoduleStaging, { recursive: true, force: true });

// ---- knowledge-game: no home inside the submodule; emit via a scratch workspace shaped like it ----
console.log("\n[2] emitting knowledge-game (this repository's own kernel, via a scratch workspace)");
const workspace = join(tmpdir(), `kg-fixture-${Date.now()}`);
mkdirSync(workspace, { recursive: true });
// two unmodified tools with two different path expectations share this workspace: the vendored
// emit-snapshot.mjs/vendor-kernel.mjs expect "../kernel/..." relative to build/ (the scaffolder's
// own flat-sibling assumption), while our already-relocated knowledge-game-build.mjs expects
// "../vendor/kernel/..." (Stage 1's relocation). Neither file is edited again here; the workspace
// simply carries the kernel tree at both paths so each tool's real, unmodified imports resolve.
cpSync(join(ROOT, "vendor", "kernel"), join(workspace, "kernel"), { recursive: true });
cpSync(join(ROOT, "vendor", "kernel"), join(workspace, "vendor", "kernel"), { recursive: true });
mkdirSync(join(workspace, "build"), { recursive: true });
cpSync(join(ROOT, "vendor", "build", "emit-snapshot.mjs"), join(workspace, "build", "emit-snapshot.mjs"));
cpSync(join(ROOT, "vendor", "build", "vendor-kernel.mjs"), join(workspace, "build", "vendor-kernel.mjs"));
cpSync(join(ROOT, "build", "knowledge-game-build.mjs"), join(workspace, "build", "knowledge-game-build.mjs"));
mkdirSync(join(workspace, "kernel", "governance", "corpora"), { recursive: true });
cpSync(join(ROOT, "kernel", "governance", "corpora", "tables.js"), join(workspace, "kernel", "governance", "corpora", "tables.js"));
cpSync(join(ROOT, "kernel", "governance", "corpora", "knowledge-game-data.js"), join(workspace, "kernel", "governance", "corpora", "knowledge-game-data.js"));
const kgDest = join(FIXTURES_DIR, "knowledge-game.snapshot.json");
execFileSync("node", [join(workspace, "build", "emit-snapshot.mjs"), "knowledge-game", kgDest], { cwd: workspace, stdio: "inherit" });
rmSync(workspace, { recursive: true, force: true });
const kgHash = readHash(kgDest);
console.log(`    knowledge-game snapshot_hash: ${kgHash}`);

console.log("\ndone. app/fixtures/ now carries:");
console.log(`  knowledge-game.snapshot.json  snapshot_hash ${kgHash}`);
console.log(`  math.snapshot.json            snapshot_hash ${mathHash}`);
