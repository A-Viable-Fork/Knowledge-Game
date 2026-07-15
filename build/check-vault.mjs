// Role: verifies the vault's own invariants (claims 3 and 5). A static scan proves vault/vault.js is
//   the only file touching a personal-data storage API; a fresh profile's state is off with an empty
//   log; with the toggle off, a simulated session writes zero observation records; export round-trips
//   what the vault holds; delete-all leaves nothing.
// Contract: `node build/check-vault.mjs` exits non-zero on any violation, naming the file or the
//   obligation that failed.
// Invariant: the static scan looks for localStorage, sessionStorage, and indexedDB, the web storage
//   APIs a personal-data store would use; it does not flag the service worker's Cache Storage API
//   (`caches.*`), a structurally different concern (cached copies of public static files for offline
//   use, never personal data), scoped out explicitly here rather than silently.
"use strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, extname, relative } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-VAULT: the vault is the only persistence"); console.log(H);

console.log("\n[1] static scan: only vault/vault.js touches a storage API");
const STORAGE_RE = /\b(localStorage|sessionStorage|indexedDB)\b/;
function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (extname(name) === ".js" || extname(name) === ".mjs") out.push(p);
  }
}
const files = [];
for (const zone of ["periphery", "api", "vault", "app"]) {
  try { walk(join(ROOT, zone), files); } catch (e) { void e; }
}
for (const file of files) {
  const rel = relative(ROOT, file);
  const source = readFileSync(file, "utf8");
  const touches = STORAGE_RE.test(source);
  const isVault = rel === join("vault", "vault.js");
  ok(touches === isVault, `${rel}: ${isVault ? "touches storage (expected, it is the vault)" : touches ? "FORBIDDEN: touches a storage API outside the vault" : "does not touch storage"}`);
}

console.log("\n[2] fresh profile: off, empty, absence not a stored false");
function makeMemoryLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    _size: () => store.size,
  };
}
globalThis.localStorage = makeMemoryLocalStorage();
const vault = await import(join(ROOT, "vault", "vault.js"));

ok(globalThis.localStorage._size() === 0, "a fresh profile has zero keys in storage before any getter is called");
ok(JSON.stringify(vault.getObjective()) === "{}", "getObjective() on a fresh profile is the zero vector");
ok(vault.observationEnabled() === false, "observationEnabled() on a fresh profile is false");
ok(JSON.stringify(vault.observationLog()) === "[]", "observationLog() on a fresh profile is empty");
ok(globalThis.localStorage._size() === 0, "reading a fresh profile writes nothing to storage");

console.log("\n[3] off means off: a simulated session with the toggle off writes zero records");
for (let i = 0; i < 5; i++) vault.recordObservation({ type: "dwell", identity: "x", kind: "measurement", at: Date.now() });
ok(JSON.stringify(vault.observationLog()) === "[]", "five attempted recordObservation calls while off wrote nothing");

console.log("\n[4] export round-trips what the vault holds");
vault.setObjective({ "learn-efficiently": 2 });
vault.setObservationEnabled(true);
vault.recordObservation({ type: "expand", identity: "y", kind: "measurement", at: 1000 });
const exported = JSON.parse(vault.exportAll());
ok(JSON.stringify(exported.objective) === JSON.stringify(vault.getObjective()), "exported objective matches getObjective()");
ok(exported.observation.enabled === true && exported.observation.log.length === 1, "exported observation state matches what was set and recorded");

console.log("\n[5] delete-all leaves nothing");
vault.deleteAll();
ok(JSON.stringify(vault.getObjective()) === "{}", "getObjective() is the zero vector again after delete-all");
ok(vault.observationEnabled() === false, "observationEnabled() is false again after delete-all");
ok(JSON.stringify(vault.observationLog()) === "[]", "observationLog() is empty again after delete-all");

console.log("\n" + H);
if (fails === 0) console.log("verified: vault/vault.js is the only file touching storage; a fresh profile is off and empty by construction; off means off; export round-trips; delete-all leaves nothing.");
console.log(fails === 0 ? "check-vault: OK" : `check-vault: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
