// Role: the propose/read contract (Prompt 10). The API is a contract, not a location: it names a
//   provider and delegates. A client calls propose and read and never learns which provider answers,
//   so a local provider (runs the gate in-process over a snapshot) and a remote provider (calls a
//   hosted kernel) are interchangeable behind this one seam. Swapping providers changes one import;
//   the client is untouched.
// Contract: createClientApi(provider) -> { propose(proposedClaim) -> receipt, read(query) -> [claim],
//   glossary() -> { GRADES, KINDS, LINKS, CONCEPTS }, transforms(pack?) -> [entry, no run],
//   describeTransform(id) -> entry-or-null, runTransform(id, input) -> result, providerKind() ->
//   string }. provider must implement propose and read. ESM; the contract touches no kernel and no
//   provider directly, so it is provider-agnostic by construction.
// Invariant: this layer holds no grounding logic. It validates the shape of a call and forwards it;
//   every grade, price, and refusal is produced by the provider's gate, never here. glossary() and
//   the compute surface are the exceptions that touch no truth field at all. transforms() and
//   describeTransform() hand out the catalog (manifest and reversibility, never run) at list time, so
//   a picker shows the assumptions before anything runs (COMPUTE-2); runTransform() computes a
//   derived value or a kernel view over supplied input, it does not land one, and the register's own
//   no-grade guard (kernel/compute/transforms.mjs) still applies to a statistics entry's output.
//   Landing a runTransform result as a claim is a separate propose() call the client makes on its
//   own, never something this surface does. All three fall back to the kernel-only default registry
//   (kernel/compute/registry.mjs, canonical packs only) when the provider does not override; a
//   provider that wants the demo statistics pack (or any other corpus pack) included supplies its own
//   transforms/describeTransform/runTransform, exactly as glossary() falls back to the kernel export.
"use strict";
import { glossary as kernelGlossary } from "../kernel/schema/glossary.mjs";
import { defaultRegistry, catalog as computeCatalog } from "../kernel/compute/registry.mjs";

const kernelRegistry = defaultRegistry();

export function createClientApi(provider) {
  if (!provider || typeof provider.propose !== "function" || typeof provider.read !== "function")
    throw new Error("createClientApi: provider must implement propose(proposedClaim) and read(query)");
  return {
    // propose a typed claim; returns the full receipt (data model Section 11) the provider produced.
    propose: (proposedClaim) => provider.propose(proposedClaim),
    // read claims with their grounding; query filters, {} or no argument returns all.
    read: (query) => provider.read(query || {}),
    // read claims with their robustness and fragility, obtained the same way grounding is (Prompt 13).
    robustness: (query) => (provider.robustness ? provider.robustness(query || {}) : []),
    // read the open gaps in the graph (a claim whose declared grade is not covered by its earned grade).
    gaps: (query) => (provider.gaps ? provider.gaps(query || {}) : []),
    // read the characterized gaps: honest leaps, each with the closing condition that would ground it.
    characterizedGaps: (query) => (provider.characterizedGaps ? provider.characterizedGaps(query || {}) : []),
    // read the reconciliations: each contradicts-linked disagreement with its computed crux, obtained
    // the same way grounding and robustness are (Prompt 22). The crux is a candidate, not a verdict.
    reconciliations: (query) => (provider.reconciliations ? provider.reconciliations(query || {}) : []),
    // the self-describing vocabulary: what every grade, claim kind, and link kind means, plus the
    // declared-vs-earned concept. One source of truth; a client renders this, it never authors it.
    glossary: () => (provider.glossary ? provider.glossary() : kernelGlossary()),
    // the transformation catalog: every entry's manifest and reversibility, run omitted, so a picker
    // reads the assumptions before anything runs. Optionally filtered by pack.
    transforms: (pack) => (provider.transforms ? provider.transforms(pack) : computeCatalog(kernelRegistry, pack)),
    // one entry's read-only shape (run omitted), or null on an unknown id: a clear miss, not a throw.
    describeTransform: (id) => {
      if (provider.describeTransform) return provider.describeTransform(id);
      const entry = kernelRegistry.get(id);
      if (!entry) return null;
      const { run, ...rest } = entry;
      return rest;
    },
    // execute a transformation over supplied input; this computes a derived value or a kernel view,
    // it does not land one. Landing the result as a claim is a separate propose() call the client
    // makes on its own. The register's own no-grade guard still applies to a statistics entry.
    runTransform: (id, input) => (provider.runTransform ? provider.runTransform(id, input) : kernelRegistry.run(id, input)),
    // which world are we in: "local" or "remote". Diagnostic only; the client renders identically.
    providerKind: () => provider.kind || "unknown",
  };
}
