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
enters a public patch. **Checked.** `build/check-vault.mjs` (Phase A2) grounds claim-5 (`checked`,
SK-5 discharged): only `vault/vault.js` touches a storage API, and a fresh profile writes nothing
until exported. `build/check-profile-leak.mjs` (Phase B/C) grounds claim-4 (now also `checked`, SK-4
discharged): the bundle-building modules (`api/contribute.js`, `vendor/api/contribution.js`) import
nothing from `vault/` or `api/settings.js`, and a vault filled with canary values leaks none of them
into any bundle produced across a fuzz of draft inputs.

**G0-4. No hidden ranking objective.** Ranking never changes standing, grades, receipts, robustness,
or support structure. **Checked** by `build/check-ranking-separation.mjs` (Phase A2), fuzzing 25
random objective vectors per fixture and asserting the raw snapshot, every grade, every reconciliation,
and every gap stay byte-identical before and after, and statically verifying the ranker's own modules
import nothing that can write. Entered as claim-1, now computed `checked` from a distinct-party
checking record citing this check; SK-1 is discharged.

**G0-5. No undeclared network egress; no third-party analytics.** All release capabilities are
declared in `manifests/`. **Checked** by `build/check-egress.mjs` (Phase A1), which runs the data
layer under a stubbed fetch and asserts every requested URL is a declared destination. This grounds
both claim-7 (`checked`, SK-7 discharged) and claim-6 (now also `checked`, SK-6 discharged): the same
check, attached as claim-6's checking record in Phase A2, already proved no telemetry endpoint exists
beyond `manifests/network.json`'s declarations, which declare none; it had simply never been wired to
that claim until now.

**G0-6. Gate passage, admission, and semantic acceptance render as three distinct states.** No state
ever implies the next. **Checked** by `build/check-ladder.mjs` (Phase B/C): the contribution ladder
(`periphery/ladder.js`) carries exactly three distinct-labeled states, the forbidden words (true,
validated, verified, accepted) are absent from the first two states' renderings, and no lower state's
rendering contains a higher state's own label. Entered as claim-13, now computed `checked`; SK-13 is
discharged.

**G0-7. A passed gate receipt is never labeled true or validated.** **Checked** by the same
`build/check-ladder.mjs` run as G0-6: the forbidden-word scan covers exactly this half (true,
validated are among the four words asserted absent from the gate-passed and admitted states'
renderings). Claim-13's checking record covers it by extension, as this constraint's own entry has
always said it would.

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
**Checked, both halves.** The read half is `build/check-conformance-read.mjs` (Phase A1): an
independent minimal client built from `vendor/api/` alone reproduces the app's reads byte-identically
against the same fixture. The write half is `build/check-conformance-write.mjs` (Phase B/C): the same
independent minimal client's proposal admits through the identical path (`importContribution`, then a
fresh gate decision) as this app's own bundle for the equivalent proposal. Entered as claim-9, now
computed `checked` from both checking records; SK-9 is discharged.

**G0-12. Client-neutral artifacts.** Communities, snapshots, cards, and contribution targets this
app produces carry no reference to this app; admission judges bundles, never the client that
produced them. **Checked.** `build/check-neutrality.mjs` (Phase B/C) walks every artifact the
founding flow emitted for the founded EpiStack Competition Community and fails on any of this
deployment's own name-shaped strings, with one narrow, documented exemption (the community card's
`fetch_locations` and `contribution_target` fields, whose entire function is to name a real transport
location while this community lives in this repository, SK-21). `build/check-conformance-write.mjs`
grounds the admission half: neither an independent client's bundle nor this app's own names its
producing client anywhere in its shape. Entered as claim-10 (client-neutral artifacts) and claim-11
(admission judges bundles, never the client), both now computed `checked`; SK-10 and SK-11 are
discharged.

## Relationship to the design axioms

`trellis/design-axioms.md` is this trellis at the code tier: the same twelve constraints restated at
the grain of modules and imports, each naming the identical intended check. This document is their
parent, stating the whole governing constraint set at the grain of the repository.
