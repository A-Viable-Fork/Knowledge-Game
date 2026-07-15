---
Type: governance
Purpose: Stage 0 of the workflow track: the domain frame and axioms in waiting, for this repository's own governance kernel. Framed here, not entered; entering them is Stage 2, and grading them is the gate's act, not this document's.
Depends on: docs/architectural-reading.md, trellis/governing-trellis.md, trellis/design-axioms.md
Depended on by: nothing yet
---

# Stage 0: Domain Frame and Axioms

This is the workflow track's first committed state, per the kernel workflow guide's own discipline
(`upstream/epistack/docs/kernel-workflow-guide.md`, Stage zero: "frame the domain and its axioms").
It is a real state, not a narrated one: this document exists before any claim has been entered,
before Stage 1's kernel has been generated, and before the gate has graded anything. What follows is
framing. Entering these as claims is Stage 2. Grading them is the gate's computation over whatever
support Stage 3 attaches, not an act this document performs.

## The domain this governance kernel governs

**In scope.** This repository's own behavior: the twelve Tier 0 invariants stated in
`trellis/governing-trellis.md` (spec Section 2), restated below as the axioms this kernel's claims
will be about. The kernel describes this app's own structure, its own import graph, its own
manifests, its own contribution path, and its own hot-swap seams, exactly as spec Section 9 requires
("the governance kernel governs: the app's own behavior").

**Out of scope, stated plainly so no later claim mistakes its reach.** This kernel does not govern:
external scientific truth (whether a claim a founded community holds is true of the world; that is
semantic attenuation, a community's function per the protocol's own attenuation boundary); universal
reputation (there is no global score here, per the ecosystem guide's deliberate absences, and this
kernel computes none); validator selection (there is no standing economy in v1, per the seams);
the user's private profile (that lives in `vault/`, structurally separate, never a subject this
kernel's claims describe); a mandatory ranking objective (ranking is a personal view-side function,
never something this kernel's claims impose); and a canonical community constitution (this repository
founds communities through Phase B; it does not constitute one for them, per the founding flow's own
discipline that the first act of a community is the community's, not the founder's).

## The axioms, framed in waiting

Twelve axioms, one per Tier 0 constraint in `trellis/governing-trellis.md` and
`trellis/design-axioms.md`, numbered to match (G0-n / A-n). Each is typed by intention, names the
check expected to ground it, and names the phase that builds that check. None of these is entered as
a claim by this document; Stage 2 enters them, at their honest floor, and the gate computes whatever
grade the support Stage 3 attaches actually delivers.

**AX-1 (governance claim, structural).** One trust boundary, one direction of dependency:
`periphery/` reaches the vendored kernel only through `api/`; `api/` imports the vendored kernel and
nothing in `periphery/`; the vendored kernel imports only itself. Expected ground: an import-graph
oracle. Expected phase: A.

**AX-2 (governance claim, structural).** One canonical schema source: no local module defines a
claim or link shape outside `vendor/kernel/schema/`. Expected ground: a grep-style schema-definition
assertion. Expected phase: A.

**AX-3 (governance claim, structural).** Ranking never moves standing: no ranking objective changes
a grade, a receipt, a robustness reading, or a support structure. Expected ground: the no-grade-motion
property test (perturb the objective vector arbitrarily; every grade and certificate byte-identical).
Expected phase: A.

**AX-4 (governance claim, structural).** The active ranking objective is always visible, and the
null objective is deterministic (grounding-sorted then recency). Expected ground: an
objective-visibility and null-objective-determinism test. Expected phase: A.

**AX-5 (governance claim, structural).** Personal data never enters a public patch: no field of an
exported contribution bundle traces to `vault/`. Expected ground: a contribution-export
field-provenance test. Expected phase: A/B.

**AX-6 (governance claim, structural).** No undeclared network egress and no third-party analytics:
every network destination this deployment calls is named in `manifests/network.json` before the call
exists. Expected ground: a network-request assertion under test. Expected phase: A.

**AX-7 (governance claim, structural).** Gate passage, admission, and semantic acceptance render as
three distinct states; no state implies the next, and a passed receipt is never labeled true or
validated. Expected ground: a copy-and-label audit over every contribution-bearing surface. Expected
phase: A/B.

**AX-8 (governance claim, structural).** All inherited substrate code is pinned, hashed, and
attributable; local departures are explicit named patches. Expected ground: `build/check-substrate.mjs`.
Expected phase: already built, Step 3 of this repository's initialization.

**AX-9 (governance claim, structural).** Gaps are ledgered, never hidden: every gap marker this
repository's own code carries appears in `trellis/sorry-ledger.md`. Expected ground: a sorry-ledger
cross-reference check. Expected phase: A, when the first gap is entered.

**AX-10 (governance claim, structural).** No financial instrument exists in this deployment's schema
or manifests: no token, currency, stake, or incentive field is declared locally. Expected ground: a
schema and manifest grep. Expected phase: A.

**AX-11 (governance claim, structural).** This client is unprivileged: it holds no capability any
client with the same snapshot lacks. Expected ground, two parts: the import-graph oracle (AX-1's
check, reused for reach) and the second-client conformance check (an independent minimal client built
in CI from the vendored public `api/` alone, reproducing every app capability against the same
published artifacts). Expected phase: A for the read half, B for the write half.

**AX-12 (governance claim, structural).** Client-neutral artifacts: no community, snapshot, card, or
contribution-target scaffold this app's founding flow emits carries any reference to this app.
Expected ground: the neutrality check, a grep over every founding-flow-emitted artifact. Expected
phase: B, the publish step.

## What this document is not

This document frames. It does not enter AX-1 through AX-12 as claims in the store, because no store
exists yet: Stage 1 (the kernel generated through `vendor/scaffolder/new-kernel.mjs`) has not run.
It does not grade anything, because grading is the gate's computation over attached support, which
Stage 3 provides. Stating an axiom's expected ground here is a plan, not a certificate; the axiom
carries no standing until it is entered (Stage 2) and grounded (Stage 3). This repository does not
run ahead of that order.
