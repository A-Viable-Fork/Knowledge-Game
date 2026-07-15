// Role: the membrane's vault-facing surface. periphery/ reaches persistence only through this file,
//   never through vault/ directly, the same reach vendor/ gets through the rest of api/.
// Contract: getObjective, setObjective, observationEnabled, setObservationEnabled, observationLog,
//   recordObservation, exportVault, deleteVault, getFilter, setFilter, followedTopics,
//   setFollowedTopics, onboardingSeen, setOnboardingSeen, getWatches, setWatches, getExtensions,
//   installExtension, uninstallExtension: thin pass-throughs to vault/vault.js.
// Invariant: this module holds no logic and no rule of its own; it is a naming surface. The vault's
//   own invariants (off means off, absence is off/empty, no other file touches storage) live in
//   vault/vault.js and are unchanged by being reached through here.
"use strict";
import * as vault from "../vault/vault.js";

export const getObjective = vault.getObjective;
export const setObjective = vault.setObjective;
export const observationEnabled = vault.observationEnabled;
export const setObservationEnabled = vault.setObservationEnabled;
export const observationLog = vault.observationLog;
export const recordObservation = vault.recordObservation;
export const exportVault = vault.exportAll;
export const deleteVault = vault.deleteAll;
export const getFilter = vault.getFilter;
export const setFilter = vault.setFilter;
export const followedTopics = vault.followedTopics;
export const setFollowedTopics = vault.setFollowedTopics;
export const onboardingSeen = vault.onboardingSeen;
export const setOnboardingSeen = vault.setOnboardingSeen;
export const getWatches = vault.getWatches;
export const setWatches = vault.setWatches;
export const getExtensions = vault.getExtensions;
export const installExtension = vault.installExtension;
export const uninstallExtension = vault.uninstallExtension;
