// Role: the DOWN motion. Zoom into a node's interior: classify each node as expandable
//   (transformation), a cited basis (primitive), or a given (atomic assumption/observation/
//   closure), and resolve one level of children. Walks `children` edges only.
// Contract: classify(node)->string; motions(node, resolve)->{decompose,compare,perturb};
//   focusView(resolve, id)->{node, children:[{node, kind, expandable}]}. `resolve` is the
//   id resolver from engine/resolve.js. All functions are pure and DOM-free (T0-2, T1-5).
// Invariant: same input, same output, no side effects, no DOM. Every lookup goes through
//   resolve (reference-not-inline); decompose is the zoom on the nested inference graph
//   (schema-revisions.md S1) and never re-derives a primitive.
"use strict";

// classify: what kind of terminus (or non-terminus) a node is, for rendering and clicks.
//   "transformation" expands; "primitive" is a walled basis; "given" is a world-fact/input.
function classify(node) {
  if (!node) return "missing";
  if (node.kind === "primitive") return "primitive";
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  if (hasChildren) return "transformation"; // claim/transformation/assumption with structure
  if (node.kind === "transformation" || node.kind === "claim") return "transformation";
  // atomic assumption, observation, prediction, comparison: a given the cascade meets
  return "given";
}

function isExpandable(node) {
  return Array.isArray(node && node.children) && node.children.length > 0;
}

// motions: which of the three affordances a node offers. Only `decompose` is wired in v1;
//   compare (v2) and perturb (v3) are reported so the card can show them as later. The
//   atlas entry is reached through resolve, like every other reference.
function motions(node, resolve) {
  const m = { decompose: false, compare: { available: false, count: 0 }, perturb: false };
  if (!node) return m;
  m.decompose = isExpandable(node);
  const entry = node.atlas_ref && resolve ? resolve(node.atlas_ref) : null;
  if (entry && Array.isArray(entry.clones)) {
    m.compare = { available: entry.clones.length > 0, count: entry.clones.length };
  }
  m.perturb = node.kind === "assumption" && Boolean(node.perturb);
  return m;
}

// focusView: the one-level-down view of a focused node. Children are resolved through the
//   resolver and tagged with their classification, so the renderer never re-reads the graph.
function focusView(resolve, id) {
  const node = resolve(id);
  if (!node) return { node: null, children: [] };
  const childIds = Array.isArray(node.children) ? node.children : [];
  const children = childIds
    .map((cid) => resolve(cid))
    .filter(Boolean)
    .map((c) => ({ node: c, kind: classify(c), expandable: isExpandable(c) }));
  return { node, children };
}

if (typeof module !== "undefined" && module.exports)
  module.exports = { classify, isExpandable, motions, focusView };
