// Role: the deterministic substrate extraction. Copies exactly the files named in
//   build/substrate-manifest.json from the pinned upstream/epistack submodule into vendor/,
//   byte for byte, creating directories as needed. This is the only path by which vendor/ content
//   is produced; vendor/ is never hand-edited.
// Contract: `node build/vendor-extract.mjs` reads the manifest, copies each file from
//   upstream/epistack/<path> to vendor/<path>, and reports what it wrote. Deterministic: the same
//   submodule commit and the same manifest always produce byte-identical vendor/ content.
// Invariant: this script performs no transformation on file content, only a copy. Any local
//   departure from upstream is a named patch recorded in upstream/lock.json, never a silent edit
//   made here.
"use strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UPSTREAM = join(ROOT, "upstream", "epistack");
const VENDOR = join(ROOT, "vendor");

const manifest = JSON.parse(readFileSync(join(ROOT, "build", "substrate-manifest.json"), "utf8"));

let copied = 0;
for (const rel of manifest.files) {
  const src = join(UPSTREAM, rel);
  if (!existsSync(src)) {
    console.error(`vendor-extract: manifest names ${rel}, which does not exist in the pinned submodule`);
    process.exit(1);
  }
  const dest = join(VENDOR, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, readFileSync(src));
  copied++;
}

console.log(`vendor-extract: copied ${copied} files from upstream/epistack into vendor/`);
