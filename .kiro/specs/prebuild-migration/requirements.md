# Requirements Document

## Introduction

The project currently uses the **bare workflow** — committed `ios/` and `android/` native directories that are edited directly. This has caused configuration drift: values set in `app.json` (versions, `LSApplicationQueriesSchemes`, permissions) did not reach the native projects, leading to an App Store rejection (version `1.0.1` submitted instead of the intended bump, and missing platform URL schemes for deep links).

This spec migrates the project to the **Expo prebuild (managed) workflow**, where `app.json` (plus config plugins) is the single source of truth and the native directories are generated on demand. The goal is to eliminate manual native-file syncing and prevent future drift.

**This migration should be done AFTER the current 1.0.2 release is shipped and stable — not under launch pressure.**

## Glossary

- **Prebuild**: The `npx expo prebuild` command that generates native `ios/` and `android/` directories from `app.json` and config plugins.
- **Bare workflow**: The current state — native directories are committed to git and edited manually.
- **Managed workflow**: Native directories are gitignored and regenerated from config; `app.json` is the source of truth.
- **Config plugin**: An Expo mechanism to inject native configuration (Info.plist keys, entitlements, gradle changes) declaratively from `app.json`.
- **Drift**: When native project values diverge from `app.json` because manual edits weren't mirrored.

## Requirements

### Requirement 1: Capture All Current Native Customizations

**User Story:** As a developer, I want a complete inventory of every manual native customization before regenerating, so that nothing is silently lost.

#### Acceptance Criteria

1.1 THE inventory SHALL document all non-default `Info.plist` keys currently in `ios/MentalWallet/Info.plist`, including:
  - `LSApplicationQueriesSchemes` (headspace, calm, talkspace, betterhelp, wysa, insight-timer, insighttimer, spotify, youtube, vimeo, soundcloud)
  - `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSFaceIDUsageDescription`
  - `ITSAppUsesNonExemptEncryption`
  - `NSAppTransportSecurity` settings
  - URL schemes (`com.mentalwallet.app`, `exp+mental-health-wallet`)

1.2 THE inventory SHALL document all Android customizations in `AndroidManifest.xml` and `build.gradle`, including:
  - Permissions (INTERNET, READ/WRITE_EXTERNAL_STORAGE, RECORD_AUDIO, SYSTEM_ALERT_WINDOW, VIBRATE)
  - `fullBackupContent` and `dataExtractionRules` (secure store backup rules)
  - `<queries>` intent filters
  - `applicationId`, `versionName`, `versionCode`

1.3 THE inventory SHALL document iOS entitlements (`aps-environment` for push notifications).

1.4 THE inventory SHALL note any custom native files that are NOT auto-generated (e.g., `secure_store_backup_rules.xml`, `secure_store_data_extraction_rules.xml`).

### Requirement 2: Ensure app.json Reproduces All Customizations

**User Story:** As a developer, I want `app.json` (with config plugins) to declaratively produce every customization, so prebuild output matches the current native projects.

#### Acceptance Criteria

2.1 THE `app.json` SHALL include all `LSApplicationQueriesSchemes` under `ios.infoPlist`.

2.2 THE `app.json` SHALL declare all iOS usage description strings (camera, microphone, photo library, Face ID) — either directly or via the relevant config plugins (expo-image-picker, expo-notifications, etc.).

2.3 THE `app.json` SHALL declare all Android permissions under `android.permissions`.

2.4 THE secure store backup rules SHALL be reproduced — either via the expo-secure-store plugin defaults or a custom config plugin if the current rules differ from defaults.

2.5 IF any customization cannot be expressed through existing plugins or `app.json` fields, THEN a custom config plugin SHALL be written to inject it.

2.6 THE `app.json` version SHALL be set to the current shipping version so prebuild doesn't regress it.

### Requirement 3: Perform the Migration

**User Story:** As a developer, I want to regenerate the native projects cleanly and verify parity.

#### Acceptance Criteria

3.1 THE migration SHALL delete the existing `ios/` and `android/` directories.

3.2 THE migration SHALL add `/ios` and `/android` to `.gitignore`.

3.3 THE migration SHALL run `npx expo prebuild --clean` to regenerate native directories.

3.4 THE regenerated `Info.plist` SHALL contain all keys documented in Requirement 1.1 (verified by diff).

3.5 THE regenerated `AndroidManifest.xml` and `build.gradle` SHALL contain all items from Requirement 1.2.

3.6 THE regenerated projects SHALL preserve the bundle identifier `com.mentalwallet.app` and package `com.mentalwallet.app`.

3.7 THE `react-native-webview` native module SHALL be present and functional after prebuild (it auto-links).

### Requirement 4: Verify Build and Runtime

**User Story:** As a developer, I want to confirm the regenerated app builds and behaves identically before committing.

#### Acceptance Criteria

4.1 THE app SHALL build successfully via `eas build --platform ios --profile production`.

4.2 THE app SHALL build successfully via `eas build --platform android --profile production`.

4.3 THE Display Media platform URL deep links (Open in Spotify/YouTube/etc.) SHALL work on a real device, confirming `LSApplicationQueriesSchemes` was applied.

4.4 THE secure store data SHALL persist correctly (confirming backup rules were applied).

4.5 THE microphone, camera, and photo library permissions SHALL prompt correctly at runtime.

4.6 THE version and build number SHALL be correct in the built artifact.

## Out of Scope

- Changing the actual version numbers (this spec is about workflow, not versioning)
- Migrating away from EAS Build
- Adding new native functionality
- Changing the `appVersionSource: "remote"` EAS setting (keep as-is unless it conflicts)
