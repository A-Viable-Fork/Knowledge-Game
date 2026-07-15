// Role: the extension screen (spec Section 6). Lists installed extensions by hash with their shape
//   and conformance receipt, offers the two shipped demonstrations (learn-efficiently ranker,
//   contestable dashboard) as one-click installs through the identical public path any pasted
//   candidate source uses, and a generic "install custom source" form. Also renders the dashboard
//   view: the active renderer extension's descriptor turned into live tiles (contest/fork wired
//   host-side; the extension itself never touches the DOM).
// Contract: renderExtensionScreen(container, ctx) -> void. ctx = { extensions, activeRanker,
//   activeRenderer, onInstall(source, shape, label), onUninstall(hash), onSetActiveRanker(hash|null),
//   onSetActiveRenderer(hash|null) }. renderDashboardScreen(container, ctx) -> void. ctx = {
//   descriptor: {tiles}|null, error?, onContribute(action, row) }.
// Invariant: an extension only ever appears here after api/extension.js's checkConformance passed; a
//   failed install shows the reason and installs nothing. No installed source is ever eval'd outside
//   api/extension-sandbox.js's worker.
"use strict";
import { checkConformance, contentHash } from "../api/extension.js";
import { LEARN_EFFICIENTLY_SOURCE, CONTESTABLE_DASHBOARD_SOURCE } from "./demo-extensions.js";

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

const SHAPE_LABELS = { ranker: "ranker / objective component", renderer: "renderer lens", workflow: "workflow mode" };

function extensionRow(entry, ctx) {
  const isActiveRanker = entry.shape === "ranker" && ctx.activeRanker === entry.hash;
  const isActiveRenderer = entry.shape === "renderer" && ctx.activeRenderer === entry.hash;
  return el(
    "li",
    { class: "extension-row" },
    el("p", { class: "extension-label" }, `${entry.label} (${SHAPE_LABELS[entry.shape] || entry.shape})`),
    el("p", { class: "extension-hash" }, `hash: ${entry.hash}`),
    el("p", { class: "extension-conformance" }, `conformance: ${entry.conformance.pass ? "passed" : "failed"} (${(entry.conformance.receipts || []).map((r) => r.probe).join(", ")})`),
    el(
      "div",
      { class: "extension-actions" },
      entry.shape === "ranker"
        ? el("button", { type: "button", onclick: () => ctx.onSetActiveRanker(isActiveRanker ? null : entry.hash) }, isActiveRanker ? "Deactivate ranker" : "Use as active ranker")
        : null,
      entry.shape === "renderer"
        ? el("button", { type: "button", onclick: () => ctx.onSetActiveRenderer(isActiveRenderer ? null : entry.hash) }, isActiveRenderer ? "Deactivate dashboard" : "Use as active dashboard")
        : null,
      el("button", { type: "button", onclick: () => ctx.onUninstall(entry.hash) }, "Uninstall")
    )
  );
}

async function installDemo(source, shape, label, ctx, statusEl) {
  statusEl.textContent = "Checking conformance...";
  const result = await ctx.onInstall(source, shape, label);
  statusEl.textContent = result.pass ? `Installed (hash ${contentHash(source).slice(0, 12)}...)` : `Refused: ${result.reason}`;
}

export function renderExtensionScreen(container, ctx) {
  container.innerHTML = "";
  const statusEl = el("p", { class: "extension-status", "aria-live": "polite" }, "");

  const installedList = (ctx.extensions || []).length
    ? el("ul", { class: "extension-list" }, ...ctx.extensions.map((e) => extensionRow(e, ctx)))
    : el("p", { class: "empty" }, "no extensions installed");

  const demoButtons = el(
    "div",
    { class: "extension-demo-installs" },
    el("button", { type: "button", onclick: () => installDemo(LEARN_EFFICIENTLY_SOURCE, "ranker", "Learn-efficiently ranker (demo)", ctx, statusEl) }, "Install: learn-efficiently ranker"),
    el("button", { type: "button", onclick: () => installDemo(CONTESTABLE_DASHBOARD_SOURCE, "renderer", "Contestable dashboard (demo)", ctx, statusEl) }, "Install: contestable dashboard")
  );

  let customSource = "";
  let customShape = "ranker";
  let customLabel = "";
  const customForm = el(
    "form",
    {
      class: "extension-install-form",
      onsubmit: async (e) => {
        e.preventDefault();
        if (!customSource.trim()) { statusEl.textContent = "source is required"; return; }
        await installDemo(customSource, customShape, customLabel || "custom extension", ctx, statusEl);
      },
    },
    el("h3", {}, "Install a custom extension"),
    el("label", {}, "Shape", el("select", { onchange: (e) => (customShape = e.target.value) }, ...["ranker", "renderer", "workflow"].map((s) => el("option", { value: s, selected: s === customShape ? "" : undefined }, SHAPE_LABELS[s])))),
    el("label", {}, "Label", el("input", { type: "text", oninput: (e) => (customLabel = e.target.value) })),
    el("label", {}, "Source (defines extensionMain(input))", el("textarea", { required: true, rows: "6", oninput: (e) => (customSource = e.target.value) })),
    el("button", { type: "submit" }, "Check conformance and install")
  );

  container.appendChild(
    el(
      "section",
      { class: "extension-screen", "aria-label": "Extensions" },
      el("h2", {}, "Extensions"),
      el("p", {}, "Every extension, first-party or not, loads through this same public path: install-time conformance, sandboxed execution, no exception."),
      installedList,
      statusEl,
      demoButtons,
      customForm
    )
  );
}

export function renderDashboardScreen(container, ctx) {
  container.innerHTML = "";
  if (ctx.error) {
    container.appendChild(el("p", {}, `Dashboard unavailable: ${ctx.error}`));
    return;
  }
  if (!ctx.descriptor) {
    container.appendChild(el("p", {}, "No dashboard extension is active. Install and activate the contestable dashboard from the Extensions screen."));
    return;
  }
  const tiles = ctx.descriptor.tiles || [];
  container.appendChild(
    el(
      "section",
      { class: "dashboard-screen", "aria-label": "Contestable dashboard" },
      el("h2", {}, "Contestable dashboard"),
      el("p", {}, "Every figure below is the claim it is: standing shown, provenance one tap down, contest and fork live."),
      tiles.length
        ? el(
            "div",
            { class: "dashboard-tiles" },
            ...tiles.map((t) =>
              el(
                "article",
                { class: "dashboard-tile" },
                el("p", { class: "dashboard-tile-label" }, t.label),
                el("p", { class: "dashboard-tile-grade" }, `standing: ${t.grade}`),
                el(
                  "div",
                  { class: "dashboard-tile-actions" },
                  el("button", { type: "button", onclick: () => ctx.onContribute("contest", { identity: t.identity, kind: t.kind }) }, "Contest"),
                  el("button", { type: "button", onclick: () => ctx.onContribute("fork", { identity: t.identity, kind: t.kind }) }, "Fork")
                )
              )
            )
          )
        : el("p", { class: "empty" }, "no quantitative claims in this graph")
    )
  );
}
