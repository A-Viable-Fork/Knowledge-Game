// Role: classifies a kernel-config schema's top-level properties into what a founder may set freely
//   (x-tier "local") and what is fixed for composition (any other x-tier), read structurally from the
//   schema's own annotations rather than a hand-listed copy (Phase KG-4). Phase KG-10 moves this from
//   build/parameter-surface.mjs (which now re-exports it) into api/ so the in-app kernel designer can
//   read the identical classification the CLI founding flow and build/check-parameter-surface.mjs use,
//   from one implementation, never a second that could drift.
// Contract: classifyParameterSurface(schema) -> { free: [{name, description}], fixed: [{name,
//   description, tier}] }, reading only top-level properties (this slice of the schema declares no
//   deeper x-tier splits worth surfacing separately; sources[].source_class is noted inline on the
//   sources field's own description, which the schema already states).
// Invariant: no field name or tier is hand-listed here; every entry comes from the schema's own
//   `x-tier` value, so a schema change is reflected automatically rather than requiring a second edit.
//   Pure; takes the parsed schema object as an argument rather than reading it itself, so this module
//   has no filesystem dependency and loads in a browser exactly as it does under Node.
// Phase KG-10: also loads vendor/scaffolder/kernel-config.schema.json directly via a JSON module
//   import and exposes its own classification pre-applied (KERNEL_CONFIG_FIXED_FIELDS), so the in-app
//   kernel designer (periphery/) can read the current fixed-for-composition list without importing
//   vendor/ itself, which the membrane forbids periphery from doing directly (build/check-imports.mjs).
"use strict";
import kernelConfigSchema from "../vendor/scaffolder/kernel-config.schema.json" with { type: "json" };

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

const { free: KERNEL_CONFIG_FREE_FIELDS, fixed: KERNEL_CONFIG_FIXED_FIELDS } = classifyParameterSurface(kernelConfigSchema);
export { KERNEL_CONFIG_FREE_FIELDS, KERNEL_CONFIG_FIXED_FIELDS };
