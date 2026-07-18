// Role: the submission reading surface's data layer (Phase KG-11, spec dependency: the submission-
//   decomposition bundles merged into epistack-competition, KG-11 Step 0). Fetches each document in
//   the reading sequence from the pinned upstream commit, verifies its content against the anchor
//   map's own recorded content_hash before anything renders it, and refuses rather than warns on a
//   mismatch. Also builds the cross-document index (which document, if any, anchors a given claim
//   identity) so a claim card can offer a walkable link into another document's own anchor.
// Contract: READING_SEQUENCE: [{id, label, documentPath, anchorPath}], the three documents in
//   reading order. loadDocument(entry) -> Promise<{text, anchorMap, documentUrl}>, throws on a fetch
//   failure or a hash mismatch, naming the mismatch. buildCrossDocumentIndex(anchorMapsById) ->
//   Map<claimIdentity, [{docId, spanRef}]>, every document (and span) a claim identity is anchored
//   in, across the whole sequence (a claim anchored in more than one document, like a shared
//   vocabulary definition re-anchored where it is used, carries every one). PINNED_EPISTACK_COMMIT
//   is exported so build/check-submission-surface.mjs's fetch stub reads the same pinned commit
//   this module fetches from, rather than whatever commit the vendor-substrate submodule (a
//   separate pin, upstream/lock.json) happens to be checked out to at test time.
// Invariant: the document fetch's one destination is manifests/network.json's own declared entry
//   per document (exact URL, no wildcard); the anchor map fetch is same-origin, already inside this
//   deployment's own served tree, no new destination. A document whose fetched hashBytes does not
//   equal its anchor map's content_hash is never rendered, structurally: loadDocument throws before
//   returning anything a caller could render.
// Governs: this deployment's own document-authenticity guarantee for the submission surface,
//   checked by build/check-submission-surface.mjs (fetched hash equals anchor map hash; the mismatch
//   path actually refuses).
"use strict";
import { hashBytes } from "../vendor/kernel/schema/canonical.mjs";

export const PINNED_EPISTACK_COMMIT = "b97c2ad178bce92c81b180cd13bcbcfc6ce2f83b";
const DOCUMENT_BASE_URL = `https://raw.githubusercontent.com/A-Viable-Fork/epistack/${PINNED_EPISTACK_COMMIT}/`;

export const READING_SEQUENCE = [
  {
    id: "submission-overview", label: "Overview", documentPath: "docs/submission-overview.md",
    anchorPath: "../communities/epistack-competition/anchors/submission-overview.anchors.json",
  },
  {
    id: "the-climb-of-synthesis", label: "The Climb", documentPath: "docs/the-climb-of-synthesis.md",
    anchorPath: "../communities/epistack-competition/anchors/the-climb-of-synthesis.anchors.json",
  },
  {
    id: "the-asymmetric-weapon", label: "The Seam", documentPath: "docs/the-asymmetric-weapon.md",
    anchorPath: "../communities/epistack-competition/anchors/the-asymmetric-weapon.anchors.json",
  },
];

export async function loadDocument(entry) {
  const anchorRes = await fetch(entry.anchorPath);
  if (!anchorRes.ok) throw new Error(`loadDocument: ${entry.anchorPath} responded ${anchorRes.status}`);
  const anchorMap = await anchorRes.json();

  const documentUrl = DOCUMENT_BASE_URL + entry.documentPath;
  const docRes = await fetch(documentUrl);
  if (!docRes.ok) throw new Error(`loadDocument: ${documentUrl} responded ${docRes.status}`);
  const text = await docRes.text();
  const computedHash = hashBytes(text);
  if (computedHash !== anchorMap.content_hash) {
    throw new Error(`loadDocument: ${entry.documentPath} hash mismatch (declared ${anchorMap.content_hash}, fetched ${computedHash}); refusing to render`);
  }
  return { text, anchorMap, documentUrl };
}

// fetches just the anchor maps (same-origin, already inside this deployment's served tree, no
// document-authenticity check needed) for every document in the reading sequence, so a caller can
// build the cross-document index before any document text is fetched.
export async function loadAllAnchorMaps() {
  const out = {};
  for (const entry of READING_SEQUENCE) {
    const res = await fetch(entry.anchorPath);
    if (!res.ok) throw new Error(`loadAllAnchorMaps: ${entry.anchorPath} responded ${res.status}`);
    out[entry.id] = await res.json();
  }
  return out;
}

export function buildCrossDocumentIndex(anchorMapsById) {
  const index = new Map();
  for (const [docId, anchorMap] of Object.entries(anchorMapsById)) {
    for (const span of anchorMap.spans) {
      if (!index.has(span.claim)) index.set(span.claim, []);
      index.get(span.claim).push({ docId, spanRef: span.ref });
    }
  }
  return index;
}
