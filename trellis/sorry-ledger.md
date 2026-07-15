---
Type: record
Purpose: The live obligations ledger. Every gap marker this repository's own code carries (governing-trellis A-9 / G0-9) is listed here one to one; a future check will fail on a marker with no entry here or an entry with no live marker, mirroring upstream's own linter rule 3.
Depends on: trellis/governing-trellis.md, trellis/design-axioms.md
Depended on by: nothing yet
---

# Sorry Ledger

Opens empty. No code exists yet to carry a gap marker.

## Format

| Sorry | Obligation | Status | Opened |
|---|---|---|---|

Each row, when one exists, names: a stable id (`SK-n`, distinct from upstream's own `G-*` and `SG-*`
ids so the two ledgers never collide if read side by side); the obligation in one sentence; its
status (`Open`, `Discharged`, with the discharging commit or check named); and the phase or stage it
opened in.
