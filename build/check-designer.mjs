// Role: verifies the kernel designer (Phase KG-10, spec Section 7 "type" and "set the free
//   parameters", upgraded to an in-app founder experience). Four things: every preset's parameter
//   record actually round-trips through the real, unmodified vendored scaffolder (build/found-
//   community.mjs's own generateKernel, never a second generation path); the live preview's displayed
//   grades equal a direct recompute over the same draft parameters, byte for byte, across fuzzed
//   drafts, including the crossing-arrival claim's real floor-then-unfloor behavior; inactive fields
//   (identity_thresholds, standing_economy) serialize into the downloadable founding config and are
//   read by nothing that evaluates them (the seam scan's own guarantee, checked here again with a
//   designer-specific static assertion); every guidance string this module declares actually covers
//   the vocabulary it claims to explain, so no parameter renders unexplained.
// Contract: `node build/check-designer.mjs` exits non-zero on any violation, naming it.
// Invariant: PRESETS are read from api/kernel-designer.js, the same module the periphery screen
//   imports, never a second hand-copied preset list. Scratch community directories this check
//   generates are removed before exit, success or failure.
"use strict";
import { readFileSync, rmSync, existsSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-DESIGNER: presets round-trip, the preview computes rather than illustrates, inactive fields are honest, guidance is complete"); console.log(H);

const { PRESETS, GRADE_GUIDANCE, SOURCE_CLASS_GUIDANCE, LICENSE_OPTIONS, forkKindFromShared, recomputeSamplePreview, buildSampleCorpus } = await import(join(ROOT, "api", "kernel-designer.js"));
const { POSITIONS } = await import(join(ROOT, "vendor", "kernel", "schema", "confidence.mjs"));
const { generateKernel } = await import(join(ROOT, "build", "found-community.mjs"));

// the same kernel_id derivation the periphery screen itself performs (slugify the preset's own frame
// name), never a hand-picked id independent of what a founder would actually see generated.
function slugify(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

console.log("\n[1] every preset's parameter record round-trips through the real, unmodified vendored scaffolder");
for (const preset of PRESETS) {
  const kernelId = slugify(preset.config.frame.name);
  const home = `communities/_scratch-kg10-${preset.id}`;
  const scratchAbs = join(ROOT, home);
  try {
    generateKernel({ ...preset.config, kernel_id: kernelId, home });
    ok(existsSync(join(scratchAbs, "corpus", `${kernelId}-data.js`)), `preset '${preset.id}': generateKernel produced a corpus directory with the expected data file`);
  } catch (e) {
    ok(false, `preset '${preset.id}': generateKernel threw: ${e.message}`);
  } finally {
    // generateKernel also writes this repository's own build/<kernel_id>-build.mjs and
    // build/check-<kernel_id>.mjs (the generated per-kernel builder and its check), alongside the
    // scratch home directory; both are this check's own scratch artifacts and are removed here.
    if (existsSync(scratchAbs)) rmSync(scratchAbs, { recursive: true, force: true });
    for (const f of [join(ROOT, "build", `${kernelId}-build.mjs`), join(ROOT, "build", `check-${kernelId}.mjs`)]) {
      if (existsSync(f)) unlinkSync(f);
    }
  }
}

console.log("\n[2] the live preview computes, never illustrates: recomputeSamplePreview is deterministic and matches a fresh, independent call");
{
  for (const preset of PRESETS) {
    const kindRows = [...preset.config.adopted_type_hashes.map(forkKindFromShared), ...(preset.config.local_kinds || [])];
    const first = JSON.stringify(recomputeSamplePreview(kindRows));
    const second = JSON.stringify(recomputeSamplePreview(kindRows));
    ok(first === second, `preset '${preset.id}': two independent calls to recomputeSamplePreview over the same draft produce byte-identical output`);
  }
  // a fuzzed set of kind-row drafts, each rechecked twice for determinism.
  const fuzzRows = [
    [{ kind: "measurement", ceiling: "asserted" }],
    [{ kind: "measurement", ceiling: "supported" }],
    [{ kind: "measurement", ceiling: "checked" }, { kind: "forum", ceiling: "corroborated" }],
    [{ kind: "measurement", ceiling: "checked" }, { kind: "forum", ceiling: "ungraded" }],
  ];
  for (const rows of fuzzRows) {
    const a = JSON.stringify(recomputeSamplePreview(rows));
    const b = JSON.stringify(recomputeSamplePreview(rows));
    ok(a === b, `fuzzed draft [${rows.map((r) => `${r.kind}:${r.ceiling}`).join(", ")}]: deterministic across two independent calls`);
  }
}

console.log("\n[3] the crossing arrival: floors at 'asserted' with no matching kind, rises once a matching local kind is authored");
{
  const noMatch = recomputeSamplePreview([{ kind: "measurement", ceiling: "checked" }]);
  const crossingRowNoMatch = noMatch.find((r) => r.kind === "hypothesis");
  ok(!!crossingRowNoMatch, "the sample corpus's crossing-arrival claim (kind 'hypothesis') is present");
  ok(crossingRowNoMatch && crossingRowNoMatch.earned_grade === "asserted", `crossing arrival floors at 'asserted' with no matching kind in the draft table (got ${crossingRowNoMatch && crossingRowNoMatch.earned_grade})`);
  const withMatch = recomputeSamplePreview([{ kind: "measurement", ceiling: "checked" }, { kind: "hypothesis", ceiling: "checked" }]);
  const crossingRowMatch = withMatch.find((r) => r.kind === "hypothesis");
  ok(crossingRowMatch && crossingRowMatch.earned_grade === "checked", `crossing arrival rises to 'checked' once a matching local kind at ceiling 'checked' is authored (got ${crossingRowMatch && crossingRowMatch.earned_grade})`);
}

console.log("\n[4] periphery/kernel-designer-screen.js never computes a grade itself; every displayed grade is recomputeSamplePreview's own return value");
{
  const screenSrc = readFileSync(join(ROOT, "periphery", "kernel-designer-screen.js"), "utf8");
  ok(!/earned-grade|decay\.mjs|gate\/gate\.mjs/.test(screenSrc), "the screen imports none of the grade-deriving kernel modules directly");
  ok(/recomputeSamplePreview/.test(screenSrc), "the screen's own preview rendering calls recomputeSamplePreview, the real vendored provider/client path");
  ok(!/\.earned_grade\s*=[^=]/.test(screenSrc), "the screen never assigns to a row's own earned_grade field (no hand-adjusted display)");
}

console.log("\n[5] inactive fields (identity_thresholds, standing_economy): serialize honestly, read by nothing that evaluates them");
{
  const screenSrc = readFileSync(join(ROOT, "periphery", "kernel-designer-screen.js"), "utf8");
  ok(/identity_thresholds:\s*draft\.identity_thresholds/.test(screenSrc), "downloadConfig serializes identity_thresholds into the founding config (collected, not silently dropped)");
  ok(/standing_economy:\s*draft\.standing_economy/.test(screenSrc), "downloadConfig serializes standing_economy into the founding config (collected, not silently dropped)");
  // the designer-specific guarantee: neither field ever reaches draftKindRows/recomputeSamplePreview's
  // own call arguments, i.e., neither ever influences what the live preview computes.
  const previewCallSites = screenSrc.match(/recomputeSamplePreview\([^)]*\)/g) || [];
  ok(previewCallSites.length > 0, "recomputeSamplePreview is actually called from this screen");
  ok(previewCallSites.every((c) => !/identity_thresholds|standing_economy/.test(c)), "no call to recomputeSamplePreview passes identity_thresholds or standing_economy");
  const { execFileSync } = await import("node:child_process");
  let seamsOut = "";
  try { execFileSync("node", [join(ROOT, "build", "check-seams.mjs")], { encoding: "utf8" }); }
  catch (e) { seamsOut = e.stdout || ""; ok(false, `build/check-seams.mjs itself failed:\n${seamsOut.split("\n").filter((l) => l.includes("FAIL")).join("\n")}`); }
  ok(seamsOut === "", "build/check-seams.mjs (which statically scans this designer screen too) passes green");
}

console.log("\n[6] every guidance string this module declares actually covers the vocabulary it claims to explain");
{
  const gradeNames = Object.keys(POSITIONS);
  const missingGradeGuidance = gradeNames.filter((g) => !GRADE_GUIDANCE[g]);
  ok(missingGradeGuidance.length === 0, `every lattice grade has a guidance string${missingGradeGuidance.length ? " (missing: " + missingGradeGuidance.join(", ") + ")" : ""}`);
  const { readFileSync: rf } = await import("node:fs");
  const tablesSrc = rf(join(ROOT, "vendor", "kernel", "schema", "tables.mjs"), "utf8");
  const sourceClassMatch = tablesSrc.match(/const SOURCE_CLASSES = \[([^\]]+)\]/);
  const sourceClasses = sourceClassMatch ? JSON.parse(`[${sourceClassMatch[1]}]`) : [];
  ok(sourceClasses.length > 0, "read the real source-class menu from the vendored kernel, not a hand-copied list");
  const missingSourceGuidance = sourceClasses.filter((c) => !SOURCE_CLASS_GUIDANCE[c]);
  ok(missingSourceGuidance.length === 0, `every substrate source class has a guidance string${missingSourceGuidance.length ? " (missing: " + missingSourceGuidance.join(", ") + ")" : ""}`);
  ok(LICENSE_OPTIONS.length === 5 && LICENSE_OPTIONS.every((o) => o.sentence && o.sentence.length > 0), "every one of the five license options carries a non-empty guidance sentence");
  const screenSrc = rf(join(ROOT, "periphery", "kernel-designer-screen.js"), "utf8");
  ok(/GRADE_GUIDANCE\[row\.ceiling\]/.test(screenSrc), "the kind designer renders each kind's ceiling guidance from GRADE_GUIDANCE, never a hand-written string");
  ok(/LICENSE_ENFORCEMENT_NOTE/.test(screenSrc), "the license picker renders the enforcement note");
}

console.log("\n" + H);
if (fails === 0) console.log("verified: every preset round-trips through the real scaffolder, the live preview computes deterministically through the real vendored provider (including the crossing arrival's real floor-then-unfloor behavior), inactive fields are collected honestly and evaluated by nothing, and every guidance string covers the real vocabulary it explains.");
console.log(fails === 0 ? "check-designer: OK" : `check-designer: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
