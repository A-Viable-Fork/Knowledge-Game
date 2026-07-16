# EpiStack Competition Community

a community kernel grounding the protocol's own mechanical guarantees against the pinned reference implementation's own check suite, and holding the submission's evaluative theses bare, at their honest floor, awaiting semantic acceptance by the judges and participants who alone can give it

Domain: the EpiStack protocol and its competition submission

This is an EpiStack community kernel, self-contained (vendor/kernel/ is its own vendored copy). Its snapshot is at snapshot/epistack-competition.snapshot.json; its community card is community-card.json. A pull request against this repository carrying a contribution bundle re-runs the gate (build/check.mjs) before merge.

Admission policy (Phase KG-11 Step 4): founding-config.json's admission_policy.comment_admission is the operator's only automatic-admission switch, and it applies to comment-kind bundles only. Default is "manual": every bundle, comment or otherwise, waits on the maintainers' own pull request. Setting it to "auto-during-window" with a window additionally admits a comment-kind bundle staged in inbox/ automatically, once .github/workflows/admit-comments.yml's scheduled sweep (build/admit-inbox.mjs) runs; claims, supports, and contests are never auto-admitted, in any mode. See build/admission.mjs for the enforcement rule.
