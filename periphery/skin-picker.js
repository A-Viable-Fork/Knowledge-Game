// Role: the skin picker (Phase KG-8), on the vault/settings page. Lists every registered skin with a
//   live preview swatch row (surface, text, the grade scale, the accent) drawn from its own light
//   variant's real tokens, never a separate description of them.
// Contract: renderSkinPicker(container, { currentSkin, onChange }). onChange(skinId) persists the
//   choice and re-applies it instantly (periphery/app.js wires the actual DOM application).
// Invariant: the preview swatches are the skin's own api/skins.js token values, read directly, so a
//   drift between a skin's real colors and its preview is structurally impossible.
"use strict";
import { SKINS } from "../api/skins.js";

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children) {
    if (c === undefined || c === null || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

const GRADE_ROLES = [
  "grade-ungraded", "grade-asserted", "grade-supported", "grade-corroborated",
  "grade-checked", "grade-independently-rechecked", "grade-constitutive",
];

function renderSwatchRow(tokens) {
  const dot = (hex) => el("span", { class: "skin-swatch-dot", style: `background:${hex}` });
  return el(
    "div",
    { class: "skin-swatch-row", style: `background:${tokens["card-bg"]}; border-color:${tokens.line}` },
    el("span", { class: "skin-swatch-surface", style: `background:${tokens.paper}` }),
    el("span", { class: "skin-swatch-text", style: `color:${tokens.ink}` }, "Aa"),
    el("span", { class: "skin-swatch-grades" }, ...GRADE_ROLES.map((role) => dot(tokens[role]))),
    el("span", { class: "skin-swatch-accent", style: `background:${tokens.focus}` })
  );
}

export function renderSkinPicker(container, { currentSkin, onChange }) {
  container.innerHTML = "";
  container.appendChild(
    el(
      "div",
      { class: "skin-picker", "aria-label": "Skin" },
      el("h3", {}, "Skin"),
      el(
        "p",
        {},
        "A skin is a token set, never structure: layout, navigation, and behavior stay identical. Light and dark follow the system within whichever skin is chosen. Third-party skins are a future renderer-seam concern, not built here."
      ),
      el(
        "div",
        { class: "skin-options" },
        ...SKINS.map((skin) =>
          el(
            "label",
            { class: "skin-option" },
            el("input", {
              type: "radio", name: "skin-picker", value: skin.id,
              checked: skin.id === currentSkin ? true : undefined,
              onchange: () => onChange(skin.id),
            }),
            el("span", { class: "skin-option-label" }, skin.label),
            renderSwatchRow(skin.variants.light)
          )
        )
      )
    )
  );
}
