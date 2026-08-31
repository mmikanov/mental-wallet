# App Deployment

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
   - Add release notes
   - Select countries/regions for distribution
   - Submit for review

### App Review

- Google Play initial review can take **up to 7 days** (longer than Apple)
- Subsequent updates usually review faster
- Common issues for health apps:
  - Incomplete Data safety form
  - Missing or inaccessible privacy policy
  - Health claims without appropriate disclaimers (we have the disclaimer screen ✓)

---

## Version Management

There are two version values:

- **Marketing version** (`CFBundleShortVersionString` on iOS, `versionName` on Android) — the user-facing version like `1.0.2`. Must increase for each App Store / Play Store submission.
- **Build number** (`CFBundleVersion` on iOS, `versionCode` on Android) — an internal counter. EAS auto-increments this (`autoIncrement: true` in the production profile), so you don't manage it manually.

### ⚠️ Important: this project currently uses the bare workflow

Because committed `ios/` and `android/` directories exist, **EAS Build uses the native project values and ignores most `app.json` fields** (including `version`). Bumping `app.json` alone is NOT enough — the App Store rejected a build for this exact reason (submitted `1.0.1` instead of the intended bump).

**To bump the marketing version, update ALL of these to the same value:**

| File | Field |
|------|-------|
| `app.json` | `version` |
| `ios/MentalWallet/Info.plist` | `CFBundleShortVersionString` |
| `ios/MentalWallet.xcodeproj/project.pbxproj` | `MARKETING_VERSION` (both Debug and Release configs) |
| `android/app/build.gradle` | `versionName` |

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

# Update app version before a new submission
# Edit version in app.json, then rebuild
```
