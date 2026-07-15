---
Type: reference
Purpose: Capability, network, and build-provenance manifests, machine-readable and declared-empty until a phase's code earns a wider claim.
Depends on: trellis/governing-trellis.md
Depended on by: nothing yet
---

# manifests/

Three manifests, scaffolded with declared-empty capability sets per Step 4 of the init prompt. No
code reads or enforces any of them yet; they are commitments Phase A's checks will hold the codebase
to, not yet checked properties themselves.

- `capability.json`: permissions, profile-upload policy, ranking execution location.
- `network.json`: allowed egress destinations, telemetry policy.
- `build-provenance.json`: source commit, upstream pin, build command, artifact hash, protocol
  identity.
