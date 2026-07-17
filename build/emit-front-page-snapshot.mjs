// Role: regenerates the front-page kernel's own snapshot from its current corpus, the identical
//   pattern communities/epistack-competition/build/regenerate-snapshot.mjs already establishes:
//   rebuild via front-page-build.mjs's own buildKernel(), refuse to write if the gate does not
//   accept, write kernel_id/snapshot_hash/state/sources/kinds to app/fixtures/front-page.snapshot.json
//   (alongside the other mirrored kernels app/fixtures already carries).
// Contract: `node build/emit-front-page-snapshot.mjs` prints the resulting claim count, link count,
//   and hash.
// Invariant: sources is the MERGED table (front-page's own two sources plus whichever governance
//   sources the mirrored claims cite), exactly what buildKernel()'s own tables.sourceTable was built
//   from, so hashOf({state, sources, kinds}) recomputes identically on the client
//   (api/community.js's fetchCommunity) as it does here.
"use strict";
import { buildKernel } from "./front-page-build.mjs";
import { hashOf } from "../vendor/kernel/schema/canonical.mjs";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { KINDS } = require("../kernel/front-page/corpora/tables.js");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const built = buildKernel();
if (built.receipt.decision !== "accepted" && built.receipt.decision !== "accepted-with-disagreement") {
  console.error(`emit-front-page-snapshot: refusing to write, gate decision was '${built.receipt.decision}'`);
  process.exit(1);
}
const content = { state: built.state, sources: built.mergedSources, kinds: KINDS };
const snapshot_hash = hashOf(content);
const out = { kernel_id: "front-page", snapshot_hash, ...content };
writeFileSync(join(ROOT, "app", "fixtures", "front-page.snapshot.json"), JSON.stringify(out) + "\n");
console.log(`emit-front-page-snapshot: ${content.state.entries.length} claims, ${content.state.links.length} links, hash ${snapshot_hash}`);
