---
Type: governance
Purpose: The software-evidence source-class taxonomy this deployment's governance claims will eventually cite, and the honest report of why none of it can be entered as a literal source_class value in this kernel's source table today.
Depends on: kernel/governance/stage-0.md, vendor/kernel/schema/tables.mjs
Depended on by: kernel/governance/corpora/tables.js (in the sense that no claim there yet needs these; see below)
---

# Local Source Classes for Software Evidence

## The substrate constraint, checked before authoring anything

`vendor/kernel/schema/tables.mjs`'s `makeSourceTable` hard-validates every source row's `source_class`
against a closed, six-item array declared in the pinned code itself:

```
const SOURCE_CLASSES = ["primary-measurement", "peer-reviewed", "preprint", "dataset",
  "institutional-report", "testimony"];
...
if (!SOURCE_CLASSES.includes(r.source_class)) throw new Error(`source ${r.source_id}: bad source_class ${r.source_class}`);
```

This is not a scaffolder config-schema limit; the config schema's own description already says as
much ("the menu itself is substrate-inherited and the real check enforces it, not the generator").
It is the pinned kernel's own validation, in code this deployment never edits. A source row typed
`test-execution`, or any of the other five names below, would throw and fail the real gate before a
single claim could be entered. None of the six can be adopted as a literal `source_class` value
without either editing `vendor/` (forbidden by this repository's own substrate discipline) or
upstream genuinely extending its menu.

This is exactly the situation upstream's own math kernel documented in its worked instance
(`kernel-workflow-guide.md`, Prompt A): "the source-class menu is substrate-inherited, so adding a
class is a change to the shared substrate, not a local config edit... it stops for the maintainer to
decide openly rather than smuggling the change." Upstream's own resolution (Prompt C) was a
documented placeholder from the real menu (`primary-measurement`) for its `src:exhaustion`,
`src:differential-test`, and `src:formal-proof` sources, with the explicit argument that the
placeholder distorts no grade because grades follow the support structure and the checking records,
never the source-class name. This document follows the identical precedent.

## One class turns out to have an honest upstream fit

**capability-manifest** (a machine-readable declaration of this deployment's permissions, network
destinations, and profile-upload policy, e.g. `manifests/capability.json`) is honestly `dataset`
already. A capability manifest is structured, machine-readable data, exactly what `dataset` names.
No local class is needed for this one; it is adopted as `dataset` whenever a future claim needs to
cite one of this deployment's manifests as its source.

## The five that remain genuinely local

Each is documented here as the honest taxonomy Phase A and B's future claims should use once their
own checks exist and a claim needs to cite the evidence-producing process as its source. None is
enterable as a literal `source_class` value today, for the reason above; each entry states what kind
of evidence it is, what tier it can honestly warrant and why, and its verification form.

**test-execution.** Running a test suite or property test (for example, the no-grade-motion property
test, or an objective-visibility test) and observing pass or fail. This warrants that the
behavior-under-test held for the cases the test actually exercised; it never warrants the behavior
holds for every input, or that the property holds outside the test's own assumptions. Honest ceiling:
`checked`, the same ceiling the adopted `measurement` kind already carries, since a passing test is
exactly the kind of evidence that kind's checking records are built for. Verification form: the test
suite's own exit code and assertion log, re-runnable by anyone with the repository.

**reproducible-build-result.** Rebuilding an artifact from its declared source and comparing the
result's hash to the declared one. This warrants that the declared artifact hash matches what the
declared source and build command actually produce; it never warrants the artifact is safe, correct,
or free of latent bugs, only that it is the thing it claims to be. Honest ceiling: `checked`.
Verification form: a build re-run and a byte-for-byte or hash comparison against the manifest's
declared `artifact_hash`.

**static-analysis.** Inspecting code or its import graph without executing it (for example, the
import-graph oracle, or a grep-style schema-definition assertion). This warrants that the inspected
structural property holds of the code as written; it never warrants anything about the code's runtime
behavior, which static analysis does not observe. Honest ceiling: `checked`. Verification form: the
analysis script's own output, re-runnable and deterministic over the same source tree.

**observed-network-behavior.** Monitoring actual network calls made during a test run (for example,
asserting no request reaches a destination outside `manifests/network.json`). This warrants that no
undeclared call occurred during the observed run; it never warrants no undeclared call could ever
occur under different inputs or a different code path. Honest ceiling: `checked`. Verification form:
a network-request assertion under test, logging every attempted destination.

**cryptographic-artifact-identity.** Recomputing a hash over an artifact's content and comparing it
to a declared or locked value (for example, `build/check-substrate.mjs`'s per-file hash comparison
against `upstream/lock.json`). This warrants that the artifact's content matches what was declared at
some prior point; it never warrants the declared content was itself safe or correct, only that
nothing has silently changed since. Honest ceiling: `checked`. Verification form: a hash recomputation
and comparison, reproducible by any party holding the artifact and the declared hash.

## Why claim 19 does not need any of this

`build/check-substrate.mjs` is exactly a cryptographic-artifact-identity check, and claim 19 ("all
inherited substrate code matches the lock") is grounded in this kernel by a checking record whose
`method_class` is `data-audit`, one of the four values the protocol itself fixes for checking records
(`replication`, `derivation-audit`, `data-audit`, `direct-measurement`), a wholly separate field from
`source_class`. Checking records carry no `source_id` at all; only claims and links do, and every
claim in this kernel cites the same `S-kg-spec-v2` source (`institutional-report`, honestly available
in the real menu, no placeholder needed), representing where the claim's text is drawn from, not the
evidence that grounds it. So no claim in this Stage 2 entry actually requires a placeholder or a local
source-class row. When a future claim needs to cite one of the five still-local classes as a claim or
link's own `source_id` (rather than purely through a checking record), the same placeholder-versus-
extension decision documented above will recur, and the default this repository will take, absent a
new operator decision, is upstream's own precedent: a documented placeholder from the real menu, not
a vendor edit.
