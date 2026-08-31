# Tasks

> **Prerequisite:** Do NOT start until the 1.0.2 release is shipped and stable. This is a workflow refactor with build risk — not to be done under launch pressure.

## Task 1: Audit current native customizations

- [ ] 1.1: Document all non-default keys in `ios/MentalWallet/Info.plist` (query schemes, usage strings, ATS, encryption flag, URL schemes)
- [ ] 1.2: Document `ios/MentalWallet/MentalWallet.entitlements` contents (aps-environment)
- [ ] 1.3: Document `project.pbxproj` build settings (bundle ID, deployment target 15.1, versions)
- [ ] 1.4: Document `AndroidManifest.xml` (permissions, queries, backup rules references, activity config)
- [ ] 1.5: Document `android/app/build.gradle` (applicationId, versionName, versionCode, SDK versions)
- [ ] 1.6: Locate and document custom XML resources (secure_store_backup_rules.xml, secure_store_data_extraction_rules.xml)
- [ ] 1.7: Write the inventory to a scratch doc for reference during verification
- _Requirements: 1.1, 1.2, 1.3, 1.4_

## Task 2: Express customizations in app.json

- [ ] 2.1: Verify `ios.infoPlist.LSApplicationQueriesSchemes` has all 11 schemes
- [ ] 2.2: Add/verify all iOS usage description strings (camera, mic, photo, Face ID) via plugins or infoPlist
- [ ] 2.3: Verify `android.permissions` lists all required permissions
- [ ] 2.4: Verify expo-secure-store plugin reproduces the backup rules; if not, note for custom plugin
- [ ] 2.5: Confirm `scheme` and URL types are configured in app.json
- [ ] 2.6: Confirm app.json `version` matches current shipping version
- _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

## Task 3: Write custom config plugin(s) if needed

- [ ] 3.1: Determine whether secure store backup rules differ from plugin defaults (from Task 2.4)
- [ ] 3.2: If needed, write `plugins/withSecureStoreBackupRules.js` to inject the XML resources and manifest attributes
- [ ] 3.3: Reference any custom plugins in the app.json `plugins` array
- _Requirements: 2.4, 2.5_

## Task 4: Regenerate native projects

- [ ] 4.1: Commit current state (clean checkpoint before deletion)
- [ ] 4.2: Add `/ios` and `/android` to `.gitignore`
- [ ] 4.3: Delete `ios/` and `android/` directories
- [ ] 4.4: Run `npx expo prebuild --clean`
- _Requirements: 3.1, 3.2, 3.3_

## Task 5: Verify parity via diff

- [ ] 5.1: Diff regenerated `Info.plist` against pre-deletion version (git history) — confirm all keys from Task 1.1 present
- [ ] 5.2: Diff regenerated `AndroidManifest.xml` and `build.gradle` — confirm all items from Task 1.4/1.5 present
- [ ] 5.3: Confirm bundle identifier and package name unchanged
- [ ] 5.4: Confirm react-native-webview is auto-linked
- [ ] 5.5: Fix any gaps by adjusting app.json or config plugins, then re-run prebuild
- _Requirements: 3.4, 3.5, 3.6, 3.7_

## Task 6: Build and runtime verification

- [ ] 6.1: Run `eas build --platform ios --profile production` — succeeds
- [ ] 6.2: Run `eas build --platform android --profile production` — succeeds
- [ ] 6.3: On device: verify Open in Spotify/YouTube deep links work (LSApplicationQueriesSchemes applied)
- [ ] 6.4: On device: verify Display Media inline WebView playback works
- [ ] 6.5: On device: verify secure store persists (backup rules applied)
- [ ] 6.6: On device: verify camera/mic/photo permission prompts appear
- [ ] 6.7: Verify version and build number correct in artifact
- _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

## Task 7: Commit and document

- [ ] 7.1: Commit the migration (gitignore change, app.json updates, any config plugins, deleted native dirs)
- [ ] 7.2: Update `docs/deployment/app-deployment.md` to reflect the managed workflow (no more manual native edits)
- [ ] 7.3: Note in deployment docs that `app.json` is now the single source of truth for versions
- _Requirements: All_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3"] },
    { "id": 3, "tasks": ["4"] },
    { "id": 4, "tasks": ["5"] },
    { "id": 5, "tasks": ["6"] },
    { "id": 6, "tasks": ["7"] }
  ]
}
```
