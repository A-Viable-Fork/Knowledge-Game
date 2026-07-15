// Role: renders one claim as a card, Levels 1 and 2 of the disclosure (spec Section 6). Level 1 is
//   always visible; Level 2 is behind one tap (a native <details> disclosure, keyboard-operable with
//   no script). Contribution actions (Level 3) are not built in this phase; there is nothing to walk
//   back, because nothing above claims to be more than a computed reading.
// Contract: renderCard(row, ctx) -> HTMLElement. `row` is an api.read() row (identity, kind,
//   statement, declared_grade, earned_grade) plus `whyThisCard` and `position` (its feed index).
//   `ctx` carries `sourcesById`, `robustnessByIdentity`, `gapsByIdentity`, `kernelId`, and
//   `isDeepLinkTarget(identity)`.
// Invariant: a grade is rendered as a computed reading, labeled as such, never as truth, validation,
//   or acceptance. Grade is encoded by lattice position with a color plus a textual grade word,
//   color never carrying the distinction alone. No likes, no counters, no engagement chrome.
"use strict";

const GRADE_WORDS = {
  ungraded: "ungraded",
  asserted: "asserted",
  supported: "supported",
  corroborated: "corroborated",
  checked: "checked",
  "independently-rechecked": "independently rechecked",
  constitutive: "constitutive",
};

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

function gradeBadge(grade) {
  const word = GRADE_WORDS[grade] || grade;
  return el(
    "span",
    { class: "badge badge-grade", role: "img", "aria-label": `computed grade: ${word}` },
    el("span", { class: `grade-dot g-${grade}`, "aria-hidden": "true" }),
    word
  );
}

function kindBadge(kind) {
  return el("span", { class: "badge badge-kind", "aria-label": `claim kind: ${kind}` }, kind);
}

function claimLink(identity, label) {
  const short = label || identity.slice(0, 12) + "...";
  return el("a", { class: "claim-link", href: `#claim=${identity}` }, short);
}

function levelTwo(row, ctx) {
  const supportsIn = (ctx.linksByTarget.get(row.identity) || []).filter((l) => l.link_kind === "supports");
  const supportsOut = (ctx.linksByFrom.get(row.identity) || []).filter((l) => l.link_kind === "supports");
  const challenges = (ctx.linksByTarget.get(row.identity) || []).filter((l) => l.link_kind === "contradicts" || l.link_kind === "undercut");
  const source = ctx.sourcesById.get(row.source_id);
  const gaps = ctx.gapsByIdentity.get(row.identity) || [];

  const list = (items, render) =>
    items.length ? el("ul", {}, ...items.map((i) => el("li", {}, render(i)))) : el("p", { class: "empty" }, "none recorded");

  return el(
    "div",
    { class: "level-2" },
    el("h3", {}, "Supports"),
    list(supportsIn, (l) => claimLink(l.from_identity)),
    el("h3", {}, "This claim supports"),
    list(supportsOut, (l) => claimLink(l.to_identity)),
    el("h3", {}, "Challenges"),
    list(challenges, (l) => `${l.link_kind}: ${claimLink(l.from_identity).textContent}`),
    el("h3", {}, "Source provenance"),
    source
      ? el("p", {}, `${source.source_id} (${source.source_class}) - ${source.description}`)
      : el("p", { class: "empty" }, row.source_id),
    el("h3", {}, "Open gaps"),
    list(gaps, (g) => `${g.kind || "gap"}: declared ${g.declared_grade}, earned ${g.earned_grade}`)
  );
}

export function renderCard(row, ctx) {
  const isTarget = ctx.isDeepLinkTarget(row.identity);
  const card = el(
    "article",
    { class: "card", id: `claim-${row.identity}`, "data-target": isTarget ? "true" : undefined, tabindex: isTarget ? "-1" : undefined },
    el("div", { class: "card-top" }, kindBadge(row.kind), gradeBadge(row.earned_grade)),
    el("p", { class: "statement" }, row.statement),
    el(
      "div",
      { class: "card-meta" },
      el("span", {}, `origin: ${ctx.kernelId}`),
      el("span", { class: "why-card" }, row.whyThisCard)
    ),
    el(
      "details",
      {},
      el("summary", {}, "Supports, challenges, provenance, and gaps"),
      levelTwo(row, ctx)
    )
  );
  return card;
}
