# Local Development

## Run on iOS Simulator

> **Heads up: `npx expo run:ios` currently does NOT work on this machine.** Since we added the
> `applinks:` associated-domains entitlement (for Universal Links / deep links), the Expo CLI
> requires development code signing **even for the simulator**, and this machine has no
> development certificate (`security find-identity -v -p codesigning` → 0 identities). So
> `expo run:ios` fails with "No code signing certificates are available to use."
>
> Use the **`xcodebuild` + `simctl` workaround below**, which builds for the simulator with
> ad-hoc "Sign to Run Locally" signing (no certificate needed). This is a temporary situation:
> see "Making `expo run:ios` work again (after 1.0.4)" at the end of this section.

### First time setup (already done)

```bash
# Generate the native iOS project
npx expo prebuild --platform ios

# Install CocoaPods dependencies
cd ios && pod install && cd ..
```

### Every time you want to run (the working workaround)

```bash
# Terminal 1: Start the Metro bundler
npx expo start --dev-client
```

If the dev build is already installed on the simulator, that's all you need — open the app in
the simulator and it auto-connects to Metro.

To (re)build and install the native app on the booted simulator, use `xcodebuild` directly
(NOT `expo run:ios`):

```bash
# 1. Find the booted simulator's UDID (or boot one first from Simulator.app)
xcrun simctl list devices booted

# 2. Build for the simulator (ad-hoc signed; no dev certificate needed)
xcodebuild \
  -workspace ios/MentalWallet.xcworkspace \
  -scheme MentalWallet \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,id=<BOOTED_SIM_UDID>' \
  -derivedDataPath ios/build

# 3. Install + launch on the booted simulator
xcrun simctl install booted "ios/build/Build/Products/Debug-iphonesimulator/MentalWallet.app"
xcrun simctl launch booted com.mentalwallet.app
```

Replace `<BOOTED_SIM_UDID>` with the UDID from step 1 (e.g. the iPhone 17 Pro Max sim).

**Troubleshooting:**
- If you see "No development server found" — make sure Metro is running (`npx expo start --dev-client`)
- If Metro shows errors — try `npx expo start --dev-client --clear` to clear the cache
- If the build fails — try `cd ios && pod install && cd ..` then rebuild
- If `expo run:ios` gives "No code signing certificates are available to use" — that's the
  known issue above; use the `xcodebuild` workaround (or complete the Option B setup below).

### Run on iPad Simulator

Boot an iPad simulator, then use the same `xcodebuild` workaround with that iPad's UDID in the
`-destination`:

```bash
# List available iPad simulators (name + UDID)
xcrun simctl list devices available | grep iPad
```

`npx expo start` alone won't work without a development build already installed on the target
device — the `xcodebuild` steps above install it.

### Making `expo run:ios` work again (after 1.0.4)

> **RESOLVED (post-1.0.4):** `expo run:ios` now works. The fix was step 4 below —
> `DEVELOPMENT_TEAM = J2XVWUDH2V` is now committed in `project.pbxproj` (both Debug and
> Release), and a local Apple Development certificate exists in the keychain (created via
> Xcode → Automatically manage signing). For the **simulator**, the build signs ad-hoc
> (`CODE_SIGN_IDENTITY = -`), so no provisioning profile or team-owned cert is required — a
> full `npx expo run:ios` build+bundle+launch was verified working. The `xcodebuild`
> workaround above still works and is kept as a fallback.
>
> Note on teams: the local keychain cert is under a personal free team, but the simulator
> build signs ad-hoc regardless, so it doesn't matter for local dev. Testing entitlement-gated
> behavior (Universal Links) on a **real device** still needs an EAS build (which uses the
> real `J2XVWUDH2V` remote credentials), not a local `expo run:ios`.

`expo run:ios` is nicer than the `xcodebuild` workaround (one command, handles Metro, device
selection, etc.). It previously failed because there was no local development signing set up and
the associated-domains entitlement forces signing even for the simulator. The one-time fix
(now done):

1. Open the workspace in Xcode: `xed ios`
2. Select the **MentalWallet** target → **Signing & Capabilities**
3. Check **Automatically manage signing** and pick your **Team** (Apple Developer team
   `J2XVWUDH2V` — the same prefix as the AASA `appID`). Xcode will create a development
   certificate + provisioning profile for you (needs your Apple ID login).
4. Once a valid identity exists (`security find-identity -v -p codesigning` shows it), set
   `DEVELOPMENT_TEAM = J2XVWUDH2V` for both Debug and Release in
   `ios/MentalWallet.xcodeproj/project.pbxproj` so the setting persists across prebuilds.
5. Verify: `npx expo run:ios` should now build + launch on the simulator without the signing
   error.

Note: EAS builds are unaffected either way — they use EAS-managed remote credentials
(`eas.json` → `appVersionSource: remote`), not the local keychain.

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

---

## Known follow-ups / tech debt

### No app-wide `SafeAreaProvider` (blocks `useSafeAreaInsets`)

The app does not mount a `SafeAreaProvider` (from `react-native-safe-area-context`) at the root
(`App.tsx` wraps things in `GestureHandlerRootView` + `NavigationContainer` only). Screens rely
on `SafeAreaView edges={[...]}`, which works without a provider. But the `useSafeAreaInsets()`
hook **requires** a `SafeAreaProvider` and returns zeros without one — so it can't be used today.

This surfaced while fixing the Library card preview's Dismiss button being hidden behind the
Android 3-button nav bar (PR #74). The hook would have been the natural tool for adding the
bottom inset to the footer padding, but with no provider it returned 0 and didn't fix anything,
so `SafeAreaView edges={['bottom']}` was used instead (works without a provider, matches the
rest of the app).

Follow-up (not urgent; do outside a release crunch): wrap the app in `<SafeAreaProvider>` in
`App.tsx` so `useSafeAreaInsets()` becomes usable. That unlocks precise, per-value inset control
for cases like footers/overlays where wrapping in a whole `SafeAreaView` is awkward. Low risk,
but it's an app-wide layout change, so verify the wallet, library, insights, and any modal
sheets on both platforms (especially Android 3-button nav) after adding it.
