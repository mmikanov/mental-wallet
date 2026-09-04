# Release Checklist (App Store & Google Play)

When the user is about to build, submit, or release a new app version (any mention of `eas build`, `eas submit`, "new version", "release", "ship it"), proactively remind them of this checklist BEFORE they build. Don't wait to be asked.

## Before building

1. **Bump the marketing version** if the previous version was already submitted/approved on either store. Apple REJECTS a duplicate `CFBundleShortVersionString`. Because this project uses the bare workflow (committed `ios/`/`android/`), the version must be updated in ALL FOUR places and kept identical:
   - `app.json` → `version`
   - `ios/MentalWallet/Info.plist` → `CFBundleShortVersionString`
   - `ios/MentalWallet.xcodeproj/project.pbxproj` → `MARKETING_VERSION` (both Debug and Release)
   - `android/app/build.gradle` → `versionName`
   (Build numbers auto-increment via EAS `autoIncrement` — don't touch those.)
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
