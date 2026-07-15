// Role: the community loader. Fetches a snapshot, verifies its hash against canonical content
//   before anything else touches it, and constructs the vendored on-device provider and client
//   contract over it. This is the one place the periphery's read path crosses the membrane.
// Contract: fetchCommunity(url) -> { api, kernelId, snapshotHash, url }. api is the object
//   createClientApi returns (propose, read, robustness, gaps, characterizedGaps, reconciliations,
//   providerKind). Browser-safe ESM; imports only vendor/ and itself.
// Invariant: a snapshot whose recomputed hash does not match its declared snapshot_hash is refused,
//   never rendered with a warning. No grounding is computed here; every grade the periphery ever
//   shows comes from the real gate, through the vendored local provider, over this verified content.
"use strict";
import { hashOf } from "../vendor/kernel/schema/canonical.mjs";
import { createLocalProvider } from "../vendor/api/providers/local-provider.mjs";
import { createClientApi } from "../vendor/api/client-api.mjs";

export async function fetchCommunity(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchCommunity: ${url} responded ${res.status}`);
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
  const provider = createLocalProvider(parsed);
  const api = createClientApi(provider);
  return { api, kernelId: parsed.kernel_id, snapshotHash: parsed.snapshot_hash, url, raw: parsed };
}
