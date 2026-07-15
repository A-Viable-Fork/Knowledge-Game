// Role: the app shell. Parses the URL hash for the active community, view (feed or vault), and an
//   optional deep-linked claim; fetches the community through the data layer; orders the feed under
//   the reader's objective (or the null order at the zero vector); renders the objective panel, the
//   epistemic-cost report, the card list, and the vault screen; records opt-in dwell and expand
//   observations when enabled.
// Contract: none exported; this is the entry module app/index.html loads. Imports only api/ and its
//   own periphery/ files, never vendor/, kernel/, or vault/ directly (governing-trellis G0-1 / A-1).
// Invariant: this module computes no grade, no ranking rule, and touches no storage directly; every
//   grade comes from api/community.js's provider, every order from api/ranking.js (or api/feed.js's
//   null order at the zero vector), every persisted read or write from api/settings.js.
"use strict";
import { fetchCommunity } from "../api/community.js";
import { whyThisCard } from "../api/feed.js";
import { orderByObjective, explainPosition, COMPONENTS } from "../api/ranking.js";
import { epistemicCost, epistemicCostSummary } from "../api/epistemic-cost.js";
import { kindsPresent, applyFilter } from "../api/filter.js";
import * as settings from "../api/settings.js";
import { renderCard } from "./card.js";
import { renderObjectivePanel } from "./objective-panel.js";
import { renderFilterBar } from "./filter-bar.js";
import { renderVaultScreen, downloadJSON } from "./vault-screen.js";
import { renderContributeScreen } from "./contribute-screen.js";

// The community registry. The founded EpiStack Competition Community (Phase B/C, its community card
// at communities/epistack-competition/community-card.json) is the default; the two development
// fixtures are demoted to secondary. Real directory discovery (importing an arbitrary community card)
// remains unbuilt; this is still a hardcoded list, now naming a real published community rather than
// only fixtures.
const COMMUNITIES = [
  { id: "epistack-competition", label: "EpiStack Competition Community", path: "../communities/epistack-competition/snapshot/epistack-competition.snapshot.json", contributionTarget: "https://github.com/A-Viable-Fork/Knowledge-Game/tree/main/communities/epistack-competition" },
  { id: "knowledge-game", label: "Knowledge Game (this app's own governance kernel)", path: "fixtures/knowledge-game.snapshot.json" },
  { id: "math", label: "EpiStack Math Kernel (upstream content, for contrast)", path: "fixtures/math.snapshot.json" },
];

function parseHash() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  return {
    community: params.get("community"), claim: params.get("claim"), view: params.get("view") || "feed",
    action: params.get("action"), target: params.get("target"),
  };
}
function setHash(next) {
  const current = parseHash();
  const merged = { ...current, ...next };
  const params = new URLSearchParams();
  if (merged.community) params.set("community", merged.community);
  if (merged.claim) params.set("claim", merged.claim);
  if (merged.view && merged.view !== "feed") params.set("view", merged.view);
  if (merged.view === "contribute" && merged.action) params.set("action", merged.action);
  if (merged.view === "contribute" && merged.target) params.set("target", merged.target);
  location.hash = params.toString();
}

function renderSwitcher(activeId) {
  const nav = document.getElementById("community-switcher");
  nav.innerHTML = "";
  for (const c of COMMUNITIES) {
    const btn = document.createElement("button");
    btn.textContent = c.label;
    btn.setAttribute("aria-current", String(c.id === activeId));
    btn.addEventListener("click", () => setHash({ community: c.id, claim: null, view: "feed" }));
    nav.appendChild(btn);
  }
  const vaultBtn = document.createElement("button");
  vaultBtn.textContent = "Vault";
  vaultBtn.className = "vault-nav-button";
  vaultBtn.addEventListener("click", () => setHash({ view: "vault" }));
  nav.appendChild(vaultBtn);
}

function linksMaps(raw) {
  const byTarget = new Map();
  const byFrom = new Map();
  for (const l of (raw.state && raw.state.links) || []) {
    if (!byTarget.has(l.to_identity)) byTarget.set(l.to_identity, []);
    byTarget.get(l.to_identity).push(l);
    if (!byFrom.has(l.from_identity)) byFrom.set(l.from_identity, []);
    byFrom.get(l.from_identity).push(l);
  }
  return { byTarget, byFrom };
}
function sourcesMap(raw) {
  return new Map((raw.sources || []).map((s) => [s.source_id, s]));
}

// the visible sync state: which community, its snapshot hash prefix, when this load happened, and a
// verified badge, since every load that reaches this point already passed api/community.js's hash
// check (a failed one refuses to load and never reaches here at all).
function renderSyncState(community) {
  const el = document.getElementById("sync-state");
  if (!el) return;
  el.innerHTML = "";
  const loadedAt = new Date().toLocaleTimeString();
  const span = (text, cls) => {
    const s = document.createElement("span");
    if (cls) s.className = cls;
    s.textContent = text;
    return s;
  };
  el.appendChild(span(`community: ${community.kernelId}`));
  el.appendChild(span(`snapshot: ${community.snapshotHash.slice(0, 12)}...`));
  el.appendChild(span(`loaded: ${loadedAt}`));
  el.appendChild(span("verified", "verified-badge"));
}

// service worker registration and the install affordance. Neither blocks first render; a failure to
// register is silent to the reader (offline support degrades, the app still works online).
let deferredInstallPrompt = null;
function setupShell() {
  if ("serviceWorker" in navigator) {
    // relative to the document (app/index.html), not origin-absolute: this deployment is served
    // from a subpath (GitHub project pages), where a leading "/" would resolve to the wrong root.
    navigator.serviceWorker.register("../sw.js", { scope: "../" }).catch(() => {});
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    renderInstallButton();
  });
}
function renderInstallButton() {
  const el = document.getElementById("sync-state");
  if (!el || !deferredInstallPrompt || document.querySelector(".install-button")) return;
  const btn = document.createElement("button");
  btn.className = "install-button";
  btn.textContent = "Install";
  btn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    btn.remove();
  });
  el.appendChild(btn);
}

// dwell tracking: an IntersectionObserver records enter/exit and commits one typed record per card
// on exit (or never, if observation is off; recordObservation itself refuses to write while off).
function observeDwell(feedEl) {
  const enteredAt = new Map();
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const identity = entry.target.dataset.identity;
        const kind = entry.target.dataset.kind;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (!enteredAt.has(identity)) enteredAt.set(identity, performance.now());
        } else if (enteredAt.has(identity)) {
          const durationMs = Math.round(performance.now() - enteredAt.get(identity));
          enteredAt.delete(identity);
          if (durationMs > 300) settings.recordObservation({ type: "dwell", identity, kind, at: Date.now(), durationMs });
        }
      }
    },
    { threshold: [0, 0.5, 1] }
  );
  for (const card of feedEl.querySelectorAll(".card")) io.observe(card);
  return io;
}

async function loadCommunity(id, deepLinkClaim) {
  const feedEl = document.getElementById("feed");
  const panelEl = document.getElementById("objective-panel-mount");
  const filterBarEl = document.getElementById("filter-bar-mount");
  feedEl.setAttribute("aria-busy", "true");
  feedEl.innerHTML = "";
  const status = document.createElement("p");
  status.className = "feed-status";
  status.textContent = "Loading the feed...";
  feedEl.appendChild(status);

  const meta = COMMUNITIES.find((c) => c.id === id) || COMMUNITIES[0];
  let community;
  try {
    community = await fetchCommunity(meta.path);
  } catch (e) {
    status.textContent = `Refused to load ${meta.path}: ${e.message}`;
    feedEl.setAttribute("aria-busy", "false");
    return;
  }
  renderSyncState(community);

  const rows = community.api.read({});
  const reconciliations = community.api.reconciliations({});
  const { byTarget, byFrom } = linksMaps(community.raw);
  const sourcesById = sourcesMap(community.raw);
  const gapsByIdentity = new Map(community.api.gaps({}).map((g) => [g.identity, g]));
  const rowsByIdentity = new Map(rows.map((r) => [r.identity, r]));

  let weights = settings.getObjective();
  const observationOn = settings.observationEnabled();
  let excludedKinds = settings.getFilter(meta.id);

  function updateFilterBar() {
    const present = kindsPresent(rows, community.raw.kinds);
    const { hidden } = applyFilter(rows, excludedKinds, community.raw.kinds);
    renderFilterBar(filterBarEl, {
      present, excluded: excludedKinds, hidden,
      onChange: (next) => {
        excludedKinds = next;
        settings.setFilter(meta.id, next);
        renderFeed();
        updateFilterBar();
      },
    });
  }

  function renderFeed() {
    const extra = { reconciliations, observation: { enabled: observationOn, log: settings.observationLog() } };
    const { visible } = applyFilter(rows, excludedKinds, community.raw.kinds);
    const ordered = orderByObjective(visible, weights, community.raw.state, extra);
    feedEl.innerHTML = "";
    ordered.forEach((row, i) => {
      row.whyThisCard = explainPosition(row, i);
      const card = renderCard(row, {
        kernelId: community.kernelId,
        sourcesById,
        linksByTarget: byTarget,
        linksByFrom: byFrom,
        gapsByIdentity,
        rowsByIdentity,
        excludedKinds,
        isDeepLinkTarget: (identity) => identity === deepLinkClaim,
        onContribute: (action, targetRow) => setHash({ view: "contribute", action, target: targetRow.identity, community: meta.id }),
      });
      card.dataset.identity = row.identity;
      card.dataset.kind = row.kind;
      card.querySelector("details").addEventListener("toggle", (e) => {
        if (e.target.open) settings.recordObservation({ type: "expand", identity: row.identity, kind: row.kind, at: Date.now() });
      });
      feedEl.appendChild(card);
    });
    feedEl.setAttribute("aria-busy", "false");
    observeDwell(feedEl);

    if (deepLinkClaim) {
      const target = document.getElementById(`claim-${deepLinkClaim}`);
      if (target) {
        target.querySelector("details").open = true;
        target.scrollIntoView({ block: "start" });
        target.focus();
      }
    }
  }
  renderFeed();
  updateFilterBar();

  let currentCostSummary = null;
  function updatePanel() {
    renderObjectivePanel(panelEl, {
      components: COMPONENTS,
      weights,
      observationOn,
      costSummary: currentCostSummary,
      onWeightsChange: (next) => {
        weights = next;
        settings.setObjective(next);
        renderFeed();
        updatePanel();
      },
    });
  }
  updatePanel();

  // the epistemic-cost report: the active feed's top 20, viewed under the OTHER community's
  // parameters. Computed after first render so the feed itself never waits on it.
  const other = COMMUNITIES.find((c) => c.id !== meta.id);
  if (other) {
    try {
      const otherCommunity = await fetchCommunity(other.path);
      const top20 = rows.slice(0, 20);
      const report = epistemicCost(top20, community.raw, otherCommunity.raw);
      currentCostSummary = epistemicCostSummary(other.label, report, top20.length);
    } catch (e) {
      currentCostSummary = `Epistemic-cost report unavailable: ${e.message}`;
    }
    updatePanel();
  }

  renderSwitcher(meta.id);
}

async function loadContributeScreen(id, action, targetIdentity) {
  const feedEl = document.getElementById("feed");
  const panelEl = document.getElementById("objective-panel-mount");
  const filterBarEl = document.getElementById("filter-bar-mount");
  const syncEl = document.getElementById("sync-state");
  if (syncEl) syncEl.innerHTML = "";
  panelEl.innerHTML = "";
  filterBarEl.innerHTML = "";
  feedEl.innerHTML = "";
  feedEl.setAttribute("aria-busy", "true");

  const meta = COMMUNITIES.find((c) => c.id === id) || COMMUNITIES[0];
  let community;
  try {
    community = await fetchCommunity(meta.path);
  } catch (e) {
    feedEl.textContent = `Refused to load ${meta.path}: ${e.message}`;
    feedEl.setAttribute("aria-busy", "false");
    return;
  }
  const targetRow = targetIdentity ? community.api.read({ identity: targetIdentity })[0] : null;
  feedEl.setAttribute("aria-busy", "false");
  renderContributeScreen(feedEl, {
    community, action, targetRow, contributionTarget: meta.contributionTarget,
    onBack: () => setHash({ view: "feed", action: null, target: null }),
  });
  renderSwitcher(null);
}

function loadVaultScreen() {
  const feedEl = document.getElementById("feed");
  const panelEl = document.getElementById("objective-panel-mount");
  const filterBarEl = document.getElementById("filter-bar-mount");
  const syncEl = document.getElementById("sync-state");
  if (syncEl) syncEl.innerHTML = "";
  panelEl.innerHTML = "";
  filterBarEl.innerHTML = "";
  feedEl.innerHTML = "";
  feedEl.setAttribute("aria-busy", "false");
  renderVaultScreen(feedEl, {
    observationOn: settings.observationEnabled(),
    log: settings.observationLog(),
    onToggle: (enabled) => {
      settings.setObservationEnabled(enabled);
      loadVaultScreen();
    },
    onExport: () => downloadJSON("knowledge-game-vault-export.json", settings.exportVault()),
    onDeleteAll: () => {
      settings.deleteVault();
      loadVaultScreen();
    },
  });
  renderSwitcher(null);
}

function boot() {
  const { community, claim, view, action, target } = parseHash();
  if (view === "vault") {
    loadVaultScreen();
  } else if (view === "contribute") {
    loadContributeScreen(community || COMMUNITIES[0].id, action, target);
  } else {
    loadCommunity(community || COMMUNITIES[0].id, claim);
  }
}

window.addEventListener("hashchange", boot);
setupShell();
boot();
