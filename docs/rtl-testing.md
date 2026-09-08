# Testing RTL (Right-to-Left) Layout

The app UI is **English-only** and is deliberately locked to **left-to-right (LTR)** layout
so that devices set to a right-to-left language (e.g. Hebrew, Arabic) don't render a
mirrored / broken interface.

This lock is implemented in two places (see the `post-1.0.3-user-reported-fixes` spec, Bug 1):

- **`App.tsx`** — an `I18nManager` call at startup (`allowRTL(false)` + guarded
  `forceRTL(false)`). Cross-platform (covers iOS + Android).
- **`android/app/src/main/AndroidManifest.xml`** — `android:supportsRtl="false"` on the
  `<application>` element (Android native-level guarantee).

Because the lock is native on Android, **changes to it require a native rebuild**
(`npm run android`), not just a JS reload.

This document explains how to put a simulator/emulator into RTL to verify the app still
renders LTR.

> **Key idea:** once the fix is installed, the app renders LTR *even when the device is in
> RTL mode*. So "the app looks LTR" is the pass condition. To prove the *environment* is
> actually RTL (independent of the app), use the verification commands below — they check
> the OS/device state, and native surfaces (status bar, Expo dev menu, keyboard) will still
> appear RTL.

---

## Android emulator

### Put the app into RTL (Hebrew)

The most reliable method is a **per-app locale override** — it targets only this app, needs
no reboot, and reflects a real Hebrew user. (The Developer Options "Force RTL layout
direction" toggle was found to be **unreliable** on newer API levels — avoid it.)

```bash
# Force just Mental Wallet into Hebrew
adb shell cmd locale set-app-locales com.mentalwallet.app --locales he-IL

# Restart the app so it picks up the new locale
adb shell am force-stop com.mentalwallet.app
adb shell monkey -p com.mentalwallet.app -c android.intent.category.LAUNCHER 1
```

### Verify the emulator is actually in RTL

```bash
# 1) What locale is the app forced to?
adb shell cmd locale get-app-locales com.mentalwallet.app
#    → "Locales for com.mentalwallet.app ... are [he-IL]"

# 2) The definitive check — the app's resolved layout direction:
adb shell "dumpsys activity com.mentalwallet.app | grep -m1 mCurrentConfig"
#    Look for the direction token in the output:
#      ldrtl  → the OS has the app in RIGHT-TO-LEFT mode  ✅ (environment is RTL)
#      ldltr  → LEFT-TO-RIGHT
```

If you see `ldrtl` but the app still renders LTR, the fix is working as intended.

### Revert to English (LTR)

```bash
adb shell cmd locale set-app-locales com.mentalwallet.app --locales en-US
adb shell am force-stop com.mentalwallet.app
adb shell monkey -p com.mentalwallet.app -c android.intent.category.LAUNCHER 1
```

---

## iOS Simulator

iOS has no clean per-app locale override from the CLI, so we change the **whole simulator's
language** and reboot. Use the literal keyword `booted` to target the currently-booted
simulator (avoids UDID/variable mistakes — a common cause of "Invalid device" errors).

> A simulator must actually be **booted** for `booted` to resolve. Open the Simulator app or
> `xcrun simctl boot <name-or-udid>` first.

### Put the simulator into RTL (Hebrew)

```bash
xcrun simctl spawn booted defaults write -g AppleLanguages -array "he-IL" "en-US"
xcrun simctl spawn booted defaults write -g AppleLocale -string "he_IL"

# Reboot so the language change takes effect system-wide
xcrun simctl shutdown booted && xcrun simctl boot booted

# then relaunch the app (from Metro, Xcode, or:)
xcrun simctl launch booted com.mentalwallet.app
```

### Verify the simulator's language / locale

```bash
xcrun simctl spawn booted defaults read -g AppleLanguages   # first entry = active language
xcrun simctl spawn booted defaults read -g AppleLocale
#   AppleLanguages first entry "he-IL" (or any he-* / ar-*) → RTL
```

You can also confirm RTL visually on a **native** surface the app doesn't control: in RTL
the **status bar flips** (clock moves to the right, battery/Wi-Fi to the left), and the Expo
dev menu is mirrored.

### Revert to English (LTR)

```bash
xcrun simctl spawn booted defaults write -g AppleLanguages -array "en-US" "he-IL"
xcrun simctl spawn booted defaults write -g AppleLocale -string "en_US"
xcrun simctl shutdown booted && xcrun simctl boot booted
```

### Optional: harsh worst-case (forced text direction)

This forces text direction *harder* than any real device (useful only for stress-testing;
not a realistic user condition). Some `Text` elements may still right-align under this even
with the fix — that is an artifact of the override, not a real-world regression.

```bash
xcrun simctl terminate booted com.mentalwallet.app
xcrun simctl launch booted com.mentalwallet.app \
  -AppleTextDirection YES -NSForceRightToLeftWritingDirection YES
# revert: relaunch without the flags
xcrun simctl launch booted com.mentalwallet.app
```

---

## Quick reference

| Task | Android emulator | iOS Simulator |
| --- | --- | --- |
| Set RTL | `adb shell cmd locale set-app-locales com.mentalwallet.app --locales he-IL` | `xcrun simctl spawn booted defaults write -g AppleLanguages -array "he-IL" "en-US"` then reboot |
| Check language | `adb shell cmd locale get-app-locales com.mentalwallet.app` | `xcrun simctl spawn booted defaults read -g AppleLanguages` |
| Confirm truly RTL | `adb shell "dumpsys activity com.mentalwallet.app \| grep -m1 mCurrentConfig"` → `ldrtl` | first `AppleLanguages` entry is `he-*`/`ar-*`; status bar flips |
| Revert to English | `adb shell cmd locale set-app-locales com.mentalwallet.app --locales en-US` | `xcrun simctl spawn booted defaults write -g AppleLanguages -array "en-US" "he-IL"` then reboot |

## Expected result (pass condition)

With the LTR lock in place, in **both** platforms under a Hebrew/RTL environment the app
should render **exactly as it does in English** — "My Wallet" title on the left, kebab (⋮)
on the right, card icons on the left of titles, status dots on the right, FAB at the
bottom-right, and left-aligned body text. Native OS surfaces (status bar, dev menu,
keyboard) may still appear RTL — that is expected and outside the app's control.

## Notes

- Users can still **type and store** any script (including Hebrew) in text fields — the lock
  only affects layout direction, not text input. User-authored free-text fields (custom KPI,
  text-input / text-area controls, and Card Creator title/description) use `textAlign: 'auto'`
  so typed Hebrew aligns to its own direction while the app chrome stays LTR.
- The `com.mentalwallet.app` package/bundle id is the same on both platforms.
