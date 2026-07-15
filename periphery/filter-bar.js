// Role: renders the type filter bar, present on every claim-list surface. One checkbox per kind
//   present in the active graph (plus `untyped`), and a exclusion statement naming exactly what is
//   currently hidden and how many rows, so filtering never becomes silent occlusion.
// Contract: renderFilterBar(container, { present, excluded, hidden, onChange }). `present` is
//   api/filter.js's kindsPresent() list; `excluded` the currently-excluded kind names; `hidden` the
//   [{kind, count}] applyFilter() actually hid this render; `onChange(nextExcludedKinds)` called on
//   every checkbox toggle.
// Invariant: a kind present in the graph always gets a control, including `untyped`; the exclusion
//   line renders even when nothing is hidden (stating "hiding nothing"), never omitted.
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

export function renderFilterBar(container, { present, excluded, hidden, onChange }) {
  container.innerHTML = "";
  const excludedSet = new Set(excluded || []);

  const checks = (present || []).map(({ kind, count }) => {
    const checked = !excludedSet.has(kind);
    const input = el("input", {
      type: "checkbox", checked: checked ? true : undefined,
      "aria-label": `Show ${kind}`,
      onchange: (e) => {
        const next = new Set(excludedSet);
        if (e.target.checked) next.delete(kind);
        else next.add(kind);
        onChange([...next]);
      },
    });
    return el(
      "label",
      { class: "filter-kind" },
      input,
      el("span", { class: "filter-kind-name" }, kind),
      el("span", { class: "filter-kind-count" }, ` (${count})`)
    );
  });

  const hiddenList = (hidden || []).filter((h) => h.count > 0);
  const exclusionLine = hiddenList.length
    ? `Hiding ${hiddenList.map((h) => `${h.count} ${h.kind}`).join(", ")}.`
    : "Hiding nothing: every kind present is shown.";

  container.appendChild(
    el(
      "section",
      { class: "filter-bar", "aria-label": "Type filter" },
      el("div", { class: "filter-kinds" }, ...checks),
      el("p", { class: "filter-exclusion-statement", "aria-live": "polite" }, exclusionLine)
    )
  );
}
