// Role: re-export shim (Phase KG-10). The governance-hash implementation moved to api/governance-
//   hash.js so the in-app kernel designer's finish screen can import the identical function the
//   founding flow's own card emit uses; this file exists only so build/found-community.mjs and
//   build/check-card-hashes.mjs keep working unchanged, both single source of truth.
"use strict";
export { NULL_OBJECTIVE_ORDER_DESCRIPTOR, canonicalParameterRecord, governanceHash } from "../api/governance-hash.js";
