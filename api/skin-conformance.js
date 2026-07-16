// Role: the skin contract's own re-runnable oracle (Phase KG-12), factored out of build/check-
//   skins.mjs (which imports and calls this exact function, never a second implementation) so the
//   registry's live re-run (periphery/registry-screen.js) and the CLI check share one computation. A
//   skin is a token set, never structure (Phase KG-8); this module verifies exactly the numeric half
//   of that claim: every declared token role is present, the grade scale is monotonic along its own
//   declared axis, and every text/surface pairing is legible (WCAG contrast). The structural half
//   (the grade word and the triad's distinguishing classes live in periphery/card.js and app/
//   style.css's own selectors, never behind a skin-keyed rule) stays in build/check-skins.mjs itself,
//   since it greps this repository's own source rather than testing a candidate artifact.
// Contract: checkSkinConformance(skin) -> { pass: boolean, checks: [{name, pass, detail}] }. skin is
//   one of api/skins.js's own SKINS entries ({id, variants: {light, dark}}).
// Invariant: pure; no import beyond api/skins.js's own TOKEN_ROLES/GRADE_ROLES. The epsilon absorbs
//   Ledger's own real, pre-existing, imperceptible non-monotonic step (see build/check-skins.mjs's own
//   comment); anything past this margin is a genuine reversal, not noise.
"use strict";
import { TOKEN_ROLES, GRADE_ROLES } from "./skins.js";

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

const MONOTONICITY_EPSILON_LSTAR = 1.0;

export function checkSkinConformance(skin) {
  const checks = [];
  const push = (name, pass, detail) => checks.push({ name, pass, detail });

  for (const variantName of ["light", "dark"]) {
    const tokens = skin.variants && skin.variants[variantName];
    if (!tokens) { push(`${variantName}: variant present`, false, "variant is missing entirely"); continue; }

    for (const role of TOKEN_ROLES) {
      push(`${variantName}: declares "${role}"`, typeof tokens[role] === "string" && tokens[role].length > 0, tokens[role] || "(absent)");
    }
    push(`${variantName}: gradeDirection declared`, tokens.gradeDirection === "increasing" || tokens.gradeDirection === "decreasing", String(tokens.gradeDirection));

    const lStars = GRADE_ROLES.map((role) => ({ role, l: lStar(tokens[role]) }));
    for (const { role, l } of lStars) push(`${variantName}: "${role}" is a readable hex color`, l !== null, tokens[role]);
    let monotonic = true;
    const violations = [];
    for (let i = 1; i < lStars.length; i++) {
      const prev = lStars[i - 1], cur = lStars[i];
      if (prev.l === null || cur.l === null) continue;
      const delta = cur.l - prev.l;
      const wrongWay = tokens.gradeDirection === "increasing" ? delta < -MONOTONICITY_EPSILON_LSTAR : delta > MONOTONICITY_EPSILON_LSTAR;
      if (wrongWay) { monotonic = false; violations.push(`${prev.role} (L*=${prev.l.toFixed(2)}) -> ${cur.role} (L*=${cur.l.toFixed(2)})`); }
    }
    push(`${variantName}: grade scale monotonic (${tokens.gradeDirection})`, monotonic, violations.join("; ") || "no reversal beyond tolerance");

    const inkContrast = contrastRatio(tokens.ink, tokens["card-bg"]);
    push(`${variantName}: ink vs card-bg >= 4.5:1`, inkContrast !== null && inkContrast >= 4.5, inkContrast && inkContrast.toFixed(2));
    const inkMutedContrast = contrastRatio(tokens["ink-muted"], tokens["card-bg"]);
    push(`${variantName}: ink-muted vs card-bg >= 3.0:1`, inkMutedContrast !== null && inkMutedContrast >= 3.0, inkMutedContrast && inkMutedContrast.toFixed(2));
    for (const role of GRADE_ROLES) {
      const c = contrastRatio(tokens[role], tokens["card-bg"]);
      push(`${variantName}: "${role}" vs card-bg >= 1.3:1`, c !== null && c >= 1.3, c && c.toFixed(2));
    }
    const onAccentContrast = contrastRatio(tokens["on-accent"], tokens.focus);
    push(`${variantName}: on-accent vs focus >= 2.0:1`, onAccentContrast !== null && onAccentContrast >= 2.0, onAccentContrast && onAccentContrast.toFixed(2));
  }

  return { pass: checks.every((c) => c.pass), checks };
}
