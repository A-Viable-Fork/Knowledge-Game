// Role: the graph object (KG-GRAPH): the kernel graph drawn as an interactive object, either a claim's
//   support cone (focus set) or a community's conclusions and their cones (no focus). Reads every
//   grade, gap, and crux through community.api (claim-8: the periphery's read path crosses into
//   vendor in exactly one place) and computes none of them here; the layered layout (periphery/graph-
//   layout.js) is the only structure this screen derives itself, and that is graph reachability, not
//   grounding. A node whose declared grade exceeds what it earned is flagged as a declared-vs-earned
//   divergence, the same reading community.api.gaps() already performs; a terminal (characterizedGaps)
//   renders as a withheld-record leaf; a crux (reconciliations) renders as a candidate frontier, never
//   a settled answer.
// Contract: renderGraphScreen(container, ctx) -> void. ctx = { graph: {entries, links}
//   (community.raw.state's own shape), read(query), gaps(query), characterizedGaps(query),
//   reconciliations(query), glossary(), focus: identity|null, transforms(pack)?, runTransform(id,
//   input)?, kernelView()? (api/compute/kernel-view.js, for Step 3's transform-on-graph: the K shape
//   algebra.recompute-grade and graph.project consume) }. buildGraphView(ctx) -> { nodes: [{id, x, y,
//   layer, kind, statement, declaredGrade, earnedGrade, diverges, terminal, crux}], edges: [{from, to,
//   kind, contested}], legendLinks: [{kind, description}], legendGrades: [{grade, description}] }, the
//   exact DOM-free resolution the render path uses, mirroring periphery/contribute-screen.js's
//   glossaryHelpFor and periphery/compute-screen.js's computePickerRows, so build/check-graph.mjs
//   exercises precisely what would render. recomputeGradesOverNodes(runTransform, kernel, nodeIds) ->
//   Map<identity, grade>, and projectOntoNodes(runTransform, kernel, nodeIds) -> the projected kernel,
//   both DOM-free, Step 3's transform-on-graph resolved the same way.
// Invariant: read-only, rung 1. Clicking a node opens an inspect panel; there is no landing path, no
//   propose, from this screen. Every link-kind and grade label resolves from ctx.glossary() (the
//   vendored kernel/schema/glossary.mjs); this module authors no label of its own. The crux is always
//   rendered candidate, never a verdict: a `crux.candidate` field renders alongside the frontier, and
//   the frontier is never presented as decided. Step 3's transforms run over the rendered subgraph and
//   land nothing: recompute-grade renders a badge, project re-renders a restricted view; neither calls
//   propose.
"use strict";
import { layout } from "./graph-layout.js";
import { renderHelpAsterisk } from "./help-asterisk.js";

// two element builders: html() for the chrome around the graph, svgEl() for the graph itself. Kept
// separate because SVG elements need createElementNS, not createElement.
function html(tag, attrs, ...children) {
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
function svgEl(tag, attrs, ...children) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children) {
    if (c === undefined || c === null) continue;
    node.appendChild(c);
  }
  return node;
}

// buildGraphView(ctx): the DOM-free resolution. Layout comes from periphery/graph-layout.js (pure
// graph structure); every grade, gap, and crux comes from ctx's community.api methods, read once and
// joined onto the positioned nodes/edges. Nothing here recomputes a grade or a crux.
export function buildGraphView(ctx) {
  const { nodes, edges } = layout(ctx.graph, ctx.focus);
  const nodeIds = new Set(nodes.map((n) => n.id));

  const rows = ctx.read({});
  const rowsByIdentity = new Map(rows.map((r) => [r.identity, r]));
  const gapIdentities = new Set((ctx.gaps({}) || []).map((g) => g.identity));
  const terminalIdentities = new Set((ctx.characterizedGaps({}) || []).map((g) => g.identity));
  const reconciliations = ctx.reconciliations({}) || [];

  // crux candidates and contested edges: only reconciliations whose both sides are actually rendered
  // (both in this cone/overview) contribute; a disagreement outside the rendered node set is not drawn.
  const cruxIdentities = new Set();
  const contestedPairs = new Set();
  const cruxByPair = new Map();
  for (const r of reconciliations) {
    const a = r.side_a.identity, b = r.side_b.identity;
    if (!nodeIds.has(a) || !nodeIds.has(b)) continue;
    contestedPairs.add([a, b].sort().join("|"));
    cruxByPair.set([a, b].sort().join("|"), r.crux);
    for (const id of r.crux.frontier_candidates || []) if (nodeIds.has(id)) cruxIdentities.add(id);
  }

  const glossary = ctx.glossary();
  const viewNodes = nodes.map((n) => {
    const row = rowsByIdentity.get(n.id) || {};
    return {
      id: n.id, x: n.x, y: n.y, layer: n.layer,
      kind: row.kind || null,
      statement: row.statement || null,
      declaredGrade: row.declared_grade || null,
      earnedGrade: row.earned_grade || null,
      diverges: gapIdentities.has(n.id),
      terminal: terminalIdentities.has(n.id),
      crux: cruxIdentities.has(n.id),
    };
  });
  const viewEdges = edges.map((e) => ({
    from: e.from, to: e.to, kind: e.kind,
    contested: e.kind === "contradicts" && contestedPairs.has([e.from, e.to].sort().join("|")),
    crux: e.kind === "contradicts" ? cruxByPair.get([e.from, e.to].sort().join("|")) || null : null,
  }));

  const presentLinkKinds = [...new Set(viewEdges.map((e) => e.kind))].sort();
  const legendLinks = presentLinkKinds.map((kind) => ({ kind, description: (glossary.LINKS[kind] || {}).description || "" }));
  const presentGrades = [...new Set(viewNodes.map((n) => n.declaredGrade).concat(viewNodes.map((n) => n.earnedGrade)).filter(Boolean))].sort();
  const legendGrades = presentGrades.map((grade) => ({ grade, description: (glossary.GRADES[grade] || {}).description || "" }));

  return { nodes: viewNodes, edges: viewEdges, legendLinks, legendGrades };
}

// Step 3, transform-on-graph: algebra.recompute-grade over the visible nodes. Returns a
// Map<identity, grade>, one runTransform call per node, so the demonstration is literally the
// membrane's own grades reproduced through the compute contract, not a parallel computation.
export function recomputeGradesOverNodes(runTransform, kernel, nodeIds) {
  const out = new Map();
  for (const id of nodeIds) out.set(id, runTransform("algebra.recompute-grade", { kernel, id }));
  return out;
}

// Step 3, transform-on-graph: graph.project restricted to exactly the rendered node set. Returns the
// projected kernel graph.project itself produced; this module never restricts a graph by hand.
export function projectOntoNodes(runTransform, kernel, nodeIds) {
  const idSet = new Set(nodeIds);
  return runTransform("graph.project", { kernel, predicate: (e) => idSet.has(e.identity) });
}

function nodeCard(n, ctx, onInspect, recomputedGrade) {
  const classes = ["graph-node"];
  if (n.diverges) classes.push("graph-node-diverges");
  if (n.terminal) classes.push("graph-node-terminal");
  if (n.crux) classes.push("graph-node-crux");
  const height = recomputedGrade !== undefined ? 78 : 64;
  const g = svgEl("g", { class: classes.join(" "), transform: `translate(${n.x},${n.y})`, tabindex: "0", role: "button", "aria-label": `inspect ${n.id}` });
  const rect = svgEl("rect", { x: 0, y: 0, width: 160, height, rx: 6 });
  const kindText = svgEl("text", { x: 8, y: 16, class: "graph-node-kind" });
  kindText.textContent = n.kind || "";
  const declaredText = svgEl("text", { x: 8, y: 34, class: "graph-node-declared" });
  declaredText.textContent = `declared: ${n.declaredGrade || "?"}`;
  const earnedText = svgEl("text", { x: 8, y: 48, class: "graph-node-earned" });
  earnedText.textContent = `earned: ${n.earnedGrade || "?"}`;
  g.appendChild(rect);
  g.appendChild(kindText);
  g.appendChild(declaredText);
  g.appendChild(earnedText);
  if (recomputedGrade !== undefined) {
    // Step 3: algebra.recompute-grade's own result, rendered beside the membrane's earned grade so the
    // reproduction is visible, node by node; this is the demonstration, not a new grade.
    const recomputedText = svgEl("text", { x: 8, y: 62, class: "graph-node-recomputed" });
    recomputedText.textContent = `recomputed: ${recomputedGrade}${recomputedGrade === n.earnedGrade ? " (matches)" : " (differs)"}`;
    g.appendChild(recomputedText);
  }
  if (n.diverges) {
    const flag = svgEl("text", { x: 8, y: 60, class: "graph-node-divergence-flag" });
    flag.textContent = "declared exceeds earned";
    g.appendChild(flag);
  }
  if (n.terminal) {
    const flag = svgEl("text", { x: 130, y: 16, class: "graph-node-terminal-flag" }, );
    flag.textContent = "*";
    g.appendChild(flag);
  }
  if (n.crux) {
    const flag = svgEl("text", { x: 145, y: 16, class: "graph-node-crux-flag" });
    flag.textContent = "!";
    g.appendChild(flag);
  }
  g.addEventListener("click", () => onInspect(n));
  g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") onInspect(n); });
  return g;
}

function edgeLine(e, positionsById) {
  const from = positionsById.get(e.from);
  const to = positionsById.get(e.to);
  if (!from || !to) return null;
  const classes = ["graph-edge", `graph-edge-${e.kind}`];
  if (e.contested) classes.push("graph-edge-contested");
  return svgEl("line", {
    class: classes.join(" "),
    x1: from.x + 80, y1: from.y + 32, x2: to.x + 80, y2: to.y + 32,
  });
}

function inspectPanel(mount, n, ctx) {
  mount.innerHTML = "";
  if (!n) return;
  const cruxNote = n.crux ? "This claim sits on the crux frontier: a candidate, not a decided answer." : null;
  const asterisk = renderHelpAsterisk({
    description: `${n.kind || "?"}: ${n.statement || ""}`,
    whenToUse: `declared ${n.declaredGrade || "?"}, earned ${n.earnedGrade || "?"}${n.diverges ? " (declared exceeds earned)" : ""}${n.terminal ? "; a withheld-record leaf, characterized as an open gap" : ""}${cruxNote ? "; " + cruxNote : ""}`,
    label: n.id,
  });
  mount.appendChild(html("div", { class: "graph-inspect-panel" }, html("p", { class: "graph-inspect-id" }, n.id), asterisk));
}

export function renderGraphScreen(container, ctx) {
  container.innerHTML = "";
  const view = buildGraphView(ctx);
  const positionsById = new Map(view.nodes.map((n) => [n.id, n]));

  const collapsed = new Set();
  const inspectMount = html("div", { class: "graph-inspect-mount" });
  let recomputedById = null; // Step 3: set by "Run algebra.recompute-grade", cleared on any redraw cause
  let projectedNotice = null; // Step 3: set by "Run graph.project", a plain confirmation string

  function subtreeOf(id) {
    // every node reachable strictly deeper via an edge that starts at id (fold on collapse).
    const out = new Set();
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      for (const e of view.edges) {
        if (e.from === cur && positionsById.get(e.to) && positionsById.get(e.to).layer > positionsById.get(cur).layer && !out.has(e.to)) {
          out.add(e.to);
          stack.push(e.to);
        }
      }
    }
    return out;
  }

  function visibleNodesNow() {
    const hidden = new Set();
    for (const id of collapsed) for (const d of subtreeOf(id)) hidden.add(d);
    return view.nodes.filter((n) => !hidden.has(n.id));
  }

  function draw() {
    const visibleNodes = visibleNodesNow();
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = view.edges.filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to));

    const maxX = visibleNodes.reduce((m, n) => Math.max(m, n.x), 0) + 200;
    const maxY = visibleNodes.reduce((m, n) => Math.max(m, n.y), 0) + 100;

    // the canvas is drawn at 1:1 scale (no forced height cap, which would squash the vertical layout
    // into an unreadable mass); legibility at scale comes from a scrollable mount (CSS, app/style.css)
    // and per-node collapse, never from cramming a tall layout into a fixed viewport.
    const svg = svgEl("svg", { class: "graph-canvas", viewBox: `0 0 ${maxX} ${maxY}`, width: maxX, height: maxY });
    for (const e of visibleEdges) {
      const line = edgeLine(e, positionsById);
      if (line) svg.appendChild(line);
    }
    for (const n of visibleNodes) {
      const recomputedGrade = recomputedById ? recomputedById.get(n.id) : undefined;
      const card = nodeCard(n, ctx, (clicked) => inspectPanel(inspectMount, clicked, ctx), recomputedGrade);
      const hasChildren = view.edges.some((e) => e.from === n.id && positionsById.get(e.to) && positionsById.get(e.to).layer > n.layer);
      if (hasChildren) {
        const toggle = svgEl("text", { x: 150, y: 60, class: "graph-node-collapse-toggle" });
        toggle.textContent = collapsed.has(n.id) ? "+" : "-";
        toggle.addEventListener("click", (e) => {
          e.stopPropagation();
          if (collapsed.has(n.id)) collapsed.delete(n.id); else collapsed.add(n.id);
          recomputedById = null;
          projectedNotice = null;
          draw();
        });
        card.appendChild(toggle);
      }
      svg.appendChild(card);
    }
    canvasMount.innerHTML = "";
    canvasMount.appendChild(svg);
    transformStatusMount.innerHTML = "";
    if (projectedNotice) transformStatusMount.appendChild(html("p", { class: "graph-transform-status" }, projectedNotice));
    return visibleNodes;
  }

  const canvasMount = html("div", { class: "graph-canvas-mount" });
  const transformStatusMount = html("div", { class: "graph-transform-status-mount" });

  // Step 3, transform-on-graph: completes the compute picker over exactly the rendered subgraph.
  // Read-only: both buttons compute and display; neither lands or proposes anything. Statistics is
  // never offered here (its input is values, not a graph).
  let transformPanel = null;
  if (ctx.runTransform && ctx.kernelView) {
    const recomputeBtn = html("button", { type: "button", class: "graph-transform-run" }, "Run algebra.recompute-grade over visible nodes");
    recomputeBtn.addEventListener("click", () => {
      const kernel = ctx.kernelView();
      recomputedById = recomputeGradesOverNodes(ctx.runTransform, kernel, visibleNodesNow().map((n) => n.id));
      projectedNotice = null;
      draw();
    });
    const projectBtn = html("button", { type: "button", class: "graph-transform-run" }, "Run graph.project (restrict to visible nodes)");
    projectBtn.addEventListener("click", () => {
      const kernel = ctx.kernelView();
      const projected = projectOntoNodes(ctx.runTransform, kernel, visibleNodesNow().map((n) => n.id));
      recomputedById = null;
      projectedNotice = `graph.project restricted the kernel to ${projected.state.entries.length} of ${kernel.state.entries.length} claims (exactly the currently visible nodes). Nothing landed; this is a computed view, not a new claim.`;
      draw();
    });
    transformPanel = html("div", { class: "graph-transform-panel" }, html("h3", {}, "Transforms over this subgraph"), recomputeBtn, projectBtn);
  }

  const legend = html(
    "div",
    { class: "graph-legend" },
    html("h3", {}, "Legend"),
    html("div", { class: "graph-legend-links" }, ...view.legendLinks.map((l) => html("span", { class: "graph-legend-entry" }, renderHelpAsterisk({ description: l.description, label: l.kind }), ` ${l.kind}`))),
    html("div", { class: "graph-legend-grades" }, ...view.legendGrades.map((g) => html("span", { class: "graph-legend-entry" }, renderHelpAsterisk({ description: g.description, label: g.grade }), ` ${g.grade}`)))
  );

  container.appendChild(
    html(
      "section",
      { class: "graph-screen", "aria-label": "Graph" },
      html("h2", {}, ctx.focus ? "Claim graph" : "Community overview"),
      html("p", {}, "Every grade, gap, and crux here is read from the community's own graph; nothing is recomputed. Clicking a node inspects it; nothing here proposes or lands a claim."),
      legend,
      canvasMount,
      transformStatusMount,
      transformPanel,
      inspectMount
    )
  );
  draw();
}
