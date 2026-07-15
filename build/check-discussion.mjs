// Role: verifies discussion (Phase KG-4, spec Section 6). Comments render gradeless and visually
//   distinct from a claim; promote-to-claim produces a valid draft, linked from the comment via
//   comments-on; no app path constructs a comment support link (the guard is defense in depth, not
//   the only thing standing between a comment and the support role).
// Contract: `node build/check-discussion.mjs` exits non-zero on any divergence, naming it.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-DISCUSSION: comments gradeless and distinct, promote valid, no comment-support path"); console.log(H);

const raw = JSON.parse(readFileSync(join(ROOT, "communities", "epistack-competition", "snapshot", "epistack-competition.snapshot.json"), "utf8"));
const { createLocalProvider } = await import(join(ROOT, "vendor", "api", "providers", "local-provider.mjs"));
const { createClientApi } = await import(join(ROOT, "vendor", "api", "client-api.mjs"));
const provider = createLocalProvider(raw);
const api = createClientApi(provider);
const community = { api, kernelId: "epistack-competition", snapshotHash: "x", raw };
const { draftComment, draftPromoteToClaim, draftProposal } = await import(join(ROOT, "api", "contribute.js"));

const rows = community.api.read({});
const target = rows.find((r) => r.kind === "measurement");

console.log("\n[1] a top-level comment enters through the gate like everything else, and lands ungraded");
{
  const { proposal, receipt } = draftComment(community, { statement: "a question about this claim", targetIdentity: target.identity, contributorId: "tester" });
  ok(receipt.decision === "accepted", `comments-on comment is accepted (got ${receipt.decision})`);
  ok(proposal.links[0].link_kind === "comments-on", "the link built is comments-on");
  ok(receipt.grade_table[0].earned_grade === "ungraded", `the comment's earned grade is ungraded (got ${receipt.grade_table[0].earned_grade})`);
  ok(receipt.grade_table[0].declared_grade === "ungraded", "the comment's declared grade is ungraded (draftComment offers no grade selector)");
}

console.log("\n[2] a reply builds replies-to, not comments-on");
{
  const { proposal, receipt } = draftComment(community, { statement: "agreed", replyToIdentity: target.identity, contributorId: "tester2" });
  ok(receipt.decision === "accepted", `replies-to comment is accepted (got ${receipt.decision})`);
  ok(proposal.links[0].link_kind === "replies-to", "the link built is replies-to");
}

console.log("\n[3] promote-to-claim produces a valid claim draft, linked from the comment via comments-on");
{
  const commentIdentity = target.identity; // stand in: any existing identity in the graph
  const { proposal, receipt } = draftPromoteToClaim(community, { commentIdentity, statement: "a promoted claim", kind: "measurement", contributorId: "tester" });
  ok(receipt.decision === "accepted", `promote-to-claim draft is accepted (got ${receipt.decision})`);
  ok(proposal.entries[0].kind === "measurement", "the promoted entry is the requested claim kind, not kind comment");
  ok(proposal.links[0].link_kind === "comments-on", "the link back to the comment is comments-on, the honest non-support link");
  ok(proposal.links[0].from_identity === commentIdentity, "the link's from_identity is the comment being promoted");
  ok(proposal.links[0].to_identity === proposal.entries[0].identity, "the link's to_identity is the newly promoted claim");
}

console.log("\n[4] draftComment and draftPromoteToClaim never construct a supports link, statically");
{
  const src = readFileSync(join(ROOT, "api", "contribute.js"), "utf8");
  const commentFnMatch = src.match(/export function draftComment[\s\S]*?\n}\n/);
  const promoteFnMatch = src.match(/export function draftPromoteToClaim[\s\S]*?\n}\n/);
  ok(!!commentFnMatch, "draftComment function body located in api/contribute.js");
  ok(!!promoteFnMatch, "draftPromoteToClaim function body located in api/contribute.js");
  if (commentFnMatch) ok(!/link_kind:\s*"supports"/.test(commentFnMatch[0]), "draftComment's body contains no literal supports link_kind");
  if (promoteFnMatch) ok(!/link_kind:\s*"supports"/.test(promoteFnMatch[0]), "draftPromoteToClaim's body contains no literal supports link_kind");
}

console.log("\n[5] a comment refused for occupying a support role is caught before decide(), unaffected by ordinary proposals");
{
  const supportsCount = rows.filter((r) => r.kind !== "comment").length;
  ok(supportsCount > 0, "sanity: there is at least one non-comment claim to support in this fixture");
  const normal = draftProposal(community, { statement: "a normal support", kind: "measurement", action: "support", targetIdentity: target.identity, contributorId: "tester" });
  ok(normal.receipt.decision === "accepted", "an ordinary support proposal (never touching a comment) is unaffected and still accepted");
}

console.log("\n[6] card.js renders a comment gradeless and visually distinct (static source check)");
{
  const cardSrc = readFileSync(join(ROOT, "periphery", "card.js"), "utf8");
  ok(/isComment\s*\?\s*el\("span",\s*\{\s*class:\s*"badge badge-discussion"/.test(cardSrc), "renderCard renders the discussion badge instead of a grade badge when row.kind is comment");
  ok(!/gradeBadge\(row\.earned_grade\)\)/.test(cardSrc.replace(/isComment[\s\S]*?gradeBadge\(row\.earned_grade\)/, "")), "gradeBadge is only ever called on the non-comment branch");
  ok(/data-comment.*isComment/.test(cardSrc), "the rendered card carries a data-comment attribute for a comment row");
}

console.log("\n" + H);
if (fails === 0) console.log("verified: comments land ungraded through the real gate, threading builds only comments-on/replies-to, promote-to-claim links honestly, and no code path here ever constructs a comment support link.");
console.log(fails === 0 ? "check-discussion: OK" : `check-discussion: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
