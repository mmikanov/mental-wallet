# Release Checklist (App Store & Google Play)

When the user is about to build, submit, or release a new app version (any mention of `eas build`, `eas submit`, "new version", "release", "ship it"), proactively remind them of this checklist BEFORE they build. Don't wait to be asked.

> **Bump the version when a new release cycle STARTS, not just before the build.** When work
> begins on the next version (e.g. the first `X.Y.Z`-prefixed spec is created, or the user
> says "the next version will be N"), do the 4-place version bump then. Waiting until build
> time is how a build got submitted still carrying the previous version. If the marketing
> version in `app.json` still equals the last released store version while new-version work is
> underway, proactively flag it.

## Before building

1. **Bump the marketing version** if the previous version was already submitted/approved on either store. Apple REJECTS a duplicate `CFBundleShortVersionString`.

   **Use the one-command script** — do not hand-edit the files:
   ```
   npm run set-version -- 1.0.5
   ```
   Because this project uses the bare workflow (committed `ios/`/`android/`), the marketing version lives in multiple files that must stay identical. `scripts/set-version.js` writes them all from the single argument:
   - `app.json` → `version`
   - `ios/MentalWallet/Info.plist` → `CFBundleShortVersionString`
   - `ios/MentalWallet.xcodeproj/project.pbxproj` → `MARKETING_VERSION` (both Debug and Release)
   - `android/app/build.gradle` → `versionName`
   - `package.json` → `version` (kept in sync for tidiness; not used by the build)

   (Build numbers auto-increment via EAS `autoIncrement` — the script does NOT touch those.) The script is idempotent, so re-running it to confirm is safe. The full prebuild migration (making `app.json` the single source of truth and removing this multi-file sync entirely) is still tracked in `.kiro/specs/prebuild-migration/`.
2. **Confirm the working tree is committed and pushed** so the build reflects the intended code.
3. **Prepare release notes** for both stores. Keep/track the copy in `docs/store-listing-copy.md` (Version History sections). Add a new version entry there. To see everything landed since the last release, diff against the previous release tag: `git log <last-tag>..HEAD` (e.g. `git log v1.0.3..HEAD`). The "Unreleased" section in `docs/store-listing-copy.md` is the running draft — finalize it into the new version's entry.

## After submitting

4. **Set release notes in each console — this is NOT automated by EAS:**
   - **App Store Connect** → the version → "What's New in This Version"
   - **Google Play Console** → Production (or track) → the release → "Release notes" (`<en-US>...</en-US>`, 500-char limit)
5. **Confirm the correct build/versionCode is selected** in each console before final submit.
6. **iOS App Review notes** — if the release touches anything a reviewer should test (e.g. the WebView media feature), add notes in App Review Information.
7. **Tag the release commit.** Once the shipped build's code is committed, create an annotated tag on that exact commit and push it, so "changes since last release" stays a one-command diff:
   ```
   git tag -a v<version> <commit> -m "Release <version> — <short summary>"
   git push origin v<version>
   ```
   Use `v` + the marketing version (e.g. `v1.0.4`). Existing tags: `v1.0.1`, `v1.0.2` (Google Play only — skipped on the App Store), `v1.0.3`. Tag the commit that actually built the release, not necessarily HEAD.

## Rollout safety (once there are real users)

8. Android `production` track currently publishes to **100% with no manual gate**. Before the real launch, switch to a **staged rollout** (a % first, then ramp) or a **testing track**, then promote. Reminder is in `docs/deployment/app-deployment.md`.

## Notes

- Full deployment steps: `docs/deployment/app-deployment.md`.
- Store copy + per-version history: `docs/store-listing-copy.md`.
- Future workflow cleanup that removes the 4-file version sync: `.kiro/specs/prebuild-migration/` (migrate to Expo prebuild so `app.json` is the single source of truth).

## Release Plans (where they live and how to write them)

Every app release gets a **release plan** — a short planning document (NOT a spec) that scopes
what goes into that version, in operator/product language. Release plans live in:

```
docs/release-plans/
```

Conventions:

- **One file per release**, named `<version>.md` (e.g. `docs/release-plans/1.0.6.md`).
- A release plan is a **plan, not a spec**: it names what ships in the version, why, what still
  needs doing to ship it, the deploy/verification steps, and the risks — it does NOT re-derive
  requirements or design (link to the relevant `.kiro/specs/*` for that).
- Write it in product/operator language. It should read like a go/no-go checklist a release
  manager follows.
- A release plan should cover, at minimum: the version number and target platforms; a summary
  of what's included (grouped by user-visible vs. behind-the-scenes/infra); what is already
  done vs. still outstanding to ship; the ordered deploy/build/submit steps (reusing the
  checklist above); the store release notes (or a pointer to `docs/store-listing-copy.md`); and
  the known risks / rollout notes.
- Keep finished release plans in place as a historical record (don't delete them); the newest
  release's plan is the active one.
- **Backend/worker/website work vs. app work:** the analytics worker, messaging worker, and
  marketing website deploy independently of app store builds. A release plan should clearly
  separate "already live via a worker/website deploy" from "needs an app build to reach users,"
  so an app release is only cut when there is actual app-code to ship.

Relationship to the version-bump rule above: when a new release cycle starts, create its
release plan in `docs/release-plans/` and do the 4-place version bump at that point.
