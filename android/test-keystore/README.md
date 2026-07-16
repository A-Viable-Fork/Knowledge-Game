# TEST ONLY keystore

**TEST ONLY. DO NOT USE FOR ANY PRODUCTION OR PLAY STORE RELEASE.**

`test.keystore` signs sideload-test builds of the Android TWA wrapper only. It is committed
deliberately: a sideload-test key is low-stakes, and losing an ephemeral session's keystore would
break update continuity for the operator's own test installs across sessions.

- Package id: `com.aviablefork.knowledgegame`
- Key alias: `knowledgegame`
- Store password: `kg-test-only-2026`
- Key password: `kg-test-only-2026`
- Distinguished name: `CN=The Knowledge Game (test key), OU=Test, O=A Viable Fork, C=US`
- Validity: 10000 days from generation

SHA-256 certificate fingerprint (needed for `assetlinks.json`):

```
68:60:19:08:89:67:80:51:43:E5:9A:71:AE:45:1C:AB:A8:5F:88:D1:35:C8:6C:32:26:38:66:56:E0:EA:CB:15
```

## The production rule

**TEST ONLY.** Before any Google Play Store upload, generate a production keystore and hold it
outside this repository, under the operator's own control alone. Never commit a production
keystore. Retire this test key from any release channel beyond direct sideload once a production
key exists. See `trellis/status-ledger.md` for the ledgered obligation.
