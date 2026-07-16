# Status report

The five-way division (spec Section 11), every number below read from
`kernel/governance/corpora/knowledge-game-data.js`, `trellis/sorry-ledger.md`, or a check run in
this session, not asserted from memory.

## 1. Built and checked (20 items)

Every one of this deployment's own 20 governance claims computes `checked` against a real checking
record. `docs/blast-radius.md` carries the full file-level detail; this is the claim-to-checker map:

| Claim | Checker(s) |
|---|---|
| claim-1 | `build/check-ranking-separation.mjs` |
| claim-2 | `build/check-objective.mjs` |
| claim-3 | `build/check-vault.mjs` |
| claim-4 | `build/check-profile-leak.mjs` |
| claim-5 | `build/check-vault.mjs` |
| claim-6 | `build/check-egress.mjs` |
| claim-7 | `build/check-egress.mjs` |
| claim-8 | `build/check-imports.mjs` |
| claim-9 | `build/check-conformance-read.mjs`, `build/check-conformance-write.mjs` |
| claim-10 | `build/check-neutrality.mjs` |
| claim-11 | `build/check-conformance-write.mjs` |
| claim-12 | `build/check-citation.mjs` |
| claim-13 | `build/check-ladder.mjs` |
| claim-14 | `build/check-release.mjs` |
| claim-15 | `build/check-provider-contract.mjs` |
| claim-16 | `build/check-seams.mjs` |
| claim-17 | `build/check-seams.mjs` |
| claim-18 | `build/check-seams.mjs` |
| claim-19 | `build/check-substrate.mjs` |
| claim-20 | `build/check-extension-seam.mjs` |

Two structural checks ground the workflow track itself rather than a numbered claim:
`build/check-references.mjs` (Stage 4: every governance reference resolves, all 20 claims are
covered) and `build/check-parameter-surface.mjs` (the founding flow's parameter surface matches the
vendored register).

## 2. Built but manually governed (1 item)

**SK-19**, the source-class honesty discipline: `vendor/kernel/schema/tables.mjs`'s
`makeSourceTable` validates that a source's `source_class` is one of the six substrate-menu
strings, but has no way to verify the label honestly describes the evidence it names. No mechanical
check can bound semantic honesty of a label the substrate itself does not define beyond its enum;
this repository's own read-before-merge practice is the standing discipline named in place of one.

## 3. Bounded follow-up engineering (8 items)

**SK-20**, recency: `api/feed.js`'s null order has nothing between grounding and the identity-hash
tiebreak, because the v3 claim record carries no timestamp and no other content-derived temporal
signal exists yet. Closes once the patch-history seam (claim-17) lands a real, ordered ledger to key
recency on.

**SK-21**, the move-out: the founded EpiStack Competition Community lives in this repository rather
than a standalone sibling, because this session's GitHub access does not extend to creating one.
Checked again this phase (Step 4): no sibling repository exists as of this run, so SK-21 stays open;
no artifacts moved.

**SK-22**, transport anonymity: v1 contributions ride the GitHub-native PR path, which names the
pusher account on every admitted contribution. The credential seam's eventual presentation
machinery scopes anonymity claims to the graph, never the transport; closing this requires a
transport that does not name the submitting party, not specified upstream or planned locally as of
this pin.

**SK-23**, the license picker: the founding flow's parameter step does not yet surface a license
picker, because `vendor/scaffolder/kernel-config.schema.json` carries no `corpus_content_license`
property as of this pin. Closes automatically in the sense that matters: when the vendored schema
gains the field, `build/check-parameter-surface.mjs` will fail on the register delta at the next
re-pin, naming the new field as present in the schema but absent from the founding flow, which is
the designed detection rather than a bug.

**SK-24**, attribution capture: the draft path captures no typed attribution target when a draft
derives from a published source, so a community's market-layer royalty machinery (specified,
upstream, branch-local) has nothing structural to route a distribution toward for a transcribed
claim admitted here. Closes with a typed `attributionTarget` field on the draft object, always
present on a source-derived draft, checked so a draft built from a citation always carries a
target or an explicit none, never a silent absence.

**SK-25**, production signing: the Android wrapper is built and signed with a committed TEST ONLY
keystore (`android/test-keystore/`); this repository's obligation is limited to stating the
production rule, not performing it. Closes when the operator generates a production keystore held
privately (never committed), re-emits `assetlinks.json` against its fingerprint, and retires the
test key before any Play Store submission. An operator action, not an engineering one.

**SK-26**, Play Store publishing: the wrapper is built and released as a sideload-only APK; listing
it on the Play Store (developer account, store listing, review) is entirely outside this
repository's scope. An operator action, not an engineering one.

**SK-27**, push notifications: not built. Adding them would introduce a new runtime egress
destination (a push service) that `manifests/network.json` and `manifests/capability.json` do not
yet declare. A deferred egress decision, not yet chosen either way.

## 4. Plural community-policy choices (5 items)

Per `docs/parameters-register.md`'s free tier, each a community's own to set and re-set, with no
effect on composition with another kernel:

- **Time-lock parameters.** How much elapsed, sampled work standing costs, how fast it decays.
- **Standing and reputation rules.** Who earns standing and how it weighs canonical writes; a
  community may run flat or hierarchical, meritocratic or credentialed.
- **Agent policy.** Which producers may perform which steps; nothing about a crossing depends on it.
- **The type system.** What floors a kernel recognizes, extended by wholesale fork.
- **Forum and weighing conventions.** How a community handles cross-domain weighings and settled
  questions.

Identity thresholds (claim-16) and linkability sit adjacent to this tier rather than inside it: a
founder sets the per-action threshold values (`propose`, `contest-type`, `vouch`) today, but they
are stored inactive until the credential seam's real evaluator lands, so the choice is made but not
yet load-bearing.

## 5. Open research (4 items)

The standing economy (claim-18's reserved fields), per upstream's own named open seams
(`upstream/epistack/docs/status-ledger.md`), none built, none claimed built:

- **[S1] The nonemptiness of the lever space.** Whether a time-lock and standing setting exists,
  for a given stake and adversary, that prices gaming above capture while honest standing survives
  its own decay. Rests on [S2] and [S4].
- **[S2] Synthetic versus genuine harmonic.** Whether manufactured cross-domain disagreement is
  distinguishable from genuine.
- **[S3] Patch-boundary integrity.** Whether the patch boundary, as the rollback unit, is safe
  against poisoning the window before a seal.
- **[S4] The density-collapse lever.** Whether an attacker can force collapse of a targeted
  sub-graph by inflating participant density and interaction velocity.

## The seams table

| Seam | Null implementation | Contract test | What upstream landing swaps in |
|---|---|---|---|
| Credential (claim-16) | `vendor/api/credential.js`, a stub; `identity_thresholds` stored, never evaluated | `build/check-seams.mjs` | The real time-locked credential and presentation machinery ([4.2]); `identity_thresholds` starts gating `propose`/`contest-type`/`vouch` instead of sitting inert |
| Patch-history (claim-17) | `vendor/kernel/store/patch-ledger.js`, a stub; contribution identity is a content hash, no durable history kept | `build/check-seams.mjs` | The real append-only patch ledger ([4.5]); SK-20's recency signal becomes available, keyed on ledger position |
| Remote provider (claim-15) | `vendor/api/providers/remote-provider.mjs` exists but is never constructed; only `createLocalProvider` runs | `build/check-provider-contract.mjs` | `api/community.js` swaps in a live `createRemoteProvider()` call; the periphery's own logic needs no change, since it depends only on the `createClientApi` contract |
| Standing-economy (claim-18) | The community card's `standing_economy` fields, all `null`, read by zero call sites | `build/check-seams.mjs` | The coordination layer ([4.2] through [4.4]: time-locked credential, gated-write lifecycle, challenge system), resolving [S1] through [S4] above |
