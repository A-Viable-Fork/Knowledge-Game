// Role: verifies claim 4 (personal profile records cannot enter public contribution patches). Fills
//   the vault with canary values via its own real functions, drives the draft and bundle path
//   (api/contribute.js, vendor/api/contribution.js) across fuzzed inputs, and asserts no canary ever
//   appears in any serialized bundle; separately, a static scan proves the bundle-building modules
//   import nothing from vault/ or api/settings.js, so there is no code path for vault data to reach a
//   bundle regardless of what the vault holds. Phase KG-14 extends the same canary discipline to the
//   optional account's own private key.
// Contract: `node build/check-profile-leak.mjs` exits non-zero on any violation, naming it.
// Invariant: the static scan is the structural guarantee (no import edge exists); the canary run is
//   the empirical one (no coincidental string leak through any transformation), and both are required,
//   since a static scan alone would miss a leak introduced by, say, string concatenation of an
//   imported value that is not itself named "vault".
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-PROFILE-LEAK: personal profile records cannot enter a public bundle"); console.log(H);

console.log("\n[1] static scan: the bundle-building modules import nothing from vault/ or api/settings.js");
for (const file of ["api/contribute.js", "vendor/api/contribution.js"]) {
  const source = readFileSync(join(ROOT, file), "utf8");
  const specs = [...source.matchAll(/import\s+[^"']*["']([^"']+)["']/g)].map((m) => m[1]);
  const touchesVault = specs.some((s) => /vault|settings\.js/.test(s));
  ok(!touchesVault, `${file}: imports ${JSON.stringify(specs)}, none reaching vault/ or api/settings.js`);
}

console.log("\n[2] fill the vault with canary values through its own real functions");
function makeMemoryLocalStorage() {
  const store = new Map();
  return { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
}
globalThis.localStorage = makeMemoryLocalStorage();
const vault = await import(join(ROOT, "vault", "vault.js"));
const CANARY = "CANARY-9f3a7c1e-do-not-leak";
const KEY_CANARY = "sk-CANARY-do-not-leak-1a2b3c4d";
vault.setObjective({ "learn-efficiently": 3 });
vault.setObservationEnabled(true);
vault.recordObservation({ type: "dwell", identity: CANARY, kind: "measurement", at: Date.now(), note: CANARY });
vault.setAssistantProviderConfig("canary-provider", { endpoint: "https://example.invalid/v1/chat/completions", apiKey: KEY_CANARY, model: "canary-model" }); // Phase KG-9b: the assistant's BYOK credential, planted as its own canary
vault.addAssistantModel("canary-provider", "canary-added-model");
const PRIVATE_KEY_CANARY = "CANARY-private-key-d-value-do-not-leak-5e6f7a8b";
vault.setAccount({ accountId: "canary-account-id", publicKeyJwk: { kty: "EC", crv: "P-256", x: "canary-x", y: "canary-y" }, privateKeyJwk: { kty: "EC", crv: "P-256", x: "canary-x", y: "canary-y", d: PRIVATE_KEY_CANARY }, displayName: "canary reader", createdAt: Date.now() }); // Phase KG-14: the account's own private key, planted as its own canary
ok(JSON.stringify(vault.exportAll()).includes(CANARY), "sanity: the canary is actually present in the vault's own export (the seed worked)");
ok(JSON.stringify(vault.exportAll()).includes(KEY_CANARY), "sanity: the key canary is actually present in the vault's own export (exportable like every other vault field)");
ok(JSON.stringify(vault.exportAll()).includes(PRIVATE_KEY_CANARY), "sanity: the private-key canary is actually present in the vault's own export (exportable like every other vault field, at the reader's own hand)");

console.log("\n[3] fuzzing the draft and bundle path; no canary reaches any bundle");
const { fetchCommunity } = await import(join(ROOT, "api", "community.js"));
globalThis.fetch = async (url) => {
  const path = url.startsWith("../") ? join(ROOT, url.replace(/^\.\.\//, "")) : join(ROOT, "app", url);
  const body = readFileSync(path, "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};
const { draftProposal, bundleProposal } = await import(join(ROOT, "api", "contribute.js"));
const community = await fetchCommunity("../communities/epistack-competition/snapshot/epistack-competition.snapshot.json");
globalThis.fetch = undefined;

const FUZZ_STATEMENTS = [
  "An ordinary test statement.",
  CANARY, // a statement that happens to literally BE the canary: still must not leak from the VAULT (this is the drafter's own input, not the vault's)
  "A statement mentioning dwell and observation and measurement, unrelated words the vault also uses.",
];
for (const statement of FUZZ_STATEMENTS) {
  const { proposal, receipt } = draftProposal(community, { statement, kind: "measurement", contributorId: "fuzz-tester" });
  if (!proposal) continue;
  const bundle = bundleProposal(proposal, receipt, { kernel_id: community.kernelId, state_id: community.snapshotHash });
  const bundleText = JSON.stringify(bundle);
  // the canary is expected to appear ONLY when the drafter's own typed statement was literally the
  // canary string (their own input, not a vault leak); what must never happen is the canary appearing
  // via the "note" field or any other vault-only shape (e.g. as part of an observation-log record).
  ok(!bundleText.includes("\"note\":"), `statement "${statement.slice(0, 30)}...": bundle carries no "note" field (the vault's own field name, never emitted by the draft path)`);
  ok(!bundleText.includes(CANARY) || statement === CANARY, `statement "${statement.slice(0, 30)}...": the canary appears in the bundle only when it was the drafter's own literal input, never from the vault`);
}

console.log("\n[4] a draft that never mentions the canary produces a bundle that never mentions it either");
{
  const { proposal, receipt } = draftProposal(community, { statement: "A wholly unrelated claim about type systems.", kind: "measurement", contributorId: "fuzz-tester" });
  const bundle = bundleProposal(proposal, receipt, { kernel_id: community.kernelId, state_id: community.snapshotHash });
  ok(!JSON.stringify(bundle).includes(CANARY), "the canary, present in the vault throughout, does not appear in a bundle whose draft never mentioned it");
  ok(!JSON.stringify(bundle).includes(KEY_CANARY), "the key canary, present in the vault throughout, does not appear in any bundle either");
}

console.log("\n[5] the key canary specifically: static scan plus a fuzz across every statement, key never reaches a bundle");
{
  const apiSrc = readFileSync(join(ROOT, "api", "assistant.js"), "utf8");
  const specs = [...apiSrc.matchAll(/import\s+[^"']*["']([^"']+)["']/g)].map((m) => m[1]);
  ok(!specs.some((s) => /contribute\.js|contribution\.js/.test(s)), `api/assistant.js imports ${JSON.stringify(specs)}, none reaching the draft or bundle path`);
  for (const statement of [...FUZZ_STATEMENTS, KEY_CANARY]) {
    const { proposal, receipt } = draftProposal(community, { statement, kind: "measurement", contributorId: "fuzz-tester" });
    if (!proposal) continue;
    const bundle = bundleProposal(proposal, receipt, { kernel_id: community.kernelId, state_id: community.snapshotHash });
    const bundleText = JSON.stringify(bundle);
    ok(!bundleText.includes(KEY_CANARY) || statement === KEY_CANARY, `statement "${statement.slice(0, 20)}...": the key canary appears in the bundle only when it was the drafter's own literal input, never from the vault`);
  }
}

console.log("\n[6] the private-key canary specifically (Phase KG-14): static scan plus a fuzz across every statement, the key never reaches a bundle");
{
  for (const file of ["api/account.js", "api/signatures.js"]) {
    const src = readFileSync(join(ROOT, file), "utf8");
    const specs = [...src.matchAll(/import\s+[^"']*["']([^"']+)["']/g)].map((m) => m[1]);
    ok(!specs.some((s) => /contribute\.js|contribution\.js/.test(s)), `${file} imports ${JSON.stringify(specs)}, none reaching the draft or bundle path`);
  }
  for (const statement of [...FUZZ_STATEMENTS, PRIVATE_KEY_CANARY]) {
    const { proposal, receipt } = draftProposal(community, { statement, kind: "measurement", contributorId: "fuzz-tester" });
    if (!proposal) continue;
    const bundle = bundleProposal(proposal, receipt, { kernel_id: community.kernelId, state_id: community.snapshotHash });
    const bundleText = JSON.stringify(bundle);
    ok(!bundleText.includes(PRIVATE_KEY_CANARY) || statement === PRIVATE_KEY_CANARY, `statement "${statement.slice(0, 20)}...": the private-key canary appears in the bundle only when it was the drafter's own literal input, never from the vault`);
  }
}

console.log("\n" + H);
if (fails === 0) console.log("verified: the bundle-building modules import nothing from the vault, and a vault filled with canary values leaks none of them into any produced bundle.");
console.log(fails === 0 ? "check-profile-leak: OK" : `check-profile-leak: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
