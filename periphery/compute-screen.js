// Role: the compute picker (KG-COMPUTE): lists every transformation the active community's compute
//   surface carries (graph and algebra, canonical; statistics, KG's own forkable pack), rendering each
//   one's assumptions manifest through the reused help affordance (periphery/help-asterisk.js) at pick
//   time, before anything runs. The centerpiece is the statistics pack's own disagreement: running the
//   preset demo shows statistics.naive-multiply's product beside statistics.dependence-aware's refusal
//   over the same shared-mechanism input, each carrying its own manifest on screen at the same time.
//   That is the false-confidence lesson made interactive: a picker that only reveals an assumption
//   after the number appears would reintroduce exactly the failure the manifest exists to prevent.
// Contract: renderComputeScreen(container, ctx) -> void. ctx = { transforms(), describeTransform(id),
//   runTransform(id, input) }, the exact shape community.api already exposes (api/community.js's
//   provider override, api/compute/registry.js). computePickerRows(catalog) -> { graph, algebra,
//   statistics }, each entry's id/pack/consumes/emits/reversibility/assumptions carried through
//   unchanged, DOM-free so build/check-compute-picker.mjs asserts against precisely what would
//   render, never a parallel description of it (mirroring periphery/ladder.js's STATES and
//   periphery/contribute-screen.js's glossaryHelpFor). DEMO_FACTORS is the one preset shared-
//   mechanism input; runDisagreementDemo(runTransform) runs both statistics entries over it and
//   returns both results, also DOM-free.
// Invariant: read-only, rung 1. This screen computes derived values and displays them; it exposes no
//   propose and no landing, and offers no path from a run result into one. The graph and algebra
//   entries are listed with their manifests but never run here (running them over the active
//   community graph, and rendering the resulting kernel view, needs the graph visualization and is
//   the follow-up prompt, not this one). Every assumption rendered resolves from a catalog entry;
//   this module authors no assumption text of its own. DEMO_FACTORS is illustrative and labeled as
//   such: the numbers stand in for a debate's shared-mechanism factors, not a corpus-anchored value,
//   and only the disagreement between the two statistics entries is under demonstration.
"use strict";
import { renderHelpAsterisk } from "./help-asterisk.js";

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children) {
    if (c === undefined || c === null || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

const PACK_ORDER = ["graph", "algebra", "statistics"];
const PACK_LABELS = { graph: "Graph", algebra: "Algebra", statistics: "Statistics (KG's own, forkable)" };

// computePickerRows(catalog): the picker's own per-transformation render data, grouped by pack, each
// entry's manifest carried through as-is from the catalog transforms() already returned (run
// omitted, per the vendored contract). Pure, DOM-free: the manifest is present here, before any run
// is ever invoked, which is exactly what check 3 (build/check-compute-picker.mjs) asserts against.
export function computePickerRows(catalog) {
  const byPack = { graph: [], algebra: [], statistics: [] };
  for (const entry of catalog || []) {
    const row = {
      id: entry.id,
      pack: entry.pack,
      consumes: entry.consumes,
      emits: entry.emits,
      reversibility: entry.reversibility,
      assumptions: entry.assumptions,
    };
    if (!byPack[row.pack]) byPack[row.pack] = [];
    byPack[row.pack].push(row);
  }
  return byPack;
}

// the one preset shared-mechanism input the disagreement demo runs over: two factors declaring the
// same mechanism, illustrative only (Discipline #4). naive-multiply reads the bare factors;
// dependence-aware reads the same factors carrying their shared mechanism tag.
export const DEMO_FACTORS = [
  { factor: 2.4, mechanism: "shared-strategy-thread" },
  { factor: 1.7, mechanism: "shared-strategy-thread" },
];
export const DEMO_INPUT_NOTE =
  "Illustrative demo input, not a corpus-anchored value: two factors sharing one mechanism, standing in for a debate's shared-mechanism factors. Only the disagreement between the two statistics entries below is under demonstration.";

// runDisagreementDemo(runTransform): runs both of KG's statistics entries over the one preset input
// and returns both results, unmodified from what runTransform produced. Pure, DOM-free, so
// build/check-compute-picker.mjs exercises precisely this function for check 4.
export function runDisagreementDemo(runTransform) {
  const naive = runTransform("statistics.naive-multiply", DEMO_FACTORS.map((f) => f.factor));
  const dependenceAware = runTransform("statistics.dependence-aware", DEMO_FACTORS);
  return { naive, dependenceAware };
}

function manifestAsterisk(row) {
  const statement = (row.assumptions || []).map((a) => a.statement).join(" ");
  return renderHelpAsterisk({ description: statement, label: row.id });
}

function transformRow(row) {
  return el(
    "li",
    { class: "compute-row" },
    el("p", { class: "compute-row-id" }, row.id),
    el("p", { class: "compute-row-shape" }, `${row.consumes} -> ${row.emits}`),
    el("p", { class: "compute-row-reversibility" }, `reversibility: ${row.reversibility}`),
    manifestAsterisk(row)
  );
}

function resultPanel(label, result) {
  const manifest = (result.manifest || []).map((a) => a.statement).join(" ");
  const outcome =
    result.flag === "refused"
      ? `Refused: ${result.reason}`
      : `Value: ${result.value}`;
  return el(
    "div",
    { class: "compute-result-panel" },
    el("p", { class: "compute-result-label" }, label),
    el("p", { class: "compute-result-outcome" }, outcome),
    el("p", { class: "compute-result-manifest" }, manifest)
  );
}

function statisticsSection(rows, ctx) {
  if (!rows.length) return null;
  const resultMount = el("div", { class: "compute-demo-result" });
  const runBtn = el("button", { type: "button", class: "compute-run-demo" }, "Run the disagreement demo");
  runBtn.addEventListener("click", () => {
    const { naive, dependenceAware } = runDisagreementDemo(ctx.runTransform);
    resultMount.innerHTML = "";
    resultMount.appendChild(
      el(
        "div",
        { class: "compute-demo-results" },
        resultPanel("statistics.naive-multiply", naive),
        resultPanel("statistics.dependence-aware", dependenceAware)
      )
    );
  });
  return el(
    "section",
    { class: "compute-pack compute-pack-statistics" },
    el("h3", {}, PACK_LABELS.statistics),
    el("ul", { class: "compute-list" }, ...rows.map(transformRow)),
    el("p", { class: "compute-demo-note" }, DEMO_INPUT_NOTE),
    runBtn,
    resultMount
  );
}

function cataloguedSection(pack, rows) {
  if (!rows.length) return null;
  return el(
    "section",
    { class: `compute-pack compute-pack-${pack}` },
    el("h3", {}, PACK_LABELS[pack]),
    el("ul", { class: "compute-list" }, ...rows.map(transformRow))
    // running a graph or algebra entry over the active community graph, and rendering the resulting
    // kernel view (for example algebra.recompute-grade showing declared versus earned per claim), is
    // the follow-up prompt: it needs the graph visualization, not offered by this screen.
  );
}

export function renderComputeScreen(container, ctx) {
  container.innerHTML = "";
  const catalog = ctx.transforms();
  const rows = computePickerRows(catalog);

  container.appendChild(
    el(
      "section",
      { class: "compute-screen", "aria-label": "Compute" },
      el("h2", {}, "Compute"),
      el(
        "p",
        {},
        "Every transformation's assumptions are shown here, before it runs. This screen computes and displays; it never lands a result as a claim."
      ),
      ...PACK_ORDER.map((pack) => (pack === "statistics" ? statisticsSection(rows[pack] || [], ctx) : cataloguedSection(pack, rows[pack] || [])))
    )
  );
}
