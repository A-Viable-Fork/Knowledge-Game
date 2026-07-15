// Role: the vault screen. Shows the observation toggle and everything the vault currently holds,
//   with export (a JSON download assembled client-side) and delete-all.
// Contract: renderVaultScreen(container, { observationOn, log, onToggle, onExport, onDeleteAll }).
// Invariant: renders only what api/settings.js reports; this module holds no storage access of its
//   own and no logic beyond presentation, per the membrane (periphery never reaches vault/ directly).
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

export function renderVaultScreen(container, { observationOn, log, onToggle, onExport, onDeleteAll }) {
  container.innerHTML = "";

  const toggle = el("input", {
    type: "checkbox", id: "observation-toggle", checked: observationOn ? true : undefined,
    onchange: (e) => onToggle(e.target.checked),
  });

  const logSection = log.length
    ? el(
        "div",
        {},
        el("p", {}, `${log.length} observation record(s) held.`),
        el("ul", { class: "vault-log" }, ...log.slice(-20).map((e) => el("li", {}, `${e.type} on ${e.kind || "?"} at ${new Date(e.at).toISOString()}`)))
      )
    : el("p", { class: "empty" }, "No observation records held. A fresh profile starts with none.");

  container.appendChild(
    el(
      "section",
      { class: "vault-screen", "aria-label": "Vault and observation settings" },
      el("h2", {}, "Vault"),
      el(
        "p",
        {},
        "Behavioral observation is opt-in and default off. Off means off: nothing is sampled, buffered, or collected while this is unchecked."
      ),
      el(
        "label",
        { class: "observation-toggle-label" },
        toggle,
        " Record dwell and expand events while I read (opt-in, local only)"
      ),
      el("h3", {}, "What the vault holds"),
      logSection,
      el(
        "div",
        { class: "vault-actions" },
        el("button", { onclick: onExport }, "Export everything (JSON)"),
        el("button", { class: "vault-delete", onclick: onDeleteAll }, "Delete all")
      )
    )
  );
}

// assembles and triggers a client-side JSON download; no network call, no server involved.
export function downloadJSON(filename, jsonText) {
  const blob = new Blob([jsonText], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
