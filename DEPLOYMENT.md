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

## Reset App for Testing (Simulator)

To re-test onboarding or start fresh on the iOS simulator:

**Option 1: Delete and reinstall the app**

1. In the simulator, long-press the app icon → "Remove App" → "Delete App"
2. Run `npm run ios` to rebuild and reinstall

**Option 2: Reset the entire simulator**

1. In the Simulator menu bar: **Device → Erase All Content and Settings...**
2. Run `npm run ios` to reinstall

Both options wipe the SQLite database (settings, cards, onboarding state), giving you a clean first-launch experience.

---

## Mock Analytics Backend (Dev Only)

A local mock server receives and displays analytics events during development.

### Start the server

```bash
npm run mock-analytics
```

This starts an Express server on port 3001. The app automatically sends events there in dev builds.

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/events` | POST | Receives batch payloads from the app |
| `/events` | GET | Returns all received events as JSON |
| `/events` | DELETE | Clears all stored events |
| `/dashboard` | GET | HTML page with computed KPIs |

### View the dashboard

Open http://localhost:3001/dashboard in your browser to see:
- Total events received
- Unique anonymous users
- Onboarding completion rate
- Mode split (wallet_first vs emotion_first)
- Tool completion rate per card
- Outcome positivity rate
- Retention by days_since_install buckets

### Simulate failures

Set the `ERROR_RATE` environment variable (0–100) to simulate random 500 errors for testing retry logic:

```bash
ERROR_RATE=20 npm run mock-analytics
```

### End-to-end testing workflow

1. Start the mock server: `npm run mock-analytics`
2. Run the app in the simulator
3. Use the app (open tools, complete them, navigate around)
4. Events flush every 60s or when 10+ are queued
5. Check http://localhost:3001/dashboard to see KPIs update
6. Or use the stress test (triple-tap Settings header → Stress Test) to generate bulk data

### Developer Event Viewer

Access the in-app event viewer by triple-tapping the "Settings" header text. From there you can:
- See queue contents and status
- Export the queue as JSON
- Clear the queue
- Run the stress test with configurable user count, events per user, and time span

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
