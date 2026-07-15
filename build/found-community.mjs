// Role: the founding flow (spec Section 5): frame -> type -> free parameters -> generate through the
//   vendored scaffolder -> publish (snapshot, community card, contribution-target scaffolding).
//   Surfaces vendor/scaffolder/new-kernel.mjs and vendor/build/emit-snapshot.mjs unchanged, over a
//   scratch workspace shaped like their own expected sibling tree, exactly the mechanism
//   build/emit-fixtures.mjs already established for this repository's own knowledge-game kernel,
//   generalized to any founding config and any corpus home. Relocates the scaffolder's generated
//   build/check files to this repository's real layout afterward (vendor/kernel/, not kernel/), the
//   same relocation build/knowledge-game-build.mjs already carries by hand from Stage 1.
// Contract: `node build/found-community.mjs generate <config.json>` runs the scaffolder over the
//   config's kernel-config.schema.json-shaped fields, reports the frame/type/parameter steps, and
//   leaves an empty, gate-accepted kernel at <config.home>/corpus/tables.js and
//   <config.home>/corpus/<id>-data.js plus relocated build/<id>-build.mjs and build/check-<id>.mjs.
//   `node build/found-community.mjs publish <config.json>` re-runs the relocated build over whatever
//   claims now populate <id>-data.js, emits the snapshot to <config.home>/snapshot/<id>.snapshot.json,
//   writes <config.home>/community-card.json, and scaffolds <config.home>/.github/workflows and a
//   README, all through emitCommunityArtifacts (exported for the founding report to call directly).
// Invariant: no rule of the gate is reimplemented; the scaffolder and emit-snapshot are run unmodified
//   and only their output's import paths are relocated. The parameter step's free/fixed classification
//   comes from build/parameter-surface.mjs, itself reading the schema's own x-tier annotations, never
//   hand-listed here. Every emitted artifact is checked for this deployment's own name and URL by
//   build/check-neutrality.mjs, a check this module does not perform on itself.
// Governs: claim-10: emitCommunityArtifacts writes every founded artifact from config and the built
//   snapshot alone, never this deployment's own name or URL; build/check-neutrality.mjs greps the
//   result for it.
// Governs: claim-16: reportParameters surfaces config.identity_thresholds as stored and
//   inactive-until-credential-seam-active; no call here or elsewhere evaluates it to gate behavior.
// Governs: claim-18: reportParameters surfaces config.standing_economy as stored and read by zero call
//   sites; the reserved fields pass through to the community card and nothing else touches them.
"use strict";
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { classifyParameterSurface } from "./parameter-surface.mjs";
import { hashTypeBundle } from "../vendor/kernel/schema/type-hash.mjs";
import { governanceHash } from "./governance-hash.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadConfig(configPath) {
  return JSON.parse(readFileSync(resolve(configPath), "utf8"));
}

// ---- the frame/type/parameter report: printed, never hidden inside a silent generate step ----
function reportFrame(config) {
  console.log("\n[frame]");
  console.log(`  name: ${config.frame.name}`);
  console.log(`  domain: ${config.frame.domain}`);
  console.log(`  purpose: ${config.frame.purpose}`);
}
function reportType(config) {
  console.log("\n[type]");
  for (const name of config.adopted_type_hashes || []) console.log(`  adopts shared kind '${name}' by pinned hash (corpora/_shared/common-types.js)`);
  for (const k of config.local_kinds || []) console.log(`  authors local kind '${k.kind}' (ceiling ${k.ceiling}), a recorded type decision, untyped abroad until published and adopted`);
}
function reportParameters(config) {
  console.log("\n[parameters, from vendor/scaffolder/kernel-config.schema.json's own x-tier annotations]");
  const schema = JSON.parse(readFileSync(join(ROOT, "vendor", "scaffolder", "kernel-config.schema.json"), "utf8"));
  const { free, fixed } = classifyParameterSurface(schema);
  console.log("  free (this founding's to set):");
  for (const f of free) console.log(`    ${f.name} = ${JSON.stringify(config[f.name])}`);
  console.log("  fixed for composition (docs/parameters-register.md draws this line; not editable here):");
  for (const f of fixed) console.log(`    ${f.name} [${f.tier}]`);
  if (config.identity_thresholds) {
    console.log("  identity thresholds per action (free parameters at the credential seam, api/credential.js, [4.2]):");
    for (const [action, threshold] of Object.entries(config.identity_thresholds)) console.log(`    ${action}: ${threshold} (stored, inactive-until-credential-seam-active; nothing evaluates this)`);
  }
  if (config.standing_economy) {
    console.log("  standing-economy parameters (reserved, spec Section 5; absent entirely until the coordination layer lands as working code):");
    for (const [field, value] of Object.entries(config.standing_economy)) console.log(`    ${field}: ${JSON.stringify(value)} (stored, read by zero call sites)`);
  }
}

// ---- generate: run the real unmodified scaffolder in a scratch workspace, then relocate ----
export function generateKernel(config) {
  reportFrame(config);
  reportType(config);
  reportParameters(config);

  const id = config.kernel_id;
  const home = resolve(ROOT, config.home);
  const corpusDir = join(home, "corpus");
  mkdirSync(corpusDir, { recursive: true });

  const workspace = join(tmpdir(), `found-${id}-${Date.now()}`);
  mkdirSync(workspace, { recursive: true });
  cpSync(join(ROOT, "vendor", "kernel"), join(workspace, "kernel"), { recursive: true });
  mkdirSync(join(workspace, "scaffolder"), { recursive: true });
  cpSync(join(ROOT, "vendor", "scaffolder", "new-kernel.mjs"), join(workspace, "scaffolder", "new-kernel.mjs"));
  mkdirSync(join(workspace, "corpora", "_shared"), { recursive: true });
  cpSync(join(ROOT, "vendor", "corpora", "_shared", "common-types.js"), join(workspace, "corpora", "_shared", "common-types.js"));
  mkdirSync(join(workspace, "build"), { recursive: true });

  const scaffoldConfigPath = join(workspace, "kernel-config.json");
  const scaffoldConfig = {
    kernel_id: id, adopted_type_hashes: config.adopted_type_hashes || [],
    local_kinds: config.local_kinds || [], sources: config.sources || [], time_lock: config.time_lock || { setting: "light" },
  };
  writeFileSync(scaffoldConfigPath, JSON.stringify(scaffoldConfig, null, 2));

  console.log("\n[generate: running the real, unmodified vendor/scaffolder/new-kernel.mjs]");
  let code = 0;
  try {
    const out = execFileSync("node", [join(workspace, "scaffolder", "new-kernel.mjs"), scaffoldConfigPath], { cwd: workspace, encoding: "utf8" });
    process.stdout.write(out);
  } catch (e) {
    if (e.stdout) process.stdout.write(e.stdout);
    if (e.stderr) process.stderr.write(e.stderr);
    code = e.status || 1;
  }
  if (code !== 0) {
    rmSync(workspace, { recursive: true, force: true });
    throw new Error(`generateKernel: the scaffolder's own generated check failed for '${id}'; stopping rather than proceeding on an unverified kernel`);
  }

  // relocate: copy the generated corpus into this community's home, and rewrite the generated
  // build/check files' import paths to this repository's real layout (vendor/kernel/, and the
  // community's home rather than corpora/<id>/), the same relocation knowledge-game-build.mjs
  // already carries from Stage 1. The GATE LOGIC below is copied verbatim from the generated file;
  // only path strings differ.
  cpSync(join(workspace, "corpora", id, "tables.js"), join(corpusDir, "tables.js"));
  cpSync(join(workspace, "corpora", id, `${id}-data.js`), join(corpusDir, `${id}-data.js`));

  const relCorpus = "../" + config.home + "/corpus";
  const buildSrc = `// Role: the generated builder for the ${id} kernel: builds its v3 store through the real gate from
//   the pure data in ${config.home}/corpus, exactly as build/knowledge-game-build.mjs builds
//   knowledge-game (Stage 1's relocation of the scaffolder's own template).
// Contract: buildKernel() -> { store_id, tables, claims, refId, state, view, receipt }. Imports the
//   kernel and ${config.home}/corpus; pure over the corpus.
// Invariant: grades are the kernel's own derivation; the scaffolder adds no rule of its own.
// GENERATED by build/found-community.mjs from vendor/scaffolder/new-kernel.mjs's template; do not hand-edit.
"use strict";
import { createRequire } from "node:module";
import { claimRecord, linkRecord } from "../vendor/kernel/schema/records.mjs";
import { makeSourceTable, makeKindTable } from "../vendor/kernel/schema/tables.mjs";
import { genesis } from "../vendor/kernel/store/state.mjs";
import { apply } from "../vendor/kernel/store/apply.mjs";
import { storeViewOf } from "../vendor/kernel/store/decay.mjs";
import { decide } from "../vendor/kernel/gate/gate.mjs";

const require = createRequire(import.meta.url);
const { KINDS, SOURCES } = require("${relCorpus}/tables.js");
const { STORE } = require("${relCorpus}/${id}-data.js");

export function buildKernel() {
  const tables = { sourceTable: makeSourceTable(SOURCES), kindTable: makeKindTable(KINDS) };
  const refId = new Map();
  const claims = STORE.claims.map((spec) => {
    const rec = claimRecord({ kind: spec.kind, statement: spec.statement, source_id: spec.source_id, contributor_id: spec.contributor_id, declared_grade: spec.declared_grade, checking_records: spec.checking_records, closing_condition: spec.closing_condition });
    refId.set(spec.ref, rec.identity);
    return { rec, spec };
  });
  const links = (STORE.links || []).map((l) => linkRecord({ link_kind: l.link_kind, from_identity: refId.get(l.from), to_identity: refId.get(l.to), support_group: l.support_group, source_id: l.source_id, contributor_id: l.contributor_id, declared_grade: l.declared_grade }));
  const entries = claims.map((c) => c.rec);
  const state = apply(genesis(), { entries, links, applied_contribution_hash: STORE.store_id, receipt_reference: STORE.store_id });
  const view = storeViewOf(state, tables);
  const receipt = decide({ hash: STORE.store_id, entries, links }, storeViewOf(genesis(), tables), {});
  return { store_id: STORE.store_id, tables, claims, refId, state, view, receipt };
}
`;
  writeFileSync(join(ROOT, "build", `${id}-build.mjs`), buildSrc);

  const checkSrc = `// Role: the oracle for the ${id} kernel, relocated from vendor/scaffolder/new-kernel.mjs's generated
//   template (Stage 1's relocation pattern) to this repository's real layout. Verifies every adopted
//   kind's pinned hash still matches the shared subtree, the tables build, and the gate accepts.
// Contract: \`node build/check-${id}.mjs\` exits non-zero on any failure.
// GENERATED by build/found-community.mjs; do not hand-edit.
"use strict";
import { createRequire } from "node:module";
import { hashTypeBundle } from "../vendor/kernel/schema/type-hash.mjs";

const require = createRequire(import.meta.url);
const { KINDS, SOURCES, ADOPTED, ADOPTED_HASHES } = require("${relCorpus}/tables.js");
const { COMMON_TYPE_HASHES } = require("../vendor/corpora/_shared/common-types.js");

let fails = 0;
const ok = (c, m) => { console.log(\`\${c ? "  ok  " : " FAIL "} \${m}\`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-${id.toUpperCase()}: the founded ${id} kernel"); console.log(H);

console.log("\\n[1] every adopted kind is in the shared subtree and its pinned hash matches");
for (const name of ADOPTED) {
  const shared = COMMON_TYPE_HASHES[name];
  ok(shared !== undefined, \`adopts common kind '\${name}', which is present in the shared subtree\`);
  if (shared !== undefined) {
    ok(ADOPTED_HASHES[name] === shared, \`the pinned hash for '\${name}' still matches the shared subtree\`);
    const row = KINDS.find((k) => k.kind === name);
    ok(!!row && hashTypeBundle({ kind: row.kind, ceiling: row.ceiling, compatibility_rule_id: null, atlas_refs: [] }) === shared, \`the '\${name}' kind row implies the adopted hash\`);
  }
}

console.log("\\n[2] the source table and kind table build, and the gate accepts the contribution");
let built = null;
try {
  const mod = await import("./${id}-build.mjs");
  built = mod.buildKernel();
  ok(true, "the kernel builds: source table, kind table, and the store all valid");
} catch (e) {
  ok(false, \`the kernel fails to build: \${e.message}\`);
}
if (built) {
  ok(built.state.entries.length >= 0, \`the kernel carries \${built.state.entries.length} claim(s) (structural check only; grade expectations are asserted by the founding report, not this generated file)\`);
  ok(built.receipt.decision === "accepted" || built.receipt.decision === "accepted-with-disagreement", \`the contribution is accepted by the real gate (got \${built.receipt.decision})\`);
}

console.log("\\n" + H);
console.log(fails === 0 ? "check-${id}: OK" : \`check-${id}: \${fails} FAILURE(S)\`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
`;
  writeFileSync(join(ROOT, "build", `check-${id}.mjs`), checkSrc);

  rmSync(workspace, { recursive: true, force: true });
  console.log(`\ngenerated and relocated: ${config.home}/corpus/tables.js, ${config.home}/corpus/${id}-data.js, build/${id}-build.mjs, build/check-${id}.mjs`);
}

// ---- publish: re-run the relocated build over whatever claims now populate <id>-data.js, emit the
// snapshot through the real vendored emit-snapshot.mjs (the same scratch-workspace trick
// build/emit-fixtures.mjs already uses for this repository's own knowledge-game kernel), write the
// community card, and scaffold the contribution target ----
export async function publishCommunity(config) {
  const id = config.kernel_id;
  const home = resolve(ROOT, config.home);
  const snapshotDir = join(home, "snapshot");
  mkdirSync(snapshotDir, { recursive: true });

  console.log("\n[publish: re-checking the founded kernel before emitting anything]");
  execFileSync("node", [join(ROOT, "build", `check-${id}.mjs`)], { cwd: ROOT, stdio: "inherit" });

  const workspace = join(tmpdir(), `publish-${id}-${Date.now()}`);
  mkdirSync(workspace, { recursive: true });
  cpSync(join(ROOT, "vendor", "kernel"), join(workspace, "kernel"), { recursive: true });
  cpSync(join(ROOT, "vendor", "kernel"), join(workspace, "vendor", "kernel"), { recursive: true });
  mkdirSync(join(workspace, "build"), { recursive: true });
  cpSync(join(ROOT, "vendor", "build", "emit-snapshot.mjs"), join(workspace, "build", "emit-snapshot.mjs"));
  cpSync(join(ROOT, "vendor", "build", "vendor-kernel.mjs"), join(workspace, "build", "vendor-kernel.mjs"));
  cpSync(join(ROOT, "build", `${id}-build.mjs`), join(workspace, "build", `${id}-build.mjs`));
  mkdirSync(join(workspace, config.home, "corpus"), { recursive: true });
  cpSync(join(home, "corpus"), join(workspace, config.home, "corpus"), { recursive: true });

  const dest = join(snapshotDir, `${id}.snapshot.json`);
  execFileSync("node", [join(workspace, "build", "emit-snapshot.mjs"), id, dest], { cwd: workspace, stdio: "inherit" });
  rmSync(workspace, { recursive: true, force: true });

  const snapshot = JSON.parse(readFileSync(dest, "utf8"));
  emitCommunityArtifacts(config, snapshot);
  return snapshot;
}

// the community card (ecosystem-guide.md "For a community founder"): kernel identity, snapshot hash,
// fetch locations, pinned type hashes, contribution target, protocol identity, and (Phase KG-4) the
// governance-hash, the community's durable content-addressed identity, with kernel_id demoted to a
// human label over it. An app-side local implementation of the upstream-specified format, not a
// vendored module (the format is prose-specified in docs/ecosystem-guide.md, not shipped as code this
// deployment could import).
export function emitCommunityArtifacts(config, snapshot) {
  const home = resolve(ROOT, config.home);
  // pinned type hashes: recomputed from the emitted kind table via the same hashTypeBundle every
  // kernel's own adoption uses, never copied from config (config only names WHICH kinds are adopted).
  const pinned_type_hashes = {};
  for (const name of config.adopted_type_hashes || []) {
    const row = (snapshot.kinds || []).find((k) => k.kind === name);
    pinned_type_hashes[name] = row ? hashTypeBundle({ kind: row.kind, ceiling: row.ceiling, compatibility_rule_id: null, atlas_refs: [] }) : null;
  }
  const card = {
    kernel_id: snapshot.kernel_id,
    governance_hash: governanceHash(config, pinned_type_hashes),
    governance_hash_computed_by: "this deployment, app-side (docs/coordination-layer-spec.md's own computation is specified, not yet built upstream)",
    member_set_commitment: null,
    snapshot_hash: snapshot.snapshot_hash,
    fetch_locations: config.fetch_locations,
    pinned_type_hashes,
    contribution_target: config.contribution_target,
    protocol_identity: "epistack-v3",
    domain: config.frame.domain,
    identity_thresholds: config.identity_thresholds || {},
    standing_economy: config.standing_economy || {},
  };
  writeFileSync(join(home, "community-card.json"), JSON.stringify(card, null, 2));

  // the contribution-target scaffold is self-contained (its own vendored kernel copy, its own corpus,
  // its own build/check), so moving this directory out to a standalone sibling repository (the
  // ledgered move-out obligation) requires copying nothing from outside it. This mirrors
  // docs/substrate-map.md's own framing of a deployment as the N=1 case of the community kernel: each
  // deployment vendors and locks its own copy rather than reaching into another repository's tree.
  const localVendorKernel = join(home, "vendor", "kernel");
  rmSync(localVendorKernel, { recursive: true, force: true });
  cpSync(join(ROOT, "vendor", "kernel"), localVendorKernel, { recursive: true });
  mkdirSync(join(home, "build"), { recursive: true });
  const selfContainedBuildSrc = `// Role: this community's own builder, self-contained: its vendored kernel copy (vendor/kernel/,
//   copied at publish time from the founding deployment) plus its own corpus, no reference to the
//   founding deployment's own tree. Runs standalone once this directory moves to its own repository.
// Contract: buildKernel() -> { store_id, tables, claims, refId, state, view, receipt }.
// GENERATED by build/found-community.mjs; do not hand-edit.
"use strict";
import { createRequire } from "node:module";
import { claimRecord, linkRecord } from "../vendor/kernel/schema/records.mjs";
import { makeSourceTable, makeKindTable } from "../vendor/kernel/schema/tables.mjs";
import { genesis } from "../vendor/kernel/store/state.mjs";
import { apply } from "../vendor/kernel/store/apply.mjs";
import { storeViewOf } from "../vendor/kernel/store/decay.mjs";
import { decide } from "../vendor/kernel/gate/gate.mjs";

const require = createRequire(import.meta.url);
const { KINDS, SOURCES } = require("../corpus/tables.js");
const { STORE } = require("../corpus/${config.kernel_id}-data.js");

export function buildKernel() {
  const tables = { sourceTable: makeSourceTable(SOURCES), kindTable: makeKindTable(KINDS) };
  const refId = new Map();
  const claims = STORE.claims.map((spec) => {
    const rec = claimRecord({ kind: spec.kind, statement: spec.statement, source_id: spec.source_id, contributor_id: spec.contributor_id, declared_grade: spec.declared_grade, checking_records: spec.checking_records, closing_condition: spec.closing_condition });
    refId.set(spec.ref, rec.identity);
    return { rec, spec };
  });
  const links = (STORE.links || []).map((l) => linkRecord({ link_kind: l.link_kind, from_identity: refId.get(l.from), to_identity: refId.get(l.to), support_group: l.support_group, source_id: l.source_id, contributor_id: l.contributor_id, declared_grade: l.declared_grade }));
  const entries = claims.map((c) => c.rec);
  const state = apply(genesis(), { entries, links, applied_contribution_hash: STORE.store_id, receipt_reference: STORE.store_id });
  const view = storeViewOf(state, tables);
  const receipt = decide({ hash: STORE.store_id, entries, links }, storeViewOf(genesis(), tables), {});
  return { store_id: STORE.store_id, tables, claims, refId, state, view, receipt };
}
`;
  writeFileSync(join(home, "build", `${config.kernel_id}-build.mjs`), selfContainedBuildSrc);
  const checkDotMjs = `// Role: this community's own gate re-check, self-contained, run by its Actions workflow on every PR.
"use strict";
const { buildKernel } = await import("./${config.kernel_id}-build.mjs");
const built = buildKernel();
const ok = built.receipt.decision === "accepted" || built.receipt.decision === "accepted-with-disagreement";
console.log(ok ? \`check: OK (\${built.state.entries.length} claims, gate decision '\${built.receipt.decision}')\` : \`check: FAILED (gate decision '\${built.receipt.decision}')\`);
process.exit(ok ? 0 : 1);
`;
  writeFileSync(join(home, "build", "check.mjs"), checkDotMjs);

  const workflowsDir = join(home, ".github", "workflows");
  mkdirSync(workflowsDir, { recursive: true });
  const checkWorkflow = `name: check
on:
  pull_request:
  push:
    branches: [main]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: re-run the gate over this community's own store
        run: node build/check.mjs
`;
  writeFileSync(join(workflowsDir, "check.yml"), checkWorkflow);
  const pagesWorkflow = `name: pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: snapshot
      - id: deployment
        uses: actions/deploy-pages@v4
`;
  writeFileSync(join(workflowsDir, "pages.yml"), pagesWorkflow);

  const readme = `# ${config.frame.name}\n\n${config.frame.purpose}\n\nDomain: ${config.frame.domain}\n\nThis is an EpiStack community kernel, self-contained (vendor/kernel/ is its own vendored copy). Its snapshot is at snapshot/${config.kernel_id}.snapshot.json; its community card is community-card.json. A pull request against this repository carrying a contribution bundle re-runs the gate (build/check.mjs) before merge.\n`;
  writeFileSync(join(home, "README.md"), readme);

  console.log(`\nwrote ${config.home}/community-card.json, ${config.home}/.github/workflows/{check,pages}.yml, ${config.home}/README.md, ${config.home}/vendor/kernel (self-contained copy), ${config.home}/build/{${config.kernel_id}-build,check}.mjs`);
}

// ---- CLI ----
if (process.argv[1] && process.argv[1].endsWith("found-community.mjs")) {
  const [, , mode, configPath] = process.argv;
  if (!mode || !configPath) { console.error("usage: node build/found-community.mjs <generate|publish> <config.json>"); process.exit(2); }
  const config = loadConfig(configPath);
  if (mode === "generate") generateKernel(config);
  else if (mode === "publish") await publishCommunity(config);
  else { console.error(`unknown mode '${mode}'`); process.exit(2); }
}
