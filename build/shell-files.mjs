// Role: computes the exact set of files the app shell needs to run offline, by walking the real
//   import graph from app/index.html's own script and style references through every periphery/,
//   api/, and vault/ module transitively, plus the vendor/ files those modules actually import, plus
//   the fixtures manifests/network.json declares. This is the one source both the service worker's
//   precache list and build/check-offline-shell.mjs are generated from and verified against, so the
//   two can never silently drift.
// Contract: computeShellFiles(root) -> sorted array of repo-relative paths (posix separators).
"use strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve, extname, sep } from "node:path";

const SPEC_RE = /\b(?:import\s+(?:[\w*${}\s,]+\sfrom\s+)?|import\(|require\()\s*["']([^"']+)["']/g;

function jsSpecifiers(source) {
  const out = [];
  let m;
  while ((m = SPEC_RE.exec(source))) out.push(m[1]);
  return out;
}
function htmlReferences(source) {
  const out = [];
  const re = /(?:src|href)="([^"]+)"/g;
  let m;
  while ((m = re.exec(source))) {
    const v = m[1];
    if (!/^https?:|^data:|^\/\//.test(v)) out.push(v);
  }
  return out;
}

export function computeShellFiles(root) {
  const visited = new Set();
  const queue = [
    { abs: join(root, "app", "index.html"), rel: "app/index.html" },
  ];
  while (queue.length) {
    const { abs, rel } = queue.pop();
    if (visited.has(rel)) continue;
    if (!existsSync(abs)) continue;
    visited.add(rel);
    const ext = extname(abs);
    const dir = dirname(abs);
    let refs = [];
    if (ext === ".html") {
      refs = htmlReferences(readFileSync(abs, "utf8"));
    } else if (ext === ".js" || ext === ".mjs") {
      refs = jsSpecifiers(readFileSync(abs, "utf8")).filter((s) => s.startsWith("."));
    } else {
      continue; // css, json, webmanifest: leaves, no further references followed
    }
    for (const ref of refs) {
      const nextAbs = resolve(dir, ref);
      const nextRel = relative(root, nextAbs).split(sep).join("/");
      queue.push({ abs: nextAbs, rel: nextRel });
    }
  }
  // the declared fixtures, from the manifest, so the precache list needs no separate hand-maintained copy
  const network = JSON.parse(readFileSync(join(root, "manifests", "network.json"), "utf8"));
  for (const dest of network.allowed_egress_destinations) visited.add(`app/${dest.path}`);
  // the shell's own static assets not reached by a script/import reference
  for (const extra of ["app/style.css", "app/manifest.webmanifest"]) visited.add(extra);
  return [...visited].sort();
}
