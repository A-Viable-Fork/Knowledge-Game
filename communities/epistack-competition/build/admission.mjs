// Role: admission-policy enforcement (Phase KG-11 Step 4), this community's own mechanism, self-
//   contained. The founding config's own admission_policy.comment_admission is the only switch a
//   community operator can set: "manual" (the default) leaves every bundle, comment or otherwise,
//   waiting on the maintainers' own pull-request review, exactly as before this phase; "auto-during-
//   window" additionally admits a comment-kind bundle automatically while now falls inside the
//   declared [starts_at, ends_at] window, because a comment carries no epistemic weight (ungraded,
//   never citable, pure discussion, KG-4's own never-citable rule) and gating discussion behind a
//   manual merge for the length of a judging window serves no one; claims, supports, contests, and
//   every other kind remain the maintainers' own act always, in every mode.
// Contract: decideAdmission(policy, bundle, nowMs) -> { admit: boolean, reason: string }. policy is
//   founding-config.json's admission_policy.comment_admission shape ({ mode: "manual" |
//   "auto-during-window", window: { starts_at, ends_at } | null }, ISO 8601 strings). bundle is a
//   gate-passed contribution bundle (vendor/api/contribution.js's own exported shape); every one of
//   its proposal.entries must be kind "comment" for auto-admission to apply.
// Invariant: admit is true only when mode is exactly "auto-during-window" AND every proposal entry's
//   kind is exactly "comment" AND nowMs falls within the window's [starts_at, ends_at] inclusive. A
//   bundle mixing a comment with any other kind, or proposing a non-comment kind alone, is refused
//   regardless of mode or window: this is the one enforcement point that keeps "auto-admission applies
//   to comment kinds only" true no matter how the policy is configured. admit-inbox.mjs is the only
//   caller that acts on this decision; build/check-submission-surface.mjs drives it directly with
//   fixtures, never a live schedule.
"use strict";

export function decideAdmission(policy, bundle, nowMs) {
  const mode = (policy && policy.mode) || "manual";
  const entries = (bundle && bundle.proposal && bundle.proposal.entries) || [];
  if (!entries.length) return { admit: false, reason: "bundle carries no proposal entries" };

  if (mode !== "auto-during-window") {
    return { admit: false, reason: `admission mode is "${mode}"; every bundle awaits the maintainers' own pull-request review` };
  }

  const allComments = entries.every((e) => e.kind === "comment");
  if (!allComments) {
    return { admit: false, reason: "auto-admission applies to comment-kind bundles only; this bundle proposes a non-comment kind and always waits for manual review" };
  }

  const window = policy.window;
  if (!window || !window.starts_at || !window.ends_at) {
    return { admit: false, reason: "auto-during-window mode is set but no window is declared; refusing rather than admitting with no bound" };
  }
  const starts = Date.parse(window.starts_at);
  const ends = Date.parse(window.ends_at);
  if (!Number.isFinite(starts) || !Number.isFinite(ends)) {
    return { admit: false, reason: `window dates do not parse (starts_at: ${window.starts_at}, ends_at: ${window.ends_at}); refusing rather than admitting with no bound` };
  }
  if (nowMs < starts || nowMs > ends) {
    return { admit: false, reason: `now (${new Date(nowMs).toISOString()}) falls outside the declared window (${window.starts_at} to ${window.ends_at}); awaiting manual review` };
  }
  return { admit: true, reason: `comment-kind bundle admitted automatically: now falls within the declared judging-window (${window.starts_at} to ${window.ends_at})` };
}
