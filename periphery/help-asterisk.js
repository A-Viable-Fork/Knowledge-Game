// Role: a reusable help affordance (KG-GLOSSARY). Given a description (and an optional whenToUse),
//   renders an unobtrusive marker beside a control that reveals the text on focus or tap, keyboard-
//   reachable (Enter/Space to open, Escape to dismiss) and dismissible on blur. It takes text and
//   renders it; it holds no vocabulary of its own, so it is the same render path a later screen (the
//   compute picker's manifest popover) reuses over "a thing that carries a description," never
//   specific to grades, kinds, or links.
// Contract: renderHelpAsterisk({ description, whenToUse, label }) -> HTMLElement, a <span> wrapping
//   the marker button and its (initially hidden) panel. The returned node carries setText(description,
//   whenToUse), so a caller (a Kind selector reacting to the composer's choice) can update the panel's
//   content without re-rendering the marker itself. label (optional) names the control for the
//   marker's accessible name.
// Invariant: read-only. It never authors text: description and whenToUse are always supplied by the
//   caller, sourced from the vendored glossary in every real use; this module never invents a string.
"use strict";

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

export function renderHelpAsterisk({ description, whenToUse, label } = {}) {
  const descriptionP = el("p", { class: "help-asterisk-description" }, description || "");
  const whenP = el("p", { class: "help-asterisk-when" }, whenToUse || "");
  if (!whenToUse) whenP.hidden = true;
  const panel = el("div", { class: "help-asterisk-panel", role: "note", hidden: true }, descriptionP, whenP);

  function close() {
    btn.setAttribute("aria-expanded", "false");
    panel.hidden = true;
  }
  function toggle() {
    const open = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", open ? "false" : "true");
    panel.hidden = open;
  }
  const btn = el(
    "button",
    {
      type: "button",
      class: "help-asterisk",
      "aria-expanded": "false",
      "aria-label": label ? `Help: ${label}` : "Help",
      onclick: toggle,
      onkeydown: (e) => { if (e.key === "Escape") close(); },
      // dismiss once focus actually leaves the marker, after giving a click inside the panel a
      // chance to land first; the panel carries no focusable control today, so this is the marker's
      // own blur, not a focus-trap.
      onblur: () => { setTimeout(close, 150); },
    },
    "*"
  );

  const wrap = el("span", { class: "help-asterisk-wrap" }, btn, panel);
  wrap.setText = (nextDescription, nextWhenToUse) => {
    descriptionP.textContent = nextDescription || "";
    whenP.textContent = nextWhenToUse || "";
    whenP.hidden = !nextWhenToUse;
  };
  return wrap;
}
