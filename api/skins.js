// Role: the skin registry (Phase KG-8). A skin is a token set under a contract, never structure: no
//   skin here changes layout, information architecture, or behavior, only the CSS custom-property
//   values applied at the document root. Two skins ship: Ledger (this app's original look, preserved
//   token-for-token from before this phase) and Trellis (drawn from the grapevine-monogram mark's own
//   sampled palette). Third-party skins are a future renderer-seam concern (parallel to
//   api/extension.js's ranker/renderer sandbox), not built here.
// Contract: TOKEN_ROLES (every custom-property name a skin must declare). GRADE_ROLES (the seven
//   lattice-order roles, in ladder order, ungraded first). SKINS (array of {id, label, gradeAxis,
//   variants: {light, dark}}, each variant an object with every TOKEN_ROLES key plus its own
//   `gradeDirection` ("decreasing" or "increasing": which way L* moves from ungraded to constitutive
//   in that variant, since a dark surface reasonably re-anchors the axis so the peak grade is the
//   brightest thing in the room rather than the darkest). resolveVariant(skin, prefersDark) -> "light"
//   | "dark". tokensFor(skinId, variant) -> the token object, or null if either name is unknown.
// Invariant: PURE. No DOM, no storage, no network; applying a skin's tokens to the document is
//   periphery/skin-apply.js's job, never this module's. build/check-skins.mjs imports this registry
//   directly (the same object the runtime applies), never a parallel description of it, so the check
//   and the render can never silently drift apart.
"use strict";

export const GRADE_ROLES = [
  "grade-ungraded",
  "grade-asserted",
  "grade-supported",
  "grade-corroborated",
  "grade-checked",
  "grade-independently-rechecked",
  "grade-constitutive",
];

export const TOKEN_ROLES = [
  "paper", "ink", "ink-muted", "line", "card-bg", "focus", "danger", "on-accent",
  ...GRADE_ROLES,
  "radius", "motion", "card-padding", "focus-ring-shadow", "font-family",
];

export const SKINS = [
  {
    id: "ledger",
    label: "Ledger",
    gradeAxis: "gray through blue to deep green, violet at the peak; this app's original scale, unchanged by this phase",
    variants: {
      light: {
        paper: "#f7f5f0", ink: "#16181c", "ink-muted": "#55595f", line: "#d8d4c8", "card-bg": "#ffffff",
        focus: "#2f6df0", danger: "#b3392c", "on-accent": "#ffffff",
        "grade-ungraded": "#9a9a94", "grade-asserted": "#8a8f98", "grade-supported": "#5f8fae",
        "grade-corroborated": "#3f7fae", "grade-checked": "#2c8a5f", "grade-independently-rechecked": "#1f6f4a",
        "grade-constitutive": "#6a4fae",
        radius: "14px", motion: "180ms", "card-padding": "1rem 1.1rem",
        "focus-ring-shadow": "0 0 0 3px rgba(47, 109, 240, 0.25)",
        "font-family": 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        gradeDirection: "decreasing",
      },
      dark: {
        paper: "#12140f", ink: "#f1efe8", "ink-muted": "#b7b3a6", line: "#33362c", "card-bg": "#1b1e17",
        focus: "#7aa2ff", danger: "#b3392c", "on-accent": "#ffffff",
        "grade-ungraded": "#9a9a94", "grade-asserted": "#8a8f98", "grade-supported": "#5f8fae",
        "grade-corroborated": "#3f7fae", "grade-checked": "#2c8a5f", "grade-independently-rechecked": "#1f6f4a",
        "grade-constitutive": "#6a4fae",
        radius: "14px", motion: "180ms", "card-padding": "1rem 1.1rem",
        "focus-ring-shadow": "0 0 0 3px rgba(122, 162, 255, 0.25)",
        "font-family": 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        gradeDirection: "decreasing",
      },
    },
  },
  {
    id: "trellis",
    label: "Trellis",
    gradeAxis: "cream through sage and olive to deep green, into muted plum at the peak, in the light variant; re-anchored bright-side up (muted olive to luminous plum) in the dark variant, sampled from the grapevine monogram's own palette",
    variants: {
      light: {
        paper: "#faf2e7", ink: "#262410", "ink-muted": "#6b6a4a", line: "#ddd6bd", "card-bg": "#fffaf2",
        focus: "#5a3c46", danger: "#8a3a2c", "on-accent": "#faf2e7",
        "grade-ungraded": "#cdc7b0", "grade-asserted": "#b3ad86", "grade-supported": "#96925f",
        "grade-corroborated": "#74753f", "grade-checked": "#545424", "grade-independently-rechecked": "#303018",
        "grade-constitutive": "#3a2530",
        radius: "20px", motion: "180ms", "card-padding": "1.15rem 1.3rem",
        "focus-ring-shadow": "0 0 0 3px rgba(90, 60, 70, 0.25)",
        "font-family": 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        gradeDirection: "decreasing",
      },
      dark: {
        paper: "#14170f", ink: "#f3ead9", "ink-muted": "#b8b49a", line: "#34381f", "card-bg": "#1c2015",
        focus: "#d8aed0", danger: "#c9584a", "on-accent": "#241018",
        "grade-ungraded": "#3a3d28", "grade-asserted": "#4d5030", "grade-supported": "#63682e",
        "grade-corroborated": "#7c8a2e", "grade-checked": "#9aa632", "grade-independently-rechecked": "#b8b878",
        "grade-constitutive": "#d8aed0",
        radius: "20px", motion: "180ms", "card-padding": "1.15rem 1.3rem",
        "focus-ring-shadow": "0 0 0 3px rgba(216, 174, 208, 0.25)",
        "font-family": 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        gradeDirection: "increasing",
      },
    },
  },
];

export function findSkin(skinId) {
  return SKINS.find((s) => s.id === skinId) || null;
}

export function tokensFor(skinId, variant) {
  const skin = findSkin(skinId);
  if (!skin || !skin.variants[variant]) return null;
  return skin.variants[variant];
}

// which variant a skin resolves to, given whether the system currently prefers dark: every skin
// respects prefers-color-scheme within itself, never overriding it with a fixed choice.
export function resolveVariant(skinId, prefersDark) {
  const skin = findSkin(skinId);
  if (!skin) return "light";
  return prefersDark && skin.variants.dark ? "dark" : "light";
}
