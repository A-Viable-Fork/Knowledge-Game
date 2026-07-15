---
Type: record
Purpose: The live obligations ledger. Every gap marker this repository's own code carries (governing-trellis A-9 / G0-9) is listed here one to one; a future check will fail on a marker with no entry here or an entry with no live marker, mirroring upstream's own linter rule 3.
Depends on: trellis/governing-trellis.md, trellis/design-axioms.md, kernel/governance/corpora/knowledge-game-data.js
Depended on by: nothing yet
---

# Sorry Ledger

Eighteen characterized gaps, one per unsupported governance claim entered at Stage 2
(`kernel/governance/corpora/knowledge-game-data.js`). Each claim entered bare, with no support and
no checking record, and the gate floors it at `asserted`, its honest computed grade, verified by
`build/check-knowledge-game.mjs`. Claim 19 is not listed here: it is grounded today by a real
checking record citing `build/check-substrate.mjs` and computes to `checked`. Phase A1 discharged
SK-7 and SK-8; Phase A2 discharged SK-1, SK-2, SK-3, SK-5, SK-6, and SK-15. Nine of the nineteen
claims (1, 2, 3, 5, 6, 7, 8, 15, 19) now compute `checked`; the rest remain `asserted`, open here.

## Format

| Sorry | Obligation | Status | Opened |
|---|---|---|---|

Each row names: a stable id (`SK-n`, distinct from upstream's own `G-*` and `SG-*` ids); the claim it
closes and its closing condition (the future check and the phase that builds it); status; and the
stage it opened in.

## Live obligations

| Sorry | Claim | Closing condition | Status | Opened |
|---|---|---|---|---|
| SK-1 | claim-1: ranking cannot modify canonical standing, grades, receipts, robustness, or support structure | ~~The no-grade-motion property test: perturb the ranking objective vector arbitrarily and assert every grade and certificate stays byte-identical. Phase A.~~ **Discharged** by `build/check-ranking-separation.mjs`, attached as a distinct-party checking record (Phase A2); claim-1 now computes `checked`. | Discharged | Stage 2, discharged Phase A2 |
| SK-2 | claim-2: the active ranking objective is always visible to the user | ~~An objective-visibility and null-objective-determinism test. Phase A.~~ **Discharged** by `build/check-objective.mjs`, attached as a distinct-party checking record (Phase A2); claim-2 now computes `checked`. | Discharged | Stage 2, discharged Phase A2 |
| SK-3 | claim-3: behavioral observation is opt-in and default off | ~~An opt-in-observation-default test, asserting no observation is collected unless explicitly enabled. Phase A.~~ **Discharged** by `build/check-vault.mjs`, attached as a distinct-party checking record (Phase A2); claim-3 now computes `checked`. | Discharged | Stage 2, discharged Phase A2 |
| SK-4 | claim-4: personal profile records cannot enter public contribution patches | A contribution-export field-provenance test: every field of an exported bundle traces to non-vault input. Phase A/B. | Open | Stage 2 |
| SK-5 | claim-5: profile data is local by default | ~~A vault-default-storage-location test, asserting no profile field is ever written anywhere but local storage absent explicit export. Phase A.~~ **Discharged** by `build/check-vault.mjs`, attached as a distinct-party checking record (Phase A2); claim-5 now computes `checked`. | Discharged | Stage 2, discharged Phase A2 |
| SK-6 | claim-6: no telemetry endpoint exists beyond the capability manifest's declarations, which declare none | ~~A network-request assertion under test cross-checked against `manifests/network.json`'s telemetry policy. Phase A.~~ **Discharged** by `build/check-egress.mjs`, attached as a second, distinct-party checking record (Phase A2); it already proved this, it was simply never wired to claim-6 until now. Claim-6 now computes `checked`. | Discharged | Stage 2, discharged Phase A2 |
| SK-7 | claim-7: no undeclared network egress exists | ~~A network-request assertion under test: no request succeeds to a destination outside `manifests/network.json`'s declared set. Phase A.~~ **Discharged** by `build/check-egress.mjs`, attached as a distinct-party checking record (Phase A1); claim-7 now computes `checked`. | Discharged | Stage 2, discharged Phase A1 |
| SK-8 | claim-8: the periphery imports no kernel or store module; the API is the sole membrane | ~~An import-graph oracle, mirroring upstream's `build/check-map.mjs`. Phase A.~~ **Discharged** by `build/check-imports.mjs`, attached as a distinct-party checking record (Phase A1); claim-8 now computes `checked`. | Discharged | Stage 2, discharged Phase A1 |
| SK-9 | claim-9: this client holds no capability any client with the snapshot lacks | Narrowed to the write half (Phase A1): the read half is discharged by `build/check-conformance-read.mjs` (an independent minimal client built from `vendor/api/` alone reproduces the app's reads byte-identically), but claim-9 itself stays `asserted`, since no checking record is attached to the claim yet and the write half (an independent client's exported bundle passing the same admission path) remains open. Closing condition: attach `check-conformance-read.mjs` as claim-9's checking record once the write half also lands, so the claim is regraded once both halves hold. Phase B. | Open, narrowed | Stage 2, narrowed Phase A1 |
| SK-10 | claim-10: artifacts produced by the founding flow are client-neutral | The neutrality check: grep every artifact the founding flow emits (kernel, snapshot, card, contribution-target scaffolding) for any reference to this app. Phase B. | Open | Stage 2 |
| SK-11 | claim-11: admission judges bundles, never the producing client | The second-client conformance check's write half: an independent minimal client's exported bundle passes the same admission path as one this app produced. Phase B. | Open | Stage 2 |
| SK-12 | claim-12: a citation cannot become an independent confirmation by being pasted | A copy-and-label audit over the citation/contribution authoring surface, asserting independence is an attested, attributable field, never inferred from a pasted URL. Phase B. | Open | Stage 2 |
| SK-13 | claim-13: gate passage, admission, and semantic acceptance render as three distinct states, and no rendering implies the next | A copy-and-label audit over every contribution-bearing surface. Phase A/B. | Open | Stage 2 |
| SK-14 | claim-14: a release's declared artifact hash matches the built artifact | A build-provenance verification comparing `manifests/build-provenance.json`'s declared `artifact_hash` against a fresh, reproducible build. Phase A. | Open | Stage 2 |
| SK-15 | claim-15: a client can switch providers without presentation changes | ~~A provider-swap snapshot test: the periphery renders identically under the local provider and the remote provider. Phase A.~~ **Discharged** by `build/check-provider-contract.mjs`, attached as a distinct-party checking record (Phase A2); claim-15 now computes `checked`. | Discharged | Stage 2, discharged Phase A2 |
| SK-16 | claim-16: the credential seam exists; identity thresholds are stored inactive and nothing evaluates them | A static assertion that the credential seam's local evaluator (`api/`) reads no identity-threshold field from any community's parameter record. Phase A/B. | Open | Stage 2 |
| SK-17 | claim-17: the patch-history seam exists; bundle identity is content-derived and nothing depends on durable history | A grep-style assertion that no local module persists a patch history keyed on anything other than the vendored `contributionId`. Phase A/B. | Open | Stage 2 |
| SK-18 | claim-18: the standing-economy seam exists; the reserved fields are read by nothing | A schema assertion that the reserved standing-economy parameter field is typed and read by zero call sites. Phase A/B. | Open | Stage 2 |

## A gap the substrate itself cannot close (from deliberate-break two)

| Sorry | Obligation | Closing condition | Status | Opened |
|---|---|---|---|---|
| SK-19 | `vendor/kernel/schema/tables.mjs`'s `makeSourceTable` validates only that a source's `source_class` is one of the six substrate-menu strings; it has no way to verify that the label is an honest description of the evidence it names. A source relabeled from `institutional-report` to `primary-measurement` (or any other real menu class) builds and passes with no error, confirmed by deliberate-break two in the Stage 1/2 report. | A source-class honesty review as a standing discipline (this repository's own read-before-merge practice), since no mechanical check can verify semantic honesty of a label the substrate itself does not define beyond its enum. Named here rather than silently trusted. Phase: unscheduled; revisit if a future check proposal can bound this mechanically. | Open | Stage 2 |

## A gap surfaced building the null order (Phase A1)

| Sorry | Obligation | Closing condition | Status | Opened |
|---|---|---|---|---|
| SK-20 | `api/feed.js`'s null-objective order names "recency" as its second sort key (spec Section 6), but the v3 claim record carries no timestamp field and no other content-derived temporal signal exists yet. An earlier draft approximated recency with each claim's position in the snapshot's raw `entries` array; this was rejected because it made the feed order depend on incidental serialization order rather than claim content, breaking the permutation invariance `build/check-feed-determinism.mjs` verifies. Recency is currently void: the order is grounding, then the identity-hash tiebreak, with nothing between them. | A real temporal or ledger-position signal to key recency on, most plausibly the append-only patch ledger (spec `[4.5]`, the patch-history seam) once it lands, since a ledger position is content-derived and permutation-invariant in a way raw array order is not. Phase: unscheduled; blocked on the patch-history seam's real implementation landing upstream. | Open | Phase A1 |
