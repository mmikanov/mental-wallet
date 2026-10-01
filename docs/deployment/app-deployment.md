# App Deployment

## Release Checklist (every production submission)

A quick end-to-end checklist. The sections below have the detailed commands; this is the
order to run them in and the easy-to-forget steps. (Mirrors the `release-checklist` steering.)

### Before building
1. **Bump the marketing version** if the previous version was already submitted/approved on
   either store (Apple REJECTS a duplicate `CFBundleShortVersionString`). Use the one-command
   script — do NOT hand-edit the files:
   ```bash
   npm run set-version -- 1.0.5
   ```
   It writes `app.json`, `ios/.../Info.plist`, `ios/.../project.pbxproj` (both configs),
   `android/app/build.gradle`, and `package.json` from the single argument. It is idempotent, so
   re-running it to confirm "already X.Y.Z" everywhere is safe. (Build numbers auto-increment via
   EAS — the script does not touch those.) See **Version Management** below for why all files must
   match.
2. **Confirm the working tree is committed and pushed** so the build reflects the intended code
   (`git status` clean; `git push`). EAS builds from your committed native project.
3. **Prepare release notes** for both stores in `docs/store-listing-copy.md` (finalize the new
   version's entry; Apple copy must NOT mention Android — Guideline 2.3.10).

### Build & submit
4. Build and submit per the platform sections below (`eas build` / `eas submit`).
5. **Verify EACH build's source commit BEFORE submitting — the single most important check.**
   On the EAS build page (or `eas build:list`), read the **Commit** hash for every platform build
   and confirm it equals the commit you intend to ship (normally `main` HEAD / the release commit).
   Do this per-platform: iOS and Android are separate builds and can end up on different commits.

   > ⚠️ **Why:** the version number is NOT a safe signal. EAS can stamp the configured marketing
   > version onto a build whose source is an OLD commit (e.g. remote/EAS version management applies
   > `1.0.5` even though that commit's `build.gradle` still says `1.0.4`). In the 1.0.5 release an
   > Android build was created from a 3-week-old commit (`a6d1d2f`, pre-feature) yet reported
   > "1.0.5" — caught only by checking the build's **Commit** field. A `*` after the commit on the
   > EAS page means there were uncommitted changes at build time; prefer a clean tree.
   >
   > Fast check: the build's Commit should match `git rev-parse HEAD` on your up-to-date `main`.
   > If it doesn't, discard that build and rebuild from a fresh, clean `main` checkout.

### After submitting (NOT automated by EAS)
6. **Set release notes in each console** — EAS does not push these:
   - **App Store Connect** → the version → **"What's New in This Version"** → paste the Apple block.
   - **Play Console** → Production (or track) → the release → **"Release notes"** → paste the
     `<en-US>…</en-US>` block (500-char limit).
7. **Confirm the correct build is selected** in each console before final submit — match BOTH
   the versionCode/build number AND (where visible) that it corresponds to the commit verified
   in step 5. Picking a leftover older build here is the same trap as a stale-commit build.
8. **iOS App Review notes** — if the release touches anything a reviewer should test (e.g. a new
   capability, a WebView/media feature), add notes under **App Review Information**. Keep/track the
   copy in `store-listing-copy.md`.
9. **Android rollout** — remember `track: "production"` publishes to 100% with no manual gate; use
   a staged rollout or a testing track once there are real users (see **Rollout safety** below).

### After the build's code is committed
10. **Tag the release** on the exact commit that built it, and push the tag, so "changes since last
   release" stays a one-command diff:
   ```bash
   git tag -a v1.0.5 <commit> -m "Release 1.0.5 — <short summary>"
   git push origin v1.0.5
   ```
   Use `v` + the marketing version. Existing tags: `v1.0.1`–`v1.0.4` (`v1.0.2` was Google-Play-only,
   skipped on the App Store). Tag the commit that actually built the release, not necessarily HEAD.

---

## Push to TestFlight (via App Store Connect)

TestFlight lets you distribute beta builds to up to 10,000 testers.

### One-time setup

```bash
# Login to EAS
eas login

# Configure EAS for your project (already done — see eas.json)
eas build:configure
```

### Build and submit

```bash
# Build for iOS (production profile — creates an .ipa)
eas build --platform ios --profile production

# Wait for the build to complete (5-15 minutes in the cloud)
# You'll get a URL to download the .ipa or it auto-submits

# Submit to App Store Connect (for TestFlight)
eas submit --platform ios
```

### After submission

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app → **TestFlight** tab
3. The build will appear after Apple processes it (usually 5-30 minutes)
4. Add yourself or testers under **Internal Testing** or **External Testing**
5. Testers receive an email invite to install via the TestFlight app

### Important notes

- First submission requires you to create the app in App Store Connect:
  - Go to App Store Connect → My Apps → "+" → New App
  - Bundle ID: `com.mentalwallet.app`
  - Name: "Mental Wallet"
- EAS handles code signing automatically (managed credentials)
- Builds are done in the cloud — no local Xcode build needed

---

## Push to the App Store

### Prerequisites

- App already set up in App Store Connect (see TestFlight section)
- App screenshots (6.7" and 5.5" sizes minimum)
- App description, keywords, privacy policy URL
- App icon (1024×1024px) — already configured in app.json

### Build and submit

```bash
# Same build command as TestFlight
eas build --platform ios --profile production

# Submit to App Store review
eas submit --platform ios
```

### App Store Connect setup

1. Go to [App Store Connect](https://appstoreconnect.apple.com) → Your App
2. Under **App Store** tab → **App Information**:
   - Category: Health & Fitness
   - Subcategory: Mental Health
3. Under **Prepare for Submission**:
   - Add screenshots (at minimum: iPhone 6.7" and 5.5")
   - Write description, promotional text, keywords
   - Set age rating (likely 4+ or 12+ depending on content)
   - Add privacy policy URL
   - Set price (Free)
4. Select the build you submitted
5. Click **Submit for Review**

### App Review

- Apple reviews typically take 24-48 hours
- Common rejection reasons for health apps:
  - Missing disclaimer that app is not medical advice (we have this ✓)
  - Missing privacy policy
  - Incomplete metadata (screenshots, description)
- Once approved, you can choose to release immediately or on a specific date

---

## Push to Google Play

### Prerequisites

- Google Play Developer account ($25 one-time fee)
- App created in Google Play Console (package: `com.mentalwallet.app`)
- Android signing credentials configured via EAS (`eas credentials --platform android`)
- Store listing assets: feature graphic (1024×500px), phone screenshots (2-8), app icon (512×512px)
- Privacy policy hosted at a public URL (same as iOS)

### Build and submit

```bash
# Build for Android (production profile — creates an .aab / Android App Bundle)
eas build --platform android --profile production

# Wait for the cloud build to complete (5-15 minutes)

# Submit to Google Play Console
eas submit --platform android
```

**Service account is already configured** — `eas submit --platform android` runs non-interactively (no prompt for a JSON path). The setup:

- The Google Play service account key lives at `credentials/play-service-account.json` (gitignored — never committed).
- `eas.json` references it under `submit.production.android`:

```json
"submit": {
  "production": {
    "android": {
      "serviceAccountKeyPath": "./credentials/play-service-account.json",
      "track": "production"
    }
  }
}
```

- Service account email: `eas-submit@mental-health-wallet.iam.gserviceaccount.com` (granted release permissions in Play Console → Users and permissions).

> ⚠️ `track: "production"` pushes straight to the production track (public after review). To land in a testing track first, change it to `"internal"` or `"beta"` and promote manually in Play Console.

**If you set up a new machine:** the key file is NOT in git. Re-download it from Google Cloud Console (it can only be downloaded at creation, so you may need to create a new key for the `eas-submit` service account) and place it at `credentials/play-service-account.json`.

**Manual alternative:** download the `.aab` from the EAS build page and upload it in Play Console (Production → Create new release).

### Google Play Console setup

1. Go to [Google Play Console](https://play.google.com/console) → Your App
2. **App content** section — complete all declarations:
   - Privacy policy URL
   - Data safety form (what data is collected/shared)
   - Health apps declaration (Stress management, relaxation, mental acuity)
   - AI-generated content declaration (logo created with AI)
   - Target audience and content rating (IARC questionnaire)
3. **Main store listing:**
   - Short description (80 chars max)
   - Full description
   - Feature graphic (1024×500px)
   - Phone screenshots (at least 2, recommended 4-8)
   - App icon (512×512px)
4. **Production → Create new release:**
   - Upload the AAB (or let `eas submit` push it)
   - ⚠️ **Add release notes** — `eas submit` does NOT set these automatically. Go to the release → **Release notes** and paste the `<en-US>...</en-US>` copy. Use/track it in `docs/store-listing-copy.md` (Version History — Release Notes / Google Play). Limit: 500 chars per language.
   - Select countries/regions for distribution
   - Submit for review

> **Reminder:** After every `eas submit --platform android`, log into Play Console and set the release notes for the new versionCode — otherwise users see no "What's changed" text. Keep the copy in sync with `store-listing-copy.md`.

### App Review

- Google Play initial review can take **up to 7 days** (longer than Apple)
- Subsequent updates usually review faster
- Common issues for health apps:
  - Incomplete Data safety form
  - Missing or inaccessible privacy policy
  - Health claims without appropriate disclaimers (we have the disclaimer screen ✓)

### Rollout safety (do once there are real users)

The `production` track with `eas submit` publishes to **100% of users** after Google's (fast, mostly automated) review — there is no manual gate. This is fine pre-launch, but once real users exist, use one of these safer patterns:

- **Staged rollout** — in Play Console, set the release to a percentage (e.g. 20%), monitor crash-free rate / reviews, then ramp to 100%. A bad build then only reaches a fraction of users.
- **Testing track first** — change `submit.production.android.track` in `eas.json` to `"internal"` or `"beta"`, verify, then promote to production in Play Console.

> **Reminder:** Revisit the straight-to-production setup before the real launch and switch to staged rollout or a testing track.

### Automating release notes (optional, not set up)

EAS Submit does **not** have a first-class "what's new" text field in `eas.json`, so release notes are currently a **manual Play Console step** after each submit (and a manual App Store Connect step for iOS).

To fully automate on Android you would move to **fastlane `supply`** (or a GitHub Actions pipeline) that reads a `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt` file and pushes it via the Play Developer API using the same service account key. This is more setup than it's worth at the current cadence — revisit if releases become frequent. For now, keep the copy in `store-listing-copy.md` and paste it into each console.

---

## Deploy Both Platforms at Once

To build and submit iOS and Android together:

```bash
# Build both platforms in the cloud (~5-15 min each, build numbers auto-increment)
eas build --platform all --profile production

# Submit each to its store
eas submit --platform ios
eas submit --platform android
```

Notes:
- **Bump the marketing version first** (see Version Management below) — all 4 files must match, or the store rejects a duplicate version.
- **Android** submits non-interactively (service account is configured in `eas.json`) and goes straight to the **production** track. Change `submit.production.android.track` to `"internal"` if you want a testing track first.
- **iOS** still requires you to select the processed build in App Store Connect and tap **Submit for Review**.
- Apple review: ~24-48h. Google Play review: up to ~7 days.

---

## Version Management

There are two version values:

- **Marketing version** (`CFBundleShortVersionString` on iOS, `versionName` on Android) — the user-facing version like `1.0.2`. Must increase for each App Store / Play Store submission.
- **Build number** (`CFBundleVersion` on iOS, `versionCode` on Android) — an internal counter. EAS auto-increments this (`autoIncrement: true` in the production profile), so you don't manage it manually.

### ⚠️ Important: this project currently uses the bare workflow

Because committed `ios/` and `android/` directories exist, **EAS Build uses the native project values and ignores most `app.json` fields** (including `version`). Bumping `app.json` alone is NOT enough — the App Store rejected a build for this exact reason (submitted `1.0.1` instead of the intended bump).

**To bump the marketing version, run the one-command script — do NOT hand-edit the files:**

```bash
npm run set-version -- 1.0.6
```

It writes the same value to ALL of these (keeping them in sync, which is what the store requires):

| File | Field |
|------|-------|
| `app.json` | `version` |
| `ios/MentalWallet/Info.plist` | `CFBundleShortVersionString` |
| `ios/MentalWallet.xcodeproj/project.pbxproj` | `MARKETING_VERSION` (both Debug and Release configs) |
| `android/app/build.gradle` | `versionName` |
| `package.json` | `version` (kept in sync for tidiness; not used by the build) |

The script is idempotent (re-running reports "already X.Y.Z"), and leaves build numbers alone
(EAS `autoIncrement` handles those).

> Once the [prebuild migration](../../.kiro/specs/prebuild-migration/requirements.md) is done, `app.json` alone will be the source of truth and this manual sync goes away.

---

## Over-the-Air Updates

For JS-only changes (no native code changes):

```bash
eas update --branch production --message "Fix: description of change"
```

---

## Useful Commands

```bash
# Check EAS build status
eas build:list

# View build logs
eas build:view

# Bump the marketing version before a new submission (writes all 4 files + package.json)
npm run set-version -- 1.0.6
```
