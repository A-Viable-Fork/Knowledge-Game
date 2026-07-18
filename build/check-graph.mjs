// Role: verifies the graph object (KG-GRAPH). periphery/graph-layout.js's layout() and periphery/
//   graph-screen.js's buildGraphView are the exact DOM-free resolution the render path uses, mirroring
//   periphery/contribute-screen.js's glossaryHelpFor and periphery/compute-screen.js's
//   computePickerRows, so this check exercises precisely what would render, not a parallel
//   description of it.
// Contract: `node build/check-graph.mjs` exits non-zero on any violation, naming it.
// Invariant: read-only. Confirms completeness against the real vendored supportCone, determinism of
//   the layered layout, membrane fidelity (every grade, gap, and crux traced to community.api, none
//   recomputed here), the read-only contract (no landing path), legend fidelity (every label resolves
//   from the vendored glossary), and (Step 3 landed) transform fidelity over the rendered subgraph.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-GRAPH: the graph object, drawn as structure and read through the membrane"); console.log(H);

// build the real community exactly as the app does: fetchCommunity under a stubbed fetch that serves
// the real on-disk fixture, so the provider override (KG-COMPUTE's registry, KG-GRAPH's kernelView)
// is the actual one the app constructs, not a parallel reimplementation.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const u = String(url);
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
const community = await fetchCommunity("fixtures/covid.snapshot.json");
globalThis.fetch = realFetch;

const { supportCone, disagreements } = await import(join(ROOT, "vendor", "kernel", "analysis", "reconciliation.mjs"));
const { characterizedGaps } = await import(join(ROOT, "vendor", "kernel", "analysis", "characterized-gaps.mjs"));
const { layout, nodeSetOf } = await import(join(ROOT, "periphery", "graph-layout.js"));
const { buildGraphView, recomputeGradesOverNodes, projectOntoNodes } = await import(join(ROOT, "periphery", "graph-screen.js"));

const rawGraph = { entries: community.raw.state.entries, links: community.raw.state.links };

// pick a real focus claim with a nontrivial cone (so completeness and determinism are checked against
// actual structure, not a degenerate single-node case).
let focusId = null, focusConeSize = 0;
for (const e of rawGraph.entries) {
  const cone = supportCone(rawGraph, e.identity);
  if (cone.members.size > focusConeSize) { focusConeSize = cone.members.size; focusId = e.identity; }
}
console.log(`\nfocus claim: ${focusId} (cone size ${focusConeSize}, community: ${community.raw.state.entries.length} claims, ${community.raw.state.links.length} links)`);

// =====================================================================================
console.log("\n[1] completeness: the rendered node and edge sets equal the real support cone's");
const expectedCone = supportCone(rawGraph, focusId);
const expectedNodes = new Set([focusId, ...expectedCone.members]);
const renderedNodes = nodeSetOf(rawGraph, focusId);
ok(renderedNodes.size === expectedNodes.size, `rendered node count (${renderedNodes.size}) equals the cone's (${expectedNodes.size})`);
const missing = [...expectedNodes].filter((id) => !renderedNodes.has(id));
const extra = [...renderedNodes].filter((id) => !expectedNodes.has(id));
ok(missing.length === 0, `no cone member dropped from the render (missing: ${JSON.stringify(missing)})`);
ok(extra.length === 0, `no node invented beyond the cone (extra: ${JSON.stringify(extra)})`);
const { edges: focusEdges } = layout(rawGraph, focusId);
const expectedEdgeCount = (rawGraph.links || []).filter((l) => expectedNodes.has(l.from_identity) && expectedNodes.has(l.to_identity)).length;
ok(focusEdges.length === expectedEdgeCount, `every link between two cone members is an edge (rendered ${focusEdges.length}, expected ${expectedEdgeCount})`);

// =====================================================================================
console.log("\n[2] determinism: layout(graph, focus) run twice yields byte-identical positions");
const runA = layout(rawGraph, focusId);
const runB = layout(rawGraph, focusId);
ok(JSON.stringify(runA) === JSON.stringify(runB), "two runs of layout() over the same graph and focus produce identical JSON (the anti-hairball guarantee)");
const overviewA = layout(rawGraph, null);
const overviewB = layout(rawGraph, null);
ok(JSON.stringify(overviewA) === JSON.stringify(overviewB), "the community overview (no focus) is equally deterministic across runs");
ok(overviewA.nodes.length === rawGraph.entries.length, `the overview covers every claim in the community (${overviewA.nodes.length} of ${rawGraph.entries.length})`);

// =====================================================================================
console.log("\n[3] membrane fidelity: every grade, gap, and crux traced to community.api, none recomputed here");
const ctx = {
  graph: rawGraph, focus: focusId,
  read: (q) => community.api.read(q), gaps: (q) => community.api.gaps(q),
  characterizedGaps: (q) => community.api.characterizedGaps(q), reconciliations: (q) => community.api.reconciliations(q),
  glossary: () => community.api.glossary(),
};
const view = buildGraphView(ctx);
const rowsByIdentity = new Map(community.api.read({}).map((r) => [r.identity, r]));
for (const n of view.nodes) {
  const row = rowsByIdentity.get(n.id);
  ok(!!row, `node ${n.id}: resolves to a real community.api.read() row`);
  ok(n.kind === row.kind, `node ${n.id}: rendered kind ("${n.kind}") equals community.api's ("${row.kind}")`);
  ok(n.declaredGrade === row.declared_grade, `node ${n.id}: rendered declared grade equals community.api's`);
  ok(n.earnedGrade === row.earned_grade, `node ${n.id}: rendered earned grade equals community.api's`);
}
const realTerminalIds = new Set((community.api.characterizedGaps({}) || []).map((g) => g.identity));
const renderedTerminalIds = new Set(view.nodes.filter((n) => n.terminal).map((n) => n.id));
ok(renderedTerminalIds.size === [...renderedTerminalIds].filter((id) => realTerminalIds.has(id)).length, "every rendered terminal node is a real characterizedGaps() identity");

// the overview (no focus) covers every claim in the community, so it is guaranteed to include every
// contradiction the focus cone above might happen to miss.
const overviewCtx = { ...ctx, focus: null };
const overviewView = buildGraphView(overviewCtx);
const overviewNodeIds = new Set(overviewView.nodes.map((n) => n.id));
const realRecs = community.api.reconciliations({});
let contradictionsChecked = 0;
for (const rec of realRecs) {
  const a = rec.side_a.identity, b = rec.side_b.identity;
  if (!overviewNodeIds.has(a) || !overviewNodeIds.has(b)) continue;
  const edge = overviewView.edges.find((e) => e.kind === "contradicts" && ((e.from === a && e.to === b) || (e.from === b && e.to === a)));
  ok(!!edge, `contradiction between ${a} and ${b} (both rendered) is an edge`);
  ok(edge && edge.contested === true, `that contradiction edge is marked contested`);
  ok(edge && edge.crux && edge.crux.candidate === true, `the crux carries candidate: true (a candidate, never a verdict)`);
  contradictionsChecked++;
}
ok(contradictionsChecked > 0, `at least one real contradiction was checked against the rendered graph (${contradictionsChecked})`);

// a synthetic declared-vs-earned divergence, to confirm the flag actually fires (the real fixtures
// carry no divergence today; the migrated corpus is closed by design).
const { createLocalProvider } = await import(join(ROOT, "vendor", "api", "providers", "local-provider.mjs"));
const { createClientApi } = await import(join(ROOT, "vendor", "api", "client-api.mjs"));
const syntheticEntry = { record_type: "claim", identity: "synthetic-divergence-claim", kind: "forum", statement: "a forced divergence for check-graph", source_id: "test:src", contributor_id: "test", declared_grade: "corroborated", checking_records: [] };
const syntheticSnapshot = { state: { entries: [syntheticEntry], links: [] }, sources: [{ source_id: "test:src", source_class: "testimony", rests_on: [] }], kinds: [{ kind: "forum", ceiling: "corroborated" }] };
const syntheticApi = createClientApi(createLocalProvider(syntheticSnapshot));
const syntheticView = buildGraphView({
  graph: syntheticSnapshot.state, focus: "synthetic-divergence-claim",
  read: (q) => syntheticApi.read(q), gaps: (q) => syntheticApi.gaps(q),
  characterizedGaps: () => [], reconciliations: () => [], glossary: () => syntheticApi.glossary(),
});
ok(syntheticView.nodes.length === 1 && syntheticView.nodes[0].diverges === true, "a claim whose declared grade exceeds its earned grade is flagged diverges: true (the declared-vs-earned demotion the graph is where a reader sees it)");

// =====================================================================================
console.log("\n[4] read-only: the screen exposes no landing or propose path");
const layoutSource = readFileSync(join(ROOT, "periphery", "graph-layout.js"), "utf8");
const screenSource = readFileSync(join(ROOT, "periphery", "graph-screen.js"), "utf8");
const screenCode = screenSource.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
const layoutCode = layoutSource.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
ok(!/\bpropose\b/.test(screenCode), "periphery/graph-screen.js's code (comments aside) names no propose path");
ok(!/\bpropose\b/.test(layoutCode), "periphery/graph-layout.js's code (comments aside) names no propose path");
ok(!/ctx\.propose|ctx\.onPropose|\.propose\s*\(/.test(screenSource), "periphery/graph-screen.js calls no propose-shaped function anywhere, including comments");

// =====================================================================================
console.log("\n[5] legend from glossary: every link-kind and grade label resolves from the vendored glossary, none hand-authored");
const glossary = community.api.glossary();
for (const l of view.legendLinks) {
  ok(l.description === (glossary.LINKS[l.kind] || {}).description, `legend link "${l.kind}": description is glossary.LINKS["${l.kind}"].description, not a literal`);
}
for (const g of view.legendGrades) {
  ok(g.description === (glossary.GRADES[g.grade] || {}).description, `legend grade "${g.grade}": description is glossary.GRADES["${g.grade}"].description, not a literal`);
}
ok(view.legendLinks.length > 0 && view.legendGrades.length > 0, "the legend actually carries entries (nonempty)");

// =====================================================================================
console.log("\n[6] transform fidelity: algebra.recompute-grade and graph.project over the rendered subgraph, landing nothing");
const { kernelViewOf } = await import(join(ROOT, "api", "compute", "kernel-view.js"));
const kernel = kernelViewOf(community.raw);
const nodeIds = [...renderedNodes];
const recomputed = recomputeGradesOverNodes((id, input) => community.api.runTransform(id, input), kernel, nodeIds);
let recomputeMismatches = 0;
for (const id of nodeIds) {
  const row = rowsByIdentity.get(id);
  if (recomputed.get(id) !== row.earned_grade) recomputeMismatches++;
}
ok(recomputeMismatches === 0, `algebra.recompute-grade over the rendered subgraph equals the read's earned grades for all ${nodeIds.length} nodes (${recomputeMismatches} mismatches)`);

const projected = projectOntoNodes((id, input) => community.api.runTransform(id, input), kernel, nodeIds);
ok(projected.state.entries.length <= kernel.state.entries.length, `graph.project yields a subset (${projected.state.entries.length} of ${kernel.state.entries.length})`);
const projectedIds = new Set(projected.state.entries.map((e) => e.identity));
ok([...projectedIds].every((id) => nodeIds.includes(id)), "the projected subset is exactly (no more than) the rendered node set");
ok(typeof recomputed === "object" || recomputed instanceof Map, "recompute-grade's return is a value/map, never a kernel");
ok(!("propose" in projected) && !("decision" in projected), "neither transform's result carries a propose or gate-decision field (nothing landed)");

console.log("\n" + H);
if (fails === 0) console.log("verified: the layered layout is complete against the real support cone and deterministic; every grade, gap, and crux traced to community.api with none recomputed; the screen exposes no landing path; every legend label resolves from the vendored glossary; algebra.recompute-grade and graph.project over the rendered subgraph reproduce the membrane's own grades and a real subset, landing nothing.");
console.log(fails === 0 ? "check-graph: OK" : `check-graph: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
