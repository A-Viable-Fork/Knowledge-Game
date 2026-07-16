// Role: download pins (Phase KG-6b). Locks a community's verified snapshot into Cache Storage so it
//   reads offline, and records the pin (which community, at what snapshot hash, when) in the vault so
//   the switcher can show its age. Pinning fetches nothing beyond fetchCommunity's own already-
//   declared destination: it caches the same verified response, never a second network destination.
// Contract: pinCommunity(meta) -> the same {api, kernelId, snapshotHash, url, raw, response}
//   fetchCommunity returns, after caching meta.path's response and recording the pin. unpinCommunity
//   (communityId, path) evicts the cache entry and the vault record. isPinned(communityId) ->
//   boolean. pinAge(communityId) -> milliseconds since pinned, or null if not pinned. listPins() ->
//   vault pin records, newest first.
// Invariant: caching happens only after fetchCommunity's own hash verification has already succeeded
//   (fetchCommunity throws before this module ever sees the response), so a pin never locks in
//   unverified content. CACHE_NAME's literal value must stay equal to sw.js's own PINS_CACHE_NAME
//   constant, cross-checked textually by build/check-offline-shell.mjs, so the service worker's
//   activate cleanup can never silently start deleting pinned communities as an unrecognized cache.
// Governs: claim-7: pinCommunity's one cache write follows fetchCommunity's own declared-destination
//   fetch; it opens no new network destination of its own for build/check-egress.mjs to miss.
"use strict";
import { fetchCommunity } from "./community.js";
import * as settings from "./settings.js";

const CACHE_NAME = "kg-pins-v1";

export async function pinCommunity(meta) {
  const community = await fetchCommunity(meta.path);
  if (typeof caches !== "undefined" && community.response) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(meta.path, community.response);
  }
  settings.setPin({ communityId: meta.id, snapshotHash: community.snapshotHash, pinnedAt: Date.now() });
  return community;
}

export async function unpinCommunity(communityId, path) {
  if (typeof caches !== "undefined" && path) {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(path);
  }
  settings.removePin(communityId);
}

export function isPinned(communityId) {
  return settings.getPins().some((p) => p.communityId === communityId);
}

export function pinAge(communityId) {
  const entry = settings.getPins().find((p) => p.communityId === communityId);
  return entry ? Date.now() - entry.pinnedAt : null;
}

export function listPins() {
  return settings.getPins().slice().sort((a, b) => b.pinnedAt - a.pinnedAt);
}
