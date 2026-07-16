// Role: the account view (Phase KG-14). Accounts are the app's own side of identity: a keypair the
//   app generates locally, never a server login. This screen renders the true current state at
//   every level rather than implying anything greyed out still works: a fresh install shows no
//   account, no wall, nothing demanded; the presentation menu shows exactly which of its four levels
//   are functional today.
// Contract: renderAccountScreen(container, ctx). ctx = { account, onCreate(displayName),
//   onExport(account), onImport(jsonText), onDelete }. account is api/settings.js's getAccount()
//   result or null. onCreate/onImport are async; this screen awaits and re-renders on completion.
// Invariant: reading requires nothing this screen holds; nothing here is called by any read path.
//   Export shows a plain warning before download, never hides it in a submenu. Delete is described as
//   irrevocable because it is: onDelete removes the only copy this device holds.
"use strict";
import { PRESENTATION_LEVELS } from "../api/account.js";
import { verifyBundleSignature } from "../api/signatures.js";

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

function renderPresentationOverview() {
  return el(
    "div",
    { class: "presentation-menu" },
    el("h3", {}, "Presentation menu"),
    ...PRESENTATION_LEVELS.map((l) =>
      el(
        "p",
        { class: "presentation-overview-row" },
        el("strong", {}, l.label),
        ": ",
        l.functional ? l.description : `disabled, ${l.reason}`
      )
    )
  );
}

function renderVerifyTool() {
  const idInput = el("input", { type: "text", placeholder: "contribution_id" });
  const sigInput = el("textarea", { placeholder: "signature (hex)" });
  const keyInput = el("textarea", { placeholder: "public key JWK (paste the signature artifact's public_key_jwk)" });
  const resultEl = el("p", { class: "verify-result" }, "");
  const btn = el("button", { type: "button" }, "Verify");
  btn.addEventListener("click", async () => {
    resultEl.textContent = "verifying...";
    try {
      const publicKeyJwk = JSON.parse(keyInput.value);
      const ok = await verifyBundleSignature(idInput.value.trim(), sigInput.value.trim(), publicKeyJwk);
      resultEl.textContent = ok ? "valid: this signature matches this contribution id and public key" : "invalid: this signature does not match";
      resultEl.classList.toggle("verify-ok", ok);
      resultEl.classList.toggle("verify-fail", !ok);
    } catch (e) {
      resultEl.textContent = `refused: ${e.message}`;
    }
  });
  return el(
    "div",
    { class: "verify-tool" },
    el("h3", {}, "Verify a signature"),
    el("p", { class: "empty" }, "Anyone can verify a signature today; no gate requires one yet."),
    el("label", {}, "Contribution id", idInput),
    el("label", {}, "Signature (hex)", sigInput),
    el("label", {}, "Public key (JWK)", keyInput),
    btn,
    resultEl
  );
}

function renderBoundaryNotices() {
  return el(
    "div",
    { class: "account-boundary-notices" },
    el("p", { class: "boundary-notice" }, "Signatures are verifiable but no community yet requires them."),
    el("p", { class: "boundary-notice" }, "Anonymity here is graph-level: the GitHub-based contribution path still names the pusher at the transport layer."),
    el("p", { class: "boundary-notice" }, "Presentation levels 2 and 3 (group and community membership) await upstream: the credential seam and member-set commitments."),
    el("p", { class: "boundary-notice self-custody-notice" }, "This deployment holds your key locally by design. Other clients may offer custodial accounts and provider sync; this one does not, and the extension sandbox's constraints keep it that way.")
  );
}

export function renderAccountScreen(container, { account, onCreate, onExport, onImport, onDelete }) {
  container.innerHTML = "";

  const sections = [el("h2", {}, "Account")];

  if (!account) {
    let displayName = "";
    const createBtn = el("button", { type: "button" }, "Create an account (generate a keypair)");
    createBtn.addEventListener("click", () => onCreate(displayName));
    sections.push(
      el("p", {}, "You have no account. Reading, browsing, filtering, and contributing all work fully without one; creating an account is optional."),
      el("label", {}, "Display name (optional, self-asserted)", el("input", { type: "text", oninput: (e) => (displayName = e.target.value) })),
      createBtn,
      el("h3", {}, "Import an existing key"),
      (() => {
        const importArea = el("textarea", { placeholder: "paste an exported account JSON" });
        const importBtn = el("button", { type: "button" }, "Import");
        const importStatus = el("p", { class: "import-status" }, "");
        importBtn.addEventListener("click", async () => {
          try {
            await onImport(importArea.value);
          } catch (e) {
            importStatus.textContent = `refused: ${e.message}`;
          }
        });
        return el("div", {}, importArea, importBtn, importStatus);
      })()
    );
  } else {
    const exportBtn = el("button", { type: "button" }, "Export private key (download)");
    exportBtn.addEventListener("click", () => onExport(account));
    const deleteBtn = el("button", { type: "button", class: "vault-delete" }, "Delete account (irrevocable)");
    deleteBtn.addEventListener("click", () => {
      if (confirm("This deletes the only copy of your private key this device holds. This cannot be undone. Continue?")) onDelete();
    });
    sections.push(
      el("p", {}, `Account id: ${account.accountId}`),
      account.displayName ? el("p", {}, `Display name: ${account.displayName}`) : el("p", { class: "empty" }, "No display name set."),
      el(
        "p",
        { class: "export-warning" },
        "Exporting downloads your private key in plain JSON. Anyone who obtains this file can sign as you. Keep it somewhere only you control."
      ),
      exportBtn,
      el("p", { class: "delete-warning" }, "Deleting removes the only copy of this key this device holds. There is no recovery, no trash, no soft delete."),
      deleteBtn
    );
  }

  sections.push(renderPresentationOverview(), renderVerifyTool(), renderBoundaryNotices());

  container.appendChild(el("section", { class: "account-screen", "aria-label": "Account" }, ...sections));
}
