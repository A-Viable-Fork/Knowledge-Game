# The Android wrapper

A Trusted Web Activity (TWA) shell around the deployed PWA
(`https://a-viable-fork.github.io/Knowledge-Game/app/`), built with
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap). The APK carries no copy of the app:
it opens the live URL in a verified, chrome-less browser view, so the app still updates through
Pages alone.

- Package id: `com.aviablefork.knowledgegame`
- Wraps: `https://a-viable-fork.github.io/Knowledge-Game/app/`
- Signing: `test-keystore/` (TEST ONLY, see its own README)

## Regenerating the project

The Gradle project itself is not committed (see `.gitignore`): it is generated fresh each time
from the live manifest, so it can never drift into a bundled snapshot of the app.

```
cd android
npm install
node generate-project.mjs
```

This fetches `https://a-viable-fork.github.io/Knowledge-Game/app/manifest.webmanifest` and writes
the full Gradle project (`app/`, `build.gradle`, `gradlew`, etc.) into this directory. Building the
APK from there needs a JDK 17 and the Android SDK command-line tools, then:

```
BUBBLEWRAP_KEYSTORE_PASSWORD=kg-test-only-2026 BUBBLEWRAP_KEY_PASSWORD=kg-test-only-2026 \
  npx bubblewrap build
```

`.github/workflows/android-release.yml` runs exactly these two steps on a real GitHub Actions
runner and attaches the resulting APK to a release.

## What this environment could and could not do in-session

Building this wrapper needs three network destinations this development session's own egress
policy does not allow, confirmed directly rather than assumed:

- `a-viable-fork.github.io` (the live manifest, icons, and app: `Host not in allowlist` from this
  session's own proxy)
- `dl.google.com` (the Android SDK command-line tools)
- `services.gradle.org` / the Gradle distribution mirror (the build tool itself)

`github.com/adoptium/...` (the JDK) and `registry.npmjs.org` (Bubblewrap itself) were reachable.
The generator script above was verified end to end against a local mirror of the real manifest
content (proving the project-generation logic, icon handling, and asset-links embedding all work
correctly against this app's real manifest), but the actual Gradle compile could not run in this
session. The GitHub Actions runner has none of these restrictions and completes both steps for
real; see the workflow's own run history for the built APK.
