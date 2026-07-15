// Role: the vault. The only module in this repository that touches any storage API; every other
//   file reaches persistence, if at all, only through the capability-shaped functions here.
// Contract: getObjective() -> weights object (absence is the zero vector, the null order);
//   setObjective(weights); observationEnabled() -> boolean (absence is off); setObservationEnabled
//   (enabled); observationLog() -> event array (absence is empty); recordObservation(event) (a no-op
//   when observation is off, never buffered for later); exportAll() -> JSON string of everything held;
//   deleteAll() (leaves nothing). Phase KG-4 additions, same off/empty-by-absence discipline:
//   getFilter(communityId)/setFilter (excluded-kind list per community); followedTopics()/
//   setFollowedTopics (onboarding's learn-efficiently seed); onboardingSeen()/setOnboardingSeen;
//   getWatches(communityId)/setWatches (standing-motion alert subscriptions, each a snapshot of the
//   watched identity's last-seen grade so a later diff can tell motion from a fresh read);
//   getExtensions()/installExtension(entry)/uninstallExtension(hash) (the extension registry: hash,
//   shape, label, and the conformance receipt recorded at install time); getActiveRanker()/
//   setActiveRanker(hash) and getActiveRenderer()/setActiveRenderer(hash) (which installed extension,
//   if any, the feed currently runs; uninstalling an active extension clears it).
// Invariant: a fresh profile constructs its off state rather than reading a configured default: no
//   call ever writes a store on read, so a profile that has never called setObjective or
//   setObservationEnabled has no key in storage at all, and every reader treats absence as off/empty
//   directly, never as a stored "false" it had to look up. Off means off: recordObservation refuses to
//   write anything while disabled, not sampled, not buffered, not anonymized, simply not collected.
//   Vault contents are never read by any fetch call in this repository (build/check-egress.mjs already
//   fails on any undeclared destination, and no declared destination accepts a request body); this
//   module itself makes no network call. build/check-vault.mjs statically scans every other file for
//   a storage-API reference and fails naming any file that touches one outside this module.
"use strict";

const STORAGE_KEY = "knowledge-game-vault-v1";

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}
function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getObjective() {
  return readStore().objective || {};
}
export function setObjective(weights) {
  const store = readStore();
  store.objective = weights || {};
  writeStore(store);
}

export function observationEnabled() {
  const store = readStore();
  return !!(store.observation && store.observation.enabled);
}
export function setObservationEnabled(enabled) {
  const store = readStore();
  const existingLog = (store.observation && store.observation.log) || [];
  store.observation = { enabled: !!enabled, log: existingLog };
  writeStore(store);
}
export function observationLog() {
  const store = readStore();
  return (store.observation && store.observation.log) || [];
}
export function recordObservation(event) {
  const store = readStore();
  if (!store.observation || !store.observation.enabled) return; // off means off: refuse to record
  store.observation.log = store.observation.log || [];
  store.observation.log.push(event);
  writeStore(store);
}

export function getFilter(communityId) {
  const store = readStore();
  return (store.filters && store.filters[communityId]) || [];
}
export function setFilter(communityId, excludedKinds) {
  const store = readStore();
  store.filters = store.filters || {};
  store.filters[communityId] = (excludedKinds || []).slice();
  writeStore(store);
}

export function followedTopics() {
  return readStore().followedTopics || [];
}
export function setFollowedTopics(topics) {
  const store = readStore();
  store.followedTopics = (topics || []).slice();
  writeStore(store);
}

export function onboardingSeen() {
  return !!readStore().onboardingSeen;
}
export function setOnboardingSeen(seen) {
  const store = readStore();
  store.onboardingSeen = !!seen;
  writeStore(store);
}

export function getWatches(communityId) {
  const store = readStore();
  return (store.watches && store.watches[communityId]) || [];
}
export function setWatches(communityId, watches) {
  const store = readStore();
  store.watches = store.watches || {};
  store.watches[communityId] = (watches || []).slice();
  writeStore(store);
}

export function getExtensions() {
  return readStore().extensions || [];
}
export function installExtension(entry) {
  const store = readStore();
  store.extensions = store.extensions || [];
  if (!store.extensions.some((e) => e.hash === entry.hash)) store.extensions.push(entry);
  writeStore(store);
}
export function uninstallExtension(hash) {
  const store = readStore();
  store.extensions = (store.extensions || []).filter((e) => e.hash !== hash);
  if (store.activeRanker === hash) delete store.activeRanker;
  if (store.activeRenderer === hash) delete store.activeRenderer;
  writeStore(store);
}

export function getActiveRanker() {
  return readStore().activeRanker || null;
}
export function setActiveRanker(hash) {
  const store = readStore();
  if (hash) store.activeRanker = hash;
  else delete store.activeRanker;
  writeStore(store);
}
export function getActiveRenderer() {
  return readStore().activeRenderer || null;
}
export function setActiveRenderer(hash) {
  const store = readStore();
  if (hash) store.activeRenderer = hash;
  else delete store.activeRenderer;
  writeStore(store);
}

export function exportAll() {
  return JSON.stringify(readStore(), null, 2);
}
export function deleteAll() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    void e;
  }
}
