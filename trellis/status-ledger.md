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

**Phase KG-6b, completed: offline, the outbox, and the virtual layer.** Makes offline this
deployment's honestly-stated default state and online a pair of transport verbs a reader chooses,
never an ambient assumption. Download pins: `vault/vault.js` gains `getPins`/`setPin`/`removePin`
(which communities are pinned, at what snapshot hash, when); `api/pins.js`'s `pinCommunity` locks the
already-verified, already-fetched snapshot response into Cache Storage (`kg-pins-v1`), opening no
network destination `manifests/network.json` does not already declare. `sw.js`'s existing fetch
handler already serves any open cache by default, so a pinned community is served offline with no
handler change; its `activate` cleanup now names `PINS_CACHE_NAME` alongside `CACHE_NAME` so a worker
update never deletes a reader's pins as an unrecognized cache, and `build/check-offline-shell.mjs`
cross-checks the two files' cache-name literals so they cannot silently drift apart. The card
ontology completes into a triad in `periphery/card.js`: actual claims (graded, solid), comments
(gradeless discussion, Phase KG-4), and virtuals (ghosted potentials, this phase), the last carrying
its own three-state vocabulary (`periphery/virtual-states.js`: drafted, gate-passed, submitted) never
appended to `periphery/ladder.js`'s own STATES. The outbox (`api/outbox.js`): a gate-passed bundle
queues locally with its own snapshot hash and citation-source record
(`api/contribute.js`'s draft* functions now also return `extraSources`); `pushOutbox` re-gates every
queued entry against a freshly fetched snapshot before it may submit, rebuilding the real records via
`vendor/api/contribution.js`'s `importContribution` (itself refusing a tampered bundle outright) and
rerunning the real gate, never trusting the bundle's own stored receipt; a pass moves the entry to
submitted with a fresh receipt, a fail demotes it to draft carrying that receipt's own feedback
(`periphery/gate-feedback.js`'s `describeReceipt`, reused rather than re-implemented); `sweepAdmitted`
removes a submitted entry once its proposed identity reads as a real row, scoped per community so one
community's fresh rows never sweep another's queue. This deployment's contribution transport has
never been a live network POST (the existing bundle-plus-pull-request handoff), so the outbox's own
"push" is honestly scoped as batched re-validation and re-export, opening no new egress destination
either. The virtual lens (`api/virtual.js`'s `computeLensImpact`): a counterfactual standing-impact
reading computed by applying the outbox's own proposals onto a state COPY
(`vendor/kernel/store/apply.mjs`, itself pure) and rereading it through the real grounding
(`vendor/api/providers/local-provider.mjs`'s `createLocalProvider`, never a second grounding
implementation), off by default, always labeled with the snapshot age it was computed against, never
touching the community's own live state. Sync policy: `vault/vault.js` gains
`getSyncPolicy`/`setSyncPolicy` (manual, wifi-only, or automatic; absence is manual, the most
conservative reading) and `getLastSynced`/`setLastSynced`; `api/sync.js`'s `shouldSync` is the one
decision point every network-gated call in the periphery is routed through, sync-now always an
escape hatch regardless of policy. Three new checks: `build/check-virtual-isolation.mjs` fuzzes
outbox and lens states over a real fixture and proves the mirror's own read() output and state stay
byte-identical throughout, and that no virtual record's identity or statement ever enters the
mirror's serialized state; `build/check-outbox.mjs` proves a real round trip (queue, re-gate, submit),
a genuine stale-re-gate demotion (a support link whose target leaves the graph in a freshly re-hashed
snapshot), a real admission sweep (caught a real bug this same check surfaced: `regateOne` was not
setting `receipt.proposed_identity` on the fresh receipt, meaning an admitted contribution would never
have left the outbox in practice; fixed in the same commit), and tamper refusal; `build/check-sync-
policy.mjs` proves every (policy, trigger, wifi-reading) combination makes a network call if and only
if `shouldSync` authorizes it. `manifests/capability.json` records that this phase adds no new runtime
destination beyond what `manifests/network.json` already declares.

**Phase KG-7, completed: the interface pass.** The feed takes the screen back. Navigation
restructures to a bottom nav (Feed, Communities, Compose, Menu) plus a slim, self-hiding top bar; the
objective vector editor, the filter page, alerts, vault, outbox, extensions, and the dashboard are
each their own page reached from Menu, never inline above the feed. Measured on a 390x844 mobile
viewport: the resting chrome shrinks from 501px (60% of the viewport, the old always-visible
objective panel, filter bar, alerts panel, and community switcher stacked above the feed, 0 cards
visible at rest) to a 58px slim bar plus a 45px bottom nav (12% together), 2 cards visible at rest
immediately; screenshots in `docs/screenshots/kg7-before-resting-feed.png` and
`kg7-after-resting-feed.png`. **Claim 2's own grounding changes here, not silently.** OLD: "the
active ranking objective is always visible" was satisfied by the full vector panel rendering
continuously above the feed. NEW: satisfied by a compact, persistent chip
(`api/ranking.js`'s `objectiveChipLabel`) in the slim bar, naming the active objective (or "Null
order" at the zero vector), one tap from the full vector page; `build/check-objective.mjs` now
asserts the chip is never empty across the zero vector and every single- and all-component vector,
replacing its earlier silence on the rendering surface entirely. The filter discipline's own
indicator follows the same pattern but stays claim-2-adjacent, not claim 2 itself: a chip appears
only when a filter is actually active (`api/filter.js`'s `filterChipLabel`, `null` at rest), stating
the honest hidden count; `build/check-filter.mjs` asserts both the absence at rest and the honest
count when active. The card ontology's Level 1 trims to statement, kind badge, grade mark, and
origin; why-am-I-seeing-this moves behind the one tap into Level 2, its content unchanged, and the
virtual/comment/actual triad's own treatments carry through untouched. Deliberate-break coverage:
removing the objective chip from the resting layout (returning empty unconditionally) failed
`check-objective.mjs` on 14 of its own assertions; removing the filter chip with a filter active
(returning `null` unconditionally) failed `check-filter.mjs` on 9; both reverted, green.

**Phase KG-8, completed: skins and the mark.** A skin is a token set under a contract, never
structure. `api/skins.js` is the pure registry: `TOKEN_ROLES` (every custom-property name a skin
must declare, including the seven `GRADE_ROLES` in ladder order), `SKINS` (each a `{light, dark}`
pair, each variant carrying its own `gradeDirection`), `resolveVariant`/`tokensFor`. Step 1 extracted
this app's own already-shipped look as skin one, named honestly ("Ledger", never "default"), token
for token, into `app/style.css`'s existing `:root` block and its dark-mode media query, landing alone
in its own commit; pixel diffs of the resting feed and a full card (`git archive` snapshot served on
a separate port, `PIL.ImageChops.difference`) confirmed zero visual change,
`docs/screenshots/kg8-step1-token-extraction-{resting,card}.png`. Step 2:
`periphery/skin-apply.js` (the one place a skin touches the DOM, setting `TOKEN_ROLES` as CSS custom
properties on `document.documentElement` and following `prefers-color-scheme` within whichever skin
is active) and `periphery/skin-picker.js` (a live swatch row reading each candidate skin's own real
token values, no separate description of them) on the vault screen, vault-persisted
(`vault/vault.js`'s `getSkin`/`setSkin`), instant apply, verified live via Playwright toggling
`colorScheme` under both skins. Step 3: the Trellis skin, its palette sampled directly from the
operator-provided grapevine-monogram logo (warm cream, sage and olive greens, a muted plum accent;
every hex value traced to a real pixel sample, not invented) via Python/PIL histogram and
hue-clustering analysis of the source PNG. Its grade scale runs cream through sage and olive to deep
green, into muted plum at the peak, in the light variant (`gradeDirection: "decreasing"`,
matching Ledger's own direction); the dark variant re-anchors bright-side up, muted olive to
luminous plum (`gradeDirection: "increasing"`), so the peak grade stays the brightest thing in the
room rather than the darkest. Organic register: rounder radii (20px against Ledger's 14px), airier
card padding, identical typography. Step 4: the mark. The grapevine monogram replaces KG-6a's
placeholder ring-and-dot icon set (`app/icons/icon-{any,maskable}-{192,512}.png`, regenerated from
the real logo: a 70px inset crop excludes the source's rounded-corner masking, "any" a direct resize
of the interior, "maskable" the same interior scaled to 68% and centered on a fresh cream canvas for
genuine safe-zone padding), the favicon, and a slim, header-left `.app-mark` in `app/index.html`'s
own header row. `app/manifest.webmanifest`'s `background_color`/`theme_color` now follow Trellis
(`#faf2e7`/`#5a3c46`), the skin the mark was built around; `vault/vault.js`'s `getSkin()` default
flips from "ledger" to "trellis" to match, Ledger staying one tap away on the vault screen's own
picker. `android/README.md` notes the wrapper always regenerates its icon set fresh from the live
manifest, so this change needed no edit there beyond the note itself. Step 5:
`build/check-skins.mjs` verifies, for every registered skin and variant: token completeness against
`TOKEN_ROLES`; grade-scale monotonicity along the variant's own declared `gradeDirection`, computed
in CIE L* with a documented 1.0-unit epsilon (honestly absorbing Ledger's own real, pre-existing,
imperceptible micro-reversal at corroborated-to-checked, ΔL*≈+0.28, which Step 1's zero-visual-change
constraint forbids silently repainting); contrast thresholds for every text-on-surface pairing (ink
vs card-bg ≥4.5:1, ink-muted vs card-bg ≥3.0:1, each grade role vs card-bg ≥1.3:1, the decorative-dot
floor since the grade word always carries the distinction, on-accent vs focus ≥2.0:1, honestly
accommodating Ledger-dark's own real 2.49:1 pre-existing value); and two structural assertions that
the textual grade word (`periphery/card.js`'s `GRADE_WORDS`) and the actual/comment/virtual triad's
distinguishing classes (`badge-grade`, `badge-discussion`, `card-virtual`/`badge-virtual`,
`data-comment`) live in `card.js`'s and `style.css`'s own selectors, never behind a skin-keyed rule
(`app/style.css` carries zero `data-skin` selectors; a skin only ever swaps `:root` custom-property
values), so no skin can erase color-alone-forbidden or triad distinctness.

**android-test-3, completed: the wrapper rebuilt against the KG-8 shell.** The Android TWA wrapper
regenerates and rebuilds at `appVersionCode` 3, `appVersionName` 0.3.0-test, against the KG-8 shell
(the grapevine mark, the maskable icon set, theme color `#5a3c46`, background `#faf2e7`);
`assetlinks.json` is unchanged (same signing key, same certificate fingerprint), so the operator's
origin-root file, if already placed, stays valid.

**Phase KG-9, completed: assistant extensions and the publish walkthrough.** Two pre-launch features.
First, the seam change: `docs/specification.md`'s extension-seam section is amended, network access
becoming capability-scoped rather than blanket-denied. `api/extension-sandbox.js`'s fetch now denies
everything by default (unchanged for a candidate declaring no destinations) but, for a candidate
declaring exact destinations, allows exactly those and refuses everything else by name before any
real network attempt, enforced in the sandbox itself, never merely trusted of the candidate.
`api/extension.js`'s `validateDestinations` refuses a wildcard or non-absolute-URL declaration at
conformance time, before the candidate ever runs; `checkConformance`/`runRanker`/`runRenderer` thread
the declaration through, and a new `runWorkflow` serves the workflow shape. The install form
(`periphery/extension-screen.js`) renders every declared destination by name and requires an explicit
consent checkbox before enabling install; a blank declaration installs immediately, fully offline, as
before. The wallet exclusion becomes a stated registry policy of this deployment (this app's own
registry carries no financial extensions) rather than a structural impossibility, named explicitly
per the amended spec's own discipline. Second, the first assistant extension (`api/assistant.js`,
workflow-shaped): its prompt pack is assembled entirely from this deployment's own real vocabulary
(`vendor/kernel/schema/confidence.mjs`'s grade lattice, the active community's own kind table, a
register note restating the ladder and citation discipline already rendered elsewhere), never an
invented one. Two tasks: formalize (informal text, an optional existing claim as context, in ->
statement/kind/candidate-support-shape out, feeding `periphery/contribute-screen.js`'s own draft
screen unchanged through a new `ctx.prefill` field, visually attributed "drafted with assistant help"
and never a field on the claim record itself) and explain (an existing claim's own support-chain
slice, read locally with no network, in -> a plain-text answer out). Provider-agnostic: the endpoint
and model are both user-configured vault fields (`vault/vault.js`'s `getApiKey`/`setApiKey`,
`getAssistantEndpoint`/`setAssistantEndpoint`, same off-by-absence discipline as everything else
there), verified end to end against a real local server implementing the OpenAI-compatible
chat-completions shape (`POST /v1/chat/completions` -> `choices[0].message.content`). The key is read
only at call time and passed transiently into the sandbox, never persisted by the extension itself,
never shipped in any manifest; `build/check-profile-leak.mjs`'s canary fuzz now extends to it.
Offline or unconfigured, `periphery/assistant-screen.js` renders a plain inert notice and attempts no
call. Third, the publish walkthrough (`build/found-community.mjs`'s `emitPublishWalkthrough`): after
publish, the emitted tree is staged into one downloadable bundle and a checklist
(`PUBLISH-WALKTHROUGH.md`) names what to create (the repository, its one Pages settings flip), what
to upload (the bundle, the exact tar/git commands), and what to verify (the snapshot URL serving, the
card's own `fetch_locations` resolving to the identical URL, one gate-check Actions run), each a
checkbox naming the exact link or command, ending with the card ready to share; no credential is ever
requested and nothing here touches GitHub automatically. Verified end to end against a scratch
community: the staged bundle extracted and passed its own `check.mjs` standalone, exactly what the
real Actions workflow runs. Two new/updated checks: `build/check-extension-seam.mjs` gains the
capability-scoped egress contract (a candidate with no declared destinations reaches nothing even
against a real reachable server; one with declared destinations reaches exactly those, proven against
a real server, both the allowed and the refused call; a malformed declaration is refused before the
candidate ever runs; both demo extensions still declare none and still pass; install renders
destinations and requires consent); `build/check-assistant.mjs` (new) proves the assistant's own one
declared destination, its real-server egress, its offline honesty, and that its output cannot reach
any store except through the ordinary draft path, structurally and by a runtime fuzz over
adversarial, bundle-shaped input. Claim 20's own checking record is amended to describe the new
contract and gains a second, independent record naming `build/check-assistant.mjs` as its own worked
example; rebuilt through the real gate, the claim's content-derived identity is unchanged and its
earned grade still recomputes checked. Deliberate-break coverage: forcing `ASSISTANT_SOURCE` to fetch
a hardcoded destination outside its declared list failed `check-assistant.mjs` naming the exact
undeclared URL; planting a key canary and routing it through `bundleProposal` failed
`check-profile-leak.mjs` on both its static import-graph scan and its runtime fuzz; wiring the
formalize task's own result directly into `queueBundle`, bypassing the draft screen, failed
`check-assistant.mjs`'s import-graph and direct-call assertions; all three reverted, green.

**Phase KG-10, completed: the kernel designer.** Re-pinned upstream to current main (`b97c2ad`,
bringing #120's corpus-content-license register amendment into scope); none of the 52 vendored files
changed, confirmed before and after the bump. The founding flow's type and parameter steps become an
in-app kernel designer (`periphery/kernel-designer-screen.js`, its computation core `api/kernel-
designer.js`): three adopt-then-modify presets (open commons, gift-licensed and permissive; attested
evidence, attribution-required with identity thresholds for contest and vouch, inactive; stake-gated,
share-alike with thresholds and stake fields across every action, all inactive); a kind designer
authoring or forking type bundles with plain-language guidance for every lattice grade and source
class, each authored kind hashing live through the real vendored type-hash primitive; a live preview
recomputing a bundled sample corpus's real earned grades through the identical vendored provider/
client-api path (never a hand-illustrated grade), including a deliberate crossing-arrival claim that
floors at `asserted` until a matching local kind is authored or adopted, demonstrated interactively;
a license picker (five named terms, one guidance sentence each, enforcement stated as legal-and-
normative) closing SK-23, discharged in `trellis/sorry-ledger.md` with a correction to its own
premise (the vendored scaffolder schema never gained the field and was never going to; the field
lives outside `scaffoldConfig` exactly like `identity_thresholds` and `standing_economy`, so `build/
check-parameter-surface.mjs`'s free-tier list is unchanged); a finish screen showing the completed
parameter record's governance-hash, downloading the founding config for the founder to hand off to
the existing, unmodified CLI generate/publish/walkthrough, unchanged. `api/governance-hash.js` and
`api/parameter-surface.js` are new: the governance-hash and parameter-surface classification logic
moved out of `build/` (which now re-exports both) so the in-app designer and the CLI founding flow
share one implementation, never two that could drift. New check: `build/check-designer.mjs` proves
every preset round-trips through the real, unmodified vendored scaffolder; the live preview is
deterministic across independent calls and over a fuzzed set of draft kind tables, including the
crossing arrival's real floor-then-unfloor behavior; the designer screen computes no grade of its own
(no import of any grade-deriving kernel module, every displayed grade traced to `recomputeSample
Preview`'s own return value); inactive fields serialize into the downloadable config and are read by
nothing that evaluates them (`build/check-seams.mjs`'s existing static scan now passes cleanly
against the designer screen too, since its property reads on `identity_thresholds`/`standing_economy`
are destructured into local bindings first, the same pattern `api/governance-hash.js` already uses,
rather than excluded by filename); and every guidance string covers the real vocabulary it claims to
explain (every lattice grade, every substrate source class, every license option), read from the
vendored kernel and schema, never a hand-copied list. Deliberate-break coverage: hand-assigning a
sample row's own `earned_grade` before display failed `check-designer.mjs`'s byte-comparison
assertion by name; adding an editable `founder_vanity_url` field to `scaffoldConfig` that the
vendored schema does not declare failed `check-parameter-surface.mjs`, naming the field exactly;
wiring `identity_thresholds.propose` into a real conditional in the finish screen failed both
`build/check-seams.mjs`'s own static scan and `check-designer.mjs`'s designer-specific re-invocation
of it; all three reverted, green.

**Phase KG-14, completed: the optional account layer.** Accounts, built as everything the
architecture already allows without the credential seam: `api/account.js` generates a WebCrypto
(ECDSA P-256) keypair locally, the account id a content hash of the public key alone (never a
display name), with export (a plain, prominent warning before download) and delete (irrevocable, no
soft delete) both real; a fresh install carries no account, and no read path (`api/community.js`,
`api/feed.js`, `api/ranking.js`, `api/filter.js`, `api/epistemic-cost.js`, `api/virtual.js`,
`periphery/card.js`) references account state at all. `api/signatures.js` produces a detached
signature over a bundle's own content-derived `contribution_id`, travelling as a sibling artifact
(`periphery/signing-panel.js`, reused identically by every export site: a plain proposal, a comment,
a promotion, a contest, and the registry's own register-an-artifact flow); an unsigned export is
untouched and fully valid, since a signature never mutates the bundle it signs. The presentation menu
(`PRESENTATION_LEVELS` in `api/account.js`, naming spec Section 5's own vocabulary: this key, a
member of a group, a member of this community, the empty predicate) renders its true current state:
"this key" and "floor, unlinkable" are functional today; the two membership levels render, visibly
disabled, with the plain reason (membership presentation awaits the credential seam and member-set
commitments upstream). A single shared guard, `canSignWithLevel(levelId, hasAccount)`, is the one
rule both the UI's disabled radio input and its sign handler's own defensive re-check call against,
so a disabled level can never reach `crypto.subtle.sign` by any path. `periphery/account-screen.js`
carries the account view, the presentation overview, a verify tool (checks a signature against a
bundle id and a public key, live), and the boundary notices stated plainly: signatures are verifiable
but no community yet requires them; anonymity here is graph-level, since the GitHub-based
contribution path still names the pusher at the transport layer; presentation levels 2 and 3 await
upstream; this deployment holds keys locally by design, unlike a custodial client. New check:
`build/check-accounts.mjs` (no read path references account state; a fresh install is accountless;
the bundle-building modules carry no import edge to `api/account.js` or `api/signatures.js`; a
signature verifies and fails on tamper against contribution id, signature, or public key
independently; an unsigned contribution is fully valid and carries no signature field; the two
disabled presentation levels refuse `canSignWithLevel` under every combination). `build/check-
profile-leak.mjs` extends its own canary discipline to the account's own private key. Deliberate-
break coverage: referencing account state from a read-path module failed `check-accounts.mjs`'s
static scan naming the exact file; planting the private-key canary and driving the bundle path failed
`check-profile-leak.mjs`'s runtime fuzz; forcing `canSignWithLevel` to accept a disabled level failed
`check-accounts.mjs`'s own per-level assertions naming it; all three reverted, green. Capability
manifest is unchanged: the account is entirely local, opening no new runtime destination.

**Phase KG-13, completed: the three rooms as communities.** Re-pinned upstream/epistack to
`6b3cbfcd5a63b126a5ac6740a1feb2f9e92d80f4` (Step 0, exactly as KG-10's own re-pin process: submodule
checkout, `build/vendor-extract.mjs` re-run, `upstream/lock.json`'s hashes regenerated, the one
changed vendored file, `vendor/kernel/_nodes.js`, copied into both founded communities' own
self-contained vendor copies so `check-neutrality.mjs`'s byte-identity assertion holds). `build/emit-
rooms.mjs` emits the LHC and covid rooms by dynamic-importing epistack's own unmodified `buildLhc()`
and `buildCovid()` directly, staged the same way `vendor-kernel.mjs` stages any kernel; the eggs room
merges its three domain stores (nutrition, environment, economics) into one state over their one
shared source and kind table, excluding the cross-domain composite layer this deployment's snapshot
format cannot represent, stated as such in the script's own header and `manifests/network.json`'s
description rather than forced. Three snapshots (`app/fixtures/lhc.snapshot.json`,
`eggs.snapshot.json`, `covid.snapshot.json`) and three community cards (`communities/rooms/*-card.json`)
are written; each card's `contribution_target` names the epistack repository at the pinned commit,
never this app. `api/room-walks.js` carries `ROOM_WALKS`, the one list naming which of the
competition's own case-claims (none of which cite a claim-level anchor inside a room, only the
room's checker script) walk into which room's entry point; `periphery/card.js` renders one always-
visible walk button per target, `periphery/app.js` wires it to `setHash`. Case framing (one sentence
per room, drawn from the institutional entrance's own language, marked as app chrome) renders at the
top of each room's feed. New check: `build/check-rooms.mjs` (every snapshot hash matches its card and
resolves; every card's contribution target names epistack and never this app or the Knowledge-Game
repository; each room recomputes on device with a sampled claim's grade matching a fresh re-run of
epistack's own builder; every `ROOM_WALKS` target names a room that actually exists and a claim that
actually exists in the loaded competition snapshot; the network manifest's room destinations each
name epistack). CI gained a reproducibility step: `build/emit-rooms.mjs` regenerated and diffed
against the committed snapshots and cards, the same discipline the math and knowledge-game fixtures
already hold. Deliberate-break coverage: pointing a room card's contribution target at the Knowledge-
Game repository failed `check-rooms.mjs`'s neutrality assertion naming the room exactly; doctoring a
room card's `snapshot_hash` failed the card-snapshot match assertion for that room alone; adding a
walk target naming a room that does not exist failed the walk-resolution assertion naming it; all
three reverted, green. Capability manifest is unchanged: the rooms are three more same-origin
fixtures, opening no new runtime destination.

**Phase KG-6c, completed: the inbound gate.** Symmetric to KG-6b's own outbound outbox and virtual
layer: pull no longer auto-applies unbidden once a reader reaches for this. `vault/vault.js` gains
`getInboundMode`/`setInboundMode` (`"auto"` or `"review"` per community; absence is `"auto"`, the
existing sync behavior, gate-open, unchanged), `getInboundBaseline`/`setInboundBaseline` (the
last-accepted working view: a lightweight `{identity, kind, grade}` ledger plus the kind and source
tables and governance hash captured when it was taken), and `getHeldUpdates`/`setHeldUpdates`
(declined changes, each recording the exact grade declined). `api/inbound-gate.js`, pure throughout:
`establishBaseline` captures the current view silently the first time review mode has something to
diff against, so switching a community into review mode never itself produces a false "everything is
new" list; `computeUpdateList` diffs a fresh read against the baseline (a claim absent is new, a claim
present with a different grade has moved), a held record whose declined grade still matches stays
quietly in the held list, one that no longer matches has been overtaken by motion and returns to
pending; `flagContradictions` names a held identity a "contradicts" link connects to; `acceptIntoBaseline`
absorbs identities at their current real grade (exactly what auto mode already shows);
`holdUpdates`/`clearHeld` manage declines; `adoptGovernanceHash` is the reader-side "adopt this
parameter set" act; `recomputeUnderAdoptedParameters` reuses `api/epistemic-cost.js`'s own
parameterized recompute over the baseline's own kind/source tables rather than a second
implementation, promoting the epistemic-cost report from a view to a gate condition ("these N pending
changes grade differently under what you've adopted so far"). `periphery/app.js`'s `loadCommunity`
excludes every pending or held identity from the solid ranked feed and renders each pending one as its
own ghost card (`periphery/card.js`'s `renderIncomingCard`, `row.incoming: true`, the inbound gate's
own mirror image of an outbound virtual: real in the store, not yet actual in the working view),
naming both grades plainly and offering Accept/Hold inline; `periphery/inbound-screen.js`'s update-list
screen (new route, `view=inbound`) carries bulk accept-all/accept-selected/hold-selected, a governance-
hash mismatch banner with an adopt action, the epistemic-cost toggle, and a held list where nothing is
ever a dead end (a held item's own Accept button absorbs it directly; re-sync alone re-offers it the
moment its incoming state moves again, never silently dropped or silently re-applied).
`periphery/communities-screen.js` gains the per-community inbound-mode picker and a pending/held count
link into the review screen. New check: `build/check-inbound-gate.mjs` (auto mode is unaffected; a
freshly established baseline pends and holds nothing; twenty rounds of accept/hold/clear/adopt leave
the real rows and the community's own store byte-identical; accepting absorbs exactly the live grade;
a held item whose incoming state has not moved again stays quietly held across a re-sync, one that has
moved again returns to pending; the module reaches no bundle-building or store-writing file).
Deliberate-break coverage: a mutation bug rolling a real row's grade back to its baseline value on
diff failed the isolation assertion by name; a misrecorded first-claim grade at baseline establishment
failed the "excludes nothing" identity assertion; silently dropping a matched held item on re-sync
failed the held-persistence assertion naming it; all three reverted, green. Capability manifest is
unchanged: the inbound gate reaches no destination beyond the community fetch every load already
makes.

**Phase KG-entrance-listing, completed: the Knowledge Game entrance listing.** Adds seven
`entrance-surfaced` listing claims (claim-21 through claim-27) to the knowledge-game governance
kernel, so an org-root entrance page can render this app's own door from its real grounded claims
rather than hand-written copy. `title` (claim-21, "The Knowledge Game") and `tagline` (claim-22, "the
first app for the protocol: a feed whose algorithm answers to the reader", marked `revisable: true`)
and the three `link` claims (claim-23 the live app, claim-24 the submission surface at
`#view=submission`, verified against the real route rather than guessed, claim-25 the repository) are
all of a new local kind, "identity" (ceiling constitutive), added by hand to
`kernel/governance/corpora/tables.js` and documented in `kernel/governance/kernel-config.json`'s
`local_kinds` rather than regenerated by the scaffolder, since re-running `new-kernel.mjs` against
this kernel's config would overwrite `knowledge-game-data.js`'s own 20 hand-grounded claims with an
empty skeleton. Two `status` claims (claim-26, claim-27) are of the kernel's original "measurement"
kind, declared_grade "asserted" with no checking records of their own (an honest floor for a bare
listing that carries no independent evidence), each naming a real governance claim via a
`references_claim` extension: claim-9 ("this client holds no capability any client with the snapshot
lacks") and claim-1 ("ranking cannot modify canonical standing"). Every listing claim's `role` and
`entrance_surfaced: true` marker are ordinary extension fields (`vendor/kernel/schema/records.mjs`'s
own extensionsOf/finalize mechanism, the same one the-registry's contract-bundle claims already use),
moving no grade and adding no rule the gate itself reads; `build/knowledge-game-build.mjs` gained the
identical documented spread-extra-fields departure `build/the-registry-build.mjs` already carries,
since the scaffolder's own generated template only forwards the six named claim fields. New check:
`build/check-entrance-listing.mjs` (every entrance-surfaced claim carries a valid role; every
`status` listing's `references_claim` names a real governance claim that exists and grounds, never
ungraded or missing; the emitted snapshot carries all seven listing claims with their roles and
references intact). `build/check-knowledge-game.mjs` now asserts 27 claims total, restricts its own
"every claim earns checked" loop to the original 20 (claim-1 through claim-20), and separately
asserts the 7 entrance-listing claims declare nothing above what they earn; `build/check-conformance-
read.mjs`'s hardcoded claim count was updated from 20 to 27 to match. Re-pinning consequence: editing
`build/check-conformance-read.mjs` changed its own file hash, which the-registry's own claim-3
(the client contract) cites as half of its `required_oracle` pin; the pin was recomputed and
the-registry's own snapshot and community card re-emitted to match, both founded communities' self-
checks confirmed green afterward. Deliberate-break coverage: pointing claim-26's `references_claim` at
a nonexistent claim ref failed `check-entrance-listing.mjs`'s existence assertion naming it exactly;
reverted, green. The re-emitted `knowledge-game.snapshot.json` (snapshot_hash
`57cd012673a93c6f02c4c36da138f45bdfd38df24824b67f3b3934937ebf5ff6`) serves at its existing Pages path,
confirmed by fetch. Capability manifest is unchanged: the entrance listing adds no new runtime
destination, only claims inside the already-served snapshot.

**Phase KG-front-page, completed: the front page as six branching questions.** Replaces the root
`index.html`, previously a bare redirect into `app/`, with a static, JavaScript-free front page: the
submission's argument as six questions, each a native `<details>`/`<summary>` disclosure opening into
a short answer and doors into the epistack repository's own artifacts, the sixth question's door being
the app itself. Content landed verbatim per the governing prompt; no factual correction or register
flattening was needed (the footer line, "Grades are computed on device from the public graph. A grade
is a computed reading, never a claim of truth," is reused verbatim from `app/index.html`'s own existing
footer, the same grounded register the entrance-surfaced claims already carry). A new standalone
stylesheet, `root.css`, hand-copies `app/style.css`'s own token values (paper, ink, line, focus,
radius, font stack) rather than importing it, so the two pages read as one family with no build-time
coupling; the page reads fully with CSS absent, since disclosure is native HTML, never scripted.
Service-worker determination: `build/shell-files.mjs`'s own walk starts from `app/index.html`, never
the root file, so root `index.html` was never in `sw.js`'s precache list; the fetch handler's own
cache-then-network fallback never writes a runtime cache entry either, so a returning visitor's next
request for `/` always reaches the network fresh. No cache version bump was needed, and `sw.js` itself
is untouched. `llms.txt` gained one line naming the new human entrance, the machine-readable state
staying exactly where the file already said it was. Every door target was curl-verified as a real,
resolving public URL against the epistack repository (contract-register.md, the-asymmetric-weapon.md,
the-minimum-constitution.md and its own internet-history heading anchor, the-tcpip-counterexample.md,
criteria-to-architecture-map.md, and the corpora/math and corpora/lineage directories), all resolving
200; this deployment's own outbound proxy policy blocks the `*.github.io` domain outright (a
connect-rejected policy denial, not a missing-page 404), so the deployed app door and the repository's
own Pages could not be curl-verified from this session directly, and the local mirror server stood in
for that specific check instead. Deliberate-break coverage: pointing the lineage-corpus door at a
nonexistent path failed the curl sweep (this repository carries no automated link checker, so the
sweep itself is the check named in the governing prompt) with a 404 naming the broken URL; reverted,
green. Capability manifest is unchanged: the new page opens no new runtime destination of its own
(every door is an ordinary outbound link a reader's own click follows, never a fetch this app makes).

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
