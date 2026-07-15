---
Type: record
Purpose: Patterns considered and rejected for this deployment, with the condition that would reactivate them. A kill without its reactivation condition is a kill that cannot be revisited, per the discipline upstream's own exclusion reservoir holds itself to.
Depends on: docs/architectural-reading.md
Depended on by: nothing yet
---

# Exclusion Reservoir

Opens empty. No design pattern has been rejected yet; this repository has not built enough for one
to have come up.

## Format

- **Pattern.** What was considered.
- **Excluded.** Why, naming the constraint it would violate (a governing-trellis constraint id where
  applicable).
- **Reactivate.** The condition under which it would be reconsidered, or "never" where none exists.
