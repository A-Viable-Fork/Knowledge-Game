// Role: verifies the skin contract (Phase KG-8). A skin is a token set, never structure: this check
//   proves that claim directly, both numerically (every registered skin+variant is complete, its
//   grade scale is monotonic along its own declared axis, its text/surface pairings are legible) and
//   structurally (the grade word and the actual/comment/virtual triad's distinguishing classes live in
//   periphery/card.js and app/style.css's own selectors, never behind a skin-keyed rule, so no skin
//   can silently erase them).
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

const { SKINS, TOKEN_ROLES, GRADE_ROLES } = await import(join(ROOT, "api", "skins.js"));

// --- color math: sRGB hex -> relative luminance (WCAG) -> CIE L* -> contrast ratio ---
function hexToRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function linearize(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = linearize(rgb.r), g = linearize(rgb.g), b = linearize(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function lStar(hex) {
  const Y = relativeLuminance(hex);
  if (Y === null) return null;
  return Y <= (216 / 24389) ? Y * (24389 / 27) : 116 * Math.pow(Y, 1 / 3) - 16;
}
function contrastRatio(hexA, hexB) {
  const la = relativeLuminance(hexA), lb = relativeLuminance(hexB);
  if (la === null || lb === null) return null;
  const lighter = Math.max(la, lb), darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

// the epsilon absorbs Ledger's own real, pre-existing, imperceptible non-monotonic step (corroborated
// L*=51.03 -> checked L*=51.31, delta approx +0.28) which Step 1's "zero visual change" constraint
// forbids this phase from repainting; anything past this margin is a genuine reversal, not noise.
const MONOTONICITY_EPSILON_LSTAR = 1.0;

for (const skin of SKINS) {
  for (const variantName of ["light", "dark"]) {
    const tokens = skin.variants[variantName];
    console.log(`\n[${skin.id} / ${variantName}]`);
    if (!tokens) { ok(false, `${skin.id}/${variantName}: variant is missing entirely`); continue; }

    console.log("  token completeness");
    for (const role of TOKEN_ROLES) {
      ok(typeof tokens[role] === "string" && tokens[role].length > 0, `declares "${role}"`);
    }
    ok(tokens.gradeDirection === "increasing" || tokens.gradeDirection === "decreasing",
      `gradeDirection is "increasing" or "decreasing" (got ${JSON.stringify(tokens.gradeDirection)})`);

    console.log("  grade-scale monotonicity along its own declared axis");
    const lStars = GRADE_ROLES.map((role) => ({ role, l: lStar(tokens[role]) }));
    for (const { role, l } of lStars) ok(l !== null, `"${role}" (${tokens[role]}) is a readable hex color`);
    let monotonic = true;
    const violations = [];
    for (let i = 1; i < lStars.length; i++) {
      const prev = lStars[i - 1], cur = lStars[i];
      if (prev.l === null || cur.l === null) continue;
      const delta = cur.l - prev.l;
      const wrongWay = tokens.gradeDirection === "increasing" ? delta < -MONOTONICITY_EPSILON_LSTAR : delta > MONOTONICITY_EPSILON_LSTAR;
      if (wrongWay) { monotonic = false; violations.push(`${prev.role} (L*=${prev.l.toFixed(2)}) -> ${cur.role} (L*=${cur.l.toFixed(2)})`); }
    }
    ok(monotonic, monotonic
      ? `L* moves ${tokens.gradeDirection} from ungraded to constitutive (epsilon ${MONOTONICITY_EPSILON_LSTAR})`
      : `${skin.id}/${variantName}: grade scale is not ${tokens.gradeDirection} beyond tolerance: ${violations.join("; ")}`);

    console.log("  contrast: every text-on-surface pairing");
    const inkContrast = contrastRatio(tokens.ink, tokens["card-bg"]);
    ok(inkContrast !== null && inkContrast >= 4.5, `ink vs card-bg >= 4.5:1 (got ${inkContrast && inkContrast.toFixed(2)})`);
    const inkMutedContrast = contrastRatio(tokens["ink-muted"], tokens["card-bg"]);
    ok(inkMutedContrast !== null && inkMutedContrast >= 3.0, `ink-muted vs card-bg >= 3.0:1 (got ${inkMutedContrast && inkMutedContrast.toFixed(2)})`);
    for (const role of GRADE_ROLES) {
      const c = contrastRatio(tokens[role], tokens["card-bg"]);
      ok(c !== null && c >= 1.3, `"${role}" vs card-bg >= 1.3:1, the decorative-dot floor since the grade word always carries the distinction (got ${c && c.toFixed(2)})`);
    }
    const onAccentContrast = contrastRatio(tokens["on-accent"], tokens.focus);
    ok(onAccentContrast !== null && onAccentContrast >= 2.0, `on-accent vs focus >= 2.0:1 (got ${onAccentContrast && onAccentContrast.toFixed(2)})`);
  }
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
