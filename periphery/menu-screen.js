// Role: the Menu page (Phase KG-7, the interface pass). Everything not always-visible chrome lives
//   here, one tap away: the objective vector editor, the filter page, alerts, vault, extensions, the
//   contestable dashboard, the assistant (Phase KG-9), the kernel designer (Phase KG-10), the
//   submission reading surface (Phase KG-11).
// Contract: renderMenuScreen(container, { hasAlerts, onNavigate }). onNavigate(view) is called with
//   one of "objective"/"filters"/"alerts"/"vault"/"outbox"/"extensions"/"dashboard"/"assistant"/
//   "designer"/"submission". hasAlerts shows an unread dot next to Alerts when the standing-motion
//   gap report has content.
// Invariant: renders only a navigation list; no logic of its own beyond presentation.
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

const ITEMS = [
  { view: "objective", label: "Objective vector" },
  { view: "filters", label: "Filters" },
  { view: "alerts", label: "Alerts" },
  { view: "vault", label: "Vault" },
  { view: "outbox", label: "Outbox" },
  { view: "extensions", label: "Extensions" },
  { view: "assistant", label: "Assistant" },
  { view: "dashboard", label: "Dashboard" },
  { view: "designer", label: "Found a community" },
  { view: "submission", label: "Read the submission" },
];

export function renderMenuScreen(container, { hasAlerts, onNavigate }) {
  container.innerHTML = "";
  container.appendChild(
    el(
      "section",
      { class: "menu-screen", "aria-label": "Menu" },
      el("h2", {}, "Menu"),
      el(
        "ul",
        { class: "menu-list" },
        ...ITEMS.map((item) =>
          el(
            "li",
            {},
            el(
              "button",
              { type: "button", onclick: () => onNavigate(item.view) },
              item.label,
              item.view === "alerts" && hasAlerts ? el("span", { class: "menu-unread-dot" }) : null
            )
          )
        )
      )
    )
  );
}
