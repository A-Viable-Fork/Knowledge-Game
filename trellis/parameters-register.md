---
Type: reference
Purpose: This deployment's own Tier 1 defaults (spec Section 6), and the fields reserved inactive for the two seams that have no active implementation in v1 (spec Section 5). Distinct from upstream's parameters-register.md, which draws the fixed-versus-free line for the protocol itself; this document draws the analogous line for this deployment's own local policy.
Depends on: docs/architectural-reading.md, trellis/governing-trellis.md
Depended on by: nothing yet
---

# Parameters Register

This deployment's own free parameters and their defaults, distinct from the protocol-level register
upstream already owns (`vendor` carries no copy of it; it is read at
`upstream/epistack/docs/parameters-register.md` when needed). Nothing below is enforced by code yet;
this document names the default a later phase's code is held to.

## Tier 1 defaults (spec Section 6)

**The null-objective order.** With ranking off, the feed is grounding-sorted then recency. This is
the Tier 1 default the trellis's own no-grade-motion check (A-3, A-4) will hold Phase A's ranking
module to.

**Opt-in observation.** Behavioral observation of scrolling and dwell, if ever implemented, is
toggleable and default off; if on, it is exposed as typed local observations, never collected
silently. No observation code exists yet; this is the default any future observation module must
open in.

**Disclosure defaults.** The three-level card disclosure (spec Section 6): Level 1 carries
statement, type, standing, origin, and why-selected; Level 2 carries supports, challenges,
provenance, open gaps, and (Phase KG-4) discussion; Level 3 carries actions (propose support, propose
undercut, propose qualification, contest, fork the type, comment, watch, export contribution). The
elaborate Level 3 of the prior version (crossing history, alternative frames, crux candidates) is
specified and deferred, per spec Section 6.

**The type filter default (Phase KG-4).** A fresh profile excludes nothing: every kind present in the
active graph, including `untyped` and `comment`, is shown until a reader explicitly hides one. The
exclusion is per-community, persisted in the vault, and always stated on the filter bar.

**Extension conformance is the only gate (Phase KG-4).** No extension, first-party or not, is trusted
by declared shape alone: every install runs the same conformance path (the sandbox-fetch-denial
probe, plus the ranking-separation fuzz for a ranker), and a passed candidate carries its conformance
receipt in the vault's extension registry. There is no default-installed extension; the
learn-efficiently ranker activates only as onboarding's own act, never silently.

**Onboarding defaults (Phase KG-4).** A fresh profile has not seen onboarding; the first load shows it
before any requested route. Skipping at any point records nothing (no followed topics, no active
ranker) and reaches the originally requested view. Entering at least one topic activates the
learn-efficiently ranker as the default objective.

**Standing-motion alerts default (Phase KG-4).** A fresh profile watches nothing; the alerts panel is
always present (never omitted) but empty until a reader watches a claim. A watch persists the claim's
last-seen grade, per community, refreshed on every load so the next diff is against this load, not a
stale one.

## Reserved-inactive fields (the hot-swap seams, spec Section 5)

**Identity-threshold parameters, per action.** The community founding flow (Phase B) will collect
and store an identity-threshold value per contribution action (propose, contest, vouch) in every
community's parameter record. These fields are reserved now and marked
`inactive-until-credential-seam-active`: no code reads them in v1, because the credential seam's v1
evaluator (spec Section 5) permits any action any community's other parameters allow, with no
identity requirement. In v1, contributions ride the GitHub-native PR path, which names the pusher,
so v1 offers no anonymity at the transport layer: the presentation machinery, once built, guarantees
the attestation graph itself carries no linkage, but the admission path still names who pushed.
Anonymity claims are therefore scoped to the graph, not the transport; agent-side de-anonymization
is always unilateral (an agent can later prove which acts were theirs, but absent an opening
authority no one can prove it about them); and transport-level anonymity (relays, submission
intermediaries) is its own gap, ledgered separately from the credential seam itself. When upstream's
real credential evaluator (`api/credential.js`'s eventual non-stub implementation) lands, these same
fields begin evaluating without any community needing re-founding.

**Standing-economy parameters.** A field is reserved in every community's parameter record for a
future standing-economy configuration (time-lock cost, decay rate, Sybil-resistant weighting curve).
No code reads this field in v1; the standing economy seam (spec Section 5) is absent entirely until
upstream's coordination layer (`docs/coordination-layer-spec.md`) lands as working code, which it is
not as of this pin.

Both reservations exist so that a community founded under this deployment's v1 never needs
re-founding when either seam's real implementation arrives; the parameter record's shape is fixed
now, only its evaluation is deferred.
