# Requirements Document

## Introduction

The Android app is 74.7MB (universal AAB, all ABIs) — larger than expected for an app of this scope. This is NOT a regression (v1.0.2 and v1.0.3 measured identical), and the actual per-device download via Play's AAB splitting is smaller than 74.7MB. This spec captures future work to reduce both the download and install size on Android, based on an investigation done in Sept 2026.

**Priority: low.** This is an optimization, not a bug. Do it when there's time, and always measure before/after via Play Console → App bundle explorer (Download size + Install size per device).

## Investigation Findings (Sept 2026)

Measured on builds v1.0.2 (versionCode 3) and v1.0.3 (versionCode 6): both 74.7MB universal. iOS equivalents were 14.8MB (thinned). The large Android/iOS gap is mostly because the 74.7MB is the universal all-ABI size, while iOS reports the thinned size.

Contributors identified:

1. **R8/ProGuard code shrinking is OFF.** In `android/app/build.gradle`, `enableMinifyInReleaseBuilds` defaults to `false` and `shrinkResources` defaults to `false`. Enabling these is the single biggest lever for reducing size (removes unused Java/Kotlin code and resources).

2. **All 4 ABIs are bundled** (`armeabi-v7a, arm64-v8a, x86, x86_64` in `android/gradle.properties`). The x86/x86_64 ABIs are only needed for emulators; real devices are ARM. Play's AAB splitting already delivers only the matching ABI to each device, so this mostly affects the universal artifact, not user downloads — but dropping x86 for production builds reduces the artifact.

3. **Dev-only packages listed under production `dependencies`** in `package.json`:
   - `expo-dev-client` (pulls in `expo-dev-launcher` ~16MB + `expo-dev-menu` ~14MB native)
   - `@expo/ngrok` (local tunneling tool)
   - `babel-preset-expo` (build-time)
   These should be in `devDependencies`. Note: EAS production builds may already exclude the dev client via the build profile, so verify whether they actually ship before assuming savings. This is also just good hygiene.

4. **Heavy but legitimately-used native modules** (not removable): `react-native-reanimated` + `react-native-worklets`, `react-native-screens`, `react-native-gesture-handler`, `expo-sqlite`, `react-native-webview`. These are all in active use.

5. **Assets are NOT a factor** — total `assets/` is only 1.4MB.

## Requirements

### Requirement 1: Enable R8 Code Shrinking and Resource Shrinking

**User Story:** As a user, I want a smaller app download so it installs faster and uses less storage.

#### Acceptance Criteria

1.1 THE Android release build SHALL enable R8 minification (`android.enableMinifyInReleaseBuilds=true`).

1.2 THE Android release build SHALL enable resource shrinking (`android.enableShrinkResourcesInReleaseBuilds=true`).

1.3 WHEN minification is enabled THE build SHALL include any ProGuard keep rules needed so that reflection-based native modules (Reanimated, Worklets, SQLite, WebView, gesture-handler, screens) continue to function — verified by a full smoke test of the app after the change.

1.4 THE download and install size SHALL be measured in Play Console App bundle explorer before and after, and the delta recorded.

### Requirement 2: Move Dev-Only Packages to devDependencies

**User Story:** As a developer, I want dev tooling excluded from production so the dependency graph is clean and nothing dev-only can ship.

#### Acceptance Criteria

2.1 THE packages `expo-dev-client`, `@expo/ngrok`, and `babel-preset-expo` SHALL be moved from `dependencies` to `devDependencies` in `package.json` (unless a specific one is required at runtime — verify each).

2.2 WHEN moved THE development workflow (`expo run:android`, dev client on device, `expo start`) SHALL CONTINUE TO work.

2.3 WHEN moved THE production build SHALL CONTINUE TO build and run correctly.

### Requirement 3: Consider Dropping x86 ABIs for Production

**User Story:** As a user on a real (ARM) device, I don't need x86 binaries meant for emulators.

#### Acceptance Criteria

3.1 THE production Android build MAY restrict `reactNativeArchitectures` to `armeabi-v7a,arm64-v8a` (dropping x86/x86_64), OR rely on Play AAB splitting if that already delivers per-ABI downloads.

3.2 IF x86 is dropped THEN local emulator development SHALL still be possible (emulators may need x86 — keep a dev path, e.g. only drop x86 in the production EAS profile, or use an ARM emulator image).

3.3 THE tradeoff (smaller artifact vs emulator compatibility) SHALL be documented.

### Requirement 4: Measurement and Documentation

#### Acceptance Criteria

4.1 THE before/after Download and Install sizes SHALL be recorded from Play Console App bundle explorer for a representative device.

4.2 THE findings and final configuration SHALL be documented in `docs/deployment/app-deployment.md` (or a size-optimization note) so the settings aren't accidentally reverted.

## Out of Scope

- Removing any actively-used native module (Reanimated, SQLite, WebView, etc.)
- iOS size optimization (already thinned to 14.8MB — acceptable)
- Migrating away from the New Architecture or Hermes (both should stay)
- Asset optimization (assets are only 1.4MB — not worth it)

## Notes

- Always test thoroughly after enabling R8 — minification can break reflection-based code without the right keep rules. This is the main risk and why it's not a quick change.
- Do the measurement in Play Console, not by eyeballing the AAB file size (the AAB is not what users download).
