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
still computes `asserted`. Claims 1 through 6 and 10 through 18 are unchanged, still bare and
`asserted`, each with its open characterized gap in `trellis/sorry-ledger.md`.

**A design correction surfaced building the null order.** An earlier draft approximated the null
order's "recency" term with each claim's position in the snapshot's raw `entries` array. This was
rejected once `build/check-feed-determinism.mjs`'s permutation test would have exposed it as
order-dependent on incidental serialization, not on claim content. Recency is now honestly void (SK-20):
the v3 claim record carries no timestamp field, so there is nothing to sort by between grouping and
the hash tiebreak, and the module says so rather than inventing a proxy that fails the invariance the
order itself promises.

## Specified, not built

Everything else in this repository is specified and not yet built, named here so the scope is
legible rather than discovered piecemeal:

- **The governance kernel, Stage 3 through 5, remainder.** Claims 1 through 6 and 10 through 18 remain
  bare; embedding code-to-claim references (Stage 4) and the invitation (Stage 5) have not started.
- **Phase A, remainder.** Ranking (and its no-grade-motion property test), the ranking/standing
  separation beyond claim 7's egress half, snapshot-hash verification's UI-level presentation, the
  offline shell, and installability beyond a bare manifest are not built. `manifests/network.json`'s
  enforcement now has a real check (`check-egress.mjs`); `manifests/capability.json`'s permissions and
  profile-upload fields still have none.
- **Phase B, community founding in-app.** No founding flow exists. The neutrality check, the
  second-client conformance check's write half, and the scaffolder-driven generate step are all
  named, none built.
- **Phase C, the first community.** Not started; depends on Phase B.
- **The four hot-swap seams' active behavior.** All four interfaces are described in
  `docs/architectural-reading.md` Section 4 as obligations this repository owes; none has code yet.
  The credential seam's vendored stub (`vendor/api/credential.js`) exists via the substrate pin, but
  no local evaluator wraps it yet.
- **Every check still named "intended" in `trellis/governing-trellis.md` and `trellis/design-axioms.md`.**
  Of the twelve Tier 0 constraints: G0-8 (substrate integrity) is fully checked; G0-1 (trust boundary)
  is now fully checked; G0-5 (egress) is half checked (claim-7's half, not claim-6's); G0-11
  (unprivileged client) has its read half checked. The remaining constraints are still
  prose-specified.
- **The manifests' enforcement.** `manifests/network.json` is now enforced by `check-egress.mjs`.
  `manifests/capability.json` and `manifests/build-provenance.json` still have no enforcing code.

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
