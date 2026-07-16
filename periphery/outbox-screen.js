// Role: the outbox screen (Phase KG-6b). Lists every queued, submitted, and demoted-to-draft bundle
//   this device holds, with the batched push action and per-entry discard. A demoted entry shows the
//   fresh gate feedback that demoted it (periphery/gate-feedback.js's describeReceipt), never the bare
//   word "declined" alone, matching the discipline periphery/contribute-screen.js already holds for a
//   first-time draft.
// Contract: renderOutboxScreen(container, { entries, lastSyncedAt, pending, onPush, onDiscard,
//   onBack }). entries is api/outbox.js's listOutbox() output. pending is entries.length, shown
//   plainly so a reader sees the gap the moment they open this screen.
// Invariant: renders only what it is given; no storage access, no gate call, no network call of its
//   own. Every entry's own snapshot age is labeled ("as of your snapshot, N days old"), never a bare
//   timestamp.
"use strict";
import { describeReceipt } from "./gate-feedback.js";
import { labelFor } from "./virtual-states.js";

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

function stalenessLabel(atMs) {
  if (!atMs) return "no snapshot recorded yet";
  const days = Math.floor((Date.now() - atMs) / (24 * 60 * 60 * 1000));
  return days < 1 ? "as of your snapshot, less than a day old" : `as of your snapshot, ${days} day${days === 1 ? "" : "s"} old`;
}

const VIRTUAL_STATE_OF_STATUS = { queued: "gate-passed", submitted: "submitted", draft: "drafted" };

function renderEntry(entry, onDiscard) {
  const snapshotAt = (entry.lastRegate && entry.lastRegate.at) || entry.queuedAt;
  const claim = (entry.bundle.proposal.entries || [])[0] || {};
  const feedback = entry.status === "draft" && entry.lastRegate ? describeReceipt(entry.lastRegate.receipt) : null;
  return el(
    "li",
    { class: "outbox-entry" },
    el("p", { class: "outbox-statement" }, claim.statement || entry.contributionId),
    el("p", { class: "outbox-state" }, labelFor(VIRTUAL_STATE_OF_STATUS[entry.status] || "drafted")),
    el("p", { class: "outbox-staleness" }, stalenessLabel(snapshotAt)),
    feedback
      ? el(
          "div",
          { class: "outbox-feedback" },
          el("p", {}, "Demoted back to draft: the last re-check against a fresh snapshot did not pass."),
          feedback.missing.length ? el("ul", {}, ...feedback.missing.map((m) => el("li", {}, m))) : null,
          feedback.wouldGround.length ? el("ul", { class: "would-ground" }, ...feedback.wouldGround.map((m) => el("li", {}, m))) : null
        )
      : null,
    el("button", { type: "button", class: "outbox-discard", onclick: () => onDiscard(entry.contributionId) }, "Discard")
  );
}

export function renderOutboxScreen(container, { entries, onPush, onDiscard, onBack }) {
  container.innerHTML = "";
  const backBtn = el("button", { type: "button", class: "contribute-back" }, "Back to the feed");
  backBtn.addEventListener("click", () => onBack && onBack());

  container.appendChild(
    el(
      "section",
      { class: "outbox-screen", "aria-label": "Outbox" },
      el("h2", {}, "Outbox"),
      backBtn,
      el("p", { class: "outbox-pending" }, `${entries.length} bundle(s) held on this device.`),
      el("button", { type: "button", class: "outbox-push", onclick: onPush }, "Sync now (re-gate and push all queued)"),
      entries.length
        ? el("ul", { class: "outbox-list" }, ...entries.map((e) => renderEntry(e, onDiscard)))
        : el("p", { class: "empty" }, "The outbox is empty.")
    )
  );
}
