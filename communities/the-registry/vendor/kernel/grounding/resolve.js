// Role: the one resolver. Every data and presentation lookup goes through resolve(id),
//   which understands forks (merge a live fork's overrides onto its resolved parent, or
//   return a snapshot's frozen copy). Also: referencesOf and the dependents query.
// Contract: makeResolver(registry)->resolve(id); referencesOf(component)->[id];
//   dependents(registry, id)->[id]; deepMerge(a, b)->object. All pure and DOM-free.
// Invariant: a fork is a diff against a parent (docs/components-and-forking.md). Resolve is
//   the single chokepoint so propagation is free: change a definition at an id and every
//   reference resolves to the new version. No hidden state; the registry is passed in.
"use strict";

// deep field-by-field overlay: nested plain objects merge; everything else, override wins.
function isPlainObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}
function deepMerge(base, over) {
  if (!isPlainObject(base)) return over;
  if (!isPlainObject(over)) return over;
  const out = Object.assign({}, base);
  for (const k of Object.keys(over)) {
    out[k] = isPlainObject(base[k]) && isPlainObject(over[k]) ? deepMerge(base[k], over[k]) : over[k];
  }
  return out;
}

// the ids a component points to, across every reference-bearing field we know about.
function referencesOf(c) {
  if (!c || typeof c !== "object") return [];
  const ids = [];
  const pushArr = (a) => Array.isArray(a) && a.forEach((x) => typeof x === "string" && ids.push(x));
  const pushOne = (x) => typeof x === "string" && ids.push(x);
  pushArr(c.children);
  pushArr(c.inputs);
  pushArr(c.outputs);
  pushOne(c.atlas_ref);
  pushOne(c.produced_by);
  pushOne(c.instantiates);
  pushOne(c.broken_node);
  if (c.guard && c.guard.assumption_id) pushOne(c.guard.assumption_id);
  if (c.perturb && Array.isArray(c.perturb.cascade)) c.perturb.cascade.forEach((s) => pushOne(s.target));
  if (Array.isArray(c.clones)) c.clones.forEach((cl) => pushOne(cl.node_id));
  // body_refs cite a body property as "<body>#<property>". The reference edge points at the BODY
  // (its existence): an absent body falls through to the dangling rule, while an existing body
  // whose property is not yet populated is a populate-on-demand coverage gap, not a broken edge.
  if (Array.isArray(c.body_refs))
    c.body_refs.forEach((r) => {
      if (typeof r === "string" && r) pushOne("body." + r.split("#")[0]);
    });
  if (c.visual && c.visual.component) pushOne(c.visual.component);
  pushOne(c.card);
  pushOne(c.forks);
  pushOne(c.copy_of);
  return ids;
}

// resolve(id): the merged component. Live fork -> parent merged with overrides; snapshot ->
//   its frozen copy; plain -> itself. Guards against fork cycles (the linter also checks).
function makeResolver(registry) {
  function resolve(id, seen) {
    const c = registry[id];
    if (!c) return undefined;
    if (c.forks) {
      seen = seen || new Set();
      if (seen.has(id)) throw new Error("fork cycle at " + id);
      seen.add(id);
      const parent = resolve(c.forks, seen);
      if (parent === undefined) return undefined;
      return deepMerge(parent, c.overrides || {});
    }
    if (c.copy_of) {
      // snapshot: frozen at fork time; if not precomputed, freeze the parent now.
      return c.frozen !== undefined ? c.frozen : (c.frozen = resolve(c.copy_of, seen));
    }
    return c;
  }
  return resolve;
}

// dependents(registry, id): every component that references id (the blast radius).
function dependents(registry, id) {
  const out = [];
  for (const key of Object.keys(registry)) {
    if (referencesOf(registry[key]).includes(id)) out.push(key);
  }
  return out;
}

if (typeof module !== "undefined" && module.exports)
  module.exports = { makeResolver, referencesOf, dependents, deepMerge };
