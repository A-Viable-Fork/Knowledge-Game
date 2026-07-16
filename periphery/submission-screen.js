// Role: the submission reading surface (Phase KG-11). Renders each document in the reading sequence
//   from its own fetched, hash-verified text (api/submission.js), with anchored spans marked quietly
//   inline: a small grade glyph for mechanical/evaluative spans, an adopted mark for constitutive
//   ones. Tap opens the claim card in place, using the unchanged periphery/card.js; closing returns
//   to the exact reading position. Ends at the threshold, restated as a plain fact before the reader
//   crosses into the live community feed.
// Contract: renderSubmissionScreen(container, ctx) -> void. ctx = { community (fetchCommunity's own
//   return), rowsByIdentity, sourcesById, linksByTarget, linksByFrom, gapsByIdentity, crossDocIndex
//   (api/submission.js's buildCrossDocumentIndex over all three loaded anchor maps), onContribute,
//   onEnterCommunity() }.
// Invariant: a span's displayed text is always the exact document substring the anchor names
//   (rawText.slice(start, end)), never re-typeset; unclaimed prose renders as plain, undisturbed
//   text. A constitutive span's glyph never renders a grade word (spec: "constitutive spans show an
//   adopted mark rather than a grade"). Paragraph and heading structure is inferred from blank-line
//   and leading-# boundaries computed over the untouched raw text, so every span's character offsets
//   stay valid; nothing here re-encodes or re-flows the fetched text before slicing it.
"use strict";
import { renderCard } from "./card.js";
import { READING_SEQUENCE, loadDocument } from "../api/submission.js";

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

// splits the raw text into blocks (paragraphs and headings), each { start, end, isHeading, level }
// over the UNTOUCHED raw text, so every later span offset stays valid against the original string.
function computeBlocks(rawText) {
  const blocks = [];
  const lineRe = /[^\n]*\n?/g;
  let pos = 0;
  let blockStart = null;
  let blockIsHeading = false;
  let blockLevel = 0;
  function closeBlock(end) {
    if (blockStart !== null && end > blockStart) blocks.push({ start: blockStart, end, isHeading: blockIsHeading, level: blockLevel });
    blockStart = null;
  }
  let m;
  while ((m = lineRe.exec(rawText)) && m[0].length > 0) {
    const line = m[0];
    const lineStart = pos;
    const lineEnd = pos + line.length;
    const trimmed = line.replace(/\n$/, "");
    const headingMatch = /^(#{1,6})\s+/.exec(trimmed);
    if (trimmed.trim() === "") {
      closeBlock(lineStart);
    } else if (headingMatch) {
      closeBlock(lineStart);
      blocks.push({ start: lineStart, end: lineEnd, isHeading: true, level: headingMatch[1].length, headingMarkerLength: headingMatch[0].length });
    } else {
      if (blockStart === null) { blockStart = lineStart; blockIsHeading = false; blockLevel = 0; }
    }
    pos = lineEnd;
  }
  closeBlock(pos);
  return blocks;
}

function renderDocumentBody(rawText, anchorMap, rowsByIdentity, onOpenSpan) {
  const container = el("div", { class: "submission-document-body" });
  const blocks = computeBlocks(rawText);
  const spans = [...anchorMap.spans].sort((a, b) => a.anchor.start - b.anchor.start);
  let spanIdx = 0;

  for (const block of blocks) {
    const tag = block.isHeading ? (block.level <= 2 ? "h2" : "h3") : "p";
    const contentStart = block.isHeading ? block.start + block.headingMarkerLength : block.start;
    const node = el(tag, {});
    let cursor = contentStart;
    while (spanIdx < spans.length && spans[spanIdx].anchor.start < block.end) {
      const span = spans[spanIdx];
      const { start, end } = span.anchor;
      if (start < cursor) { spanIdx++; continue; } // a span starting before this block's own content is not ours
      if (start > cursor) node.appendChild(document.createTextNode(rawText.slice(cursor, start)));
      const row = rowsByIdentity.get(span.claim);
      const mark = el(
        "span",
        {
          class: `submission-span submission-span-${span.register}`,
          tabindex: "0", role: "button", "data-claim": span.claim, "data-ref": span.ref,
          onclick: () => onOpenSpan(span, row),
          onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenSpan(span, row); } },
        },
        rawText.slice(start, end)
      );
      if (row) {
        if (span.register === "constitutive") {
          mark.appendChild(el("span", { class: "submission-glyph submission-glyph-adopted", "aria-label": "adopted definition" }, "§"));
        } else {
          mark.appendChild(el("span", { class: "submission-glyph", "aria-label": `computed grade: ${row.earned_grade}` }, el("span", { class: `grade-dot g-${row.earned_grade}` })));
        }
      }
      node.appendChild(mark);
      cursor = end;
      spanIdx++;
    }
    if (cursor < block.end) node.appendChild(document.createTextNode(rawText.slice(cursor, block.end)));
    container.appendChild(node);
  }
  return container;
}

function renderProgress(index, total, entry) {
  const dots = [];
  for (let i = 0; i < total; i++) {
    dots.push(el("span", { class: `submission-progress-dot ${i === index ? "submission-progress-current" : i < index ? "submission-progress-done" : ""}` }));
  }
  return el("div", { class: "submission-progress" }, ...dots, el("span", { class: "submission-progress-label" }, `${index + 1} of ${total}: ${entry.label}`));
}

function renderThreshold(onEnter) {
  return el(
    "div",
    { class: "submission-threshold" },
    el("h2", {}, "The threshold"),
    el("p", {}, "Every claim above is live in the community below, at its computed standing, the evaluative ones at their honest floor, awaiting exactly this reading. No separate forum exists for this: discussion is the comment layer, contest and support are the typed layer, and the community itself is the venue."),
    el("button", { type: "button", class: "submission-enter-button", onclick: onEnter }, "Enter the community")
  );
}

export function renderSubmissionScreen(container, ctx) {
  container.innerHTML = "";
  const section = el("section", { class: "submission-screen", "aria-label": "The submission" });
  const bodyMount = el("div", { class: "submission-body-mount" });
  const cardMount = el("div", { class: "submission-card-mount" });
  section.appendChild(bodyMount);
  section.appendChild(cardMount);
  container.appendChild(section);

  let index = 0;
  let scrollPositions = {};

  function closeCard() {
    cardMount.innerHTML = "";
  }

  function openCard(span, row) {
    cardMount.innerHTML = "";
    if (!row) {
      cardMount.appendChild(el("p", { class: "submission-card-missing" }, `This span's claim (${span.claim.slice(0, 16)}...) is not present in the loaded community; nothing to open.`));
      return;
    }
    const backBtn = el("button", { type: "button", class: "contribute-back" }, "Close");
    backBtn.addEventListener("click", closeCard);
    const wrap = el("div", { class: "submission-card-overlay" }, backBtn);

    if (row.kind === "declaration") {
      const dependents = (ctx.linksByTarget.get(row.identity) || []).filter((l) => l.link_kind === "depends-on");
      wrap.appendChild(el("p", { class: "submission-blast-radius" }, `${dependents.length} claim${dependents.length === 1 ? "" : "s"} depend on this definition.`));
    }
    const otherDocs = (ctx.crossDocIndex.get(row.identity) || []).filter((loc) => loc.docId !== READING_SEQUENCE[index].id);
    for (const loc of otherDocs) {
      const otherEntry = READING_SEQUENCE.find((e) => e.id === loc.docId);
      wrap.appendChild(
        el(
          "button",
          {
            type: "button", class: "submission-walk-button",
            onclick: () => {
              closeCard();
              goTo(READING_SEQUENCE.findIndex((e) => e.id === loc.docId), loc.spanRef);
            },
          },
          `Walk to this claim in "${otherEntry.label}"`
        )
      );
    }

    const card = renderCard(row, {
      kernelId: ctx.community.kernelId, sourcesById: ctx.sourcesById,
      linksByTarget: ctx.linksByTarget, linksByFrom: ctx.linksByFrom, gapsByIdentity: ctx.gapsByIdentity,
      rowsByIdentity: ctx.rowsByIdentity, isWatched: () => false, isDeepLinkTarget: () => false,
      onContribute: ctx.onContribute, onToggleWatch: () => {},
    });
    wrap.appendChild(card);
    cardMount.appendChild(wrap);
    card.scrollIntoView({ block: "nearest" });
  }

  async function goTo(newIndex, focusSpanRef) {
    if (bodyMount.scrollTop !== undefined) scrollPositions[index] = bodyMount.scrollTop;
    index = newIndex;
    closeCard();
    bodyMount.innerHTML = "";
    bodyMount.setAttribute("aria-busy", "true");
    const entry = READING_SEQUENCE[index];
    bodyMount.appendChild(renderProgress(index, READING_SEQUENCE.length, entry));
    let loaded;
    try {
      loaded = await loadDocument(entry);
    } catch (e) {
      bodyMount.appendChild(el("p", { class: "submission-error" }, `Refused to render "${entry.label}": ${e.message}`));
      bodyMount.setAttribute("aria-busy", "false");
      return;
    }
    const body = renderDocumentBody(loaded.text, loaded.anchorMap, ctx.rowsByIdentity, openCard);
    bodyMount.appendChild(body);
    const nav = el(
      "div",
      { class: "submission-nav" },
      index > 0 ? el("button", { type: "button", onclick: () => goTo(index - 1) }, "Back") : null,
      index < READING_SEQUENCE.length - 1
        ? el("button", { type: "button", onclick: () => goTo(index + 1) }, "Continue")
        : null
    );
    bodyMount.appendChild(nav);
    if (index === READING_SEQUENCE.length - 1) bodyMount.appendChild(renderThreshold(ctx.onEnterCommunity));
    bodyMount.setAttribute("aria-busy", "false");
    if (focusSpanRef) {
      const target = body.querySelector(`[data-ref="${focusSpanRef}"]`);
      if (target) { target.scrollIntoView({ block: "center" }); target.focus(); }
    } else if (scrollPositions[index] !== undefined) {
      bodyMount.scrollTop = scrollPositions[index];
    }
  }

  goTo(0);
}
