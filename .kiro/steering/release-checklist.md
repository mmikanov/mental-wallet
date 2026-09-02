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
3. **Prepare release notes** for both stores. Keep/track the copy in `docs/store-listing-copy.md` (Version History sections). Add a new version entry there.

## After submitting

4. **Set release notes in each console — this is NOT automated by EAS:**
   - **App Store Connect** → the version → "What's New in This Version"
   - **Google Play Console** → Production (or track) → the release → "Release notes" (`<en-US>...</en-US>`, 500-char limit)
5. **Confirm the correct build/versionCode is selected** in each console before final submit.
6. **iOS App Review notes** — if the release touches anything a reviewer should test (e.g. the WebView media feature), add notes in App Review Information.

## Rollout safety (once there are real users)

7. Android `production` track currently publishes to **100% with no manual gate**. Before the real launch, switch to a **staged rollout** (a % first, then ramp) or a **testing track**, then promote. Reminder is in `docs/deployment/app-deployment.md`.

## Notes

- Full deployment steps: `docs/deployment/app-deployment.md`.
- Store copy + per-version history: `docs/store-listing-copy.md`.
- Future workflow cleanup that removes the 4-file version sync: `.kiro/specs/prebuild-migration/` (migrate to Expo prebuild so `app.json` is the single source of truth).
