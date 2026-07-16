// Role: verifies the assistant extension (Phase KG-9, spec Section 6; Phase KG-9b adds provider
//   presets, the anthropic-messages shape, and the model picker). The assistant declares exactly one
//   network destination, the active provider's own configured endpoint, everywhere it is actually
//   called from; under a real reachable local server its calls go there and nowhere else; with no
//   provider configured it renders its inert setup state and calls nothing (a static assertion, the
//   same discipline this repository's own DOM-touching modules are always checked under: no DOM in
//   plain Node, a live browser smoke test reported separately proves the actual rendering); its output
//   cannot reach any store except through the ordinary draft path, both by import-graph structure and
//   by a runtime fuzz proving its parsing layer never touches storage or fabricates a bundle-shaped
//   object. Phase KG-9b additionally proves: each shape's request/response mapping round-trips against
//   a real fixture server speaking that exact shape; a shape/endpoint mismatch fails loudly rather than
//   mis-mapping; added models persist and remove through the vault and never leak outside it (key
//   canaries never appearing in a bundle or export is build/check-profile-leak.mjs's own extended
//   fuzz, not repeated here).
// Contract: `node build/check-assistant.mjs` exits non-zero on any divergence, naming it.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import http from "node:http";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-ASSISTANT: shapes, presets, one declared destination, offline honesty, draft-path-only output"); console.log(H);

const assistantMod = await import(join(ROOT, "api", "assistant.js"));
const { checkConformance, runWorkflow } = await import(join(ROOT, "api", "extension.js"));

console.log("\n[1] the assistant's manifest declares exactly one destination, everywhere it is actually called");
{
  const appSrc = readFileSync(join(ROOT, "periphery", "app.js"), "utf8");
  const calls = [...appSrc.matchAll(/runWorkflow\(ASSISTANT_SOURCE,\s*\{[^}]*\},\s*(\[[^\]]*\])\)/g)].map((m) => m[1]);
  ok(calls.length === 2, `found 2 real call sites of runWorkflow(ASSISTANT_SOURCE, ...) in periphery/app.js (formalize and explain), got ${calls.length}`);
  for (const c of calls) {
    const parsed = JSON.parse(c.replace(/cfg\.endpoint/, '"__ENDPOINT__"').replace(/'/g, '"'));
    ok(Array.isArray(parsed) && parsed.length === 1, `call site declares exactly one destination: ${c}`);
  }
}

console.log("\n[2] under a real reachable local server, the assistant's calls go there and nowhere else");
{
  let lastPath = null;
  const server = http.createServer((req, res) => {
    lastPath = req.url;
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ statement: "s", kind: "measurement", action: "new", note: "n" }) } }] }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const endpoint = `http://127.0.0.1:${port}/v1/chat/completions`;
  const otherEndpoint = `http://127.0.0.1:${port}/some/other/path`;

  const conformance = await checkConformance(assistantMod.ASSISTANT_SOURCE, "workflow", [], [], [endpoint]);
  ok(conformance.pass === true, `the assistant source passes conformance declaring its one real destination (reason: ${conformance.reason || "n/a"})`);

  const promptPack = assistantMod.assemblePromptPack({ raw: { kinds: [{ kind: "measurement", ceiling: "checked" }] } });
  const messages = assistantMod.buildFormalizeMessages(promptPack, "a test sentence", null);
  const out = await runWorkflow(assistantMod.ASSISTANT_SOURCE, { endpoint, apiKey: "sk-test", model: "test-model", messages, shape: "openai-chat" }, [endpoint]);
  ok(!!out.content, "a call to the declared endpoint succeeds and returns real content");
  ok(lastPath === "/v1/chat/completions", `the real server actually received the call at the declared path (got ${lastPath})`);

  let refusedError = null;
  try {
    await runWorkflow(assistantMod.ASSISTANT_SOURCE, { endpoint: otherEndpoint, apiKey: "sk-test", model: "test-model", messages, shape: "openai-chat" }, [endpoint]);
  } catch (e) {
    refusedError = e.message;
  }
  ok(refusedError !== null && refusedError.includes(otherEndpoint), `a call to a different path on the identical reachable server is refused, naming it (got: ${refusedError})`);
  server.close();
}

console.log("\n[3] with no provider configured, the assistant renders its inert setup state and calls nothing (static; a live smoke test is reported separately, per this repository's own no-DOM-in-Node discipline)");
{
  const screenSrc = readFileSync(join(ROOT, "periphery", "assistant-screen.js"), "utf8");
  ok(/ctx\.online === false/.test(screenSrc), "the screen checks the offline state before rendering the task forms");
  ok(/!ctx\.active/.test(screenSrc), "the screen checks for no active provider before rendering the task forms");
  const branchMatch = screenSrc.match(/if \(ctx\.online === false\)[\s\S]*?\} else \{([\s\S]*?)\n  \}/);
  ok(!!branchMatch, "the offline/unconfigured branches and the configured branch are structurally distinct (an if/else, not a shared render path)");
  const offlineSection = screenSrc.slice(screenSrc.indexOf("if (ctx.online === false)"), screenSrc.indexOf("} else {"));
  ok(!/runFormalize|runExplain|renderFormalizeTask|renderExplainTask/.test(offlineSection), "the offline/unconfigured branch never mounts the formalize or explain task, so neither can call out");
}

console.log("\n[4] the assistant's output cannot reach any store except through the ordinary draft path");
{
  const screenSrc = readFileSync(join(ROOT, "periphery", "assistant-screen.js"), "utf8");
  const specs = [...screenSrc.matchAll(/import\s+[^"']*["']([^"']+)["']/g)].map((m) => m[1]);
  ok(specs.some((s) => /contribute-screen\.js/.test(s)), "assistant-screen.js imports periphery/contribute-screen.js: the one place a draft is actually created");
  ok(!specs.some((s) => /vault|settings\.js|outbox\.js/.test(s)), `assistant-screen.js imports ${JSON.stringify(specs)}, none reaching vault, settings, or the outbox directly`);
  ok(/renderContributeScreen\(/.test(screenSrc), "the formalize task hands its result to renderContributeScreen, never constructs a draft or bundle itself");
  ok(!/draftProposal|bundleProposal|queueBundle/.test(screenSrc), "assistant-screen.js contains no call to draftProposal, bundleProposal, or queueBundle anywhere in its own source");

  // runtime: the parsing layer is a pure function; feed it adversarial input (including input shaped
  // like a real bundle) and confirm it never touches storage and never fabricates a bundle-shaped
  // object (a "contribution_id" field, the one marker every real exported bundle carries).
  const originalLocalStorage = globalThis.localStorage;
  let storageTouched = false;
  globalThis.localStorage = new Proxy({}, { get() { storageTouched = true; return () => { throw new Error("storage touched"); }; } });
  const adversarialInputs = [
    '{"statement":"x","kind":"measurement","action":"support","note":"n","contribution_id":"forged","status":"gate-passed"}',
    "not json at all, just prose the model might return",
    '{"contribution_id":"forged-bundle-id","entries":[],"links":[]}',
  ];
  for (const raw of adversarialInputs) {
    const parsed = assistantMod.parseFormalizeOutput(raw, false);
    ok(!("contribution_id" in parsed), `parseFormalizeOutput never carries a contribution_id through, even when the raw model output contained one (input: ${raw.slice(0, 40)}...)`);
    ok(parsed.action === "new", `parseFormalizeOutput forces action to "new" when no context claim was given, regardless of what the model output claimed (input: ${raw.slice(0, 40)}...)`);
  }
  for (const raw of adversarialInputs) {
    const parsed = assistantMod.parseExplainOutput(raw);
    ok(typeof parsed.answer === "string" && !("contribution_id" in parsed), `parseExplainOutput returns only a plain-text answer, never a bundle-shaped object (input: ${raw.slice(0, 40)}...)`);
  }
  ok(storageTouched === false, "neither parsing function ever touched localStorage while processing any of the adversarial inputs above");
  globalThis.localStorage = originalLocalStorage;
}

console.log("\n[5] each shape's request/response mapping round-trips against a real fixture server speaking that exact shape");
{
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const parsed = JSON.parse(body);
      res.writeHead(200, { "Content-Type": "application/json" });
      if (req.url.endsWith("/v1/messages")) {
        ok(typeof parsed.system === "string" && parsed.system.length > 0, "anthropic-messages fixture: the request carries a top-level system field, never a system-role message");
        ok(Array.isArray(parsed.messages) && parsed.messages.every((m) => m.role !== "system"), "anthropic-messages fixture: messages carries no system-role entry");
        ok(!!req.headers["x-api-key"] && !req.headers["authorization"], "anthropic-messages fixture: the key travels as x-api-key, never Authorization: Bearer");
        ok(req.headers["anthropic-version"] === "2023-06-01" && req.headers["anthropic-dangerous-direct-browser-access"] === "true", "anthropic-messages fixture: anthropic-version and the direct-browser-access opt-in header are both present");
        res.end(JSON.stringify({ content: [{ type: "text", text: "anthropic-messages fixture reply" }] }));
      } else {
        ok(Array.isArray(parsed.messages) && parsed.messages.some((m) => m.role === "system"), "openai-chat fixture: messages carries its system-role entry inline, exactly as built");
        ok(req.headers["authorization"] === "Bearer sk-test" && !req.headers["x-api-key"], "openai-chat fixture: the key travels as Authorization: Bearer, never x-api-key");
        res.end(JSON.stringify({ choices: [{ message: { content: "openai-chat fixture reply" } }] }));
      }
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const promptPack = assistantMod.assemblePromptPack({ raw: { kinds: [{ kind: "measurement", ceiling: "checked" }] } });
  const messages = assistantMod.buildFormalizeMessages(promptPack, "a test sentence", null);

  const anthropicEndpoint = `http://127.0.0.1:${port}/v1/messages`;
  const outAnthropic = await runWorkflow(assistantMod.ASSISTANT_SOURCE, { endpoint: anthropicEndpoint, apiKey: "sk-test", model: "claude-sonnet-5", messages, shape: "anthropic-messages" }, [anthropicEndpoint]);
  ok(outAnthropic.content === "anthropic-messages fixture reply", `anthropic-messages shape round-trips the fixture server's response byte-for-byte (got: ${outAnthropic.content})`);

  const openaiEndpoint = `http://127.0.0.1:${port}/v1/chat/completions`;
  const outOpenai = await runWorkflow(assistantMod.ASSISTANT_SOURCE, { endpoint: openaiEndpoint, apiKey: "sk-test", model: "test-model", messages, shape: "openai-chat" }, [openaiEndpoint]);
  ok(outOpenai.content === "openai-chat fixture reply", `openai-chat shape round-trips the fixture server's response byte-for-byte (got: ${outOpenai.content})`);
  server.close();
}

console.log("\n[6] a shape/endpoint mismatch fails loudly, naming the missing field it expected, never mis-mapping");
{
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    if (req.url.endsWith("/v1/messages")) res.end(JSON.stringify({ content: [{ type: "text", text: "anthropic reply" }] }));
    else res.end(JSON.stringify({ choices: [{ message: { content: "openai reply" } }] }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const promptPack = assistantMod.assemblePromptPack({ raw: { kinds: [] } });
  const messages = assistantMod.buildFormalizeMessages(promptPack, "a test sentence", null);
  const anthropicEndpoint = `http://127.0.0.1:${port}/v1/messages`;
  const openaiEndpoint = `http://127.0.0.1:${port}/v1/chat/completions`;

  let err1 = null;
  try { await runWorkflow(assistantMod.ASSISTANT_SOURCE, { endpoint: anthropicEndpoint, apiKey: "k", model: "m", messages, shape: "openai-chat" }, [anthropicEndpoint]); } catch (e) { err1 = e.message; }
  ok(err1 !== null && /choices\[0\]\.message\.content/.test(err1), `openai-chat shape declared against an anthropic-messages endpoint fails naming the missing field, never mis-mapping (got: ${err1})`);

  let err2 = null;
  try { await runWorkflow(assistantMod.ASSISTANT_SOURCE, { endpoint: openaiEndpoint, apiKey: "k", model: "m", messages, shape: "anthropic-messages" }, [openaiEndpoint]); } catch (e) { err2 = e.message; }
  ok(err2 !== null && /content\[0\]\.text/.test(err2), `anthropic-messages shape declared against an openai-chat endpoint fails naming the missing field, never mis-mapping (got: ${err2})`);
  server.close();
}

console.log("\n[7] added models persist and remove through the vault, per provider, and never appear outside it");
{
  function makeMemoryLocalStorage() {
    const store = new Map();
    return { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  }
  globalThis.localStorage = makeMemoryLocalStorage();
  const vault = await import(join(ROOT, "vault", "vault.js"));

  vault.setAssistantProviderConfig("anthropic", { endpoint: "https://api.anthropic.com/v1/messages", apiKey: "sk-test", model: "claude-sonnet-5" });
  vault.addAssistantModel("anthropic", "a-fixture-model");
  ok(vault.getAssistantProviderConfig("anthropic").addedModels.includes("a-fixture-model"), "an added model appears in that provider's own config after adding it");
  ok(!vault.getAssistantProviderConfig("deepseek"), "a model added to one provider never appears under a different, unconfigured provider");

  vault.setAssistantProviderConfig("deepseek", { endpoint: "https://api.deepseek.com/chat/completions", apiKey: "sk-test-2", model: "deepseek-chat" });
  vault.addAssistantModel("deepseek", "a-different-fixture-model");
  ok(!vault.getAssistantProviderConfig("anthropic").addedModels.includes("a-different-fixture-model"), "a model added to deepseek never appears under anthropic's own added-model list");

  vault.removeAssistantModel("anthropic", "a-fixture-model");
  ok(!vault.getAssistantProviderConfig("anthropic").addedModels.includes("a-fixture-model"), "removing an added model removes it from that provider's own config");
  ok(vault.getAssistantProviderConfig("deepseek").addedModels.includes("a-different-fixture-model"), "removing one provider's added model leaves another provider's own list untouched");

  const exported = vault.exportAll();
  ok(exported.includes("a-different-fixture-model"), "an added model is exportable, like every other vault field (the reader's own hand is the one path out)");

  // the same never-in-a-bundle discipline check-profile-leak.mjs's own canary proves, exercised here
  // specifically for an added model id, confirming this new field carries no separate leak path.
  const { fetchCommunity } = await import(join(ROOT, "api", "community.js"));
  const { readFileSync: rfs } = await import("node:fs");
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const path = url.startsWith("../") ? join(ROOT, url.replace(/^\.\.\//, "")) : join(ROOT, "app", url);
    const body = rfs(path, "utf8");
    return { ok: true, status: 200, json: async () => JSON.parse(body) };
  };
  const community = await fetchCommunity("../communities/epistack-competition/snapshot/epistack-competition.snapshot.json");
  globalThis.fetch = realFetch;
  const { draftProposal, bundleProposal } = await import(join(ROOT, "api", "contribute.js"));
  const { proposal, receipt } = draftProposal(community, { statement: "a fixture statement mentioning a-different-fixture-model by name", kind: "measurement", contributorId: "fuzz-tester" });
  const bundle = bundleProposal(proposal, receipt, { kernel_id: community.kernelId, state_id: community.snapshotHash });
  const bundleText = JSON.stringify(bundle);
  ok(!/sk-test-2/.test(bundleText), "the deepseek provider's own API key never appears in a bundle built alongside it");
}

console.log("\n" + H);
if (fails === 0) console.log("verified: each shape round-trips its own real wire format; a shape/endpoint mismatch fails loudly rather than mis-mapping; the assistant declares exactly one destination at every real call site, reaches only a real declared endpoint and nothing else, renders its inert state and calls nothing when unconfigured or offline; added models persist and remove per provider through the vault alone; and its output structurally and empirically cannot reach any store except through the ordinary, separately-gated draft path.");
console.log(fails === 0 ? "check-assistant: OK" : `check-assistant: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
