---
Type: reading
Purpose: The read-before-design deliverable for The Knowledge Game. States the architectural reading, the proposed repository tree, the upstream component classification, the hot-swap seams restated as interface obligations, and the build plan. Written before any other file in this repository, per the init prompt's discipline.
Depends on: knowledge-game-spec-v2.md (provided alongside the init prompt), the pinned upstream commit recorded in upstream/lock.json
Depended on by: kernel/governance/stage-0.md
---

# Architectural reading

## 1. What the substrate fixes, what it frees, and what The Knowledge Game is within it

EpiStack fixes a small required tier and frees everything else. The fixed tier, stated in
`docs/parameters-register.md` and made mechanical in `docs/protocol-spec.md`: claims are typed,
including as the untyped type; grounding is monotone (a claim never advertises more standing than
its necessary supports carry); the untyped type grounds nothing and inherits downward; claims
carry their history across a crossing; standing is forkable and revocable. Composition rests on
exactly these five, and on the one named hash that gives a type bundle its identity
(`hashTypeBundle`), because two kernels that pin the same hash mean the same thing by a type and
compose native and lossless. Everything else is free: the time-lock economics, the standing and
reputation rules, the agent policy, the local type system beyond the shared subtree, the forum
conventions, and, load-bearing for this deployment, the credential policy, the standing economy,
and community governance in full (`docs/coordination-layer-spec.md`, specified and not built
upstream).

The substrate also fixes a shape, not just a rule set: one trust boundary (`kernel/` pure and
imports only `kernel/`; `api/` the sole membrane; a periphery reaching the kernel only through
`api/`), one canonical schema, a gate that reads structure and never a producer's nature, and a
crossing that is honest about loss. This shape is what a deployment inherits by pinning the
substrate rather than re-implementing it.

What The Knowledge Game is within that frame: a fat-client periphery plus a governance kernel, per
spec Section 1. It is not a new protocol, not a parallel schema, not a second gate. It is a
deployment: a PWA periphery that reads and proposes against community snapshots through the
vendored `api/client-api.mjs` contract, and a repository that carries its own governance kernel
(scaffolder-generated, never hand-invented) whose claims describe the deployment's own behavior,
exactly the pattern `docs/substrate-map.md` calls "a working individual kernel (N=1)" and
`docs/ecosystem-guide.md` calls the deployment maintainer's contract. The product surface (feed
reader, community founder) is periphery in the substrate's own vocabulary: fallible, replaceable,
never touching the store, reaching the kernel only through the membrane. The first community this
deployment founds (Phase C) is itself an ordinary use of the founding flow (Phase B); the
deployment does not get a privileged path to community creation that a third-party client lacks,
per the unprivileged-client invariant (spec Section 2).

Two things the substrate does *not* fix, which this deployment must supply locally because upstream
marks them specified rather than built: who may write at what identity grade (the credential seam,
upstream `api/credential.js`, a three-line stub), and how a community's standing economy prices
gaming against contribution (absent entirely upstream, `docs/coordination-layer-spec.md`). This
deployment's Section 5 seams exist because these two gaps are real and dated to land after the
submission this repository is itself being built for.

## 2. The proposed repository tree

Spec Section 4 as the starting point, adopted without departure. Each layer's reason for existing:

```
Knowledge-Game/
├── upstream/           pin and extraction records (the submodule, the lock file's own history)
├── vendor/             imported substrate (kernel/, the wrapped api/ modules, the scaffolder, emit-snapshot)
├── kernel/
│   └── governance/     this repository's own governance kernel (scaffolder-generated, never hand-invented)
├── api/                the membrane: provider adapters, the credential seam, the contribution path
├── periphery/           the PWA and every fallible view and producer
├── vault/               the minimal personal-data interface (local-only, explicit, export/delete)
├── trellis/             governing-trellis.md, design-axioms.md, parameters-register.md,
│                        status-ledger.md, sorry-ledger.md, exclusion-reservoir.md
├── manifests/           capability, network, build provenance
├── build/               checks and generated artifacts
├── docs/                this reading, and everything documentation-shaped that follows
└── app/                 built PWA output
```

No departure from spec Section 4 is taken. One clarification worth stating because it is not
obvious from the tree alone: `kernel/governance/` is *this repository's* Stage-0-through-5
governance kernel (the claims about the app's own behavior), built by the same
`scaffolder/new-kernel.mjs` any community uses. It is a sibling of the communities this app founds
in Phase B/C, not their container: a founded community's kernel lives in its own repository,
scaffolded and published independently, per the founding flow's Section 5 publish step (a
community card, a snapshot, a contribution target scaffolded on GitHub, never inside this
codebase). `kernel/governance/` and a Phase-C-founded community kernel are two different instances
of the same upstream mechanism, run for two different purposes.

## 3. The upstream component classification

Classification key: **pinned** (reused unchanged through the membrane), **wrapped** (the membrane
itself: a thin local file that imports the vendored module and adds no rule of its own),
**genericized** (extracted and stripped of competition-specific content, none needed here, noted
where it would apply), **forked** (a local departure with a named check), **not imported**
(deliberately excluded, with the reason).

| Upstream capability | Component(s) | Classification | Notes |
|---|---|---|---|
| Typed claim/link schema, canonical form, the one named hash | `kernel/schema/*` (canonical.mjs, records.mjs, confidence.mjs, tables.mjs, type-hash.mjs, sha256.mjs, edges.js, registry.js, registers.js, schema.js) | **pinned** | Vendored whole as the trusted core; imported only by the local provider and by generated kernel builders, never edited. |
| The grounding computation | `kernel/grounding/earned-grade.mjs`, `resolve.js`, `profile.js` | **pinned** | The earned-grade recurrence this app's grades derive from on device. |
| The gate | `kernel/gate/gate.mjs` (+ `lifecycle.js`, `immune.js`, `clean-json.js`, `verify.mjs`) | **pinned** | The sole write path; `decide()` is what `local-provider.mjs` calls. |
| Robustness, reconciliation, characterized gaps, store | `kernel/analysis/*`, `kernel/store/*`, `kernel/motions/*` | **pinned** | Vendored whole with the kernel tree; `store/patch-ledger.js` is present (whole-directory pin) but not called by any local code, see [4.5] below. |
| Cross-kernel composition | `kernel/composition/transfer.mjs`, `vocabulary.mjs`, `framing.mjs`, `records.mjs`, `notify.mjs`, `profiles.mjs` | **pinned** | Not on the Phase A-C critical path (one community, no cross-kernel citation yet); vendored dormant with the rest of the kernel tree rather than cherry-picked out, so no future citation feature needs a re-pin. |
| The propose/read contract | `api/client-api.mjs` | **pinned** (this is the membrane itself, so "pinned and reused unchanged" is the correct classification, not "wrapped") | `createClientApi(provider)`; the periphery's only door to a provider. |
| The on-device provider | `api/providers/local-provider.mjs` | **pinned** | The one API-layer module that imports the kernel; runs the real gate over a snapshot. |
| The provider seam's honest null | `api/providers/remote-provider.mjs` | **pinned** | Vendored as-is; it is already the honest stub the hot-swap seam needs, not a local invention. |
| The credential interface | `api/credential.js` | **pinned** (the upstream stub) + **wrapped** (this app's local open-policy evaluator) | Upstream's file is a three-line stub marked `[4.2]` specified; vendored unchanged. This app's own `api/` layer (not `vendor/`) adds a local module that reads the stub's shape and currently allows any action any community's parameters permit, per Section 5. This is a local addition beside the vendored stub, not a fork of it. |
| Contribution bundles | `api/contribution.js` | **pinned** | Content-derived `contribution_id`; export/import round-trip. |
| Type fork and contest | `api/fork.js`, `api/contest.js` | **pinned** | `forkType`, `contestType`; both snapshot-only, additive over the crossing. |
| Parameterized recompute | Local provider's `{state, sources, kinds}` shape | **pinned** | Confirmed by reading `local-provider.mjs` and `emit-snapshot.mjs`: the provider is generic over any snapshot in this shape, so this app's own governance kernel and any Phase-C-founded community kernel run through the identical provider code. |
| The scaffolder | `scaffolder/new-kernel.mjs`, `scaffolder/kernel-config.schema.json` | **pinned** | Config in, empty kernel out, runs the real generated check; holds no copy of the rules. |
| The shared type subtree seed | `corpora/_shared/common-types.js` | **pinned** | A scaffolder dependency (`COMMON_BUNDLES`, `COMMON_TYPE_HASHES`); required for the generator to run at all, so it is part of the minimal substrate even though it lives outside `kernel/` and `api/` upstream. |
| Snapshot emit | `build/emit-snapshot.mjs`, `build/vendor-kernel.mjs` | **pinned** | `emit-snapshot.mjs` imports `vendor-kernel.mjs`; both vendored together since the first depends on the second. |
| Ecosystem contracts | `docs/ecosystem-guide.md`, `docs/clients.md` (informative, not code) | **not imported as code; cited as the normative reference** | These govern this deployment's obligations (unprivileged client, community-card format, three-state contribution ladder) but are read and honored, not vendored as executable substrate. |
| The credential seam's real evaluator | Identity-as-graded-claim, standing thresholds | **not imported** | Specified upstream (`[4.2]`), not built; nothing to vendor. This app's parameter records reserve the field per Section 5. |
| The patch ledger | `kernel/store/patch-ledger.js` | **not relied upon** (present in the whole-tree pin, uncalled) | Specified upstream (`[4.5]`), not built to durable-history spec; this app gets content-derived bundle identity from `api/contribution.js` without it, per the patch-history seam. |
| The standing economy | Time-locked credential, sponsorship, red-team immune system | **not imported** | Absent entirely upstream (`docs/coordination-layer-spec.md` is a specification document, no corresponding code exists to vendor). |
| Live remote providers | A real network-backed provider implementation | **not imported** | Upstream's own `remote-provider.mjs` is itself a stub; there is no live implementation upstream to vendor. |

**The zero-local-forks expectation is confirmed.** Every component on this app's critical path
(schema, gate, grounding, the client-api contract, the local provider, contribution export, fork
and contest, the scaffolder, snapshot emit) is reused unchanged through the membrane. The one
component that looks like a fork at first glance, the credential seam's "open" policy, is not a
fork of `api/credential.js`, because the vendored stub is never edited; it is a new local module in
this repository's own `api/` layer that sits beside the stub and implements this deployment's local
policy against the interface the stub shapes, exactly the pattern spec Section 5 prescribes ("v1
implementation: open ... When upstream credential.js ... land, the null swaps"). So the reading
does not contradict the expected result anywhere: reused unchanged through the membrane, zero local
forks.

## 4. The four hot-swap seams as interface obligations

Each seam is a governance claim this repository owes, grounded by an import/contract check, not a
promise kept by discipline alone.

1. **Credential seam.** This repository owes: an interface shaped to upstream `api/credential.js`
   (`[4.2]`) that every write path calls before a proposal reaches the gate; a v1 evaluator that
   permits any action any community's parameters allow, with no identity requirement, and that reads
   as open by construction, not by omission; and a founding flow (Phase B) that collects and stores
   per-action identity-threshold parameters marked `inactive-until-credential-seam-active`, so a
   community founded under v1 needs no re-founding when upstream's real evaluator lands. The check
   this claim is grounded by: an import-graph assertion that every proposal path in `periphery/` and
   `api/` routes through the credential interface before `client-api.propose`, and a contract test
   that swapping the v1 evaluator for a stricter one changes only who may write, never how a write is
   graded.

2. **Patch history seam.** This repository owes: reliance on `api/contribution.js`'s content-derived
   `contribution_id` as the sole identity primitive for a proposal, with no local durable-history
   store invented to substitute for the upstream patch ledger `[4.5]`. The check: a grep-style
   assertion that no local module persists a patch history keyed on anything other than the vendored
   contribution id, so that when the ledger lands, bundles gain durable history without an identity
   migration.

3. **Provider seam.** This repository owes: every periphery read and write routing through
   `api/client-api.mjs` and never importing `local-provider.mjs` or a future remote provider
   directly, so `providerKind()` stays diagnostic-only and the periphery cannot distinguish a static
   snapshot from a live remote kernel. The check: the import-graph oracle (Section 6 below) extended
   to assert periphery modules import only `api/client-api.mjs` among the provider-shaped modules.

4. **Standing economy seam.** This repository owes: parameter records that reserve a field for
   standing-economy parameters, read by no code, so the founding flow's schema does not need to
   change shape when upstream's coordination layer lands. The check: a schema assertion that the
   reserved field exists, is typed, and is read by zero call sites.

## 5. The build plan

### The workflow track (this repository's own accounting)

| Stage | Content | Status after this prompt |
|---|---|---|
| Stage 0 | Domain frame and axioms in waiting (`kernel/governance/stage-0.md`) | Committed by this prompt, tagged `stage-0` |
| Stage 1 | The governance kernel generated via `scaffolder/new-kernel.mjs`, not hand-invented | Not started; the next prompt after this one |
| Stage 2 | The bare governance claims entered at their honest floor | Not started |
| Stage 3 | Phases A-C build and ground the claims; the gate computes every standing | Not started |
| Stage 4 | Code and manifests reference the claim ids they are governed by; a check proves resolution | Not started |
| Stage 5 | The invitation, leaving constitutive community choices open | Not started |

### The product track

| Phase | Content | Maps into |
|---|---|---|
| Phase A | The base feed reader over one snapshot, on-device gate, ranking as a personal view-side function | Stage 3 (builds and grounds the earliest claims: import-graph oracle, ranking/standing separation, snapshot verification) |
| Phase B | Founding a community in-app: frame, type, parameters, generate, publish | Stage 3 (builds and grounds the founding-flow claims: the parameter-surface-equals-register-free-list claim, the neutrality check, the second-client conformance write half) |
| Phase C | The first community: the EpiStack competition community, self-grounding claims about this app's own structure and about the protocol | Stage 3 (the community that performs the verification Stage 2's bare claims await) |

### The three-tier deadline hedge (spec Section 8), as the plan's risk spine

In guaranteed descending order of ambition, all sharing the same prefix so work on any tier advances
all three:

1. The app pointing at the first community (Phase A + B + C complete).
2. The first community's published kernel alone, authored with upstream tooling directly
   (scaffolder, gate, `emit-snapshot`) and published on Pages, requiring zero lines of the app.
3. The claims themselves as a corpus, requiring only that the domain be framed and the bare claims
   entered.

This reading was produced before any code in this repository exists, so no tier has started; the
hedge is recorded here as the standard this repository's later status ledger will be held to.

## Open questions for the operator

- **Vendoring `corpora/_shared/common-types.js` outside `kernel/` and `api/`.** The scaffolder cannot
  run without it, so it is included in the minimal substrate above. Option A: vendor it alongside the
  scaffolder as done here. Option B: treat it as data the scaffolder step re-fetches from the pinned
  submodule at generation time rather than duplicating it into `vendor/`. Option A is simpler and
  matches "deterministic extraction... into vendor/" from the init prompt; recommended.
- **Whether `kernel/store/patch-ledger.js` should be vendored at all**, given it is never called.
  Option A: vendor the whole `kernel/` tree uniformly (as done here), so a future re-pin never has to
  reason about which kernel files are "load-bearing" this month. Option B: omit it and the other
  currently-uncalled kernel files, shrinking the vendored surface but adding a re-pin decision every
  time this app's usage grows. Option A is taken above; recommended, since the substrate is small and
  the file carries no executable risk while unused.
