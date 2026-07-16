// Role: the assistant screen (Phase KG-9, spec Section 6, "Assistant extensions"). BYOK setup
//   (endpoint URL, model, API key, all vault-held) plus the two tasks: formalize (informal text, an
//   optional existing claim as context, in -> a prefilled draft screen out) and explain (an existing
//   claim's own support-chain slice in -> a plain-text answer out). Reuses periphery/contribute-
//   screen.js's own renderContributeScreen for the formalize task's actual draft, unchanged, so the
//   collaborative gate feedback the reader already knows is exactly what renders here too.
// Contract: renderAssistantScreen(container, ctx) -> void. ctx = { community, apiKey, endpoint
//   ({url, model} | null), online, onSaveEndpoint({url, model}), onSaveApiKey(key), onFormalize
//   (informalText, contextClaim|null) -> Promise<{statement, kind, action, note}>, onExplain(claim) ->
//   Promise<{answer}>, contributionTarget?, communityId?, onBack }.
// Invariant: renders a plain inert notice and attempts no call when offline or unconfigured (no key,
//   no endpoint); nothing here queues a call for later. onFormalize/onExplain are the caller's own
//   functions (periphery/app.js), which alone read the vault-held key; this module never touches
//   storage itself.
"use strict";
import { renderContributeScreen } from "./contribute-screen.js";

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

function renderSetup(ctx) {
  let url = (ctx.endpoint && ctx.endpoint.url) || "";
  let model = (ctx.endpoint && ctx.endpoint.model) || "";
  let key = ctx.apiKey || "";
  const statusEl = el("p", { class: "assistant-setup-status", "aria-live": "polite" }, "");
  const form = el(
    "form",
    {
      class: "assistant-setup-form",
      onsubmit: (e) => {
        e.preventDefault();
        if (!url.trim() || !model.trim()) { statusEl.textContent = "an endpoint URL and a model are both required"; return; }
        ctx.onSaveEndpoint({ url: url.trim(), model: model.trim() });
        ctx.onSaveApiKey(key.trim() || null);
        statusEl.textContent = "Saved.";
      },
    },
    el("h3", {}, "Assistant setup"),
    el("p", {}, "Bring your own key. The key lives in the vault only, exportable and deletable like everything there; it is never shipped in any extension or written into any patch."),
    el("label", {}, "Endpoint URL (any OpenAI-compatible chat-completions endpoint)", el("input", { type: "text", value: url, placeholder: "https://api.openai.com/v1/chat/completions", oninput: (e) => (url = e.target.value) })),
    el("label", {}, "Model", el("input", { type: "text", value: model, placeholder: "gpt-4o-mini", oninput: (e) => (model = e.target.value) })),
    el("label", {}, "API key", el("input", { type: "password", value: key, oninput: (e) => (key = e.target.value) })),
    el("button", { type: "submit" }, "Save"),
    statusEl
  );
  return form;
}

function renderFormalizeTask(container, ctx) {
  const rows = ctx.community.api.read({});
  let informalText = "";
  let contextIdentity = "";
  const statusEl = el("p", { class: "assistant-task-status", "aria-live": "polite" }, "");
  const draftMount = el("div", { class: "assistant-draft-mount" });

  const contextOptions = [el("option", { value: "" }, "(no context claim; a new, unlinked claim)")].concat(
    rows.filter((r) => r.kind !== "comment").map((r) => el("option", { value: r.identity }, r.statement.slice(0, 60)))
  );

  const form = el(
    "form",
    {
      class: "assistant-formalize-form",
      onsubmit: async (e) => {
        e.preventDefault();
        if (!informalText.trim()) { statusEl.textContent = "informal text is required"; return; }
        statusEl.textContent = "Formalizing...";
        draftMount.innerHTML = "";
        const contextClaim = contextIdentity ? rows.find((r) => r.identity === contextIdentity) : null;
        let result;
        try {
          result = await ctx.onFormalize(informalText, contextClaim);
        } catch (err) {
          statusEl.textContent = `Assistant call failed: ${err.message}`;
          return;
        }
        statusEl.textContent = "";
        renderContributeScreen(draftMount, {
          community: ctx.community,
          action: result.action === "new" ? undefined : result.action,
          targetRow: result.action === "new" ? undefined : contextClaim,
          contributionTarget: ctx.contributionTarget,
          communityId: ctx.communityId,
          prefill: { statement: result.statement, kind: result.kind, assisted: true, note: result.note },
          onBack: () => { draftMount.innerHTML = ""; },
        });
      },
    },
    el("h3", {}, "Formalize"),
    el("label", {}, "Informal text", el("textarea", { required: true, rows: "4", oninput: (e) => (informalText = e.target.value) })),
    el("label", {}, "Context claim (optional)", el("select", { onchange: (e) => (contextIdentity = e.target.value) }, ...contextOptions)),
    el("button", { type: "submit" }, "Formalize with assistant")
  );
  container.appendChild(form);
  container.appendChild(statusEl);
  container.appendChild(draftMount);
}

function renderExplainTask(container, ctx) {
  const rows = ctx.community.api.read({});
  let claimIdentity = rows.length ? rows[0].identity : "";
  const statusEl = el("p", { class: "assistant-task-status", "aria-live": "polite" }, "");
  const answerMount = el("div", { class: "assistant-answer-mount" });

  const claimOptions = rows.map((r) => el("option", { value: r.identity }, r.statement.slice(0, 60)));

  const form = el(
    "form",
    {
      class: "assistant-explain-form",
      onsubmit: async (e) => {
        e.preventDefault();
        answerMount.innerHTML = "";
        statusEl.textContent = "Explaining...";
        const claim = rows.find((r) => r.identity === claimIdentity);
        let result;
        try {
          result = await ctx.onExplain(claim);
        } catch (err) {
          statusEl.textContent = `Assistant call failed: ${err.message}`;
          return;
        }
        statusEl.textContent = "";
        answerMount.appendChild(el("p", { class: "assistant-answer" }, result.answer));
      },
    },
    el("h3", {}, "Explain"),
    el("label", {}, "Claim", el("select", { onchange: (e) => (claimIdentity = e.target.value) }, ...claimOptions)),
    el("button", { type: "submit" }, "Explain this claim's support structure")
  );
  container.appendChild(form);
  container.appendChild(statusEl);
  container.appendChild(answerMount);
}

export function renderAssistantScreen(container, ctx) {
  container.innerHTML = "";
  const backBtn = el("button", { type: "button", class: "contribute-back" }, "Back");
  backBtn.addEventListener("click", () => ctx.onBack && ctx.onBack());

  const section = el(
    "section",
    { class: "assistant-screen", "aria-label": "Assistant" },
    el("h2", {}, "Assistant"),
    backBtn,
    el("p", {}, "A prompt pack assembled from this deployment's own vocabulary, nothing invented. Its output enters nothing except through the ordinary draft path, reviewed by a human's own hand."),
    renderSetup(ctx)
  );

  if (ctx.online === false) {
    section.appendChild(el("p", { class: "assistant-offline-notice" }, "Offline. The assistant makes no network call while offline; nothing is queued for later."));
  } else if (!ctx.apiKey || !ctx.endpoint) {
    section.appendChild(el("p", { class: "assistant-offline-notice" }, "No key or endpoint configured yet. Save both above to use the assistant."));
  } else {
    const formalizeMount = el("div", { class: "assistant-formalize-mount" });
    const explainMount = el("div", { class: "assistant-explain-mount" });
    renderFormalizeTask(formalizeMount, ctx);
    renderExplainTask(explainMount, ctx);
    section.appendChild(formalizeMount);
    section.appendChild(explainMount);
  }

  container.appendChild(section);
}
