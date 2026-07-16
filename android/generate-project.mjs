// Role: generates the Android TWA (Trusted Web Activity) Gradle project that wraps the deployed
//   Knowledge Game (Phase KG-6a; version discipline added Phase android-test-3). Constructs the
//   project via @bubblewrap/core's library API directly rather than its CLI's interactive prompts,
//   so the exact same inputs run unattended in CI.
// Contract: `node generate-project.mjs [manifestUrl]` (default: the live deployed manifest). Fetches
//   the web manifest from that URL, builds a TwaManifest with this wrapper's fixed overrides
//   (packageId, launcher name, the committed test keystore's path and alias, appVersionCode,
//   appVersionName), and writes the full Gradle project into this directory via
//   TwaGenerator.createTwaProject, exactly as `bubblewrap init` would, without the interactive
//   prompts. appVersionCode/appVersionName are set here, not left to @bubblewrap/core's own default
//   (a hardcoded 1/"1", since the web manifest itself carries no version field): each rebuild that
//   is meant to replace a prior sideload install increments APP_VERSION_CODE by hand, the one line
//   this file's own history is the record of, so the operator's phone actually offers the upgrade
//   (Android refuses a same-or-lower versionCode as an update, silently, over the identical signing
//   key) instead of silently keeping the old build.
// Invariant: the manifest is always fetched from a real URL, never read from a local copy of the
//   app's own files; the generated project's `host` and `startUrl` therefore always resolve to the
//   real deployed origin, never a bundled copy of the app. Requires `npm install` in this directory
//   first (declares @bubblewrap/cli as its own devDependency, scoped to this wrapper alone).
"use strict";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = resolve(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_MANIFEST_URL = "https://a-viable-fork.github.io/Knowledge-Game/app/manifest.webmanifest";

const require = (await import("node:module")).createRequire(import.meta.url);
const corePkg = require.resolve("@bubblewrap/core/package.json");
const CORE = join(dirname(corePkg), "dist", "lib");
const { TwaManifest } = await import(`${CORE}/TwaManifest.js`);
const { TwaGenerator } = await import(`${CORE}/TwaGenerator.js`);
const { createHash } = await import("node:crypto");
const { readFile, writeFile } = (await import("node:fs")).promises;

// android-test-3: KG-7/KG-8 changed everything baked in at build time (mark, maskable icon set,
// splash, theme/background color); this rebuild must carry a versionCode the operator's already-
// installed android-test-2 (versionCode 1, @bubblewrap/core's own unset default) is strictly less
// than, so the identical signing key lets the install upgrade in place rather than sit inert.
const APP_VERSION_CODE = 3;
const APP_VERSION_NAME = "0.3.0-test";

const manifestUrl = process.argv[2] || DEFAULT_MANIFEST_URL;

let twaManifest = await TwaManifest.fromWebManifest(manifestUrl);
twaManifest.packageId = "com.aviablefork.knowledgegame";
twaManifest.launcherName = "Knowledge Game";
twaManifest.signingKey.path = join(HERE, "test-keystore", "test.keystore");
twaManifest.signingKey.alias = "knowledgegame";
twaManifest.appVersionCode = APP_VERSION_CODE;
twaManifest.appVersionName = APP_VERSION_NAME;

const manifestFile = join(HERE, "twa-manifest.json");
await twaManifest.saveToFile(manifestFile);

const generator = new TwaGenerator();
const log = { log: (m) => console.log(m), warn: (m) => console.warn(m), error: (m) => console.error(m) };
await generator.createTwaProject(HERE, twaManifest, log, () => {});

// bubblewrap build refuses to run unattended without this: a missing checksum file makes it prompt
// interactively ("no checksum found, update project?"), which CI cannot answer.
const manifestContents = await readFile(manifestFile);
const checksum = createHash("sha1").update(manifestContents).digest("hex");
await writeFile(join(HERE, "manifest-checksum.txt"), checksum);

console.log(`Generated the TWA project at ${HERE}`);
console.log(`  packageId: ${twaManifest.packageId}`);
console.log(`  host: ${twaManifest.host}`);
console.log(`  startUrl: ${twaManifest.startUrl}`);
