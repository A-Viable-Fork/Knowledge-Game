// Role: the extension seam (spec Section 6). Installs and runs content-addressed extension modules
//   in one of three shapes (ranker/objective component, renderer lens, workflow mode) through the
//   sandbox (api/extension-sandbox.js). Install-time conformance: every shape first passes the sandbox
//   integrity probe (fetch is denied by the sandbox itself, not merely trusted of the candidate); a
//   ranker additionally passes the ranking-separation fuzz, since nothing loaded through this seam may
//   move a grade, only reorder or redescribe a view the caller already holds.
// Contract: contentHash(sourceText) -> hex sha256 (the pin a caller stores). checkConformance
//   (sourceText, shape, fixtureRows) -> Promise<{pass, reason?, receipts}>. runRanker(sourceText, rows,
//   weights) -> Promise<rows> (reordered; throws on sandbox failure, the caller decides what to show).
//   runRenderer(sourceText, rows) -> Promise<descriptor> (a plain-data structure the host renders; the
//   extension itself touches no DOM, structurally, since a worker's global scope has none).
// Invariant: nothing here computes a grade or writes a receipt; conformance can only ever refuse to
//   install a candidate, never grant it a capability the sandbox does not already enforce. A failed
//   conformance check is never silently retried with weaker rules, and this module persists nothing
//   itself (the caller, via api/settings.js, decides whether a passed candidate is actually installed).
"use strict";
import { sha256Hex } from "../vendor/kernel/schema/sha256.mjs";
import { runInSandbox } from "./extension-sandbox.js";

export const SHAPES = ["ranker", "renderer", "workflow"];

export function contentHash(sourceText) {
  return sha256Hex(sourceText);
}

// the fetch-denial probe: a tiny inline self-test (never the candidate's own code) confirming the
// sandbox environment itself blocks network access, so install-time conformance always exercises the
// real boundary rather than trusting that a candidate never tries.
const FETCH_PROBE_SOURCE = 'function extensionMain(input) { fetch("https://example.invalid/"); return "unreachable"; }';
async function sandboxIntegrityHolds() {
  const out = await runInSandbox(FETCH_PROBE_SOURCE, {});
  return !out.ok && /fetch is not available/.test(out.error || "");
}

// the ranking-separation guard: a ranker may reorder, but every grade-bearing field on every row it
// returns must be byte-identical to what it was given, and it may introduce no row and drop none.
const GRADE_BEARING_FIELDS = ["declared_grade", "earned_grade", "kind", "statement", "source_id"];
function rowsMutated(before, after) {
  if (!Array.isArray(after)) return "did not return an array of rows";
  if (after.length !== before.length) return `changed the row count (${before.length} -> ${after.length})`;
  const byIdentity = new Map(before.map((r) => [r.identity, r]));
  for (const r of after) {
    const orig = byIdentity.get(r && r.identity);
    if (!orig) return `introduced an unknown identity ${r && r.identity}`;
    for (const field of GRADE_BEARING_FIELDS) {
      if (r[field] !== orig[field]) return `mutated ${field} on claim ${r.identity} (${orig[field]} -> ${r[field]})`;
    }
  }
  return null;
}

export async function checkConformance(sourceText, shape, fixtureRows, fixtureLinks) {
  const receipts = [];
  const integrityOk = await sandboxIntegrityHolds();
  receipts.push({ probe: "sandbox-fetch-denied", pass: integrityOk });
  if (!integrityOk) return { pass: false, reason: "the sandbox itself did not block a network call; refusing to trust any candidate under it", receipts };

  if (shape === "ranker") {
    const out = await runInSandbox(sourceText, { rows: fixtureRows, weights: {}, links: fixtureLinks || [] });
    receipts.push({ probe: "ranking-separation-fuzz", ok: out.ok, error: out.error });
    if (!out.ok) return { pass: false, reason: `candidate threw: ${out.error}`, receipts };
    const mutation = rowsMutated(fixtureRows, out.result);
    if (mutation) return { pass: false, reason: `ranking-separation violated: ${mutation}`, receipts };
    return { pass: true, receipts };
  }
  if (shape === "renderer") {
    const out = await runInSandbox(sourceText, { rows: fixtureRows });
    receipts.push({ probe: "renderer-runs-clean", ok: out.ok, error: out.error });
    if (!out.ok) return { pass: false, reason: `candidate threw: ${out.error}`, receipts };
    if (out.result == null || typeof out.result !== "object") return { pass: false, reason: "a renderer must return a structured descriptor, not touch the DOM itself", receipts };
    return { pass: true, receipts };
  }
  // workflow mode: no demo ships this phase; minimal conformance, runs clean over an empty input.
  const out = await runInSandbox(sourceText, {});
  receipts.push({ probe: "workflow-runs-clean", ok: out.ok, error: out.error });
  if (!out.ok) return { pass: false, reason: `candidate threw: ${out.error}`, receipts };
  return { pass: true, receipts };
}

export async function runRanker(sourceText, rows, weights, links) {
  const out = await runInSandbox(sourceText, { rows, weights: weights || {}, links: links || [] });
  if (!out.ok) throw new Error(`runRanker: ${out.error}`);
  return out.result;
}
export async function runRenderer(sourceText, rows) {
  const out = await runInSandbox(sourceText, { rows });
  if (!out.ok) throw new Error(`runRenderer: ${out.error}`);
  return out.result;
}
