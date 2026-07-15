// Role: renders the standing-motion alerts panel (spec Section 6). One line per watched claim whose
//   grade moved since the last load, naming the prior and current grade; a claim whose grade collapsed
//   to ungraded is marked distinctly, still as grade motion, never a separate claim about the world.
// Contract: renderAlertsPanel(container, { alerts }). `alerts` is api/alerts.js's computeAlerts()
//   output. Renders nothing (an empty, present panel) when there are no alerts, never omitting the
//   mount so a reader can tell alerts are being watched, not merely absent from the page.
// Invariant: reports grade motion only; no engagement chrome, no counts of who else is watching.
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

export function renderAlertsPanel(container, { alerts }) {
  container.innerHTML = "";
  if (!alerts || !alerts.length) {
    container.appendChild(el("p", { class: "alerts-empty", "aria-live": "polite" }, "No standing motion on watched claims since your last visit."));
    return;
  }
  container.appendChild(
    el(
      "section",
      { class: "alerts-panel", "aria-label": "Standing-motion alerts", "aria-live": "polite" },
      el("h2", {}, "Standing motion"),
      el(
        "ul",
        { class: "alerts-list" },
        ...alerts.map((a) =>
          el(
            "li",
            { class: "alerts-item" },
            el("a", { class: "claim-link", href: `#claim=${a.identity}` }, a.statement),
            el("span", { class: "alerts-motion" }, ` ${a.priorGrade} -> ${a.currentGrade}`),
            a.collapsed ? el("span", { class: "alerts-collapsed" }, " (support collapsed)") : null
          )
        )
      )
    )
  );
}
