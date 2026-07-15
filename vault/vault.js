// Role: the vault. The only module in this repository that touches any storage API; every other
//   file reaches persistence, if at all, only through the capability-shaped functions here.
// Contract: getObjective() -> weights object (absence is the zero vector, the null order);
//   setObjective(weights); observationEnabled() -> boolean (absence is off); setObservationEnabled
//   (enabled); observationLog() -> event array (absence is empty); recordObservation(event) (a no-op
//   when observation is off, never buffered for later); exportAll() -> JSON string of everything held;
//   deleteAll() (leaves nothing).
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
