// Role: the app shell. Parses the URL hash for the active community, view, and an optional deep-linked
//   claim; fetches the community through the data layer; orders the feed under the reader's objective
//   (or the null order at the zero vector); renders the feed, the virtual layer, and every other page;
//   records opt-in dwell and expand observations when enabled. Phase KG-7 (the interface pass)
//   restructures navigation: the feed owns the screen at rest, chrome is the slim self-hiding top bar
//   plus a persistent bottom nav (Feed, Communities, Compose, Menu), and everything else (the
//   objective vector editor, the filter page, alerts, vault, outbox, extensions, the dashboard) is its
//   own page reached from Menu, never inline above the feed.
// Contract: none exported; this is the entry module app/index.html loads. Imports only api/ and its
//   own periphery/ files, never vendor/, kernel/, or vault/ directly (governing-trellis G0-1 / A-1).
// Invariant: this module computes no grade, no ranking rule, and touches no storage directly; every
//   grade comes from api/community.js's provider, every order from api/ranking.js (or api/feed.js's
//   null order at the zero vector), every persisted read or write from api/settings.js.
"use strict";
import { fetchCommunity } from "../api/community.js";
import { orderByObjective, explainPosition, objectiveChipLabel, COMPONENTS } from "../api/ranking.js";
import { epistemicCost, epistemicCostSummary } from "../api/epistemic-cost.js";
import { kindsPresent, applyFilter, filterChipLabel } from "../api/filter.js";
import { checkConformance, runRanker, runRenderer, runWorkflow, contentHash } from "../api/extension.js";
import { assemblePromptPack, buildFormalizeMessages, buildExplainMessages, parseFormalizeOutput, parseExplainOutput, ASSISTANT_SOURCE } from "../api/assistant.js";
import { computeAlerts, refreshWatches } from "../api/alerts.js";
import * as settings from "../api/settings.js";
import { pinCommunity, unpinCommunity, isPinned, pinAge, listPins } from "../api/pins.js";
import { listOutbox, removeFromOutbox, pushOutbox, sweepAdmitted } from "../api/outbox.js";
import { virtualRowsFor, computeLensImpact } from "../api/virtual.js";
import { shouldSync } from "../api/sync.js";
import { applySkin, wireSkinPreference } from "./skin-apply.js";
import { renderCard } from "./card.js";
import { renderObjectivePanel } from "./objective-panel.js";
import { renderFilterBar } from "./filter-bar.js";
import { renderAlertsPanel } from "./alerts-panel.js";
import { renderVaultScreen, downloadJSON } from "./vault-screen.js";
import { renderOutboxScreen } from "./outbox-screen.js";
import { renderContributeScreen } from "./contribute-screen.js";
import { renderExtensionScreen, renderDashboardScreen } from "./extension-screen.js";
import { renderOnboardingScreen } from "./onboarding-screen.js";
import { renderMenuScreen } from "./menu-screen.js";
import { renderCommunitiesScreen } from "./communities-screen.js";
import { renderAssistantScreen } from "./assistant-screen.js";
import { renderKernelDesignerScreen } from "./kernel-designer-screen.js";
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
function pinAgeLabel(id) {
  const ms = pinAge(id);
  if (ms === null) return "";
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  return days < 1 ? "pinned less than a day ago" : `pinned ${days} day${days === 1 ? "" : "s"} ago`;
}
function lastSyncedLabel(id) {
  const at = settings.getLastSynced(id);
  return at ? new Date(at).toLocaleString() : "never";
}

// this session's last-computed alerts state, refreshed whenever the feed screen loads; used only to
// paint the Menu nav button's unread dot on every other screen without re-fetching a community there.
let lastKnownHasAlerts = false;

function clearChrome() {
  const feedEl = document.getElementById("feed");
  const syncEl = document.getElementById("sync-state");
  const lensMountEl = document.getElementById("virtual-lens-mount");
  if (syncEl) syncEl.innerHTML = "";
  if (lensMountEl) lensMountEl.innerHTML = "";
  feedEl.innerHTML = "";
  return feedEl;
}

// the slim bar (Phase KG-7): active community name, sync-state (rendered separately, unchanged), and
// the two governance indicator chips. The objective chip is a pure function of settings alone and
// renders on every screen; the filter chip needs the active community's own rows to state an honest
// hidden count, so it renders only where that data is already loaded (the feed and filter pages),
// passed as `hidden`, and is simply omitted (never fabricated) elsewhere.
function renderChrome({ communityLabel, weights, hidden, view }) {
  const nameEl = document.getElementById("active-community-name");
  if (nameEl) nameEl.textContent = communityLabel || "";
  const chipsEl = document.getElementById("indicator-chips");
  if (chipsEl) {
    chipsEl.innerHTML = "";
    const objBtn = document.createElement("button");
    objBtn.type = "button";
    objBtn.className = "indicator-chip";
    objBtn.textContent = objectiveChipLabel(weights || settings.getObjective());
    objBtn.addEventListener("click", () => setHash({ view: "objective" }));
    chipsEl.appendChild(objBtn);
    const filterLabel = filterChipLabel(hidden);
    if (filterLabel) {
      const filterBtn = document.createElement("button");
      filterBtn.type = "button";
      filterBtn.className = "indicator-chip";
      filterBtn.textContent = filterLabel;
      filterBtn.addEventListener("click", () => setHash({ view: "filters" }));
      chipsEl.appendChild(filterBtn);
    }
  }
  const dot = document.getElementById("menu-unread-dot");
  if (dot) dot.hidden = !lastKnownHasAlerts;
  for (const btn of document.querySelectorAll(".bottom-nav-button")) {
    btn.setAttribute("aria-current", String(btn.dataset.nav === view));
  }
}

// chrome self-hides on scroll-down, returns on scroll-up (the standard feed pattern); the bottom nav
// persists (thumb anchor). Reduced-motion users get the identical show/hide, just without the CSS
// transition (handled entirely in style.css's own @media rule, not here).
let lastScrollY = 0;
function wireSelfHidingHeader() {
  const header = document.getElementById("app-header");
  if (!header || header.dataset.wired) return;
  header.dataset.wired = "true";
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    if (y > lastScrollY && y > 40) header.classList.add("header-hidden");
    else header.classList.remove("header-hidden");
    lastScrollY = y;
  }, { passive: true });
}

function wireBottomNav() {
  const nav = document.getElementById("bottom-nav");
  if (!nav || nav.dataset.wired) return;
  nav.dataset.wired = "true";
  nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".bottom-nav-button");
    if (!btn) return;
    const view = btn.dataset.nav;
    if (view === "feed") setHash({ view: "feed" });
    else if (view === "communities") setHash({ view: "communities" });
    else if (view === "compose") setHash({ view: "contribute", action: null, target: null });
    else if (view === "menu") setHash({ view: "menu" });
  });
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

// the visible sync-state dot (Phase KG-7: compact, in the slim bar's header row): a verified badge
// (every load that reaches this point already passed api/community.js's hash check; a failed one
// refuses to load and never reaches here at all) plus the last-synced time, labeled plainly, never a
// bare timestamp with no reference for how current it is. The snapshot hash and the "loaded at" detail
// move to the Communities page (per-community sync detail), which has room for them.
function renderSyncState(community, communityId) {
  const el = document.getElementById("sync-state");
  if (!el) return;
  el.innerHTML = "";
  const span = (text, cls) => {
    const s = document.createElement("span");
    if (cls) s.className = cls;
    s.textContent = text;
    return s;
  };
  el.appendChild(span("verified", "verified-badge"));
  const lastSynced = settings.getLastSynced(communityId);
  el.appendChild(span(lastSynced ? `synced ${new Date(lastSynced).toLocaleTimeString()}` : "not yet synced", "last-synced"));
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
  const feedEl = clearChrome();
  feedEl.setAttribute("aria-busy", "true");
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
  lastKnownHasAlerts = alerts.length > 0;
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

  async function renderFeed() {
    const extra = { reconciliations, observation: { enabled: observationOn, log: settings.observationLog() } };
    const { visible, hidden } = applyFilter(rows, excludedKinds, community.raw.kinds);
    renderChrome({ communityLabel: meta.label, weights, hidden, view: "feed" });
    const activeRankerHash = settings.getActiveRanker();
    const activeRankerEntry = activeRankerHash ? (settings.getExtensions() || []).find((e) => e.hash === activeRankerHash && e.shape === "ranker") : null;
    let ordered;
    let usedExtension = false;
    if (activeRankerEntry) {
      try {
        ordered = await runRanker(activeRankerEntry.source, visible, weights, community.raw.state.links || [], activeRankerEntry.declaredDestinations || []);
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
}

async function loadContributeScreen(id, action, targetIdentity) {
  const feedEl = clearChrome();
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
  renderChrome({ communityLabel: meta.label, view: "compose" });
  renderContributeScreen(feedEl, {
    community, action, targetRow, contributionTarget: meta.contributionTarget, communityId: meta.id,
    onBack: () => setHash({ view: "feed", action: null, target: null }),
  });
}

function loadVaultScreen() {
  const feedEl = clearChrome();
  feedEl.setAttribute("aria-busy", "false");
  renderChrome({ view: "menu" });
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
    currentSkin: settings.getSkin(),
    onSkinChange: (skinId) => {
      settings.setSkin(skinId);
      applySkin(skinId);
      loadVaultScreen();
    },
  });
}

function loadOutboxScreen() {
  const feedEl = clearChrome();
  feedEl.setAttribute("aria-busy", "false");
  renderChrome({ view: "menu" });

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
  }
  draw();
}

async function loadExtensionScreen(id) {
  const feedEl = clearChrome();
  feedEl.setAttribute("aria-busy", "true");
  renderChrome({ view: "menu" });

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
      onInstall: async (source, shape, label, declaredDestinations) => {
        const conformance = await checkConformance(source, shape, fixtureRows, fixtureLinks, declaredDestinations || []);
        if (conformance.pass) {
          settings.installExtension({ hash: contentHash(source), shape, label, source, conformance, declaredDestinations: declaredDestinations || [], installedAt: Date.now() });
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
}

async function loadDashboardScreen(id) {
  const feedEl = clearChrome();
  feedEl.setAttribute("aria-busy", "true");
  renderChrome({ view: "menu" });

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
      descriptor = await runRenderer(entry.source, community.api.read({}), entry.declaredDestinations || []);
    } catch (e) {
      error = e.message;
    }
  }
  renderDashboardScreen(feedEl, {
    descriptor, error,
    onContribute: (action, targetRow) => setHash({ view: "contribute", action, target: targetRow.identity, community: meta.id }),
  });
}

// the objective page (Phase KG-7): the full vector editor, the inert-component notes, and the
// epistemic-cost report, moved off the feed onto its own page. Fetches the active community fresh
// (needed for the epistemic-cost report's own top-20 read), same pattern the dashboard page uses.
async function loadObjectiveScreen(id) {
  const feedEl = clearChrome();
  feedEl.setAttribute("aria-busy", "true");
  renderChrome({ view: "menu" });

  const meta = COMMUNITIES.find((c) => c.id === id) || COMMUNITIES[0];
  let community;
  try {
    community = await fetchCommunity(meta.path);
  } catch (e) {
    feedEl.textContent = `Refused to load ${meta.path}: ${e.message}`;
    feedEl.setAttribute("aria-busy", "false");
    return;
  }
  const rows = community.api.read({});
  const reconciliations = community.api.reconciliations({});
  let weights = settings.getObjective();
  const observationOn = settings.observationEnabled();
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "contribute-back";
  backBtn.textContent = "Back to the feed";
  backBtn.addEventListener("click", () => setHash({ view: "feed" }));

  let currentCostSummary = "Computing...";
  const mount = document.createElement("div");
  mount.id = "objective-panel-mount";

  function draw() {
    const activeRankerHash = settings.getActiveRanker();
    const activeRankerEntry = activeRankerHash ? (settings.getExtensions() || []).find((e) => e.hash === activeRankerHash && e.shape === "ranker") : null;
    renderObjectivePanel(mount, {
      components: COMPONENTS,
      weights,
      observationOn,
      costSummary: currentCostSummary,
      activeExtensionRanker: activeRankerEntry ? activeRankerEntry.label : null,
      onWeightsChange: (next) => {
        weights = next;
        settings.setObjective(next);
        draw();
      },
    });
  }
  feedEl.innerHTML = "";
  feedEl.appendChild(backBtn);
  feedEl.appendChild(mount);
  feedEl.setAttribute("aria-busy", "false");
  draw();

  const other = COMMUNITIES.find((c) => c.id !== meta.id);
  if (other) {
    try {
      const otherCommunity = await fetchCommunity(other.path);
      const top20 = orderByObjective(rows, weights, community.raw.state, { reconciliations, observation: { enabled: observationOn, log: settings.observationLog() } }).slice(0, 20);
      const report = epistemicCost(top20, community.raw, otherCommunity.raw);
      currentCostSummary = epistemicCostSummary(other.label, report, top20.length);
    } catch (e) {
      currentCostSummary = `Epistemic-cost report unavailable: ${e.message}`;
    }
    draw();
  }
}

// the filter page (Phase KG-7): the kind chips and counts, moved off the feed onto its own page.
async function loadFilterScreen(id) {
  const feedEl = clearChrome();
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
  const rows = community.api.read({});
  let excludedKinds = settings.getFilter(meta.id);
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "contribute-back";
  backBtn.textContent = "Back to the feed";
  backBtn.addEventListener("click", () => setHash({ view: "feed" }));
  const mount = document.createElement("div");
  mount.id = "filter-bar-mount";

  function draw() {
    const present = kindsPresent(rows, community.raw.kinds);
    const { hidden } = applyFilter(rows, excludedKinds, community.raw.kinds);
    renderChrome({ communityLabel: meta.label, hidden, view: "filters" });
    renderFilterBar(mount, {
      present, excluded: excludedKinds, hidden,
      onChange: (next) => {
        excludedKinds = next;
        settings.setFilter(meta.id, next);
        draw();
      },
    });
  }
  feedEl.innerHTML = "";
  feedEl.appendChild(backBtn);
  feedEl.appendChild(mount);
  feedEl.setAttribute("aria-busy", "false");
  draw();
}

// the alerts page (Phase KG-7): standing-motion alerts, moved off the feed onto its own page,
// reached from Menu with an unread dot when the gap report has content.
async function loadAlertsScreen(id) {
  const feedEl = clearChrome();
  feedEl.setAttribute("aria-busy", "true");
  renderChrome({ view: "menu" });

  const meta = COMMUNITIES.find((c) => c.id === id) || COMMUNITIES[0];
  let community;
  try {
    community = await fetchCommunity(meta.path);
  } catch (e) {
    feedEl.textContent = `Refused to load ${meta.path}: ${e.message}`;
    feedEl.setAttribute("aria-busy", "false");
    return;
  }
  const rows = community.api.read({});
  const priorWatches = settings.getWatches(meta.id);
  const alerts = computeAlerts(priorWatches, rows);
  lastKnownHasAlerts = alerts.length > 0;
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "contribute-back";
  backBtn.textContent = "Back to the feed";
  backBtn.addEventListener("click", () => setHash({ view: "feed" }));
  const mount = document.createElement("div");
  mount.id = "alerts-panel-mount";
  feedEl.innerHTML = "";
  feedEl.appendChild(backBtn);
  feedEl.appendChild(mount);
  feedEl.setAttribute("aria-busy", "false");
  renderAlertsPanel(mount, { alerts });
}

function loadMenuScreen() {
  const feedEl = clearChrome();
  feedEl.setAttribute("aria-busy", "false");
  renderChrome({ view: "menu" });
  renderMenuScreen(feedEl, {
    hasAlerts: lastKnownHasAlerts,
    onNavigate: (view) => setHash({ view }),
  });
}

// the assistant screen (Phase KG-9): onFormalize/onExplain are the only two places this app ever
// calls settings.getApiKey()/getAssistantEndpoint() and hands them to runWorkflow, alongside the
// endpoint itself as the sandbox's one declared destination; nothing else in this module reads them.
async function loadAssistantScreen(id) {
  const feedEl = clearChrome();
  feedEl.setAttribute("aria-busy", "true");
  renderChrome({ view: "menu" });

  const meta = COMMUNITIES.find((c) => c.id === id) || COMMUNITIES[0];
  let community;
  try {
    community = await fetchCommunity(meta.path);
  } catch (e) {
    feedEl.textContent = `Refused to load ${meta.path}: ${e.message}`;
    feedEl.setAttribute("aria-busy", "false");
    return;
  }
  feedEl.setAttribute("aria-busy", "false");

  const online = typeof navigator === "undefined" ? true : navigator.onLine !== false;

  renderAssistantScreen(feedEl, {
    community,
    apiKey: settings.getApiKey(),
    endpoint: settings.getAssistantEndpoint(),
    online,
    contributionTarget: meta.contributionTarget,
    communityId: meta.id,
    onSaveEndpoint: (endpoint) => { settings.setAssistantEndpoint(endpoint); loadAssistantScreen(id); },
    onSaveApiKey: (key) => { settings.setApiKey(key); loadAssistantScreen(id); },
    onFormalize: async (informalText, contextClaim) => {
      const endpoint = settings.getAssistantEndpoint();
      const apiKey = settings.getApiKey();
      const promptPack = assemblePromptPack(community);
      const messages = buildFormalizeMessages(promptPack, informalText, contextClaim);
      const out = await runWorkflow(ASSISTANT_SOURCE, { endpoint: endpoint.url, apiKey, model: endpoint.model, messages }, [endpoint.url]);
      return parseFormalizeOutput(out.content, !!contextClaim);
    },
    onExplain: async (claim) => {
      const endpoint = settings.getAssistantEndpoint();
      const apiKey = settings.getApiKey();
      const links = community.raw.state.links || [];
      const rowsByIdentity = new Map(community.api.read({}).map((r) => [r.identity, r]));
      const supports = links.filter((l) => l.link_kind === "supports" && l.to_identity === claim.identity).map((l) => rowsByIdentity.get(l.from_identity)).filter(Boolean);
      const challenges = links.filter((l) => (l.link_kind === "contradicts" || l.link_kind === "undercut") && l.to_identity === claim.identity).map((l) => ({ link_kind: l.link_kind, statement: (rowsByIdentity.get(l.from_identity) || {}).statement || "" }));
      const promptPack = assemblePromptPack(community);
      const messages = buildExplainMessages(promptPack, claim, supports, challenges);
      const out = await runWorkflow(ASSISTANT_SOURCE, { endpoint: endpoint.url, apiKey, model: endpoint.model, messages }, [endpoint.url]);
      return parseExplainOutput(out.content);
    },
    onBack: () => setHash({ view: "menu" }),
  });
}

function loadDesignerScreen() {
  const feedEl = clearChrome();
  feedEl.setAttribute("aria-busy", "false");
  renderChrome({ view: "menu" });
  renderKernelDesignerScreen(feedEl, { onBack: () => setHash({ view: "menu" }) });
}

function loadCommunitiesScreen(activeId) {
  const feedEl = clearChrome();
  feedEl.setAttribute("aria-busy", "false");
  renderChrome({ view: "communities" });
  renderCommunitiesScreen(feedEl, {
    communities: COMMUNITIES,
    activeId,
    isPinned,
    pinAgeLabel,
    lastSyncedLabel,
    onSelect: (id) => setHash({ community: id, claim: null, view: "feed" }),
    onTogglePin: async (community) => {
      if (isPinned(community.id)) await unpinCommunity(community.id, community.path);
      else await pinCommunity(community);
      loadCommunitiesScreen(activeId);
    },
  });
}

function route({ community, claim, view, action, target }) {
  const activeId = community || COMMUNITIES[0].id;
  if (view === "communities") {
    loadCommunitiesScreen(activeId);
  } else if (view === "menu") {
    loadMenuScreen();
  } else if (view === "objective") {
    loadObjectiveScreen(activeId);
  } else if (view === "filters") {
    loadFilterScreen(activeId);
  } else if (view === "alerts") {
    loadAlertsScreen(activeId);
  } else if (view === "vault") {
    loadVaultScreen();
  } else if (view === "outbox") {
    loadOutboxScreen();
  } else if (view === "extensions") {
    loadExtensionScreen(activeId);
  } else if (view === "assistant") {
    loadAssistantScreen(activeId);
  } else if (view === "dashboard") {
    loadDashboardScreen(activeId);
  } else if (view === "designer") {
    loadDesignerScreen();
  } else if (view === "contribute") {
    loadContributeScreen(activeId, action, target);
  } else {
    loadCommunity(activeId, claim);
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
    settings.installExtension({ hash, shape: "ranker", label: "Learn-efficiently ranker (demo)", source: LEARN_EFFICIENTLY_SOURCE, conformance, declaredDestinations: [], installedAt: Date.now() });
    settings.setActiveRanker(hash);
  } catch (e) {
    void e;
  }
}

function boot() {
  const parsed = parseHash();
  if (!settings.onboardingSeen()) {
    const feedEl = clearChrome();
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
wireSelfHidingHeader();
wireBottomNav();
wireSkinPreference(() => settings.getSkin());
boot();
