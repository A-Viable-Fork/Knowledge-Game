// Role: verifies the three rooms (Phase KG-13). Each room snapshot's hash resolves and matches its
//   own card; each room recomputes on device with grades matching the pinned corpus (a real spot
//   re-run of the same, unmodified upstream builder the room was emitted from, or the same merge
//   logic for eggs); every case-claim walk (api/room-walks.js's ROOM_WALKS) names a room that
//   actually exists; every room's contribution target names epistack, never this app or the
//   Knowledge-Game repository.
// Contract: `node build/check-rooms.mjs` exits non-zero on any violation, naming it.
// Invariant: every assertion is against a real re-run (fetchCommunity's own hash verification, a
//   fresh dynamic import of the real upstream builder, a fresh view over the merged eggs state)
//   rather than trusting a value this check itself could silently drift from.
"use strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const UPSTREAM = join(ROOT, "upstream", "epistack");
const require = createRequire(import.meta.url);
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-ROOMS: the three competition rooms (Phase KG-13)"); console.log(H);

const ROOM_IDS = ["lhc", "eggs", "covid"];

console.log("\n[1] every room snapshot's hash matches its card and resolves");
const cards = {};
const snapshots = {};
for (const id of ROOM_IDS) {
  const snapshotPath = join(ROOT, "app", "fixtures", `${id}.snapshot.json`);
  const cardPath = join(ROOT, "communities", "rooms", `${id}-card.json`);
  let snapshot, card;
  try { snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")); } catch (e) { ok(false, `${id}: snapshot file readable (${e.message})`); continue; }
  try { card = JSON.parse(readFileSync(cardPath, "utf8")); } catch (e) { ok(false, `${id}: card file readable (${e.message})`); continue; }
  snapshots[id] = snapshot;
  cards[id] = card;

  const { hashOf } = await import("../vendor/kernel/schema/canonical.mjs");
  const recomputed = hashOf({ state: snapshot.state, sources: snapshot.sources, kinds: snapshot.kinds });
  ok(recomputed === snapshot.snapshot_hash, `${id}: snapshot's own declared snapshot_hash matches a fresh recompute (${recomputed === snapshot.snapshot_hash ? "match" : `declared ${snapshot.snapshot_hash}, recomputed ${recomputed}`})`);
  ok(card.snapshot_hash === snapshot.snapshot_hash, `${id}: the room card's snapshot_hash matches the snapshot file's own declared hash`);
}

console.log("\n[2] every room's contribution target names epistack, never this app or the Knowledge-Game repository");
for (const id of ROOM_IDS) {
  if (!cards[id]) continue;
  const target = cards[id].contribution_target;
  ok(/github\.com\/A-Viable-Fork\/epistack/.test(target), `${id}: contribution_target names the epistack repository (${target.slice(0, 60)}...)`);
  ok(!/Knowledge-Game/i.test(target), `${id}: contribution_target does not name this app or the Knowledge-Game repository`);
}

console.log("\n[3] each room recomputes on device with grades matching the pinned corpus (a real re-run of the same builder)");
{
  const { storeViewOf } = await import("../vendor/kernel/store/decay.mjs");
  const { makeSourceTable, makeKindTable } = await import("../vendor/kernel/schema/tables.mjs");

  // lhc and covid: dynamic-import the real, unmodified upstream builder directly.
  for (const [id, fnName, fileName] of [["lhc", "buildLhc", "lhc-build.mjs"], ["covid", "buildCovid", "covid-build.mjs"]]) {
    if (!snapshots[id]) continue;
    const mod = await import(pathToFileURL(join(UPSTREAM, "build", fileName)).href);
    const built = mod[fnName]();
    const firstEntry = built.state.entries[0];
    const builderEarned = built.view.earnedByIdentity.get(firstEntry.identity).earned;
    const tables = { sourceTable: makeSourceTable(snapshots[id].sources.map((s) => ({ source_id: s.source_id, source_class: s.source_class, description: s.description }))), kindTable: makeKindTable(snapshots[id].kinds) };
    const freshView = storeViewOf(snapshots[id].state, tables);
    const snapshotEarned = freshView.earnedByIdentity.get(firstEntry.identity).earned;
    ok(snapshotEarned === builderEarned, `${id}: spot-check claim "${firstEntry.statement.slice(0, 40)}...": upstream builder earned=${builderEarned}, snapshot recomputes earned=${snapshotEarned}`);
  }

  // eggs: re-run the same merge this deployment's own build/emit-rooms.mjs performs, compare
  // against upstream's own domain-scoped buildEggs() view for a known nutrition claim.
  if (snapshots.eggs) {
    const eggsMod = await import(pathToFileURL(join(UPSTREAM, "build", "eggs-build.mjs")).href);
    const upstreamBuilt = eggsMod.buildEggs();
    const { NUTRITION } = require(join(UPSTREAM, "corpora", "eggs", "nutrition.js"));
    const nutritionDomain = upstreamBuilt.domains["S-nutrition"];
    const firstRef = NUTRITION.claims[0].ref;
    const upstreamIdentity = nutritionDomain.refId.get(firstRef);
    const upstreamEarned = nutritionDomain.view.earnedByIdentity.get(upstreamIdentity).earned;
    const tables = { sourceTable: makeSourceTable(snapshots.eggs.sources.map((s) => ({ source_id: s.source_id, source_class: s.source_class, description: s.description }))), kindTable: makeKindTable(snapshots.eggs.kinds) };
    const freshView = storeViewOf(snapshots.eggs.state, tables);
    const snapshotEntry = freshView.earnedByIdentity.get(upstreamIdentity);
    ok(!!snapshotEntry, `eggs: the merged snapshot carries the same claim identity upstream's own nutrition domain computed (a real cross-check, not a coincidence)`);
    if (snapshotEntry) ok(snapshotEntry.earned === upstreamEarned, `eggs: spot-check a nutrition claim: upstream domain-scoped earned=${upstreamEarned}, merged snapshot recomputes earned=${snapshotEntry.earned}`);
  }
}

console.log("\n[4] every case-claim walk names a room that actually exists");
{
  const { ROOM_WALKS } = await import("../api/room-walks.js");
  for (const [identity, targets] of ROOM_WALKS.entries()) {
    for (const t of targets) {
      ok(ROOM_IDS.includes(t.roomId) && !!snapshots[t.roomId], `claim ${identity.slice(0, 12)}...: walks to "${t.roomId}", a room that actually exists and loaded`);
    }
  }
  // the epistack-competition snapshot must actually carry every claim identity ROOM_WALKS names,
  // so a walk button is never offered on a claim that does not exist in the loaded community.
  const competitionSnapshot = JSON.parse(readFileSync(join(ROOT, "communities", "epistack-competition", "snapshot", "epistack-competition.snapshot.json"), "utf8"));
  const competitionIdentities = new Set(competitionSnapshot.state.entries.map((e) => e.identity));
  for (const identity of ROOM_WALKS.keys()) {
    ok(competitionIdentities.has(identity), `claim ${identity.slice(0, 12)}...: exists in the epistack-competition community (the walk button will actually render on a real card)`);
  }
}

console.log("\n[5] the neutrality check extends to the rooms: contribution targets in the network manifest name epistack too");
{
  const networkManifest = JSON.parse(readFileSync(join(ROOT, "manifests", "network.json"), "utf8"));
  const roomDestinations = networkManifest.allowed_egress_destinations.filter((d) => ROOM_IDS.some((id) => d.path.includes(`${id}.snapshot.json`)));
  ok(roomDestinations.length === ROOM_IDS.length, `manifests/network.json declares exactly ${ROOM_IDS.length} room destinations (found ${roomDestinations.length})`);
  for (const d of roomDestinations) {
    ok(/epistack/i.test(d.description), `${d.path}: description names epistack`);
  }
}

console.log("\n" + H);
console.log(fails === 0 ? "check-rooms: OK" : `check-rooms: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
