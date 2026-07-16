// Role: applies a skin's tokens to the live document (Phase KG-8). The only place a skin actually
//   touches the DOM; api/skins.js stays pure data, this module is the one periphery-side effect.
// Contract: applySkin(skinId) reads the system's prefers-color-scheme, resolves the matching variant
//   (api/skins.js's resolveVariant), and sets every one of api/skins.js's TOKEN_ROLES as a CSS custom
//   property on document.documentElement. wireSkinPreference() applies the vault's current skin once
//   at boot and re-applies on any system dark/light change, so a skin always follows the system
//   within itself, never overriding it with a fixed choice.
// Invariant: never writes anything but CSS custom properties; touches no storage itself (the caller
//   reads api/settings.js's getSkin() and passes the id in). Applying "ledger" produces the exact
//   values app/style.css's own :root block already declares statically, so a fresh profile (skin
//   defaulting to "ledger") renders identically whether or not this module has run yet.
"use strict";
import { tokensFor, resolveVariant, TOKEN_ROLES } from "../api/skins.js";

export function applySkin(skinId) {
  const prefersDark = typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
  const variant = resolveVariant(skinId, prefersDark);
  const tokens = tokensFor(skinId, variant) || tokensFor("ledger", variant) || tokensFor("ledger", "light");
  const root = document.documentElement;
  for (const role of TOKEN_ROLES) {
    root.style.setProperty(`--${role}`, tokens[role]);
  }
  root.dataset.skin = skinId;
  root.dataset.skinVariant = variant;
}

export function wireSkinPreference(getSkinId) {
  applySkin(getSkinId());
  if (typeof window !== "undefined" && window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applySkin(getSkinId()));
  }
}
