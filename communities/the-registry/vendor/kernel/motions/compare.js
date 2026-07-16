// Role: the SIDEWAYS motion. Walk instantiation: resolve an atlas entry and its clones
//   (the instances across cases), and for each compute its broken-node coordinate, which
//   child of the shared pipeline is the one that breaks. The departure is that coordinate
//   (docs/family-discrimination.md), not a description of resemblance.
// Contract: compare(resolve, atlasOrNode) -> { atlas, pipeline, stages, instances } | null,
//   where each instance is { caseLabel, instanceId, brokenNode, coordinate, stage, plain,
//   departure, closure }. pipelineMembers(resolve, rootId) -> Set of the root + descendants.
//   Pure and DOM-free (T0-2, T1-5); state is passed, never reached for.
// Invariant: the distance between two cases is the distance between their broken nodes in the
//   shared basis. compare reads that distance; it never re-derives a primitive or asserts a
//   resemblance.
"use strict";

// resolve the atlas entry from either an atlas id, an atlas entry object, or a node that
// carries an atlas_ref.
function atlasEntryOf(resolve, atlasOrNode) {
  const v = typeof atlasOrNode === "string" ? resolve(atlasOrNode) : atlasOrNode;
  if (!v) return null;
  if (Array.isArray(v.clones)) return v; // already an atlas entry
  if (v.atlas_ref) return resolve(v.atlas_ref) || null; // a node pointing into the atlas
  return null;
}

function compare(resolve, atlasOrNode) {
  const atlas = atlasEntryOf(resolve, atlasOrNode);
  if (!atlas || !Array.isArray(atlas.clones) || !atlas.clones.length) return null;

  // each clone names an instance; the instance carries its broken node and which pipeline
  // it instantiates.
  const instances = atlas.clones.map((cl) => {
    const inst = resolve(cl.node_id) || {};
    return {
      caseLabel: cl.case || inst.case || cl.node_id,
      instanceId: cl.node_id,
      brokenNode: inst.broken_node,
      instantiates: inst.instantiates,
      plain: inst.plain,
      departure: inst.departure || cl.departure,
      closure: inst.closure,
    };
  });

  // the shared pipeline is the node the instances instantiate (one shared root).
  const pipelineId = instances[0] && instances[0].instantiates;
  const pipeline = pipelineId ? resolve(pipelineId) : null;
  const childIds = pipeline && Array.isArray(pipeline.children) ? pipeline.children : [];
  const stages = childIds.map((id) => resolve(id)).filter(Boolean);

  // the broken-node coordinate: the index of the broken stage in the shared pipeline.
  for (const i of instances) {
    i.coordinate = childIds.indexOf(i.brokenNode);
    i.stage = i.brokenNode ? resolve(i.brokenNode) : null;
  }

  return { atlas, pipeline, stages, instances };
}

// pipelineMembers: the root plus everything reachable by children edges. Used to decide
// whether a focused node is "inside" a shared pipeline and so can open the compare view.
function pipelineMembers(resolve, rootId) {
  const seen = new Set();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const n = resolve(id);
    if (n && Array.isArray(n.children)) for (const c of n.children) stack.push(c);
  }
  return seen;
}

if (typeof module !== "undefined" && module.exports) module.exports = { compare, pipelineMembers, atlasEntryOf };
