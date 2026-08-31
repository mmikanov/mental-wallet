# Design Document

## Overview

Migrate from the bare workflow (committed `ios/`/`android/`) to the Expo prebuild workflow, making `app.json` + config plugins the single source of truth. This is a low-code, high-verification task: most work is auditing current native config, expressing it in `app.json`, then regenerating and diffing.

## Background: Why the Drift Happened

The project has committed native directories. When `app.json` was edited (e.g., adding `LSApplicationQueriesSchemes` for the Display Media feature, bumping the version), those changes were NOT reflected in the native files because `expo prebuild` was never re-run — and when a native `ios/` directory exists, EAS Build uses the native files directly and ignores most `app.json` values.

Result: the App Store received version `1.0.1` (from `Info.plist`) instead of the intended bump, and the deep link schemes never reached the binary.

## Migration Strategy

### Phase 1: Audit (no changes)

Produce a written inventory of every non-default value in:
- `ios/MentalWallet/Info.plist`
- `ios/MentalWallet/MentalWallet.entitlements`
- `ios/MentalWallet.xcodeproj/project.pbxproj` (build settings)
- `android/app/src/main/AndroidManifest.xml`
- `android/app/build.gradle`
- Custom XML resources (`secure_store_backup_rules.xml`, `secure_store_data_extraction_rules.xml`)

Compare each against what a fresh `expo prebuild` would generate from the current `app.json`. The delta is what needs to be added to `app.json` or a config plugin.

### Phase 2: Express in app.json

Map each customization to its declarative equivalent:

| Native customization | app.json / plugin mechanism |
|----------------------|------------------------------|
| `LSApplicationQueriesSchemes` | `ios.infoPlist.LSApplicationQueriesSchemes` (already present) |
| Camera/mic/photo usage strings | expo-image-picker plugin options + `ios.infoPlist` |
| Face ID usage string | `ios.infoPlist.NSFaceIDUsageDescription` or expo-local-authentication plugin |
| `ITSAppUsesNonExemptEncryption` | `ios.infoPlist` (already present) |
| Android permissions | `android.permissions` (already present) |
| Secure store backup rules | expo-secure-store plugin (verify defaults match; else custom plugin) |
| `aps-environment` | Handled automatically by EAS for push (expo-notifications) |
| URL schemes | `scheme` field in app.json + expo-dev-client |

### Phase 3: Regenerate

```bash
# Remove committed native dirs
rm -rf ios android

# Gitignore them
echo "/ios" >> .gitignore
echo "/android" >> .gitignore

# Regenerate from app.json
npx expo prebuild --clean
```

### Phase 4: Diff & Verify

Diff the regenerated `Info.plist` / `AndroidManifest.xml` against the git history version (before deletion) to catch anything missing. Anything absent means a config plugin is needed.

## Custom Config Plugin (if needed)

If the secure store backup rules or any other resource can't be reproduced by existing plugins, write a local config plugin:

```js
// plugins/withSecureStoreBackupRules.js
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
// ... inject fullBackupContent / dataExtractionRules and copy XML files
```

Reference it in `app.json` plugins array.

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Lost native customization | Full audit + post-prebuild diff against git history |
| Signing/credentials break | EAS manages credentials remotely; unaffected by prebuild |
| WebView module missing | react-native-webview auto-links via prebuild; verify in build |
| Secure store data loss on existing installs | Test backup rules; this only affects the build config, not user data migration |
| Splash/icon regression | Verify `splash` and `icon` config in app.json produce correct assets |

## Rollback Plan

The native directories are in git history. If prebuild produces a broken result:
```bash
git checkout HEAD -- ios android
git revert <gitignore commit>
```
Return to the bare workflow and investigate.

## Decision: Keep `appVersionSource: "remote"`

EAS currently tracks build numbers remotely (`autoIncrement: true`). This is orthogonal to prebuild and works fine with the managed workflow. Keep it. The marketing version will come from `app.json` after migration (no more native override).
