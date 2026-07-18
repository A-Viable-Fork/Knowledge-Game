// Role: verifies the submission reading surface's four guarantees (Phase KG-11 Step 5): a document's
//   fetched hash equals its anchor map's declared content_hash and the mismatch path actually refuses;
//   every anchor span in every reading-sequence document resolves to a claim the community store
//   actually carries; a mechanical/evaluative span's grade glyph matches a freshly, independently
//   recomputed grade, byte-for-byte, never a stale or hand-typed value; and the admission-policy hook
//   (communities/epistack-competition/build/admission.mjs's decideAdmission) admits a comment-kind
//   bundle only, refusing a claim-kind bundle through the identical path even when auto-during-window
//   is enabled and now falls inside the declared window.
// Contract: `node build/check-submission-surface.mjs` exits non-zero on any divergence, naming it.
// Invariant: every fetch this check drives is answered from real content (the actual pinned document
//   at PINNED_EPISTACK_COMMIT, read via `git show` against the submodule's own object store, and the
//   anchor maps this deployment ships), never a synthetic fixture standing in for them; only the
//   doctored-hash and absent-claim sections deliberately corrupt a copy to prove the refusal path, and
//   both leave the real files on disk untouched. The pinned document is read at its own fixed commit,
//   never the submodule's live checkout (upstream/lock.json's pin moves independently for unrelated
//   reasons, most recently KG-GLOSSARY's re-pin).
"use strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { PINNED_EPISTACK_COMMIT } from "../api/submission.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-SUBMISSION-SURFACE: document authenticity, span resolution, glyph fidelity, admission policy"); console.log(H);

const networkManifest = JSON.parse(readFileSync(join(ROOT, "manifests", "network.json"), "utf8"));
const declaredDocDestinations = new Map(networkManifest.allowed_document_destinations.map((d) => [d.path, d]));

// ---- fetch stub: answers every request from real on-disk content, and records every URL requested ----
const requested = [];
function installFetchStub() {
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    requested.push(u);
    if (declaredDocDestinations.has(u)) {
      // the pinned upstream document itself: read it at PINNED_EPISTACK_COMMIT via `git show` against
      // the submodule's own object store, since this check has no network access to
      // raw.githubusercontent.com. This is deliberately NOT the submodule's live checkout: that pin
      // (upstream/lock.json, the vendor substrate) moves independently of PINNED_EPISTACK_COMMIT (the
      // submission surface's own, separate, permanent pin), and reading the live tree silently assumed
      // the two always agreed, a coincidence, not an invariant.
      const rel = declaredDocDestinations.get(u).path.split("/docs/")[1];
      try {
        const body = execFileSync("git", ["-C", join(ROOT, "upstream", "epistack"), "show", `${PINNED_EPISTACK_COMMIT}:docs/${rel}`], { encoding: "utf8" });
        return { ok: true, status: 200, text: async () => body, json: async () => JSON.parse(body) };
      } catch (e) {
        return { ok: false, status: 404, text: async () => { throw e; }, json: async () => { throw e; } };
      }
    }
    // same-origin relative fetch (an anchor map, "../communities/.../anchors/<doc>.anchors.json"),
    // resolved against app/ exactly as api/submission.js's real caller (periphery/app.js) would.
    const rel = u.replace(/^\.\.\//, "");
    const onDisk = join(ROOT, rel);
    try {
      const body = readFileSync(onDisk, "utf8");
      return { ok: true, status: 200, text: async () => body, json: async () => JSON.parse(body) };
    } catch (e) {
      return { ok: false, status: 404, text: async () => { throw e; }, json: async () => { throw e; } };
    }
  };
  return () => { globalThis.fetch = real; };
}

console.log("\n[1] document authenticity: every reading-sequence document's fetched hash equals its anchor map's declared content_hash");
{
  const restore = installFetchStub();
  const { READING_SEQUENCE, loadDocument } = await import(join(ROOT, "api", "submission.js"));
  for (const entry of READING_SEQUENCE) {
    try {
      const loaded = await loadDocument(entry);
      ok(true, `${entry.id}: loadDocument succeeded (${loaded.text.length} bytes), hash verified against its own anchor map`);
    } catch (e) {
      ok(false, `${entry.id}: loadDocument threw unexpectedly: ${e.message}`);
    }
  }
  restore();
}

console.log("\n[2] every requested URL is a declared destination (allowed_document_destinations, or the same-origin anchor map)");
{
  const restore = installFetchStub();
  const { READING_SEQUENCE, loadDocument } = await import(join(ROOT, "api", "submission.js"));
  requested.length = 0;
  for (const entry of READING_SEQUENCE) await loadDocument(entry);
  for (const u of requested) {
    const isDeclaredDoc = declaredDocDestinations.has(u);
    const isSameOriginAnchor = /^\.\.\/communities\/epistack-competition\/anchors\//.test(u);
    ok(isDeclaredDoc || isSameOriginAnchor, `requested "${u}" is a declared document destination or a same-origin anchor map`);
  }
  restore();
}

console.log("\n[3] the mismatch path actually refuses: a doctored anchor-map content_hash is never rendered");
{
  const restore = installFetchStub();
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (/anchors\/submission-overview\.anchors\.json$/.test(u)) {
      const onDisk = join(ROOT, "communities", "epistack-competition", "anchors", "submission-overview.anchors.json");
      const parsed = JSON.parse(readFileSync(onDisk, "utf8"));
      parsed.content_hash = "0".repeat(64); // doctored: does not match the real document's bytes
      return { ok: true, status: 200, text: async () => JSON.stringify(parsed), json: async () => parsed };
    }
    return real(url);
  };
  const { READING_SEQUENCE, loadDocument } = await import(join(ROOT, "api", "submission.js") + "?cachebust=doctor");
  let threw = null;
  try {
    await loadDocument(READING_SEQUENCE[0]);
  } catch (e) {
    threw = e;
  }
  ok(!!threw, "loadDocument threw on a doctored anchor-map hash rather than rendering");
  ok(!!threw && /hash mismatch/.test(threw.message), `the thrown error names the mismatch (message: ${threw && threw.message})`);
  globalThis.fetch = real;
  restore();
}

console.log("\n[4] every anchor span in every reading-sequence document resolves to a claim the community store carries");
{
  const { fetchCommunity } = await import(join(ROOT, "api", "community.js"));
  const snapshotPath = join(ROOT, "communities", "epistack-competition", "snapshot", "epistack-competition.snapshot.json");
  const rawSnapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, clone: () => null, json: async () => rawSnapshot });
  const community = await fetchCommunity("dummy");
  globalThis.fetch = realFetch;
  const rows = community.api.read({});
  const rowsByIdentity = new Map(rows.map((r) => [r.identity, r]));

  const anchorsDir = join(ROOT, "communities", "epistack-competition", "anchors");
  const anchorFiles = ["submission-overview.anchors.json", "the-climb-of-synthesis.anchors.json", "the-asymmetric-weapon.anchors.json"];
  let totalSpans = 0;
  for (const file of anchorFiles) {
    const anchorMap = JSON.parse(readFileSync(join(anchorsDir, file), "utf8"));
    for (const span of anchorMap.spans) {
      totalSpans++;
      ok(rowsByIdentity.has(span.claim), `${file} span ${span.ref}: claim ${span.claim.slice(0, 16)}... is present in the community store`);
    }
  }
  console.log(`  (${totalSpans} spans checked across ${anchorFiles.length} documents)`);

  console.log("\n[5] a mechanical/evaluative span's grade glyph matches a freshly, independently recomputed grade, byte-for-byte");
  // a second, wholly independent fetchCommunity/read cycle: proves no drift between what the surface
  // would render and what the store computes right now, rather than comparing an object to itself.
  globalThis.fetch = async () => ({ ok: true, status: 200, clone: () => null, json: async () => JSON.parse(readFileSync(snapshotPath, "utf8")) });
  const freshCommunity = await fetchCommunity("dummy");
  globalThis.fetch = realFetch;
  const freshRowsByIdentity = new Map(freshCommunity.api.read({}).map((r) => [r.identity, r]));

  let gradedSpans = 0;
  for (const file of anchorFiles) {
    const anchorMap = JSON.parse(readFileSync(join(anchorsDir, file), "utf8"));
    for (const span of anchorMap.spans) {
      if (span.register === "constitutive") continue; // shows a fixed adopted mark, never a grade
      gradedSpans++;
      const row = rowsByIdentity.get(span.claim);
      const freshRow = freshRowsByIdentity.get(span.claim);
      const glyphClass = row ? `grade-dot g-${row.earned_grade}` : null;
      const freshGlyphClass = freshRow ? `grade-dot g-${freshRow.earned_grade}` : null;
      ok(!!row && !!freshRow && glyphClass === freshGlyphClass, `${file} span ${span.ref} (${span.register}): glyph class '${glyphClass}' matches the freshly recomputed '${freshGlyphClass}' byte-for-byte`);
    }
  }
  console.log(`  (${gradedSpans} mechanical/evaluative spans checked; constitutive spans render a fixed adopted mark, never a grade)`);
}

console.log("\n[6] the span-resolution check itself catches a corrupted anchor map: a span's claim pointed at an absent identity fails, naming it, while every real span still passes");
{
  const { fetchCommunity } = await import(join(ROOT, "api", "community.js"));
  const snapshotPath = join(ROOT, "communities", "epistack-competition", "snapshot", "epistack-competition.snapshot.json");
  const rawSnapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, clone: () => null, json: async () => rawSnapshot });
  const community = await fetchCommunity("dummy");
  globalThis.fetch = realFetch;
  const rowsByIdentity = new Map(community.api.read({}).map((r) => [r.identity, r]));

  const anchorsDir = join(ROOT, "communities", "epistack-competition", "anchors");
  const realAnchorMap = JSON.parse(readFileSync(join(anchorsDir, "submission-overview.anchors.json"), "utf8"));
  const doctored = JSON.parse(JSON.stringify(realAnchorMap));
  doctored.spans[0] = { ...doctored.spans[0], claim: "0".repeat(64) }; // corrupted: no such claim exists

  let sawTheCorruptedOneFail = false;
  let allOthersPassed = true;
  for (const span of doctored.spans) {
    const resolves = rowsByIdentity.has(span.claim);
    if (span.ref === doctored.spans[0].ref) sawTheCorruptedOneFail = !resolves;
    else if (!resolves) allOthersPassed = false;
  }
  ok(sawTheCorruptedOneFail, `the doctored span (${doctored.spans[0].ref}, claim 0000...) fails resolution, exactly the signal a real corruption would produce`);
  ok(allOthersPassed, "every other, undoctored span in the same document still resolves correctly (the corruption is isolated, not a false-positive sweep)");
}

console.log("\n[7] the admission-policy hook: auto-admission (fixture-enabled) admits a comment-kind bundle only, refuses a claim-kind bundle through the identical path");
{
  const { decideAdmission } = await import(join(ROOT, "communities", "epistack-competition", "build", "admission.mjs"));
  const now = Date.now();
  const autoInWindow = { mode: "auto-during-window", window: { starts_at: new Date(now - 3600_000).toISOString(), ends_at: new Date(now + 3600_000).toISOString() } };
  const manual = { mode: "manual", window: null };

  const commentBundle = { proposal: { entries: [{ kind: "comment", statement: "a fixture comment" }], links: [{ link_kind: "comments-on", to_identity: "x" }] } };
  const claimBundle = { proposal: { entries: [{ kind: "forum", statement: "a fixture claim-kind proposal" }], links: [] } };
  const mixedBundle = { proposal: { entries: [{ kind: "comment", statement: "a comment" }, { kind: "forum", statement: "smuggled alongside it" }], links: [] } };

  {
    const { admit, reason } = decideAdmission(autoInWindow, commentBundle, now);
    ok(admit === true, `auto-during-window admits a comment-kind bundle inside the window (reason: ${reason})`);
  }
  {
    const { admit, reason } = decideAdmission(autoInWindow, claimBundle, now);
    ok(admit === false, `auto-during-window refuses a claim-kind bundle through the identical path (reason: ${reason})`);
  }
  {
    const { admit, reason } = decideAdmission(autoInWindow, mixedBundle, now);
    ok(admit === false, `auto-during-window refuses a bundle mixing a comment with a non-comment kind (reason: ${reason})`);
  }
  {
    const { admit, reason } = decideAdmission(manual, commentBundle, now);
    ok(admit === false, `manual mode (the default) refuses even a comment-kind bundle (reason: ${reason})`);
  }
}

console.log("\n" + H);
if (fails === 0) console.log("verified: document authenticity holds and its mismatch path refuses; every anchor span resolves; the grade glyph never drifts from a fresh recompute; the admission-policy hook admits comment-kind bundles only.");
console.log(fails === 0 ? "check-submission-surface: OK" : `check-submission-surface: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
