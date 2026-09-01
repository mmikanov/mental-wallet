# Local Development

## Run on iOS Simulator

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

### Run on iPad Simulator

```bash
# List available iPad simulators
xcrun simctl list devices available | grep iPad

# Build and launch on a specific iPad simulator
npx expo run:ios --device "iPad Pro 13-inch (M4)"
```

Use the exact device name from the list. This compiles the native project and installs it — `npx expo start` alone won't work without a development build already installed on the target device.

---

## Run on Android Emulator

### First time setup

1. Install [Android Studio](https://developer.android.com/studio)
2. Open Android Studio → **More Actions → Virtual Device Manager**
3. Create a device: choose **Medium Phone** (closest to Galaxy S23 / standard 6.1" modern phone)
4. Select a system image (API 34 or latest) and download it
5. Launch the emulator

### Build and run

```bash
# Build and launch on the running Android emulator
npx expo run:android
```

The first run takes a while (Gradle build). Subsequent runs are faster.

If the emulator is already running and the app is installed, just start Metro:

```bash
npx expo start --dev-client
```

Then press `a` to open on Android.

**Troubleshooting:**
- If `npx expo run:android` can't find the emulator — make sure the emulator is running first via Android Studio's Virtual Device Manager
- If Gradle build fails — ensure `ANDROID_HOME` is set (usually `~/Library/Android/sdk`)
- Add to your `~/.zshrc` if not set: `export ANDROID_HOME=~/Library/Android/sdk`

### Testing navigation modes (3-button vs gesture)

Emulators usually default to **gesture navigation** (a thin pill at the bottom), which has a small safe-area inset. Many physical Android phones (e.g. Samsung) use the **3-button navigation bar** (back / home / recents), which has a *taller* bottom inset. Content that isn't wrapped in a bottom safe-area edge can render fine on the emulator but get covered by the nav bar on a real device.

Switch the running emulator's navigation mode via ADB (no menu digging needed):

```bash
# Switch to 3-button navigation (matches many physical devices)
adb shell cmd overlay enable com.android.internal.systemui.navbar.threebutton

# Switch back to gesture navigation
adb shell cmd overlay enable com.android.internal.systemui.navbar.gestural

# If the overlay names differ on your image, list what's available:
adb shell cmd overlay list | grep navbar
```

**Always test the wallet, library, and insights screens in 3-button mode** before shipping — that's the mode most likely to reveal bottom safe-area (`SafeAreaView edges`) issues.

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

## Dev Analytics (Local)

### Option A: Run the production worker locally (recommended)

This gives you the full production dashboard (launch metrics, phase filtering, drill-downs) with a local D1 database:

```bash
cd analytics-worker

# First time only: apply migrations to local D1
npm run db:migrate:local

# Start the worker
npm run dev
```

The worker runs on `http://localhost:8787`. The app in the simulator sends events there automatically.

**View the dashboard:**
```
http://localhost:8787/dashboard?secret=dev
```

The local secret is `dev` (configured in `wrangler.toml` `[vars]`). The production secret is set separately via `wrangler secret put` and is not affected.

### Option B: Run the simple mock server

A lightweight Express server that just stores events in a JSON file. No KPI computation or dashboard features — useful for basic ingestion testing only.

```bash
npm run mock-analytics
```

This starts on port 3001. **Note:** The app's dev URL currently points to port 8787 (the Wrangler worker). To use this instead, change `ANALYTICS_BASE_URL` in `src/config/analytics.ts` back to `http://localhost:3001`.

### Endpoints (both options)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/events` | POST | Receives batch payloads from the app |
| `/events` | GET | Returns all received events as JSON |
| `/events` | DELETE | Clears all stored events |
| `/dashboard` | GET | HTML page with computed KPIs |

### Simulate failures

Set the `ERROR_RATE` environment variable (0–100) to simulate random 500 errors for testing retry logic:

```bash
ERROR_RATE=20 npm run mock-analytics
```

### End-to-end testing workflow

1. Start the worker locally: `cd analytics-worker && npm run dev`
2. Run the app in the simulator
3. Use the app (open tools, complete them, navigate around)
4. Events flush every 60s or when 10+ are queued
5. Check http://localhost:8787/dashboard?secret=dev to see KPIs update
6. Or use the stress test (triple-tap Settings header → Stress Test) to generate bulk data

### Developer Event Viewer

Access the in-app event viewer by triple-tapping the "Settings" header text. From there you can:
- See queue contents and status
- Tap User ID or Session ID to copy to clipboard
- Export the queue as JSON
- Clear the queue
- Run the stress test with configurable user count, events per user, and time span
