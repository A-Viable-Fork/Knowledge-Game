// Role: the first assistant extension (Phase KG-9, spec Section 6, "Assistant extensions"). A
//   workflow-shaped extension, loaded through the identical public seam any extension uses
//   (api/extension.js's checkConformance/runWorkflow, api/extension-sandbox.js's capability-scoped
//   fetch). Its content is a prompt pack assembled entirely from this deployment's own real vocabulary
//   (the vendored confidence lattice, the active community's own kind table, and a short register
//   note on the ladder and citation discipline this app already renders elsewhere), never an
//   invented one, so the model addresses the system in the system's own terms. Two tasks: formalize
//   (informal text, optionally alongside an existing claim the user picked as context, in ->
//   {statement, kind, action, note} out) and explain (an existing claim's own support-chain slice in
//   -> {answer} out). Provider-agnostic: any OpenAI-compatible chat-completions endpoint, the
//   endpoint and model both user-configured settings, never a hardcode.
// Contract: assemblePromptPack(community) -> string. buildFormalizeMessages(promptPack, informalText,
//   contextClaim|null) -> messages array. buildExplainMessages(promptPack, claim, supports, challenges)
//   -> messages array. parseFormalizeOutput(rawContent, hadContext) -> {statement, kind, action, note}
//   (defensive: a non-JSON reply degrades to a plain "new" claim carrying the raw text verbatim,
//   never thrown away). parseExplainOutput(rawContent) -> {answer} (never structured; the raw reply
//   is the answer). ASSISTANT_SOURCE: the sandboxed extensionMain source string, the one place a real
//   network call happens, always exactly one destination (the caller's own configured endpoint).
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

// the one place a real network call happens. Declines to act (no fetch) on any input lacking a real
// task descriptor (endpoint/apiKey/model/messages), so the generic install-time conformance probe
// (an empty {} input) passes without ever attempting a call. A rejecting HTTP status is surfaced as a
// thrown error naming it, never swallowed into a fabricated success.
export const ASSISTANT_SOURCE = [
  "function extensionMain(input) {",
  "  if (!input || !input.endpoint || !input.apiKey || !input.model || !input.messages) return { idle: true };",
  "  return fetch(input.endpoint, {",
  '    method: "POST",',
  '    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + input.apiKey },',
  "    body: JSON.stringify({ model: input.model, messages: input.messages, temperature: 0 }),",
  "  }).then(function (res) {",
  "    return res.json().then(function (data) {",
  '      if (!res.ok) { throw new Error("assistant endpoint returned " + res.status + ": " + JSON.stringify(data).slice(0, 300)); }',
  "      var content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;",
  '      if (typeof content !== "string") { throw new Error("assistant endpoint response missing choices[0].message.content"); }',
  "      return { content: content };",
  "    });",
  "  });",
  "}",
].join("\n");
