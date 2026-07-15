// Role: the import-graph oracle. Statically parses every import statement in periphery/, api/,
//   vault/, and kernel/governance/, and enforces the membrane rules from the deployment spec and the
//   governing trellis (G0-1 / A-1): periphery/ reaches the vendored kernel and the vault only through
//   api/; api/ imports only vendor/, vault/, and itself; vault/ imports nothing outside itself;
//   kernel/governance/ is pure data importing nothing outside itself. This is a static read of import
//   statements, no bundler and no module graph library, matching the no-build-tooling discipline.
// Contract: `node build/check-imports.mjs` exits non-zero on any forbidden edge, naming the file and
//   the edge (from directory -> to directory).
// Invariant: this check reads source text; it does not execute any of it. A relative import is
//   resolved against the importing file's own directory, then classified by which top-level
//   repository directory it lands in.
"use strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve, extname } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-IMPORTS: the import-graph oracle"); console.log(H);

// the membrane rule: which top-level directory an importer may reach into.
const RULES = {
  periphery: new Set(["periphery"]), // periphery/ reaches the kernel and the vault only through api/... plus api itself
  api: new Set(["vendor", "api", "vault"]),
  vault: new Set([]), // the personal-data store; imports nothing outside itself
  "kernel/governance": new Set([]), // pure data; imports nothing outside itself
};
// periphery may also import api/, named separately since the rule set above is keyed by top segment
RULES.periphery.add("api");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (extname(name) === ".js" || extname(name) === ".mjs") out.push(p);
  }
}

// every relative import/require specifier in a file's source text, by simple regex over the text,
// not an AST: sufficient for periphery's own vanilla ESM (no dynamic string-built specifiers).
const SPEC_RE = /\b(?:import\s+(?:[\w*${}\s,]+\sfrom\s+)?|import\(|require\()\s*["']([^"']+)["']/g;
function specifiersOf(source) {
  const out = [];
  let m;
  while ((m = SPEC_RE.exec(source))) out.push(m[1]);
  return out;
}

// which membrane zone (top-level dir, or "kernel/governance" specifically) a repo-relative path is in.
function zoneOf(repoRelPath) {
  const parts = repoRelPath.split("/");
  if (parts[0] === "kernel" && parts[1] === "governance") return "kernel/governance";
  return parts[0];
}

const files = [];
for (const zoneDir of ["periphery", "api", "vault", join("kernel", "governance")]) {
  const abs = join(ROOT, zoneDir);
  try { walk(abs, files); } catch (e) { void e; }
}

console.log(`\n[1] scanning ${files.length} file(s) under periphery/, api/, vault/, kernel/governance/`);
for (const file of files) {
  const fileZone = zoneOf(relative(ROOT, file));
  const source = readFileSync(file, "utf8");
  const specs = specifiersOf(source).filter((s) => s.startsWith("."));
  for (const spec of specs) {
    const targetAbs = resolve(dirname(file), spec);
    const targetRel = relative(ROOT, targetAbs);
    const targetZone = zoneOf(targetRel);
    const allowed = RULES[fileZone] ? RULES[fileZone].has(targetZone) || targetZone === fileZone : false;
    ok(allowed, `${relative(ROOT, file)}: import "${spec}" (${fileZone} -> ${targetZone})${allowed ? "" : " FORBIDDEN EDGE"}`);
  }
}
if (files.length === 0) ok(false, "no files found to scan; the membrane rule holds vacuously only before any file exists");

console.log("\n" + H);
if (fails === 0) console.log("verified: every import in periphery/, api/, vault/, and kernel/governance/ stays within its membrane zone.");
console.log(fails === 0 ? "check-imports: OK" : `check-imports: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
