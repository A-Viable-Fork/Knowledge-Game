// Role: the one node schema. Single source of truth (design axiom T0-1). Every node
//   created, validated, or read imports this; no module hand-rolls a parallel shape.
// Contract: exports the kind/terminal/enum vocabularies, REQUIRED_FIELDS per kind, and
//   validateNode(node) -> [problem strings]. Pure data + pure functions, DOM-free.
// Invariant: this is the coordinate system. A change to the data model is a change HERE,
//   never a local divergence. Authoritative source: docs/schema-revisions.md (which wins
//   over docs/architecture-spec.md where they differ), folding in the S1-S6 revisions.
"use strict";

// Node kinds (architecture-spec section 1, plus the S6 closure split into three nodes).
const KINDS = [
  "claim", // a case-level assertion with a terminal type; root of an inference path
  "transformation", // a derivation step: takes inputs, produces outputs; decomposes
  "primitive", // a named standard transformation; the coordinate basis; cites, no children
  "assumption", // a perturbable proposition: hypothesis under test or a precondition
  "observation", // a world-fact that closes a claim; never perturbed (the world is fixed)
  "prediction", // S6: the value the cascade produces
  "comparison", // S6: tests a prediction against an observation; flips on perturbation
  "question", // v2: a concrete-entry framing node; the contested question a learner enters at
];

// v2 teaching layer (docs/teaching-layer.md). The on-ramp register, authored alongside the
// terse fields (which stay as the inspect layer). explain.symbols glosses every symbol.
const EXPLAIN_FIELDS = ["hook", "intuition", "in_words", "symbols", "scenario", "stakes"];

// The closed, graph-owned set of semantic node kinds for presentation. A node declares WHAT
// IT IS with presentation: { type, data }; it never names a layout or a visual. A client maps
// each kind to a look. The set is closed so every thin client renders every node, and no
// client may invent a kind (docs/architecture-storage-api-clients.md, docs/clients.md).
const PRESENTATION_TYPES = [
  "question", // a concrete contested question, the learner's entry
  "selection-step", // a representativeness step; carries a distribution + detection function
  "sufficiency-step", // a sufficiency step; a statistic to a target conclusion
  "transformation", // a generic derivation/composition step
  "primitive", // a cited basis, the floor
  "observation", // a world-fact that closes a claim
  "prediction", // the value the reasoning produces
  "comparison", // a test of a prediction against an observation
  "assumption", // a perturbable proposition
  "claim", // a case-level assertion with a terminal type
];

// Terminal types: the closures a claim can reach (executive/judge overviews + graph ontology).
const TERMINALS = [
  "measurement",
  "irreducible-prior",
  "withheld-record",
  "question-set",
  "constitutive",
  "derivation",
  "simulation-bound",
];

// S2/S3: how a decomposable node's interior composes.
const COMPOSITIONS = ["sequence", "conjunction", "disjunction", "none"];

// S5: not every node breaks; some remove a dependency.
const FUNCTIONS = ["derive", "constrain", "cancel"];

// Place in the inference graph (architecture-spec section 1).
const POSITIONS = ["hypothesis", "precondition", "step", "terminal"];

// Mathematical-layer maturity (migrates toward a Lean 4 signature).
const FORMAL_STATUSES = ["nl", "typed", "lean_verified"];

// Comparison state (S6); render-state is derived, not stored.
const COMPARISON_STATES = ["consistent", "contradicted"];

// Required fields per kind (linter rule 1). A node carrying a `sorry` marker is an
// explicit, ledgered stub and is exempt from completeness (see validateNode).
const REQUIRED_FIELDS = {
  claim: ["id", "kind", "label", "role", "position", "terminal_type"],
  transformation: [
    "id",
    "kind",
    "label",
    "role",
    "takes",
    "produces",
    "composition",
    "function",
    "children",
    "math",
    "formal_status",
    "load_bearing",
  ],
  primitive: ["id", "kind", "label", "role", "citation"],
  assumption: ["id", "kind", "label", "position"],
  observation: ["id", "kind", "label", "world_value"],
  prediction: ["id", "kind", "label", "value", "produced_by"],
  comparison: ["id", "kind", "label", "test", "state"],
  question: ["id", "kind", "label", "explain"],
};

const SORRY_FIELDS = ["sorry", "TODO_verify"];

function hasMarker(node) {
  return SORRY_FIELDS.some((f) => node && node[f]);
}

function isEmpty(v) {
  return v == null || v === "" || (Array.isArray(v) && v.length === 0);
}

// validateNode: returns an array of human-readable problems. Empty array == valid.
// A node with a sorry/TODO_verify marker is a ledgered gap and is checked only for
// identity (id, kind), not for completeness: gaps are first-class (T0-5), not failures.
function validateNode(node) {
  const problems = [];
  if (!node || typeof node !== "object") return ["node is not an object"];
  if (isEmpty(node.id)) problems.push("missing id");
  if (!KINDS.includes(node.kind))
    problems.push(`unknown kind: ${JSON.stringify(node.kind)} (id ${node.id})`);

  if (hasMarker(node)) return problems; // ledgered stub: identity only

  const required = REQUIRED_FIELDS[node.kind] || [];
  for (const f of required) {
    if (isEmpty(node[f])) problems.push(`${node.id}: missing required field '${f}' for kind ${node.kind}`);
  }

  if (node.kind === "transformation") {
    if (node.composition && !COMPOSITIONS.includes(node.composition))
      problems.push(`${node.id}: bad composition '${node.composition}'`);
    if (node.function && !FUNCTIONS.includes(node.function))
      problems.push(`${node.id}: bad function '${node.function}'`);
    // S5: derive/constrain owe breaks + why_breaks; cancel owes load_bearing instead.
    if (node.function === "derive" || node.function === "constrain") {
      if (isEmpty(node.breaks)) problems.push(`${node.id}: ${node.function} node missing 'breaks'`);
      if (isEmpty(node.why_breaks)) problems.push(`${node.id}: ${node.function} node missing 'why_breaks'`);
    }
    if (node.formal_status && !FORMAL_STATUSES.includes(node.formal_status))
      problems.push(`${node.id}: bad formal_status '${node.formal_status}'`);
    // S3: disjunction children carry a guard.
    if (node.composition === "disjunction" && isEmpty(node.guard))
      problems.push(`${node.id}: disjunction missing 'guard'`);
  }

  if (node.kind === "primitive") {
    if (!isEmpty(node.children)) problems.push(`${node.id}: primitive must have no children`);
  }

  if (node.kind === "claim" && node.terminal_type && !TERMINALS.includes(node.terminal_type))
    problems.push(`${node.id}: unknown terminal_type '${node.terminal_type}'`);

  if (node.kind === "comparison" && node.state && !COMPARISON_STATES.includes(node.state))
    problems.push(`${node.id}: bad comparison state '${node.state}'`);

  if (node.position && !POSITIONS.includes(node.position))
    problems.push(`${node.id}: bad position '${node.position}'`);

  // v2: typeset math is an object { tex, plain, assumes }. The terse string form is still
  // valid (the LHC cascade uses it); an object must carry tex and a plain fallback.
  if (node.math && typeof node.math === "object") {
    if (isEmpty(node.math.tex)) problems.push(`${node.id}: math object missing 'tex'`);
    if (isEmpty(node.math.plain)) problems.push(`${node.id}: math object missing 'plain' fallback`);
  }

  // v2: if an explain block is present, it must be complete (the teaching register).
  for (const p of validateExplain(node)) problems.push(p);

  // storage/API/clients boundary: a node declares its semantic kind, never how it looks.
  // It must carry presentation.type from the closed set, and must NOT name a concrete visual
  // or card layout (that decision belongs to a client). docs/architecture-storage-api-clients.md.
  if (!node.presentation || isEmpty(node.presentation.type)) {
    problems.push(`${node.id}: missing presentation.type (the semantic node kind)`);
  } else if (!PRESENTATION_TYPES.includes(node.presentation.type)) {
    problems.push(`${node.id}: unknown presentation.type '${node.presentation.type}'`);
  }
  if (node.visual) problems.push(`${node.id}: a node may not name a 'visual' (a client maps its kind to one)`);
  if (node.card) problems.push(`${node.id}: a node may not name a 'card' layout (a client decides the layout)`);

  return problems;
}

// validateExplain: internal consistency of a present explain block (no empty fields, well
// formed symbols). It does NOT require any field to be present; the linter decides which
// fields a given node kind must carry (an equation node owes all six; a framing question
// owes only hook/intuition/stakes). Keeps validateNode lenient about teaching policy.
function validateExplain(node) {
  const problems = [];
  const e = node && node.explain;
  if (!e) return problems;
  for (const f of Object.keys(e)) {
    if (f === "symbols") continue;
    if (isEmpty(e[f])) problems.push(`${node.id}: explain.${f} is present but empty`);
  }
  if (e.symbols !== undefined) {
    if (!Array.isArray(e.symbols)) problems.push(`${node.id}: explain.symbols must be an array`);
    else e.symbols.forEach((s, i) => {
      if (isEmpty(s.sym) || isEmpty(s.plain)) problems.push(`${node.id}: explain.symbols[${i}] needs sym + plain`);
    });
  }
  return problems;
}

const SCHEMA = {
  KINDS,
  TERMINALS,
  COMPOSITIONS,
  FUNCTIONS,
  POSITIONS,
  FORMAL_STATUSES,
  COMPARISON_STATES,
  REQUIRED_FIELDS,
  SORRY_FIELDS,
  EXPLAIN_FIELDS,
  PRESENTATION_TYPES,
  hasMarker,
  validateNode,
  validateExplain,
};

if (typeof module !== "undefined" && module.exports) module.exports = SCHEMA;
