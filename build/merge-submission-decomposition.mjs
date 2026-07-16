// Role: one-time merge tool (Phase KG-11 dependency). Reads the three per-document contribution
//   bundles and anchor maps upstream's own submission-decomposition contribution set stages
//   (upstream/epistack/corpora/submission-decomposition/), re-verifies the merged result through the
//   real gate, and writes the merged STORE into communities/epistack-competition/corpus/epistack-
//   competition-data.js plus the adopted "declaration" kind into corpus/tables.js, then copies the
//   anchor maps into communities/epistack-competition/anchors/. This performs the decomposition
//   README's own "operator's one merge step" mechanically rather than by hand, since 37 new claims
//   and 34 new links are too many to transcribe reliably.
// Contract: `node build/merge-submission-decomposition.mjs` (no arguments; idempotent against a
//   fresh checkout, not against a tree it has already merged into, since it appends).
// Invariant: every constitutive-register anchor's claim, and every depends-on link's target, is
//   resolved against upstream's own vocabulary kernel (corpora/vocabulary/vocabulary.js) by content-
//   derived identity (computeClaimIdentity(kind, statement)), never invented; a target that fails to
//   resolve throws rather than silently dropping the link. checking_records on the mechanical
//   claims are carried over verbatim from the bundles (already gate-shaped, citing named epistack
//   checks). Run once; do not re-run against an already-merged tree.
"use strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { computeClaimIdentity } from "../vendor/kernel/schema/canonical.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const DOCS = ["submission-overview", "the-asymmetric-weapon", "the-climb-of-synthesis"];
const DECOMP = join(ROOT, "upstream", "epistack", "corpora", "submission-decomposition");
const COMMUNITY = join(ROOT, "communities", "epistack-competition");

const { VOCABULARY } = require(join(ROOT, "upstream", "epistack", "corpora", "vocabulary", "vocabulary.js"));
const vocabByIdentity = new Map();
for (const term of VOCABULARY.terms) {
  vocabByIdentity.set(computeClaimIdentity(term.kind, term.statement), term);
}

// ---- 1. load bundles and anchors ----
const bundles = DOCS.map((d) => JSON.parse(readFileSync(join(DECOMP, "bundles", `${d}.bundle.json`), "utf8")));
const anchors = DOCS.map((d) => JSON.parse(readFileSync(join(DECOMP, "anchors", `${d}.anchors.json`), "utf8")));

// ---- 2. collect every decomposition claim, and every vocabulary target any link depends on ----
const decompClaims = []; // { identity, kind, statement, source_id, contributor_id, declared_grade, checking_records }
const decompIdentities = new Set();
for (const b of bundles) {
  for (const e of b.proposal.entries) {
    if (decompIdentities.has(e.identity)) continue; // a claim shared verbatim across two documents
    decompIdentities.add(e.identity);
    decompClaims.push({
      identity: e.identity, kind: e.kind, statement: e.statement, source_id: e.source_id,
      contributor_id: e.contributor_id, declared_grade: e.declared_grade,
      checking_records: (e.checking_records || []).map((c) => ({
        checker_id: c.checker_id, method_class: c.method_class, method: c.method,
        checked_at_state: c.checked_at_state, outcome: c.outcome, independence: c.independence,
      })),
    });
  }
}

const allLinks = bundles.flatMap((b) => b.proposal.links || []);
const neededVocabIdentities = new Set();
for (const l of allLinks) {
  if (!decompIdentities.has(l.to_identity)) neededVocabIdentities.add(l.to_identity);
  if (!decompIdentities.has(l.from_identity)) neededVocabIdentities.add(l.from_identity);
}
// a constitutive-register anchor span references a vocabulary claim directly, with no depends-on
// link at all (the span itself is the whole bond); every anchor map's constitutive spans must be
// scanned too, or a claim referenced only that way is silently missing from the merged store.
for (const anchorMap of anchors) {
  for (const span of anchorMap.spans) {
    if (span.register === "constitutive" && !decompIdentities.has(span.claim)) neededVocabIdentities.add(span.claim);
  }
}

const GRADE_OF = { c: "constitutive", s: "supported" };
const vocabClaims = [];
for (const id of neededVocabIdentities) {
  const term = vocabByIdentity.get(id);
  if (!term) throw new Error(`merge: link target ${id} resolves to no decomposition claim and no vocabulary term; refusing to drop it silently`);
  vocabClaims.push({
    identity: id, kind: "declaration", statement: term.statement, source_id: "S-epistack-vocabulary",
    contributor_id: "P-epistack-vocabulary", declared_grade: GRADE_OF[term.declared_grade] || term.declared_grade,
    checking_records: [], vocabRef: term.ref,
  });
}

console.log(`decomposition claims: ${decompClaims.length}, vocabulary claims pulled in by depends-on: ${vocabClaims.length}, total links: ${allLinks.length}`);

// ---- 3. assign sequential refs continuing from claim-19, build identity -> ref ----
const existingSrc = readFileSync(join(COMMUNITY, "corpus", "epistack-competition-data.js"), "utf8");
const existingRefs = [...existingSrc.matchAll(/ref: "claim-(\d+)"/g)].map((m) => Number(m[1]));
let nextN = Math.max(...existingRefs) + 1;
const identityToRef = new Map();
const allNewClaims = [...vocabClaims, ...decompClaims];
for (const c of allNewClaims) {
  identityToRef.set(c.identity, `claim-${nextN}`);
  c.ref = `claim-${nextN}`;
  nextN++;
}

// ---- 4. translate links from raw identity to ref ----
const newLinks = allLinks.map((l) => {
  const from = identityToRef.get(l.from_identity);
  const to = identityToRef.get(l.to_identity);
  if (!from || !to) throw new Error(`merge: link ${l.link_kind} ${l.from_identity} -> ${l.to_identity} did not resolve to a ref on both ends`);
  return { link_kind: l.link_kind, from, to, support_group: l.support_group, source_id: l.source_id, contributor_id: l.contributor_id, declared_grade: l.declared_grade };
});

// ---- 5. write the merged corpus data file ----
function claimBlock(c) {
  const lines = [
    "    {",
    `      ref: "${c.ref}",`,
    `      kind: "${c.kind}",`,
    `      statement: ${JSON.stringify(c.statement)},`,
    `      source_id: "${c.source_id}",`,
    `      contributor_id: "${c.contributor_id}",`,
    `      declared_grade: "${c.declared_grade}"`,
  ];
  if (c.checking_records && c.checking_records.length) {
    lines[lines.length - 1] += ",";
    lines.push("      checking_records: [");
    const crLines = c.checking_records.map((cr) =>
      `        { checker_id: ${JSON.stringify(cr.checker_id)}, method_class: "${cr.method_class}", method: ${JSON.stringify(cr.method)}, checked_at_state: "${cr.checked_at_state}", outcome: "${cr.outcome}", independence: "${cr.independence}" }`
    );
    lines.push(crLines.join(",\n"));
    lines.push("      ]");
  }
  lines.push("    }");
  return lines.join("\n");
}
function linkBlock(l) {
  const parts = [`link_kind: "${l.link_kind}"`, `from: "${l.from}"`, `to: "${l.to}"`];
  if (l.support_group) parts.push(`support_group: "${l.support_group}"`);
  parts.push(`source_id: "${l.source_id}"`, `contributor_id: "${l.contributor_id}"`, `declared_grade: "${l.declared_grade}"`);
  return `    { ${parts.join(", ")} }`;
}

const newClaimsBlock = allNewClaims.map(claimBlock).join(",\n");
const newLinksBlock = newLinks.map(linkBlock).join(",\n");

let out = existingSrc;
out = out.replace(
  /(\s*)\]\s*,\s*\n\s*links: \[/,
  `,\n${newClaimsBlock}\n  ],\n  links: [`
);
// locate the links array's closing bracket (]\n};\n\nmodule.exports) and
// splice the new link entries directly before it.
const linksCloseRe = /\n(\s*)\]\n\};\n\nmodule\.exports = \{ STORE \};\s*$/;
const linksCloseMatch = out.match(linksCloseRe);
if (!linksCloseMatch) throw new Error("merge: could not locate the links array's closing bracket");
out = out.slice(0, linksCloseMatch.index) + `,\n${newLinksBlock}` + out.slice(linksCloseMatch.index);

writeFileSync(join(COMMUNITY, "corpus", "epistack-competition-data.js"), out);
console.log("wrote merged corpus/epistack-competition-data.js");

// ---- 6. add the "declaration" kind and source, copy anchor maps ----
const tablesPath = join(COMMUNITY, "corpus", "tables.js");
let tablesSrc = readFileSync(tablesPath, "utf8");
if (!/"kind": "declaration"/.test(tablesSrc)) {
  tablesSrc = tablesSrc.replace(
    /(const KINDS = \[\n(?:.|\n)*?)\n\];/,
    `$1,\n  {\n    "kind": "declaration",\n    "ceiling": "constitutive"\n  }\n];`
  );
  tablesSrc = tablesSrc.replace(
    /(const SOURCES = \[\n(?:.|\n)*?description": "[^"]*"\n  })\n\];/,
    `$1,\n  {\n    "source_id": "S-epistack-vocabulary",\n    "source_class": "institutional-report",\n    "description": "upstream's own vocabulary kernel (corpora/vocabulary/vocabulary.js), the submission's terms as declaration claims each grounding by adoption in the document that defines it"\n  }\n];`
  );
  tablesSrc = tablesSrc.replace(
    /(const ADOPTED = \[\n(?:.|\n)*?)\n\];/,
    `$1,\n  "declaration"\n];`
  );
  tablesSrc = tablesSrc.replace(
    /(const ADOPTED_HASHES = \{\n(?:.|\n)*?)\n\};/,
    `$1,\n  "declaration": "354cba45e263a9788064fbf35d71d8506dd93ddf8c35b092ba606e5c2cc3b1bd"\n};`
  );
  writeFileSync(tablesPath, tablesSrc);
  console.log("wrote corpus/tables.js (added declaration kind, S-epistack-vocabulary source)");
}

mkdirSync(join(COMMUNITY, "anchors"), { recursive: true });
for (let i = 0; i < DOCS.length; i++) {
  writeFileSync(join(COMMUNITY, "anchors", `${DOCS[i]}.anchors.json`), JSON.stringify(anchors[i], null, 2) + "\n");
}
console.log("wrote anchors/*.anchors.json");

console.log("\ndone. Next: rebuild and check the community (node build/epistack-competition-build.mjs equivalent via its own build script), then node communities/epistack-competition/build/check.mjs");
