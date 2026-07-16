# Inbox

Comment-kind contribution bundles staged for the admission-policy sweep (Phase KG-11 Step 4). A bundle placed here is picked up by `.github/workflows/admit-comments.yml`'s scheduled run of `build/admit-inbox.mjs`: admitted automatically when `founding-config.json`'s `admission_policy.comment_admission` is set to `"auto-during-window"` and now falls inside the declared window, otherwise left here untouched, waiting on the maintainers' own pull request exactly like every other kind. An admitted bundle moves to `contributions/`; see `build/admission.mjs` for the enforcement rule.
