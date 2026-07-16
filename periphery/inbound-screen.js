// Role: the inbound gate's own review screen (Phase KG-6c). The update list (new claims, grade
//   moves, contradictions against held claims, and a governance-hash mismatch banner) with bulk
//   accept-all/accept-selected/hold-selected actions and a per-item inspect link into the actual
//   claim card; a held list, separately, of every declined change still on record.
// Contract: renderUpdateList(container, { pending, stillHeld, governanceMismatch,
//   epistemicCostOn, epistemicCostReport, onAcceptAll, onAcceptSelected, onHoldSelected,
//   onAcceptHeld, onToggleEpistemicCost, onAdoptGovernanceHash, onBack }). onAcceptHeld(identity)
//   accepts a held item directly, at its own currently-declined grade, without waiting for further
//   motion (nothing held is ever a dead end). renderHeldList(container, { stillHeld, onAcceptHeld,
//   onReconsiderAll, onBack }): reconsidering moves every still-held item back into the ordinary
//   pending update list on the next render (the caller's own concern; this module only asks).
// Invariant: renders only what it is given; no storage or network access, no gate call. A held item
//   is shown here, never hidden or silently dropped, exactly as its own governing prompt requires.
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

function motionLabel(entry) {
  return entry.type === "new" ? `arrives as: ${entry.toGrade}` : `${entry.fromGrade} -> ${entry.toGrade}`;
}

export function renderUpdateList(container, {
  pending, stillHeld, governanceMismatch, epistemicCostOn, epistemicCostReport,
  onAcceptAll, onAcceptSelected, onHoldSelected, onAcceptHeld, onToggleEpistemicCost, onAdoptGovernanceHash, onBack,
}) {
  container.innerHTML = "";
  const backBtn = el("button", { type: "button", class: "contribute-back" }, "Back to the feed");
  backBtn.addEventListener("click", () => onBack && onBack());

  const checked = new Set();

  const list = el(
    "ul",
    { class: "update-list" },
    ...pending.map((entry) => {
      const cb = el("input", {
        type: "checkbox", "aria-label": `select ${entry.statement}`,
        onchange: (e) => { if (e.target.checked) checked.add(entry.identity); else checked.delete(entry.identity); },
      });
      return el(
        "li",
        { class: "update-item" },
        cb,
        el("a", { class: "claim-link", href: `#claim=${entry.identity}` }, entry.statement),
        el("span", { class: "update-motion" }, ` ${motionLabel(entry)}`),
        entry.contradictsHeld ? el("span", { class: "update-contradicts" }, ` (contradicts a claim you have held)`) : null
      );
    })
  );

  container.appendChild(
    el(
      "section",
      { class: "inbound-update-screen", "aria-label": "Update list" },
      el("h2", {}, "Updates"),
      backBtn,
      governanceMismatch
        ? el(
            "div",
            { class: "governance-mismatch-banner" },
            el("p", {}, `These changes arrive under a governance hash you have not adopted: ${governanceMismatch.current} (you adopted ${governanceMismatch.adopted || "none yet"}).`),
            el("button", { type: "button", onclick: onAdoptGovernanceHash }, "Adopt this governance hash")
          )
        : null,
      el("p", { class: "update-pending" }, `${pending.length} change(s) pending your review.`),
      pending.length
        ? el(
            "div",
            { class: "update-actions" },
            el("button", { type: "button", onclick: onAcceptAll }, "Accept all"),
            el("button", { type: "button", onclick: () => onAcceptSelected([...checked]) }, "Accept selected"),
            el("button", { type: "button", onclick: () => onHoldSelected([...checked]) }, "Hold selected")
          )
        : el("p", { class: "empty" }, "Nothing pending. Your working view already matches the community."),
      pending.length ? list : null,
      el(
        "label",
        { class: "epistemic-cost-toggle-label" },
        el("input", { type: "checkbox", checked: epistemicCostOn ? true : undefined, onchange: (e) => onToggleEpistemicCost(e.target.checked) }),
        " Show these grades under my adopted parameters too"
      ),
      epistemicCostOn && epistemicCostReport
        ? el(
            "p",
            { class: "epistemic-cost-line" },
            `Under your adopted parameters: ${epistemicCostReport.recompute.length} of ${pending.length} recompute (${epistemicCostReport.lowered.length} lower), ${epistemicCostReport.untyped.length} arrive untyped.`
          )
        : null,
      el("h3", {}, "Held"),
      el("p", {}, "Nothing here is silently applied or silently dropped: accept a held item now, or leave it held indefinitely; it re-offers on its own the moment its incoming state moves again."),
      stillHeld.length
        ? el(
            "ul",
            { class: "held-list" },
            ...stillHeld.map((h) =>
              el(
                "li",
                { class: "held-item" },
                el("a", { class: "claim-link", href: `#claim=${h.identity}` }, h.statement),
                el("span", { class: "update-motion" }, ` declined at: ${h.declinedGrade}`),
                onAcceptHeld ? el("button", { type: "button", onclick: () => onAcceptHeld(h.identity) }, "Accept") : null
              )
            )
          )
        : el("p", { class: "empty" }, "Nothing held.")
    )
  );
}

export function renderHeldList(container, { stillHeld, onAcceptHeld, onReconsiderAll, onBack }) {
  container.innerHTML = "";
  const backBtn = el("button", { type: "button", class: "contribute-back" }, "Back to the feed");
  backBtn.addEventListener("click", () => onBack && onBack());

  container.appendChild(
    el(
      "section",
      { class: "held-list-screen", "aria-label": "Held updates" },
      el("h2", {}, "Held updates"),
      backBtn,
      el("p", {}, "Declined changes stay here, never silently dropped. A held claim whose incoming state moves again since you declined it returns to the update list on its own."),
      stillHeld.length
        ? el(
            "div",
            {},
            el("button", { type: "button", onclick: onReconsiderAll }, "Reconsider all"),
            el(
              "ul",
              { class: "held-list" },
              ...stillHeld.map((h) =>
                el(
                  "li",
                  { class: "held-item" },
                  el("a", { class: "claim-link", href: `#claim=${h.identity}` }, h.statement),
                  el("span", { class: "update-motion" }, ` declined at: ${h.declinedGrade}`)
                )
              )
            )
          )
        : el("p", { class: "empty" }, "Nothing held.")
    )
  );
}
