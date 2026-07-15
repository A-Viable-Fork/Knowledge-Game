// Role: the extension sandbox (spec Section 6). Runs an extension's source in an isolated worker (a
//   browser Worker in-page; node:worker_threads under Node, for build/check-extension-seam.mjs and
//   this module's own conformance probes), denying network (fetch/XMLHttpRequest/WebSocket/
//   importScripts all throw before the candidate's own code ever runs) and denying DOM (a worker's
//   global scope has no document at all, so this is structural, not policed by this module).
// Contract: runInSandbox(sourceText, input, timeoutMs=2000) -> Promise<{ok:true, result} |
//   {ok:false, error}>. sourceText must define a top-level function `extensionMain(input) -> output`;
//   the sandbox calls it once with the given input and returns what it returned or the error it threw.
// Invariant: the candidate's code runs with no capability this module did not hand it: no import, no
//   fetch, no DOM, no access to anything outside the one input value passed to extensionMain, and no
//   reference back into the host's own memory (structured-clone through postMessage only).
"use strict";

// wraps the candidate source so it runs identically under a browser Worker (self, postMessage,
// onmessage) and Node's worker_threads (globalThis, parentPort.postMessage/on("message")), denying
// network access in either environment before the candidate's own top-level code executes.
function guardedSource(sourceText) {
  return [
    '"use strict";',
    "(function () {",
    '  var g = (typeof self !== "undefined") ? self : globalThis;',
    '  var isNode = typeof require === "function";',
    '  var port = isNode ? require("worker_threads").parentPort : null;',
    '  g.fetch = function () { throw new Error("extension-sandbox: fetch is not available"); };',
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
    "      post({ ok: true, result: out });",
    "    } catch (err) {",
    "      post({ ok: false, error: String((err && err.message) || err) });",
    "    }",
    "  });",
    "})();",
  ].join("\n");
}

export function runInSandbox(sourceText, input, timeoutMs) {
  const wrapped = guardedSource(sourceText);
  const timeout = timeoutMs || 2000;
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
