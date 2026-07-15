// Role: the three-state contribution ladder (spec Section 7 / ecosystem-guide.md "For a contributor").
//   Gate-passed, admitted, semantically accepted: distinct states, distinct labels, and no state
//   implies the next. Rendered wherever a contribution's status is shown, so the ladder is the same
//   object everywhere rather than three ad hoc pieces of prose.
// Contract: STATES (ordered array of {id, label, caption}); renderLadder(currentId) -> HTMLElement.
//   currentId is the highest state actually reached; later states render as not-yet-reached, never as
//   pending-but-implied.
// Invariant: the words true, validated, verified, and accepted never appear in the rendering of the
//   first two states (gate-passed, admitted); "accepted" appears only inside the third state's own
//   label ("semantically accepted"), because that state IS semantic acceptance and nothing else. No
//   rendering of a lower state ever contains a higher state's label.
"use strict";

export const STATES = [
  { id: "gate-passed", label: "Gate-passed", caption: "The proposal grounds structurally against the target's graph. This is mechanical, not a judgment." },
  { id: "admitted", label: "Admitted", caption: "The target kernel's own suite re-ran the gate and merged the patch. This is the community's act, not this app's." },
  { id: "semantically-accepted", label: "Semantically accepted", caption: "Members of the community judged the claim's floors true enough to build on. This is never mechanical, and never this app's to declare." },
];

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") node.className = v;
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children) {
    if (c === undefined || c === null || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

export function renderLadder(currentId) {
  const currentIndex = STATES.findIndex((s) => s.id === currentId);
  return el(
    "ol",
    { class: "ladder", "aria-label": "contribution status" },
    ...STATES.map((s, i) => {
      const reached = i <= currentIndex;
      return el(
        "li",
        { class: `ladder-step${reached ? " ladder-reached" : " ladder-unreached"}${i === currentIndex ? " ladder-current" : ""}` },
        el("span", { class: "ladder-label" }, s.label),
        el("span", { class: "ladder-caption" }, s.caption)
      );
    })
  );
}
