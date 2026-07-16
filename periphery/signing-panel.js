// Role: the shared signing panel (Phase KG-14 Steps 2-3), reused identically by every screen that
//   builds a gate-passed bundle (a plain proposal, a contest, a fork, a register-an-artifact draft)
//   so none of them re-implements the presentation menu or the signing call. Offers an optional
//   detached signature over the bundle's own content-derived contribution_id, at the reader's chosen
//   presentation level, travelling as a sibling artifact alongside the plain export, never mutating
//   it. The objective-chip discipline applied to identity: the active presentation is always visible
//   here, a pure label of the current selection.
// Contract: renderSigningPanel(container, { bundle }) -> void. bundle is whatever
//   api/contribute.js's bundleProposal (or an equivalent) returned; only bundle.contribution_id is
//   read. Reads the account through api/settings.js itself.
// Invariant: signing is optional and additive; a level-2/3 selection renders disabled (both in its
//   radio input and, defensively, in the sign handler itself, which refuses again even if somehow
//   invoked) and never reaches crypto.subtle.sign. Only "this-key" (requires an existing account)
//   and "floor" (generates and discards a one-time keypair, needing no account) ever produce a
//   signature. An unsigned bundle is untouched by this panel's presence.
"use strict";
import * as settings from "../api/settings.js";
import { PRESENTATION_LEVELS, presentationChipLabel, generateEphemeralKeypair, canSignWithLevel } from "../api/account.js";
import { signBundleId } from "../api/signatures.js";
import { downloadJSON } from "./vault-screen.js";

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

export function renderSigningPanel(container, { bundle }) {
  const account = settings.getAccount();
  let level = account ? "this-key" : "floor";

  const chipEl = el("p", { class: "indicator-chip presentation-chip" }, presentationChipLabel(level));
  const statusEl = el("p", { class: "signing-status" }, "");

  const optionsEl = el(
    "div",
    { class: "presentation-menu" },
    ...PRESENTATION_LEVELS.map((l) => {
      const disabled = !canSignWithLevel(l.id, !!account);
      return el(
        "label",
        { class: "presentation-option" },
        el("input", {
          type: "radio", name: "presentation-level-" + bundle.contribution_id.slice(0, 8), value: l.id,
          checked: l.id === level ? "" : undefined, disabled,
          onchange: () => { level = l.id; chipEl.textContent = presentationChipLabel(level); },
        }),
        ` ${l.label}`,
        !l.functional ? el("span", { class: "presentation-reason" }, `, disabled: ${l.reason}`) : null,
        l.id === "this-key" && !account ? el("span", { class: "presentation-reason" }, ", disabled: no account yet") : null
      );
    })
  );

  const signBtn = el("button", { type: "button", class: "sign-button" }, "Sign and download signature");
  signBtn.addEventListener("click", async () => {
    if (!canSignWithLevel(level, !!account)) {
      statusEl.textContent = "refused: this presentation level is not functional yet";
      return;
    }
    statusEl.textContent = "signing...";
    try {
      let signature, publicKeyJwk, accountId;
      if (level === "this-key") {
        if (!account) { statusEl.textContent = "refused: no account to sign with"; return; }
        signature = await signBundleId(bundle.contribution_id, account.privateKeyJwk);
        publicKeyJwk = account.publicKeyJwk;
        accountId = account.accountId;
      } else {
        const ephemeral = await generateEphemeralKeypair();
        signature = await signBundleId(bundle.contribution_id, ephemeral.privateKeyJwk);
        publicKeyJwk = ephemeral.publicKeyJwk;
        // the ephemeral private key is never assigned anywhere else and goes out of scope here;
        // this function is the only place it ever existed.
      }
      const artifact = { contribution_id: bundle.contribution_id, presentation: level, public_key_jwk: publicKeyJwk, signature };
      if (accountId) artifact.account_id = accountId;
      downloadJSON(`signature-${bundle.contribution_id.slice(0, 12)}.json`, JSON.stringify(artifact, null, 2));
      statusEl.textContent = "signed and downloaded as a sibling file; include it alongside the bundle in your pull request";
    } catch (e) {
      statusEl.textContent = `refused: ${e.message}`;
    }
  });

  container.appendChild(
    el(
      "div",
      { class: "signing-panel" },
      el("p", { class: "signing-note" }, "Signing is optional. An unsigned export is fully valid; no gate requires a signature yet."),
      chipEl,
      optionsEl,
      signBtn,
      statusEl
    )
  );
}
