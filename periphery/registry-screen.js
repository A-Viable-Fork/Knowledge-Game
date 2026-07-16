// Role: the registry's browse and install surface (Phase KG-12 Step 3). A founded registry community
//   (communities/the-registry) reads exactly like any other community through the normal gate and
//   grade machinery; this screen adds the one thing a plain feed card cannot show, since the vendored
//   provider's own project() never forwards extensions (api/registry.js's registryRows already joined
//   them in): each artifact-card's kind, artifact hash, contract linkage, and conformance citation,
//   with a live re-run where the oracle is sandbox-executable in this app, and an install action
//   scoped to what that kind actually means (pin a community, apply a skin, or an honest link-out for
//   kinds this app does not install at all).
// Contract: renderRegistryScreen(container, { rows, contractsById, reRunFor(row) -> null | {label,
//   run: () => Promise<{ok, detail}>}, installFor(row) -> null | {label, run: () => void|Promise},
//   noteFor(row) -> string | null }). rows are api/registry.js's enriched rows (kind, statement,
//   declared_grade, earned_grade, extensions, checkingRecords). reRunFor/installFor/noteFor are
//   host-supplied per-row capability probes; this module renders exactly what they return and calls
//   nothing on its own initiative.
// Invariant: "conformance is recomputable or it is not evidence": a conformance line never renders
//   without its citation (checkingRecords[0]) alongside it; a CI-only oracle renders "recomputable in
//   the repository", never an app-verified claim. No ceiling word ("safe", "good", "trusted") appears
//   here about any artifact. The registry's own client-kind entry (this app itself) renders exactly
//   like every other client entry, no distinguishing style.
"use strict";

const KIND_ORDER = ["contract-bundle", "extension", "skin", "component", "client", "community"];
const KIND_LABEL = {
  "contract-bundle": "Contracts", extension: "Extensions", skin: "Skins",
  component: "Components", client: "Clients", community: "Communities",
};

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

function shortHash(h) {
  return h ? `${String(h).slice(0, 16)}...` : "(none)";
}

function renderCitation(row) {
  const cr = (row.checkingRecords || [])[0];
  if (!cr) return el("p", { class: "registry-no-citation" }, "no conformance citation on this claim");
  return el(
    "p",
    { class: "registry-citation" },
    `${cr.outcome}: `,
    el("span", { class: "registry-citation-method" }, cr.method),
    ` (checker: ${cr.checker_id}, ${cr.independence})`
  );
}

function renderArtifactCard(row, contractsById, reRunFor, installFor, noteFor) {
  const ext = row.extensions || {};
  const parts = [
    el("h4", {}, row.statement),
    el("p", { class: "registry-meta" }, `grade: ${row.earned_grade} (declared ${row.declared_grade})`),
  ];
  if (ext.artifact_hash) parts.push(el("p", { class: "registry-meta" }, `artifact hash: ${shortHash(ext.artifact_hash)}`));
  if (ext.contract_hash) {
    const contract = contractsById.get(ext.contract_hash);
    parts.push(
      el(
        "p",
        { class: "registry-meta" },
        `contract: ${contract ? contract.statement : shortHash(ext.contract_hash)}`
      )
    );
    if (contract && contract.extensions && contract.extensions.ceiling_statement) {
      parts.push(el("p", { class: "registry-ceiling" }, contract.extensions.ceiling_statement));
    }
  }
  if (ext.interface_identity) parts.push(el("p", { class: "registry-meta" }, `interface identity: ${shortHash(ext.interface_identity)}`));
  if (ext.required_oracle) parts.push(el("p", { class: "registry-meta" }, `required oracle: ${shortHash(ext.required_oracle)}`));
  if (ext.ceiling_statement) parts.push(el("p", { class: "registry-ceiling" }, ext.ceiling_statement));
  parts.push(renderCitation(row));

  const rerun = reRunFor(row);
  if (rerun) {
    const resultEl = el("p", { class: "registry-rerun-result" }, "");
    const btn = el("button", { type: "button", class: "registry-rerun-button", onclick: async () => {
      resultEl.textContent = "running...";
      const result = await rerun.run();
      resultEl.textContent = `${result.ok ? "reproduced" : "did not reproduce"}: ${result.detail}`;
      resultEl.classList.toggle("registry-rerun-ok", result.ok);
      resultEl.classList.toggle("registry-rerun-fail", !result.ok);
    } }, rerun.label);
    parts.push(btn, resultEl);
  } else if (row.kind === "client" || row.kind === "component" || (row.kind === "extension" && ext.artifact_hash === undefined)) {
    parts.push(el("p", { class: "registry-ci-only" }, "recomputable in the repository (CI-only); not re-run in this app"));
  }

  const install = installFor(row);
  if (install) {
    parts.push(el("button", { type: "button", class: "registry-install-button", onclick: () => install.run() }, install.label));
  }
  const note = noteFor(row);
  if (note) parts.push(el("p", { class: "registry-note" }, note));

  return el("li", { class: "registry-card", "data-kind": row.kind }, ...parts);
}

export function renderRegistryScreen(container, { rows, contractsById, reRunFor, installFor, noteFor, onRegister }) {
  container.innerHTML = "";
  const byKind = new Map();
  for (const row of rows) {
    if (!byKind.has(row.kind)) byKind.set(row.kind, []);
    byKind.get(row.kind).push(row);
  }
  const sections = KIND_ORDER.filter((k) => byKind.has(k)).map((kind) =>
    el(
      "section",
      { class: "registry-kind-section" },
      el("h3", {}, KIND_LABEL[kind] || kind),
      el("ul", { class: "registry-card-list" }, ...byKind.get(kind).map((row) => renderArtifactCard(row, contractsById, reRunFor, installFor, noteFor)))
    )
  );
  container.appendChild(
    el(
      "section",
      { class: "registry-screen", "aria-label": "The Registry" },
      el("p", { class: "registry-intro" }, "Artifacts of the ecosystem itself, typed by contracts and graded by conformance. No artifact here is described as safe, good, or trusted; each carries only its citation."),
      onRegister ? el("button", { type: "button", class: "registry-register-button", onclick: onRegister }, "Register an artifact") : null,
      ...sections
    )
  );
}
