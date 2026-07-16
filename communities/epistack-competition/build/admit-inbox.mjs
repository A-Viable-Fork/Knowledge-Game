// Role: this community's own inbox sweep (Phase KG-11 Step 4), the actual enforcement point .github/
//   workflows/admit-comments.yml runs on a schedule: reads every bundle staged in inbox/, decides
//   admission via admission.mjs's decideAdmission against founding-config.json's current policy and
//   the real clock, and for each admitted bundle, merges its one comment claim (and its one
//   comments-on/replies-to link) into corpus/epistack-competition-data.js, then regenerates the
//   snapshot once at the end, and moves the bundle into contributions/ as admitted. A bundle not
//   admitted is left untouched in inbox/, exactly where every other kind already waits on the
//   maintainers' own pull-request review.
// Contract: `node admit-inbox.mjs` (run with cwd anywhere; paths are resolved relative to this file).
//   No arguments. Idempotent: a bundle already moved to contributions/ is no longer in inbox/, so a
//   re-run only ever processes what is still staged. Exits 0 whether or not anything was admitted;
//   prints one line per inbox entry naming the decision and reason.
// Invariant: only decideAdmission may authorize a merge; this script never admits a bundle
//   decideAdmission declined. A comment's comments-on/replies-to target must already resolve to an
//   existing claim's identity in the built kernel, or the bundle is refused (never merged pointing at
//   nothing). Identity resolution and snapshot regeneration each run in a fresh child node process
//   (print-identity-refs.mjs, regenerate-snapshot.mjs) rather than importing the build module
//   in-process, because Node's require(esm) path epistack-competition-build.mjs loads under does not
//   release its cache on a plain require.cache delete: a second in-process call after editing the
//   corpus would silently see the pre-edit data, merging a comment's link against a stale ref map or
//   publishing a stale snapshot. This script never touches anything outside communities/epistack-
//   competition/ (this community's own stated self-containment discipline): manifests/network.json's
//   cached description of this community may lag one cycle after an automatic admission changes the
//   snapshot hash, exactly as it already does after every other change to this community, refreshed
//   at the next manual phase.
"use strict";
import { readFileSync, writeFileSync, readdirSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { decideAdmission } from "./admission.mjs";

const HOME = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUILD_DIR = join(HOME, "build");
const INBOX = join(HOME, "inbox");
const CONTRIBUTIONS = join(HOME, "contributions");
mkdirSync(INBOX, { recursive: true });
mkdirSync(CONTRIBUTIONS, { recursive: true });

function loadPolicy() {
  const config = JSON.parse(readFileSync(join(HOME, "founding-config.json"), "utf8"));
  return (config.admission_policy && config.admission_policy.comment_admission) || { mode: "manual", window: null };
}

function currentIdentityToRef() {
  const out = execFileSync("node", [join(BUILD_DIR, "print-identity-refs.mjs")], { encoding: "utf8" });
  return new Map(Object.entries(JSON.parse(out)));
}

function claimBlock(ref, kind, statement, source_id, contributor_id, declared_grade) {
  return [
    "    {",
    `      ref: "${ref}",`,
    `      kind: "${kind}",`,
    `      statement: ${JSON.stringify(statement)},`,
    `      source_id: "${source_id}",`,
    `      contributor_id: "${contributor_id}",`,
    `      declared_grade: "${declared_grade}"`,
    "    }",
  ].join("\n");
}
function linkBlock(link_kind, from, to, source_id, contributor_id, declared_grade) {
  return `    { link_kind: "${link_kind}", from: "${from}", to: "${to}", source_id: "${source_id}", contributor_id: "${contributor_id}", declared_grade: "${declared_grade}" }`;
}

// merges one admitted comment bundle's claim and link into the corpus data file on disk.
// identityToRef must reflect the corpus as it stands BEFORE this call (fresh per bundle, since an
// earlier bundle admitted in this same sweep is now on disk but not yet in any previously-taken map).
function mergeCommentIntoCorpus(bundle, identityToRef) {
  const dataPath = join(HOME, "corpus", "epistack-competition-data.js");
  const src = readFileSync(dataPath, "utf8");
  const existingRefs = [...src.matchAll(/ref: "claim-(\d+)"/g)].map((m) => Number(m[1]));
  const nextN = Math.max(...existingRefs) + 1;
  const ref = `claim-${nextN}`;

  const commentEntry = bundle.proposal.entries[0];
  const link = (bundle.proposal.links || [])[0];
  if (!link) throw new Error("mergeCommentIntoCorpus: bundle carries no comments-on/replies-to link");
  const targetRef = identityToRef.get(link.to_identity);
  if (!targetRef) throw new Error(`mergeCommentIntoCorpus: link target ${link.to_identity} does not resolve to any existing claim; refusing to merge`);

  const newClaimBlock = claimBlock(ref, commentEntry.kind, commentEntry.statement, commentEntry.source_id, commentEntry.contributor_id, commentEntry.declared_grade);
  const newLinkBlock = linkBlock(link.link_kind, ref, targetRef, link.source_id, link.contributor_id, link.declared_grade);

  let out = src.replace(/(\s*)\]\s*,\s*\n\s*links: \[/, `,\n${newClaimBlock}\n  ],\n  links: [`);
  const linksCloseRe = /\n(\s*)\]\n\};\n\nmodule\.exports = \{ STORE \};\s*$/;
  const m = out.match(linksCloseRe);
  if (!m) throw new Error("mergeCommentIntoCorpus: could not locate the links array's closing bracket");
  out = out.slice(0, m.index) + `,\n${newLinkBlock}` + out.slice(m.index);
  writeFileSync(dataPath, out);
  return ref;
}

export function sweepInbox(nowMs) {
  const policy = loadPolicy();
  const files = existsSync(INBOX) ? readdirSync(INBOX).filter((f) => f.endsWith(".json")) : [];
  const results = [];
  let anyAdmitted = false;
  for (const file of files) {
    const path = join(INBOX, file);
    const bundle = JSON.parse(readFileSync(path, "utf8"));
    const { admit, reason } = decideAdmission(policy, bundle, nowMs);
    if (!admit) {
      results.push({ file, admitted: false, reason });
      console.log(`  not admitted: ${file} (${reason})`);
      continue;
    }
    const identityToRef = currentIdentityToRef(); // fresh child process: reflects every prior merge in this sweep
    const ref = mergeCommentIntoCorpus(bundle, identityToRef);
    renameSync(path, join(CONTRIBUTIONS, file));
    anyAdmitted = true;
    results.push({ file, admitted: true, reason, ref });
    console.log(`  admitted: ${file} -> ${ref} (${reason})`);
  }
  if (anyAdmitted) {
    const log = execFileSync("node", [join(BUILD_DIR, "regenerate-snapshot.mjs")], { encoding: "utf8" });
    process.stdout.write(log);
  }
  return results;
}

if (process.argv[1] && process.argv[1].endsWith("admit-inbox.mjs")) {
  console.log("admit-inbox: sweeping communities/epistack-competition/inbox/");
  const results = sweepInbox(Date.now());
  console.log(`done: ${results.filter((r) => r.admitted).length} admitted, ${results.filter((r) => !r.admitted).length} left pending`);
}
