// Role: verifies trellis/stage-manifest.json against the repository's real git history. Tags are an
//   optional convenience (a tag-push failure is a note, never an error, per the prompt discipline);
//   this manifest and this check are the authoritative stage record.
// Contract: `node build/check-stages.mjs` exits non-zero on any failure, naming the stage: every
//   listed commit must exist, must be an ancestor of HEAD (the branch actually checked out, so this
//   is green throughout ordinary feature-branch development), and stages must appear in the manifest
//   in true ancestry order (each stage's commit an ancestor of the next stage's commit). Whether each
//   commit has already reached main is reported separately as a note, never a failure: a stage
//   committed on a feature branch not yet merged into main is a normal, honest mid-development state,
//   not a broken one.
"use strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(ROOT, "trellis", "stage-manifest.json"), "utf8"));

let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const note = (m) => console.log(`  note ${m}`);
const H = "=".repeat(80);
console.log(H); console.log("CHECK-STAGES: the stage manifest matches the real git history"); console.log(H);

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}
function isAncestorOf(commit, ref) {
  try { execFileSync("git", ["merge-base", "--is-ancestor", commit, ref], { cwd: ROOT }); return true; } catch (e) { void e; return false; }
}

console.log("\n[1] every listed commit exists and is an ancestor of HEAD");
const resolved = [];
for (const s of manifest.stages) {
  let full = null;
  try { full = git(["rev-parse", "--verify", s.commit]); } catch (e) { void e; }
  ok(full !== null, `${s.stage}: commit ${s.commit} exists`);
  ok(full !== null && isAncestorOf(full, "HEAD"), `${s.stage}: commit ${s.commit} is an ancestor of HEAD`);
  resolved.push({ stage: s.stage, full });
}

console.log("\n[1b] whether each stage has also reached main (a note, not a failure)");
let mainRef = null;
try { git(["rev-parse", "--verify", "main"]); mainRef = "main"; } catch (e) { void e; }
for (const r of resolved) {
  if (!mainRef) { note(`${r.stage}: no local 'main' ref to check against`); continue; }
  const onMain = r.full && isAncestorOf(r.full, mainRef);
  note(`${r.stage}: ${onMain ? "already on main" : "not yet merged into main"}`);
}

console.log("\n[2] stages appear in true ancestry order (each an ancestor of the next)");
for (let i = 0; i + 1 < resolved.length; i++) {
  const a = resolved[i], b = resolved[i + 1];
  const inOrder = !!(a.full && b.full && isAncestorOf(a.full, b.full));
  ok(inOrder, `${a.stage} is an ancestor of ${b.stage}`);
}

console.log("\n" + H);
if (fails === 0) console.log(`verified: all ${manifest.stages.length} stage(s) in trellis/stage-manifest.json exist, are ancestors of HEAD, and appear in true ancestry order.`);
console.log(fails === 0 ? "check-stages: OK" : `check-stages: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
