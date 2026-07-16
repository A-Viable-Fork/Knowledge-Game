// Role: detached signatures over a contribution bundle's own content-derived id (Phase KG-14 Step
//   2). A signature never mutates the bundle it signs; it travels as a sibling artifact, so an
//   unsigned bundle is byte-identical and fully valid whether or not this module is ever invoked.
// Contract: signBundleId(contributionId, privateKeyJwk) -> Promise<string> (hex-encoded raw ECDSA
//   signature). verifyBundleSignature(contributionId, signatureHex, publicKeyJwk) ->
//   Promise<boolean>, false (never throwing) on any malformed input or tamper.
// Invariant: signs and verifies the bundle's own contribution_id string bytes only, never the
//   private key material itself. No storage access, no network call.
"use strict";

const ALGORITHM = { name: "ECDSA", namedCurve: "P-256" };
const SIGN_PARAMS = { name: "ECDSA", hash: "SHA-256" };

function hexOf(buffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function bytesOfHex(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function signBundleId(contributionId, privateKeyJwk) {
  const key = await crypto.subtle.importKey("jwk", privateKeyJwk, ALGORITHM, false, ["sign"]);
  const signature = await crypto.subtle.sign(SIGN_PARAMS, key, new TextEncoder().encode(contributionId));
  return hexOf(signature);
}

export async function verifyBundleSignature(contributionId, signatureHex, publicKeyJwk) {
  try {
    const key = await crypto.subtle.importKey("jwk", publicKeyJwk, ALGORITHM, false, ["verify"]);
    return await crypto.subtle.verify(SIGN_PARAMS, key, bytesOfHex(signatureHex), new TextEncoder().encode(contributionId));
  } catch (e) {
    return false;
  }
}
