# Tasks

> **Priority: low / future work.** Optimization, not a bug. Always measure in Play Console App bundle explorer before/after, and smoke-test after enabling R8.

## Task 1: Baseline measurement

- [ ] Record current Download size and Install size from Play Console → App bundle explorer for a representative device (e.g. Pixel arm64-v8a) for the current versionCode
- [ ] Note the universal AAB size for reference (currently ~74.7MB)
- _Requirements: 1.4, 4.1_

## Task 2: Move dev-only packages to devDependencies

- [ ] Move `expo-dev-client`, `@expo/ngrok`, `babel-preset-expo` from `dependencies` to `devDependencies` in `package.json` (verify each is not needed at runtime first)
- [ ] Run `npm install`; confirm `expo run:android`, dev client on device, and `expo start` still work
- [ ] Confirm a production build still succeeds
- _Requirements: 2.1, 2.2, 2.3_

## Task 3: Enable R8 minification and resource shrinking

- [ ] Set `android.enableMinifyInReleaseBuilds=true` and `android.enableShrinkResourcesInReleaseBuilds=true` (in `android/gradle.properties` or EAS production profile)
- [ ] Build a production AAB
- [ ] Full smoke test: navigation, card create/edit/delete, SQLite persistence across restart, image attachment + WebView media embeds, reminders/notifications, gestures + Reanimated animations, emotion session flow
- [ ] If anything breaks, add the necessary keep rules to `proguard-rules.pro` and re-test
- [ ] Measure new Download/Install size in App bundle explorer; record delta
- _Requirements: 1.1, 1.2, 1.3, 1.4_

## Task 4: (Optional) Drop x86 ABIs for production

- [ ] Restrict production `reactNativeArchitectures` to `armeabi-v7a,arm64-v8a` (production build path only; keep a dev path for x86 emulators or use an ARM emulator image)
- [ ] Build and verify on a real ARM device
- [ ] Document the emulator tradeoff
- [ ] Measure artifact/size delta
- _Requirements: 3.1, 3.2, 3.3_

## Task 5: Document final configuration

- [ ] Record before/after sizes and the final settings in `docs/deployment/app-deployment.md` (or a dedicated size note) so the config isn't accidentally reverted
- _Requirements: 4.1, 4.2_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3"] },
    { "id": 3, "tasks": ["4"] },
    { "id": 4, "tasks": ["5"] }
  ]
}
```
