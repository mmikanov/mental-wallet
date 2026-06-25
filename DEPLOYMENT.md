# Deployment Guide

## Prerequisites

- **Node.js** 18+ installed
- **Xcode** installed (for simulator and local builds)
- **Apple Developer Account** ($99/year) — required for TestFlight and App Store
- **EAS CLI** installed: `npm install -g eas-cli`
- **Expo account**: Sign up at https://expo.dev then run `eas login`

---

## 1. Run on iOS Simulator

### First time setup (already done)

```bash
# Generate the native iOS project
npx expo prebuild --platform ios

# Install CocoaPods dependencies
cd ios && pod install && cd ..
```

### Every time you want to run

```bash
# Terminal 1: Start the Metro bundler
npx expo start --dev-client

# Terminal 2 (or press 'i' in Terminal 1): Build and launch on simulator
npx expo run:ios
```

Or if the app is already installed on the simulator, just start Metro:

```bash
npx expo start --dev-client
```

Then open the app in the simulator — it will auto-connect to the dev server.

**Troubleshooting:**
- If you see "No development server found" — make sure Metro is running (`npx expo start --dev-client`)
- If Metro shows errors — try `npx expo start --dev-client --clear` to clear the cache
- If the build fails — try `cd ios && pod install && cd ..` then rebuild

---

## 2. Push to TestFlight (via App Store Connect)

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
  - Bundle ID: `com.mentalhealthwallet.app`
  - Name: "Mental Health Wallet"
- EAS handles code signing automatically (managed credentials)
- Builds are done in the cloud — no local Xcode build needed

---

## 3. Push to the App Store

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

## Useful Commands

```bash
# Check EAS build status
eas build:list

# View build logs
eas build:view

# Update app version before a new submission
# Edit version in app.json, then rebuild

# Over-the-air update (JS-only changes, no native code changes)
eas update --branch production --message "Fix: description of change"
```

---

## Version Management

Before each new submission, increment the version in `app.json`:

```json
{
  "expo": {
    "version": "1.0.1",  // Visible to users
    ...
  }
}
```

EAS auto-increments the build number, so you only need to bump `version` for user-facing releases.
