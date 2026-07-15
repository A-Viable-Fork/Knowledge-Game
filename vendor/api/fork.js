// Role: the provenance and fork interface. forkKernel forks a kernel; forkType forks a type bundle,
//   the crossing's fork brought down to type granularity, a new type-hash whose receipt names its
//   parent and its departure. The DURABLE fork over the patch ledger ([4.6]) stays Stage 4, specified.
// Contract: forkKernel(parent, opts?) -> { new_kernel_id, forked_from, ... }; forkType(parentBundle,
//   overrides, opts?) -> { operation, parent_hash, new_hash, departure, bundle, persisted, note }.
//   Pure; api imports kernel and api, never the periphery. STUB remains for the durable patch fork.
// Invariant: both forks assert nothing durable (persisted false until the patch ledger is built).
//   forkType is snapshot only, because a type-hash that changed under its adopters would break
//   shared-meaning-is-shared-hash; overrides overlay a copy and the parent bundle is never touched.
"use strict";
import { canonicalizeBundle, hashTypeBundle } from "../kernel/schema/type-hash.mjs";
import { canonicalize, encode } from "../kernel/schema/canonical.mjs";

export function forkKernel(parent, opts) {
  if (!parent || !parent.id) throw new Error("forkKernel: parent must have an id");
  const o = opts || {};
  const at_point = o.atPoint || "head";
  // the child inherits the parent's pinned type-hashes; from here it can adopt more or retype locally.
  const inherited_pins = Object.assign({}, parent.pins || {});
  return {
    operation: "fork",
    new_kernel_id: parent.id + "#fork",
    forked_from: parent.id,
    at_point,
    inherited_pins,
    persisted: false,
    note: "the child inherits the parent's pins and can adopt or retype from here; durable persistence over the patch ledger is Stage 4, specified not built",
  };
}

// acceptsOverrides: the parent-independent part of forkType's acceptance, a non-empty override set
// whose every value canonicalizes. Whether the set also DIFFERS from a given parent is decided
// against that parent at fork time; this predicate is what a contest can check knowing only the
// type-hash, so a contest's departure is "convertible" exactly when forkType would accept its shape.
export function acceptsOverrides(overrides) {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return false;
  const keys = Object.keys(overrides);
  if (keys.length === 0) return false;
  // canonicalize each value wrapped in an object, so a legitimate null bundle field (an absent
  // optional) is handled by the object branch rather than throwing, while a non-canonical value
  // (a JS number, a nested number) still throws and marks the set unacceptable.
  try { for (const k of keys) encode(canonicalize({ v: overrides[k] })); }
  catch (e) { void e; return false; }
  return true;
}

// forkType: a fork at the granularity the crossing runs on, the type bundle itself. This is
// forkKernel's move brought down one level, and it is components-and-forking's one rule (a fork is a
// diff against a parent, its departures as coordinates) applied to a type. Nothing new is invented:
// the crossing already governs the consequences, since a claim typed under the child hash composes
// same-hash with a kernel that pins it and arrives untyped everywhere else, re-earning by local fork.
// CONTRACT: forkType(parentBundle, overrides, opts?) -> a fork receipt naming the parent, the child
// type-hash, and the exact departure. Pure; the parent bundle is never mutated.
export function forkType(parentBundle, overrides, opts) {
  void opts;
  // validate the parent round-trips: a bundle that does not canonicalize/hash is not a type to fork.
  let parent_hash;
  try {
    canonicalizeBundle(parentBundle);
    parent_hash = hashTypeBundle(parentBundle);
  } catch (e) {
    throw new Error("forkType: parent bundle does not round-trip through canonicalizeBundle: " + e.message);
  }
  const ov = overrides || {};
  const keys = Object.keys(ov);
  if (!acceptsOverrides(ov))
    throw new Error("forkType: an empty override set is a no-op; a fork with no departure is the parent, which is an error because the caller's intent was divergence");
  // snapshot merge: overlay the overrides field-by-field onto a COPY of the parent. Snapshot only,
  // no live-fork resolver at the type level: a type-hash that changed under its adopters would break
  // shared-meaning-is-shared-hash, so a type fork always freezes its child bundle.
  const bundle = Object.assign({}, parentBundle);
  const departure = [];
  const enc = (v) => encode(canonicalize({ v })); // compare through the canonical form; wrap so null (an absent optional) does not throw
  for (const k of keys) {
    const from = parentBundle[k];
    const to = ov[k];
    bundle[k] = to;
    if (enc(from) !== enc(to)) departure.push({ field: k, from: from === undefined ? null : from, to });
  }
  if (departure.length === 0)
    throw new Error("forkType: the overrides equal the parent (no field differs); a fork with no departure is the parent, which is an error, not a no-op");
  const new_hash = hashTypeBundle(bundle);
  return {
    operation: "fork-type",
    parent_hash,
    new_hash,
    departure,
    bundle,
    persisted: false,
    note: "the child type is a snapshot deriving from the parent by the named departure, adopted or ignored kernel by kernel through the crossing; durable persistence over the patch ledger is Stage 4, specified not built",
  };
}
