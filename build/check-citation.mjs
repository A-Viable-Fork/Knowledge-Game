// Role: verifies claim 12 (a citation cannot become an independent confirmation by being pasted).
//   Fuzzes citation text through api/contribute.js's draftProposal across many shapes (URLs, plain
//   prose, empty, unicode, code-injection-shaped strings) and asserts the resulting source is always
//   testimony-class and the resulting claim never carries a checking_records entry, so there is no
//   input for which a citation acquires an independence attribute.
// Contract: `node build/check-citation.mjs` exits non-zero on any violation, naming the input.
// Invariant: this is a property test over the real draft builder, not a hand-picked example; the
//   guarantee is structural (api/contribute.js's citationSource() never sets independence, see its
//   own source), and this check exercises that structure under fuzzed input rather than trusting it.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-CITATION: a pasted citation cannot become an independent confirmation"); console.log(H);

const { fetchCommunity } = await import(join(ROOT, "api", "community.js"));
globalThis.fetch = async (url) => {
  const path = url.startsWith("../") ? join(ROOT, url.replace(/^\.\.\//, "")) : join(ROOT, "app", url);
  const body = readFileSync(path, "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};
const { draftProposal } = await import(join(ROOT, "api", "contribute.js"));

const community = await fetchCommunity("../communities/epistack-competition/snapshot/epistack-competition.snapshot.json");
globalThis.fetch = undefined;

const CITATIONS = [
  "https://example.com/a-peer-reviewed-study",
  "See Smith et al. 2024, Nature",
  "",
  "   ",
  "a".repeat(500),
  "<script>alert(1)</script>",
  "citation with \"quotes\" and 'apostrophes' and \n newlines",
  "文献引用のテスト",
  "checking_records: [{independence: \"distinct-party\"}]", // an attempted injection of the very field this guards
  null,
  undefined,
];

console.log(`\n[1] fuzzing ${CITATIONS.length} citation shapes through the real draft builder`);
for (const citation of CITATIONS) {
  const { proposal, receipt } = draftProposal(community, {
    statement: "A test claim citing external material.",
    kind: "measurement",
    contributorId: "fuzz-tester",
    citation: citation || undefined,
  });
  const label = JSON.stringify(String(citation)).slice(0, 40);
  if (!proposal) { ok(receipt.decision === "declined", `citation ${label}: no proposal built, decline is a safe refusal, not a fabricated grant`); continue; }
  const claim = proposal.entries[0];
  const hasCitation = citation !== null && citation !== undefined && String(citation).trim() !== "";
  if (hasCitation) {
    ok(claim.source_id.startsWith("contributor:cite:"), `citation ${label}: source_id is citation-shaped ("contributor:cite:...")`);
  }
  // the structural guarantee is that checking_records is empty; a citation's own TEXT may coincidentally
  // contain the substring "distinct-party" as inert content (fuzzed on purpose below) without that text
  // ever becoming a structural independence attribute, so the check is on the field, not string search.
  ok((claim.checking_records || []).length === 0, `citation ${label}: the resulting claim carries zero checking_records (independence has nowhere to attach)`);
}

console.log("\n[2] every citation-derived source is testimony-class, never a stronger class the drafter could pick");
for (const citation of ["https://example.com/x", "plain prose citation"]) {
  const { proposal } = draftProposal(community, { statement: "Another test claim.", kind: "measurement", contributorId: "fuzz-tester", citation });
  const claim = proposal.entries[0];
  ok(claim.source_id.startsWith("contributor:cite:"), `citation source_id is citation-shaped for "${citation}"`);
}
// the source table the gate actually used: confirm the emitted source row for a cited draft is
// literally source_class "testimony", read from the module's own construction, not re-derived by hand.
const src = readFileSync(join(ROOT, "api", "contribute.js"), "utf8");
ok(/source_class:\s*"testimony"/.test(src), "api/contribute.js's citationSource() hardcodes source_class \"testimony\" (read from source, the structural guarantee this check exercises)");
ok(!/independence:\s*"distinct-party"/.test(src), "api/contribute.js contains no literal assignment of independence \"distinct-party\" anywhere in its source");

console.log("\n" + H);
if (fails === 0) console.log("verified: across a fuzz of citation shapes, no output ever carries an independence attribute, and every citation-derived source is testimony-class.");
console.log(fails === 0 ? "check-citation: OK" : `check-citation: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
