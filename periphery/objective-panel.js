// Role: renders the objective vector panel, always visible above the feed. One weight control per
//   component (0 to 3, 0 is off), a reset to the null order, and the epistemic-cost report for the
//   active feed viewed under the other available community's parameters.
// Contract: renderObjectivePanel(container, { components, weights, onWeightsChange, costSummary,
//   activeExtensionRanker }). `components` is api/ranking.js's COMPONENTS; `weights` the current
//   stored vector; `onWeightsChange(nextWeights)` called on every control change; `costSummary` the
//   epistemic-cost report's rendered line, or null while it is still computing; `activeExtensionRanker`
//   the installed extension's label if one is ordering the feed instead of these native weights
//   (Phase KG-4), or null.
// Invariant: every component renders, including the ones permanently inert this phase (recent
//   changes, validation-expertise match, followed topics) and engagement (inert while observation is
//   off); each states why in place, never omitted and never silently scored as zero without saying so.
//   The active ranking objective is always visible (claim 2): when an extension ranker is active, the
//   summary line names it explicitly rather than reporting "null order" while something else is
//   actually ordering the feed; the native weight controls stay visible and honest about their own
//   (unconsulted) state underneath it.
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

export function renderObjectivePanel(container, { components, weights, onWeightsChange, costSummary, observationOn, activeExtensionRanker }) {
  container.innerHTML = "";
  const isZero = components.every((c) => !(weights[c.id] || 0));

  const rows = components.map((c) => {
    const inertNow = c.alwaysInert || (c.inertWhileObservationOff && !observationOn);
    const weight = weights[c.id] || 0;
    const input = el("input", {
      type: "range", min: "0", max: "3", step: "1", value: String(weight),
      "aria-label": `${c.label} weight, 0 to 3`,
      disabled: inertNow ? true : undefined,
      oninput: (e) => {
        const next = { ...weights, [c.id]: Number(e.target.value) };
        onWeightsChange(next);
      },
    });
    return el(
      "div",
      { class: "objective-row", "data-inert": inertNow ? "true" : undefined },
      el("label", { class: "objective-label" }, c.label),
      input,
      el("span", { class: "objective-weight" }, String(weight)),
      inertNow ? el("span", { class: "objective-inert-note" }, "inert this phase") : null
    );
  });

  const summary = el(
    "p",
    { class: "objective-summary" },
    activeExtensionRanker
      ? `Extension ranker active: ${activeExtensionRanker}. The native weights below are not being consulted; deactivate it from the Extensions screen to return to them.`
      : isZero
        ? "Null order active: grounding, then recency, then the identity-hash tiebreak. No objective component is being consulted."
        : "Weighted order active. Tap a card for the components that placed it."
  );

  const resetBtn = el("button", { class: "objective-reset", onclick: () => onWeightsChange({}) }, "Reset to null order");

  container.appendChild(
    el(
      "section",
      { class: "objective-panel", "aria-label": "Ranking objective" },
      el("h2", {}, "Your objective"),
      summary,
      el("div", { class: "objective-rows" }, ...rows),
      resetBtn,
      el("p", { class: "epistemic-cost", "aria-live": "polite" }, costSummary || "Computing the epistemic-cost report...")
    )
  );
}
