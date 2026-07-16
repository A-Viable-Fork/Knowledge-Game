// Role: the assistant screen (Phase KG-9, spec Section 6, "Assistant extensions"; Phase KG-9b adds
//   provider presets and the model picker). BYOK setup (provider preset, endpoint, API key, model, all
//   vault-held, per provider) plus the two tasks: formalize (informal text, an optional existing claim
//   as context, in -> a prefilled draft screen out) and explain (an existing claim's own support-chain
//   slice in -> a plain-text answer out). Reuses periphery/contribute-screen.js's own
//   renderContributeScreen for the formalize task's actual draft, unchanged, so the collaborative gate
//   feedback the reader already knows is exactly what renders here too.
// Contract: renderAssistantScreen(container, ctx) -> void. ctx = { community, presets
//   (api/assistant.js's PROVIDER_PRESETS), active ({providerId, preset, endpoint, apiKey, model,
//   addedModels} | null, the currently active provider's full config), activeProviderId, getProviderConfig
//   (providerId) -> {endpoint, apiKey, model, addedModels} | null, online, onSaveProvider(providerId,
//   {endpoint, apiKey, model}), onSelectActiveProvider(providerId), onAddModel(providerId, modelId),
//   onRemoveModel(providerId, modelId), onFormalize(informalText, contextClaim|null) ->
//   Promise<{statement, kind, action, note}>, onExplain(claim) -> Promise<{answer}>,
//   contributionTarget?, communityId?, onBack }.
// Invariant: renders a plain inert notice and attempts no call when offline or unconfigured (no
//   active provider); nothing here queues a call for later. onFormalize/onExplain are the caller's
//   own functions (periphery/app.js), which alone read the vault-held key; this module never touches
//   storage itself. The model dropdown is populated from the preset's starter list plus the
//   provider's own vault-persisted added models, never a live fetch of a provider's model catalog.
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

const CORS_LABEL = {
  "verified-browser-direct": "Verified browser-direct",
  "relay-required": "Requires a CORS-permitting relay or gateway",
};

function renderSetup(ctx) {
  let selectedId = ctx.activeProviderId || (ctx.presets[0] && ctx.presets[0].id);
  const bodyMount = el("div", { class: "assistant-provider-body" });

  function renderProviderBody() {
    bodyMount.innerHTML = "";
    const preset = ctx.presets.find((p) => p.id === selectedId) || ctx.presets[0];
    const existing = ctx.getProviderConfig(selectedId);
    let url = (existing && existing.endpoint) || preset.endpoint || "";
    let model = (existing && existing.model) || preset.starterModels[0] || "";
    let key = (existing && existing.apiKey) || "";
    let addedModels = (existing && existing.addedModels) || [];
    let newModelId = "";
    const statusEl = el("p", { class: "assistant-setup-status", "aria-live": "polite" }, "");

    function modelOptions() {
      return [...preset.starterModels, ...addedModels].map((m) => el("option", { value: m, selected: m === model ? "" : undefined }, m));
    }

    const modelSelectMount = el("div", { class: "assistant-model-select-mount" });
    function renderModelSelect() {
      modelSelectMount.innerHTML = "";
      modelSelectMount.appendChild(
        el("label", {}, "Model", el("select", { onchange: (e) => (model = e.target.value) }, ...modelOptions()))
      );
      if (addedModels.length) {
        modelSelectMount.appendChild(
          el(
            "ul",
            { class: "assistant-added-models" },
            ...addedModels.map((m) =>
              el(
                "li", {},
                m,
                el("button", {
                  type: "button", class: "assistant-remove-model",
                  onclick: () => { ctx.onRemoveModel(selectedId, m); addedModels = addedModels.filter((x) => x !== m); if (model === m) model = preset.starterModels[0]; renderModelSelect(); },
                }, "Remove")
              )
            )
          )
        );
      }
    }
    renderModelSelect();

    const addModelForm = el(
      "form",
      {
        class: "assistant-add-model-form",
        onsubmit: (e) => {
          e.preventDefault();
          const id = newModelId.trim();
          if (!id) return;
          ctx.onAddModel(selectedId, id);
          if (!addedModels.includes(id)) addedModels = [...addedModels, id];
          model = id;
          newModelId = "";
          addModelInput.value = "";
          renderModelSelect();
        },
      },
      el("label", {}, "Add a model id", (function () {
        const input = el("input", { type: "text", placeholder: "a model id this provider serves", oninput: (e) => (newModelId = e.target.value) });
        return input;
      })())
    );
    const addModelInput = addModelForm.querySelector("input");
    addModelForm.appendChild(el("button", { type: "submit" }, "Add model"));

    const form = el(
      "form",
      {
        class: "assistant-setup-form",
        onsubmit: (e) => {
          e.preventDefault();
          if (!url.trim() || !model.trim() || !key.trim()) { statusEl.textContent = "an endpoint, a model, and an API key are all required"; return; }
          ctx.onSaveProvider(selectedId, { endpoint: url.trim(), apiKey: key.trim(), model: model.trim() });
          statusEl.textContent = "Saved.";
        },
      },
      el("p", { class: "assistant-cors-badge" }, `${CORS_LABEL[preset.corsStatus] || preset.corsStatus}. ${preset.corsNote}`),
      el("label", {}, `Endpoint URL (${preset.keyHeaderForm})`, el("input", { type: "text", value: url, placeholder: preset.endpoint || "https://your-relay.example/v1/chat/completions", oninput: (e) => (url = e.target.value) })),
      modelSelectMount,
      el("label", {}, "API key", el("input", { type: "password", value: key, oninput: (e) => (key = e.target.value) })),
      el("button", { type: "submit" }, "Save"),
      statusEl
    );
    bodyMount.appendChild(form);
    bodyMount.appendChild(addModelForm);

    if (existing && selectedId !== ctx.activeProviderId) {
      const useBtn = el("button", { type: "button", class: "assistant-use-provider" }, `Use ${preset.name} for the assistant`);
      useBtn.addEventListener("click", () => ctx.onSelectActiveProvider(selectedId));
      bodyMount.appendChild(useBtn);
    } else if (existing) {
      bodyMount.appendChild(el("p", { class: "assistant-active-note" }, `${preset.name} is the assistant's active provider.`));
    }
  }
  renderProviderBody();

  const presetSelect = el(
    "select",
    { onchange: (e) => { selectedId = e.target.value; renderProviderBody(); } },
    ...ctx.presets.map((p) => el("option", { value: p.id, selected: p.id === selectedId ? "" : undefined }, p.name))
  );

  return el(
    "div",
    { class: "assistant-setup" },
    el("h3", {}, "Assistant setup"),
    el("p", {}, "Bring your own key. The key lives in the vault only, exportable and deletable like everything there; it is never shipped in any extension or written into any patch. Each provider you configure keeps its own key, endpoint, and model."),
    el("label", {}, "Provider", presetSelect),
    bodyMount
  );
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
  } else if (!ctx.active) {
    section.appendChild(el("p", { class: "assistant-offline-notice" }, "No provider configured yet. Save a provider above to use the assistant."));
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
