// Role: the contribution draft screen (Level 3, spec Section 7): draft -> schema validation -> local
//   gate decision with the receipt shown -> bundle -> export. One screen handles all five card
//   actions (support, undercut, qualification, contest-type, fork-type) plus (Phase KG-4) comment,
//   reply, and promote, routed by `ctx.action`.
// Contract: renderContributeScreen(container, ctx) -> void. ctx = { community, action, targetRow,
//   contributionTarget?, onBack, prefill? }. community is what api/community.js's fetchCommunity()
//   returns; targetRow is the card's row the action originated from (the comment being replied to or
//   promoted, for "reply"/"promote"); contributionTarget is the community's declared PR destination
//   (absent for a community that has not declared one). Phase KG-9: prefill (only ever passed by
//   periphery/assistant-screen.js reusing this exact screen, never by the ordinary card-driven route)
//   is {statement, kind, assisted: true, note?}; only the default (new/support/undercut/qualification)
//   draft form honors it, pre-filling the statement and kind fields and rendering a visible
//   "drafted with assistant help" attribution above the form. The gate treats an assisted draft
//   exactly like any other; the attribution is a rendering fact, never a field on the claim record.
// Phase KG-6b: a gate-passed proposal (support/undercut/qualification/comment/reply/promote, never
//   contest or fork) also offers "Queue to outbox" alongside export, when ctx.communityId is present
//   (this app's own registered community id, distinct from the kernel's own id); this queues the same
//   bundle locally (api/outbox.js) for later batched re-gate and push, rather than an immediate
//   client-side download.
// Invariant: an export button appears only once the gate has actually decided the proposal, and only
//   when that decision passed structurally (gate-passed or gate-passed-with-disagreement); a declined
//   draft shows why, never a bundle. Every receipt renders through periphery/gate-feedback.js's
//   describeReceipt (structure present, structure missing, what would ground it), so a refusal is
//   never the bare word "declined" alone, comment refusals for occupying a support role included. The
//   three-state ladder (periphery/ladder.js) never renders past gate-passed, because admission and
//   semantic acceptance are never this app's to declare. A fork is shown as what it honestly is,
//   snapshot-only and not persisted, never folded into the ladder. The comment form offers no grade
//   selector (a comment is always ungraded) and no action selector (it can build only comments-on or
//   replies-to, never supports).
// Phase KG-11: the comment/reply form renders one honest latency line (describeCommentAdmission),
//   read from the fetched community's own admission_policy.comment_admission (carried on the snapshot
//   by communities/epistack-competition/build/regenerate-snapshot.mjs, never a second network call):
//   manual (the default) says a comment awaits the maintainers; auto-during-window inside its declared
//   window says admission is automatic at the next scheduled sweep. Every other kind is always manual
//   and this line never renders on their forms.
"use strict";
import { draftProposal, draftContest, draftFork, draftComment, draftPromoteToClaim, bundleProposal } from "../api/contribute.js";
import { queueBundle } from "../api/outbox.js";
import { renderLadder } from "./ladder.js";
import { describeReceipt } from "./gate-feedback.js";
import { renderSigningPanel } from "./signing-panel.js";

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

const ACTION_TITLES = {
  support: "Propose support",
  undercut: "Propose undercut",
  qualification: "Propose qualification",
  contest: "Contest this claim's type",
  fork: "Fork this type",
  comment: "Comment",
  reply: "Reply",
  promote: "Promote to claim",
};

function downloadJSONBlob(filename, jsonText) {
  const blob = new Blob([jsonText], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// the outbox action (Phase KG-6b), alongside export: queues the gate-passed bundle on this device,
// to be re-gated and pushed in a batch later (periphery/outbox-screen.js). Requires ctx.communityId
// (which of this app's own registered communities the draft is against); a screen reached without one
// (there is none today) would simply omit this button.
function renderQueueButton(proposal, receipt, extraSources, ctx, community) {
  if (!ctx.communityId) return el("p", { class: "empty" }, "");
  const btn = el("button", { type: "button", class: "queue-button" }, "Queue to outbox");
  btn.addEventListener("click", () => {
    const bundle = bundleProposal(proposal, receipt, { kernel_id: community.kernelId, state_id: community.snapshotHash });
    queueBundle(bundle, extraSources, ctx.communityId);
    btn.disabled = true;
    btn.textContent = "Queued";
  });
  return btn;
}

// collaborative gate feedback (spec Section 7, Phase KG-4): a refusal renders the path, never the
// wall. The decision label always appears (so the reader knows the outcome), but a decline is always
// accompanied by structure present, structure missing, and what would ground it, drawn from the
// receipt's own content; the bare word "declined" never renders alone.
function renderReceipt(receipt) {
  const findings = receipt.findings || [];
  const { present, missing, wouldGround } = describeReceipt(receipt);
  const list = (items) => (items.length ? el("ul", {}, ...items.map((i) => el("li", {}, i))) : null);
  return el(
    "div",
    { class: "gate-receipt" },
    el("p", { class: "gate-decision" }, `Gate decision: ${receipt.decision}`),
    (receipt.decision_basis || []).length ? el("p", { class: "decision-basis" }, `Basis: ${receipt.decision_basis.join(", ")}`) : null,
    present.length ? el("div", { class: "feedback-present" }, el("h4", {}, "Structure present"), list(present)) : null,
    missing.length ? el("div", { class: "feedback-missing" }, el("h4", {}, "Structure missing"), list(missing)) : null,
    wouldGround.length ? el("div", { class: "feedback-would-ground" }, el("h4", {}, "What would ground it"), list(wouldGround)) : null,
    findings.length
      ? el("details", { class: "feedback-raw-findings" }, el("summary", {}, "Raw findings"), el("ul", { class: "findings" }, ...findings.map((f) => el("li", {}, `${f.rule_id}: expected ${f.expected}, found ${JSON.stringify(f.found)} (${f.entry_locator})`))))
      : null
  );
}

const PASSED = new Set(["accepted", "accepted-with-disagreement"]);

function renderProposalDraft(container, ctx) {
  const { community, action, targetRow, contributionTarget, prefill } = ctx;
  const resultMount = el("div", { class: "contribute-result" });
  let statement = (prefill && prefill.statement) || "";
  let kind = (prefill && prefill.kind) || (targetRow ? targetRow.kind : (community.raw.kinds[0] && community.raw.kinds[0].kind) || "");
  let citation = "";
  let contributorId = "contributor";
  let linkGrade = "corroborated";
  let last = null; // { proposal, receipt }

  function renderResult() {
    resultMount.innerHTML = "";
    if (!last) return;
    const { proposal, receipt, extraSources } = last;
    resultMount.appendChild(renderReceipt(receipt));
    if (!PASSED.has(receipt.decision)) return;
    resultMount.appendChild(renderLadder("gate-passed"));
    const exportBtn = el("button", { type: "button", class: "export-button" }, "Export contribution");
    exportBtn.addEventListener("click", () => {
      const bundle = bundleProposal(proposal, receipt, { kernel_id: community.kernelId, state_id: community.snapshotHash });
      const json = JSON.stringify(bundle, null, 2);
      downloadJSONBlob(`contribution-${bundle.contribution_id.slice(0, 12)}.json`, json);
      const instructions = el(
        "div",
        { class: "export-instructions" },
        el("p", {}, `Contribution id: ${bundle.contribution_id}`),
        el("p", {}, bundle.instructions),
        contributionTarget
          ? el("p", {}, `Open a pull request against ${contributionTarget} carrying the downloaded bundle file.`)
          : el("p", { class: "empty" }, "This community has not declared a contribution target yet.")
      );
      resultMount.appendChild(instructions);
      const signingMount = el("div", {});
      resultMount.appendChild(signingMount);
      renderSigningPanel(signingMount, { bundle });
    });
    resultMount.appendChild(exportBtn);
    resultMount.appendChild(renderQueueButton(proposal, receipt, extraSources, ctx, community));
  }

  function runDraft() {
    if (!statement.trim()) { last = { proposal: null, receipt: { decision: "declined", error: "a statement is required", findings: [] } }; renderResult(); return; }
    last = draftProposal(community, {
      statement, kind, contributorId, citation: citation || undefined,
      action, targetIdentity: targetRow ? targetRow.identity : undefined,
      linkGrade,
    });
    renderResult();
  }

  const kindOptions = (community.raw.kinds || []).map((k) => k.kind);
  const form = el(
    "form",
    { class: "contribute-form", onsubmit: (e) => { e.preventDefault(); runDraft(); } },
    prefill && prefill.assisted
      ? el(
          "div",
          { class: "assistant-attribution", role: "note" },
          el("p", {}, "Drafted with assistant help. Review before submitting; the gate treats this exactly like any other draft."),
          prefill.note ? el("p", { class: "assistant-attribution-note" }, prefill.note) : null
        )
      : null,
    targetRow ? el("p", { class: "contribute-target" }, `Target claim: ${targetRow.statement}`) : null,
    el("label", {}, "Statement", el("textarea", { required: true, oninput: (e) => (statement = e.target.value) }, statement)),
    el(
      "label", {}, "Kind",
      el("select", { onchange: (e) => (kind = e.target.value) }, ...kindOptions.map((k) => el("option", { value: k, selected: k === kind ? "" : undefined }, k)))
    ),
    el("label", {}, "Citation (optional; becomes a testimony-class source, never an independent check)", el("input", { type: "text", oninput: (e) => (citation = e.target.value) })),
    el("label", {}, "Contributor id", el("input", { type: "text", value: contributorId, oninput: (e) => (contributorId = e.target.value) })),
    action === "support" ? el("label", {}, "Declared support grade", el("select", { onchange: (e) => (linkGrade = e.target.value) }, ...["asserted", "supported", "corroborated"].map((g) => el("option", { value: g, selected: g === linkGrade ? "" : undefined }, g)))) : null,
    el("button", { type: "submit" }, "Check with the gate")
  );

  container.appendChild(form);
  container.appendChild(resultMount);
}

// honest latency messaging (Phase KG-11 Step 4): the community's own admission_policy.comment_admission,
// carried on the fetched snapshot (communities/epistack-competition/build/regenerate-snapshot.mjs),
// read here to tell a commenter what actually happens next, never a guess. Every other kind is always
// manual and never mentions this at all (the message renders only on the comment/reply form).
function describeCommentAdmission(admissionPolicy, nowMs) {
  const policy = admissionPolicy && admissionPolicy.comment_admission;
  if (!policy || policy.mode !== "auto-during-window") {
    return "Comments await the maintainers' own review, same as every contribution, until admitted through a pull request.";
  }
  const window = policy.window;
  if (!window || !window.starts_at || !window.ends_at) {
    return "Comments await the maintainers' own review, same as every contribution, until admitted through a pull request.";
  }
  const starts = Date.parse(window.starts_at);
  const ends = Date.parse(window.ends_at);
  if (Number.isFinite(starts) && Number.isFinite(ends) && nowMs >= starts && nowMs <= ends) {
    return `Comments are admitted automatically during the judging window (through ${window.ends_at}), at the next scheduled sweep, usually within the hour.`;
  }
  return `Auto-admission is enabled for the judging window (${window.starts_at} to ${window.ends_at}); outside that window, comments await the maintainers' own review, same as every contribution.`;
}

// comment / reply: no action selector, no kind selector, no grade selector. action === "reply" means
// targetRow is the comment being replied to (replies-to); action === "comment" means targetRow is
// whatever the comment attaches to (comments-on, any record).
function renderCommentDraft(container, ctx) {
  const { community, action, targetRow } = ctx;
  const resultMount = el("div", { class: "contribute-result" });
  let statement = "";
  let citation = "";
  let contributorId = "contributor";

  function renderResult() {
    resultMount.innerHTML = "";
    if (!last) return;
    const { proposal, receipt, extraSources } = last;
    resultMount.appendChild(renderReceipt(receipt));
    if (!PASSED.has(receipt.decision)) return;
    resultMount.appendChild(renderLadder("gate-passed"));
    const exportBtn = el("button", { type: "button", class: "export-button" }, "Export contribution");
    exportBtn.addEventListener("click", () => {
      const bundle = bundleProposal(proposal, receipt, { kernel_id: community.kernelId, state_id: community.snapshotHash });
      downloadJSONBlob(`contribution-${bundle.contribution_id.slice(0, 12)}.json`, JSON.stringify(bundle, null, 2));
      resultMount.appendChild(el("p", {}, `Contribution id: ${bundle.contribution_id}`));
      const signingMount = el("div", {});
      resultMount.appendChild(signingMount);
      renderSigningPanel(signingMount, { bundle });
    });
    resultMount.appendChild(exportBtn);
    resultMount.appendChild(renderQueueButton(proposal, receipt, extraSources, ctx, community));
  }

  let last = null;
  function runDraft() {
    if (!statement.trim()) { last = { proposal: null, receipt: { decision: "declined", error: "a statement is required", findings: [] } }; renderResult(); return; }
    last = draftComment(community, {
      statement, contributorId, citation: citation || undefined,
      targetIdentity: action === "reply" ? undefined : targetRow.identity,
      replyToIdentity: action === "reply" ? targetRow.identity : undefined,
    });
    renderResult();
  }

  const form = el(
    "form",
    { class: "contribute-form", onsubmit: (e) => { e.preventDefault(); runDraft(); } },
    el("p", { class: "contribute-target" }, action === "reply" ? `Replying to: ${targetRow.statement}` : `Commenting on: ${targetRow.statement}`),
    el("p", { class: "admission-latency-note" }, describeCommentAdmission(community.raw.admission_policy, Date.now())),
    el("label", {}, "Comment", el("textarea", { required: true, oninput: (e) => (statement = e.target.value) })),
    el("label", {}, "Citation (optional)", el("input", { type: "text", oninput: (e) => (citation = e.target.value) })),
    el("label", {}, "Contributor id", el("input", { type: "text", value: contributorId, oninput: (e) => (contributorId = e.target.value) })),
    el("button", { type: "submit" }, "Check with the gate")
  );
  container.appendChild(form);
  container.appendChild(resultMount);
}

// promote: lift an existing comment's text into a new, ordinarily-graded claim, linked back from the
// comment via comments-on. The comment itself is never edited or removed.
function renderPromoteDraft(container, ctx) {
  const { community, targetRow } = ctx;
  const resultMount = el("div", { class: "contribute-result" });
  let statement = targetRow.statement;
  let kind = (community.raw.kinds.find((k) => k.kind !== "comment") || community.raw.kinds[0] || {}).kind || "";
  let citation = "";
  let contributorId = "contributor";
  let declaredGrade = "asserted";
  let last = null;

  function renderResult() {
    resultMount.innerHTML = "";
    if (!last) return;
    const { proposal, receipt, extraSources } = last;
    resultMount.appendChild(renderReceipt(receipt));
    if (!PASSED.has(receipt.decision)) return;
    resultMount.appendChild(renderLadder("gate-passed"));
    const exportBtn = el("button", { type: "button", class: "export-button" }, "Export contribution");
    exportBtn.addEventListener("click", () => {
      const bundle = bundleProposal(proposal, receipt, { kernel_id: community.kernelId, state_id: community.snapshotHash });
      downloadJSONBlob(`contribution-${bundle.contribution_id.slice(0, 12)}.json`, JSON.stringify(bundle, null, 2));
      resultMount.appendChild(el("p", {}, `Contribution id: ${bundle.contribution_id}`));
      const signingMount = el("div", {});
      resultMount.appendChild(signingMount);
      renderSigningPanel(signingMount, { bundle });
    });
    resultMount.appendChild(exportBtn);
    resultMount.appendChild(renderQueueButton(proposal, receipt, extraSources, ctx, community));
  }

  function runDraft() {
    if (!statement.trim()) { last = { proposal: null, receipt: { decision: "declined", error: "a statement is required", findings: [] } }; renderResult(); return; }
    last = draftPromoteToClaim(community, {
      commentIdentity: targetRow.identity, statement, kind, contributorId, declaredGrade, citation: citation || undefined,
    });
    renderResult();
  }

  const kindOptions = (community.raw.kinds || []).map((k) => k.kind).filter((k) => k !== "comment");
  const form = el(
    "form",
    { class: "contribute-form", onsubmit: (e) => { e.preventDefault(); runDraft(); } },
    el("p", { class: "contribute-target" }, `Promoting comment: ${targetRow.statement}`),
    el("label", {}, "Claim statement", el("textarea", { required: true, value: statement, oninput: (e) => (statement = e.target.value) })),
    el(
      "label", {}, "Kind",
      el("select", { onchange: (e) => (kind = e.target.value) }, ...kindOptions.map((k) => el("option", { value: k, selected: k === kind ? "" : undefined }, k)))
    ),
    el("label", {}, "Citation (optional; becomes a testimony-class source, never an independent check)", el("input", { type: "text", oninput: (e) => (citation = e.target.value) })),
    el("label", {}, "Contributor id", el("input", { type: "text", value: contributorId, oninput: (e) => (contributorId = e.target.value) })),
    el("label", {}, "Declared grade", el("select", { onchange: (e) => (declaredGrade = e.target.value) }, ...["asserted", "supported", "corroborated"].map((g) => el("option", { value: g, selected: g === declaredGrade ? "" : undefined }, g)))),
    el("button", { type: "submit" }, "Check with the gate")
  );
  container.appendChild(form);
  container.appendChild(resultMount);
}

function renderContestDraft(container, ctx) {
  const { community, targetRow } = ctx;
  const resultMount = el("div", { class: "contribute-result" });
  let statement = "";
  let contestant = "contributor";
  let claimedDeparture = "";

  function runDraft() {
    if (!statement.trim()) { resultMount.innerHTML = ""; resultMount.appendChild(renderReceipt({ decision: "declined", error: "a contest statement is required", findings: [] })); return; }
    const departure = claimedDeparture.trim() ? { ceiling: claimedDeparture.trim() } : undefined;
    const { proposal, contestReceipt, receipt } = draftContest(community, targetRow.kind, { statement, contestant, claimedDeparture: departure });
    resultMount.innerHTML = "";
    resultMount.appendChild(renderReceipt(receipt));
    resultMount.appendChild(el("p", {}, contestReceipt.note));
    resultMount.appendChild(el("p", {}, `Convertible to a fork: ${contestReceipt.convertible}`));
    if (!PASSED.has(receipt.decision)) return;
    resultMount.appendChild(renderLadder("gate-passed"));
    const exportBtn = el("button", { type: "button", class: "export-button" }, "Export contest");
    exportBtn.addEventListener("click", () => {
      const bundle = bundleProposal(proposal, receipt, { kernel_id: community.kernelId, state_id: community.snapshotHash });
      downloadJSONBlob(`contest-${bundle.contribution_id.slice(0, 12)}.json`, JSON.stringify(bundle, null, 2));
      resultMount.appendChild(el("p", {}, `Contribution id: ${bundle.contribution_id}`));
      const signingMount = el("div", {});
      resultMount.appendChild(signingMount);
      renderSigningPanel(signingMount, { bundle });
    });
    resultMount.appendChild(exportBtn);
  }

  const form = el(
    "form",
    { class: "contribute-form", onsubmit: (e) => { e.preventDefault(); runDraft(); } },
    el("p", { class: "contribute-target" }, `Target claim's kind: ${targetRow.kind}`),
    el("label", {}, "What about this type is contested", el("textarea", { required: true, oninput: (e) => (statement = e.target.value) })),
    el("label", {}, "Contestant id", el("input", { type: "text", value: contestant, oninput: (e) => (contestant = e.target.value) })),
    el("label", {}, "Claimed departure ceiling (optional)", el("input", { type: "text", oninput: (e) => (claimedDeparture = e.target.value) })),
    el("button", { type: "submit" }, "Check with the gate")
  );
  container.appendChild(form);
  container.appendChild(resultMount);
}

function renderForkDraft(container, ctx) {
  const { community, targetRow } = ctx;
  const resultMount = el("div", { class: "contribute-result" });
  let newCeiling = "";

  function runDraft() {
    resultMount.innerHTML = "";
    if (!newCeiling.trim()) { resultMount.appendChild(el("p", {}, "a departure (a new ceiling) is required")); return; }
    let fork;
    try {
      fork = draftFork(community, targetRow.kind, { ceiling: newCeiling.trim() });
    } catch (e) {
      resultMount.appendChild(el("p", {}, `fork refused: ${e.message}`));
      return;
    }
    resultMount.appendChild(
      el(
        "div",
        { class: "fork-receipt" },
        el("p", {}, `Parent type-hash: ${fork.parent_hash}`),
        el("p", {}, `Child type-hash: ${fork.new_hash}`),
        el("ul", {}, ...fork.departure.map((d) => el("li", {}, `${d.field}: ${d.from} -> ${d.to}`))),
        el("p", { class: "empty" }, fork.note)
      )
    );
  }

  const form = el(
    "form",
    { class: "contribute-form", onsubmit: (e) => { e.preventDefault(); runDraft(); } },
    el("p", { class: "contribute-target" }, `Target claim's kind: ${targetRow.kind}`),
    el("label", {}, "New ceiling (the departure)", el("input", { type: "text", required: true, oninput: (e) => (newCeiling = e.target.value) })),
    el("button", { type: "submit" }, "Fork")
  );
  container.appendChild(form);
  container.appendChild(resultMount);
}

export function renderContributeScreen(container, ctx) {
  container.innerHTML = "";
  const backBtn = el("button", { type: "button", class: "contribute-back" }, "Back to the feed");
  backBtn.addEventListener("click", () => ctx.onBack && ctx.onBack());
  container.appendChild(el("h2", {}, ACTION_TITLES[ctx.action] || "Contribute"));
  container.appendChild(backBtn);

  if (ctx.action === "contest") renderContestDraft(container, ctx);
  else if (ctx.action === "fork") renderForkDraft(container, ctx);
  else if (ctx.action === "comment" || ctx.action === "reply") renderCommentDraft(container, ctx);
  else if (ctx.action === "promote") renderPromoteDraft(container, ctx);
  else renderProposalDraft(container, ctx);
}
