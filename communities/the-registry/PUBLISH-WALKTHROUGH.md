# Publish walkthrough: The Registry

No step here asks for a credential of any kind, and nothing in this document is executed against
GitHub automatically; every command and link below is for you to run or open by hand.

## 1. Create

- [ ] Create a new, empty GitHub repository. Suggested name: `the-registry` (any name works;
      it only has to match the URL you put in fetch_locations). Link: https://github.com/new
- [ ] In the new repository's own Settings -> Pages, set "Build and deployment" -> Source to
      "GitHub Actions" (the one settings flip; the emitted pages.yml workflow expects it and will
      not serve anything until this is set).

## 2. Upload

- [ ] The emitted artifacts are staged as one downloadable bundle: `communities/the-registry-publish-bundle.tar.gz` (relative to this repository's own root)
- [ ] Extract it into an empty local clone of the new repository, commit, and push to `main`:

```
tar -xzf communities/the-registry-publish-bundle.tar.gz -C <path to your empty clone> --strip-components=1
cd <path to your empty clone>
git add -A
git commit -m "Found the community"
git push -u origin main
```

## 3. Verify

This config's own fetch_locations already names: https://a-viable-fork.github.io/Knowledge-Game/communities/the-registry/snapshot/the-registry.snapshot.json
The repository name and path below must match it exactly, or edit fetch_locations in the founding config and republish before going further.

- [ ] The snapshot URL serves: open https://a-viable-fork.github.io/Knowledge-Game/communities/the-registry/snapshot/the-registry.snapshot.json directly; it should return the snapshot JSON, hash: c015c6f605a1621871688a1eb10adf1e72afef0a88f499c91cc34d3ab2469619
- [ ] The community card's own fetch_locations resolves to the same URL: check `communities/the-registry/community-card.json`'s `fetch_locations` field reads exactly the URL above, byte for byte.
- [ ] One gate-check Actions run is green: open the new repository's Actions tab, confirm the
      "check" workflow (triggered by the push above) completed successfully. Link pattern:
      https://github.com/<your-account>/<repo>/actions

## Done

Once every box above is checked, the card is ready to share: send `community-card.json`'s own
content, or the snapshot URL directly, to anyone who wants to point a client at this community.
