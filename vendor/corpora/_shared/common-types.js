// Role: the seed of the shared type subtree. Holds the type bundles for the kinds more than one kernel
//   pins in common (measurement, forum, declaration, comment) and their content-address type-hashes, so
//   a case that uses a common kind references the shared hash here rather than minting its own meaning
//   for it. This is the data a kernel reads to declare which shared types it adopts.
// Contract: exports COMMON_BUNDLES (kind -> bundle) and COMMON_TYPE_HASHES (kind -> hex hash). Pure
//   data; imports nothing. The hashes are authored constants, verified against hashTypeBundle by
//   build/check-type-hash.mjs, so a bundle change that is not reflected here is caught.
// Invariant: a bundle is { kind, ceiling, compatibility_rule_id, atlas_refs }, the kind plus the
//   apparatus that gives it meaning. The field shape is fixed so the adoption layer builds byte-identical
//   bundles over the live case tables; changing a bundle changes its hash and must update the literal.
// The comment kind: discussion without claiming. Its ceiling is pinned at the lattice floor
//   (ungraded), so join with bottom is identity and a comment thread can be added to or removed from
//   the graph without moving any grade, checked by build/check-comment.mjs. A comment is never
//   citable as support (kernel/gate/comment-guard.mjs); the two link kinds a comment travels on,
//   comments-on and replies-to, carry no support role by construction (records.mjs's LINK_KINDS).
"use strict";

// the common kind bundles: the kind, its ceiling, and the (here empty) rule and atlas footings that
// would further fix its meaning. compatibility_rule_id null and atlas_refs [] are the honest current
// state: these kinds are fixed by kind + ceiling alone, and any later rule or atlas tie changes the hash.
const COMMON_BUNDLES = {
  measurement: { kind: "measurement", ceiling: "checked", compatibility_rule_id: null, atlas_refs: [] },
  forum: { kind: "forum", ceiling: "corroborated", compatibility_rule_id: null, atlas_refs: [] },
  declaration: { kind: "declaration", ceiling: "constitutive", compatibility_rule_id: null, atlas_refs: [] },
  comment: { kind: "comment", ceiling: "ungraded", compatibility_rule_id: null, atlas_refs: [] },
};

// the type-hashes over those bundles (build/check-type-hash.mjs verifies each equals hashTypeBundle).
const COMMON_TYPE_HASHES = {
  measurement: "2ed60a0154fef12d5d630f4a3f52d06686479c75aa57a44fd3b1488d581d3621",
  forum: "04c5a97678a1228065e6c36068b0b3dcc12ca52ad1285e6727f49754030007a1",
  declaration: "354cba45e263a9788064fbf35d71d8506dd93ddf8c35b092ba606e5c2cc3b1bd",
  comment: "2a9e3db197c0eb335140a53e384059547817fe1b5f8918d64adb533581432bef",
};

module.exports = { COMMON_BUNDLES, COMMON_TYPE_HASHES };
