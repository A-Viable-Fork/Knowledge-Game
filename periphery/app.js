// Role: the app shell. Parses the URL hash for the active community and an optional deep-linked
//   claim, fetches the community through the data layer, orders the feed under the null objective,
//   renders the community switcher and the card list, and scrolls to a deep-linked claim.
// Contract: none exported; this is the entry module app/index.html loads. Imports only api/ and its
//   own periphery/ files, never vendor/, kernel/, or vault/ directly (governing-trellis G0-1 / A-1).
// Invariant: this module computes no grade, no ranking, and no ordering rule of its own; every grade
//   comes from api/community.js's provider, every order from api/feed.js's null-objective function.
"use strict";
import { fetchCommunity } from "../api/community.js";
import { orderFeed, whyThisCard } from "../api/feed.js";
import { renderCard } from "./card.js";

// The community registry: the two fixtures shipped in this phase. Real discovery (community cards,
// import/export) arrives with Phase B/C; this is deliberately the minimal, hardcoded list.
const COMMUNITIES = [
  { id: "knowledge-game", label: "Knowledge Game (this app's own governance kernel)", path: "fixtures/knowledge-game.snapshot.json" },
  { id: "math", label: "EpiStack Math Kernel (upstream content, for contrast)", path: "fixtures/math.snapshot.json" },
];

function parseHash() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  return { community: params.get("community"), claim: params.get("claim") };
}

function setHash(next) {
  const current = parseHash();
  const merged = { ...current, ...next };
  const params = new URLSearchParams();
  if (merged.community) params.set("community", merged.community);
  if (merged.claim) params.set("claim", merged.claim);
  location.hash = params.toString();
}

function renderSwitcher(activeId) {
  const nav = document.getElementById("community-switcher");
  nav.innerHTML = "";
  for (const c of COMMUNITIES) {
    const btn = document.createElement("button");
    btn.textContent = c.label;
    btn.setAttribute("aria-current", String(c.id === activeId));
    btn.addEventListener("click", () => setHash({ community: c.id, claim: null }));
    nav.appendChild(btn);
  }
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

async function loadCommunity(id, deepLinkClaim) {
  const feedEl = document.getElementById("feed");
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

  const rows = community.api.read({});
  const ordered = orderFeed(rows);
  const { byTarget, byFrom } = linksMaps(community.raw);
  const sourcesById = sourcesMap(community.raw);
  const gapsByIdentity = new Map(community.api.gaps({}).map((g) => [g.identity, g]));

  feedEl.innerHTML = "";
  ordered.forEach((row, i) => {
    row.whyThisCard = whyThisCard(i);
    const card = renderCard(row, {
      kernelId: community.kernelId,
      sourcesById,
      linksByTarget: byTarget,
      linksByFrom: byFrom,
      gapsByIdentity,
      isDeepLinkTarget: (identity) => identity === deepLinkClaim,
    });
    feedEl.appendChild(card);
  });
  feedEl.setAttribute("aria-busy", "false");

  if (deepLinkClaim) {
    const target = document.getElementById(`claim-${deepLinkClaim}`);
    if (target) {
      target.querySelector("details").open = true;
      target.scrollIntoView({ block: "start" });
      target.focus();
    }
  }
  renderSwitcher(meta.id);
}

function boot() {
  const { community, claim } = parseHash();
  loadCommunity(community || COMMUNITIES[0].id, claim);
}

window.addEventListener("hashchange", boot);
boot();
