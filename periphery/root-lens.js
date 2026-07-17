// Role: the claim lens over the root front page (Phase KG-claim-lens; migrated to the governance
//   kernel's own snapshot in Phase KG-front-page-claims). Progressive enhancement, strictly: with
//   this script absent or failed, index.html is the plain static six-question page, complete.
//   Fetches this deployment's own governance kernel snapshot (app/fixtures/knowledge-game.snapshot
//   .json, the identical file both the org-root entrance and this app's own "knowledge-game" mirrored
//   community fetch), once, matches each `.claim-span` in the document to its claim by its span_ref
//   extension (kernel/governance/corpora/knowledge-game-data.js's fp.* claims each carry one; checked
//   against the same data-ref by build/check-entrance-listing.mjs), and wires tap/click to isolate the
//   claim in a labeled dialog: statement, kind, earned grade with one-line honesty text, and the
//   action sheet (follow, comment, fork, contest, attest, decompose).
// Contract: no exports; a side-effecting module, loaded once from index.html's own <script type=
//   module>. Reads only api/community.js (the one membrane crossing this file makes), never vault/,
//   never api/contribute.js: every compose-shaped action is a link into the app's own bundle, never
//   a write performed from this page.
// Invariant: the lens moves no grade, structurally. Every action on the sheet is either a read
//   (follow, the provenance chip) or a link out to the app's own compose surface, labeled "through
//   the gate"; nothing here calls propose() or touches a store. Comment, fork, and contest carry a
//   real, working pre-fill: every fp.* claim is a row in the "knowledge-game" community the app
//   already registers, so `#community=knowledge-game&view=contribute&action=<action>&target=<identity>`
//   lands on the app's own existing, unmodified compose form. Attest and decompose carry no such
//   pre-fill shape anywhere in this codebase (periphery/contribute-screen.js's ACTION_TITLES has no
//   entry for either); both land as honestly labeled doors into the claim's own card instead, never
//   silently dropped, never mislabeled as a shape that does not exist.
"use strict";
import { fetchCommunity } from "../api/community.js";

const SNAPSHOT_PATH = "app/fixtures/knowledge-game.snapshot.json";
const COMMUNITY_ID = "knowledge-game";
const APP_BASE = "app/";

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

const GRADE_HONESTY = {
  constitutive: "constitutive: adopted by stipulation, not evidenced; a definition, not a measurement.",
  asserted: "asserted: this deployment's own word alone so far, no independent check yet.",
  supported: "supported: at least one independent claim argues for this.",
  corroborated: "corroborated: independent, disjoint support has accumulated.",
  checked: "checked: a real, re-runnable check grounds this.",
  "independently-rechecked": "independently rechecked: a second, independent party re-ran the check.",
  ungraded: "ungraded.",
};

function gradeBadge(grade) {
  return el("span", { class: `lens-badge lens-badge-grade lens-grade-${grade}`, role: "img", "aria-label": `computed grade: ${grade}` }, grade);
}
function kindBadge(kind) {
  return el("span", { class: "lens-badge lens-badge-kind" }, kind);
}

// the provenance chip: the claim's own source row, expandable in place (Step 5's "tapping the chip
// jumps straight to the source row, from which the trail can walk outward"), here rendered as an
// inline expansion naming every sibling claim (in this same kernel) that cites the identical source,
// the walk-outward this single kernel can honestly support without a second fetch.
function renderProvenanceChip(row, ctx) {
  const source = ctx.sourcesById.get(row.source_id);
  const details = el("div", { class: "lens-provenance-detail", hidden: true });
  const chip = el(
    "button",
    {
      type: "button", class: "lens-provenance-chip", "aria-expanded": "false",
      onclick: (e) => {
        const open = details.hasAttribute("hidden");
        if (open) details.removeAttribute("hidden"); else details.setAttribute("hidden", "");
        e.currentTarget.setAttribute("aria-expanded", open ? "true" : "false");
      },
    },
    `Source: ${row.source_id}`
  );
  if (source) {
    const rests = (ctx.allRows || []).filter((r) => r.identity !== row.identity && r.source_id === row.source_id);
    details.appendChild(el("p", { class: "lens-provenance-class" }, `${source.source_class}`));
    details.appendChild(el("p", { class: "lens-provenance-desc" }, source.description));
    details.appendChild(
      rests.length
        ? el("div", {}, el("p", { class: "lens-provenance-rests-label" }, `${rests.length} other claim${rests.length === 1 ? "" : "s"} here rest on this same source:`), el("ul", {}, ...rests.map((r) => el("li", {}, r.statement.slice(0, 72) + (r.statement.length > 72 ? "..." : "")))))
        : el("p", { class: "empty" }, "no other claim here cites this source")
    );
  }
  return el("div", { class: "lens-provenance" }, chip, details);
}

// the follow trail (Step 5): descends toward ground from the isolated claim. A front-page claim
// carries at most one of: an outgoing restatement link (the real governance claim already grounded in
// this same kernel, named by ref), a `url` extension (an epistack-artifact door, honestly labeled as
// leaving the lens, Tier A), or neither (grounded by adoption alone, a plain dead end, never hidden as
// if a hop existed). Tier B (cross-kernel follow, into epistack's own published snapshot) is not
// shipped; see the Tier B section in the final report for why.
function renderFollow(row, ctx) {
  const outgoingRestatement = (ctx.linksByFrom.get(row.identity) || []).find((l) => l.link_kind === "restatement");
  const url = ctx.extensionsByIdentity.get(row.identity) && ctx.extensionsByIdentity.get(row.identity).url;
  const restates = ctx.extensionsByIdentity.get(row.identity) && ctx.extensionsByIdentity.get(row.identity).restates;

  const hops = [el("div", { class: "lens-hop lens-hop-current" }, el("p", { class: "lens-hop-label" }, "This claim"), el("p", {}, row.statement), gradeBadge(row.earned_grade), renderProvenanceChip(row, ctx))];

  if (outgoingRestatement) {
    const target = ctx.rowsByIdentity.get(outgoingRestatement.to_identity);
    if (target) {
      hops.push(
        el(
          "div",
          { class: "lens-hop lens-hop-restated" },
          el("p", { class: "lens-hop-label" }, `Restates ${restates || outgoingRestatement.to_identity.slice(0, 12) + "..."}, already grounded in this deployment's own governance kernel`),
          el("p", {}, target.statement),
          gradeBadge(target.earned_grade),
          renderProvenanceChip(target, ctx)
        )
      );
    }
  } else if (url) {
    hops.push(
      el(
        "div",
        { class: "lens-hop lens-hop-door" },
        el("p", { class: "lens-hop-label" }, "Leaving the lens: this claim's provenance lives in the epistack submission, outside this kernel."),
        el("a", { class: "lens-door-link", href: url, target: "_blank", rel: "noopener" }, url)
      )
    );
  } else {
    hops.push(el("div", { class: "lens-hop lens-hop-end" }, el("p", { class: "lens-hop-label" }, "Grounded by adoption alone: a front-page stipulation, no further citation to follow.")));
  }
  return el("div", { class: "lens-follow" }, ...hops);
}

// the "other actions" (Step 6): comment, fork, and contest are real, working pre-fills, since every
// front-page claim is a row in the "knowledge-game" community the app already registers and its
// compose surface already knows how to load. Attest and decompose carry no pre-fill shape anywhere in
// this codebase (contribute-screen.js's ACTION_TITLES has neither); both land as honestly labeled
// doors into the claim's own card, the gap named on the button itself rather than silently dropped.
function composeHref(action, identity) {
  return `${APP_BASE}#community=${COMMUNITY_ID}&view=contribute&action=${action}&target=${encodeURIComponent(identity)}`;
}
function cardHref(identity) {
  return `${APP_BASE}#community=${COMMUNITY_ID}&claim=${encodeURIComponent(identity)}`;
}

function renderActionSheet(row, ctx, state) {
  const followBtn = el(
    "button",
    { type: "button", class: "lens-action lens-action-read", "aria-pressed": state.followOpen ? "true" : "false", onclick: () => { state.followOpen = !state.followOpen; state.rerender(); } },
    state.followOpen ? "Hide follow" : "Follow"
  );
  const readActions = [followBtn];
  const gatedActions = [
    el("a", { class: "lens-action lens-action-gated", href: composeHref("comment", row.identity) }, "Comment (through the gate)"),
    el("a", { class: "lens-action lens-action-gated", href: composeHref("fork", row.identity) }, "Fork this type (through the gate)"),
    el(
      "a",
      { class: "lens-action lens-action-gated", href: composeHref("contest", row.identity) },
      "Contest this claim's type (through the gate; admitting a contest moves no existing grade)"
    ),
    el("a", { class: "lens-action lens-action-door", href: cardHref(row.identity) }, "Attest (opens this claim's own card in the app; no dedicated attest shape exists yet, use Propose support there)"),
    el("a", { class: "lens-action lens-action-door", href: cardHref(row.identity) }, "Decompose (opens this claim's own card in the app; no dedicated decompose-contribution shape exists yet)"),
  ];
  return el("div", { class: "lens-actions" }, el("div", { class: "lens-actions-read" }, ...readActions), el("div", { class: "lens-actions-gated" }, ...gatedActions));
}

function renderPanel(row, ctx, state) {
  const panel = el(
    "div",
    { class: "lens-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "lens-panel-title", tabindex: "-1" },
    el("button", { type: "button", class: "lens-close", "aria-label": "Close, restore prose", onclick: () => ctx.close() }, "×"),
    el("p", { id: "lens-panel-title", class: "lens-panel-kind-line" }, kindBadge(row.kind), gradeBadge(row.earned_grade)),
    el("p", { class: "lens-panel-statement" }, row.statement),
    el("p", { class: "lens-panel-honesty" }, GRADE_HONESTY[row.earned_grade] || GRADE_HONESTY.ungraded),
    renderActionSheet(row, ctx, state),
    state.followOpen ? renderFollow(row, ctx) : null
  );
  return panel;
}

function buildContext(community) {
  const rows = community.api.read();
  const rowsByIdentity = new Map(rows.map((r) => [r.identity, r]));
  const sourcesById = new Map((community.raw.sources || []).map((s) => [s.source_id, s]));
  const linksByFrom = new Map();
  for (const l of community.raw.state.links || []) {
    if (!linksByFrom.has(l.from_identity)) linksByFrom.set(l.from_identity, []);
    linksByFrom.get(l.from_identity).push(l);
  }
  const extensionsByIdentity = new Map(
    (community.raw.state.entries || []).map((e) => [e.identity, (e.canonical && e.canonical.extensions) || {}])
  );
  // the span-ref index: the one thing a claim-span's data-ref attribute is trusted to match, read
  // from each claim's own span_ref extension (never the statement text, which several fp.* claims
  // share no boundary with adjoining plain prose on the page).
  const bySpanRef = new Map();
  for (const [identity, ext] of extensionsByIdentity) {
    if (ext.span_ref) bySpanRef.set(ext.span_ref, rowsByIdentity.get(identity));
  }
  return { rowsByIdentity, sourcesById, linksByFrom, extensionsByIdentity, allRows: rows, bySpanRef };
}

function wireLens(community) {
  const ctx = buildContext(community);
  const scrim = el("div", { class: "lens-scrim", hidden: true });
  document.body.appendChild(scrim);
  let openSpan = null;
  let mountedPanel = null;
  const state = { followOpen: false, rerender: () => rerenderOpen() };

  function close() {
    scrim.setAttribute("hidden", "");
    scrim.innerHTML = "";
    document.body.classList.remove("lens-open");
    if (openSpan) { openSpan.classList.remove("claim-span-open"); openSpan.focus({ preventScroll: true }); }
    openSpan = null;
    mountedPanel = null;
    state.followOpen = false;
    window.removeEventListener("keydown", onKeydown);
    window.removeEventListener("scroll", onScroll, true);
  }
  ctx.close = close;

  function rerenderOpen() {
    if (!openSpan) return;
    const row = ctx.bySpanRef.get(openSpan.getAttribute("data-ref"));
    if (!row) return;
    scrim.innerHTML = "";
    mountedPanel = renderPanel(row, ctx, state);
    scrim.appendChild(mountedPanel);
    mountedPanel.focus();
  }

  function onKeydown(e) {
    if (e.key === "Escape") close();
  }
  let openScrollY = 0;
  function onScroll() {
    if (Math.abs(window.scrollY - openScrollY) > 240) close();
  }

  function open(span) {
    const row = ctx.bySpanRef.get(span.getAttribute("data-ref"));
    if (!row) return; // unresolved span: no claim to open, prose stays plain (never a broken dialog)
    if (openSpan) close();
    openSpan = span;
    openSpan.classList.add("claim-span-open");
    document.body.classList.add("lens-open");
    scrim.removeAttribute("hidden");
    openScrollY = window.scrollY;
    rerenderOpen();
    window.addEventListener("keydown", onKeydown);
    window.addEventListener("scroll", onScroll, true);
  }

  scrim.addEventListener("click", (e) => { if (e.target === scrim) close(); });

  const spans = document.querySelectorAll(".claim-span");
  for (const span of spans) {
    if (!ctx.bySpanRef.has(span.getAttribute("data-ref"))) continue; // orphaned span: leave as plain prose
    span.setAttribute("tabindex", "0");
    span.setAttribute("role", "button");
    span.classList.add("claim-span-live");
    span.addEventListener("click", () => open(span));
    span.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(span); } });
  }
}

async function init() {
  try {
    const community = await fetchCommunity(SNAPSHOT_PATH);
    wireLens(community);
  } catch (e) {
    // the lens is progressive enhancement; a fetch or hash-verification failure leaves the static
    // page exactly as it renders with the script absent, never a broken half-state.
    void e;
  }
}

init();
