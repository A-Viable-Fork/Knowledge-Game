// Role: the front-page kernel reference tables. KINDS are the three adopted common kinds this
//   kernel pins (measurement, declaration, forum), never a local kind: the front page's own
//   decomposition needs nothing the shared type subtree does not already carry. SOURCES names the
//   front page's own two citing sources (its own stipulation, and the epistack submission it doors
//   into). ADOPTED and ADOPTED_HASHES freeze the pinned type-hashes at adoption, read from
//   vendor/corpora/_shared/common-types.js, exactly as kernel/governance/corpora/tables.js already
//   adopts "measurement" alone.
// Contract: exports KINDS, SOURCES, ADOPTED, ADOPTED_HASHES, TIME_LOCK. Pure data; imports nothing.
// Invariant: every kind here is a shared common bundle; build/check-type-hash.mjs's own verification
//   extends to this kernel's ADOPTED_HASHES the same way it already covers governance's.
"use strict";

const KINDS = [
  { "kind": "measurement", "ceiling": "checked" },
  { "kind": "declaration", "ceiling": "constitutive" },
  { "kind": "forum", "ceiling": "corroborated" }
];

const SOURCES = [
  {
    "source_id": "S-fp-self-declared",
    "source_class": "institutional-report",
    "description": "this deployment's own front page (index.html): the submission's argument, restated as the definitional and app-behavior claims the page itself stipulates or already grounds elsewhere in this kernel"
  },
  {
    "source_id": "S-fp-epistack-submission",
    "source_class": "institutional-report",
    "description": "the epistack submission repository's own docs and corpora, cited by the front page's own doors; these claims enter at the honest floor a citation alone ever earns, awaiting a local fork that would type them"
  }
];

// the shared common kinds this kernel adopts (names), and the type-hashes pinned at adoption.
const ADOPTED = [
  "measurement",
  "declaration",
  "forum"
];
const ADOPTED_HASHES = {
  "measurement": "2ed60a0154fef12d5d630f4a3f52d06686479c75aa57a44fd3b1488d581d3621",
  "declaration": "354cba45e263a9788064fbf35d71d8506dd93ddf8c35b092ba606e5c2cc3b1bd",
  "forum": "04c5a97678a1228065e6c36068b0b3dcc12ca52ad1285e6727f49754030007a1"
};

// time-lock and standing (F5): the one clean free parameter, no grounding consequence.
const TIME_LOCK = {
  "setting": "light"
};

module.exports = { KINDS, SOURCES, ADOPTED, ADOPTED_HASHES, TIME_LOCK };
