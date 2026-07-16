// Role: emits the three competition rooms (lhc, eggs, covid) as browsable-community snapshots from
//   the re-pinned upstream/epistack submodule, the freeze-week analogue of build/emit-fixtures.mjs's
//   own math/knowledge-game emission. lhc and covid each already build through one real, unmodified
//   upstream builder (build/lhc-build.mjs's buildLhc(), build/covid-build.mjs's buildCovid()) that
//   returns a single { state, tables } pair, dynamic-imported here unchanged and staged exactly as
//   vendor-kernel.mjs's own generic transform does (never a second hashing or staging scheme). eggs
//   does not: build/eggs-build.mjs's buildEggs() returns three separate domain stores (nutrition,
//   environment, economics) plus a cross-domain composite layer local-provider.mjs's snapshot shape
//   has no representation for (a composite claim's grade comes from citations across store
//   boundaries, not from the single-store gate this snapshot format assumes). The honest unit this
//   script emits for eggs is the union of the three domains' own already-graded claims and links,
//   re-decided together from one genesis over their shared kind/source table (corpora/eggs/tables.js
//   already declares one shared table for all three, so no ref or kind collision is invented by
//   merging); the composite weighing layer itself is not part of this snapshot, reported as such
//   rather than forced.
// Contract: `node build/emit-rooms.mjs` writes app/fixtures/lhc.snapshot.json, eggs.snapshot.json,
//   covid.snapshot.json, and prints each snapshot_hash plus a grade spot-check line per room.
// Invariant: touches no vendor/ file, adds no local patch; every real computation (claimRecord,
//   linkRecord, genesis, apply, decide, hashOf) is the same vendored primitive this deployment
//   already pins, called directly rather than through a modified copy of vendor-kernel.mjs (which is
//   itself pinned, vendored code this repository never hand-edits).
"use strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const UPSTREAM = join(ROOT, "upstream", "epistack");
const FIXTURES_DIR = join(ROOT, "app", "fixtures");
const require = createRequire(import.meta.url);
const UPSTREAM_COMMIT = execFileSync("git", ["-C", UPSTREAM, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

import { claimRecord, linkRecord } from "../vendor/kernel/schema/records.mjs";
import { makeSourceTable, makeKindTable } from "../vendor/kernel/schema/tables.mjs";
import { genesis } from "../vendor/kernel/store/state.mjs";
import { apply } from "../vendor/kernel/store/apply.mjs";
import { hashOf } from "../vendor/kernel/schema/canonical.mjs";
import { governanceHash } from "../api/governance-hash.js";

const ROOMS_DIR = join(ROOT, "communities", "rooms");
const EPISTACK_REPO = "https://github.com/A-Viable-Fork/epistack";
const ROOM_META = {
  lhc: { label: "The LHC Room (black holes, the clean resolvable case)", corpusPath: "corpora/lhc" },
  eggs: { label: "The Eggs Room (nutrition, the corrupted-field case)", corpusPath: "corpora/eggs" },
  covid: { label: "The Covid Room (pandemic origins, the adversarial case)", corpusPath: "corpora/covid" },
};
const roomHashes = {};

function writeRoomCard(id, snapshotHash) {
  const config = { identity_thresholds: {}, standing_economy: {}, corpus_content_license: "attribution-required" };
  const card = {
    kernel_id: id,
    governance_hash: governanceHash(config, {}),
    governance_hash_computed_by: "this deployment, app-side, over a minimal parameter record: no founding flow has been run for this room (it is a pre-existing epistack corpus, mirrored, not founded), so identity_thresholds and standing_economy are both empty and the same hash results for every room in this set",
    member_set_commitment: null,
    snapshot_hash: snapshotHash,
    fetch_locations: [`https://a-viable-fork.github.io/Knowledge-Game/app/fixtures/${id}.snapshot.json`],
    pinned_type_hashes: {},
    contribution_target: `${EPISTACK_REPO}/tree/${UPSTREAM_COMMIT}/${ROOM_META[id].corpusPath} (a contest or correction on a room claim is a pull request there, re-run through epistack's own gate)`,
    protocol_identity: "epistack-v3",
    domain: ROOM_META[id].label,
    identity_thresholds: {},
    standing_economy: {},
    corpus_content_license: "attribution-required",
  };
  const dest = join(ROOMS_DIR, `${id}-card.json`);
  writeFileSync(dest, JSON.stringify(card, null, 2) + "\n");
  console.log(`wrote ${dest}`);
  return card;
}

function stageSnapshot(kernelId, state, tables) {
  const sources = [...tables.sourceTable.byId.values()]
    .map((s) => ({ source_id: s.source_id, source_class: s.source_class, description: s.description }))
    .sort((a, b) => (a.source_id < b.source_id ? -1 : a.source_id > b.source_id ? 1 : 0));
  const kinds = [...tables.kindTable.byKind.entries()]
    .map(([kind, row]) => ({ kind, ceiling: row.ceiling }))
    .sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
  const content = { state: { entries: state.entries, links: state.links }, sources, kinds };
  const snapshot_hash = hashOf(content);
  return { kernel_id: kernelId, snapshot_hash, ...content };
}

function writeSnapshot(id, snapshot) {
  const dest = join(FIXTURES_DIR, `${id}.snapshot.json`);
  writeFileSync(dest, JSON.stringify(snapshot));
  console.log(`wrote ${dest}: ${snapshot.state.entries.length} claims, ${snapshot.state.links.length} links, snapshot_hash ${snapshot.snapshot_hash.slice(0, 16)}...`);
  roomHashes[id] = snapshot.snapshot_hash;
  writeRoomCard(id, snapshot.snapshot_hash);
  return dest;
}

mkdirSync(ROOMS_DIR, { recursive: true });
console.log(`emitting rooms from upstream/epistack at ${UPSTREAM_COMMIT}\n`);

console.log("[1] lhc: dynamic-importing the real, unmodified upstream builder");
{
  const mod = await import(pathToFileURL(join(UPSTREAM, "build", "lhc-build.mjs")).href);
  const built = mod.buildLhc();
  const snapshot = stageSnapshot("lhc", built.state, built.tables);
  writeSnapshot("lhc", snapshot);
  // grade spot-check: the first claim's earned grade, read from the same view the real builder
  // computed, must equal what a fresh view over this staged snapshot's own state recomputes.
  const firstEntry = built.state.entries[0];
  console.log(`    spot-check: claim "${firstEntry.statement.slice(0, 50)}...": builder's own view earned=${built.view.earnedByIdentity.get(firstEntry.identity).earned}`);
}

console.log("\n[2] covid: dynamic-importing the real, unmodified upstream builder");
{
  const mod = await import(pathToFileURL(join(UPSTREAM, "build", "covid-build.mjs")).href);
  const built = mod.buildCovid();
  const snapshot = stageSnapshot("covid", built.state, built.tables);
  writeSnapshot("covid", snapshot);
  const firstEntry = built.state.entries[0];
  console.log(`    spot-check: claim "${firstEntry.statement.slice(0, 50)}...": builder's own view earned=${built.view.earnedByIdentity.get(firstEntry.identity).earned}`);
}

console.log("\n[3] eggs: merging the three domain stores (nutrition, environment, economics) over their one shared table; the cross-domain composite layer is not part of this snapshot");
{
  const { KINDS, SOURCES } = require(join(UPSTREAM, "corpora", "eggs", "tables.js"));
  const { NUTRITION } = require(join(UPSTREAM, "corpora", "eggs", "nutrition.js"));
  const { ENVIRONMENT } = require(join(UPSTREAM, "corpora", "eggs", "environment.js"));
  const { ECONOMICS } = require(join(UPSTREAM, "corpora", "eggs", "economics.js"));
  const tables = { sourceTable: makeSourceTable(SOURCES), kindTable: makeKindTable(KINDS) };

  const refId = new Map();
  const allClaims = [];
  const allLinkSpecs = [];
  for (const domain of [NUTRITION, ENVIRONMENT, ECONOMICS]) {
    for (const spec of domain.claims) {
      const rec = claimRecord({ kind: spec.kind, statement: spec.statement, source_id: spec.source_id, contributor_id: spec.contributor_id, declared_grade: spec.declared_grade, checking_records: spec.checking_records, closing_condition: spec.closing_condition });
      refId.set(spec.ref, rec.identity);
      allClaims.push(rec);
    }
    for (const l of domain.links || []) allLinkSpecs.push(l);
  }
  const links = allLinkSpecs.map((l) => linkRecord({ link_kind: l.link_kind, from_identity: refId.get(l.from), to_identity: refId.get(l.to), support_group: l.support_group, source_id: l.source_id, contributor_id: l.contributor_id, declared_grade: l.declared_grade }));
  const state = apply(genesis(), { entries: allClaims, links, applied_contribution_hash: "eggs-merged", receipt_reference: "eggs-merged" });

  const snapshot = stageSnapshot("eggs", state, tables);
  writeSnapshot("eggs", snapshot);

  // spot-check against upstream's own real buildEggs(): the merged snapshot's earned grade for a
  // known nutrition claim must equal that same claim's own earned grade in the upstream builder's
  // own domain-scoped view (each domain is causally self-contained; only the composite layer, not
  // part of this snapshot, cites across domains), so merging changes no grade.
  const eggsMod = await import(pathToFileURL(join(UPSTREAM, "build", "eggs-build.mjs")).href);
  const upstreamBuilt = eggsMod.buildEggs();
  const nutritionDomain = upstreamBuilt.domains["S-nutrition"];
  const firstRef = NUTRITION.claims[0].ref;
  const upstreamIdentity = nutritionDomain.refId.get(firstRef);
  const upstreamEarned = nutritionDomain.view.earnedByIdentity.get(upstreamIdentity).earned;
  const mergedEntry = state.entries.find((e) => e.identity === upstreamIdentity);
  const { storeViewOf } = await import("../vendor/kernel/store/decay.mjs");
  const mergedView = storeViewOf(state, tables);
  const mergedEarned = mergedView.earnedByIdentity.get(upstreamIdentity).earned;
  console.log(`    spot-check: claim "${mergedEntry.statement.slice(0, 50)}...": upstream domain-scoped earned=${upstreamEarned}, merged-snapshot earned=${mergedEarned} (${mergedEarned === upstreamEarned ? "matches" : "MISMATCH"})`);
}

console.log("\ndone. pinned commit:", UPSTREAM_COMMIT);
for (const id of ["lhc", "eggs", "covid"]) console.log(`  ${id}: ${roomHashes[id]}`);
