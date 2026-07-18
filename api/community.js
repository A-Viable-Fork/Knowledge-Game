// Role: the community loader. Fetches a snapshot, verifies its hash against canonical content
//   before anything else touches it, and constructs the vendored on-device provider and client
//   contract over it. This is the one place the periphery's read path crosses the membrane.
// Contract: fetchCommunity(url) -> { api, kernelId, snapshotHash, url, raw, response }. api is the
//   object createClientApi returns (propose, read, robustness, gaps, characterizedGaps,
//   reconciliations, glossary, transforms, describeTransform, runTransform, providerKind); transforms/
//   describeTransform/runTransform are served from KG's own registry (api/compute/registry.js), not
//   the vendored kernel default. response is a clone of the raw fetch Response taken before its
//   body is consumed (Phase KG-6b: api/pins.js caches this clone; null wherever Response.clone is
//   unavailable, e.g. this repository's own check scripts' fetch stubs, which carry no other reader
//   and so need no clone). Browser-safe ESM; imports only vendor/ and api/ (its own compute registry).
// Invariant: a snapshot whose recomputed hash does not match its declared snapshot_hash is refused,
//   never rendered with a warning. No grounding is computed here; every grade the periphery ever
//   shows comes from the real gate, through the vendored local provider, over this verified content.
// Governs: claim-6: fetchCommunity's one fetch() call is the whole of this deployment's network
//   surface for reading a community; manifests/network.json declares no telemetry destination, and
//   none exists here to declare.
// Governs: claim-7: build/check-egress.mjs runs this exact function under a stubbed fetch and fails on
//   any URL outside manifests/network.json's declared destinations.
// Governs: claim-8: this is the one place the periphery's read path crosses into vendor/; every other
//   periphery module reaches the kernel only through the object this function returns.
// Governs: claim-15: createClientApi is called over whatever provider this function constructs
//   (createLocalProvider today); build/check-provider-contract.mjs proves the periphery's own logic
//   depends only on this contract, not on which provider answers it.
// Governs: KG-COMPUTE: the provider constructed here overrides transforms/describeTransform/
//   runTransform with KG's own registry (api/compute/registry.js: the vendored canonical-only default
//   plus KG's own forkable statistics pack), through the exact override seam
//   vendor/api/client-api.mjs's own contract names; the vendored kernel default registry is untouched.
"use strict";
import { hashOf } from "../vendor/kernel/schema/canonical.mjs";
import { createLocalProvider } from "../vendor/api/providers/local-provider.mjs";
import { createClientApi } from "../vendor/api/client-api.mjs";
import { kgRegistry, kgCatalog } from "./compute/registry.js";

export async function fetchCommunity(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchCommunity: ${url} responded ${res.status}`);
  const response = typeof res.clone === "function" ? res.clone() : null;
  const parsed = await res.json();
  if (!parsed || typeof parsed.snapshot_hash !== "string") {
    throw new Error(`fetchCommunity: ${url} carries no snapshot_hash; refusing to load`);
  }
  // the verification vendor/build/emit-snapshot.mjs's own verifySnapshot performs, called here
  // directly against the pure hashOf rather than that module (which also imports node:fs for its
  // CLI form and would not load in a browser); the hash formula is the one named hash, unchanged.
  const recomputed = hashOf({ state: parsed.state, sources: parsed.sources, kinds: parsed.kinds });
  if (recomputed !== parsed.snapshot_hash) {
    throw new Error(
      `fetchCommunity: ${url} hash mismatch (declared ${parsed.snapshot_hash}, recomputed ${recomputed}); refusing to load`
    );
  }
  const baseProvider = createLocalProvider(parsed);
  // the compute-surface override (KG-COMPUTE): transforms()/describeTransform() hand out KG's
  // catalog (canonical graph/algebra plus KG's own statistics pack), and runTransform() executes
  // through the same assembled registry; every other provider method is the vendored local provider,
  // untouched.
  const provider = {
    ...baseProvider,
    transforms: (pack) => kgCatalog(pack),
    describeTransform: (id) => {
      const entry = kgRegistry().get(id);
      if (!entry) return null;
      const { run, ...rest } = entry;
      return rest;
    },
    runTransform: (id, input) => kgRegistry().run(id, input),
  };
  const api = createClientApi(provider);
  return { api, kernelId: parsed.kernel_id, snapshotHash: parsed.snapshot_hash, url, raw: parsed, response };
}
