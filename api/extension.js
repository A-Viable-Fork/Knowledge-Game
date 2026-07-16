// Role: the extension seam (spec Section 6). Installs and runs content-addressed extension modules
//   in one of three shapes (ranker/objective component, renderer lens, workflow mode) through the
//   sandbox (api/extension-sandbox.js). Install-time conformance: every shape first passes the sandbox
//   integrity probe (fetch is denied by the sandbox itself, not merely trusted of the candidate); a
//   ranker additionally passes the ranking-separation fuzz, since nothing loaded through this seam may
//   move a grade, only reorder or redescribe a view the caller already holds. Phase KG-9: network
//   access is capability-scoped. A candidate may declare exact network destinations (no wildcards);
//   conformance validates the declaration itself (every entry an absolute URL, none a wildcard) before
//   ever running the candidate, and every actual run (conformance or later use) threads the declared
//   list through to the sandbox, which is the sole enforcement point (this module never re-implements
//   the check, only refuses to install on a malformed declaration).
// Contract: contentHash(sourceText) -> hex sha256 (the pin a caller stores). validateDestinations
//   (declaredDestinations) -> string|null (a reason, or null if the list is well-formed). checkConformance
//   (sourceText, shape, fixtureRows, fixtureLinks?, declaredDestinations?) -> Promise<{pass, reason?,
//   receipts}>. runRanker(sourceText, rows, weights, links?, declaredDestinations?) -> Promise<rows>
//   (reordered; throws on sandbox failure, the caller decides what to show). runRenderer(sourceText,
//   rows, declaredDestinations?) -> Promise<descriptor> (a plain-data structure the host renders; the
//   extension itself touches no DOM, structurally, since a worker's global scope has none). runWorkflow
//   (sourceText, input, declaredDestinations?) -> Promise<result> (the workflow shape's own entry
//   point; the assistant extension is this shape).
// Invariant: nothing here computes a grade or writes a receipt; conformance can only ever refuse to
//   install a candidate, never grant it a capability the sandbox does not already enforce. A failed
//   conformance check is never silently retried with weaker rules, and this module persists nothing
//   itself (the caller, via api/settings.js, decides whether a passed candidate is actually installed).
//   declaredDestinations always defaults to the empty array; a candidate never receives network access
//   it was not explicitly given by its own caller-supplied declaration.
// Governs: claim-20: checkConformance's ranking-separation fuzz refuses install to any candidate that
//   mutates a grade-bearing field, drops a row, or introduces an unknown identity, and
//   build/check-extension-seam.mjs proves this by naming the violation on a mutating candidate; as of
//   Phase KG-9, the same claim also grounds that a candidate reaches at most its own exactly-declared
//   destinations and nothing else, proven by build/check-extension-seam.mjs's egress section and
//   build/check-assistant.mjs against the shipped assistant extension specifically.
"use strict";
import { sha256Hex } from "../vendor/kernel/schema/sha256.mjs";
import { runInSandbox } from "./extension-sandbox.js";

export const SHAPES = ["ranker", "renderer", "workflow"];

export function contentHash(sourceText) {
  return sha256Hex(sourceText);
}

// a declared destination is an exact absolute URL string; no wildcard character, no prefix match, no
// host-only match. Named here once so checkConformance can refuse a malformed declaration before ever
// starting the sandbox, and so the install-consent surface (periphery/extension-screen.js) can reuse
// the identical rule rather than a parallel, possibly looser, one.
export function validateDestinations(declaredDestinations) {
  const list = declaredDestinations || [];
  if (!Array.isArray(list)) return "declared destinations must be an array";
  for (const d of list) {
    if (typeof d !== "string" || !d.length) return `a declared destination must be a non-empty string (got ${JSON.stringify(d)})`;
    if (d.includes("*")) return `a declared destination may not contain a wildcard: ${d}`;
    try {
      new URL(d);
    } catch (e) {
      return `a declared destination must be an absolute URL: ${d}`;
    }
  }
  return null;
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

export async function checkConformance(sourceText, shape, fixtureRows, fixtureLinks, declaredDestinations) {
  const destinations = declaredDestinations || [];
  const receipts = [];

  const badDestination = validateDestinations(destinations);
  receipts.push({ probe: "declared-destinations", destinations, valid: !badDestination });
  if (badDestination) return { pass: false, reason: badDestination, receipts };

  // the baseline probe always runs with zero destinations: it proves the sandbox environment itself
  // denies network access by default, independent of whatever this specific candidate declares.
  const integrityOk = await sandboxIntegrityHolds();
  receipts.push({ probe: "sandbox-fetch-denied", pass: integrityOk });
  if (!integrityOk) return { pass: false, reason: "the sandbox itself did not block a network call; refusing to trust any candidate under it", receipts };

  if (shape === "ranker") {
    const out = await runInSandbox(sourceText, { rows: fixtureRows, weights: {}, links: fixtureLinks || [] }, { declaredDestinations: destinations });
    receipts.push({ probe: "ranking-separation-fuzz", ok: out.ok, error: out.error });
    if (!out.ok) return { pass: false, reason: `candidate threw: ${out.error}`, receipts };
    const mutation = rowsMutated(fixtureRows, out.result);
    if (mutation) return { pass: false, reason: `ranking-separation violated: ${mutation}`, receipts };
    return { pass: true, receipts };
  }
  if (shape === "renderer") {
    const out = await runInSandbox(sourceText, { rows: fixtureRows }, { declaredDestinations: destinations });
    receipts.push({ probe: "renderer-runs-clean", ok: out.ok, error: out.error });
    if (!out.ok) return { pass: false, reason: `candidate threw: ${out.error}`, receipts };
    if (out.result == null || typeof out.result !== "object") return { pass: false, reason: "a renderer must return a structured descriptor, not touch the DOM itself", receipts };
    return { pass: true, receipts };
  }
  // workflow mode: minimal conformance, runs clean over an empty (task-less) input. A well-behaved
  // workflow candidate (the assistant included) declines to act, and so attempts no network call at
  // all, on an input carrying no real task; this probe is exactly that empty input, so a workflow
  // candidate that behaves honestly at rest always passes it regardless of what it declares.
  const out = await runInSandbox(sourceText, {}, { declaredDestinations: destinations, timeoutMs: 5000 });
  receipts.push({ probe: "workflow-runs-clean", ok: out.ok, error: out.error });
  if (!out.ok) return { pass: false, reason: `candidate threw: ${out.error}`, receipts };
  return { pass: true, receipts };
}

export async function runRanker(sourceText, rows, weights, links, declaredDestinations) {
  const out = await runInSandbox(sourceText, { rows, weights: weights || {}, links: links || [] }, { declaredDestinations: declaredDestinations || [] });
  if (!out.ok) throw new Error(`runRanker: ${out.error}`);
  return out.result;
}
export async function runRenderer(sourceText, rows, declaredDestinations) {
  const out = await runInSandbox(sourceText, { rows }, { declaredDestinations: declaredDestinations || [] });
  if (!out.ok) throw new Error(`runRenderer: ${out.error}`);
  return out.result;
}
// the workflow shape's own entry point (the assistant extension is this shape): a plain-data input in,
// a plain-data result out, exactly the ranker/renderer discipline, generalized to a task this seam does
// not otherwise interpret. A longer default timeout than the other two shapes, since a workflow
// candidate's one declared destination is typically a network round trip to an inference endpoint,
// not a pure in-memory computation.
export async function runWorkflow(sourceText, input, declaredDestinations, timeoutMs) {
  const out = await runInSandbox(sourceText, input, { declaredDestinations: declaredDestinations || [], timeoutMs: timeoutMs || 30000 });
  if (!out.ok) throw new Error(`runWorkflow: ${out.error}`);
  return out.result;
}
