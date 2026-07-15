// Role: renders one claim as a card. Levels 1 and 2 are the disclosure (spec Section 6): Level 1 is
//   always visible; Level 2 is behind one tap (a native <details> disclosure, keyboard-operable with
//   no script). Level 3 is the contribution surface: propose support, propose undercut, propose
//   qualification, contest this claim's type, and fork this type, each a link into the contribution
//   draft screen (periphery/contribute-screen.js) rather than an action performed here; a card
//   proposes nothing itself. Level 2 also carries Discussion (Phase KG-4): comments-on/replies-to
//   threads attached to this row, rendered gradeless and visually distinct from a claim.
// Contract: renderCard(row, ctx) -> HTMLElement. `row` is an api.read() row (identity, kind,
//   statement, declared_grade, earned_grade) plus `whyThisCard` and `position` (its feed index).
//   `ctx` carries `sourcesById`, `rowsByIdentity`, `robustnessByIdentity`, `gapsByIdentity`,
//   `kernelId`, `isDeepLinkTarget(identity)`, `isWatched(identity)` and `onToggleWatch(row)`
//   (standing-motion alerts, Phase KG-4), and `onContribute(action, row)` (action includes "comment"
//   and "reply", target the row a new comment attaches to or replies to; "promote", target the
//   comment being lifted into a claim draft).
// Invariant: a grade is rendered as a computed reading, labeled as such, never as truth, validation,
//   or acceptance. Grade is encoded by lattice position with a color plus a textual grade word,
//   color never carrying the distinction alone. No likes, no counters, no engagement chrome. A
//   comment (row.kind === "comment") never renders a grade badge (its state is ungraded and renders
//   as discussion, not as a low grade), never appears in the Supports/Challenges lists above (those
//   filter to link_kind "supports"/"contradicts"/"undercut", which a comment never carries by
//   construction), and offers only Reply and Promote to claim at Level 3, never support/undercut/
//   qualification/contest/fork.
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

// a comment thread node: gradeless, visually distinct, Reply and Promote to claim only. Recurses
// over replies-to children; MAX_DEPTH guards against a pathological cycle in untrusted graph data
// (the gate does not forbid a long chain, but a card render is not the place to walk one unbounded).
const MAX_THREAD_DEPTH = 8;
function renderCommentThread(commentRow, ctx, depth) {
  if (!commentRow || depth > MAX_THREAD_DEPTH) return null;
  const replies = (ctx.linksByTarget.get(commentRow.identity) || [])
    .filter((l) => l.link_kind === "replies-to")
    .map((l) => ctx.rowsByIdentity.get(l.from_identity))
    .filter(Boolean);
  return el(
    "div",
    { class: "comment-thread-item", style: `margin-left: ${depth * 1}rem` },
    el("div", { class: "comment-top" }, el("span", { class: "badge badge-discussion" }, "Discussion")),
    el("p", { class: "comment-statement" }, commentRow.statement),
    ctx.onContribute
      ? el(
          "div",
          { class: "comment-actions" },
          el("button", { class: "contribute-action", type: "button", onclick: () => ctx.onContribute("reply", commentRow) }, "Reply"),
          el("button", { class: "contribute-action", type: "button", onclick: () => ctx.onContribute("promote", commentRow) }, "Promote to claim")
        )
      : null,
    ...replies.map((r) => renderCommentThread(r, ctx, depth + 1))
  );
}

function levelTwo(row, ctx) {
  const supportsIn = (ctx.linksByTarget.get(row.identity) || []).filter((l) => l.link_kind === "supports");
  const supportsOut = (ctx.linksByFrom.get(row.identity) || []).filter((l) => l.link_kind === "supports");
  const challenges = (ctx.linksByTarget.get(row.identity) || []).filter((l) => l.link_kind === "contradicts" || l.link_kind === "undercut");
  const source = ctx.sourcesById.get(row.source_id);
  const gaps = ctx.gapsByIdentity.get(row.identity) || [];
  const commentsOff = (ctx.excludedKinds || []).includes("comment");
  const commentsOn = commentsOff ? [] : (ctx.linksByTarget.get(row.identity) || [])
    .filter((l) => l.link_kind === "comments-on")
    .map((l) => (ctx.rowsByIdentity ? ctx.rowsByIdentity.get(l.from_identity) : null))
    .filter(Boolean);

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
    list(gaps, (g) => `${g.kind || "gap"}: declared ${g.declared_grade}, earned ${g.earned_grade}`),
    el("h3", {}, "Discussion"),
    commentsOff
      ? el("p", { class: "empty" }, "comments are hidden by the type filter: claims-only reading")
      : commentsOn.length
        ? el("div", { class: "comment-thread" }, ...commentsOn.map((c) => renderCommentThread(c, ctx, 0)))
        : el("p", { class: "empty" }, "no comments yet")
  );
}

const LEVEL_3_ACTIONS = [
  { action: "support", label: "Propose support" },
  { action: "undercut", label: "Propose undercut" },
  { action: "qualification", label: "Propose qualification" },
  { action: "contest", label: "Contest this claim's type" },
  { action: "fork", label: "Fork this type" },
];
const COMMENT_LEVEL_3_ACTIONS = [
  { action: "reply", label: "Reply" },
  { action: "promote", label: "Promote to claim" },
];

function levelThree(row, ctx) {
  if (!ctx.onContribute) return null;
  const actions = row.kind === "comment" ? COMMENT_LEVEL_3_ACTIONS : LEVEL_3_ACTIONS;
  const extra = row.kind === "comment" ? [] : [el("button", { class: "contribute-action", type: "button", onclick: () => ctx.onContribute("comment", row) }, "Comment")];
  const watched = ctx.isWatched && ctx.isWatched(row.identity);
  const watchBtn = ctx.onToggleWatch
    ? el("button", { class: "contribute-action watch-action", type: "button", "aria-pressed": watched ? "true" : "false", onclick: () => ctx.onToggleWatch(row) }, watched ? "Unwatch" : "Watch")
    : null;
  return el(
    "div",
    { class: "level-3-actions" },
    ...actions.map((a) =>
      el("button", { class: "contribute-action", type: "button", onclick: () => ctx.onContribute(a.action, row) }, a.label)
    ),
    ...extra,
    watchBtn
  );
}

export function renderCard(row, ctx) {
  const isTarget = ctx.isDeepLinkTarget(row.identity);
  const isComment = row.kind === "comment";
  const card = el(
    "article",
    { class: "card", id: `claim-${row.identity}`, "data-target": isTarget ? "true" : undefined, "data-comment": isComment ? "true" : undefined, tabindex: isTarget ? "-1" : undefined },
    el("div", { class: "card-top" }, kindBadge(row.kind), isComment ? el("span", { class: "badge badge-discussion" }, "Discussion") : gradeBadge(row.earned_grade)),
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
      el("summary", {}, isComment ? "Replies and provenance" : "Supports, challenges, provenance, discussion, and gaps"),
      levelTwo(row, ctx)
    ),
    levelThree(row, ctx)
  );
  return card;
}
