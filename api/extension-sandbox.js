// Role: the extension sandbox (spec Section 6, capability-scoped network as of Phase KG-9). Runs an
//   extension's source in an isolated worker (a browser Worker in-page; node:worker_threads under
//   Node, for build/check-extension-seam.mjs, build/check-assistant.mjs, and this module's own
//   conformance probes), denying DOM (a worker's global scope has no document at all, so this is
//   structural, not policed by this module) and denying XMLHttpRequest/WebSocket/importScripts
//   unconditionally. Network access through fetch is capability-scoped: a candidate with no declared
//   destinations gets the original, fully-denying fetch; a candidate with declared destinations gets a
//   fetch that only ever reaches an exact string match against that list, everything else refused by
//   name before any real network attempt, and a matched call proceeds through the environment's own
//   real fetch (no second implementation of HTTP here).
// Contract: runInSandbox(sourceText, input, opts?) -> Promise<{ok:true, result} | {ok:false, error}>.
//   opts is either a bare number (legacy timeoutMs, kept for the one internal caller that still uses
//   it) or {timeoutMs=2000, declaredDestinations=[]}. sourceText must define a top-level function
//   `extensionMain(input) -> output`, sync or Promise-returning (a Promise result is awaited before
//   posting back, since fetch is inherently async); the sandbox calls it once with the given input and
//   returns what it returned/resolved or the error it threw/rejected with.
// Invariant: the candidate's code runs with no capability this module did not hand it: no import, no
//   DOM, no access to anything outside the one input value passed to extensionMain, no reference back
//   into the host's own memory (structured-clone through postMessage only), and no network destination
//   outside its own declared list (the empty list by default). A declared destination is an exact
//   string; there is no prefix, host-only, or wildcard match anywhere in this file.
// Governs: claim-20: this module is the structural half of "cannot execute outside its sandbox, or
//   beyond its own declared destinations"; the candidate cannot reach DOM, host memory, or an
//   undeclared destination regardless of what api/extension.js decides about its conformance.
"use strict";

function normalizeOpts(opts) {
  if (typeof opts === "number") return { timeoutMs: opts, declaredDestinations: [] };
  const o = opts || {};
  return { timeoutMs: o.timeoutMs || 2000, declaredDestinations: o.declaredDestinations || [] };
}

// wraps the candidate source so it runs identically under a browser Worker (self, postMessage,
// onmessage) and Node's worker_threads (globalThis, parentPort.postMessage/on("message")). DOM and
// the non-fetch network primitives are always denied; fetch is denied entirely when the declared
// destination list is empty, and exact-match-scoped to it otherwise, real network reached only on a
// match, real network never reached even for an attempted call to something merely similar.
function guardedSource(sourceText, declaredDestinations) {
  const destinationsLiteral = JSON.stringify(declaredDestinations || []);
  return [
    '"use strict";',
    "(function () {",
    '  var g = (typeof self !== "undefined") ? self : globalThis;',
    '  var isNode = typeof require === "function";',
    '  var port = isNode ? require("worker_threads").parentPort : null;',
    `  var DECLARED_DESTINATIONS = ${destinationsLiteral};`,
    "  var realFetch = g.fetch;",
    '  g.fetch = function (url) {',
    "    var u = String(url);",
    "    if (DECLARED_DESTINATIONS.length === 0) { throw new Error(\"extension-sandbox: fetch is not available\"); }",
    "    if (DECLARED_DESTINATIONS.indexOf(u) === -1) { throw new Error(\"extension-sandbox: destination not declared: \" + u); }",
    '    if (typeof realFetch !== "function") { throw new Error("extension-sandbox: fetch is not available in this environment"); }',
    "    return realFetch.apply(g, arguments);",
    "  };",
    '  g.XMLHttpRequest = function () { throw new Error("extension-sandbox: XMLHttpRequest is not available"); };',
    '  g.WebSocket = function () { throw new Error("extension-sandbox: WebSocket is not available"); };',
    '  g.importScripts = function () { throw new Error("extension-sandbox: importScripts is not available"); };',
    '  var post = port ? function (m) { port.postMessage(m); } : function (m) { g.postMessage(m); };',
    '  var onMessage = function (handler) {',
    '    if (port) { port.on("message", handler); }',
    "    else { g.onmessage = function (e) { handler(e.data); }; }",
    "  };",
    sourceText,
    "  onMessage(function (data) {",
    "    try {",
    "      var out = extensionMain(data);",
    '      if (out && typeof out.then === "function") {',
    "        out.then(",
    "          function (result) { post({ ok: true, result: result }); },",
    "          function (err) { post({ ok: false, error: String((err && err.message) || err) }); }",
    "        );",
    "      } else {",
    "        post({ ok: true, result: out });",
    "      }",
    "    } catch (err) {",
    "      post({ ok: false, error: String((err && err.message) || err) });",
    "    }",
    "  });",
    "})();",
  ].join("\n");
}

export function runInSandbox(sourceText, input, opts) {
  const { timeoutMs, declaredDestinations } = normalizeOpts(opts);
  const wrapped = guardedSource(sourceText, declaredDestinations);
  const timeout = timeoutMs;
  return new Promise((resolve) => {
    let settled = false;
    let worker = null;
    let objectUrl = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (objectUrl) { try { URL.revokeObjectURL(objectUrl); } catch (e) { void e; } }
      try { if (worker && worker.terminate) worker.terminate(); } catch (e) { void e; }
      resolve(value);
    };
    const timer = setTimeout(() => finish({ ok: false, error: "extension-sandbox: timed out" }), timeout);

    if (typeof Worker !== "undefined") {
      try {
        const blob = new Blob([wrapped], { type: "application/javascript" });
        objectUrl = URL.createObjectURL(blob);
        worker = new Worker(objectUrl);
      } catch (e) {
        finish({ ok: false, error: "extension-sandbox: could not start worker: " + e.message });
        return;
      }
      worker.onmessage = (e) => finish(e.data);
      worker.onerror = (e) => finish({ ok: false, error: "extension-sandbox: " + e.message });
      worker.postMessage(input);
    } else {
      import("node:worker_threads")
        .then(({ Worker: NodeWorker }) => {
          worker = new NodeWorker(wrapped, { eval: true });
          worker.on("message", (m) => finish(m));
          worker.on("error", (e) => finish({ ok: false, error: "extension-sandbox: " + e.message }));
          worker.postMessage(input);
        })
        .catch((e) => finish({ ok: false, error: "extension-sandbox: no worker implementation available: " + e.message }));
    }
  });
}
