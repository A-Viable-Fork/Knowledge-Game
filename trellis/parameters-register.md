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
provenance, and open gaps; Level 3 carries actions (propose support, propose undercut, propose
qualification, contest, fork the type, export contribution). The elaborate Level 3 of the prior
version (crossing history, alternative frames, crux candidates) is specified and deferred, per spec
Section 6.

## Reserved-inactive fields (the hot-swap seams, spec Section 5)

**Identity-threshold parameters, per action.** The community founding flow (Phase B) will collect
and store an identity-threshold value per contribution action (propose, contest, vouch) in every
community's parameter record. These fields are reserved now and marked
`inactive-until-credential-seam-active`: no code reads them in v1, because the credential seam's v1
evaluator (spec Section 5) permits any action any community's other parameters allow, with no
identity requirement. When upstream's real credential evaluator (`api/credential.js`'s eventual
non-stub implementation) lands, these same fields begin evaluating without any community needing
re-founding.

**Standing-economy parameters.** A field is reserved in every community's parameter record for a
future standing-economy configuration (time-lock cost, decay rate, Sybil-resistant weighting curve).
No code reads this field in v1; the standing economy seam (spec Section 5) is absent entirely until
upstream's coordination layer (`docs/coordination-layer-spec.md`) lands as working code, which it is
not as of this pin.

Both reservations exist so that a community founded under this deployment's v1 never needs
re-founding when either seam's real implementation arrives; the parameter record's shape is fixed
now, only its evaluation is deferred.
