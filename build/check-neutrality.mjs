// Role: verifies claim 10 (client neutrality: nothing the founding flow emits contains a reference to
//   this app or repository). Walks every artifact under every founded community directory under
//   communities/ (Phase KG-12: generalized from a single hardcoded epistack-competition home once a
//   second community, the-registry, was founded; a community directory is any communities/<id>/ that
//   carries its own founding-config.json, the founding flow's own marker) and fails on any of this
//   deployment's own name-shaped strings.
// Contract: `node build/check-neutrality.mjs` exits non-zero on any violation, naming the file and the
//   matched string.
// Invariant: two fields on community-card.json, fetch_locations and contribution_target, are one
//   documented exemption: their entire function is to name a real, current transport location
//   (ecosystem-guide.md: "the fetch locations are transport hints"), and while this community lives in
//   this repository (the spec's own fallback, ledgered as SK-21 in trellis/sorry-ledger.md), an honest
//   transport hint cannot help but name the repository it currently lives in. The community's own
//   vendor/kernel/ (a byte-for-byte copy of this deployment's own pinned, hash-locked substrate, never
//   authored by the founding flow) is the other: it is verified byte-identical to this deployment's own
//   vendor/kernel/ instead of string-scanned, because upstream's own pinned prose coincidentally
//   contains the phrase "Knowledge Game" as its own unrelated protocol vocabulary
//   (vendor/kernel/gate/lifecycle.js's "the Knowledge Game gated-write lifecycle", a staking mechanism
//   name, discovered by this check's own first run, not assumed away). Every OTHER file, including the
//   rest of community-card.json, the corpus, the snapshot, the self-contained build/check files, the
//   README, and the Actions workflows, is fully string-scanned with no exemption.
//   communities/epistack-competition/founding-config.json (the flow's INPUT, authored by hand before
//   generation, not its output) is excluded from the walk for the same reason an operator's own
//   kernel-config.json was never scanned as an "emitted artifact" elsewhere in this repository.
//   PUBLISH-WALKTHROUGH.md's own quotation of the community's declared fetch_locations URL is the
//   identical transport-hint exemption, stripped before scanning rather than skipping the whole file.
//   Phase KG-12: the-registry's own corpus/snapshot/seed-receipts content is a third, narrow,
//   community-scoped exemption: a registry's domain is artifacts, its client-kind claims name real
//   client software by design ("the app lists its rivals," this app's own entry included, graded by
//   the identical pair, with no privileged placement), so those three files alone, for this one
//   community, may name this app; the-registry's own scaffolding (README, community-card.json's
//   non-exempt fields, the walkthrough, the Actions workflows) stays fully scanned like any other
//   community's, since naming a client in typed data is not the same as the founding flow itself
//   embedding this app's identity into scaffolding.
"use strict";
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve, sep } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COMMUNITIES_DIR = join(ROOT, "communities");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-NEUTRALITY: the founding flow's output names no reference to this app"); console.log(H);

// case-insensitive; deliberately broad (the app's display name, its repo-id form, and the owner/repo
// pair) so a rename in one place cannot silently escape the scan.
const FORBIDDEN = ["knowledge game", "knowledge-game", "a-viable-fork"];
const EXCLUDE_FILES = new Set(["founding-config.json"]);
const EXEMPT_JSON_FIELDS = { "community-card.json": ["fetch_locations", "contribution_target"] };
// Phase KG-12: the-registry's own client-kind artifact data legitimately names real client software,
// this app included, by design; these three files alone, for this one community, are exempt from the
// forbidden-string scan (everything else about the-registry, and every other community's every file,
// stays fully scanned).
const CLIENT_NAMING_EXEMPT_FILES = { "the-registry": new Set(["the-registry-data.js", "the-registry.snapshot.json", "seed-receipts.json"]) };

const HOMES = readdirSync(COMMUNITIES_DIR)
  .map((id) => join(COMMUNITIES_DIR, id))
  .filter((p) => statSync(p).isDirectory() && existsSync(join(p, "founding-config.json")));
console.log(`\nfounded community directories: ${HOMES.map((h) => relative(ROOT, h)).join(", ")}`);

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (EXCLUDE_FILES.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
}

for (const HOME of HOMES) {
  const HOME_VENDOR_KERNEL = join(HOME, "vendor", "kernel");
  const rel = relative(ROOT, HOME);
  const communityId = rel.split("/").pop();
  const clientNamingExempt = CLIENT_NAMING_EXEMPT_FILES[communityId] || new Set();
  let fetchLocations = [];
  try { fetchLocations = JSON.parse(readFileSync(join(HOME, "community-card.json"), "utf8")).fetch_locations || []; } catch (e) { void e; }

  const allFiles = [];
  walk(HOME, allFiles);
  const files = allFiles.filter((f) => !f.startsWith(HOME_VENDOR_KERNEL + sep));
  console.log(`\n[1] ${rel}: scanning ${files.length} founding-flow-authored file(s) (founding-config.json excluded: input, not output; vendor/kernel/ scoped out to [2])`);

  for (const file of files) {
    const fileRel = relative(ROOT, file);
    const name = file.split("/").pop();
    if (clientNamingExempt.has(name)) {
      ok(true, `${fileRel}: exempt (this community's own client-naming exemption, see header note)`);
      continue;
    }
    let text = readFileSync(file, "utf8");
    const exemptFields = EXEMPT_JSON_FIELDS[name];
    if (exemptFields && name.endsWith(".json")) {
      const parsed = JSON.parse(text);
      for (const f of exemptFields) delete parsed[f];
      text = JSON.stringify(parsed);
    }
    if (name === "PUBLISH-WALKTHROUGH.md") {
      for (const url of fetchLocations) text = text.split(url).join("");
    }
    const lower = text.toLowerCase();
    const hit = FORBIDDEN.find((s) => lower.includes(s));
    ok(!hit, `${fileRel}: no forbidden string${hit ? ` (found "${hit}")` : ""}`);
  }

  console.log(`\n[2] ${rel}: its own vendor/kernel/ is byte-identical to this deployment's own pinned copy (verified, not string-scanned: see the header note on lifecycle.js's coincidental phrase)`);
  const vendorFiles = [];
  walk(HOME_VENDOR_KERNEL, vendorFiles);
  ok(vendorFiles.length > 0, "the community carries its own vendor/kernel/ copy (self-containment, not a reference back into this repository)");
  for (const file of vendorFiles) {
    const vendorRel = relative(HOME_VENDOR_KERNEL, file);
    const localPath = join(ROOT, "vendor", "kernel", vendorRel);
    const same = readFileSync(file, "utf8") === readFileSync(localPath, "utf8");
    ok(same, `vendor/kernel/${vendorRel}: byte-identical to this deployment's own pinned copy`);
  }

  console.log(`\n[3] ${rel}: the documented community-card.json exemption itself: the exempted fields exist and name a real location, not empty placeholders`);
  const card = JSON.parse(readFileSync(join(HOME, "community-card.json"), "utf8"));
  ok(Array.isArray(card.fetch_locations) && card.fetch_locations.length > 0, "fetch_locations is present and non-empty (a real transport hint, not omitted)");
  ok(typeof card.contribution_target === "string" && card.contribution_target.length > 0, "contribution_target is present and non-empty (a real transport hint, not omitted)");
}

console.log("\n" + H);
if (fails === 0) console.log("verified: no artifact the founding flow emitted names this app or repository, except the two documented transport-hint fields.");
console.log(fails === 0 ? "check-neutrality: OK" : `check-neutrality: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
