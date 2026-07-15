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
`checked`, the one claim this Stage 2 entry can honestly ground today. Claims 1 through 18 enter bare,
with no support and no checking record, and compute to `asserted`, their honest floor; each carries a
characterized gap in `trellis/sorry-ledger.md` (SK-1 through SK-18) naming its closing condition. No
grade above is asserted by hand anywhere in this repository, including in this ledger: every grade
above is read from the real gate's own computed state, verified by `build/check-knowledge-game.mjs`.

## Specified, not built

Everything else in this repository is specified and not yet built, named here so the scope is
legible rather than discovered piecemeal:

- **The governance kernel, Stage 3 through 5.** Grounding claims 1 through 18 beyond their bare floor
  (Stage 3), embedding code-to-claim references (Stage 4), and the invitation (Stage 5) have not
  started; Phases A and B build and ground them per the closing conditions in
  `trellis/sorry-ledger.md`.
- **Phase A, the base reader.** No periphery code exists. The import-graph oracle, the
  ranking/standing separation property test, snapshot hash verification, and the PWA shell are all
  named in `trellis/governing-trellis.md` as intended checks with no implementation yet.
- **Phase B, community founding in-app.** No founding flow exists. The neutrality check, the
  second-client conformance check's write half, and the scaffolder-driven generate step are all
  named, none built.
- **Phase C, the first community.** Not started; depends on Phase B.
- **The four hot-swap seams' active behavior.** All four interfaces are described in
  `docs/architectural-reading.md` Section 4 as obligations this repository owes; none has code yet.
  The credential seam's vendored stub (`vendor/api/credential.js`) exists via the substrate pin, but
  no local evaluator wraps it yet.
- **Every check named "intended" in `trellis/governing-trellis.md` and `trellis/design-axioms.md`.**
  Eleven of the twelve Tier 0 constraints are prose-specified; only the substrate-integrity
  constraint (G0-8 / A-8) is checked, as recorded above.
- **The manifests' enforcement.** `manifests/` scaffolds declared-empty capability sets; no code
  reads or enforces them yet, so their content is a commitment for Phase A to hold to, not yet a
  checked property.

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
