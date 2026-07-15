---
Type: reference
Purpose: The membrane. The sole door from periphery/ to the vendored kernel: provider adapters, the credential seam's local evaluator, and the contribution path.
Depends on: vendor/api/client-api.mjs, vendor/api/providers/local-provider.mjs, vendor/api/credential.js
Depended on by: nothing yet
---

# api/

Empty but headed. No local module exists yet. This is where the credential seam's v1 open-policy
evaluator will live, beside the vendored `vendor/api/credential.js` stub it wraps rather than edits
(architectural-reading.md Section 4, seam 1). `periphery/` will reach `vendor/api/client-api.mjs`
only through modules in this directory, never directly, per governing-trellis G0-1 / design-axioms
A-1.
