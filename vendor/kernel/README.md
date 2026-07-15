---
Type: reference
Purpose: Describes the trusted core layer for a reader who has opened kernel/, deferring the whole-system story upward.
Depends on: nothing
Depended on by: nothing
Code depends on: nothing
Code depended on by: api/README.md
---

# kernel/

This is the trusted core: the domain-agnostic machinery that grounds claims. It is the schema that says what a well-formed claim and edge are, the gate that admits a contribution only when it holds together with what is already there, and the grounding rule that computes a claim's standing from what it rests on. This is the contribution the submission is built around; everything else exists to demonstrate it.

## What it is responsible for, and what it may never do

It is responsible for one thing done exactly: computing standing as a property of structure, the same way for everyone, so a claim's grade is checkable rather than granted. It owns the schema, the confidence order, the gate, the contamination rule, and the readings over the graph (robustness, reconciliation, gaps).

It may never reach up or out. It is pure logic and DOM-free: no `window`, no `document`, no network, no reading of a render surface or an AI component. It runs headless. It depends on nothing above it, which is what lets a distrusting reader recompute any standing from the kernel and the public graph alone.

## What it exposes, and what it depends on

Upward, it exposes the record types, the grounding computation, the gate's `decide`, and the readings, all consumed only through `api/` (the periphery never imports the kernel directly). Downward there is nothing: the kernel is the floor of the dependency graph. It reads `corpora/` only as pure data passed to it, never importing out. `schema/` imports only the rest of `kernel/`.

## The invariant it enforces

A claim's standing is a property of its structure, computed the same for every producer. Grounding never advertises more standing than a claim's necessary supports carry (the contamination rule), the gate admits only what its declared grade earns, and every result is derived on read, never stored.

Producer-agnosticism lives here, at its source: the kernel checks the claim, not the claimant. A producer that is a person, a model, or a pipeline is treated identically, because the check is over the claim's structure and provenance, not over what emitted it. Any policy about which producers may do what is configured elsewhere, in the free tier of `docs/parameters-register.md`, not here; the kernel holds only the required invariants that make a crossing safe.

## What lives here

- `schema/`, the one schema: record types, the confidence order and its lattice, the reference tables.
- `gate/`, the sole write check: canonical form, earned grade, admit or decline with the failing check named.
- `grounding/`, the earned-grade rule and the contamination fold.
- `analysis/`, the readings over the graph: robustness, reconciliation and the crux, characterized gaps.
- `composition/`, cross-store citation, the untyped-type crossings, framing and presupposition edges.
- `store/`, the graph state, the content-addressed history, decay and supersession.
- `motions/`, the perturbation overlay and decompose.

---

For the whole-system argument, see the top-level [`README.md`](../README.md) and the judges document [`docs/what-stands-without-trust.md`](../docs/what-stands-without-trust.md). For how to work in this tree, see the agent orientation in [`CLAUDE.md`](../CLAUDE.md).
