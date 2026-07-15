// Role: the type-contest interface. contestType constructs a gate-admissible claim whose subject is a
//   type-hash. A type is a community's semantic policy frozen into checkable structure; contesting it
//   is a semantic act, so the kernel records the contest and adjudicates nothing.
// Contract: contestType(typeHash, contest) -> { claim, links, contribution, receipt }. The claim is a
//   forum-kind claim (its ceiling is what a policy judgment can honestly earn); the subject type-hash
//   is bound in the record's extension area, hashed and read by no check. Pure; api imports kernel and
//   api, never the periphery. The caller runs the contribution through the ordinary gate, no bypass.
// Invariant: A CONTEST CHANGES NO GRADE. The contest references a type, it supports or contaminates no
//   claim typed under it, so admitting it leaves every pre-existing claim's earned grade and
//   certificate byte-identical. Resolution (amend nothing, fork, or re-pin) is a community act outside
//   the kernel; only a community's typing act moves standing, through the crossing rules that exist.
"use strict";
import { claimRecord, linkRecord } from "../kernel/schema/records.mjs";
import { hashOf } from "../kernel/schema/canonical.mjs";
import { acceptsOverrides } from "./fork.js";

// the kind a contest claim takes: forum. A contest is a judgment about a community's semantic policy,
// not a measurement of the world or a constitutive act, so its honest ceiling is the open forum band
// (corroborated), which a contest can earn by independent agreement and never exceed. No kind is added
// to the schema; forum is an existing kind, and this reuses it rather than minting a contest kind.
const CONTEST_KIND = "forum";

export function contestType(typeHash, contest) {
  if (!typeHash || typeof typeHash !== "string") throw new Error("contestType: typeHash (the subject) required");
  const c = contest || {};
  if (!c.statement) throw new Error("contestType: contest.statement (what about the type is contested) required");
  // the subject binding: the type-hash rides the record's extension area, the honest place for a
  // subject the kernel records but never adjudicates. Undeclared top-level fields on a claim route
  // into `extensions` (records.mjs), canonicalized and hashed and read by no check, so the contest's
  // subject is tamper-evident in the record without the gate ever reading or judging it.
  const claim = claimRecord({
    kind: CONTEST_KIND,
    statement: c.statement,
    source_id: c.source_id || "S-contest",
    contributor_id: c.contestant || c.contributor_id || "P-contest",
    declared_grade: c.declared_grade || "asserted",
    checking_records: c.checking_records,
    subject_type_hash: typeHash,
    contest_of: "type", // records that this claim's subject is a type, inert metadata in the extension area
  });
  // the support the contest cites grounds the contest CLAIM itself (supports into it), never a support
  // out of it into some other claim; a contest earns its own standing and moves no one else's.
  const links = (c.support || []).map((s) =>
    linkRecord({
      link_kind: "supports",
      from_identity: s.from_identity,
      to_identity: claim.identity,
      support_group: s.support_group,
      source_id: s.source_id || claim.source_id,
      contributor_id: s.contributor_id || claim.contributor_id,
      declared_grade: s.declared_grade || "asserted",
    })
  );
  const contribution = {
    hash: hashOf({ contest_of: typeHash, entries: [claim.identity], links: links.map((l) => l.identity) }),
    entries: [claim],
    links,
  };
  // convertible: the contest carries a departure forkType would accept, so a sustained contest converts
  // to a fork mechanically (feed contest.claimedDeparture to forkType as its overrides). Whether the
  // departure also differs from the pinned bundle is decided at fork time against that bundle.
  const convertible = c.claimedDeparture !== undefined && acceptsOverrides(c.claimedDeparture);
  const receipt = {
    operation: "contest-type",
    type_hash: typeHash,
    claim_hash: claim.hash,
    convertible,
    persisted: false,
    note: "the contest is a gate-admissible claim whose subject is a type-hash; the kernel records it and adjudicates nothing, and it changes no existing grade. Resolution (amend nothing, fork, or re-pin) is a community act; durable persistence is Stage 4, specified not built",
  };
  return { claim, links, contribution, receipt };
}
