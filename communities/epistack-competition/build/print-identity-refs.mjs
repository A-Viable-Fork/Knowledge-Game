// Role: prints this community's current identity -> ref map as JSON (Phase KG-11 Step 4), so admit-
//   inbox.mjs can resolve a comment's comments-on/replies-to target against a genuinely fresh read of
//   the corpus without importing epistack-competition-build.mjs in the same long-lived process (see
//   regenerate-snapshot.mjs's own header for why that caches stale after a corpus edit). Always run as
//   its own fresh node process.
// Contract: `node print-identity-refs.mjs` prints one JSON object { identity: ref, ... } to stdout.
"use strict";
import { buildKernel } from "./epistack-competition-build.mjs";

const built = buildKernel();
const map = {};
for (const c of built.claims) map[c.rec.identity] = c.spec.ref;
process.stdout.write(JSON.stringify(map));
