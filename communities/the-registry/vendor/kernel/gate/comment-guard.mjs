// Role: the comment-support guard. No record of kind "comment" may occupy a support role in any
//   link: admitting one into an existing support group would meet that group down to the floor (a
//   comment-bomb), since supportDelivery's within-group rule is weakest-of and a comment's earned
//   grade is always ungraded (capByCeiling pins it there). This closes the one adversarial seam the
//   floor-ceiling algebra alone leaves open.
// Contract: rejectCommentSupport(contribution, storeView) -> void; throws naming the rule
//   ("comment-support-barred") and the offending link's identity if any link with link_kind
//   "supports" resolves its from_identity to kind "comment". Pure, ESM; kernel imports only kernel.
// Invariant: this is gate-adjacent, not a gate change. kernel/schema/tables.mjs's kind bundle carries
//   no rules field a per-kind link-role restriction could ride (verified: grep the schema, there is
//   none), so this is deliberately NOT folded into gate.mjs's decide() as an implicit rule; it is a
//   separate, named, callable validation a caller (a provider's propose(), or a check) runs
//   alongside the gate. docs/sorry-ledger.md carries the ledger entry proposing a rules-vocabulary
//   extension that would let this be expressed as bundle data and enforced by the gate itself.
"use strict";

const RULE = "comment-support-barred";

export function rejectCommentSupport(contribution, storeView) {
  const entries = contribution.entries || [];
  const links = contribution.links || [];
  const cEntry = new Map(entries.map((e) => [e.identity, e]));
  const kindOf = (id) => (cEntry.has(id) ? cEntry.get(id).kind : (storeView && storeView.kindOf && storeView.kindOf.get(id)) || null);

  for (const l of links) {
    if (l.link_kind !== "supports") continue;
    if (kindOf(l.from_identity) === "comment") {
      throw new Error(`${RULE}: link ${l.identity} attempts to admit a comment (${l.from_identity}) into a support role; comments are barred from the support role by construction`);
    }
  }
}

export { RULE };
