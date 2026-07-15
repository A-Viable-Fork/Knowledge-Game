// Role: the membrane's vault-facing surface. periphery/ reaches persistence only through this file,
//   never through vault/ directly, the same reach vendor/ gets through the rest of api/.
// Contract: getObjective, setObjective, observationEnabled, setObservationEnabled, observationLog,
//   recordObservation, exportVault, deleteVault: thin pass-throughs to vault/vault.js.
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
