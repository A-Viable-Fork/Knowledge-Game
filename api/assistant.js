// Role: the first assistant extension (Phase KG-9, spec Section 6, "Assistant extensions"). A
//   workflow-shaped extension, loaded through the identical public seam any extension uses
//   (api/extension.js's checkConformance/runWorkflow, api/extension-sandbox.js's capability-scoped
//   fetch). Its content is a prompt pack assembled entirely from this deployment's own real vocabulary
//   (the vendored confidence lattice, the active community's own kind table, and a short register
//   note on the ladder and citation discipline this app already renders elsewhere), never an
//   invented one, so the model addresses the system in the system's own terms. Two tasks: formalize
//   (informal text, optionally alongside an existing claim the user picked as context, in ->
//   {statement, kind, action, note} out) and explain (an existing claim's own support-chain slice in
//   -> {answer} out). Provider-agnostic at the shape level (Phase KG-9b): two request shapes exist,
//   openai-chat (OpenAI itself, DeepSeek, and any OpenAI-compatible custom base) and anthropic-
//   messages (Anthropic's own messages endpoint); a preset names an endpoint, a shape, and a starter
//   model list, never vendor-specific code, so a future vendor speaking an existing shape is a new
//   preset, not new logic.
// Contract: assemblePromptPack(community) -> string. buildFormalizeMessages(promptPack, informalText,
//   contextClaim|null) -> messages array. buildExplainMessages(promptPack, claim, supports, challenges)
//   -> messages array. parseFormalizeOutput(rawContent, hadContext) -> {statement, kind, action, note}
//   (defensive: a non-JSON reply degrades to a plain "new" claim carrying the raw text verbatim,
//   never thrown away). parseExplainOutput(rawContent) -> {answer} (never structured; the raw reply
//   is the answer). ASSISTANT_SOURCE: the sandboxed extensionMain source string, the one place a real
//   network call happens, always exactly one destination (the caller's own configured endpoint) per
//   configured provider; input.shape selects the request/response mapping, never the endpoint alone
//   (Phase KG-9b: a call whose shape does not match what the endpoint actually speaks fails loudly,
//   naming the missing field it expected, rather than silently mis-mapping content). PROVIDER_PRESETS:
//   the shipped preset table, each {id, name, endpoint, shape, keyHeaderForm, starterModels,
//   corsStatus, corsNote}; corsStatus is "verified-browser-direct" or "relay-required", live-tested
//   from a real browser context during this phase's own build (see the report), never asserted from
//   documentation alone.
// Invariant: this module never imports vault/ or api/settings.js (the caller reads the key and
//   endpoint and passes them into runWorkflow's input; this module never reads storage itself) and
//   never imports api/contribute.js or vendor/api/contribution.js (nothing here can construct or
//   touch a bundle; the human's own subsequent action on the draft screen is what does that, through
//   the ordinary draft path, unchanged). ASSISTANT_SOURCE's extensionMain declines to act (no fetch
//   attempted) on any input lacking a real task, so install-time conformance's generic task-less
//   probe passes without ever reaching the network, exactly like the two demo extensions.
// Governs: claim-20: the assistant is this deployment's own worked example of a workflow-shaped
//   extension declaring exactly one destination; build/check-assistant.mjs proves its manifest, its
//   egress is exact, its offline honesty, and its structural inability to reach a store outside draft.
"use strict";
import { POSITIONS, COLLAPSED } from "../vendor/kernel/schema/confidence.mjs";

const GRADE_ORDER = [...COLLAPSED.filter((g) => g !== "settled"), "checked", "independently-rechecked", "constitutive"];

// the register note: the same ladder/citation vocabulary already rendered elsewhere in this app
// (periphery/ladder.js's three-state ladder, api/contribute.js's citation-never-independent rule),
// restated here in prose since the membrane runs periphery to api and never back, so this file
// cannot reach periphery/ladder.js directly; this is the "register guidance" the prompt pack
// carries, not a parallel or looser restatement of the rule.
const REGISTER_NOTE = [
  "A grade is a computed reading of a claim's support structure, never a claim of truth, and never this",
  "assistant's to assign; only the on-device gate computes a grade. Contribution status is three",
  "distinct states, never implying one another: gate-passed (grounds structurally), admitted (the",
  "target community merged it), semantically accepted (members judged it true enough to build on).",
  "A pasted citation always becomes a testimony-class source, never an independent confirmation,",
  "regardless of how it is phrased. A comment is always ungraded and never carries a support link.",
].join(" ");

export function assemblePromptPack(community) {
  const gradeLine = GRADE_ORDER.map((g) => `${g} (${POSITIONS[g].tier}${POSITIONS[g].mode ? "/" + POSITIONS[g].mode : ""})`).join(" < ");
  const kinds = ((community && community.raw && community.raw.kinds) || []).map((k) => `${k.kind} (ceiling ${k.ceiling})`);
  return [
    "You are a formalization and explanation assistant for a graded-claim knowledge graph. You never",
    "assign a grade or decide admission; you only propose structured drafts and explain structure you",
    "are given, for a human to review through the app's own gate.",
    "",
    `Grade lattice, low to high: ${gradeLine}.`,
    "",
    `This community's adopted claim kinds: ${kinds.length ? kinds.join(", ") : "(none declared)"}.`,
    "",
    REGISTER_NOTE,
  ].join("\n");
}

const FORMALIZE_INSTRUCTIONS = [
  "Task: formalize. The user has written an informal statement. Propose a formal claim.",
  "Reply with strict JSON only, no prose outside it, in the shape:",
  '{"statement": "...", "kind": "one of the adopted kinds above", "action": "new, support, undercut, or qualification", "note": "one sentence on why this shape"}',
  'If no context claim is given below, "action" must be "new"; you have no identity to link against.',
  'If a context claim is given, propose whichever of support/undercut/qualification/new fits the',
  "candidate support shape best; the app itself resolves the actual link, you are only suggesting its",
  "shape, never inventing an identity to link to.",
].join(" ");

const EXPLAIN_INSTRUCTIONS = [
  "Task: explain. You are given one claim and the support/challenge structure actually attached to it",
  "(nothing else in the graph). Answer only about this structure; do not speculate beyond what you are",
  "given. Reply with plain text, not JSON.",
].join(" ");

export function buildFormalizeMessages(promptPack, informalText, contextClaim) {
  const contextLine = contextClaim
    ? `The user picked this existing claim as context: "${contextClaim.statement}" (kind: ${contextClaim.kind}).`
    : "The user picked no context claim; this is a wholly new, unlinked claim.";
  return [
    { role: "system", content: promptPack },
    { role: "user", content: `${FORMALIZE_INSTRUCTIONS}\n\n${contextLine}\n\nInformal text: ${informalText}` },
  ];
}

export function buildExplainMessages(promptPack, claim, supports, challenges) {
  const supportsLine = supports.length ? supports.map((s) => `supports from "${s.statement}"`).join("; ") : "no supports recorded";
  const challengesLine = challenges.length ? challenges.map((c) => `${c.link_kind} from "${c.statement}"`).join("; ") : "no challenges recorded";
  return [
    { role: "system", content: promptPack },
    {
      role: "user",
      content: `${EXPLAIN_INSTRUCTIONS}\n\nClaim: "${claim.statement}" (kind: ${claim.kind}, declared grade: ${claim.declared_grade}, earned grade: ${claim.earned_grade}).\nSupport structure: ${supportsLine}. Challenge structure: ${challengesLine}.`,
    },
  ];
}

const VALID_ACTIONS = new Set(["new", "support", "undercut", "qualification"]);

export function parseFormalizeOutput(rawContent, hadContext) {
  try {
    const parsed = JSON.parse(rawContent);
    if (parsed && typeof parsed.statement === "string" && typeof parsed.kind === "string") {
      return {
        statement: parsed.statement,
        kind: parsed.kind,
        action: hadContext && VALID_ACTIONS.has(parsed.action) && parsed.action !== "new" ? parsed.action : "new",
        note: typeof parsed.note === "string" ? parsed.note : "",
      };
    }
  } catch (e) {
    void e;
  }
  return { statement: String(rawContent || "").slice(0, 500), kind: "", action: "new", note: "(unstructured model output, shown verbatim; the app could not parse it as the requested JSON shape)" };
}

export function parseExplainOutput(rawContent) {
  return { answer: String(rawContent || "") };
}

// Phase KG-9b: the objective-chip discipline applied to the assistant. The reader always sees which
// producer they are talking to, everywhere in the app, not only on the assistant screen itself; a
// pure function of settings alone (providerId, model), same shape as api/ranking.js's own
// objectiveChipLabel. Null (renders no chip) when no provider is configured yet.
export function assistantChipLabel(providerId, model, presets) {
  if (!providerId || !model) return null;
  const preset = (presets || PROVIDER_PRESETS).find((p) => p.id === providerId);
  return `${preset ? preset.name : providerId}: ${model}`;
}

// Phase KG-9b: the shipped provider presets. Two shapes exist (openai-chat, anthropic-messages);
// a preset is a shape plus an endpoint plus a starter model list, never vendor-specific code. corsStatus
// is empirically tested (see the KG-9b report), not asserted from documentation: "verified-browser-direct"
// means a real browser context reached the endpoint and received a genuine HTTP response (even an
// error status counts, since the point is that CORS itself did not block the request); "relay-required"
// means the identical live test came back "Failed to fetch" at the network layer, the browser's own
// signal that the endpoint does not permit a direct in-page call, so the endpoint field must be pointed
// at a CORS-permitting gateway or relay instead.
export const PROVIDER_PRESETS = [
  {
    id: "anthropic",
    name: "Anthropic",
    endpoint: "https://api.anthropic.com/v1/messages",
    shape: "anthropic-messages",
    keyHeaderForm: "x-api-key header, plus anthropic-version and the direct-browser-access opt-in header",
    starterModels: ["claude-sonnet-5", "claude-opus-4-8", "claude-haiku-4-5-20251001"],
    corsStatus: "verified-browser-direct",
    corsNote: "live-tested from a real browser context with the anthropic-dangerous-direct-browser-access header: the browser receives a genuine response (a 401 with an invalid test key, proving CORS itself did not block the call). The identical call without that header failed at the network layer, confirming the header is required, not decorative.",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    endpoint: "https://api.deepseek.com/chat/completions",
    shape: "openai-chat",
    keyHeaderForm: "Authorization: Bearer header",
    starterModels: ["deepseek-chat", "deepseek-reasoner"],
    corsStatus: "relay-required",
    corsNote: "live-tested from a real browser context: the call failed at the network layer (no response reached the page), the browser's own signal that this endpoint does not send permissive CORS headers. Point the endpoint field at a CORS-permitting gateway or relay to use this preset browser-direct.",
  },
  {
    id: "custom",
    name: "Custom (OpenAI-compatible)",
    endpoint: "",
    shape: "openai-chat",
    keyHeaderForm: "Authorization: Bearer header",
    starterModels: ["gpt-4o-mini"],
    corsStatus: "relay-required",
    corsNote: "the generic base preset for any OpenAI-compatible chat-completions endpoint (the shipped default before this phase). OpenAI's own endpoint was live-tested from a real browser context and failed at the network layer the same way DeepSeek's did; treat any custom OpenAI-compatible endpoint as relay-required unless you have tested otherwise. The endpoint field accepts a gateway or relay URL.",
  },
];

// the one place a real network call happens. Declines to act (no fetch) on any input lacking a real
// task descriptor (endpoint/apiKey/model/messages), so the generic install-time conformance probe
// (an empty {} input) passes without ever attempting a call. input.shape selects the request/response
// mapping ("openai-chat" is the default when absent, preserving the pre-KG-9b call shape). A rejecting
// HTTP status, or a response missing the field the selected shape expects (a shape/endpoint mismatch),
// is surfaced as a thrown error naming what was expected, never swallowed into a fabricated success or
// silently mis-mapped from the other shape's field.
export const ASSISTANT_SOURCE = [
  "function extensionMain(input) {",
  "  if (!input || !input.endpoint || !input.apiKey || !input.model || !input.messages) return { idle: true };",
  '  var shape = input.shape || "openai-chat";',
  '  if (shape === "anthropic-messages") {',
  '    var systemMsg = input.messages.filter(function (m) { return m.role === "system"; }).map(function (m) { return m.content; }).join("\\n\\n");',
  '    var turns = input.messages.filter(function (m) { return m.role !== "system"; });',
  "    return fetch(input.endpoint, {",
  '      method: "POST",',
  '      headers: { "Content-Type": "application/json", "x-api-key": input.apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },',
  "      body: JSON.stringify({ model: input.model, max_tokens: 1024, system: systemMsg, messages: turns }),",
  "    }).then(function (res) {",
  "      return res.json().then(function (data) {",
  '        if (!res.ok) { throw new Error("assistant endpoint returned " + res.status + ": " + JSON.stringify(data).slice(0, 300)); }',
  "        var block = data && data.content && data.content[0];",
  '        var content = block && block.type === "text" ? block.text : null;',
  '        if (typeof content !== "string") { throw new Error("assistant endpoint response missing content[0].text (anthropic-messages shape expected); refusing to mis-map a differently-shaped response"); }',
  "        return { content: content };",
  "      });",
  "    });",
  "  }",
  "  return fetch(input.endpoint, {",
  '    method: "POST",',
  '    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + input.apiKey },',
  "    body: JSON.stringify({ model: input.model, messages: input.messages, temperature: 0 }),",
  "  }).then(function (res) {",
  "    return res.json().then(function (data) {",
  '      if (!res.ok) { throw new Error("assistant endpoint returned " + res.status + ": " + JSON.stringify(data).slice(0, 300)); }',
  "      var content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;",
  '      if (typeof content !== "string") { throw new Error("assistant endpoint response missing choices[0].message.content (openai-chat shape expected); refusing to mis-map a differently-shaped response"); }',
  "      return { content: content };",
  "    });",
  "  });",
  "}",
].join("\n");
