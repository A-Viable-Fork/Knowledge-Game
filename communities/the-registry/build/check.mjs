// Role: this community's own gate re-check, self-contained, run by its Actions workflow on every PR.
"use strict";
const { buildKernel } = await import("./the-registry-build.mjs");
const built = buildKernel();
const ok = built.receipt.decision === "accepted" || built.receipt.decision === "accepted-with-disagreement";
console.log(ok ? `check: OK (${built.state.entries.length} claims, gate decision '${built.receipt.decision}')` : `check: FAILED (gate decision '${built.receipt.decision}')`);
process.exit(ok ? 0 : 1);
