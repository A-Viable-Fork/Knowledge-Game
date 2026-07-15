// Role: the ALONG motion. Apply a flipped-assumption set as a NON-DESTRUCTIVE overlay by COMPUTING the
//   consequence cascade from the support graph (Prompt 21, T1-3 discharged). Flipping an assumption
//   removes the support it grounds and the collapse propagates along the support edges, the same
//   inference edges the earned-grade fold reads: a prediction the flip reaches becomes sound, a
//   comparison whose reached prediction became sound becomes contradicted. This is the same
//   removal-and-recompute the robustness analysis runs for the worst single removal, aimed at a chosen
//   flip instead. The rule is audited in build/check-perturb.mjs.
// Contract: perturb(graph, flippedSet) -> overlay { states, trails }. graph is an id -> node map (a
//   case node map or the registry); flippedSet is an iterable of assumption ids. Pure and DOM-free.
// Invariant: the overlay is computed and returned, never a mutation of the graph (T0-3). Propagation
//   runs along support edges only (inputs, children, produced_by, outputs, tests); a node changes
//   state only when the flip reaches it through those edges, so no collapse is asserted that does not
//   follow from a lost support. The authored perturb.cascade is retained only as the verification
//   fixture the computed rule reproduces (docs/exclusion-reservoir.md, build/check-perturb.mjs).
"use strict";

// the display state a node takes when the flip reaches it, by kind. Only these kinds carry a state in
// the overlay: a prediction goes idle -> sound (it now asserts under the flipped hypothesis), and a
// comparison that tests a now-sound prediction goes consistent -> contradicted (the sound prediction
// contradicts the immutable observation). Any other reached node propagates the flip but shows no state.
function flippedStateFor(kind) {
  if (kind === "prediction") return "sound";
  if (kind === "comparison") return "contradicted";
  return null;
}

// the forward support adjacency (supporter -> dependents), inverted from the backward edges each node
// carries. These are exactly the inference edges the grounding fold reads: an input, a decomposition
// child, a producer, an output, and a comparison's tested prediction. No other edge propagates a flip.
function forwardEdges(nodes) {
  const forward = new Map();
  const add = (from, to) => { if (!from || !to || !nodes[from] || !nodes[to]) return; if (!forward.has(from)) forward.set(from, new Set()); forward.get(from).add(to); };
  for (const id of Object.keys(nodes)) {
    const n = nodes[id];
    if (!n || typeof n !== "object") continue;
    for (const s of n.inputs || []) add(s, id);   // an input supports this node
    for (const s of n.children || []) add(s, id); // a decomposition child supports its parent
    if (n.produced_by) add(n.produced_by, id);    // a producer supports what it produces
    for (const t of n.outputs || []) add(id, t);  // this node produces its outputs
    if (n.tests) add(n.tests, id);                // a comparison tests a prediction: the prediction supports it
  }
  return forward;
}

// perturb: compute each flipped assumption's cascade over the support graph.
//   states  - { [target]: new_state }, the as-flipped state of each consequence node.
//   trails  - the ordered consequence chain per flip, [{ from, to, new_state, consequence }, ...],
//             chained through the support path so a client can highlight it (assumption -> ... -> comparison).
//   perturb(graph, []) -> { states: {}, trails: [] }: the as-argued graph, untouched.
//   Deterministic: flip ids sorted, neighbours expanded in sorted order, states last-write-wins.
function perturb(graph, flippedSet) {
  const nodes = graph && typeof graph === "object" ? graph : {};
  const get = (id) => nodes[id];
  const forward = forwardEdges(nodes);
  const ids = Array.from(flippedSet || []).filter((x) => typeof x === "string").sort();
  const states = {};
  const trails = [];
  for (const id of ids) {
    const node = get(id);
    if (!node || node.kind !== "assumption") continue; // only an assumption flips
    // the flip's forward closure along support edges, with each node's parent on the path (for trails).
    const parent = new Map([[id, null]]);
    const order = [];
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift();
      for (const dep of Array.from(forward.get(cur) || []).sort()) {
        if (parent.has(dep)) continue;
        parent.set(dep, cur);
        order.push(dep);
        queue.push(dep);
      }
    }
    // a node changes state only if the flip reached it (it is in the closure) AND its kind carries a
    // state. The trail chains it to the nearest state-bearing ancestor (or the flip origin), so the
    // path skips the intermediate transformations that carry no display state.
    for (const nid of order) {
      const st = flippedStateFor((get(nid) || {}).kind);
      if (!st) continue;
      states[nid] = st; // last-write-wins over the sorted flip order
      let from = parent.get(nid);
      while (from && from !== id && !flippedStateFor((get(from) || {}).kind)) from = parent.get(from);
      const n2 = get(nid);
      const consequence = n2 && typeof n2.note === "string" && n2.note ? n2.note : ("the state becomes " + st);
      trails.push({ from: from, to: nid, new_state: st, consequence: consequence });
    }
  }
  return { states: states, trails: trails };
}

if (typeof module !== "undefined" && module.exports) module.exports = { perturb, forwardEdges };
