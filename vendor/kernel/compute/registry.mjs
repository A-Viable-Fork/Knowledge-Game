// Role: the default transformation registry (COMPUTE-2). Factors the register assembly into one
//   module: makeRegister() plus the canonical graph and algebra packs, kernel content legal for a
//   kernel module to include directly. Never imports a statistics pack: a statistics pack is corpus
//   content (COMPUTE-1), and kernel imports only kernel (kernel/README.md). assembleRegistry lets a
//   caller that can legally read a corpus (build/check-compute.mjs, or a live provider) add packs
//   without this module ever naming their source, the "provider may override the statistics packs"
//   seam api/client-api.mjs names.
// Contract: assembleRegistry(extraRegistrars?) -> register, extraRegistrars an array of register(
//   registry) functions called after the canonical packs. defaultRegistry() -> assembleRegistry()
//   with none, the canonical-only register. catalog(registry, pack?) -> list(pack) with run omitted.
// Invariant: additive; wraps kernel/compute/transforms.mjs and kernel/compute/canonical-packs.mjs by
//   reference, reimplements neither. Pure, ESM; kernel imports only kernel.
"use strict";
import { makeRegister } from "./transforms.mjs";
import { registerCanonicalPacks } from "./canonical-packs.mjs";

export function assembleRegistry(extraRegistrars) {
  const registry = makeRegister();
  registerCanonicalPacks(registry);
  for (const register of extraRegistrars || []) register(registry);
  return registry;
}

// the canonical-only register: everything a kernel module can legally assemble by itself, with no
// statistics pack. A caller that wants the demo statistics pack (or any other corpus pack) calls
// assembleRegistry([registerStatsPack]) directly, since only that caller may import the corpus.
export function defaultRegistry() {
  return assembleRegistry();
}

// the read-only catalog shape: an entry's id, pack, consumes, emits, reversibility, and assumptions,
// with run omitted. This is what a client contract hands out at list time, so a picker can render
// the manifest before anything runs.
export function catalog(registry, pack) {
  return registry.list(pack).map((entry) => {
    const { run, ...rest } = entry;
    return rest;
  });
}
