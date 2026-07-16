// Role: regenerates this community's own snapshot from its current corpus (Phase KG-11 Step 4,
//   generalizing the ad hoc regeneration every prior merge into this corpus needed by hand). Rebuilds
//   via epistack-competition-build.mjs's own buildKernel(), refuses to write if the gate does not
//   accept, and writes kernel_id/snapshot_hash/state/sources/kinds/admission_policy to snapshot/<id>.
//   snapshot.json. admission_policy is carried over from founding-config.json's own current value,
//   read fresh each run, so the running app (api/community.js's fetchCommunity) can read a community's
//   current admission policy without a second network destination; it is not part of the hashed
//   content (hashOf({state, sources, kinds}) alone), so a policy change never moves the snapshot hash.
// Contract: `node regenerate-snapshot.mjs` prints the resulting claim count, link count, and hash.
//   Always run as its own fresh node process (never imported and called a second time from a
//   long-lived process): buildKernel's own data loads (corpus/tables.js, corpus/epistack-competition-
//   data.js) are require()-cached per-process, including through Node's require(esm) path this module
//   itself loads under, which does not release its cache entry on a plain require.cache delete; a
//   second in-process call after editing the corpus would silently see the pre-edit data. admit-
//   inbox.mjs spawns this as a child process for exactly this reason.
"use strict";
import { buildKernel } from "./epistack-competition-build.mjs";
import { hashOf } from "../vendor/kernel/schema/canonical.mjs";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HOME = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { KINDS, SOURCES } = require("../corpus/tables.js");

const built = buildKernel();
if (built.receipt.decision !== "accepted" && built.receipt.decision !== "accepted-with-disagreement") {
  console.error(`regenerate-snapshot: refusing to write, gate decision was '${built.receipt.decision}'`);
  process.exit(1);
}
const content = { state: built.state, sources: SOURCES, kinds: KINDS };
const snapshot_hash = hashOf(content);
// only mode/window travel to the published snapshot; the founding config's own "_note" documents the
// mechanism for a human reading that file directly and need not repeat in every fetched payload.
const foundingConfig = JSON.parse(readFileSync(join(HOME, "founding-config.json"), "utf8"));
const rawPolicy = foundingConfig.admission_policy && foundingConfig.admission_policy.comment_admission;
const admission_policy = rawPolicy ? { comment_admission: { mode: rawPolicy.mode, window: rawPolicy.window } } : null;
const out = { kernel_id: "epistack-competition", snapshot_hash, ...content, admission_policy };
writeFileSync(join(HOME, "snapshot", "epistack-competition.snapshot.json"), JSON.stringify(out) + "\n");
console.log(`regenerate-snapshot: ${content.state.entries.length} claims, ${content.state.links.length} links, hash ${snapshot_hash}`);
