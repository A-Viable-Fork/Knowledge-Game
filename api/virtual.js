// Role: the virtual layer (Phase KG-6b). Pending contributions (this device's own outbox entries)
//   render as their own ontology, translucent potentials, never an actual graded claim. Card kinds
//   complete into a triad here: actual claims (graded, solid), comments (gradeless discussion), and
//   virtuals (ghosted potentials, this module's own concern).
// Contract: virtualRowsFor(entries) -> row-shaped objects for periphery/card.js to render, each
//   {identity, kind, statement, virtual: true, virtualState}. virtualState is one of
//   periphery/virtual-states.js's own vocabulary (drafted, gate-passed, submitted), derived from the
//   outbox entry's own status (api/outbox.js's STATUSES), never the ladder's words.
//   computeLensImpact(community, entries) -> Map(identity -> {from, to}): the counterfactual standing
//   impact of admitting every one of entries, computed by applying their proposals onto a COPY of the
//   community's state (vendor/kernel/store/apply.mjs, itself pure and non-mutating) and re-running the
//   real grounding (vendor/api/providers/local-provider.mjs's createLocalProvider) over that copy,
//   never a second grounding implementation and never the community's own live state.
// Invariant: computeLensImpact never writes to community.raw or community.api; apply() already returns
//   a new state object rather than mutating its input, and this module discards its own copy after
//   reading it. build/check-virtual-isolation.mjs fuzzes outbox and lens states and asserts every
//   actual grade and certificate this module could reach stays byte-identical throughout, and that no
//   virtual record this module builds ever serializes into the mirror's own store.
"use strict";
import { apply } from "../vendor/kernel/store/apply.mjs";
import { createLocalProvider } from "../vendor/api/providers/local-provider.mjs";

const VIRTUAL_STATE_OF_STATUS = { queued: "gate-passed", submitted: "submitted", draft: "drafted" };

export function virtualRowsFor(entries) {
  return (entries || []).map((entry) => {
    const claim = (entry.bundle.proposal.entries || [])[0] || {};
    return {
      identity: claim.identity || entry.contributionId,
      kind: claim.kind || "claim",
      statement: claim.statement || "",
      virtual: true,
      virtualState: VIRTUAL_STATE_OF_STATUS[entry.status] || "drafted",
      contributionId: entry.contributionId,
      queuedAt: entry.queuedAt,
      lastRegate: entry.lastRegate,
      declined: entry.status === "draft",
      receipt: (entry.lastRegate && entry.lastRegate.receipt) || (entry.bundle && entry.bundle.receipt) || null,
    };
  });
}

// computeLensImpact: a copy-only counterfactual. entries' proposals union onto a fresh state object
// (apply() itself never mutates community.raw.state); the copy is read once through the real provider
// and discarded. Only entries whose bundle actually parses as {entries, links} contribute; a malformed
// or tampered entry is skipped here rather than thrown, since the lens is advisory, never a gate.
export function computeLensImpact(community, entries) {
  const raw = community.raw;
  let stateCopy = raw.state;
  const extraSources = [];
  for (const entry of entries || []) {
    const proposal = entry.bundle && entry.bundle.proposal;
    if (!proposal || !Array.isArray(proposal.entries)) continue;
    stateCopy = apply(stateCopy, { entries: proposal.entries, links: proposal.links || [] });
    for (const s of entry.extraSources || []) extraSources.push(s);
  }
  const provider = createLocalProvider({ state: stateCopy, sources: [...raw.sources, ...extraSources], kinds: raw.kinds });
  const counterfactualRows = provider.read({});
  const realByIdentity = new Map(community.api.read({}).map((r) => [r.identity, r.earned_grade]));
  const impact = new Map();
  for (const row of counterfactualRows) {
    const from = realByIdentity.has(row.identity) ? realByIdentity.get(row.identity) : "ungraded";
    if (row.earned_grade !== from) impact.set(row.identity, { from, to: row.earned_grade, statement: row.statement });
  }
  return impact;
}
