// Role: assembles this client's own compute registry (KG-COMPUTE): the vendored canonical-only
//   default registry (vendor/kernel/compute/registry.mjs: graph and algebra, wrapped by reference)
//   plus KG's own forkable statistics pack (./stats-pack.js), registered on top. This is the one place
//   in KG's tree that names both the vendored register and the KG-owned pack; api/community.js
//   injects the result into the provider it hands to createClientApi, which is the seam
//   vendor/api/client-api.mjs's own contract already names ("a provider that wants the demo
//   statistics pack, or any other corpus pack, supplies its own transforms/describeTransform/
//   runTransform").
// Contract: kgRegistry() -> the assembled register (vendor/kernel/compute/transforms.mjs's
//   makeRegister shape: register, get, list, run), built once and memoized. kgCatalog(pack?) -> the
//   read-only catalog (vendor/kernel/compute/registry.mjs's catalog() shape: id, pack, consumes,
//   emits, reversibility, assumptions; run omitted), optionally filtered by pack.
// Invariant: every KG_STATS_PACK entry passes the vendored validateTransform (via registry.register)
//   before it is ever listed or run; forkable content is still shape-checked by the shared root, not
//   by client courtesy. This module never edits the vendored registry or transforms modules.
"use strict";
import { assembleRegistry, catalog as computeCatalog } from "../../vendor/kernel/compute/registry.mjs";
import { KG_STATS_PACK } from "./stats-pack.js";

function registerKgStatsPack(registry) {
  for (const entry of KG_STATS_PACK) registry.register(entry);
}

let registry = null;
export function kgRegistry() {
  if (!registry) registry = assembleRegistry([registerKgStatsPack]);
  return registry;
}

export function kgCatalog(pack) {
  return computeCatalog(kgRegistry(), pack);
}
