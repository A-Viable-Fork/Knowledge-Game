// Role: assemble the one registry. Merge every addressable component (primitives, case
//   nodes, atlas entries, instances, and presentation components) into a single id-keyed
//   map that the resolver reads. This is the address space the composition claim rests on.
// Contract: buildRegistry({primitives, atlas, cases, components, forks, bodies})->{ id -> component }.
//   bodies is a pre-flattened id-keyed map (body leaves + body-existence entries); the caller
//   builds it so this stays DOM-free and require-free. Pure; throws on a duplicate id.
// Invariant: one id, one definition (reference-not-inline). A case contributes its nodes
//   and instances; nothing shared is copied. Adding a case never edits this file.
"use strict";

function buildRegistry(sources) {
  sources = sources || {};
  const registry = Object.create(null);
  const put = (id, c, origin) => {
    if (!id) throw new Error("component with no id (from " + origin + ")");
    if (registry[id]) throw new Error("duplicate id '" + id + "' (from " + origin + ")");
    registry[id] = c;
  };

  const { primitives, atlas, cases, components, forks, bodies } = sources;
  if (primitives) for (const id of Object.keys(primitives)) put(id, primitives[id], "primitives");
  if (atlas) for (const id of Object.keys(atlas)) put(id, atlas[id], "atlas");
  if (bodies) for (const id of Object.keys(bodies)) put(id, bodies[id], "bodies");
  if (Array.isArray(cases))
    for (const c of cases) {
      if (c.nodes) for (const id of Object.keys(c.nodes)) put(id, c.nodes[id], "case:" + c.id);
      if (Array.isArray(c.instances)) for (const inst of c.instances) put(inst.id, inst, "case:" + c.id);
    }
  if (components) for (const id of Object.keys(components)) put(id, components[id], "components");
  if (forks) for (const id of Object.keys(forks)) put(id, forks[id], "forks");

  return registry;
}

if (typeof module !== "undefined" && module.exports) module.exports = { buildRegistry };
