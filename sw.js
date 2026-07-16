// Role: the PWA shell's service worker. Precaches the app shell and its fixtures on install so the
//   feed loads and renders fully offline; serves cache-first for anything in the precache list, and
//   falls through to an honest offline failure (never a stale substitute) for anything else, in
//   particular a community not already cached.
// Contract: PRECACHE_URLS is the exact file list build/shell-files.mjs computes by walking the real
//   import graph from app/index.html; build/check-offline-shell.mjs recomputes that walk on every
//   run and fails naming any file this list is missing or holds stale. Do not hand-edit this list
//   without re-running build/shell-files.mjs; it is not maintained by inspection.
// Invariant: this file lives at the repository root, not inside app/, because a service worker's
//   default scope is the directory it is served from and everything below it; scoped to app/ it
//   could never intercept fetches to vendor/, api/, periphery/, or vault/, its siblings at the root,
//   and GitHub Pages gives this deployment no way to widen that scope after the fact. Root placement
//   is the one arrangement that lets the worker see the whole site it needs to precache. An uncached
//   community's fetch fails as a rejected promise this app's own fetch call surfaces as a refusal to
//   load (api/community.js already refuses on any non-ok response or fetch rejection); this worker
//   never fabricates a placeholder response for a miss.
"use strict";
const CACHE_NAME = "knowledge-game-shell-v1";
const PRECACHE_URLS = [
  "api/alerts.js",
  "api/community.js",
  "api/contribute.js",
  "api/epistemic-cost.js",
  "api/extension-sandbox.js",
  "api/extension.js",
  "api/feed.js",
  "api/filter.js",
  "api/ranking.js",
  "api/settings.js",
  "app/../communities/epistack-competition/snapshot/epistack-competition.snapshot.json",
  "app/fixtures/knowledge-game.snapshot.json",
  "app/fixtures/math.snapshot.json",
  "app/icons/icon-any-192.png",
  "app/icons/icon-any-512.png",
  "app/icons/icon-maskable-192.png",
  "app/icons/icon-maskable-512.png",
  "app/index.html",
  "app/manifest.webmanifest",
  "app/style.css",
  "periphery/alerts-panel.js",
  "periphery/app.js",
  "periphery/card.js",
  "periphery/contribute-screen.js",
  "periphery/demo-extensions.js",
  "periphery/extension-screen.js",
  "periphery/filter-bar.js",
  "periphery/gate-feedback.js",
  "periphery/ladder.js",
  "periphery/objective-panel.js",
  "periphery/onboarding-screen.js",
  "periphery/vault-screen.js",
  "vault/vault.js",
  "vendor/api/client-api.mjs",
  "vendor/api/contest.js",
  "vendor/api/contribution.js",
  "vendor/api/fork.js",
  "vendor/api/providers/local-provider.mjs",
  "vendor/kernel/analysis/characterized-gaps.mjs",
  "vendor/kernel/analysis/reconciliation.mjs",
  "vendor/kernel/analysis/robustness.mjs",
  "vendor/kernel/gate/comment-guard.mjs",
  "vendor/kernel/gate/gate.mjs",
  "vendor/kernel/grounding/earned-grade.mjs",
  "vendor/kernel/schema/canonical.mjs",
  "vendor/kernel/schema/confidence.mjs",
  "vendor/kernel/schema/records.mjs",
  "vendor/kernel/schema/sha256.mjs",
  "vendor/kernel/schema/tables.mjs",
  "vendor/kernel/schema/type-hash.mjs",
  "vendor/kernel/store/apply.mjs",
  "vendor/kernel/store/decay.mjs",
  "vendor/kernel/store/state.mjs",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS.map((p) => new URL(p, self.registration.scope).href)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => Promise.reject(new Error("offline and not in the precache")));
    })
  );
});
