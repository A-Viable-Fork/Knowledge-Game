// Role: the gap taxonomy as typed predicates over the graph (docs/architecture-storage-api-
//   clients.md, "objective structure, subjective assessment"). A structural gap is an objective
//   fact about the graph, detected mechanically, first-class like a claim. Pure, DOM-free.
// LIVE (Prompt 16): kept while the Stage 1 lattice grounding was retired, because v3 does NOT cover
//   this. The v3 gate computes grounding (earned grade over supports); it does not detect the
//   OBJECTIVE structural gaps this finds over the trellis case graph, the un-authored stub, the
//   deferred verification, the un-populated atlas, the dangling reference. It keeps check-gaps at
//   zero and backs api.gaps. A v3 successor over the claim graph would supersede it; none exists yet.
// Contract: detectGaps(sources) -> [gap]; gap = { kind, at, missing, discharge, sorry_ref?,
//   ledger_ref? }. Per-predicate exports (groundingGaps/freshnessGaps/coverageGaps/danglingGaps)
//   for isolation tests. Reads the schema for kinds/markers; reuses referencesOf for edges.
// Invariant: OBJECTIVE detection only. A gap NEVER carries importance/score/weight/rank/priority,
//   and no path here orders gaps by importance (T0-5; the subjectivity boundary, linter-enforced).
//   The detector finds and reports; it never fills, guesses at, or invents a node.
"use strict";

(function (root) {
  const NODE = typeof module !== "undefined" && module.exports;
  const E = NODE
    ? { referencesOf: require("../grounding/resolve.js").referencesOf, SCHEMA: require("../schema/schema.js") }
    : { referencesOf: typeof referencesOf !== "undefined" ? referencesOf : null,
        SCHEMA: typeof SCHEMA !== "undefined" ? SCHEMA : null };

  // a source the graph no longer trusts: a freshness gap rests on one of these.
  const STALE_STATUSES = ["superseded", "retracted", "stale"];

  function hasMarker(n) {
    return E.SCHEMA ? E.SCHEMA.hasMarker(n) : !!(n && (n.sorry || n.TODO_verify));
  }
  // the sorry-ledger key for a node's marker (matches linter rule 3: `<id>#<field>`).
  function markerRef(n) {
    if (n && n.sorry) return n.id + "#sorry";
    if (n && n.TODO_verify) return n.id + "#TODO_verify";
    return undefined;
  }

  // a childless node that legitimately grounds the decomposition: a cited primitive (the floor),
  // or an observation (a world-fact that closes a claim). Anything else childless, reached as a
  // child, is support that bottoms out in nothing grounded.
  function isGroundedLeaf(n) {
    if (!n) return false;
    if (n.kind === "primitive") return !!n.citation;
    if (n.kind === "observation") return true;
    return false;
  }

  // GROUNDING: support, followed down, reaches no cited terminal, or a leaf that is not a cited
  // primitive. Two objective sub-rules, deduped by node id.
  function groundingGaps(nodeMap, instances) {
    const gaps = [];
    const seen = new Set();
    // (a) structural (reads no marker): a childless node reached as a child that is not a
    //     grounded leaf. This rediscovers the un-authored stubs blind.
    const childOf = new Set();
    for (const n of Object.values(nodeMap)) for (const c of n.children || []) childOf.add(c);
    for (const id of childOf) {
      const n = nodeMap[id];
      if (!n) continue; // a missing child is a dangling gap, not a grounding one
      const childless = !n.children || n.children.length === 0;
      if (!childless || isGroundedLeaf(n)) continue;
      seen.add(id);
      gaps.push({
        kind: "grounding",
        at: id,
        missing: "support bottoms out here: a childless " + n.kind + " that is not a cited primitive or an observation",
        discharge: n.sorry || "author this node to the floor with cited primitive leaves, or cite a terminal",
        sorry_ref: markerRef(n),
      });
    }
    // (b) provenance: a node carrying an explicit deferred verification of its grounding (a
    //     `sorry` stub or a `TODO_verify` value not yet confirmed against its cited source).
    for (const n of Object.values(nodeMap).concat(instances || [])) {
      if (!hasMarker(n) || seen.has(n.id)) continue;
      gaps.push({
        kind: "grounding",
        at: n.id,
        missing: n.sorry
          ? "an un-authored stub: its support is not yet drawn to the floor"
          : "a value grounded against the cited source is deferred (verification pending)",
        discharge: n.sorry || n.TODO_verify, // the marker text states exactly what would close it
        sorry_ref: markerRef(n),
      });
    }
    return gaps;
  }

  // FRESHNESS: a dependency resting on a source marked superseded, retracted, or stale. The
  // provenance status is optional (default current); the corpus carries none, so this is empty
  // on the current cases by design, and fires the moment a source is marked stale.
  function freshnessGaps(nodeMap, instances) {
    const gaps = [];
    for (const n of Object.values(nodeMap).concat(instances || [])) {
      const st = (n.citation && n.citation.status) || (n.provenance && n.provenance.status);
      if (st && STALE_STATUSES.includes(st)) {
        gaps.push({
          kind: "freshness",
          at: n.id,
          missing: "rests on a source marked '" + st + "'",
          discharge: "re-verify against a current source, or supersede the dependency",
          sorry_ref: markerRef(n),
        });
      }
    }
    return gaps;
  }

  // COVERAGE: a claim with no rebuttal-search recorded, a question-set branch left undrawn, or an
  // atlas pattern with clones but no typed preconditions (the un-populated atlas). Rebuttal-search
  // and question-set fire only on explicit markers, so absence is not flagged as a gap (a typing
  // choice: we do not assert a gap we have not characterized).
  function coverageGaps(nodeMap, atlas, bodies) {
    const gaps = [];
    for (const id of Object.keys(atlas || {})) {
      const a = atlas[id];
      const hasClones = Array.isArray(a.clones) && a.clones.length > 0;
      const populated = Array.isArray(a.preconditions) && a.preconditions.length > 0;
      if (hasClones && !populated) {
        gaps.push({
          kind: "coverage",
          at: id,
          missing: "an atlas pattern with clones but no typed preconditions: illustrative, not load-bearing",
          discharge: "populate its preconditions and its selection-aware and heterogeneity-aware variants",
          ledger_ref: "A1",
        });
      }
    }
    for (const n of Object.values(nodeMap)) {
      if (n.kind === "claim" && n.rebuttal_search && n.rebuttal_search.done === false) {
        gaps.push({
          kind: "coverage",
          at: n.id,
          missing: "no rebuttal search recorded for this claim",
          discharge: "search for explicit rebuttals and alternative positions, and record the result",
          sorry_ref: markerRef(n),
        });
      }
      if (n.kind === "question" && typeof n.branches_expected === "number") {
        const drawn = (n.children || []).length;
        if (n.branches_expected > drawn) {
          gaps.push({
            kind: "coverage",
            at: n.id,
            missing: "a question-set with " + n.branches_expected + " expected branches but " + drawn + " drawn",
            discharge: "draw the missing branch(es), or show the set complete",
            sorry_ref: markerRef(n),
          });
        }
      }
      // populate-on-demand: a model node references a body property that the body declares as a
      // stub or does not have. The demand is the gap; the discharge is the measurement. If the body
      // itself does not exist, this says nothing: that ref is a dangling gap (referencesOf -> body
      // existence). "Add only what a model needs, populate more on demand."
      if (Array.isArray(n.body_refs)) {
        for (const ref of n.body_refs) {
          if (typeof ref !== "string") continue;
          const hash = ref.indexOf("#");
          const bid = hash >= 0 ? ref.slice(0, hash) : ref;
          const pname = hash >= 0 ? ref.slice(hash + 1) : "";
          const body = bodies && bodies[bid];
          if (!body) continue; // absent body: the dangling rule owns it
          const prop = (body.properties || {})[pname];
          if (isPopulated(prop)) continue; // a populated property is a grounded terminal: no gap
          // the populate-on-demand gap carries neither sorry_ref nor ledger_ref: the demand is the
          // gap and the discharge is the measurement. A stub that names a ledger-resident marker may
          // carry an explicit ledger_ref; the accretion stub names the existing branch-3 marker in
          // prose and mints none, so none is attached.
          const g = {
            kind: "coverage",
            at: n.id,
            missing: "references body property '" + ref + "', which is not populated to the floor",
            discharge: "measure and cite this property",
          };
          if (prop && prop.ledger_ref) g.ledger_ref = prop.ledger_ref;
          gaps.push(g);
        }
      }
    }
    return gaps;
  }

  // DANGLING: an edge to a node that does not exist (or was never investigated). Reuses
  // referencesOf for every reference-bearing field over the schema nodes and instances. The
  // atlas index is not scanned: a clone pointing at a case node a given client did not bundle is
  // a packaging choice, not a graph hole. Empty on a lint-clean corpus (rule 2 guarantees
  // resolution); fires the moment a node's edge points at an absent id.
  function danglingGaps(nodeMap, instances, atlas, known) {
    const gaps = [];
    const carriers = Object.values(nodeMap).concat(instances || []);
    for (const n of carriers) {
      if (!E.referencesOf) break;
      for (const ref of E.referencesOf(n)) {
        if (!known.has(ref)) {
          gaps.push({
            kind: "dangling",
            at: n.id,
            missing: "an edge to '" + ref + "', which does not resolve",
            discharge: "author the referenced node, or remove the edge",
          });
        }
      }
    }
    return gaps;
  }

  // a property is populated (a real measurement leaf) iff it carries a citation and is not a stub.
  function isPopulated(p) {
    return !!(p && !p.sorry && p.citation != null);
  }
  // flatten ONLY the populated properties of a body corpus into measurement leaf nodes, keyed by
  // `body.<body_id>.<property>`, kind primitive, terminal_type measurement. A stub is a placeholder,
  // not a terminal, so it does not become a node and cannot accidentally ground anything.
  function flattenBodies(bodies) {
    const leaves = Object.create(null);
    for (const bid of Object.keys(bodies || {})) {
      const b = bodies[bid];
      const props = (b && b.properties) || {};
      for (const pname of Object.keys(props)) {
        const p = props[pname];
        if (!isPopulated(p)) continue; // skip stubs / unpopulated declarations
        const lid = "body." + bid + "." + pname;
        leaves[lid] = {
          id: lid,
          kind: "primitive",
          presentation: { type: "primitive" },
          label: (b.name || bid) + " " + pname.replace(/_/g, " "),
          role: "measured property of " + (b.name || bid) + " (the empirical floor)",
          terminal_type: "measurement",
          value: p.value,
          unit: p.unit,
          citation: p.citation,
          children: [],
        };
        if (p.regime != null) leaves[lid].regime = p.regime;
      }
    }
    return leaves;
  }

  // assemble the schema nodes (primitives + case nodes + flattened body leaves), the instances, the
  // atlas, and the body corpus from the engine's sources, exactly as the linter does, so the
  // detector sees the same graph.
  function collect(sources) {
    sources = sources || {};
    const nodeMap = Object.create(null);
    const prims = sources.primitives || {};
    for (const id of Object.keys(prims)) nodeMap[id] = prims[id];
    const instances = [];
    for (const c of sources.cases || []) {
      for (const id of Object.keys(c.nodes || {})) nodeMap[id] = c.nodes[id];
      for (const inst of c.instances || []) instances.push(inst);
    }
    const bodies = sources.bodies || {};
    const bodyLeaves = flattenBodies(bodies);
    for (const id of Object.keys(bodyLeaves)) nodeMap[id] = bodyLeaves[id];
    return { nodeMap, instances, atlas: sources.atlas || {}, bodies };
  }

  // the ids the graph can resolve: every schema node (incl. flattened body leaves), every instance,
  // every atlas entry, and every body's existence id `body.<body_id>` (so a body_ref to an existing
  // body never dangles; only a ref to an absent body does).
  function knownIds(nodeMap, instances, atlas, bodies) {
    const known = new Set(Object.keys(nodeMap));
    for (const i of instances) known.add(i.id);
    for (const id of Object.keys(atlas || {})) known.add(id);
    for (const bid of Object.keys(bodies || {})) known.add("body." + bid);
    return known;
  }

  // the children-descendants of a node (plus the node itself), for a subtree-scoped query.
  function subtreeIds(nodeMap, rootId) {
    const out = new Set();
    const stack = [rootId];
    while (stack.length) {
      const id = stack.pop();
      if (out.has(id)) continue;
      out.add(id);
      const n = nodeMap[id];
      for (const c of (n && n.children) || []) stack.push(c);
    }
    return out;
  }

  // detectGaps(sources) -> every gap, objective and unranked, in a stable kind order.
  function detectGaps(sources) {
    const { nodeMap, instances, atlas, bodies } = collect(sources);
    const known = knownIds(nodeMap, instances, atlas, bodies);
    return [].concat(
      groundingGaps(nodeMap, instances),
      freshnessGaps(nodeMap, instances),
      coverageGaps(nodeMap, atlas, bodies),
      danglingGaps(nodeMap, instances, atlas, known)
    );
  }

  // the navigable node a gap surfaces at. A gap on an instance surfaces at the step it breaks
  // (its broken_node); a gap on an atlas pattern surfaces at the nodes that point into it
  // (their atlas_ref); otherwise it surfaces at its own node. This lets a subtree query reach a
  // gap that the graph records off to the side of the decomposition.
  function anchorsFor(gap, nodeMap, instances, atlas) {
    const inst = (instances || []).find((i) => i.id === gap.at);
    if (inst) return [inst.broken_node, inst.instantiates, inst.id].filter(Boolean);
    if (atlas && atlas[gap.at]) {
      const refs = Object.values(nodeMap)
        .filter((n) => n.atlas_ref === gap.at)
        .map((n) => n.id);
      return refs.length ? refs : [gap.at];
    }
    return [gap.at];
  }

  // detectGapsAt(sources, id) -> the gaps at a node or anywhere in its decomposition subtree,
  // including instance and atlas gaps anchored into that subtree.
  function detectGapsAt(sources, id) {
    const { nodeMap, instances, atlas } = collect(sources);
    const sub = subtreeIds(nodeMap, id);
    return detectGaps(sources).filter((g) =>
      anchorsFor(g, nodeMap, instances, atlas).some((a) => sub.has(a))
    );
  }

  const out = {
    detectGaps,
    detectGapsAt,
    groundingGaps,
    freshnessGaps,
    coverageGaps,
    danglingGaps,
    collect,
    knownIds,
    subtreeIds,
    flattenBodies,
    isPopulated,
    STALE_STATUSES,
  };
  if (NODE) module.exports = out;
  else root.EpiStackGaps = out;
})(typeof globalThis !== "undefined" ? globalThis : this);
