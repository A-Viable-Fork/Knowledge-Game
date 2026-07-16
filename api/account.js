// Role: the optional account (Phase KG-14). A keypair the app generates locally via WebCrypto
//   (ECDSA P-256, extractable so the reader can export their own private key and bring it back
//   later by their own hand), never a server-issued credential, never synced anywhere, never
//   shipped in any manifest, patch, or fetch body. The account id is a content hash of the public
//   key alone, so it is a name, never a claim of trust; a fresh install has no account and reading
//   needs none of it.
// Contract: createAccount(displayName) -> Promise<account>; account = {accountId, publicKeyJwk,
//   privateKeyJwk, displayName, createdAt}. exportAccount(account) -> JSON string (the account's own
//   material, plainly, for the reader's own hand). importAccount(jsonText) -> account (synchronous;
//   re-derives accountId from the imported public key and refuses a record whose declared accountId
//   does not match the recomputed hash of its own public key). generateEphemeralKeypair() ->
//   Promise<{publicKeyJwk, privateKeyJwk}> (level 4's floor presentation: a fresh keypair for one
//   use, never persisted by this module or any other, never reaching the vault).
//   PRESENTATION_LEVELS: the four-level menu spec Section 5 names (this key; a member of group G; a
//   member of this community; the empty predicate), each {id, label, functional, description?,
//   reason?}. presentationChipLabel(levelId) -> display string.
// Invariant: this module never writes to storage itself; every persisted read or write is
//   vault/vault.js's own, reached through api/settings.js. No network call exists here. A keypair is
//   extractable only so the reader can hold their own key; nothing in this module transmits one
//   anywhere.
"use strict";
import { sha256Hex } from "../vendor/kernel/schema/sha256.mjs";

const ALGORITHM = { name: "ECDSA", namedCurve: "P-256" };

function canonicalJwkString(jwk) {
  const keys = Object.keys(jwk).sort();
  const ordered = {};
  for (const k of keys) ordered[k] = jwk[k];
  return JSON.stringify(ordered);
}

// only the public coordinates identify the key; strip key_ops/ext bookkeeping fields WebCrypto adds
// on export, so the same key always hashes the same way regardless of which flags a given export
// carried.
function accountIdOf(publicKeyJwk) {
  const identityFields = { kty: publicKeyJwk.kty, crv: publicKeyJwk.crv, x: publicKeyJwk.x, y: publicKeyJwk.y };
  return sha256Hex(canonicalJwkString(identityFields));
}

async function generateKeypairJwk() {
  const pair = await crypto.subtle.generateKey(ALGORITHM, true, ["sign", "verify"]);
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { publicKeyJwk, privateKeyJwk };
}

export async function createAccount(displayName) {
  const { publicKeyJwk, privateKeyJwk } = await generateKeypairJwk();
  return { accountId: accountIdOf(publicKeyJwk), publicKeyJwk, privateKeyJwk, displayName: displayName || "", createdAt: Date.now() };
}

export function exportAccount(account) {
  return JSON.stringify(
    { accountId: account.accountId, publicKeyJwk: account.publicKeyJwk, privateKeyJwk: account.privateKeyJwk, displayName: account.displayName, createdAt: account.createdAt },
    null,
    2
  );
}

export function importAccount(jsonText) {
  const parsed = JSON.parse(jsonText);
  if (!parsed || !parsed.publicKeyJwk || !parsed.privateKeyJwk) throw new Error("importAccount: not a recognizable account export");
  const recomputed = accountIdOf(parsed.publicKeyJwk);
  if (parsed.accountId && parsed.accountId !== recomputed) {
    throw new Error(`importAccount: declared accountId ${parsed.accountId} does not match the recomputed hash ${recomputed} of its own public key, refusing`);
  }
  return { accountId: recomputed, publicKeyJwk: parsed.publicKeyJwk, privateKeyJwk: parsed.privateKeyJwk, displayName: parsed.displayName || "", createdAt: parsed.createdAt || Date.now() };
}

export async function generateEphemeralKeypair() {
  return generateKeypairJwk();
}

// the presentation menu (spec Section 5's own vocabulary): only "this-key" and "floor" are
// functional today; "group-member" and "community-member" render, disabled, with the plain reason
// membership presentation is not yet wired to a real evaluator, since no member-set commitment and
// no credential-seam evaluator exists upstream yet.
export const PRESENTATION_LEVELS = [
  { id: "this-key", label: "This key", functional: true, description: "signs with your account's own key" },
  { id: "group-member", label: "Member of a group", functional: false, reason: "membership presentation awaits the credential seam and member-set commitments upstream" },
  { id: "community-member", label: "Member of this community", functional: false, reason: "membership presentation awaits the credential seam and member-set commitments upstream" },
  { id: "floor", label: "Floor, unlinkable", functional: true, description: "a fresh, one-time key, generated and discarded, never tied to your account" },
];

export function presentationLevel(levelId) {
  return PRESENTATION_LEVELS.find((l) => l.id === levelId) || null;
}

// the one rule both the signing panel's UI (disabling a radio input) and its sign handler's own
// defensive re-check call, so a level-2/3 selection can never reach a real signing operation by any
// path: a level must be functional, and "this-key" additionally requires an existing account.
export function canSignWithLevel(levelId, hasAccount) {
  const level = presentationLevel(levelId);
  if (!level || !level.functional) return false;
  if (levelId === "this-key" && !hasAccount) return false;
  return true;
}

export function presentationChipLabel(levelId) {
  const level = presentationLevel(levelId);
  return `Presenting as: ${level ? level.label : "none chosen"}`;
}
