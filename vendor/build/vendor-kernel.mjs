// Role: freeze one generated kernel into the store snapshot the local provider proposes against, the
//   generic analogue of build/vendor-snapshot.mjs but scoped to a single kernel. It runs the kernel's own
//   builder (build/<id>-build.mjs), takes the already-gated state and the source and kind tables the
//   builder produced, and serializes them as { state, sources, kinds }. The self-contained kernel file
//   inlines this so the same real gate runs in-page over exactly the claims the kernel grounded.
// Contract: `node build/vendor-kernel.mjs <id>` dynamic-imports ./<id>-build.mjs, calls buildKernel(),
//   and writes vendor/<id>/kernel-snapshot.json. Build layer; imports the kernel schema tables only to
//   read the shapes the builder returns. Returns nothing; the file is the artifact.
// Invariant: this changes no kernel data and no grade; it serializes the store the builder already
//   grounded. Deterministic: the same corpus produces the same bytes. Scoped to one kernel, not the
//   federation.
"use strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function vendorKernel(id) {
  const buildMod = await import(pathToFileURL(join(ROOT, "build", `${id}-build.mjs`)).href);
  const { state, tables } = buildMod.buildKernel();

  const sources = [...tables.sourceTable.byId.values()]
    .map((s) => ({ source_id: s.source_id, source_class: s.source_class, description: s.description }))
    .sort((a, b) => (a.source_id < b.source_id ? -1 : a.source_id > b.source_id ? 1 : 0));
  const kinds = [...tables.kindTable.byKind.entries()]
    .map(([kind, row]) => ({ kind, ceiling: row.ceiling }))
    .sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));

  const snapshot = { state, sources, kinds };
  const dir = join(ROOT, "vendor", id);
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, "kernel-snapshot.json");
  writeFileSync(dest, JSON.stringify(snapshot));
  return { dest, snapshot };
}

if (process.argv[1] && process.argv[1].endsWith("vendor-kernel.mjs")) {
  const id = process.argv[2];
  if (!id) { console.error("usage: node build/vendor-kernel.mjs <id>"); process.exit(1); }
  const { dest, snapshot } = await vendorKernel(id);
  const s = snapshot.state;
  console.log(`wrote ${dest} (${JSON.stringify(snapshot).length} bytes): ${s.entries.length} claims, ${s.links.length} links, ${snapshot.sources.length} sources, ${snapshot.kinds.length} kinds, state ${s.state_hash.slice(0, 16)}`);
}
