// Role: verifies the compute picker (KG-COMPUTE). KG's own forkable statistics pack
//   (api/compute/stats-pack.js) is injected on top of the vendored canonical-only default registry
//   through api/community.js's provider override (api/compute/registry.js); periphery/compute-
//   screen.js's computePickerRows/runDisagreementDemo are the exact DOM-free resolution the render
//   path uses, mirroring periphery/contribute-screen.js's glossaryHelpFor, so this check exercises
//   precisely what would render, not a parallel description of it.
// Contract: `node build/check-compute-picker.mjs` exits non-zero on any violation, naming it.
// Invariant: read-only. Confirms KG's pack still passes the shared-root validator, the injected
//   catalog is what the picker actually renders, the manifest is present before any run, the
//   statistics pack's own two entries disagree over the preset input while both carry their
//   manifest and neither a grade field, the screen exposes no landing path, and no assumption text is
//   hand-authored in the screen.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-COMPUTE-PICKER: the transform picker, with the manifest shown before the run"); console.log(H);

// =====================================================================================
console.log("\n[1] KG's pack conforms to the shared-root shape");
const { validateTransform } = await import(join(ROOT, "vendor", "kernel", "compute", "transforms.mjs"));
const { KG_STATS_PACK } = await import(join(ROOT, "api", "compute", "stats-pack.js"));
ok(Array.isArray(KG_STATS_PACK) && KG_STATS_PACK.length === 2, `KG_STATS_PACK carries two entries (got ${(KG_STATS_PACK || []).length})`);
for (const entry of KG_STATS_PACK) {
  try {
    validateTransform(entry);
    ok(true, `${entry.id}: passes the vendored validateTransform`);
  } catch (e) {
    ok(false, `${entry.id}: validateTransform threw: ${e.message}`);
  }
  ok(Array.isArray(entry.assumptions) && entry.assumptions.length > 0, `${entry.id}: carries a non-empty assumptions manifest`);
  ok(["invertible", "lossy"].includes(entry.reversibility), `${entry.id}: carries a reversibility mark ("${entry.reversibility}")`);
  ok(["value", "flag"].includes(entry.emits), `${entry.id}: emits value-or-flag ("${entry.emits}"), never "kernel"`);
  ok(entry.consumes === "values", `${entry.id}: consumes "values" (got "${entry.consumes}")`);
}

// =====================================================================================
console.log("\n[2] the injected catalog is what the picker renders");
const requested = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const u = String(url);
  requested.push(u);
  const rel = u.replace(/^https?:\/\/[^/]+\//, "");
  const onDisk = join(ROOT, "app", rel);
  try {
    const body = readFileSync(onDisk, "utf8");
    return { ok: true, status: 200, json: async () => JSON.parse(body) };
  } catch (e) {
    return { ok: false, status: 404, json: async () => { throw e; } };
  }
};
const { fetchCommunity } = await import(join(ROOT, "api", "community.js"));
const community = await fetchCommunity("../communities/epistack-competition/snapshot/epistack-competition.snapshot.json");
globalThis.fetch = realFetch;

const catalog = community.api.transforms();
const packsPresent = new Set(catalog.map((e) => e.pack));
ok(packsPresent.has("graph"), "community.api.transforms() carries the canonical graph pack");
ok(packsPresent.has("algebra"), "community.api.transforms() carries the canonical algebra pack");
ok(packsPresent.has("statistics"), "community.api.transforms() carries KG's statistics pack");
const statisticsIds = catalog.filter((e) => e.pack === "statistics").map((e) => e.id).sort();
ok(JSON.stringify(statisticsIds) === JSON.stringify(["statistics.dependence-aware", "statistics.naive-multiply"]), `the statistics pack is exactly KG's two entries (got ${JSON.stringify(statisticsIds)})`);
for (const entry of catalog) {
  ok(Array.isArray(entry.assumptions) && entry.assumptions.length > 0, `${entry.id}: carries a manifest in the catalog`);
  ok(!!entry.reversibility, `${entry.id}: carries a reversibility mark in the catalog`);
  ok(!("run" in entry), `${entry.id}: the catalog entry omits run (list-time only, never executable from here)`);
}

// =====================================================================================
console.log("\n[3] manifest at pick time: the screen's per-transformation render data carries the assumptions before any run is invoked");
const { computePickerRows, runDisagreementDemo, DEMO_FACTORS } = await import(join(ROOT, "periphery", "compute-screen.js"));
const rows = computePickerRows(catalog);
ok(rows.graph.length > 0 && rows.algebra.length > 0 && rows.statistics.length === 2, `computePickerRows groups by pack (graph: ${rows.graph.length}, algebra: ${rows.algebra.length}, statistics: ${rows.statistics.length})`);
for (const pack of ["graph", "algebra", "statistics"]) {
  for (const row of rows[pack]) {
    ok(Array.isArray(row.assumptions) && row.assumptions.length > 0, `${row.id}: manifest is present in the pick-time row, before any run`);
  }
}

// =====================================================================================
console.log("\n[4] the disagreement, through the contract");
ok(Array.isArray(DEMO_FACTORS) && DEMO_FACTORS.length >= 2 && DEMO_FACTORS.every((f) => f.mechanism === DEMO_FACTORS[0].mechanism), "DEMO_FACTORS is a preset shared-mechanism input (every factor declares the same mechanism)");
const demo = runDisagreementDemo(community.api.runTransform);
ok(typeof demo.naive.value === "number", `naive-multiply returns a value (got ${JSON.stringify(demo.naive.value)})`);
ok(demo.dependenceAware.flag === "refused", `dependence-aware refuses over the same shared-mechanism input (got ${JSON.stringify(demo.dependenceAware)})`);
ok(demo.naive.value !== demo.dependenceAware.value, "the two entries disagree (product versus refusal)");
ok(Array.isArray(demo.naive.manifest) && demo.naive.manifest.length > 0, "naive-multiply's result carries its manifest");
ok(Array.isArray(demo.dependenceAware.manifest) && demo.dependenceAware.manifest.length > 0, "dependence-aware's result carries its manifest");
const GRADE_FIELDS = ["grade", "declared_grade", "earned"];
ok(GRADE_FIELDS.every((f) => !(f in demo.naive)), "naive-multiply's result carries no grade field");
ok(GRADE_FIELDS.every((f) => !(f in demo.dependenceAware)), "dependence-aware's result carries no grade field");

// =====================================================================================
console.log("\n[5] read-only: no landing, no grade leak, statistics never returns a kernel");
const screenSource = readFileSync(join(ROOT, "periphery", "compute-screen.js"), "utf8");
const screenCode = screenSource.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
ok(!/\bpropose\b/.test(screenCode), "periphery/compute-screen.js's code (comments aside) names no propose path");
ok(!/ctx\.propose|ctx\.onPropose|\.propose\s*\(/.test(screenSource), "periphery/compute-screen.js calls no propose-shaped function anywhere, including comments");
const again = runDisagreementDemo(community.api.runTransform);
ok(JSON.stringify(again) === JSON.stringify(demo), "running the demo twice produces byte-identical results (no observable side effect)");
ok(demo.naive.kernel === undefined && demo.dependenceAware.kernel === undefined, "neither statistics result carries a kernel field");

// =====================================================================================
console.log("\n[6] no hand-authored manifest drift: every assumption the screen renders resolves from an entry");
const byId = new Map(catalog.map((e) => [e.id, e]));
for (const pack of ["graph", "algebra", "statistics"]) {
  for (const row of rows[pack]) {
    const entry = byId.get(row.id);
    ok(!!entry, `${row.id}: resolves to a real catalog entry`);
    ok(JSON.stringify(row.assumptions) === JSON.stringify(entry.assumptions), `${row.id}: rendered assumptions are the catalog entry's own, not a literal the screen defines`);
  }
}

console.log("\n" + H);
if (fails === 0) console.log("verified: KG's forkable statistics pack passes the shared-root validator, the injected catalog is what the picker renders with its manifest present before any run, the disagreement demo's two statistics entries disagree while both carry their manifest and neither a grade field, the screen exposes no landing path, and no rendered assumption is hand-authored.");
console.log(fails === 0 ? "check-compute-picker: OK" : `check-compute-picker: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
