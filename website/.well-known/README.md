# App link association files (Universal Links / App Links)

These enable `https://mentalhealthwallet.productsforgood.co/app/...` links to open the app
(1.0.4-deep-linking Req 3). They are served at the domain root by the Cloudflare static-assets
worker (see `website/wrangler.toml`).

## Before Universal/App Links will verify — fill in real values

### `apple-app-site-association` (iOS)
- Replace `TEAMID` in `appID` with the Apple Developer **Team ID** (App Store Connect →
  Membership, or the prefix of the App ID). Result: `<TeamID>.com.mentalwallet.app`.
- Must be served as `Content-Type: application/json`, over HTTPS, with **no redirect**, at
  exactly `/.well-known/apple-app-site-association` (no `.json` extension).
- Apple caches the AASA via its CDN; changes can take time to propagate.

### `assetlinks.json` (Android)
- Replace `REPLACE_WITH_RELEASE_SIGNING_SHA256_FINGERPRINT` with the **release** signing
  cert SHA-256 (the key that actually signs the Play build). For EAS: `eas credentials`
  (Android → the keystore) shows the SHA-256, or Play Console → App integrity → App signing.
- Must be served as `Content-Type: application/json` over HTTPS at
  `/.well-known/assetlinks.json`.

## Deploy notes
- `website/.assetsignore` must NOT exclude `.well-known` (it isn't excluded today).
- The `/app/...` paths also need real **web fallback pages** so that, when the app is NOT
  installed, the link lands on a sensible page (Req 3.3). Tracked with the CTA-upgrade work.
- The `mentalwallet://` custom scheme works without any of this (used by reminder taps); only
  the `https://` Universal/App Links depend on these files.
