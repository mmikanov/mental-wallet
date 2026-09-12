# App link association files (Universal Links / App Links)

These enable `https://mentalhealthwallet.productsforgood.co/app/...` links to open the app
(1.0.4-deep-linking Req 3). They are served at the domain root by the Cloudflare static-assets
worker (see `website/wrangler.toml`).

## Values (filled in)

### `apple-app-site-association` (iOS)
- `appID` = `J2XVWUDH2V.com.mentalwallet.app` (Apple Team ID `J2XVWUDH2V`).
- Must be served as `Content-Type: application/json`, over HTTPS, with **no redirect**, at
  exactly `/.well-known/apple-app-site-association` (no `.json` extension).
- Apple caches the AASA via its CDN; changes can take time to propagate.

### `assetlinks.json` (Android)
- Contains TWO SHA-256 fingerprints (Play App Signing is enabled — "Releases signed by Play"):
  1. The **Play "App signing key"** SHA-256 (Play Console → Protect app signing key → Manage
     Play app signing → App signing key certificate) — this is what production installs from
     Play are signed with, so it's the one Android App Links verify against for Play installs.
  2. The **EAS upload/release keystore** SHA-256 (build credentials `vge9GwUgwg`) — covers
     direct/internal-distribution builds not routed through Play.
- Must be served as `Content-Type: application/json` over HTTPS at
  `/.well-known/assetlinks.json`.

## Deploy notes
- `website/.assetsignore` must NOT exclude `.well-known` (it isn't excluded today).
- The `/app/...` paths also need real **web fallback pages** so that, when the app is NOT
  installed, the link lands on a sensible page (Req 3.3). Tracked with the CTA-upgrade work.
- The `mentalwallet://` custom scheme works without any of this (used by reminder taps); only
  the `https://` Universal/App Links depend on these files.
