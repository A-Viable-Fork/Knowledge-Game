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
import { checkConformance, runRanker, runRenderer, contentHash } from "../api/extension.js";
import { computeAlerts, refreshWatches } from "../api/alerts.js";
import * as settings from "../api/settings.js";
import { pinCommunity, unpinCommunity, isPinned, pinAge, listPins } from "../api/pins.js";
import { listOutbox, removeFromOutbox, pushOutbox, sweepAdmitted } from "../api/outbox.js";
import { virtualRowsFor, computeLensImpact } from "../api/virtual.js";
import { shouldSync } from "../api/sync.js";
import { renderCard } from "./card.js";
import { renderObjectivePanel } from "./objective-panel.js";
import { renderFilterBar } from "./filter-bar.js";
import { renderAlertsPanel } from "./alerts-panel.js";
import { renderVaultScreen, downloadJSON } from "./vault-screen.js";
import { renderOutboxScreen } from "./outbox-screen.js";
import { renderContributeScreen } from "./contribute-screen.js";
import { renderExtensionScreen, renderDashboardScreen } from "./extension-screen.js";
import { renderOnboardingScreen } from "./onboarding-screen.js";
import { LEARN_EFFICIENTLY_SOURCE } from "./demo-extensions.js";

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

// pin age, labeled per the staleness discipline: never a bare number without units and context.
function pinAgeLabel(ms) {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  return days < 1 ? "pinned less than a day ago" : `pinned ${days} day${days === 1 ? "" : "s"} ago`;
}

function renderSwitcher(activeId) {
  const nav = document.getElementById("community-switcher");
  nav.innerHTML = "";
  for (const c of COMMUNITIES) {
    const wrap = document.createElement("span");
    wrap.className = "switcher-entry";
    const btn = document.createElement("button");
    btn.textContent = c.label;
    btn.setAttribute("aria-current", String(c.id === activeId));
    btn.addEventListener("click", () => setHash({ community: c.id, claim: null, view: "feed" }));
    wrap.appendChild(btn);

    const pinned = isPinned(c.id);
    const pinBtn = document.createElement("button");
    pinBtn.className = "pin-button";
    pinBtn.setAttribute("aria-pressed", String(pinned));
    pinBtn.textContent = pinned ? `Unpin (${pinAgeLabel(pinAge(c.id))})` : "Pin for offline";
    pinBtn.addEventListener("click", async () => {
      if (pinned) await unpinCommunity(c.id, c.path);
      else await pinCommunity(c);
      renderSwitcher(activeId);
    });
    wrap.appendChild(pinBtn);
    nav.appendChild(wrap);
  }
  const vaultBtn = document.createElement("button");
  vaultBtn.textContent = "Vault";
  vaultBtn.className = "vault-nav-button";
  vaultBtn.addEventListener("click", () => setHash({ view: "vault" }));
  nav.appendChild(vaultBtn);

  const outboxBtn = document.createElement("button");
  const outboxCount = listOutbox().length;
  outboxBtn.textContent = outboxCount ? `Outbox (${outboxCount})` : "Outbox";
  outboxBtn.className = "outbox-nav-button";
  outboxBtn.addEventListener("click", () => setHash({ view: "outbox" }));
  nav.appendChild(outboxBtn);

  const extensionsBtn = document.createElement("button");
  extensionsBtn.textContent = "Extensions";
  extensionsBtn.className = "extensions-nav-button";
  extensionsBtn.addEventListener("click", () => setHash({ view: "extensions" }));
  nav.appendChild(extensionsBtn);

  const dashboardBtn = document.createElement("button");
  dashboardBtn.textContent = "Dashboard";
  dashboardBtn.className = "dashboard-nav-button";
  dashboardBtn.addEventListener("click", () => setHash({ view: "dashboard" }));
  nav.appendChild(dashboardBtn);
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

// the visible sync state: which community, its snapshot hash prefix, when this load happened, a
// verified badge (every load that reaches this point already passed api/community.js's hash check; a
// failed one refuses to load and never reaches here at all), and (Phase KG-6b) the last-synced time
// per community, labeled plainly, never a bare timestamp with no reference for how current it is.
function renderSyncState(community, communityId) {
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
  const lastSynced = settings.getLastSynced(communityId);
  el.appendChild(span(lastSynced ? `last synced: ${new Date(lastSynced).toLocaleString()}` : "last synced: never", "last-synced"));
}

// the virtual lens (Phase KG-6b): off by default, a toggle rendered once per community load. On, it
// shows the counterfactual standing impact of admitting every one of this community's own queued and
// submitted outbox entries, computed on a copy (api/virtual.js's computeLensImpact) and never touching
// the real community object; the impact map is handed to renderFeed as ctx.lensImpact, consumed only
// by periphery/card.js's virtual-card rendering.
function renderLensToggle(lensOn, onToggle) {
  const mount = document.getElementById("virtual-lens-mount");
  if (!mount) return;
  mount.innerHTML = "";
  const label = document.createElement("label");
  label.className = "lens-toggle-label";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = "lens-toggle";
  if (lensOn) input.checked = true;
  input.addEventListener("change", (e) => onToggle(e.target.checked));
  label.appendChild(input);
  label.appendChild(document.createTextNode(" Virtual lens: show counterfactual standing impact of my queued and submitted contributions"));
  mount.appendChild(label);
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
  const alertsPanelEl = document.getElementById("alerts-panel-mount");
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
  renderSyncState(community, meta.id);

  const rows = community.api.read({});
  const reconciliations = community.api.reconciliations({});
  const { byTarget, byFrom } = linksMaps(community.raw);
  const sourcesById = sourcesMap(community.raw);
  const gapsByIdentity = new Map(community.api.gaps({}).map((g) => [g.identity, g]));
  const rowsByIdentity = new Map(rows.map((r) => [r.identity, r]));

  // the outbox and the virtual layer (Phase KG-6b): sweep any of this community's own submitted
  // entries whose proposed identity now reads as a real row (admitted for real, so it leaves the
  // outbox), then auto-sync (re-gate and push every queued entry) only when the sync policy actually
  // authorizes a "load"-triggered sync; sync-now (the outbox screen's own button) always runs
  // regardless of policy, per api/sync.js's own shouldSync contract.
  sweepAdmitted(meta.id, rows);
  const isWifi = typeof navigator !== "undefined" && navigator.connection ? navigator.connection.type === "wifi" : undefined;
  if (shouldSync(settings.getSyncPolicy(), "load", isWifi)) {
    await pushOutbox(meta.path, meta.id);
    settings.setLastSynced(meta.id, Date.now());
    renderSyncState(community, meta.id);
  }
  let lensOn = false;
  let lensImpact = null;
  function outboxEntriesHere() {
    return listOutbox().filter((e) => e.communityId === meta.id);
  }
  function recomputeLens() {
    lensImpact = lensOn ? computeLensImpact(community, outboxEntriesHere()) : null;
  }
  function discardVirtual(virtualRow) {
    removeFromOutbox(virtualRow.contributionId);
    renderFeed();
    renderSwitcher(meta.id);
  }
  renderLensToggle(lensOn, (checked) => {
    lensOn = checked;
    recomputeLens();
    renderFeed();
  });

  // standing-motion alerts: diff this load against the last-seen grade of every watched claim, then
  // refresh the stored snapshot so the NEXT load diffs against this one, not a stale reading.
  const priorWatches = settings.getWatches(meta.id);
  const alerts = computeAlerts(priorWatches, rows);
  renderAlertsPanel(alertsPanelEl, { alerts });
  settings.setWatches(meta.id, refreshWatches(priorWatches, rows));
  let watchedIdentities = new Set(priorWatches.map((w) => w.identity));
  function toggleWatch(row) {
    if (watchedIdentities.has(row.identity)) {
      watchedIdentities.delete(row.identity);
    } else {
      watchedIdentities.add(row.identity);
    }
    const nextWatches = [...watchedIdentities].map((identity) => {
      const r = rowsByIdentity.get(identity);
      return { identity, kind: r.kind, grade: r.earned_grade };
    });
    settings.setWatches(meta.id, nextWatches);
    renderFeed();
  }

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

  async function renderFeed() {
    const extra = { reconciliations, observation: { enabled: observationOn, log: settings.observationLog() } };
    const { visible } = applyFilter(rows, excludedKinds, community.raw.kinds);
    const activeRankerHash = settings.getActiveRanker();
    const activeRankerEntry = activeRankerHash ? (settings.getExtensions() || []).find((e) => e.hash === activeRankerHash && e.shape === "ranker") : null;
    let ordered;
    let usedExtension = false;
    if (activeRankerEntry) {
      try {
        ordered = await runRanker(activeRankerEntry.source, visible, weights, community.raw.state.links || []);
        usedExtension = true;
      } catch (e) {
        ordered = orderByObjective(visible, weights, community.raw.state, extra);
      }
    } else {
      ordered = orderByObjective(visible, weights, community.raw.state, extra);
    }
    feedEl.innerHTML = "";
    ordered.forEach((row, i) => {
      row.whyThisCard = usedExtension ? `active ranker extension: ${activeRankerEntry.label}, position ${i}` : explainPosition(row, i);
      const card = renderCard(row, {
        kernelId: community.kernelId,
        sourcesById,
        linksByTarget: byTarget,
        linksByFrom: byFrom,
        gapsByIdentity,
        rowsByIdentity,
        excludedKinds,
        isWatched: (identity) => watchedIdentities.has(identity),
        isDeepLinkTarget: (identity) => identity === deepLinkClaim,
        onContribute: (action, targetRow) => setHash({ view: "contribute", action, target: targetRow.identity, community: meta.id }),
        onToggleWatch: (targetRow) => toggleWatch(targetRow),
      });
      card.dataset.identity = row.identity;
      card.dataset.kind = row.kind;
      const details = card.querySelector("details");
      if (details) {
        details.addEventListener("toggle", (e) => {
          if (e.target.open) settings.recordObservation({ type: "expand", identity: row.identity, kind: row.kind, at: Date.now() });
        });
      }
      feedEl.appendChild(card);
    });

    // the virtual layer: this device's own queued/submitted/demoted contributions for this
    // community, rendered ghosted after the actual feed, never mixed into the ranking order the real
    // grounding produced.
    for (const virtualRow of virtualRowsFor(outboxEntriesHere())) {
      const card = renderCard(virtualRow, { lensImpact, onDiscardVirtual: discardVirtual });
      feedEl.appendChild(card);
    }
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
    const activeRankerHash = settings.getActiveRanker();
    const activeRankerEntry = activeRankerHash ? (settings.getExtensions() || []).find((e) => e.hash === activeRankerHash && e.shape === "ranker") : null;
    renderObjectivePanel(panelEl, {
      components: COMPONENTS,
      weights,
      observationOn,
      costSummary: currentCostSummary,
      activeExtensionRanker: activeRankerEntry ? activeRankerEntry.label : null,
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
  const alertsPanelEl = document.getElementById("alerts-panel-mount");
  const syncEl = document.getElementById("sync-state");
  if (syncEl) syncEl.innerHTML = "";
  panelEl.innerHTML = "";
  filterBarEl.innerHTML = "";
  alertsPanelEl.innerHTML = "";
  const lensMountEl = document.getElementById("virtual-lens-mount");
  if (lensMountEl) lensMountEl.innerHTML = "";
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
    community, action, targetRow, contributionTarget: meta.contributionTarget, communityId: meta.id,
    onBack: () => setHash({ view: "feed", action: null, target: null }),
  });
  renderSwitcher(null);
}

function loadVaultScreen() {
  const feedEl = document.getElementById("feed");
  const panelEl = document.getElementById("objective-panel-mount");
  const filterBarEl = document.getElementById("filter-bar-mount");
  const alertsPanelEl = document.getElementById("alerts-panel-mount");
  const syncEl = document.getElementById("sync-state");
  if (syncEl) syncEl.innerHTML = "";
  panelEl.innerHTML = "";
  filterBarEl.innerHTML = "";
  alertsPanelEl.innerHTML = "";
  const lensMountEl = document.getElementById("virtual-lens-mount");
  if (lensMountEl) lensMountEl.innerHTML = "";
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
    pins: listPins(),
    onUnpin: async (communityId) => {
      const meta = COMMUNITIES.find((c) => c.id === communityId);
      await unpinCommunity(communityId, meta ? meta.path : undefined);
      loadVaultScreen();
    },
    syncPolicy: settings.getSyncPolicy(),
    onSyncPolicyChange: (policy) => {
      settings.setSyncPolicy(policy);
      loadVaultScreen();
    },
  });
  renderSwitcher(null);
}

function loadOutboxScreen() {
  const feedEl = document.getElementById("feed");
  const panelEl = document.getElementById("objective-panel-mount");
  const filterBarEl = document.getElementById("filter-bar-mount");
  const alertsPanelEl = document.getElementById("alerts-panel-mount");
  const syncEl = document.getElementById("sync-state");
  if (syncEl) syncEl.innerHTML = "";
  panelEl.innerHTML = "";
  filterBarEl.innerHTML = "";
  alertsPanelEl.innerHTML = "";
  const lensMountEl = document.getElementById("virtual-lens-mount");
  if (lensMountEl) lensMountEl.innerHTML = "";
  feedEl.innerHTML = "";
  feedEl.setAttribute("aria-busy", "false");

  async function draw() {
    renderOutboxScreen(feedEl, {
      entries: listOutbox(),
      onPush: async () => {
        for (const c of COMMUNITIES) {
          await pushOutbox(c.path, c.id);
          settings.setLastSynced(c.id, Date.now());
        }
        draw();
      },
      onDiscard: (contributionId) => {
        removeFromOutbox(contributionId);
        draw();
      },
      onBack: () => setHash({ view: "feed" }),
    });
    renderSwitcher(null);
  }
  draw();
}

async function loadExtensionScreen(id) {
  const feedEl = document.getElementById("feed");
  const panelEl = document.getElementById("objective-panel-mount");
  const filterBarEl = document.getElementById("filter-bar-mount");
  const alertsPanelEl = document.getElementById("alerts-panel-mount");
  const syncEl = document.getElementById("sync-state");
  if (syncEl) syncEl.innerHTML = "";
  panelEl.innerHTML = "";
  filterBarEl.innerHTML = "";
  alertsPanelEl.innerHTML = "";
  const lensMountEl = document.getElementById("virtual-lens-mount");
  if (lensMountEl) lensMountEl.innerHTML = "";
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
  const fixtureRows = community.api.read({});
  const fixtureLinks = community.raw.state.links || [];
  feedEl.setAttribute("aria-busy", "false");

  function draw() {
    renderExtensionScreen(feedEl, {
      extensions: settings.getExtensions(),
      activeRanker: settings.getActiveRanker(),
      activeRenderer: settings.getActiveRenderer(),
      onInstall: async (source, shape, label) => {
        const conformance = await checkConformance(source, shape, fixtureRows, fixtureLinks);
        if (conformance.pass) {
          settings.installExtension({ hash: contentHash(source), shape, label, source, conformance, installedAt: Date.now() });
        }
        draw();
        return conformance;
      },
      onUninstall: (hash) => { settings.uninstallExtension(hash); draw(); },
      onSetActiveRanker: (hash) => { settings.setActiveRanker(hash); draw(); },
      onSetActiveRenderer: (hash) => { settings.setActiveRenderer(hash); draw(); },
    });
  }
  draw();
  renderSwitcher(null);
}

async function loadDashboardScreen(id) {
  const feedEl = document.getElementById("feed");
  const panelEl = document.getElementById("objective-panel-mount");
  const filterBarEl = document.getElementById("filter-bar-mount");
  const alertsPanelEl = document.getElementById("alerts-panel-mount");
  const syncEl = document.getElementById("sync-state");
  if (syncEl) syncEl.innerHTML = "";
  panelEl.innerHTML = "";
  filterBarEl.innerHTML = "";
  alertsPanelEl.innerHTML = "";
  const lensMountEl = document.getElementById("virtual-lens-mount");
  if (lensMountEl) lensMountEl.innerHTML = "";
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
  const activeHash = settings.getActiveRenderer();
  const entry = activeHash ? (settings.getExtensions() || []).find((e) => e.hash === activeHash && e.shape === "renderer") : null;
  feedEl.setAttribute("aria-busy", "false");

  let descriptor = null;
  let error = null;
  if (entry) {
    try {
      descriptor = await runRenderer(entry.source, community.api.read({}));
    } catch (e) {
      error = e.message;
    }
  }
  renderDashboardScreen(feedEl, {
    descriptor, error,
    onContribute: (action, targetRow) => setHash({ view: "contribute", action, target: targetRow.identity, community: meta.id }),
  });
  renderSwitcher(null);
}

function route({ community, claim, view, action, target }) {
  if (view === "vault") {
    loadVaultScreen();
  } else if (view === "outbox") {
    loadOutboxScreen();
  } else if (view === "extensions") {
    loadExtensionScreen(community || COMMUNITIES[0].id);
  } else if (view === "dashboard") {
    loadDashboardScreen(community || COMMUNITIES[0].id);
  } else if (view === "contribute") {
    loadContributeScreen(community || COMMUNITIES[0].id, action, target);
  } else {
    loadCommunity(community || COMMUNITIES[0].id, claim);
  }
}

// first-run onboarding (spec Section 6): shown once, before whatever route was actually requested
// (a deep link is preserved and reached the moment onboarding finishes or is skipped). Activating the
// learn-efficiently default installs the same demo extension the Extensions screen offers, through the
// identical conformance path; if the sandbox is unavailable for any reason, onboarding still completes
// with the null order intact rather than blocking the reader from the feed.
async function activateLearnEfficientlyDefault() {
  try {
    const conformance = await checkConformance(LEARN_EFFICIENTLY_SOURCE, "ranker", [], []);
    if (!conformance.pass) return;
    const hash = contentHash(LEARN_EFFICIENTLY_SOURCE);
    settings.installExtension({ hash, shape: "ranker", label: "Learn-efficiently ranker (demo)", source: LEARN_EFFICIENTLY_SOURCE, conformance, installedAt: Date.now() });
    settings.setActiveRanker(hash);
  } catch (e) {
    void e;
  }
}

function boot() {
  const parsed = parseHash();
  if (!settings.onboardingSeen()) {
    const feedEl = document.getElementById("feed");
    const panelEl = document.getElementById("objective-panel-mount");
    const filterBarEl = document.getElementById("filter-bar-mount");
    const alertsPanelEl = document.getElementById("alerts-panel-mount");
    const syncEl = document.getElementById("sync-state");
    if (syncEl) syncEl.innerHTML = "";
    panelEl.innerHTML = "";
    filterBarEl.innerHTML = "";
    alertsPanelEl.innerHTML = "";
  const lensMountEl = document.getElementById("virtual-lens-mount");
  if (lensMountEl) lensMountEl.innerHTML = "";
    feedEl.innerHTML = "";
    renderSwitcher(null);
    renderOnboardingScreen(feedEl, {
      onFinish: async (topics, { activateDefault }) => {
        settings.setFollowedTopics(topics);
        settings.setOnboardingSeen(true);
        if (activateDefault) await activateLearnEfficientlyDefault();
        route(parsed);
      },
      onSkip: () => {
        settings.setOnboardingSeen(true);
        route(parsed);
      },
    });
    return;
  }
  route(parsed);
}

window.addEventListener("hashchange", boot);
setupShell();
boot();
