// Role: verifies the optional account layer's own disciplines (Phase KG-14). Reading requires
//   nothing this layer holds: no read-path module references account state. A fresh install is
//   accountless. The bundle-building modules carry no code path from account or signature material
//   to a produced bundle. A detached signature verifies against its bundle and public key and fails
//   on tamper. An unsigned contribution is fully valid through the whole path. The two disabled
//   presentation levels can never reach an actual signing operation.
// Contract: `node build/check-accounts.mjs` exits non-zero on any violation, naming it.
// Invariant: every assertion here is against real code (a static import scan, a real WebCrypto sign
//   and verify, the real draft/bundle path) rather than an assumption about what the UI does.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-ACCOUNTS: the optional account layer (Phase KG-14)"); console.log(H);

console.log("\n[1] no read path references account state");
const READ_PATH_FILES = ["api/community.js", "api/feed.js", "api/ranking.js", "api/filter.js", "api/epistemic-cost.js", "api/virtual.js", "periphery/card.js"];
for (const file of READ_PATH_FILES) {
  const source = readFileSync(join(ROOT, file), "utf8");
  const specs = [...source.matchAll(/import\s+[^"']*["']([^"']+)["']/g)].map((m) => m[1]);
  const touchesAccount = specs.some((s) => /account\.js|signatures\.js/.test(s));
  ok(!touchesAccount, `${file}: imports ${JSON.stringify(specs)}, none reaching api/account.js or api/signatures.js`);
  ok(!/getAccount|\baccount\b/.test(source), `${file}: no textual reference to account state either`);
}

console.log("\n[2] a fresh install is accountless");
function makeMemoryLocalStorage() {
  const store = new Map();
  return { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
}
globalThis.localStorage = makeMemoryLocalStorage();
const vault = await import(join(ROOT, "vault", "vault.js"));
ok(vault.getAccount() === null, "vault.getAccount() is null before anything is ever created (absence is the unauthenticated default, constructed not configured)");

console.log("\n[3] the bundle-building modules carry no code path from account or signature material to a bundle");
for (const file of ["api/contribute.js", "api/register-artifact.js", "vendor/api/contribution.js"]) {
  const source = readFileSync(join(ROOT, file), "utf8");
  const specs = [...source.matchAll(/import\s+[^"']*["']([^"']+)["']/g)].map((m) => m[1]);
  const touchesAccount = specs.some((s) => /account\.js|signatures\.js/.test(s));
  ok(!touchesAccount, `${file}: imports ${JSON.stringify(specs)}, none reaching api/account.js or api/signatures.js`);
}

console.log("\n[4] a detached signature verifies against its bundle and public key, and fails on tamper");
const { signBundleId, verifyBundleSignature } = await import(join(ROOT, "api", "signatures.js"));
const ALGORITHM = { name: "ECDSA", namedCurve: "P-256" };
const pair = await crypto.subtle.generateKey(ALGORITHM, true, ["sign", "verify"]);
const publicKeyJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
const privateKeyJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
const CONTRIBUTION_ID = "fake-contribution-id-for-check-accounts-1a2b3c4d";
const signature = await signBundleId(CONTRIBUTION_ID, privateKeyJwk);
ok(await verifyBundleSignature(CONTRIBUTION_ID, signature, publicKeyJwk), "a genuine signature verifies against its own contribution id and public key");
ok(!(await verifyBundleSignature(CONTRIBUTION_ID + "-tampered", signature, publicKeyJwk)), "the same signature fails against a tampered contribution id");
ok(!(await verifyBundleSignature(CONTRIBUTION_ID, "00" + signature.slice(2), publicKeyJwk)), "a tampered signature fails against the real contribution id");
const otherPair = await crypto.subtle.generateKey(ALGORITHM, true, ["sign", "verify"]);
const otherPublicKeyJwk = await crypto.subtle.exportKey("jwk", otherPair.publicKey);
ok(!(await verifyBundleSignature(CONTRIBUTION_ID, signature, otherPublicKeyJwk)), "the same signature fails against a different public key");

console.log("\n[5] an unsigned contribution is still valid through the whole path");
const { fetchCommunity } = await import(join(ROOT, "api", "community.js"));
globalThis.fetch = async (url) => {
  const path = url.startsWith("../") ? join(ROOT, url.replace(/^\.\.\//, "")) : join(ROOT, "app", url);
  const body = readFileSync(path, "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};
const { draftProposal, bundleProposal } = await import(join(ROOT, "api", "contribute.js"));
const community = await fetchCommunity("../communities/epistack-competition/snapshot/epistack-competition.snapshot.json");
globalThis.fetch = undefined;
const { proposal, receipt } = draftProposal(community, { statement: "check-accounts.mjs: an ordinary, never-signed contribution.", kind: "measurement", contributorId: "fuzz-tester" });
ok(receipt.decision === "accepted" || receipt.decision === "accepted-with-disagreement", `an unsigned draft is gate-accepted exactly like any other (got ${receipt.decision})`);
const bundle = bundleProposal(proposal, receipt, { kernel_id: community.kernelId, state_id: community.snapshotHash });
ok(!!bundle.contribution_id, "the unsigned bundle carries its own content-derived contribution_id, unaffected by whether it will ever be signed");
ok(!JSON.stringify(bundle).includes("signature"), "the unsigned bundle carries no signature field at all; a signature is a sibling artifact, never a mutation of the bundle");

console.log("\n[6] the two disabled presentation levels can never reach an actual signing operation");
const { PRESENTATION_LEVELS, canSignWithLevel } = await import(join(ROOT, "api", "account.js"));
const disabledLevels = PRESENTATION_LEVELS.filter((l) => !l.functional).map((l) => l.id);
ok(disabledLevels.length === 2 && disabledLevels.includes("group-member") && disabledLevels.includes("community-member"), "exactly the two membership levels are disabled today");
for (const levelId of disabledLevels) {
  ok(!canSignWithLevel(levelId, true), `canSignWithLevel("${levelId}", account present) refuses`);
  ok(!canSignWithLevel(levelId, false), `canSignWithLevel("${levelId}", no account) refuses`);
}
ok(canSignWithLevel("this-key", true), "canSignWithLevel(\"this-key\", account present) allows signing");
ok(!canSignWithLevel("this-key", false), "canSignWithLevel(\"this-key\", no account) refuses (nothing to sign with)");
ok(canSignWithLevel("floor", false), "canSignWithLevel(\"floor\", no account) allows signing (needs no account)");
ok(canSignWithLevel("floor", true), "canSignWithLevel(\"floor\", account present) still allows signing");

console.log("\n" + H);
console.log(fails === 0 ? "check-accounts: OK" : `check-accounts: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
