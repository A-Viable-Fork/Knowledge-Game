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

## Specified, not built

Everything else in this repository is specified and not yet built, named here so the scope is
legible rather than discovered piecemeal:

- **The governance kernel** (workflow-track Stage 1 through 5). Stage 0's domain frame and axioms
  are framed in `kernel/governance/stage-0.md`, committed but not entered as claims; entering them
  is Stage 2, which has not started.
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

## Discipline note

The unit of progress is the named component and the named check. A line in this ledger moves only
on the same commit that builds the thing it grades, exactly the discipline upstream holds itself to
in its own status ledger's G1-2 (a discipline this repository's own governing trellis does not yet
mechanize either, and does not claim to).
