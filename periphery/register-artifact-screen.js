// Role: the register-an-artifact guided flow (Phase KG-12 Step 4): pick a kind, name the artifact,
//   attach or produce a conformance run (a sandbox-executable oracle runs live, in this app, right
//   now; a CI-only kind instructs honestly rather than pretending to run), draft the claim through
//   api/register-artifact.js, show the real gate's receipt, then bundle and export exactly like any
//   other contribution (periphery/contribute-screen.js's own export step, reused verbatim: same
//   bundleProposal, same download, same "open a pull request against this destination" instruction).
// Contract: renderRegisterArtifactScreen(container, ctx). ctx = { community, contractRows, onBack }.
//   community is a registry community's fetchCommunity() result; contractRows are this registry's own
//   contract-bundle rows (enriched, api/registry.js's registryRows output) offered as optional
//   depends-on targets.
// Invariant: a conformance citation only ever appears on the drafted claim if a real run actually
//   produced it (runOracleFor's own result) or the registrant explicitly typed a self-attestation for
//   a CI-only kind, marked independence "self" and never claimed as this app's own verification. The
//   export step never appears before the gate has actually decided the draft, and never for a
//   declined one.
"use strict";
import { draftRegistryArtifact, runOracleFor, SANDBOX_EXECUTABLE_KINDS, CI_ONLY_KINDS } from "../api/register-artifact.js";
import { bundleProposal } from "../api/contribute.js";
import { contentHash } from "../api/extension.js";
import { renderLadder } from "./ladder.js";
import { describeReceipt } from "./gate-feedback.js";
import { downloadJSON } from "./vault-screen.js";
import { renderSigningPanel } from "./signing-panel.js";

const KINDS = ["extension", "skin", "component", "client", "community"];
const SHAPES = ["ranker", "renderer", "workflow"];

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

const PASSED = new Set(["accepted", "accepted-with-disagreement"]);

function renderReceipt(receipt) {
  const findings = receipt.findings || [];
  const { present, missing, wouldGround } = describeReceipt(receipt);
  const list = (items) => (items.length ? el("ul", {}, ...items.map((i) => el("li", {}, i))) : null);
  return el(
    "div",
    { class: "gate-receipt" },
    el("p", { class: "gate-decision" }, `Gate decision: ${receipt.decision}`),
    present.length ? el("div", { class: "feedback-present" }, el("h4", {}, "Structure present"), list(present)) : null,
    missing.length ? el("div", { class: "feedback-missing" }, el("h4", {}, "Structure missing"), list(missing)) : null,
    wouldGround.length ? el("div", { class: "feedback-would-ground" }, el("h4", {}, "What would ground it"), list(wouldGround)) : null,
    findings.length
      ? el("details", { class: "feedback-raw-findings" }, el("summary", {}, "Raw findings"), el("ul", { class: "findings" }, ...findings.map((f) => el("li", {}, `${f.rule_id}: expected ${f.expected}, found ${JSON.stringify(f.found)}`))))
      : null
  );
}

export function renderRegisterArtifactScreen(container, ctx) {
  const { community, contractRows, contributionTarget, onBack } = ctx;
  container.innerHTML = "";

  let kind = "extension";
  let statement = "";
  let shape = "ranker";
  let sourceText = "";
  let tokenText = "";
  let communityId = "";
  let ciNote = "";
  let contractIdentity = "";
  let oracleResult = null; // {pass, detail, method, methodClass, independence, artifactHash?}
  let artifactHash = "";
  let last = null; // {proposal, receipt}

  const oracleMount = el("div", { class: "register-oracle-mount" });
  const resultMount = el("div", { class: "register-result-mount" });
  const formMount = el("div", { class: "register-kind-fields" });

  function renderOracleStatus() {
    oracleMount.innerHTML = "";
    if (SANDBOX_EXECUTABLE_KINDS.has(kind)) {
      const btn = el("button", { type: "button", class: "register-run-oracle" }, "Run conformance in this app");
      const status = el("p", { class: "register-oracle-status" }, oracleResult ? `${oracleResult.pass ? "confirms" : "disconfirms"}: ${oracleResult.detail}` : "not yet run");
      btn.addEventListener("click", async () => {
        status.textContent = "running...";
        try {
          let payload;
          if (kind === "extension") payload = { source: sourceText, shape };
          else if (kind === "skin") {
            let variants;
            try { variants = JSON.parse(tokenText); } catch (e) { status.textContent = `refused: pasted tokens are not valid JSON (${e.message})`; return; }
            payload = { variants };
          } else if (kind === "community") {
            const meta = (ctx.knownCommunities || []).find((c) => c.id === communityId);
            if (!meta) { status.textContent = "pick a known community first"; return; }
            payload = { communityMeta: meta };
          }
          oracleResult = await runOracleFor(kind, payload);
          if (kind === "extension") artifactHash = contentHash(sourceText);
          else if (kind === "skin") artifactHash = contentHash(tokenText ? JSON.stringify(JSON.parse(tokenText)) : "");
          else if (kind === "community" && oracleResult.artifactHash) artifactHash = oracleResult.artifactHash;
          status.textContent = `${oracleResult.pass ? "confirms" : "disconfirms"}: ${oracleResult.detail}`;
        } catch (e) {
          status.textContent = `refused: ${e.message}`;
        }
      });
      oracleMount.appendChild(el("p", { class: "register-guidance" }, "This kind's oracle is sandbox-executable; run it here to attach a real, live conformance citation."));
      oracleMount.appendChild(btn);
      oracleMount.appendChild(status);
    } else if (CI_ONLY_KINDS.has(kind)) {
      oracleMount.appendChild(
        el(
          "p",
          { class: "register-guidance" },
          `This kind's required oracle only executes in this repository's own CI (the independent-minimal-client pair for clients, the named check script for components). If you have run it yourself, describe exactly what you ran and what it reported below; this is recorded as a self-attestation, never as this app's own verification. Leave blank to register with no conformance citation.`
        )
      );
      oracleMount.appendChild(
        el("label", {}, "Self-attested CI report (optional)", el("textarea", { oninput: (e) => (ciNote = e.target.value) }, ciNote))
      );
    }
  }

  function renderKindFields() {
    formMount.innerHTML = "";
    if (kind === "extension") {
      formMount.appendChild(
        el(
          "label", {}, "Shape",
          el("select", { onchange: (e) => { shape = e.target.value; oracleResult = null; } }, ...SHAPES.map((s) => el("option", { value: s }, s)))
        )
      );
      formMount.appendChild(
        el("label", {}, "Candidate source (pasted, exactly what the sandbox will run)", el("textarea", { class: "register-source", oninput: (e) => { sourceText = e.target.value; oracleResult = null; } }, sourceText))
      );
    } else if (kind === "skin") {
      formMount.appendChild(
        el("label", {}, "Token set JSON ({ light: {...}, dark: {...} }, every TOKEN_ROLES key)", el("textarea", { class: "register-source", oninput: (e) => { tokenText = e.target.value; oracleResult = null; } }, tokenText))
      );
    } else if (kind === "community") {
      const known = ctx.knownCommunities || [];
      formMount.appendChild(
        el(
          "label", {}, "Known community",
          el(
            "select", { onchange: (e) => { communityId = e.target.value; oracleResult = null; } },
            el("option", { value: "" }, "-- choose --"),
            ...known.map((c) => el("option", { value: c.id }, c.label))
          )
        )
      );
      formMount.appendChild(el("p", { class: "register-guidance" }, "This app can only re-verify a community it already has a declared fetch destination for; an undeclared community cannot be registered from here."));
    } else {
      formMount.appendChild(
        el("label", {}, "Artifact hash (asserted)", el("input", { type: "text", oninput: (e) => (artifactHash = e.target.value) }))
      );
    }
    renderOracleStatus();
  }

  function renderResult() {
    resultMount.innerHTML = "";
    if (!last) return;
    resultMount.appendChild(renderReceipt(last.receipt));
    if (!PASSED.has(last.receipt.decision)) return;
    resultMount.appendChild(renderLadder("gate-passed"));
    const exportBtn = el("button", { type: "button", class: "export-button" }, "Export bundle");
    exportBtn.addEventListener("click", () => {
      const bundle = bundleProposal(last.proposal, last.receipt, { kernel_id: community.kernelId, state_id: community.snapshotHash });
      const json = JSON.stringify(bundle, null, 2);
      downloadJSON(`registry-artifact-${bundle.contribution_id.slice(0, 12)}.json`, json);
      resultMount.appendChild(
        el(
          "div",
          { class: "export-instructions" },
          el("p", {}, `Contribution id: ${bundle.contribution_id}`),
          el("p", {}, bundle.instructions),
          contributionTarget
            ? el("p", {}, `Open a pull request against ${contributionTarget} carrying the downloaded bundle file, addressed to this registry's own admission path.`)
            : el("p", { class: "empty" }, "This registry has not declared a contribution target.")
        )
      );
      const signingMount = el("div", {});
      resultMount.appendChild(signingMount);
      renderSigningPanel(signingMount, { bundle });
    });
    resultMount.appendChild(exportBtn);
  }

  function runDraft() {
    if (!statement.trim()) { last = { proposal: null, receipt: { decision: "declined", error: "a statement is required", findings: [] } }; renderResult(); return; }
    let checkingRecords;
    if (SANDBOX_EXECUTABLE_KINDS.has(kind)) {
      if (!oracleResult) { last = { proposal: null, receipt: { decision: "declined", error: "run the conformance oracle before drafting; no fabricated citation will be attached", findings: [] } }; renderResult(); return; }
      checkingRecords = [{
        checker_id: kind === "extension" ? "api/extension.js#checkConformance" : kind === "skin" ? "api/skin-conformance.js#checkSkinConformance" : "api/community.js#fetchCommunity",
        method_class: oracleResult.methodClass, method: oracleResult.method, checked_at_state: "this-deployment@working-tree",
        outcome: oracleResult.pass ? "confirms" : "disconfirms", independence: oracleResult.independence,
      }];
    } else if (ciNote.trim()) {
      checkingRecords = [{
        checker_id: "registrant-self-attestation", method_class: "direct-measurement", method: ciNote.trim(),
        checked_at_state: "self-reported, not app-verified", outcome: "confirms", independence: "self",
      }];
    }
    last = draftRegistryArtifact(community, {
      statement, kind, artifactHash: artifactHash || undefined,
      contractIdentity: contractIdentity || undefined,
      checkingRecords,
    });
    renderResult();
  }

  const form = el(
    "form",
    { class: "register-form", onsubmit: (e) => { e.preventDefault(); runDraft(); } },
    el(
      "label", {}, "Kind",
      el("select", { onchange: (e) => { kind = e.target.value; oracleResult = null; artifactHash = ""; renderKindFields(); } }, ...KINDS.map((k) => el("option", { value: k }, k)))
    ),
    el("label", {}, "Statement", el("textarea", { required: true, oninput: (e) => (statement = e.target.value) }, statement)),
    contractRows.length
      ? el(
          "label", {}, "Depends on contract (optional)",
          el(
            "select", { onchange: (e) => (contractIdentity = e.target.value) },
            el("option", { value: "" }, "-- none --"),
            ...contractRows.map((r) => el("option", { value: r.identity }, r.statement))
          )
        )
      : null,
    formMount,
    oracleMount,
    el("button", { type: "submit" }, "Draft claim")
  );

  container.appendChild(
    el(
      "section",
      { class: "register-artifact-screen", "aria-label": "Register an artifact" },
      el("button", { type: "button", class: "back-button", onclick: onBack }, "Back"),
      el("h2", {}, "Register an artifact"),
      el("p", { class: "register-intro" }, "Names a real artifact by hash and source, attaches a real conformance run where this app can run one, and gates the resulting claim exactly like any other contribution. No status here is asserted without its citation."),
      form,
      resultMount
    )
  );
  renderKindFields();
}
