// Role: the standalone snapshot emit. Writes the kernel snapshot { state, sources, kinds } that
//   vendor-kernel.mjs already stages for inlining as a fetchable <id>.snapshot.json, so a fat client
//   loads a community's kernel from static hosting and runs the REAL gate on device through
//   createLocalProvider. This exposes what the build already computes; it touches no gate, grounding,
//   or crossing, and reimplements no staging.
// Contract: `node build/emit-snapshot.mjs <id> [outfile]` writes <id>.snapshot.json (or outfile):
//   { kernel_id, snapshot_hash, state, sources, kinds }. Build layer (may use node builtins); reuses
//   vendorKernel for the staged object and the one named hash for snapshot_hash. emitSnapshot(id) is
//   exported for the oracle. Returns { dest, snapshot, kernel_id, snapshot_hash }.
// Invariant: the staged object is vendor-kernel's, unchanged. snapshot_hash is the one named hash over
//   the canonical content { state, sources, kinds }, so a mutated snapshot fails verification. If
//   vendor-kernel's staged object differs from the local-provider's expected { state, sources, kinds }
//   shape in any field, this stops and reports rather than adapting silently.
"use strict";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { vendorKernel } from "./vendor-kernel.mjs";
import { hashOf } from "../kernel/schema/canonical.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// the local provider consumes exactly these three fields (api/providers/local-provider.mjs); if the
// staged object grows or drops one, the snapshot would not load, so this is a stop-and-report gate.
const EXPECTED_FIELDS = ["state", "sources", "kinds"];

export async function emitSnapshot(id, outfile) {
  const { snapshot } = await vendorKernel(id); // vendor-kernel's staged { state, sources, kinds }
  const keys = Object.keys(snapshot).sort();
  const expected = EXPECTED_FIELDS.slice().sort();
  if (keys.length !== expected.length || keys.some((k, i) => k !== expected[i]))
    throw new Error(`emit-snapshot: vendor-kernel staged { ${keys.join(", ")} }, but the local provider expects { ${EXPECTED_FIELDS.join(", ")} }; stopping rather than adapting`);

  const content = { state: snapshot.state, sources: snapshot.sources, kinds: snapshot.kinds };
  const snapshot_hash = hashOf(content); // the one named hash over the canonical content
  const out = { kernel_id: id, snapshot_hash, ...content };
  const dest = outfile || join(ROOT, `${id}.snapshot.json`); // outfile as given (cwd-relative), else ROOT/<id>.snapshot.json
  writeFileSync(dest, JSON.stringify(out));
  return { dest, snapshot: out, kernel_id: id, snapshot_hash };
}

// verify a parsed snapshot's hash against its content (the check-6 property, also usable by a client).
export function verifySnapshot(parsed) {
  if (!parsed || typeof parsed.snapshot_hash !== "string") return { ok: false, reason: "no snapshot_hash" };
  const recomputed = hashOf({ state: parsed.state, sources: parsed.sources, kinds: parsed.kinds });
  return { ok: recomputed === parsed.snapshot_hash, recomputed, stored: parsed.snapshot_hash };
}

if (process.argv[1] && process.argv[1].endsWith("emit-snapshot.mjs")) {
  const id = process.argv[2];
  if (!id) { console.error("usage: node build/emit-snapshot.mjs <id> [outfile]"); process.exit(1); }
  const { dest, snapshot, snapshot_hash } = await emitSnapshot(id, process.argv[3]);
  const s = snapshot.state;
  console.log(`wrote ${dest} (${JSON.stringify(snapshot).length} bytes): ${s.entries.length} claims, ${s.links.length} links, ${snapshot.sources.length} sources, ${snapshot.kinds.length} kinds, snapshot_hash ${snapshot_hash.slice(0, 16)}`);
}
