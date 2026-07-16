---
Type: record
Purpose: The single source of build truth for this repository, dividing built from specified. Every other document cites status here rather than re-asserting it, mirroring the discipline upstream's own status-ledger.md holds itself to.
Depends on: docs/architectural-reading.md, trellis/governing-trellis.md, trellis/sorry-ledger.md
Depended on by: nothing yet
---

# Status Ledger

## The discipline

A maturity claim lives in exactly one place: here. If a build-status claim appears in another
document in this repository, it is wrong by construction; that document should point here instead.
Nothing is called built until a named check enforces it; nothing is called checked until the check
exists and passes.

## Built and verified

**The substrate pin and its integrity check.** `upstream/epistack` is pinned as a submodule at
`674e7b6220db50552c8e817f06c0f433def9c095` (provisional, re-pin obligation dated to the 2026-07-19
freeze). `build/vendor-extract.mjs` deterministically copies the minimal substrate into `vendor/`.
`build/check-substrate.mjs` verifies every vendored file's hash against `upstream/lock.json` and the
lock's commit against the submodule; it is green as of this commit, and its deliberate-break
transcript is recorded in the init report.

**The governance kernel, generated (Stage 1).** `kernel/governance/` carries a real kernel generated
through the unmodified vendored scaffolder (`vendor/scaffolder/new-kernel.mjs`), adopting the shared
`measurement` kind (ceiling `checked`) by its pinned hash and declaring one source. Its generated
check, evolved by hand as Stage 2 populated it (`build/check-knowledge-game.mjs`, following the exact
precedent upstream's own math kernel set for evolving a generated check across stages), is green.

**Nineteen governance claims, entered at their honest computed grade (Stage 2).** All nineteen claims
from spec Sections 2, 5, and 9 are entered through the real gate
(`kernel/governance/corpora/knowledge-game-data.js`). Claim 19 ("all inherited substrate code matches
the lock") carries a real checking record citing `build/check-substrate.mjs` and computes to
`checked`, the one claim this Stage 2 entry could honestly ground at the time. No grade above is
asserted by hand anywhere in this repository, including in this ledger: every grade above is read from
the real gate's own computed state, verified by `build/check-knowledge-game.mjs`.

**The vertical slice, Phase A1: the feed reader, its four checks, and two more claims grounded.**
`api/community.js` fetches a snapshot and refuses to load one whose recomputed hash does not match
its declared `snapshot_hash`; `api/feed.js` implements the null-objective order (grounding, then a
void recency term, then the identity-hash tiebreak: see the note below and SK-20).
`periphery/app.js` and `periphery/card.js` render the feed, Levels 1 and 2, over the two fixtures
emitted into `app/fixtures/` (this repository's own kernel, and upstream's math kernel, emitted with
`build/emit-fixtures.mjs`). Four checks are built and green: `build/check-imports.mjs` (the
import-graph oracle), `build/check-egress.mjs` (the egress assertion),
`build/check-conformance-read.mjs` (the second-client conformance check's read half), and
`build/check-feed-determinism.mjs` (order invariance across runs and record permutations). Claims 7
and 8 now carry real checking records citing `check-egress.mjs` and `check-imports.mjs` and compute
`checked`; SK-7 and SK-8 are discharged. Claim 9's gap is narrowed to the write half (Phase B); it
still computes `asserted`.

**Phase A, completed: objectives, the vault, and the shell (Phase A2).** `api/ranking.js` implements
the objective vector: eleven documented deterministic components, a weighted composition over
user-set weights, the null (all-zero) vector rendering exactly the null order, and an explainable
why-answer per card reproducible purely from its own stored contributions. `api/epistemic-cost.js`
recomputes the active feed under another community's parameters, using the real gate's own
`storeViewOf` with the untyped-grounds-nothing invariant honestly enforced (a documented departure
from the vendored kind-table's own looser default), reporting how many cards recompute, how many
recompute lower, and how many arrive untyped. `vault/vault.js` is the sole persistence module, behind
`api/settings.js`'s pass-through membrane; a fresh profile is off and empty by construction, off means
off (no sampling, no buffering, nothing collected), and export/delete-all round-trip exactly what it
holds. `periphery/objective-panel.js` and `periphery/vault-screen.js` render the weight sliders (with
inert rows dimmed and labeled) and the vault screen. `sw.js`, deliberately placed at the repository
root (not `app/`, since GitHub Pages gives no way to widen a service worker's scope after the fact),
precaches every file the app actually needs, verified against a fresh walk of the real import graph;
`periphery/app.js` renders visible sync state and an install affordance, and `app/manifest.webmanifest`
is complete. Five checks are built and green: `build/check-ranking-separation.mjs` (the no-grade-motion
theorem's next instance), `build/check-objective.mjs` (no hidden default, deterministic, explainable),
`build/check-vault.mjs` (the vault is the only persistence; off means off), `build/check-provider-contract.mjs`
(the periphery is provider-agnostic), and `build/check-offline-shell.mjs` (the precache list matches
the import graph). `build/check-imports.mjs` now also enforces a `vault` zone that imports nothing
outside itself, and permits `api` to reach it. Claims 1, 2, 3, 5, and 15 now carry real checking
records citing their respective new checks and compute `checked`; SK-1, SK-2, SK-3, SK-5, and SK-15
are discharged. Claim 6 now also carries `build/check-egress.mjs` as a second checking record (it
already proved this in Phase A1; it was simply never wired to claim 6 until now) and computes
`checked`; SK-6 is discharged. Claim 4 and claims 10 through 18 are unchanged, still bare and
`asserted`, each with its open characterized gap in `trellis/sorry-ledger.md`.

**A design correction surfaced building the null order.** An earlier draft approximated the null
order's "recency" term with each claim's position in the snapshot's raw `entries` array. This was
rejected once `build/check-feed-determinism.mjs`'s permutation test would have exposed it as
order-dependent on incidental serialization, not on claim content. Recency is now honestly void (SK-20):
the v3 claim record carries no timestamp field, so there is nothing to sort by between grouping and
the hash tiebreak, and the module says so rather than inventing a proxy that fails the invariance the
order itself promises.

**Phase B and C, completed: founding, contributing, and the first community.** `api/contribute.js`
surfaces the vendored gate (`decide`, `claimRecord`, `linkRecord`), `vendor/api/contest.js`,
`vendor/api/fork.js`, and `vendor/api/contribution.js` for the Level 3 contribution path: draft,
real gate decision with the receipt shown, bundle, export. A pasted citation always becomes a
testimony-class source carrying zero `checking_records`, structurally, so it can never become an
independent confirmation. `periphery/ladder.js` and `periphery/contribute-screen.js` render the
three-state ladder (gate-passed, admitted, semantically accepted) on every contribution surface.
`build/found-community.mjs` and `build/parameter-surface.mjs` implement the founding flow (frame,
type, free parameters read from `vendor/scaffolder/kernel-config.schema.json`'s own `x-tier`
annotations, generate through the real unmodified scaffolder, publish) and were exercised for real:
the **EpiStack Competition Community** is founded and published at `communities/epistack-competition/`
(the spec's own in-repo fallback, since this session's GitHub access is scoped to one repository;
the move-out obligation is ledgered, SK-21), self-contained (its own vendored kernel copy, corpus,
build/check, and `.github/workflows/`). It carries nineteen claims: twelve mechanical protocol
claims checked against the pinned reference implementation's own suite, six evaluative theses
(the submission's own arguments) entered bare at their honest floor, and one further claim admitted
through this app's own contribution path as the first real contribution (Step 4), all documented in
`communities/epistack-competition/contributions/`. Seven checks are built and green:
`build/check-conformance-write.mjs` (the write half of claim 9; grounds claim 11),
`build/check-neutrality.mjs` (claim 10, with one documented transport-hint exemption),
`build/check-profile-leak.mjs` (claim 4), `build/check-citation.mjs` (claim 12),
`build/check-ladder.mjs` (claim 13), `build/check-release.mjs` (claim 14, alongside
`build/compute-release-hash.mjs` which writes the declared hash), and `build/check-seams.mjs`
(claims 16, 17, 18). Claims 4, 9, 10, 11, 12, 13, 14, 16, 17, and 18 now carry real checking records
and compute `checked`; SK-4, SK-9, SK-10 through SK-14, and SK-16 through SK-18 are discharged.
**Stage 3's grounding is complete: all nineteen of this deployment's own governance claims now
compute `checked`.** The app's default community switched from the fixtures to the founded
competition community; the fixtures are demoted to secondary, still available from the switcher.

**Phase KG-4, completed: the re-pin, the view market, and claim 20.** Re-pinned upstream to `ce7ca28`
(the comment kind and identity presentation): the comment type bundle, two additive link kinds
(`comments-on`, `replies-to`), and `kernel/gate/comment-guard.mjs` (the never-citable-as-support rule)
are now vendored. `api/filter.js` and `periphery/filter-bar.js` implement the type filter, a
set-selector over the kinds present in the active graph plus `untyped`, stating its own exclusions,
composing with ranking by running first. `api/contribute.js` gains `draftComment` (the only path that
ever builds `comments-on`/`replies-to`, never `supports`) and `draftPromoteToClaim` (lifts a comment
into a new claim, linked back via `comments-on`); `draftProposal` now calls the vendored comment-guard
before `decide()`, since this app's write path does not route through `local-provider.mjs`'s own
guarded `propose()`. `periphery/card.js` renders comments gradeless and threaded at Level 2, filterable
like any kind. `api/extension.js`, `api/extension-sandbox.js`, and `periphery/extension-screen.js`
implement the extension seam: content-addressed modules in three shapes (ranker, renderer, workflow),
install-time conformance (a sandbox-fetch-denial probe plus, for a ranker, the ranking-separation
fuzz), and sandboxed execution (an isolated worker denying network; DOM access is structurally absent,
a worker has no `document`). Two demonstration extensions ship: the learn-efficiently ranker
(extracted from `api/ranking.js`'s built-in component) and the contestable dashboard (a renderer lens
over measurement-kind claims). `periphery/gate-feedback.js`'s `describeReceipt` renders every gate
decision as structure present, structure missing, and what would ground it, so a refusal never renders
the bare word "declined" alone. `periphery/onboarding-screen.js` implements first-run onboarding
(followed topics, then the three-state ladder and the grade-is-not-agreement point), activating the
learn-efficiently ranker as the default when at least one topic is entered. `api/alerts.js` and
`periphery/alerts-panel.js` implement standing-motion alerts: a watch action on any card persists its
last-seen grade, and each load diffs every watch against the fresh reading, reporting grade motion
only. `build/governance-hash.mjs` computes the community card's governance-hash (the one named hash
over the canonical parameter record: pinned type hashes, identity thresholds, standing-economy fields,
the null-objective order), `kernel_id` demoted to a label over it; the founded competition community's
card carries both `governance_hash` and `member_set_commitment` (null, no member set published yet),
its snapshot otherwise unchanged, now also adopting the `comment` kind. Five checks are built and
green: `build/check-filter.mjs`, `build/check-discussion.mjs`, `build/check-extension-seam.mjs`,
`build/check-gate-feedback.mjs`, and `build/check-card-hashes.mjs`. **Claim 20** ("an installed
extension cannot modify canonical standing, and cannot execute outside its sandbox") is the first
governance claim entered through this app's own contribution path (`api/contribute.js`'s
`draftProposal`) rather than hand-authored directly into the data file: drafted, decided, bundled, and
exported (`kernel/governance/contributions/0001-the-extension-seam.json`), then admitted at its honest
floor and grounded, once `build/check-extension-seam.mjs` existed, with a real checking record. All
twenty of this deployment's own governance claims now compute `checked`.

**Phase KG-5, completed: embed, invite, release.** Closes the workflow track. Stage 4: a load-bearing
`// Governs: claim-N` comment, naming the claim and one binding sentence, lands in the ranker and
objective components, the vault, the draft builder and bundle serializer, the egress-bearing data
layer and the api membrane, the conformance clients' fixtures, the founding flow, the ladder
renderer, the release manifest, the three seam interfaces, the substrate check, and the extension
loader and sandbox, all 20 claims covered across 23 references in 10 files. `build/check-
references.mjs` verifies every reference resolves and every claim is covered, and regenerates
`docs/blast-radius.md` from the same parse, failing on a stale committed copy. `build/check-
parameter-surface.mjs` closes the spec's remaining parameter-surface deliverable: the founding
flow's editable set (`kernel_id`, `local_kinds`, `sources`, `time_lock`) matches
`vendor/scaffolder/kernel-config.schema.json`'s own free tier exactly, with `adopted_type_hashes`
present but fixed for composition, its real enforcement (`hashTypeBundle`, `makeSourceTable`'s
closed source-class menu) never bypassed. Stage 5: `docs/invitation.md` states what exists, what is
open and whose it is, and how to arrive at each role (reader, contributor, client author, founder,
extension author), claiming no community into existence and counting the competition community's
engagement only as the graph shows it (19 claims and one corroborating link, all from this
deployment's own founding contributor identities, no independent third party yet). The conditional
move-out (SK-21) was checked again this phase: no sibling repository exists in this session's scope,
so no artifacts moved and SK-21 stays open. The release: `manifests/capability.json` carries a
`release_version` of `stage-5`, naming the stage record rather than an arbitrary number;
`docs/status-report.md` carries spec Section 11's five-way division (20 built-and-checked, 1
built-but-manually-governed, 3 bounded follow-up, 5 plural community-policy choices, 4 open
research items) and the seams table; `docs/screenshots/` carries mobile and desktop captures of the
deployed feed. `trellis/stage-manifest.json` gains `stage-4` and `stage-5` entries at their real
commits, and `build/check-stages.mjs` verifies all six stages in true ancestry order. This repository
is now complete against `knowledge-game-spec-v2.md` except the freeze re-pin, due 2026-07-19, which
remains its own standing obligation and is not claimed here.

**Phase KG-6, completed: the market layer's absorption.** `docs/specification.md` places
`knowledge-game-spec-v2.md` verbatim, this repository's own governing document, now current through
the market-layer conversation (the license field in the community card, attribution capture named as
a bounded follow-up, the sandbox rescoped as this deployment's own Tier 0 financial-sterility choice,
anonymity scoped to the graph). Two new sorry-ledger entries characterize what the conversation
spec'd but did not build: SK-23, the license picker (the founding flow's parameter step has no
picker yet, because the vendored `kernel-config.schema.json` carries no license property; closing is
detected automatically, `build/check-parameter-surface.mjs` fails on the register delta the day
upstream adds it), and SK-24, attribution capture (the draft path records no typed attribution
target for a source-derived draft, so a community's market-layer royalty machinery would have
nothing structural to route a distribution toward). Both reflected in `docs/status-report.md`'s
bounded-follow-up division, now 5 items. `build/governance-hash.mjs`'s canonical parameter record
gains `corpus_content_license` (absent hashes as the honest null `"unspecified"`, never omitted);
the EpiStack Competition Community declares `attribution-required` in its own
`founding-config.json`, amendable at the freeze pass, and its re-emitted card's governance-hash
moves from `c1408ea4ba3560e58226a66014588f133cd3ec1d38fc7d05969809fd0ce230f2` to
`93c2984eee758282bd4c645df95fb331186f6483b31e10d096e5ba000131fd79`, its snapshot hash unchanged,
`build/check-card-hashes.mjs` confirming the reproduction and a new deliberate-break case (declaring
a license moves the hash).

**Phase KG-6a, completed: the Android wrapper.** Wraps this same deployment in a Trusted Web
Activity, never a second copy. The repository-root `index.html` redirects immediately to `app/`,
closing the live Pages root's previously Jekyll-rendered README. `app/manifest.webmanifest` gains
real PNG icon files at 192 and 512 (`build/generate-icons.mjs`, a deterministic Playwright
rasterizer over the mark's existing SVG), since Bubblewrap's icon fetcher rejects the manifest's
earlier data-URI icons outright; `build/shell-files.mjs` and `sw.js`'s precache list extend to cover
them. `standalone` display, `portrait` orientation, and theme and background colors matching the
mark complete the manifest polish. `android/generate-project.mjs` builds the TWA's Gradle project
through `@bubblewrap/core`'s library API directly, never the CLI's interactive prompts, so the same
inputs run unattended in CI; it always fetches the live deployed manifest, never a local copy, so
the wrapped `host` and `startUrl` are always the real origin. Package id
`com.aviablefork.knowledgegame`, signed with a committed TEST ONLY keystore
(`android/test-keystore/`, its password documented beside it in capital letters, a deliberate
low-stakes sideload-test key). `android/assetlinks.json` states the Digital Asset Links proof twice:
committed here for reference, and reported verbatim for the operator to place at the org-site
repository's `.well-known/assetlinks.json`, the one remaining step to remove the in-app URL bar.
`.github/workflows/android-release.yml` builds and signs the APK on a real GitHub Actions runner and
attaches it to a GitHub release; this development session's own network egress does not reach the
Android SDK, the Gradle distribution, or the Pages host itself, confirmed directly rather than
assumed and documented in `android/README.md`, so the runner is where the real build happens, not
this session. `manifests/capability.json` records that the wrapper adds no new runtime destination.
Three obligations follow this phase and are ledgered rather than built, not silently deferred: SK-25
(production signing) and SK-26 (Play Store publishing), both operator actions outside this
repository's engineering scope, and SK-27 (push notifications), a deferred egress decision, not yet
chosen. `docs/status-report.md`'s bounded-follow-up division gains all three, now 8 items.

## Specified, not built

Everything else in this repository is specified and not yet built, named here so the scope is
legible rather than discovered piecemeal:

- **The governance kernel, Stage 4 and 5.** Embedding code-to-claim references (Stage 4) and the
  invitation (Stage 5) have not started. Stage 3's grounding itself is complete: every one of the
  nineteen claims now computes `checked`.
- **The credential and standing-economy seams' real evaluators.** Claims 16 and 18 ground the
  existence of the seam and the reservation of its fields, not an active evaluator: the credential
  seam's vendored stub (`vendor/api/credential.js`) and the standing-economy configuration remain
  exactly what upstream specifies and nothing more, per the register's own discipline (free by
  default, evaluated only once the seam's real implementation lands upstream).
- **The patch-history seam's durable form.** Claim 17 grounds that bundle identity is content-derived
  and nothing depends on durable history today; the append-only patch ledger itself (spec `[4.5]`)
  remains upstream's own specified, not-yet-built surface (`vendor/kernel/store/patch-ledger.js` is
  still a stub).
- **A standalone sibling repository for the founded community.** The EpiStack Competition Community
  lives in this repository (the spec's own fallback); moving it out is ledgered (SK-21), blocked on
  repository-creation scope this session does not have.
- **Every check still named "intended" in `trellis/governing-trellis.md` and `trellis/design-axioms.md`.**
  Of the twelve Tier 0 constraints: G0-8 (substrate integrity), G0-1 (trust boundary), G0-3 (public and
  private data structurally separate, now fully, both claim-4's and claim-5's halves), G0-4
  (no hidden ranking objective), G0-5 (egress, both halves), and G0-11 (unprivileged client, now fully,
  both the read and write halves) are fully checked. The remaining constraints are still
  prose-specified.
- **The manifests' enforcement.** `manifests/network.json` is enforced by `check-egress.mjs`.
  `manifests/build-provenance.json` is now enforced by `build/check-release.mjs` (written by
  `build/compute-release-hash.mjs`). `manifests/capability.json`'s permissions and profile-upload
  fields still have no enforcing code (nothing in this deployment reads them yet, per the file's own
  declared-empty note); it now also names the founded community's Pages URL as a declared destination.

## A known, unmechanizable gap

Deliberate-break two (Stage 1/2 report) confirmed that `vendor/kernel/schema/tables.mjs` validates
only that a source's `source_class` is one of the six substrate-menu strings; it cannot verify the
label honestly describes the evidence it names. Relabeling this kernel's one source from
`institutional-report` to `primary-measurement` builds and passes with no error. This is recorded as
SK-19 in `trellis/sorry-ledger.md`, not silently trusted: type honesty for source classes is a review
discipline this repository holds itself to, not a property any check currently enforces.

## Discipline note

The unit of progress is the named component and the named check. A line in this ledger moves only
on the same commit that builds the thing it grades, exactly the discipline upstream holds itself to
in its own status ledger's G1-2 (a discipline this repository's own governing trellis does not yet
mechanize either, and does not claim to).
