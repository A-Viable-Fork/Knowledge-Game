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
import { assemblePromptPack, buildFormalizeMessages, buildExplainMessages, parseFormalizeOutput, parseExplainOutput, ASSISTANT_SOURCE, PROVIDER_PRESETS, assistantChipLabel } from "../api/assistant.js";
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
import { renderSubmissionScreen } from "./submission-screen.js";
import { loadAllAnchorMaps, buildCrossDocumentIndex } from "../api/submission.js";
import { LEARN_EFFICIENTLY_SOURCE, CONTESTABLE_DASHBOARD_SOURCE } from "./demo-extensions.js";
import { registryRows, contractsByIdentity } from "../api/registry.js";
import { renderRegistryScreen } from "./registry-screen.js";
import { renderRegisterArtifactScreen } from "./register-artifact-screen.js";
import { createAccount, exportAccount, importAccount } from "../api/account.js";
import { renderAccountScreen } from "./account-screen.js";
import { ROOM_WALKS } from "../api/room-walks.js";
import { checkSkinConformance } from "../api/skin-conformance.js";
import { SKINS } from "../api/skins.js";
import {
  establishBaseline, computeUpdateList, flagContradictions, acceptIntoBaseline,
  holdUpdates, clearHeld, adoptGovernanceHash, recomputeUnderAdoptedParameters,
} from "../api/inbound-gate.js";
import { renderUpdateList, renderHeldList } from "./inbound-screen.js";

// The community registry. The founded EpiStack Competition Community (Phase B/C, its community card
// at communities/epistack-competition/community-card.json) is the default; the two development
// fixtures are demoted to secondary. Real directory discovery (importing an arbitrary community card)
// remains unbuilt; this is still a hardcoded list, now naming a real published community rather than
// only fixtures.
const COMMUNITIES = [
  { id: "epistack-competition", label: "EpiStack Competition Community", path: "../communities/epistack-competition/snapshot/epistack-competition.snapshot.json", contributionTarget: "https://github.com/A-Viable-Fork/Knowledge-Game/tree/main/communities/epistack-competition", governanceHash: "dbd6dc3c2aed980cb94a7f5de7a7f1d50303af4135d6f87537a75468fdcfc8ed" },
  { id: "the-registry", label: "The Registry (artifacts of the ecosystem, self-hosted)", path: "../communities/the-registry/snapshot/the-registry.snapshot.json", contributionTarget: "https://github.com/A-Viable-Fork/Knowledge-Game/tree/main/communities/the-registry", registry: true, governanceHash: "26fbdef0d1ec08c58018b7c0916a49de4b5eacb9fe3978ae67bc2c1eb7d2c5c4" },
  // the mirror (Phase KG-12 Step 5): the protocol's own repositories, joined as ordinary browsable
  // communities like any other, snapshot by hash, fetched through the identical path. A promotion
  // proposal read here (adopt something to shared) is an ordinary claim, argued in the open and
  // decided by which communities choose to pin it, never a privileged act this app performs.
  { id: "knowledge-game", label: "Knowledge-Game (this repository's own governance kernel, mirrored)", path: "fixtures/knowledge-game.snapshot.json", contributionTarget: "https://github.com/A-Viable-Fork/Knowledge-Game", mirror: true },
  { id: "math", label: "EpiStack (upstream protocol repository's math kernel, mirrored)", path: "fixtures/math.snapshot.json", contributionTarget: "https://github.com/A-Viable-Fork/epistack", mirror: true },
  // the front-page kernel (Phase KG-claim-lens): the root front page's own six-question argument,
  // decomposed into typed claims, joined here as an ordinary browsable community so the claim
  // lens's comment/fork/contest doors (periphery/root-lens.js, reached from index.html, outside
  // this app's own bundle) have a real registered target to deep-link into, using the identical
  // #community=front-page&view=contribute&action=...&target=<identity> route every other card uses.
  { id: "front-page", label: "The Front Page (this repository's own entrance decomposition, mirrored)", path: "fixtures/front-page.snapshot.json", contributionTarget: "https://github.com/A-Viable-Fork/Knowledge-Game", mirror: true },
  // the three rooms (Phase KG-13): the competition's three cases, working corpora in epistack,
  // emitted here as ordinary browsable communities. The app hosts no room content; each fetches its
  // snapshot by hash and its contribution target names epistack's own corpus path, never this app.
  // caseFraming is one sentence drawn from docs/for-the-institutional-adopter.md (upstream), rendered
  // as app chrome, never as a room claim.
  {
    id: "lhc", label: "The LHC Room (black holes)", path: "fixtures/lhc.snapshot.json", mirror: true,
    contributionTarget: "https://github.com/A-Viable-Fork/epistack/tree/main/corpora/lhc",
    governanceHash: "2fde344a7e9aa2f0b78065a04b05fbd89e08f6d7a023a038f7457aef42de8315",
    caseFraming: "The clean case: existential-sounding risk, resolvable grounding, its safety standing checkable by anyone under named parameters.",
  },
  {
    id: "eggs", label: "The Eggs Room (nutrition)", path: "fixtures/eggs.snapshot.json", mirror: true,
    contributionTarget: "https://github.com/A-Viable-Fork/epistack/tree/main/corpora/eggs",
    governanceHash: "2fde344a7e9aa2f0b78065a04b05fbd89e08f6d7a023a038f7457aef42de8315",
    caseFraming: "The stress test for a noisy, contested empirical field: claims ground to their own floors where evidence supports them, and an unsettled cross-domain weighing is left honestly unsettled rather than synthesized into false confidence.",
  },
  {
    id: "covid", label: "The Covid Room (pandemic origins)", path: "fixtures/covid.snapshot.json", mirror: true,
    contributionTarget: "https://github.com/A-Viable-Fork/epistack/tree/main/corpora/covid",
    governanceHash: "2fde344a7e9aa2f0b78065a04b05fbd89e08f6d7a023a038f7457aef42de8315",
    caseFraming: "The adversarial case: genuinely contested ground, motivated parties, evidence spanning domains, where disagreement localizes to named claims and parameters instead of camps.",
  },
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
    // Phase KG-9b: the objective-chip discipline applied to the assistant. Renders on every screen,
    // a pure function of settings alone, so the reader always sees which producer they are talking to.
    const activeProviderId = settings.getAssistantActiveProvider();
    const activeProviderConfig = activeProviderId ? settings.getAssistantProviderConfig(activeProviderId) : null;
    const assistantLabel = activeProviderConfig ? assistantChipLabel(activeProviderId, activeProviderConfig.model, PROVIDER_PRESETS) : null;
    if (assistantLabel) {
      const assistantBtn = document.createElement("button");
      assistantBtn.type = "button";
      assistantBtn.className = "indicator-chip";
      assistantBtn.textContent = assistantLabel;
      assistantBtn.addEventListener("click", () => setHash({ view: "assistant" }));
      chipsEl.appendChild(assistantBtn);
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

  // the inbound gate (Phase KG-6c): auto (the default) leaves rows exactly as every load before
  // this phase produced them. Review mode diffs this fresh read against the community's own
  // last-accepted baseline; a new or grade-moved claim not currently held is excluded from the
  // solid ranked feed and rendered only as a ghost card until accepted, the mirror image of an
  // outbound virtual. The first review-mode load with no baseline yet establishes one silently
  // (adopting everything currently visible), so switching a community into review mode never
  // itself produces a false "everything is new" list.
  let inboundPending = [];
  let inboundStillHeld = [];
  function recomputeInbound() {
    inboundPending = [];
    inboundStillHeld = [];
    if (settings.getInboundMode(meta.id) !== "review") return;
    let baseline = settings.getInboundBaseline(meta.id);
    if (!baseline) {
      baseline = establishBaseline(rows, community.raw, meta.governanceHash);
      settings.setInboundBaseline(meta.id, baseline);
      return;
    }
    const held = settings.getHeldUpdates(meta.id);
    const { pending, stillHeld } = computeUpdateList(baseline, held, rows);
    inboundPending = flagContradictions(pending, stillHeld, community.raw.state.links || []);
    inboundStillHeld = stillHeld;
  }
  recomputeInbound();
  function acceptOne(identity) {
    const baseline = settings.getInboundBaseline(meta.id);
    settings.setInboundBaseline(meta.id, acceptIntoBaseline(baseline, rows, [identity]));
    settings.setHeldUpdates(meta.id, clearHeld(settings.getHeldUpdates(meta.id), [identity]));
    recomputeInbound();
    renderFeed();
  }
  function holdOne(identity) {
    const held = settings.getHeldUpdates(meta.id);
    settings.setHeldUpdates(meta.id, holdUpdates(held, inboundPending, [identity]));
    recomputeInbound();
    renderFeed();
  }

  let weights = settings.getObjective();
  const observationOn = settings.observationEnabled();
  let excludedKinds = settings.getFilter(meta.id);
  let submissionScope = settings.getSubmissionScope(meta.id);

  async function renderFeed() {
    const extra = { reconciliations, observation: { enabled: observationOn, log: settings.observationLog() } };
    const inboundHiddenIdentities = new Set([...inboundPending, ...inboundStillHeld].map((p) => p.identity));
    const inboundVisibleRows = inboundHiddenIdentities.size ? rows.filter((r) => !inboundHiddenIdentities.has(r.identity)) : rows;
    const { visible: kindVisible, hidden: kindHidden } = applyFilter(inboundVisibleRows, excludedKinds, community.raw.kinds);
    // the submission threshold's own default scope (Phase KG-11): a further restriction to exactly
    // the claim identities the reader just read, composed on top of the ordinary kind filter, never
    // replacing it; its own hidden count folds into the same chip the kind filter already renders.
    const scopeSet = submissionScope ? new Set(submissionScope) : null;
    const visible = scopeSet ? kindVisible.filter((r) => scopeSet.has(r.identity)) : kindVisible;
    const scopeHiddenCount = scopeSet ? kindVisible.length - visible.length : 0;
    const hidden = scopeHiddenCount > 0 ? [...kindHidden, { kind: "outside this submission", count: scopeHiddenCount }] : kindHidden;
    renderChrome({ communityLabel: meta.label, weights, hidden, view: "feed" });
    if (scopeSet) {
      const chipsEl = document.getElementById("indicator-chips");
      if (chipsEl) {
        const showAllBtn = document.createElement("button");
        showAllBtn.type = "button";
        showAllBtn.className = "indicator-chip";
        showAllBtn.textContent = "show whole community";
        showAllBtn.addEventListener("click", () => {
          settings.setSubmissionScope(meta.id, null);
          submissionScope = null;
          renderFeed();
        });
        chipsEl.appendChild(showAllBtn);
      }
    }
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
    // the case framing (Phase KG-13 Step 3): app chrome, never a room claim, shown once at the top
    // of a room's own feed so a judge understands what they are looking at before reading any card.
    if (meta.caseFraming) {
      const framingEl = document.createElement("p");
      framingEl.className = "room-case-framing";
      const strong = document.createElement("strong");
      strong.textContent = "This room's case: ";
      framingEl.appendChild(strong);
      framingEl.appendChild(document.createTextNode(meta.caseFraming));
      const mark = document.createElement("span");
      mark.className = "room-case-framing-mark";
      mark.textContent = " (framing, not a room claim)";
      framingEl.appendChild(mark);
      feedEl.appendChild(framingEl);
    }
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
        roomWalks: meta.id === "epistack-competition" ? ROOM_WALKS : undefined,
        onWalkToRoom: (roomId) => setHash({ community: roomId, view: "feed", claim: null }),
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

    // the inbound gate's own ghost cards (Phase KG-6c): every pending incoming change (new or
    // grade-moved, not currently held), rendered after the virtual layer, real in the community's
    // store, not yet actual in this reader's working view.
    for (const pendingRow of inboundPending) {
      const card = renderCard({ ...pendingRow, incoming: true }, { onAcceptOne: acceptOne, onHoldOne: holdOne });
      feedEl.appendChild(card);
    }
    if (inboundPending.length || inboundStillHeld.length) {
      const reviewLink = document.createElement("a");
      reviewLink.href = `#community=${meta.id}&view=inbound`;
      reviewLink.className = "inbound-review-link";
      reviewLink.textContent = `Review updates (${inboundPending.length} pending, ${inboundStillHeld.length} held)`;
      feedEl.appendChild(reviewLink);
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

function loadAccountScreen() {
  const feedEl = clearChrome();
  feedEl.setAttribute("aria-busy", "false");
  renderChrome({ view: "menu" });
  renderAccountScreen(feedEl, {
    account: settings.getAccount(),
    onCreate: async (displayName) => {
      const account = await createAccount(displayName);
      settings.setAccount(account);
      loadAccountScreen();
    },
    onExport: (account) => downloadJSON(`knowledge-game-account-${account.accountId.slice(0, 12)}.json`, exportAccount(account)),
    onImport: async (jsonText) => {
      const account = importAccount(jsonText);
      settings.setAccount(account);
      loadAccountScreen();
    },
    onDelete: () => {
      settings.deleteAccount();
      loadAccountScreen();
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

// the inbound gate's own review screen (Phase KG-6c): bulk accept/hold over the update list, the
// held list, the governance-hash mismatch banner, and the epistemic-cost tie-in toggle. Fetches
// fresh (like every other per-community screen here); a community not in review mode, or with
// nothing pending or held, still opens, honestly showing an empty list rather than refusing.
async function loadInboundScreen(id) {
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
  let epistemicCostOn = false;

  function draw() {
    let baseline = settings.getInboundBaseline(meta.id);
    if (!baseline) {
      baseline = establishBaseline(rows, community.raw, meta.governanceHash);
      settings.setInboundBaseline(meta.id, baseline);
    }
    const held = settings.getHeldUpdates(meta.id);
    const { pending: rawPending, stillHeld } = computeUpdateList(baseline, held, rows);
    const pending = flagContradictions(rawPending, stillHeld, community.raw.state.links || []);
    const governanceMismatch = meta.governanceHash && baseline.governanceHash && baseline.governanceHash !== meta.governanceHash
      ? { adopted: baseline.governanceHash, current: meta.governanceHash } : null;
    const epistemicCostReport = epistemicCostOn && pending.length ? recomputeUnderAdoptedParameters(pending, community.raw, baseline) : null;

    renderUpdateList(feedEl, {
      pending, stillHeld, governanceMismatch, epistemicCostOn, epistemicCostReport,
      onAcceptAll: () => {
        settings.setInboundBaseline(meta.id, acceptIntoBaseline(baseline, rows, pending.map((p) => p.identity)));
        settings.setHeldUpdates(meta.id, clearHeld(held, pending.map((p) => p.identity)));
        draw();
      },
      onAcceptSelected: (identities) => {
        if (!identities.length) return;
        settings.setInboundBaseline(meta.id, acceptIntoBaseline(baseline, rows, identities));
        settings.setHeldUpdates(meta.id, clearHeld(held, identities));
        draw();
      },
      onHoldSelected: (identities) => {
        if (!identities.length) return;
        settings.setHeldUpdates(meta.id, holdUpdates(held, pending, identities));
        draw();
      },
      onToggleEpistemicCost: (checked) => { epistemicCostOn = checked; draw(); },
      onAdoptGovernanceHash: () => {
        settings.setInboundBaseline(meta.id, adoptGovernanceHash(baseline, meta.governanceHash));
        draw();
      },
      onAcceptHeld: (identity) => {
        settings.setInboundBaseline(meta.id, acceptIntoBaseline(baseline, rows, [identity]));
        settings.setHeldUpdates(meta.id, clearHeld(held, [identity]));
        draw();
      },
      onBack: () => setHash({ view: "feed", community: meta.id }),
    });
  }
  feedEl.setAttribute("aria-busy", "false");
  draw();
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

// the assistant screen (Phase KG-9b: per-provider presets, model dropdown, add-model). onFormalize/
// onExplain are the only two places this app ever reads a configured provider's endpoint/key/model
// (via settings.getAssistantProviderConfig) and hands them to runWorkflow, alongside that provider's
// own endpoint as the sandbox's one declared destination; nothing else in this module reads them.
function activeProviderConfig() {
  const providerId = settings.getAssistantActiveProvider();
  if (!providerId) return null;
  const config = settings.getAssistantProviderConfig(providerId);
  if (!config) return null;
  const preset = PROVIDER_PRESETS.find((p) => p.id === providerId);
  return { providerId, preset, ...config };
}

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
  const active = activeProviderConfig();

  renderAssistantScreen(feedEl, {
    community,
    presets: PROVIDER_PRESETS,
    active,
    activeProviderId: settings.getAssistantActiveProvider(),
    getProviderConfig: (providerId) => settings.getAssistantProviderConfig(providerId),
    online,
    contributionTarget: meta.contributionTarget,
    communityId: meta.id,
    onSaveProvider: (providerId, config) => {
      settings.setAssistantProviderConfig(providerId, config);
      settings.setAssistantActiveProvider(providerId);
      loadAssistantScreen(id);
    },
    onSelectActiveProvider: (providerId) => { settings.setAssistantActiveProvider(providerId); loadAssistantScreen(id); },
    onAddModel: (providerId, modelId) => { settings.addAssistantModel(providerId, modelId); loadAssistantScreen(id); },
    onRemoveModel: (providerId, modelId) => { settings.removeAssistantModel(providerId, modelId); loadAssistantScreen(id); },
    onFormalize: async (informalText, contextClaim) => {
      const cfg = activeProviderConfig();
      const promptPack = assemblePromptPack(community);
      const messages = buildFormalizeMessages(promptPack, informalText, contextClaim);
      const out = await runWorkflow(ASSISTANT_SOURCE, { endpoint: cfg.endpoint, apiKey: cfg.apiKey, model: cfg.model, messages, shape: cfg.preset.shape }, [cfg.endpoint]);
      return parseFormalizeOutput(out.content, !!contextClaim);
    },
    onExplain: async (claim) => {
      const cfg = activeProviderConfig();
      const links = community.raw.state.links || [];
      const rowsByIdentity = new Map(community.api.read({}).map((r) => [r.identity, r]));
      const supports = links.filter((l) => l.link_kind === "supports" && l.to_identity === claim.identity).map((l) => rowsByIdentity.get(l.from_identity)).filter(Boolean);
      const challenges = links.filter((l) => (l.link_kind === "contradicts" || l.link_kind === "undercut") && l.to_identity === claim.identity).map((l) => ({ link_kind: l.link_kind, statement: (rowsByIdentity.get(l.from_identity) || {}).statement || "" }));
      const promptPack = assemblePromptPack(community);
      const messages = buildExplainMessages(promptPack, claim, supports, challenges);
      const out = await runWorkflow(ASSISTANT_SOURCE, { endpoint: cfg.endpoint, apiKey: cfg.apiKey, model: cfg.model, messages, shape: cfg.preset.shape }, [cfg.endpoint]);
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

// the submission reading surface (Phase KG-11): always reads the competition community regardless
// of which community is currently active, since the reading sequence is anchored against that
// community's own merged claims.
async function loadSubmissionScreen() {
  const feedEl = clearChrome();
  feedEl.setAttribute("aria-busy", "true");
  renderChrome({ view: "menu" });
  // honest offline behavior: the documents themselves are never precached (they live only at the
  // pinned upstream commit, never copied into this repository), so this surface is online-only by
  // construction; say so plainly rather than attempting a fetch that can only fail.
  const online = typeof navigator === "undefined" ? true : navigator.onLine !== false;
  if (!online) {
    feedEl.innerHTML = "";
    const notice = document.createElement("p");
    notice.className = "submission-error";
    notice.textContent = "Offline. The submission surface fetches its documents live from the pinned upstream commit and cannot render them offline; try again once connected.";
    feedEl.appendChild(notice);
    feedEl.setAttribute("aria-busy", "false");
    return;
  }
  const meta = COMMUNITIES.find((c) => c.id === "epistack-competition");
  let community;
  try {
    community = await fetchCommunity(meta.path);
  } catch (e) {
    feedEl.textContent = `Refused to load ${meta.path}: ${e.message}`;
    feedEl.setAttribute("aria-busy", "false");
    return;
  }
  const rows = community.api.read({});
  const rowsByIdentity = new Map(rows.map((r) => [r.identity, r]));
  const sourcesById = sourcesMap(community.raw);
  const { byTarget, byFrom } = linksMaps(community.raw);
  const gapsByIdentity = new Map(community.api.gaps({}).map((g) => [g.identity, g]));

  let anchorMapsById;
  try {
    anchorMapsById = await loadAllAnchorMaps();
  } catch (e) {
    feedEl.textContent = `Refused to load the anchor maps: ${e.message}`;
    feedEl.setAttribute("aria-busy", "false");
    return;
  }
  const crossDocIndex = buildCrossDocumentIndex(anchorMapsById);
  feedEl.setAttribute("aria-busy", "false");

  renderSubmissionScreen(feedEl, {
    community, rowsByIdentity, sourcesById, linksByTarget: byTarget, linksByFrom: byFrom, gapsByIdentity, crossDocIndex,
    onContribute: (action, targetRow) => setHash({ view: "contribute", action, target: targetRow.identity, community: meta.id }),
    onEnterCommunity: () => {
      const scope = new Set();
      for (const anchorMap of Object.values(anchorMapsById)) {
        for (const span of anchorMap.spans) scope.add(span.claim);
      }
      settings.setSubmissionScope(meta.id, [...scope]);
      setHash({ view: "feed", community: meta.id });
    },
  });
}

// the registry's browse and install surface (Phase KG-12 Step 3): a founded registry community reads
// through the identical fetchCommunity path as any other community; this loader adds the extension
// join (api/registry.js) and the per-kind re-run/install capability probes the screen renders exactly
// as given, never on its own initiative.
async function loadRegistryScreen(id) {
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
  renderSyncState(community, meta.id);
  renderChrome({ communityLabel: meta.label, view: "feed" });
  const rows = registryRows(community);
  const contractsById = contractsByIdentity(rows);

  // known shipped extension sources this app can re-run checkConformance against live, keyed by their
  // own content hash (the same hash the seed script cited as each row's artifact_hash).
  const KNOWN_EXTENSIONS = [
    { hash: contentHash(LEARN_EFFICIENTLY_SOURCE), source: LEARN_EFFICIENTLY_SOURCE, shape: "ranker" },
    { hash: contentHash(CONTESTABLE_DASHBOARD_SOURCE), source: CONTESTABLE_DASHBOARD_SOURCE, shape: "renderer" },
    { hash: contentHash(ASSISTANT_SOURCE), source: ASSISTANT_SOURCE, shape: "workflow" },
  ];
  const FIXTURE_ROWS = [
    { identity: "a", kind: "measurement", statement: "s1", declared_grade: "asserted", earned_grade: "asserted", source_id: "S1" },
    { identity: "b", kind: "measurement", statement: "s2", declared_grade: "checked", earned_grade: "checked", source_id: "S2" },
  ];

  function reRunFor(row) {
    const ext = row.extensions || {};
    if (row.kind === "extension" && ext.artifact_hash) {
      const known = KNOWN_EXTENSIONS.find((k) => k.hash === ext.artifact_hash);
      if (!known) return null;
      return {
        label: "Re-run conformance in this app",
        run: async () => {
          const fresh = await checkConformance(known.source, known.shape, FIXTURE_ROWS, [], []);
          const cited = (row.checkingRecords[0] || {}).outcome === "confirms";
          return { ok: fresh.pass === cited, detail: `this run: pass=${fresh.pass}${fresh.reason ? `, ${fresh.reason}` : ""}` };
        },
      };
    }
    if (row.kind === "skin" && ext.artifact_hash) {
      const skin = SKINS.find((s) => contentHash(JSON.stringify(s.variants)) === ext.artifact_hash);
      if (!skin) return null;
      return {
        label: "Re-run conformance in this app",
        run: async () => {
          const fresh = checkSkinConformance(skin);
          const cited = (row.checkingRecords[0] || {}).outcome === "confirms";
          return { ok: fresh.pass === cited, detail: `this run: pass=${fresh.pass}, ${fresh.checks.length} assertions` };
        },
      };
    }
    if (row.kind === "community" && ext.artifact_hash) {
      return {
        label: "Re-run conformance in this app",
        run: async () => {
          for (const c of COMMUNITIES) {
            if (c.id === "the-registry") continue;
            try {
              const fresh = await fetchCommunity(c.path);
              if (fresh.snapshotHash === ext.artifact_hash) {
                return { ok: true, detail: `matches ${c.label}, hash ${fresh.snapshotHash.slice(0, 16)}... re-verified live` };
              }
            } catch (e) { /* this candidate refused; keep looking */ }
          }
          return { ok: false, detail: "no currently-fetchable community matches this citation's artifact hash; the citation may be stale" };
        },
      };
    }
    return null;
  }

  function installFor(row) {
    const ext = row.extensions || {};
    if (row.kind === "skin" && ext.artifact_hash) {
      const skin = SKINS.find((s) => contentHash(JSON.stringify(s.variants)) === ext.artifact_hash);
      if (!skin) return null;
      return { label: `Use the "${skin.id}" skin`, run: () => { settings.setSkin(skin.id); applySkin(skin.id); } };
    }
    if (row.kind === "community") {
      const target = COMMUNITIES.find((c) => c.id !== "the-registry" && ext.artifact_hash && c.id === "epistack-competition");
      if (!target) return null;
      return {
        label: isPinned(target.id) ? "Already pinned for offline" : "Pin for offline",
        run: async () => { if (!isPinned(target.id)) await pinCommunity(target); loadRegistryScreen(id); },
      };
    }
    return null;
  }

  function noteFor(row) {
    if (row.kind === "extension") return "Ships first-party with this app; see Menu > Extensions or Menu > Assistant.";
    if (row.kind === "client") return "Not distributed from this screen; see the artifact's own repository for its source.";
    if (row.kind === "component") return "An internal module of this app, not separately installable.";
    if (row.kind === "contract-bundle") return "A contract, not an installable artifact.";
    if (row.kind === "community" && !installFor(row)) return "See Menu > Communities to browse or pin this community.";
    return null;
  }

  feedEl.setAttribute("aria-busy", "false");
  renderRegistryScreen(feedEl, {
    rows, contractsById, reRunFor, installFor, noteFor,
    onRegister: () => setHash({ view: "register-artifact", community: id }),
  });
}

async function loadRegisterArtifactScreen(id) {
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
  const rows = registryRows(community);
  const contractRows = rows.filter((r) => r.kind === "contract-bundle");
  feedEl.setAttribute("aria-busy", "false");
  renderRegisterArtifactScreen(feedEl, {
    community, contractRows, contributionTarget: meta.contributionTarget,
    knownCommunities: COMMUNITIES.filter((c) => c.id !== "the-registry"),
    onBack: () => setHash({ view: "feed", community: id }),
  });
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
    getInboundMode: (id) => settings.getInboundMode(id),
    onSetInboundMode: (id, mode) => {
      settings.setInboundMode(id, mode);
      loadCommunitiesScreen(activeId);
    },
    onReviewUpdates: (id) => setHash({ community: id, view: "inbound" }),
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
  } else if (view === "inbound") {
    loadInboundScreen(activeId);
  } else if (view === "account") {
    loadAccountScreen();
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
  } else if (view === "submission") {
    loadSubmissionScreen();
  } else if (view === "register-artifact") {
    loadRegisterArtifactScreen(activeId);
  } else if (view === "contribute") {
    loadContributeScreen(activeId, action, target);
  } else {
    const meta = COMMUNITIES.find((c) => c.id === activeId) || COMMUNITIES[0];
    if (meta.registry) loadRegistryScreen(meta.id);
    else loadCommunity(activeId, claim);
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
