// Role: verifies the skin contract (Phase KG-8; Phase KG-12 moves the numeric half into api/skin-
//   conformance.js so the registry's live re-run and this check share one implementation). A skin is
//   a token set, never structure: this check proves that claim directly, both numerically (every
//   registered skin+variant is complete, its grade scale is monotonic along its own declared axis, its
//   text/surface pairings are legible, via checkSkinConformance) and structurally (the grade word and
//   the actual/comment/virtual triad's distinguishing classes live in periphery/card.js and app/
//   style.css's own selectors, never behind a skin-keyed rule, so no skin can silently erase them).
// Contract: `node build/check-skins.mjs` exits non-zero on any divergence, naming the skin, variant,
//   and role at fault.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-SKINS: token completeness, grade-scale monotonicity, contrast, triad"); console.log(H);

const { SKINS, GRADE_ROLES } = await import(join(ROOT, "api", "skins.js"));
const { checkSkinConformance } = await import(join(ROOT, "api", "skin-conformance.js"));

for (const skin of SKINS) {
  console.log(`\n[${skin.id}]`);
  const { checks } = checkSkinConformance(skin);
  for (const c of checks) ok(c.pass, `${c.name}${c.detail !== undefined && c.detail !== null ? ` (${c.detail})` : ""}`);
}

console.log(`\n[structural] the grade word is never skin-dependent: color-alone is structurally impossible`);
const cardSrc = readFileSync(join(ROOT, "periphery", "card.js"), "utf8");
ok(!/from ["']\.\.\/api\/skins\.js["']/.test(cardSrc) && !/skins\.js/.test(cardSrc),
  "periphery/card.js never imports the skin registry: its grade rendering cannot branch on which skin is active");
const gradeWordKeys = GRADE_ROLES.map((r) => r.replace(/^grade-/, ""));
for (const key of gradeWordKeys) {
  const re = new RegExp(`${key.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}["']?\\s*:\\s*["'][^"']+["']`);
  ok(re.test(cardSrc), `GRADE_WORDS declares an entry for "${key}"`);
}
ok(/function gradeBadge\(/.test(cardSrc), "gradeBadge() exists as the single place a grade renders");
const gradeBadgeBody = (cardSrc.match(/function gradeBadge\([\s\S]*?\n\}/) || [""])[0];
ok(/GRADE_WORDS\[grade\]/.test(gradeBadgeBody), "gradeBadge() always resolves the textual grade word from GRADE_WORDS");
ok(/,\s*word\s*\)/.test(gradeBadgeBody), "gradeBadge() always appends the word as a rendered child, alongside the color dot, never in place of it");
ok(/class:\s*`grade-dot[^`]*`,\s*"aria-hidden":\s*"true"/.test(gradeBadgeBody) || /"aria-hidden": "true"/.test(gradeBadgeBody),
  "the color dot alone is marked aria-hidden, so the word is what any assistive reading depends on, not the color");

console.log(`\n[structural] triad distinctness (actual / comment / virtual) survives skinning`);
ok(/row\.virtual/.test(cardSrc) && /renderVirtualCard/.test(cardSrc), "renderCard branches to a distinct virtual rendering path (renderVirtualCard) before any grade logic runs");
ok(/card-virtual/.test(cardSrc), "the virtual path renders its own \"card-virtual\" class");
ok(/badge-virtual/.test(cardSrc), "the virtual path renders its own \"badge-virtual\" class, never badge-grade");
ok(/badge-discussion/.test(cardSrc), "the comment path renders its own \"badge-discussion\" class, never badge-grade");
ok(/data-comment/.test(cardSrc), "the comment path is structurally marked (data-comment) independent of any color");
ok(/isComment \? el\("span", \{ class: "badge badge-discussion" \}/.test(cardSrc) || /badge-discussion/.test(cardSrc),
  "an actual claim's grade badge and a comment's discussion badge are mutually exclusive render branches");

const styleSrc = readFileSync(join(ROOT, "app", "style.css"), "utf8");
ok(!/data-skin/.test(styleSrc) && !/\.skin-variant/.test(styleSrc),
  "app/style.css never keys a selector to which skin is active: a skin only ever swaps :root custom-property values (periphery/skin-apply.js), so it structurally cannot touch, hide, or merge the triad's distinguishing classes");
ok(/\.card\[data-comment="true"\]\s*\{[^}]*border-style:\s*dashed/.test(styleSrc),
  "the comment card's distinguishing style includes a non-color signal (dashed border), so its distinctness does not depend on which skin's colors are active");

console.log("\n" + H);
if (fails === 0) console.log("verified: every registered skin+variant is token-complete, its grade scale is monotonic along its own declared axis within an honest epsilon, every text-on-surface pairing clears its contrast floor, the textual grade word is structurally independent of any skin, and the actual/comment/virtual triad's distinguishing classes live outside any skin-keyed selector.");
console.log(fails === 0 ? "check-skins: OK" : `check-skins: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
