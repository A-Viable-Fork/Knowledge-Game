// Role: the kernel designer (Phase KG-10, spec Section 7 steps "type" and "set the free parameters",
//   upgraded from a CLI-only skeleton to an in-app founder experience, per "the app's founding flow is
//   that sentence made into a screen"). Picks a preset, forks or authors kinds with plain-language
//   guidance and a live grade preview over a bundled sample corpus, picks the corpus content license,
//   and ends at the governance-hash, handing off to the existing (unmodified) CLI generate/publish/
//   walkthrough by downloading the completed founding config for the founder to run by hand -- this
//   app never shells out to node itself, and nothing here writes a real kernel to disk.
// Contract: renderKernelDesignerScreen(container, ctx). ctx = { onBack }.
// Invariant: every editable field here is exactly api/parameter-surface.js's own free list
//   (kernel_id, local_kinds, sources, time_lock) plus adopted_type_hashes (fixed for composition,
//   shown not edited) and this deployment's own local card fields (corpus_content_license,
//   identity_thresholds, standing_economy), never a field invented beyond that surface. The live
//   preview calls api/kernel-designer.js's recomputeSamplePreview, the real vendored provider/client
//   path, never a hand-illustrated grade. Inactive fields (identity_thresholds, standing_economy) are
//   collected and displayed with their one-line reason and are read by nothing that evaluates them.
"use strict";
import {
  PRESETS, GRADE_GUIDANCE, SOURCE_CLASS_GUIDANCE, LICENSE_OPTIONS, LICENSE_ENFORCEMENT_NOTE,
  forkKindFromShared, hashLocalKind, recomputeSamplePreview,
  hashInterfaceSpec, hashOracleArtifact, dryRunContractOracle,
} from "../api/kernel-designer.js";
import { governanceHash } from "../api/governance-hash.js";
import { KERNEL_CONFIG_FIXED_FIELDS } from "../api/parameter-surface.js";

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

const GRADE_NAMES = Object.keys(GRADE_GUIDANCE);

function slugify(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

// the full draft kind table (adopted, fixed-ceiling rows plus local, editable rows), the single input
// every live-preview recompute and every governance-hash computation reads.
// a local kind row not yet given a name (freshly authored blank) is excluded from the live kind
// table until named: an empty kind name cannot enter makeKindTable (it throws), and a not-yet-named
// kind has no sample claim to affect anyway.
function draftKindRows(draft) {
  const adopted = (draft.adopted_type_hashes || []).map(forkKindFromShared);
  const local = (draft.local_kinds || []).filter((k) => k.kind);
  return [...adopted, ...local];
}

function pinnedTypeHashesOf(draft) {
  const out = {};
  for (const row of draftKindRows(draft)) out[row.kind] = hashLocalKind(row);
  return out;
}

function renderPresetPicker(container, { onChoose }) {
  container.innerHTML = "";
  const cards = PRESETS.map((p) =>
    el(
      "div",
      { class: "designer-preset-card" },
      el("h3", {}, p.label),
      el("p", {}, p.description),
      el("button", { type: "button", onclick: () => onChoose(p) }, `Adopt "${p.label}" and modify`)
    )
  );
  container.appendChild(
    el(
      "section",
      { class: "designer-preset-picker", "aria-label": "Choose a starting preset" },
      el("h2", {}, "Found a community"),
      el("p", {}, "Every preset below is a complete, adopt-then-modify starting point. Nothing here is final until you finish and download the founding config."),
      ...cards
    )
  );
}

function renderKindRow(draft, row, isLocal, index, onChange) {
  const guidance = GRADE_GUIDANCE[row.ceiling] || "";
  const ceilingField = isLocal
    ? el(
        "select",
        {
          onchange: (e) => {
            draft.local_kinds[index] = { ...row, ceiling: e.target.value };
            onChange();
          },
        },
        ...GRADE_NAMES.map((g) => el("option", { value: g, selected: g === row.ceiling }, g))
      )
    : el("span", { class: "designer-fixed-value" }, `${row.ceiling} (pinned by adoption; not editable here)`);
  const nameField = isLocal
    ? el("input", {
        type: "text", value: row.kind, placeholder: "local-kind-name",
        oninput: (e) => { draft.local_kinds[index] = { ...row, kind: e.target.value }; },
        onblur: (e) => { draft.local_kinds[index] = { ...row, kind: slugify(e.target.value) }; onChange(); },
      })
    : el("span", { class: "designer-fixed-value" }, row.kind);
  return el(
    "div",
    { class: `designer-kind-row ${isLocal ? "designer-tier-live" : "designer-tier-fixed"}` },
    el("div", { class: "designer-kind-row-header" },
      el("span", { class: "designer-tier-mark" }, isLocal ? "live: authored locally" : "fixed: shared-adopted, pinned by hash"),
      nameField
    ),
    el("label", {}, "Ceiling", ceilingField),
    el("p", { class: "designer-guidance" }, guidance),
    isLocal ? el("p", { class: "designer-hash" }, `type-hash: ${hashLocalKind(row).slice(0, 16)}...`) : null
  );
}

function renderSourcesPanel(draft) {
  const rows = (draft.sources || []).map((s) =>
    el(
      "div",
      { class: "designer-source-row" },
      el("strong", {}, `${s.source_id} (${s.source_class})`),
      el("p", { class: "designer-guidance" }, SOURCE_CLASS_GUIDANCE[s.source_class] || "")
    )
  );
  return el(
    "div",
    { class: "designer-sources-panel" },
    el("h3", {}, "Accepted source classes in this founding"),
    ...rows
  );
}

function renderKindDesigner(container, draft, onChange) {
  const rows = draft.local_kinds || [];
  const section = el(
    "div",
    { class: "designer-kind-designer" },
    el("h3", {}, "Kinds"),
    ...draft.adopted_type_hashes.map((name) => renderKindRow(draft, forkKindFromShared(name), false, -1, onChange)),
    ...rows.map((row, i) => renderKindRow(draft, row, true, i, onChange)),
    renderSourcesPanel(draft),
    el(
      "div",
      { class: "designer-kind-actions" },
      ...draft.adopted_type_hashes.map((name) =>
        el(
          "button",
          {
            type: "button",
            onclick: () => {
              const forked = forkKindFromShared(name);
              draft.local_kinds = [...(draft.local_kinds || []), { kind: `${forked.kind}-local`, ceiling: forked.ceiling }];
              onChange();
            },
          },
          `Fork "${name}" into a local kind`
        )
      ),
      el(
        "button",
        {
          type: "button",
          onclick: () => {
            draft.local_kinds = [...(draft.local_kinds || []), { kind: "", ceiling: "asserted" }];
            onChange();
          },
        },
        "Author a blank local kind"
      )
    )
  );
  container.appendChild(section);
}

function renderPreview(container, draft, baselineKindRows) {
  const kindRows = draftKindRows(draft);
  const draftRows = recomputeSamplePreview(kindRows);
  const baselineRows = recomputeSamplePreview(baselineKindRows);
  const baselineByIdentity = new Map(baselineRows.map((r) => [r.identity, r]));
  const items = draftRows.map((r) => {
    const before = baselineByIdentity.get(r.identity);
    const moved = before && before.earned_grade !== r.earned_grade;
    const isCrossing = !kindRows.some((k) => k.kind === r.kind);
    return el(
      "div",
      { class: `designer-preview-row ${moved ? "designer-preview-moved" : ""} ${isCrossing ? "designer-preview-crossing" : ""}` },
      el("span", { class: "designer-preview-statement" }, r.statement.slice(0, 70)),
      el("span", { class: "designer-preview-kind" }, r.kind + (isCrossing ? " (crossing arrival, unrecognized here)" : "")),
      el("span", { class: "designer-preview-grade" }, `${before ? before.earned_grade : "?"} -> ${r.earned_grade}`)
    );
  });
  container.innerHTML = "";
  container.appendChild(
    el(
      "div",
      { class: "designer-preview-panel" },
      el("h3", {}, "Live preview"),
      ...items,
      el("p", { class: "designer-preview-caption" }, "computed by the same recurrence the gate runs")
    )
  );
}

function renderLicensePicker(draft, onChange) {
  const options = LICENSE_OPTIONS.map((opt) =>
    el(
      "label",
      { class: "designer-license-option" },
      el("input", {
        type: "radio", name: "designer-license", value: opt.id, checked: draft.corpus_content_license === opt.id,
        onchange: () => { draft.corpus_content_license = opt.id; onChange(); },
      }),
      el("strong", {}, opt.label + ": "),
      el("span", {}, opt.sentence)
    )
  );
  return el(
    "div",
    { class: "designer-license-picker" },
    el("h3", {}, "Corpus content license"),
    ...options,
    el("p", { class: "designer-license-enforcement" }, LICENSE_ENFORCEMENT_NOTE)
  );
}

// reads draft.identity_thresholds and draft.standing_economy once into local bindings (the same
// destructure-first pattern api/governance-hash.js already uses) so every further access here is a
// display or collection read on a local object, never a chained property read on the field names
// themselves; this is display and storage, never a read that gates any behavior, matching the
// distinction build/check-seams.mjs's own header comment draws and check-designer.mjs verifies.
function renderInactiveFields(draft, onChange) {
  const thresholds = draft.identity_thresholds || {};
  const economy = draft.standing_economy || {};
  const actions = Object.keys(thresholds);
  const economyFields = Object.keys(economy);
  return el(
    "div",
    { class: "designer-inactive-fields designer-tier-inactive" },
    el("h3", {}, "Identity thresholds and standing economy"),
    el("p", { class: "designer-tier-mark" }, "inactive: collected and stored now, effective only once the credential and standing-economy seams activate; nothing in this deployment evaluates them yet"),
    actions.length
      ? el("div", {}, ...actions.map((action) =>
          el("label", {}, `${action} threshold`, el("input", {
            type: "text", value: thresholds[action],
            oninput: (e) => { thresholds[action] = e.target.value; },
          }))
        ))
      : el("p", {}, "(none collected by this preset)"),
    economyFields.length
      ? el("div", {}, ...economyFields.map((field) =>
          el("label", {}, field, el("input", {
            type: "text", value: economy[field],
            oninput: (e) => { economy[field] = e.target.value; },
          }))
        ))
      : el("p", {}, "(none collected by this preset)")
  );
}

// Phase KG-12 Step 1: contract-type authoring. Composes references only (interface_identity,
// required_oracle, ceiling_statement), never embedded code; the founder pastes the spec text and the
// oracle's own source, both hashed live in the browser as they type, and a sandbox-executable oracle
// (its pasted text defining extensionMain) can be dry-run right here against a small bundled fixture,
// through the identical checkConformance the extension seam's own install path runs. Draft contracts
// are never written to any store; "Export contract drafts" downloads them as JSON for the operator's
// own subsequent seeding step, the same download-and-hand-off discipline renderFinish already uses.
function renderContractDesigner(container, draft, onChange) {
  draft.contract_drafts = draft.contract_drafts || [];
  const listMount = el("div", { class: "designer-contract-list" });

  function renderOne(cd, index) {
    const dryRunMount = el("div", { class: "designer-contract-dryrun" });
    const looksExecutable = /function\s+extensionMain\s*\(/.test(cd.required_oracle_text || "");
    const shapeSelect = el(
      "select",
      { onchange: (e) => { cd.dry_run_shape = e.target.value; } },
      ...["ranker", "renderer", "workflow"].map((s) => el("option", { value: s, selected: s === (cd.dry_run_shape || "ranker") ? "" : undefined }, s))
    );
    const dryRunBtn = el("button", {
      type: "button",
      onclick: async () => {
        dryRunMount.innerHTML = "";
        dryRunMount.appendChild(el("p", {}, "Running..."));
        const result = await dryRunContractOracle(cd.required_oracle_text, cd.dry_run_shape || "ranker");
        dryRunMount.innerHTML = "";
        dryRunMount.appendChild(el("p", { class: result.pass ? "designer-dryrun-pass" : "designer-dryrun-fail" }, `Dry-run: ${result.pass ? "pass" : `refused (${result.reason})`}`));
      },
    }, "Dry-run against the bundled fixture");

    return el(
      "div",
      { class: "designer-contract-row" },
      el("label", {}, "Label", el("input", {
        type: "text", value: cd.label, placeholder: "the ranker contract",
        oninput: (e) => { cd.label = e.target.value; },
      })),
      el("label", {}, "Interface spec (hashed live as you type)", el("textarea", {
        rows: "2", value: cd.interface_spec_text,
        oninput: (e) => { cd.interface_spec_text = e.target.value; cd.interface_identity = hashInterfaceSpec(e.target.value); renderList(); },
      })),
      el("p", { class: "designer-hash" }, `interface_identity: ${(cd.interface_identity || "").slice(0, 16)}...`),
      el("label", {}, "Required oracle (paste its source; hashed live)", el("textarea", {
        rows: "2", value: cd.required_oracle_text,
        oninput: (e) => { cd.required_oracle_text = e.target.value; cd.required_oracle = hashOracleArtifact(e.target.value); renderList(); },
      })),
      el("p", { class: "designer-hash" }, `required_oracle: ${(cd.required_oracle || "").slice(0, 16)}...`),
      el("label", {}, "Ceiling statement (what passing this oracle warrants, and no more)", el("textarea", {
        rows: "2", value: cd.ceiling_statement,
        oninput: (e) => { cd.ceiling_statement = e.target.value; },
      })),
      looksExecutable
        ? el("div", { class: "designer-contract-dryrun-controls" }, el("label", {}, "Dry-run shape", shapeSelect), dryRunBtn, dryRunMount)
        : el("p", { class: "designer-guidance" }, "This oracle's text does not look like a sandbox-executable candidate (no extensionMain found); it will render as CI-only, recomputable in the repository, never app-verified."),
      el("button", { type: "button", onclick: () => { draft.contract_drafts.splice(index, 1); renderList(); } }, "Remove this contract draft")
    );
  }

  function renderList() {
    listMount.innerHTML = "";
    draft.contract_drafts.forEach((cd, i) => listMount.appendChild(renderOne(cd, i)));
  }
  renderList();

  function downloadContractDrafts() {
    const out = draft.contract_drafts.map((cd) => ({ label: cd.label, interface_identity: cd.interface_identity, required_oracle: cd.required_oracle, ceiling_statement: cd.ceiling_statement }));
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "contract-drafts.json";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  const section = el(
    "div",
    { class: "designer-contract-designer" },
    el("h3", {}, "Contract types"),
    el("p", {}, "A contract composes references only: an interface's spec hash, an oracle's own hash, and a ceiling statement. It never embeds executable code; a sandbox-executable oracle can be dry-run right here."),
    listMount,
    el("button", { type: "button", onclick: () => { draft.contract_drafts.push({ label: "", interface_spec_text: "", interface_identity: hashInterfaceSpec(""), required_oracle_text: "", required_oracle: hashOracleArtifact(""), ceiling_statement: "", dry_run_shape: "ranker" }); renderList(); } }, "Author a contract draft"),
    draft.contract_drafts.length ? el("button", { type: "button", onclick: downloadContractDrafts }, "Export contract drafts") : null
  );
  container.appendChild(section);
}

function renderFixedRegisterNote() {
  return el(
    "div",
    { class: "designer-fixed-register" },
    el("h3", {}, "Fixed for composition"),
    el("p", {}, "These fields are present in every founding config but not freely editable here; the vendored parameters-register is the reason, cited by name."),
    ...KERNEL_CONFIG_FIXED_FIELDS.map((f) => el("p", { class: "designer-fixed-value" }, `${f.name} [${f.tier}]: ${f.description}`))
  );
}

function downloadConfig(draft) {
  const config = {
    kernel_id: draft.kernel_id, frame: draft.frame, adopted_type_hashes: draft.adopted_type_hashes,
    local_kinds: draft.local_kinds, sources: draft.sources, time_lock: draft.time_lock,
    identity_thresholds: draft.identity_thresholds, standing_economy: draft.standing_economy,
    corpus_content_license: draft.corpus_content_license,
  };
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${draft.kernel_id || "founding-config"}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function renderFinish(draft) {
  const pinned = pinnedTypeHashesOf(draft);
  const hash = governanceHash(draft, pinned);
  return el(
    "div",
    { class: "designer-finish" },
    el("h3", {}, "Governance-hash"),
    el("p", {}, `${draft.frame.name} (label over the hash below, exactly as a kind name labels a type-hash)`),
    el("p", { class: "designer-hash" }, hash),
    el("p", {}, "Download the completed founding config, then hand off to the existing, unmodified CLI: node build/found-community.mjs generate <config.json>, then publish, then walkthrough. This screen writes no kernel to disk itself."),
    el("button", { type: "button", onclick: () => downloadConfig(draft) }, "Download founding-config.json")
  );
}

export function renderKernelDesignerScreen(container, ctx) {
  container.innerHTML = "";
  let preset = null;
  let draft = null;
  let baselineKindRows = null;

  function renderAll() {
    container.innerHTML = "";
    if (!preset) {
      renderPresetPicker(container, {
        onChoose: (p) => {
          preset = p;
          draft = JSON.parse(JSON.stringify(p.config));
          draft.kernel_id = slugify(p.config.frame.name);
          baselineKindRows = draftKindRows(draft);
          renderAll();
        },
      });
      return;
    }
    const backBtn = el("button", { type: "button", class: "contribute-back" }, "Back");
    backBtn.addEventListener("click", () => ctx.onBack && ctx.onBack());
    const previewMount = el("div", { class: "designer-preview-mount" });
    const leftColumn = el("div", { class: "designer-column-left" });

    function refreshLeft() {
      leftColumn.innerHTML = "";
      renderKindDesigner(leftColumn, draft, onChange);
      renderContractDesigner(leftColumn, draft, onChange);
      leftColumn.appendChild(renderLicensePicker(draft, onChange));
      leftColumn.appendChild(renderInactiveFields(draft, onChange));
      leftColumn.appendChild(renderFixedRegisterNote());
      leftColumn.appendChild(renderFinish(draft));
    }
    function onChange() {
      refreshLeft();
      renderPreview(previewMount, draft, baselineKindRows);
    }

    const section = el(
      "section",
      { class: "kernel-designer-screen", "aria-label": "Kernel designer" },
      el("h2", {}, `Founding: ${draft.frame.name}`),
      backBtn,
      el("label", {}, "Kernel id", el("input", {
        type: "text", value: draft.kernel_id,
        oninput: (e) => { draft.kernel_id = slugify(e.target.value); },
      })),
      el("div", { class: "designer-columns" },
        leftColumn,
        el("div", { class: "designer-column-right" }, previewMount)
      )
    );
    container.appendChild(section);
    refreshLeft();
    renderPreview(previewMount, draft, baselineKindRows);
  }

  renderAll();
}
