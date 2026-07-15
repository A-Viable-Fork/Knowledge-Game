// Role: verifies the community card's governance-hash (Phase KG-4, spec Section 7). Deterministic
//   over the canonical parameter record; permutation-invariant (field order never moves it); a label
//   change (kernel_id) never moves it; a real parameter change (pins, identity thresholds,
//   standing-economy fields) always does.
// Contract: `node build/check-card-hashes.mjs` exits non-zero on any divergence, naming it.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-CARD-HASHES: the governance-hash is deterministic, permutation-invariant, label-blind"); console.log(H);

const { governanceHash } = await import(join(ROOT, "build", "governance-hash.mjs"));

const BASE_CONFIG = { kernel_id: "epistack-competition", identity_thresholds: { propose: "any", "contest-type": "supported", vouch: "corroborated" }, standing_economy: { time_lock_cost: null, decay_rate: null, sybil_resistant_weighting_curve: null } };
const BASE_PINNED = { measurement: "2ed60a0154fef12d5d630f4a3f52d06686479c75aa57a44fd3b1488d581d3621", forum: "04c5a97678a1228065e6c36068b0b3dcc12ca52ad1285e6727f49754030007a1" };

console.log("\n[1] determinism: the same record hashes the same on a re-run");
{
  const h1 = governanceHash(BASE_CONFIG, BASE_PINNED);
  const h2 = governanceHash(BASE_CONFIG, BASE_PINNED);
  ok(h1 === h2, "two computations over the identical config/pins produce the identical hash");
  ok(typeof h1 === "string" && h1.length === 64, `the hash is a 64-hex sha256 digest (got ${h1.slice(0, 12)}...)`);
}

console.log("\n[2] permutation invariance: field order in the config or pinned-hash map never moves the hash");
{
  const h1 = governanceHash(BASE_CONFIG, BASE_PINNED);
  const permutedConfig = { standing_economy: BASE_CONFIG.standing_economy, identity_thresholds: { vouch: "corroborated", "contest-type": "supported", propose: "any" }, kernel_id: BASE_CONFIG.kernel_id };
  const permutedPinned = { forum: BASE_PINNED.forum, measurement: BASE_PINNED.measurement };
  const h2 = governanceHash(permutedConfig, permutedPinned);
  ok(h1 === h2, "permuting object key order (config fields and the pinned-hash map) does not move the hash");
}

console.log("\n[3] a label change (kernel_id) never moves the hash: kernel_id is not a governance parameter");
{
  const h1 = governanceHash(BASE_CONFIG, BASE_PINNED);
  const relabeled = { ...BASE_CONFIG, kernel_id: "a-totally-different-label" };
  const h2 = governanceHash(relabeled, BASE_PINNED);
  ok(h1 === h2, "changing kernel_id alone leaves the governance-hash unchanged");
}

console.log("\n[4] a real parameter change always moves the hash");
{
  const h1 = governanceHash(BASE_CONFIG, BASE_PINNED);
  const changedThresholds = { ...BASE_CONFIG, identity_thresholds: { ...BASE_CONFIG.identity_thresholds, vouch: "supported" } };
  ok(governanceHash(changedThresholds, BASE_PINNED) !== h1, "changing an identity threshold moves the hash");

  const changedEconomy = { ...BASE_CONFIG, standing_economy: { ...BASE_CONFIG.standing_economy, decay_rate: "0.1" } };
  ok(governanceHash(changedEconomy, BASE_PINNED) !== h1, "changing a standing-economy field moves the hash");

  const changedPins = { ...BASE_PINNED, measurement: "0000000000000000000000000000000000000000000000000000000000000" };
  ok(governanceHash(BASE_CONFIG, changedPins) !== h1, "changing a pinned type-hash moves the hash");

  const addedKind = { ...BASE_PINNED, comment: "2a9e3db197c0eb335140a53e384059547817fe1b5f8918d64adb533581432bef" };
  ok(governanceHash(BASE_CONFIG, addedKind) !== h1, "adding an adopted kind's pinned hash moves the hash");
}

console.log("\n[5] the founded competition community's own emitted card carries a governance-hash reproducing from its own config");
{
  const card = JSON.parse(readFileSync(join(ROOT, "communities", "epistack-competition", "community-card.json"), "utf8"));
  const config = JSON.parse(readFileSync(join(ROOT, "communities", "epistack-competition", "founding-config.json"), "utf8"));
  const reproduced = governanceHash(config, card.pinned_type_hashes);
  ok(card.governance_hash === reproduced, `the card's stored governance-hash reproduces from its own founding-config.json and pinned_type_hashes (card: ${card.governance_hash.slice(0, 12)}..., reproduced: ${reproduced.slice(0, 12)}...)`);
  ok(card.member_set_commitment === null, "member_set_commitment is honestly null (no member set published yet)");
  ok(typeof card.governance_hash_computed_by === "string" && /app-side/.test(card.governance_hash_computed_by), "the card notes the hash is computed app-side, pending the upstream coordination layer");
}

console.log("\n" + H);
if (fails === 0) console.log("verified: the governance-hash is deterministic and permutation-invariant, blind to the kernel_id label, and moves on any real parameter change; the founded community's own card reproduces.");
console.log(fails === 0 ? "check-card-hashes: OK" : `check-card-hashes: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
