// Role: sync policy (Phase KG-6b). Online is a pair of transport verbs (fetch a fresh snapshot, push
//   the outbox), never an ambient assumption; this module decides only WHETHER a sync may run for a
//   given policy and trigger, so the network call itself always lives one level up, in periphery,
//   gated behind this decision. Offline is this app's honestly-stated default state.
// Contract: shouldSync(policy, trigger, isWifi) -> boolean. policy is one of "manual", "wifi-only",
//   "automatic" (api/settings.js's getSyncPolicy(), absence is "manual"). trigger is "load", "online",
//   or "sync-now". isWifi is the caller's own best reading of the current connection (undefined is
//   treated as "not confirmed wifi", the conservative reading).
// Invariant: "sync-now" always returns true regardless of policy, the one action a manual reader keeps
//   as an explicit escape hatch. "manual" never returns true for any other trigger. "automatic" returns
//   true for "load" and "online". "wifi-only" returns true for "load"/"online" only when isWifi is
//   exactly true, never on an unconfirmed reading. build/check-sync-policy.mjs stubs the network
//   entirely and asserts zero transport happens outside what this function itself would authorize.
"use strict";
export function shouldSync(policy, trigger, isWifi) {
  if (trigger === "sync-now") return true;
  if (policy === "manual") return false;
  if (policy === "wifi-only") return isWifi === true;
  if (policy === "automatic") return trigger === "load" || trigger === "online";
  return false;
}
