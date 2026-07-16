// Role: the membrane's vault-facing surface. periphery/ reaches persistence only through this file,
//   never through vault/ directly, the same reach vendor/ gets through the rest of api/.
// Contract: getObjective, setObjective, observationEnabled, setObservationEnabled, observationLog,
//   recordObservation, exportVault, deleteVault, getFilter, setFilter, getSubmissionScope,
//   setSubmissionScope, followedTopics, setFollowedTopics, onboardingSeen, setOnboardingSeen,
//   getWatches, setWatches, getExtensions, installExtension, uninstallExtension, getActiveRanker,
//   setActiveRanker, getActiveRenderer, setActiveRenderer, getPins, setPin, removePin, getOutbox,
//   setOutbox, getSyncPolicy, setSyncPolicy, getLastSynced, setLastSynced, getSkin, setSkin,
//   getAssistantProviderConfig, setAssistantProviderConfig, getAssistantActiveProvider,
//   setAssistantActiveProvider, addAssistantModel, removeAssistantModel: thin pass-throughs to
//   vault/vault.js.
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
export const getSubmissionScope = vault.getSubmissionScope;
export const setSubmissionScope = vault.setSubmissionScope;
export const followedTopics = vault.followedTopics;
export const setFollowedTopics = vault.setFollowedTopics;
export const onboardingSeen = vault.onboardingSeen;
export const setOnboardingSeen = vault.setOnboardingSeen;
export const getWatches = vault.getWatches;
export const setWatches = vault.setWatches;
export const getExtensions = vault.getExtensions;
export const installExtension = vault.installExtension;
export const uninstallExtension = vault.uninstallExtension;
export const getActiveRanker = vault.getActiveRanker;
export const setActiveRanker = vault.setActiveRanker;
export const getActiveRenderer = vault.getActiveRenderer;
export const setActiveRenderer = vault.setActiveRenderer;
export const getPins = vault.getPins;
export const setPin = vault.setPin;
export const removePin = vault.removePin;
export const getOutbox = vault.getOutbox;
export const setOutbox = vault.setOutbox;
export const getSyncPolicy = vault.getSyncPolicy;
export const setSyncPolicy = vault.setSyncPolicy;
export const getLastSynced = vault.getLastSynced;
export const setLastSynced = vault.setLastSynced;
export const getSkin = vault.getSkin;
export const setSkin = vault.setSkin;
export const getAssistantProviderConfig = vault.getAssistantProviderConfig;
export const setAssistantProviderConfig = vault.setAssistantProviderConfig;
export const getAssistantActiveProvider = vault.getAssistantActiveProvider;
export const setAssistantActiveProvider = vault.setAssistantActiveProvider;
export const addAssistantModel = vault.addAssistantModel;
export const removeAssistantModel = vault.removeAssistantModel;
