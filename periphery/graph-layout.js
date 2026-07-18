// Role: the deterministic layered layout (KG-GRAPH). Turns a claim's support cone, or a community's
//   conclusions and their cones, into positioned nodes and typed edges: a pure function of the graph,
//   never force-directed, so the same graph and focus yield byte-identical positions every run. This
//   is the anti-hairball guarantee: a random or physics layout cannot be checked and cannot be trusted
//   to look finished, so this module is deliberately dumb and deliberately reproducible instead.
// Contract: layout(graph, focus) -> { nodes: [{id, x, y, layer}], edges: [{from, to, kind}] }. graph =
//   { entries, links } (community.raw.state's own shape). focus = a claim identity (renders that
//   claim's support cone) or null/undefined (renders every conclusion, a claim never cited as
//   another's supporting evidence, and its own cone). Nodes and edges come from the cone; nothing is
//   invented. nodeSetOf(graph, focus) -> Set<identity>, the exact node set layout would render,
//   exposed separately so build/check-graph.mjs can assert completeness without re-deriving layout's
//   internals.
// Invariant: PURE, DOM-free. No randomness, no Date.now, no Math.random, no iteration-order dependence
//   left unsorted: every set is turned into a sorted array before it drives a position. Layering is a
//   longest-path assignment (a node reachable by two chains of different length settles at the deeper
//   one), so every edge points from a strictly shallower layer to a strictly deeper one, and a within-
//   layer tie always breaks on claim identity, never insertion order.
"use strict";

function byId(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

// supports links only, indexed by what they support: to_identity -> [from_identity, ...]. Mirrors
// vendor/kernel/analysis/reconciliation.mjs's own supportCone exactly (this module cannot import that
// kernel module directly, periphery reaches vendor only through api/; this is the identical algorithm,
// walked here over graph structure this screen already legitimately holds via community.raw.state).
function buildSupportsInto(links) {
  const supportsInto = new Map();
  for (const l of links || []) {
    if (l.link_kind !== "supports") continue;
    if (!supportsInto.has(l.to_identity)) supportsInto.set(l.to_identity, []);
    supportsInto.get(l.to_identity).push(l.from_identity);
  }
  return supportsInto;
}

// every claim reachable by following supports links backward from id (to -> from), excluding id
// itself: the support cone, identical in shape to reconciliation.mjs's supportCone(graph, id).members.
function supportConeMembers(supportsInto, id) {
  const members = new Set();
  const stack = [id];
  const seen = new Set([id]);
  while (stack.length) {
    const cur = stack.pop();
    for (const from of (supportsInto.get(cur) || [])) {
      if (!members.has(from)) members.add(from);
      if (!seen.has(from)) { seen.add(from); stack.push(from); }
    }
  }
  return members;
}

// conclusions: claims never cited as another claim's supporting evidence (never a supports link's own
// from_identity), excluding comment-kind claims, which never support anything by construction (the
// gate's comment-guard) and would otherwise trivially qualify as a "conclusion" of nothing.
function findConclusions(entries, links) {
  const usedAsSupport = new Set();
  for (const l of links || []) {
    if (l.link_kind === "supports") usedAsSupport.add(l.from_identity);
  }
  const byIdentity = new Map((entries || []).map((e) => [e.identity, e]));
  return (entries || [])
    .map((e) => e.identity)
    .filter((id) => !usedAsSupport.has(id))
    .filter((id) => (byIdentity.get(id) || {}).kind !== "comment")
    .sort(byId);
}

export function layout(graph, focus) {
  const entries = graph.entries || [];
  const links = graph.links || [];
  const supportsInto = buildSupportsInto(links);

  const roots = focus ? [focus] : findConclusions(entries, links);

  const nodeSet = new Set(roots);
  for (const root of roots) {
    for (const m of supportConeMembers(supportsInto, root)) nodeSet.add(m);
  }

  // longest-path layering: layer(root) = 0. A supports link's evidence side (from_identity) sits one
  // layer deeper than what it supports (to_identity); a depends-on link's precondition side
  // (to_identity) sits one layer deeper than its dependent (from_identity). Both push "deeper" the
  // same direction the argument runs, toward evidence and preconditions, away from the conclusion.
  // Reaching a node by a longer chain always wins (the ">=" guard below), so the layout never draws an
  // edge from a deeper layer back to a shallower one.
  const deeper = new Map();
  const addDeeper = (shallow, deep) => {
    if (!nodeSet.has(shallow) || !nodeSet.has(deep)) return;
    if (!deeper.has(shallow)) deeper.set(shallow, []);
    deeper.get(shallow).push(deep);
  };
  for (const [to, froms] of supportsInto) for (const from of froms) addDeeper(to, from);
  for (const l of links) if (l.link_kind === "depends-on") addDeeper(l.from_identity, l.to_identity);

  const layerOf = new Map();
  function visit(node, incomingLayer) {
    const current = layerOf.get(node);
    if (current !== undefined && current >= incomingLayer) return;
    layerOf.set(node, incomingLayer);
    for (const child of (deeper.get(node) || [])) visit(child, incomingLayer + 1);
  }
  for (const root of roots.slice().sort(byId)) visit(root, 0);

  const LAYER_SPACING = 180;
  const ROW_SPACING = 88;
  const byLayer = new Map();
  for (const id of nodeSet) {
    const layer = layerOf.get(id) || 0;
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer).push(id);
  }
  const nodes = [];
  for (const layer of [...byLayer.keys()].sort((a, b) => a - b)) {
    const ids = byLayer.get(layer).slice().sort(byId);
    ids.forEach((id, index) => {
      nodes.push({ id, x: layer * LAYER_SPACING, y: index * ROW_SPACING, layer });
    });
  }

  const edges = [];
  for (const l of links) {
    if (!nodeSet.has(l.from_identity) || !nodeSet.has(l.to_identity)) continue;
    edges.push({ from: l.from_identity, to: l.to_identity, kind: l.link_kind });
  }
  edges.sort((a, b) => byId(a.from, b.from) || byId(a.to, b.to) || byId(a.kind, b.kind));

  return { nodes, edges };
}

export function nodeSetOf(graph, focus) {
  return new Set(layout(graph, focus).nodes.map((n) => n.id));
}
