// Role: the founding flow's parameter step, generated from the vendored parameters-register rather
//   than hand-listed. vendor/scaffolder/kernel-config.schema.json carries an `x-tier` annotation on
//   every field, the fixed-shared-free line from docs/parameters-register.md made data. This module
//   reads that annotation and classifies the config surface into what a founder may set freely
//   (x-tier "local") and what is fixed for composition (x-tier "shared-adopted", pinned by hash at
//   adoption time, or "substrate-inherited", the closed menu the real kernel enforces), rather than a
//   founding tool re-describing the line in its own prose.
// Contract: classifyParameterSurface(schema) -> { free: [{name, description}], fixed: [{name,
//   description, tier}] }, reading only top-level properties (this slice of the schema declares no
//   deeper x-tier splits worth surfacing separately; sources[].source_class is noted inline on the
//   sources field's own description, which the schema already states).
// Invariant: no field name or tier is hand-listed here; every entry comes from the schema's own
//   `x-tier` value, so a schema change is reflected automatically rather than requiring a second edit.
"use strict";

export function classifyParameterSurface(schema) {
  const free = [];
  const fixed = [];
  for (const [name, def] of Object.entries(schema.properties || {})) {
    const entry = { name, description: def.description || "", tier: def["x-tier"] || "unspecified" };
    if (entry.tier === "local") free.push(entry);
    else fixed.push(entry);
  }
  return { free, fixed };
}

if (process.argv[1] && process.argv[1].endsWith("parameter-surface.mjs")) {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join, resolve } = await import("node:path");
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const schema = JSON.parse(readFileSync(join(ROOT, "vendor", "scaffolder", "kernel-config.schema.json"), "utf8"));
  const { free, fixed } = classifyParameterSurface(schema);
  console.log("free (a founder's to set): " + free.map((f) => f.name).join(", "));
  console.log("fixed for composition (docs/parameters-register.md): " + fixed.map((f) => `${f.name} [${f.tier}]`).join(", "));
}
