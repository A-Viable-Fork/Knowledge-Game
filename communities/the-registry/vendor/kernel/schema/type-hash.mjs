// Role: content-address a shared type. A type bundle is a type plus the grounding apparatus that gives
//   it meaning (a kind with its ceiling and rules, a floor with its rank, a source class with its
//   footings); its hash is the type's identity, so two kernels that mean the same thing by a type pin
//   the same hash and a kernel that means something subtly different pins a different one. This is the
//   one primitive the three-tier crossing rests on: shared meaning is shared hash.
// Contract: canonicalizeBundle(bundle) -> canonical node; hashTypeBundle(bundle) -> hex sha256 over it.
//   Pure, ESM; kernel imports only kernel.
// Invariant: DETERMINISM. Identical bundles hash identically (stable key order, no whitespace variance),
//   and any change to a meaning-bearing field changes the hash. Reuses the v3 canonical form and the
//   one named hash, so a type-hash is byte-identical headless and in a file:// page.
// DEPARTURE: the prompt suggested node:crypto; the kernel is node-builtin-free by Tier 0 (it must load
//   in a file:// page), so this reuses the vendored sha256 through canonical.mjs, the hash the gate
//   already uses. Same digest, no new dependency; numeric bundle fields ride the canonical exact-decimal
//   discipline (passed as strings), so a floor's rank never touches the float path.
"use strict";
import { canonicalize, hashOf } from "./canonical.mjs";

// the canonical node for a type bundle: fields sorted by byte order, absent optionals omitted, no
// whitespace variance. This is what the hash is taken over, exposed so a caller can inspect the bytes.
export function canonicalizeBundle(bundle) {
  return canonicalize(bundle);
}

// the type-hash: the one named hash over the canonical bundle. Two identical bundles hash identically;
// any change to a meaning-bearing field changes the hash.
export function hashTypeBundle(bundle) {
  return hashOf(bundle);
}
