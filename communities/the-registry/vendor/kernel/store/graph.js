// Role: pure graph utilities over the node schema. Index, traversal, acyclicity.
// Contract: functions take a node map ({id -> node}) or node list and return values;
//   never touch the DOM, never mutate inputs.
// Invariant: DOM-free and pure (T0-2, T1-5). This is what lets the engine run headless
//   for the linter and the compose gate. State is passed, never reached for (T0-3).
"use strict";

function indexById(nodes) {
  const list = Array.isArray(nodes) ? nodes : Object.values(nodes);
  const map = Object.create(null);
  for (const n of list) map[n.id] = n;
  return map;
}

function childrenOf(map, id) {
  const n = map[id];
  if (!n || !Array.isArray(n.children)) return [];
  return n.children.map((cid) => map[cid]).filter(Boolean);
}

// Returns { acyclic: bool, cycle: [ids] | null } over the decomposition (children) edges.
function decompositionAcyclic(map) {
  const WHITE = 0,
    GREY = 1,
    BLACK = 2;
  const color = Object.create(null);
  const stack = [];
  let cycle = null;
  function visit(id) {
    if (cycle) return;
    color[id] = GREY;
    stack.push(id);
    const node = map[id];
    const kids = node && Array.isArray(node.children) ? node.children : [];
    for (const c of kids) {
      if (!map[c]) continue; // unresolved child is a separate linter check
      if (color[c] === GREY) {
        cycle = stack.slice(stack.indexOf(c)).concat(c);
        return;
      }
      if ((color[c] || WHITE) === WHITE) visit(c);
      if (cycle) return;
    }
    stack.pop();
    color[id] = BLACK;
  }
  for (const id of Object.keys(map)) if ((color[id] || WHITE) === WHITE) visit(id);
  return { acyclic: !cycle, cycle };
}

// Leaves of the decomposition: nodes reachable as children-of-something with no children.
function leaves(map) {
  return Object.values(map).filter((n) => !n.children || n.children.length === 0);
}

if (typeof module !== "undefined" && module.exports)
  module.exports = { indexById, childrenOf, decompositionAcyclic, leaves };
