// Role: vocabulary registers. Each concept's label per register, plus the coinage
//   delta, so a register swap never flattens meaning. Pure data, no behavior.
// Contract: TERMS (id -> {plain,literature,src,delta}); AUTOWRAP (id -> [phrases]).
// Invariant: data only; the DOM walk that applies it lives in view/.
/* ---- vocabulary registers (hot-swappable terms, site-wide) ---- */
/* resolver: every concept carries its label per register plus the coinage delta, so a swap never flattens. */
const TERMS = {
  "the-structure":{plain:"the typed structure",literature:"the hard core and protective belt",src:"Lakatos 1970",delta:"Protected conjecturally rather than by convention; the staged constraint-graph (Forney 1973) supplies a structure the metaphor lacks."},
  "the-gate":{plain:"the gate",literature:"cooperative red-teaming",src:"Irving et al. 2018",delta:"Specifies monotonic contraction under a fixed constraint set and an independence test on converging parties; red-teaming specifies neither."},
  "pre-filter":{plain:"the linter",literature:"a static-analysis gate",src:"software engineering",delta:"Three stages, verify intent then audit then generate a compliant alternative, where a static gate is the audit alone."},
  "kill-record":{plain:"the kill record",literature:"a negative knowledge base",src:"Popper, World 3",delta:"Adds conditional reactivation: an entry re-enters the viable set when the constraint that blocked it is revised. A negative knowledge base is inert."},
  "reassessment":{plain:"reassessment",literature:"reflective equilibrium",src:"Rawls 1971; Kuhn 1962",delta:"Scheduled and evidence-triggered, signalled by kill-record metadata, not retrospective or crisis-driven."},
  "declared-axioms":{plain:"the declared axioms",literature:"an axiom system",src:"formal logic",delta:"Tiered by defensibility, with two falsification modes (empirical and value-consistency) rather than one."},
  "open-obligations":{plain:"the open-obligations record",literature:"proof-obligation tracking",src:"Lean; Coq",delta:"Types each obligation by difficulty, dependency, and gate designation; an issue tracker types none of these."}
};
/* only these are auto-wrapped in existing prose, chosen to avoid polysemy. The rest are available for authored data-term spans (e.g. in the spec). */
const AUTOWRAP = {
  "the-structure":["typed substrate","typed structure"],
  "the-gate":["the gate"],
  "pre-filter":["the linter","a linter"]
};

if (typeof module !== "undefined" && module.exports) module.exports = { TERMS, AUTOWRAP };
