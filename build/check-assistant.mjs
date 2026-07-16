// Role: verifies the first assistant extension (Phase KG-9, spec Section 6). The assistant declares
//   exactly one network destination, the user's own configured endpoint, everywhere it is actually
//   called from; under a real reachable local server its calls go there and nowhere else; with no key
//   or endpoint configured it renders its inert setup state and calls nothing (a static assertion,
//   the same discipline this repository's own DOM-touching modules are always checked under: no DOM
//   in plain Node, a live browser smoke test reported separately proves the actual rendering);
//   its output cannot reach any store except through the ordinary draft path, both by import-graph
//   structure and by a runtime fuzz proving its parsing layer never touches storage or fabricates a
//   bundle-shaped object. Key canaries never appearing in a bundle or export is
//   build/check-profile-leak.mjs's own extended fuzz, not repeated here.
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
console.log(H); console.log("CHECK-ASSISTANT: one declared destination, offline honesty, draft-path-only output"); console.log(H);

const assistantMod = await import(join(ROOT, "api", "assistant.js"));
const { checkConformance, runWorkflow } = await import(join(ROOT, "api", "extension.js"));

console.log("\n[1] the assistant's manifest declares exactly one destination, everywhere it is actually called");
{
  const appSrc = readFileSync(join(ROOT, "periphery", "app.js"), "utf8");
  const calls = [...appSrc.matchAll(/runWorkflow\(ASSISTANT_SOURCE,\s*\{[^}]*\},\s*(\[[^\]]*\])\)/g)].map((m) => m[1]);
  ok(calls.length === 2, `found 2 real call sites of runWorkflow(ASSISTANT_SOURCE, ...) in periphery/app.js (formalize and explain), got ${calls.length}`);
  for (const c of calls) {
    const parsed = JSON.parse(c.replace(/endpoint\.url/, '"__ENDPOINT__"').replace(/'/g, '"'));
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
  const out = await runWorkflow(assistantMod.ASSISTANT_SOURCE, { endpoint, apiKey: "sk-test", model: "test-model", messages }, [endpoint]);
  ok(!!out.content, "a call to the declared endpoint succeeds and returns real content");
  ok(lastPath === "/v1/chat/completions", `the real server actually received the call at the declared path (got ${lastPath})`);

  let refusedError = null;
  try {
    await runWorkflow(assistantMod.ASSISTANT_SOURCE, { endpoint: otherEndpoint, apiKey: "sk-test", model: "test-model", messages }, [endpoint]);
  } catch (e) {
    refusedError = e.message;
  }
  ok(refusedError !== null && refusedError.includes(otherEndpoint), `a call to a different path on the identical reachable server is refused, naming it (got: ${refusedError})`);
  server.close();
}

console.log("\n[3] with no key or endpoint configured, the assistant renders its inert setup state and calls nothing (static; a live smoke test is reported separately, per this repository's own no-DOM-in-Node discipline)");
{
  const screenSrc = readFileSync(join(ROOT, "periphery", "assistant-screen.js"), "utf8");
  ok(/ctx\.online === false/.test(screenSrc), "the screen checks the offline state before rendering the task forms");
  ok(/!ctx\.apiKey \|\| !ctx\.endpoint/.test(screenSrc), "the screen checks for a missing key or endpoint before rendering the task forms");
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

console.log("\n" + H);
if (fails === 0) console.log("verified: the assistant declares exactly one destination at every real call site, reaches only a real declared endpoint and nothing else, renders its inert state and calls nothing when unconfigured or offline, and its output structurally and empirically cannot reach any store except through the ordinary, separately-gated draft path.");
console.log(fails === 0 ? "check-assistant: OK" : `check-assistant: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
