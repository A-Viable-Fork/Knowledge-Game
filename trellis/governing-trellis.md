---
Type: reference
Purpose: This repository's governing trellis: the Tier 0 constraint set from spec Section 2 (knowledge-game-spec-v2.md), each carrying its real enforcement status. Opened honest on day one, per the init prompt's discipline: nothing is called checked until a named check exists.
Depends on: docs/architectural-reading.md, kernel/governance/stage-0.md, trellis/design-axioms.md
Depended on by: nothing yet
---

# The Governing Trellis

The repository's own accounting, the workflow track's Stage 0 framing made mechanical wherever a
check exists. Every constraint below is one of the Tier 0 architecture invariants from spec Section
2 (the deployment specification), stated at the grain of the whole repository. `design-axioms.md`
restates each as a code-tier obligation (modules, imports) and names the same intended check; this
document is their parent.

## Enforcement statuses

- **Checked.** Mechanically enforced today by a named script in `build/`.
- **Prose-specified.** A real governing constraint, held by discipline, with its intended check
  named and not yet built.

No constraint below reads as checked without a check path actually existing; the deliberate-break
transcript for the one constraint that is checked is recorded in the init report, not here.

## Tier 0: non-negotiable

**G0-1. One trust boundary, one direction.** `periphery/` reaches the kernel only through `api/`;
`api/` is the sole membrane; the vendored kernel (`vendor/kernel/`) stays pure and headless and
imports nothing outside itself. **Checked** by `build/check-imports.mjs` (Phase A1), the import-graph
oracle, statically parsing every import in `periphery/`, `api/`, and `kernel/governance/`. Entered as
claim-8 (`kernel/governance/corpora/knowledge-game-data.js`), now computed `checked` from a
distinct-party checking record citing this check; SK-8 (`trellis/sorry-ledger.md`) is discharged.

**G0-2. One canonical schema source.** The pinned upstream `vendor/kernel/schema/` is the only
claim and link shape; no parallel schema is ever invented locally. **Prose-specified.** Intended
check: a grep-style assertion that no local module defines a claim or link shape outside the
vendored schema, to land alongside the first local module that touches a claim shape (Phase A).

**G0-3. Public and private data are structurally separate.** Personal data held in `vault/` never
enters a public patch. **Prose-specified.** Intended check: a contribution-export field-provenance
test asserting every field of an exported bundle traces to non-vault input, to land with Phase A/B's
contribution path. Entered as claim-4 and claim-5, both computed `asserted`, closing conditions SK-4
and SK-5.

**G0-4. No hidden ranking objective.** Ranking never changes standing, grades, receipts, robustness,
or support structure. **Prose-specified.** Intended check: the no-grade-motion property test
(perturb the ranking objective vector arbitrarily; every grade and certificate byte-identical),
mirroring upstream's own third instance of this theorem, to land with Phase A's ranking module.
Entered as claim-1, computed `asserted`, closing condition SK-1.

**G0-5. No undeclared network egress; no third-party analytics.** All release capabilities are
declared in `manifests/`. **Prose-specified, half grounded.** `build/check-egress.mjs` (Phase A1)
runs the data layer under a stubbed fetch and asserts every requested URL is a declared destination;
this grounds claim-7 (now `checked`, SK-7 discharged) but not claim-6 (still `asserted`, SK-6 open:
the telemetry-specific half of this constraint has no dedicated check yet, since no telemetry code
exists to assert the absence of). The constraint as a whole stays prose-specified until claim-6 also
grounds.

**G0-6. Gate passage, admission, and semantic acceptance render as three distinct states.** No state
ever implies the next. **Prose-specified.** Intended check: a copy-and-label audit over every
contribution-bearing surface, to land with Phase B's contribution flow. Entered as claim-13, computed
`asserted`, closing condition SK-13.

**G0-7. A passed gate receipt is never labeled true or validated.** **Prose-specified.** Intended
check: the same copy-and-label audit as G0-6, scoped to receipt rendering, to land with Phase A/B. No
claim in the Stage 2 entry separately restates this half; claim-13's closing condition (SK-13) covers
it by extension, named here rather than left to assumption.

**G0-8. All inherited substrate code is pinned, hashed, and attributable; local departures are
explicit patches with named checks.** **Checked** by `build/check-substrate.mjs`, verifying every
vendored file's hash against `upstream/lock.json` and the lock's commit against the
`upstream/epistack` submodule. This is the one constraint Step 3 made mechanical; the deliberate-break
transcript is in the init report. Entered as claim-19, the one claim this kernel grounds today: it
carries a real checking record citing `build/check-substrate.mjs` and computes to `checked`, not
`asserted`, verified by `build/check-knowledge-game.mjs`.

**G0-9. Gaps are ledgered, never hidden.** **Prose-specified.** Intended check: a sorry-ledger
cross-reference check mirroring upstream's linter rule 3 (every gap marker appears in
`trellis/sorry-ledger.md` and every ledger entry has a live marker), to land when the first gap is
entered (Phase A).

**G0-10. No tokens, no cryptocurrency, no financial incentives, no personal data on any public
ledger.** **Prose-specified.** Intended check: a schema and manifest grep asserting no financial
instrument field exists anywhere in this deployment's local schema or manifests, to land with Phase
A.

**G0-11. This client is unprivileged.** It holds no capability any client with the snapshot lacks.
**Prose-specified, read half checked.** The read half is `build/check-conformance-read.mjs` (Phase
A1): an independent minimal client built from `vendor/api/` alone reproduces the app's reads
byte-identically against the same fixture. The write half (an independent client's exported bundle
passing the same admission path) lands with Phase B. Entered as claim-9, still computed `asserted`
(no checking record is attached to the claim itself yet, since the read half alone does not ground
the whole claim); SK-9 is narrowed to the write half, not discharged.

**G0-12. Client-neutral artifacts.** Communities, snapshots, cards, and contribution targets this
app produces carry no reference to this app; admission judges bundles, never the client that
produced them. **Prose-specified.** Intended check: the neutrality check (grep every artifact the
founding flow emits, kernel, snapshot, card, contribution-target scaffolding, and fail on any
reference to this app), to land with Phase B's publish step. Entered as claim-10 (client-neutral
artifacts) and claim-11 (admission judges bundles, never the client), both computed `asserted`,
closing conditions SK-10 and SK-11.

## Relationship to the design axioms

`trellis/design-axioms.md` is this trellis at the code tier: the same twelve constraints restated at
the grain of modules and imports, each naming the identical intended check. This document is their
parent, stating the whole governing constraint set at the grain of the repository.
