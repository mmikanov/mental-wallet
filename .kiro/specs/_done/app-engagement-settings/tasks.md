# Implementation Tasks

## Task Dependency Graph

```
Wave 1 (foundations — no dependencies):
  Task 1: App config constants + version helper (Req 7, 8)
  Task 2: Install expo-store-review
  Task 5: Terms of Service screen content + navigation (Req 5)
  Task 6: License generation script (Req 6 — script only)

Wave 2 (depends on Wave 1):
  Task 3: App actions service (Req 1, 2, 3, 4) — depends on Task 1, Task 2
  Task 7: Licenses screen + About screen link (Req 6) — depends on Task 6, Task 1

Wave 3 (depends on Wave 2):
  Task 4: Settings screen sections (Req 1, 2, 3, 4) — depends on Task 3
  Task 8: About screen dynamic version (Req 7) — depends on Task 1

Wave 4 (verification):
  Task 9: Final verification — depends on all above
```

---

## Wave 1 — Foundations

### Task 1: Expand appInfo.ts with config constants and version helper
**Implements:** Req 7, Req 8

- [x] Add constants to `src/config/appInfo.ts`: `APP_STORE_URL`, `PLAY_STORE_URL`, `APP_SUPPORT_EMAIL`, `APP_FEEDBACK_EMAIL`
- [x] Add `getStoreUrl()` function returning platform-appropriate store URL
- [x] Add `getAppVersion()` function reading from `expo-constants` with dev fallback
- [x] Verify type-checking passes with `npm run typecheck`

### Task 2: Install expo-store-review
**Implements:** Req 1 (dependency)

- [x] Run `npx expo install expo-store-review`
- [x] Verify the package is added to `package.json` dependencies
- [x] Verify type-checking passes (types are bundled with the package)

### Task 5: Create Terms of Service screen
**Implements:** Req 5
**Note:** Originally implemented as a dedicated screen. Subsequently replaced by hosted web page approach (see Post-Implementation Changes below).

- [x] ~~Add `TermsOfService` route to `RootStackParamList` in `src/navigation/types.ts`~~ (removed — see Change 1)
- [x] ~~Create `src/screens/TermsOfServiceScreen.tsx` following PrivacyPolicyScreen pattern~~ (removed — see Change 1)
- [x] ~~Write Terms of Service content as a `TERMS_SECTIONS` constant~~ (moved to `docs/legal/terms.html`)
- [x] ~~Register `TermsOfServiceScreen` in `RootNavigator.tsx`~~ (removed — see Change 1)
- [x] Add "Terms of Service" (📄) menu item to Settings Privacy & Data section, below Privacy Policy
- [x] Verify navigation works and type-checking passes

### Task 6: Create license generation script
**Implements:** Req 6 (build-time tooling)

- [x] Create `scripts/generate-licenses.js` that:
  - Reads `package.json` production `dependencies`
  - Excludes dev-only packages via configurable exclusion list (`expo-dev-client`, `@expo/ngrok`)
  - For each package: reads `node_modules/<pkg>/package.json` (license field, author) and `LICENSE`/`LICENSE.md` file
  - Outputs `src/data/licenses.json` with shape: `{ packages: [{ name, version, license, copyright, licenseText }] }`
- [x] Add npm script: `"generate-licenses": "node scripts/generate-licenses.js"`
- [x] Run the script to generate initial `src/data/licenses.json`
- [x] Add EAS Build hook in `eas.json` to run the script pre-build
- [x] Add `src/data/licenses.json` to `.gitignore` (generated file, not committed)

---

## Wave 2 — Service Layer & Licenses Screen

### Task 3: Create appActionsService
**Implements:** Req 1, 2, 3, 4
**Depends on:** Task 1 (config constants), Task 2 (expo-store-review)

- [x] Create `src/services/appActionsService.ts`
- [x] Implement `requestAppReview()`: check `isAvailableAsync()` → `requestReview()` or fall back to store URL
- [x] Implement `shareApp()`: use React Native `Share.share()` with pre-composed message using `APP_NAME` and `getStoreUrl()`
- [x] Implement `contactSupport()`: compose mailto with `APP_SUPPORT_EMAIL`, subject using `APP_NAME`, device info footer via `getAppVersion()` and `Platform`; alert fallback
- [x] Implement `sendFeedback()`: compose mailto with `APP_FEEDBACK_EMAIL`, friendly prompt body, same device info footer; alert fallback
- [x] Verify type-checking passes

### Task 7: Create Licenses screen and link from About
**Implements:** Req 6 (UI)
**Depends on:** Task 6 (generated licenses.json), Task 1 (config/navigation patterns)

- [x] Add `Licenses` route to `RootStackParamList` in `src/navigation/types.ts`
- [x] Create `src/screens/LicensesScreen.tsx`:
  - Import and read `src/data/licenses.json`
  - Render scrollable list of packages (name bold, license type as pill/badge, copyright line)
  - Each entry tappable to expand/collapse full license text
  - Standard screen layout (SafeAreaView, back button header)
- [x] Register `LicensesScreen` in `RootNavigator.tsx`
- [x] Add "Open-Source Licenses" touchable to the bottom of `AboutScreen.tsx` (after Trademark Notice section)
- [x] Verify navigation works

---

## Wave 3 — UI Integration

### Task 4: Add "Support Us" and "Help & Feedback" sections to Settings
**Implements:** Req 1, 2, 3, 4 (UI wiring)
**Depends on:** Task 3 (appActionsService)

- [x] Import `requestAppReview`, `shareApp`, `contactSupport`, `sendFeedback` from `@/services/appActionsService`
- [x] Import `APP_NAME` from `@/config/appInfo`
- [x] Add "Support Us" section between "Safety" and "Help & Feedback" with:
  - ⭐ `Rate ${APP_NAME}` → `requestAppReview()`
  - 💜 Share with a Friend → `shareApp()`
- [x] Add "Help & Feedback" section between "Support Us" and "About" with:
  - 💬 Contact Support → `contactSupport()`
  - 💡 Send Feedback → `sendFeedback()`
- [x] Verify accessibility labels and roles on all new items
- [ ] Verify type-checking passes

### Task 8: Dynamic version in About screen
**Implements:** Req 7 (UI)
**Depends on:** Task 1 (getAppVersion helper)

- [x] Import `getAppVersion` from `@/config/appInfo`
- [x] Replace hardcoded `Version 1.0.0` text with `getAppVersion()` return value
- [x] Verify it displays "Version (dev)" in development and reads from config in production builds

---

## Wave 4 — Verification

### Task 9: Final verification
**Depends on:** All previous tasks

- [x] Run `npm run typecheck` — all passes
- [x] Run `npm test` — no regressions
- [x] Run `npm run lint` — no new warnings
- [x] Verify Settings screen section order: Start Experience → Focus → Insights → Privacy & Data (with ToS) → Safety → Support Us → Help & Feedback → About
- [x] Verify About screen shows: dynamic version, attributions, licenses link
- [x] Verify each action works: rate opens review/store, share opens share sheet, contact/feedback opens email


---

## Post-Implementation Changes

### Change 1: Privacy Policy & Terms of Service → Hosted Web Pages
**Reason:** App stores require publicly accessible URLs for legal pages. Hosting a single source of truth avoids content drift between in-app text and the required public pages.

- [x] Install `expo-web-browser` via `npx expo install expo-web-browser`
- [x] Add `PRIVACY_POLICY_URL` and `TERMS_OF_SERVICE_URL` constants to `src/config/appInfo.ts`
- [x] Update `SettingsScreen.tsx` — Privacy Policy and Terms of Service now open via `WebBrowser.openBrowserAsync()` instead of `navigation.navigate()`
- [x] Update `PrivacyExplanationScreen.tsx` (onboarding) — same pattern
- [x] Remove `PrivacyPolicy` and `TermsOfService` routes from `src/navigation/types.ts`
- [x] Remove screen registrations from `src/navigation/RootNavigator.tsx`
- [x] Delete `src/screens/PrivacyPolicyScreen.tsx`
- [x] Delete `src/screens/TermsOfServiceScreen.tsx`
- [x] Create `docs/legal/privacy.html` — static, responsive, self-contained Privacy Policy page
- [x] Create `docs/legal/terms.html` — static, responsive, self-contained Terms of Service page

### Change 2: Email fallback robustness
**Reason:** iOS simulator reports `canOpenURL('mailto:...')` as `true` but `openURL` fails silently with no Mail app installed.

- [x] Wrap `Linking.canOpenURL` + `Linking.openURL` in try/catch in both `contactSupport()` and `sendFeedback()`
- [x] On any error, fall through to Alert showing the email address
