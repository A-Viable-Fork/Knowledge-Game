// Role: the vault screen. Shows the observation toggle and everything the vault currently holds,
//   with export (a JSON download assembled client-side) and delete-all. Phase KG-6b adds the pins
//   list (which communities are pinned for offline reading, at what snapshot age, with unpin) and the
//   sync policy control (manual, wifi-only, automatic; a vault-held setting per this phase's own "no
//   silent sync" discipline).
// Contract: renderVaultScreen(container, { observationOn, log, onToggle, onExport, onDeleteAll, pins,
//   onUnpin, syncPolicy, onSyncPolicyChange, currentSkin, onSkinChange }). pins is api/pins.js's
//   listPins() output, each {communityId, snapshotHash, pinnedAt}; onUnpin(communityId) unpins.
//   syncPolicy is one of "manual"/"wifi-only"/"automatic"; onSyncPolicyChange(next) persists it.
//   currentSkin/onSkinChange (Phase KG-8) wire periphery/skin-picker.js's own picker, rendered here
//   since this screen is this app's own settings page.
// Invariant: renders only what api/settings.js and api/pins.js report; this module holds no storage
//   access of its own and no logic beyond presentation, per the membrane (periphery never reaches
//   vault/ directly).
"use strict";
import { renderSkinPicker } from "./skin-picker.js";

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

function pinAgeLabel(pinnedAt) {
  const days = Math.floor((Date.now() - pinnedAt) / (24 * 60 * 60 * 1000));
  return days < 1 ? "pinned less than a day ago" : `pinned ${days} day${days === 1 ? "" : "s"} ago`;
}

function renderPinsSection(pins, onUnpin) {
  return el(
    "div",
    { class: "pins-section" },
    el("h3", {}, "Pinned communities"),
    pins.length
      ? el(
          "ul",
          { class: "pins-list" },
          ...pins.map((p) =>
            el(
              "li",
              {},
              el("span", {}, `${p.communityId} (snapshot ${p.snapshotHash.slice(0, 12)}..., ${pinAgeLabel(p.pinnedAt)})`),
              onUnpin ? el("button", { type: "button", onclick: () => onUnpin(p.communityId) }, "Unpin") : null
            )
          )
        )
      : el("p", { class: "empty" }, "No community is pinned. Pinning locks a community's snapshot into this device's cache for deliberate offline reading.")
  );
}

const SYNC_POLICIES = [
  { id: "manual", label: "Manual (sync only when I ask)" },
  { id: "wifi-only", label: "Wifi-only" },
  { id: "automatic", label: "Automatic" },
];

function renderSyncPolicySection(syncPolicy, onSyncPolicyChange) {
  return el(
    "div",
    { class: "sync-policy-section" },
    el("h3", {}, "Sync policy"),
    el(
      "p",
      {},
      "Offline is this app's default state; online is a pair of transport verbs you choose, never an ambient assumption. No sync ever runs silently outside this setting, except the sync-now action, which is always yours to press."
    ),
    el(
      "fieldset",
      { class: "sync-policy-options" },
      ...SYNC_POLICIES.map((p) =>
        el(
          "label",
          {},
          el("input", { type: "radio", name: "sync-policy", value: p.id, checked: p.id === syncPolicy ? true : undefined, onchange: () => onSyncPolicyChange(p.id) }),
          " " + p.label
        )
      )
    )
  );
}

export function renderVaultScreen(container, { observationOn, log, onToggle, onExport, onDeleteAll, pins, onUnpin, syncPolicy, onSyncPolicyChange, currentSkin, onSkinChange }) {
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
      pins ? renderPinsSection(pins, onUnpin) : null,
      syncPolicy ? renderSyncPolicySection(syncPolicy, onSyncPolicyChange) : null,
      el("div", { class: "skin-picker-mount" }),
      el(
        "div",
        { class: "vault-actions" },
        el("button", { onclick: onExport }, "Export everything (JSON)"),
        el("button", { class: "vault-delete", onclick: onDeleteAll }, "Delete all")
      )
    )
  );

  if (currentSkin) {
    renderSkinPicker(container.querySelector(".skin-picker-mount"), { currentSkin, onChange: onSkinChange });
  }
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
