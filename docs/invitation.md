# The invitation

Stage 5 of the workflow track: the honest statement of what exists, what is open, and how to
arrive, written once so no screen has to improvise it.

## What exists

The app: a mobile-first installable feed reader over the EpiStack protocol, running the v3 gate
in-device against a hash-verified snapshot, with a visible ranking objective, a discussion layer
that never dresses as evidence, an extension seam, onboarding, and standing-motion alerts.

The deployment's own grounded governance: 20 claims in `kernel/governance/corpora/knowledge-game-
data.js`, every one computing `checked` against a real checking record naming the check that
grounds it. `docs/blast-radius.md` maps each claim to the files and checks that carry it.

The first community's published claims: 19, at `communities/epistack-competition/`, mechanical
ones grounded by upstream's own reference-implementation checks, evaluative ones sitting at their
honest floor. Its card, snapshot, and contribution path are in the directory.

The extension seam: a sandboxed, content-addressed loading path (`api/extension.js`,
`api/extension-sandbox.js`) and two shipped examples, a learn-efficiently ranker and a contestable
dashboard, both installing through the identical public conformance path a third-party candidate
would use.

## What is open, and whose it is

The free parameters (`docs/parameters-register.md`'s local tier, as this deployment's founding
flow surfaces it): the time-lock setting, local kind declarations, the source table, and which
shared kinds to adopt. A founder's, not this app's.

Semantic judgment: the third rung of the ladder (`periphery/ladder.js`), reached only by members of
a community deciding a claim's floor holds. Never mechanical, and never this app's to declare.

Community purpose: a founding config's `frame` (name, domain, purpose). A founder's choice, made
once at founding and carried in the community card from then on.

The README and the spec share the same closing line on this: "This repository standardizes what
must be shared for its artifacts to compose. It does not standardize what should remain local:
personal objectives, semantic judgment, participant governance, or community purpose. Founding a
community means setting those, and the founding flow is that sentence made into a screen."

## How to arrive

**As a reader:** the deployed URL, `https://a-viable-fork.github.io/Knowledge-Game/`. No account,
no install required to browse.

**As a contributor:** the draft path (`api/contribute.js`'s `draftProposal`, reached in-app through
the Level 3 contribute screen). One worked example: claim 20's own trail, drafted the same way
through the app's real contribution path, exported as
`kernel/governance/contributions/0001-the-extension-seam.json`, and admitted once its check landed.

**As a client author:** the conformance pair, `build/check-conformance-read.mjs` and
`build/check-conformance-write.mjs`, as your test suite. They already prove an independent client
built from `vendor/api/*` alone reproduces every read and write this app can do; point the same
harness at your own client and the comparison is the acceptance test.

**As a founder:** the founding flow, `build/found-community.mjs`'s `generate` then `publish`
commands over a config shaped like `vendor/scaffolder/kernel-config.schema.json`.
`build/check-parameter-surface.mjs` is the check that your config's free tier matches the register.

**As an extension author:** the seam contract (`api/extension.js`'s `checkConformance`,
`api/extension-sandbox.js`'s sandbox) and the two shipped examples in
`periphery/demo-extensions.js` as templates. Nothing you write gets a capability the sandbox does
not already grant every candidate equally.

## What this invitation does not claim

No community is claimed into existence by this document. The competition community is a published
artifact plus whoever has demonstrably engaged, and engagement is counted only as the graph shows
it: as of this writing, its 19 claims and one corroborating support link were authored by this
deployment's own founding contributor identities (`P-epistack-competition`,
`P-epistack-competition-contributor-1`); no independently identified third party has yet
contributed through the pull-request path. That is the honest current state, not a claim about
what the community will become.

## The deadline-independent truth

Everything here runs without this repository's authors, which is the point. A reader's browser
fetches a snapshot, verifies its hash, and recomputes every grade itself, with or without anyone
who wrote this code still present. A fork carries the same guarantee under different stewardship.
The freeze re-pin due July 19 is a maintenance obligation on this deployment's own currency with
upstream, not a load-bearing date for whether any of this keeps working; nothing here stops running
when that date passes unmet, and nothing here stops running if no one reads this file again.
