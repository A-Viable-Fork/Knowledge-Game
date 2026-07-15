// Role: generates this repository's own governance kernel through the real, unmodified vendored
//   scaffolder, then relocates its four output files from the scaffolder's hardcoded sibling-tree
//   location to this repository's actual layout (kernel/governance/corpora/ for the data, build/ for
//   the generated build and check scripts). The scaffolder (vendor/scaffolder/new-kernel.mjs)
//   resolves its own ROOT from its file location and writes corpora/<id>/ and build/<id>-*.mjs
//   relative to that ROOT, assuming scaffolder/, kernel/, corpora/, and build/ sit as flat siblings,
//   exactly upstream's own tree shape. This repository deliberately separates vendor/ (pinned
//   substrate) from kernel/governance/ (locally generated content), so the scaffolder cannot be
//   pointed at our layout directly; running it in place would leave generated, non-substrate files
//   inside vendor/, contradicting "vendor/ is imported substrate, nothing else."
// Contract: `node build/generate-governance-kernel.mjs <config.json>`. Copies the minimal sibling
//   tree the scaffolder needs into a scratch workspace, runs the real vendor/scaffolder/new-kernel.mjs
//   there unmodified, verifies its own generated check passed, then copies the four output files into
//   their real repository homes, rewriting only the literal relative-import path strings the
//   relocation requires (no import target changes meaning, only its written path). Re-verifies the
//   relocated files still pass by running the relocated check in place. Cleans up the scratch
//   workspace; leaves vendor/ untouched.
// Invariant: every byte of kernel content (kinds, sources, claims, the generated check's assertions)
//   is exactly what the real scaffolder produced; this script performs no rule-checking and invents
//   no kernel structure. The only edits it makes to generated text are the path-string substitutions
//   named in PATH_FIXES below, applied identically to every generation, so a re-generation at re-pin
//   time reproduces the same relocation.
"use strict";
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = process.argv[2];
if (!configPath) { console.error("usage: node build/generate-governance-kernel.mjs <config.json>"); process.exit(2); }
const config = JSON.parse(readFileSync(resolve(configPath), "utf8"));
const id = config.kernel_id;

// ---- 1. build a scratch workspace shaped like upstream's flat sibling tree ----
const workspace = join(tmpdir(), `kg-scaffold-${id}-${Date.now()}`);
mkdirSync(workspace, { recursive: true });
cpSync(join(ROOT, "vendor", "scaffolder"), join(workspace, "scaffolder"), { recursive: true });
cpSync(join(ROOT, "vendor", "kernel"), join(workspace, "kernel"), { recursive: true });
mkdirSync(join(workspace, "corpora", "_shared"), { recursive: true });
cpSync(join(ROOT, "vendor", "corpora", "_shared", "common-types.js"), join(workspace, "corpora", "_shared", "common-types.js"));
mkdirSync(join(workspace, "build"), { recursive: true });
const workspaceConfigPath = join(workspace, "kernel-config.json");
writeFileSync(workspaceConfigPath, JSON.stringify(config, null, 2));
console.log(`[1] scratch workspace built at ${workspace}`);

// ---- 2. run the real, unmodified vendored scaffolder there ----
let genOut;
try {
  genOut = execFileSync("node", [join(workspace, "scaffolder", "new-kernel.mjs"), workspaceConfigPath], { cwd: workspace, encoding: "utf8" });
  console.log(genOut);
} catch (e) {
  if (e.stdout) console.log(e.stdout);
  if (e.stderr) console.error(e.stderr);
  console.error("generate-governance-kernel: the scaffolder or its generated check failed in the scratch workspace; stopping without touching the real repository");
  rmSync(workspace, { recursive: true, force: true });
  process.exit(1);
}
console.log("[2] the real scaffolder ran and its generated check passed in the scratch workspace");

// ---- 3. relocate the four generated files, rewriting only the literal path strings the move requires ----
const PATH_FIXES = [
  [/\.\.\/kernel\//g, "../vendor/kernel/"],
  [new RegExp(`\\.\\./corpora/${id}/`, "g"), `../kernel/governance/corpora/`],
  [/\.\.\/corpora\/_shared\//g, "../vendor/corpora/_shared/"],
];
function relocate(srcRel, destAbs, fix) {
  let text = readFileSync(join(workspace, srcRel), "utf8");
  if (fix) for (const [pat, rep] of PATH_FIXES) text = text.replace(pat, rep);
  mkdirSync(dirname(destAbs), { recursive: true });
  writeFileSync(destAbs, text);
}
relocate(join("corpora", id, "tables.js"), join(ROOT, "kernel", "governance", "corpora", "tables.js"), false);
relocate(join("corpora", id, `${id}-data.js`), join(ROOT, "kernel", "governance", "corpora", `${id}-data.js`), false);
relocate(join("build", `${id}-build.mjs`), join(ROOT, "build", `${id}-build.mjs`), true);
relocate(join("build", `check-${id}.mjs`), join(ROOT, "build", `check-${id}.mjs`), true);
console.log("[3] relocated the four generated files into kernel/governance/corpora/ and build/, rewriting only the path-fix substitutions above");

// ---- 4. clean up the scratch workspace; vendor/ was never written to ----
rmSync(workspace, { recursive: true, force: true });
console.log("[4] scratch workspace removed; vendor/ untouched");

// ---- 5. re-verify the relocated files pass in place, proving the relocation changed no behavior ----
try {
  const out = execFileSync("node", [join(ROOT, "build", `check-${id}.mjs`)], { cwd: ROOT, encoding: "utf8" });
  console.log(out);
  console.log(`[5] the relocated check passes in place: generate-governance-kernel OK for ${id}`);
} catch (e) {
  if (e.stdout) console.log(e.stdout);
  if (e.stderr) console.error(e.stderr);
  console.error(`generate-governance-kernel: the relocated check FAILED for ${id}; the relocation is not behavior-preserving`);
  process.exit(1);
}
