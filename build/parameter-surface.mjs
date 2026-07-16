// Role: re-export shim (Phase KG-10). classifyParameterSurface moved to api/parameter-surface.js so
//   the in-app kernel designer can import the identical function build/found-community.mjs's
//   reportParameters and build/check-parameter-surface.mjs already use; this file exists only so
//   those two keep working unchanged, both reading a single source of truth.
"use strict";
export { classifyParameterSurface } from "../api/parameter-surface.js";

if (process.argv[1] && process.argv[1].endsWith("parameter-surface.mjs")) {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join, resolve } = await import("node:path");
  const { classifyParameterSurface } = await import("../api/parameter-surface.js");
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const schema = JSON.parse(readFileSync(join(ROOT, "vendor", "scaffolder", "kernel-config.schema.json"), "utf8"));
  const { free, fixed } = classifyParameterSurface(schema);
  console.log("free (a founder's to set): " + free.map((f) => f.name).join(", "));
  console.log("fixed for composition (docs/parameters-register.md): " + fixed.map((f) => `${f.name} [${f.tier}]`).join(", "));
}
