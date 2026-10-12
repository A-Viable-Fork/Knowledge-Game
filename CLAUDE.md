# The Knowledge Game

A mobile feed over communities of typed, graded claims, and the first app for the EpiStack protocol (A-Viable-Fork/epistack). The kernel runs on the device: the app fetches a community's snapshot, verifies its hash, and recomputes every grade itself (README.md).

## Shared conventions

The conventions every A-Viable-Fork repository shares are A-Viable-Fork/Repo-Infrastructure `kit/CONVENTIONS.md`. This repository has not vendored the kit yet (Repo-Infrastructure `ADOPT.md`); until it does, their core:

- No em or en dashes in authored text: commas, semicolons, colons, periods, or " - ".
- Say what a thing is, not what it is not. Terse prose; a list or table only for list-shaped content.
- Truth claims carry an evidence mark: **read** (seen in the source, at a commit where it matters), **secondary**, **inferred**, **recalled** (a lead, never the basis of a ruling), **unknown**. Verdicts are graded: confirmed, marginal, plausible, needs refinement, dead.
- The person rules; an agent proposes, records and recommends, and never records a person's decision as closed. Mark rulings `[ruling: who, date]`.
- Generation is marked as generation. Research reports and other model output are leads, not evidence: verify each source before anything lands on it.
- Nothing from a person's own device or life lands here unless they put it here themselves: no keys, tokens, phone numbers, device identifiers or account names. Examples are invented and say so.
- One concern per commit: a subject saying what changed, a body saying why. Push only to the branch the session names; open a pull request only when asked.

## Checks

The suite is `node build/check-*.mjs`, one script per property; each exits non-zero naming its violation. `.github/workflows/ci.yml` runs 40 of them in order, then:

- `cd communities/epistack-competition && node build/check.mjs` and `cd communities/the-registry && node build/check.mjs`: each founded community's self-contained check.
- `node build/emit-fixtures.mjs && git diff --exit-code app/fixtures`: fixtures are reproducible.
- `node build/emit-rooms.mjs && git diff --exit-code app/fixtures communities/rooms`: room snapshots and cards are reproducible.

The checks that bind the Tier 0 constraints (trellis/governing-trellis.md): `check-substrate` (vendored files match `upstream/lock.json`, lock commit matches the submodule), `check-imports` (one-way trust boundary), `check-egress` (no undeclared network destination), `check-ranking-separation` (ranking moves no grade), `check-vault` and `check-profile-leak` (vault data never enters a bundle), `check-ladder` (three distinct contribution states, forbidden words absent), `check-conformance-read` and `check-conformance-write` (an independent client reproduces the app), `check-neutrality` (founded artifacts name no client), `check-knowledge-game` (governance claims compute `checked`), `check-stages` (`trellis/stage-manifest.json` against git history), `check-references` (every `// Governs: claim-N` resolves; regenerates `docs/blast-radius.md`).

The checks need the submodule (`git clone --recurse-submodules`, README.md) and full history for `check-stages` (CI checks out with `fetch-depth: 0`).

## Layout

- `periphery/`: the PWA views and producers. Reaches the kernel only through `api/`.
- `api/`: the membrane: provider adapters, the contribution path, ranking, settings, the seams.
- `vendor/`: the pinned EpiStack substrate, copied from `upstream/epistack` (git submodule) by `build/vendor-extract.mjs`; `upstream/lock.json` pins the commit and file hashes.
- `vault/`: local personal data, exportable and deletable, structurally separate from public data.
- `kernel/governance/`: this repository's own governance kernel (claims about the app's behavior), generated through the vendored scaffolder.
- `communities/`: founded communities (`epistack-competition/`, `the-registry/`, each self-contained with its own vendor copy and check) and `rooms/` cards.
- `app/`: the app entry, styles, icons and snapshot fixtures. `index.html` at the root is the human entrance; `sw.js` is the service worker.
- `build/`: the checks and the generators. `manifests/`: capability, network and build-provenance declarations. `android/`: the TWA wrapper.
- `trellis/`: governing trellis, design axioms, sorry ledger, status ledger, stage manifest, parameters register, exclusion reservoir. `docs/`: specification, architectural reading, status report, invitation, blast radius.

## Rules stated in this repository

- `docs/specification.md` governs over the earlier guide; where it and the upstream protocol disagree, the protocol governs (docs/specification.md, preamble).
- The trust boundary runs one way: `periphery/` -> `api/` -> `vendor/kernel/`; no local module defines a claim or link shape outside the vendored schema (trellis/governing-trellis.md G0-1, G0-2).
- The upstream repository is never modified from here; vendored files are never edited; a local departure is a named patch recorded in `upstream/lock.json` (docs/specification.md section 3; build/vendor-extract.mjs header).
- Personal data in `vault/` never enters a public patch; every network destination is declared in `manifests/network.json` before the call exists; no tokens, cryptocurrency or financial incentives (trellis/governing-trellis.md G0-3, G0-5, G0-10).
- Gate-passed, admitted and semantically accepted render as three distinct states; a passed gate receipt is never labeled true or validated (G0-6, G0-7).
- Grades are computed by the gate; nothing asserts a grade by hand (llms.txt; README.md).
- Build status is asserted only in `trellis/status-ledger.md`; nothing is called built until a named check enforces it (trellis/status-ledger.md, The discipline).
- Every gap marker has a row in `trellis/sorry-ledger.md` with ids `SK-n` (trellis/sorry-ledger.md, Format). An excluded pattern enters `trellis/exclusion-reservoir.md` with its reactivation condition (its header).
- A claim's behavior is bound in code by a `// Governs: claim-N: <sentence>` comment (build/check-references.mjs). Code files open with `Role:`, `Contract:` and `Invariant:` header lines (practice in `build/`, `sw.js`).
- After adding, removing or changing any file: `node build/compute-release-hash.mjs` rewrites `manifests/build-provenance.json`, the per-file hashes of the deployed tree, which `build/check-release.mjs` compares (both headers).
- Generated, never hand-edited: `vendor/` (build/vendor-extract.mjs), `docs/blast-radius.md` (build/check-references.mjs), the `sw.js` precache list (build/shell-files.mjs), `app/fixtures/` (build/emit-fixtures.mjs, build/emit-rooms.mjs), `communities/rooms/` (build/emit-rooms.mjs).
- Contributions to a community arrive as pull requests whose gate re-runs in CI; comment bundles auto-admit only under `admission_policy.comment_admission` (communities/epistack-competition/README.md).
