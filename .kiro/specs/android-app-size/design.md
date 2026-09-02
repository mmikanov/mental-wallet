# Design Document

## Overview

Reduce Android app size via three low-risk-to-medium-risk levers, ordered by impact and safety. This is optimization work — measure in Play Console before/after each change, and smoke-test the app after enabling R8 (the only change with real breakage risk).

## Levers (by expected impact)

### 1. R8 minification + resource shrinking (highest impact, medium risk)

**Where:** `android/gradle.properties` (or the EAS build profile env).

Expo/RN gates these behind gradle properties read in `android/app/build.gradle`:
- `enableMinifyInReleaseBuilds` (default false) → set `android.enableMinifyInReleaseBuilds=true`
- `enableShrinkResourcesInReleaseBuilds` (default false) → set `android.enableShrinkResourcesInReleaseBuilds=true`

**Risk:** R8 strips "unused" code, but reflection-based native modules can appear unused and get removed, causing runtime crashes. Mitigation: existing `proguard-rules.pro` plus keep rules for any module that breaks. Most mainstream RN/Expo modules ship their own consumer ProGuard rules, so this often works out of the box — but it MUST be verified with a full smoke test (open every screen, use SQLite, media/WebView, reminders, gestures, animations).

**How to set for EAS builds:** add to `eas.json` production profile:
```json
"production": {
  "autoIncrement": true,
  "android": {
    "env": {
      "EXPO_UNSTABLE_..." // or set gradle props
    }
  }
}
```
Simpler: set the properties directly in `android/gradle.properties` (committed), since the native project is checked in.

### 2. Move dev-only packages to devDependencies (low impact on shipped size, high hygiene value)

**Where:** `package.json`.

Move `expo-dev-client`, `@expo/ngrok`, `babel-preset-expo` to `devDependencies`. Verify each is truly not needed at runtime:
- `expo-dev-client` — dev only; production uses the release runtime. Safe to move (EAS production builds don't include the dev client anyway).
- `@expo/ngrok` — only used by `expo start --tunnel`. Dev only.
- `babel-preset-expo` — build-time preset. Dev only.

**Risk:** low. Main check: `expo run:android`, dev client on device, and `expo start` all still work; production build still succeeds.

### 3. Drop x86 ABIs for production (medium impact on artifact, low risk with care)

**Where:** `android/gradle.properties` `reactNativeArchitectures`, or per-profile.

Real devices are ARM (`armeabi-v7a`, `arm64-v8a`). `x86`/`x86_64` exist for emulators. Since Play ships an AAB and splits per-ABI, users already only download their ABI — so this primarily shrinks the universal artifact, not the typical Play download. Still worth it to reduce the artifact and build time.

**Risk:** emulator development needs x86 unless using an ARM emulator image. Mitigation: only drop x86 in the production build path (EAS production profile), keep all ABIs for local/dev.

## Recommended Sequence

1. Baseline-measure current Download/Install size in Play Console App bundle explorer.
2. Move dev deps to devDependencies (safe warm-up, verify builds).
3. Enable R8 + resource shrinking, add keep rules as needed, full smoke test.
4. Measure again; record delta.
5. (Optional) Drop x86 for production; measure.
6. Document final config in deployment docs.

## Verification

- Play Console → App bundle explorer → compare Download size + Install size for a common device (e.g. Pixel arm64) before and after.
- Full app smoke test after R8: navigation, card CRUD, SQLite persistence, media (image attach + WebView embeds), reminders/notifications, gestures/animations, emotion session flow.
- Confirm dev workflow intact after dependency move.

## Risk Summary

| Change | Impact | Risk | Mitigation |
|--------|--------|------|------------|
| R8 + resource shrink | High | Medium (reflection breakage) | Keep rules + full smoke test |
| Dev deps → devDependencies | Low (hygiene) | Low | Verify dev + prod builds |
| Drop x86 for prod | Medium (artifact) | Low | Production-only; keep ARM emulator or all-ABI dev path |
