// Role: generates the app's PNG icon files (Phase KG-6a, the TWA wrapper) from the same inline SVG
//   marks the manifest carried as data URIs before this phase. Real files exist because the Bubblewrap
//   toolchain's icon fetcher rejects the data: URI scheme outright; this is a tooling requirement, not
//   a design change to the mark itself.
// Contract: `node build/generate-icons.mjs` renders each mark (any, maskable) at each size (192, 512)
//   via a headless Chromium screenshot and writes app/icons/icon-<purpose>-<size>.png. Deterministic
//   over the fixed SVG source strings below.
// Invariant: the maskable mark's ring stays within the safe zone (a centered circle of 40% radius),
//   full-bleed background included, exactly as the manifest's earlier data-URI maskable icon did.
"use strict";
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const MARKS = {
  any: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect width='192' height='192' rx='32' fill='#0e1210'/><circle cx='96' cy='96' r='52' fill='none' stroke='#2c8a5f' stroke-width='14'/><circle cx='96' cy='96' r='18' fill='#2c8a5f'/></svg>`,
  maskable: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect width='192' height='192' fill='#0e1210'/><circle cx='96' cy='96' r='60' fill='none' stroke='#2c8a5f' stroke-width='12'/><circle cx='96' cy='96' r='22' fill='#2c8a5f'/></svg>`,
};
const SIZES = [192, 512];

export async function generateIcons() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const written = [];
  for (const [purpose, svg] of Object.entries(MARKS)) {
    for (const size of SIZES) {
      const page = await (await browser.newContext({ viewport: { width: size, height: size } })).newPage();
      const sized = svg.replace("<svg ", `<svg width="${size}" height="${size}" `);
      await page.setContent(`<!doctype html><html><body style="margin:0;padding:0;width:${size}px;height:${size}px;">${sized}</body></html>`);
      const buf = await page.screenshot({ omitBackground: false });
      const outPath = join(ROOT, "app", "icons", `icon-${purpose}-${size}.png`);
      writeFileSync(outPath, buf);
      written.push(outPath);
      await page.close();
    }
  }
  await browser.close();
  return written;
}

if (process.argv[1] && process.argv[1].endsWith("generate-icons.mjs")) {
  const written = await generateIcons();
  console.log(`wrote ${written.length} icon(s):\n` + written.map((p) => `  ${p}`).join("\n"));
}
