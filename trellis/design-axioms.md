---
Type: reference
Purpose: The code-tier restatement of the governing trellis, at the grain of modules and imports. These are the same axioms kernel/governance/stage-0.md enters as governance claims in waiting; this document is where they are stated for a reader of the code rather than a reader of the kernel.
Depends on: trellis/governing-trellis.md
Depended on by: kernel/governance/stage-0.md
---

# Design Axioms

*The governing trellis's twelve Tier 0 constraints, restated at the grain of modules and imports.
Numbered A-1 through A-12 to match `trellis/governing-trellis.md`'s G0-1 through G0-12 one for one.
These are also the Stage 0 axioms: `kernel/governance/stage-0.md` enters this same list as governance
claims in waiting, framed rather than entered, per the workflow track's Stage 0 discipline.*

**A-1. One trust boundary, one direction of dependency.** `periphery/` imports only `api/`; `api/`
imports `vendor/kernel/` (never the reverse) and nothing in `periphery/`; `vendor/kernel/` imports
only itself. Intended check: an import-graph oracle, landing with Phase A's first periphery file.
Mirrors upstream's own T0-2 / G0-1.

**A-2. One canonical schema source.** No local module defines a claim or link shape; every claim and
link this deployment ever produces is built through `vendor/kernel/schema/records.mjs`. Intended
check: a grep-style assertion, landing with the first local module that touches a claim shape (Phase
A).

**A-3. Ranking never moves standing.** No ranking module writes to, or is read by, any path that
computes a grade, a receipt, a robustness reading, or a support structure. Intended check: the
no-grade-motion property test, perturbing the ranking objective vector arbitrarily and asserting
every grade and certificate stays byte-identical, landing with Phase A's ranking module.

**A-4. The active ranking objective is always visible; the null objective is deterministic.** With
ranking off, the feed is grounding-sorted then recency, and every card can answer "why am I seeing
this." Intended check: an objective-visibility and null-objective-determinism test, landing with
Phase A.

**A-5. Personal data never enters a public patch.** No field of an exported contribution bundle
traces to `vault/`. Intended check: a contribution-export field-provenance test, landing with the
Phase A/B contribution path.

**A-6. No undeclared network egress; no third-party analytics.** Every network destination this
deployment ever calls is named in `manifests/network.json` before the call exists. Intended check: a
network-request assertion under test, landing with Phase A's PWA shell.

**A-7. Gate passage, admission, and semantic acceptance are three distinct rendered states.** No
surface ever implies one from another, and a passed receipt is never labeled true or validated.
Intended check: a copy-and-label audit over every contribution-bearing surface, landing with Phase
A/B.

**A-8. All inherited substrate code is pinned, hashed, and attributable.** Local departures are
explicit named patches, never silent edits to `vendor/`. **Checked** by `build/check-substrate.mjs`
as of Step 3; this is the one axiom already enforced.

**A-9. Gaps are ledgered, never hidden.** Every unresolved obligation this deployment's own code
carries appears in `trellis/sorry-ledger.md`. Intended check: a sorry-ledger cross-reference check,
landing when the first gap is entered (Phase A).

**A-10. No financial instrument exists in this deployment's schema or manifests.** No token,
currency, stake, or incentive field is ever declared locally. Intended check: a schema and manifest
grep, landing with Phase A.

**A-11. This client is unprivileged.** No module in `periphery/` reaches a capability that a
third-party client built from the vendored public `api/` alone would lack. Intended check, two
parts: the import-graph oracle (A-1's check, reused) and the second-client conformance check (an
independent minimal client built in CI from `vendor/api/` alone, reproducing every app capability
against the same published artifacts). The read half lands with Phase A, the write half with Phase
B.

**A-12. Client-neutral artifacts.** No community, snapshot, card, or contribution-target scaffold
this app's founding flow emits carries any reference to this app. Intended check: the neutrality
check, a grep over every founding-flow-emitted artifact, landing with Phase B's publish step.

## Comment conventions

Carried forward from the upstream design axioms this deployment inherits, unchanged: a module head
states role, contract, and invariant; `// SORRY:` marks an honest gap, `// DEPARTURE:` marks a
deliberate local divergence from a shared pattern, `// CONTRACT:` marks a layer boundary. Every
`SORRY` marker this deployment's own code carries must appear in `trellis/sorry-ledger.md` per A-9.
