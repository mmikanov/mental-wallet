# Requirements Document

## Introduction

Standard mobile app engagement and support features that help users stay connected, provide feedback, and access important legal/informational content. These features live in the Settings screen and improve retention, organic growth, and user trust.

**Current state:** The Settings screen already has: Start Experience, Focus (KPI), Insights toggles, Privacy & Data (Privacy Policy, analytics opt-in, export data, reset analytics, delete all data), Safety (Crisis Resources), and About (app name, version, disclaimer, attributions). 

**Missing features to add:**
- Rate / Review the app (App Store / Play Store deep link)
- Share the app with a friend (native share sheet)
- Contact support (email composer)
- Send feedback (email composer with diagnostic info)
- Terms of Service screen
- Open-source licenses screen
- Dynamic version display (from app.json config, not hardcoded)

**Design principles:**
- Lightweight — no backend services required, everything uses native OS capabilities
- Privacy-first — feedback emails only include info the user can see (version, OS) and explicitly opts them in
- Minimal friction — one tap to rate, share, or contact support

## Requirements

### Requirement 1: Rate the App

**User Story:** As a user, I want a quick way to leave a review on the App Store or Play Store so I can support the app if I find it helpful.

#### Acceptance Criteria

1. THE Settings screen SHALL display a "Rate [APP_NAME]" menu item in a new "Support Us" section positioned between the "Safety" and "Help & Feedback" sections, where `APP_NAME` is read from `src/config/appInfo.ts`.
2. Tapping the item SHALL trigger the native in-app review prompt using `expo-store-review` (StoreReview.requestReview()) on both iOS and Android.
3. IF the native review prompt is unavailable (e.g., already shown recently, unsupported OS version), THE App SHALL fall back to opening the App Store / Play Store listing in the system browser using `StoreReview.storeUrl()` or a configured URL.
4. THE menu item SHALL use a ⭐ emoji icon and display "Rate [APP_NAME]" as its label, where `APP_NAME` is read from `src/config/appInfo.ts`.
5. THE App SHALL check `StoreReview.isAvailableAsync()` before attempting the native prompt and fall back to the store URL if unavailable.

### Requirement 2: Share the App

**User Story:** As a user, I want to easily share the app with friends who might benefit from it.

#### Acceptance Criteria

1. THE Settings screen SHALL display a "Share with a Friend" menu item in the "Support Us" section, below "Rate [APP_NAME]".
2. Tapping the item SHALL open the native OS share sheet with a pre-composed message and the app's store URL.
3. The share message SHALL be: "I've been using [APP_NAME] to build better coping habits. Check it out: [store URL]" where `APP_NAME` is read from config.
4. THE share content SHALL use the platform-appropriate store URL (App Store on iOS, Play Store on Android).
5. THE menu item SHALL use a 💜 emoji icon and display "Share with a Friend" as its label.
6. THE App SHALL use `expo-sharing` or React Native's built-in `Share` API to invoke the share sheet.

### Requirement 3: Contact Support

**User Story:** As a user, I want to be able to contact the app developers if I need help or have a problem.

#### Acceptance Criteria

1. THE Settings screen SHALL display a "Contact Support" menu item in a new "Help & Feedback" section positioned between the "Support Us" and "About" sections.
2. Tapping the item SHALL open the device's email client with a pre-filled email:
   - **To:** `APP_SUPPORT_EMAIL` (from `src/config/appInfo.ts`)
   - **Subject:** "[APP_NAME] — Support Request"
   - **Body:** A template with device diagnostic info: app version, OS name, OS version. This info is separated from the user's message area by a clear divider.
3. IF no email client is available, THE App SHALL show an alert with the support email address (from config) so the user can copy it manually.
4. THE menu item SHALL use a 💬 emoji icon and display "Contact Support" as its label.
5. Device info in the email body SHALL be obtained from React Native's `Platform` API and the app version from config — no personally identifiable information is included.

### Requirement 4: Send Feedback

**User Story:** As a user, I want to send feature ideas or general feedback to the developers without it feeling like a support ticket.

#### Acceptance Criteria

1. THE Settings screen SHALL display a "Send Feedback" menu item in the "Help & Feedback" section, below "Contact Support".
2. Tapping the item SHALL open the device's email client with a pre-filled email:
   - **To:** `APP_FEEDBACK_EMAIL` (from `src/config/appInfo.ts`)
   - **Subject:** "[APP_NAME] — Feedback"
   - **Body:** A friendly prompt ("What's on your mind? We'd love to hear your ideas, suggestions, or anything else.") followed by the same device info footer as Contact Support.
3. IF no email client is available, THE App SHALL show an alert with the feedback email address (from config) so the user can copy it manually.
4. THE menu item SHALL use a 💡 emoji icon and display "Send Feedback" as its label.

### Requirement 5: Terms of Service (Hosted Web Page)

**User Story:** As a user, I want to read the app's Terms of Service to understand my rights and responsibilities.

#### Acceptance Criteria

1. THE Settings screen SHALL display a "Terms of Service" menu item in the "Privacy & Data" section, positioned directly below "Privacy Policy".
2. Tapping the item SHALL open the hosted Terms of Service page via `expo-web-browser` (`WebBrowser.openBrowserAsync(TERMS_OF_SERVICE_URL)`), displayed in an in-app browser sheet (Safari on iOS, Chrome Custom Tab on Android).
3. THE Terms of Service URL SHALL be defined as `TERMS_OF_SERVICE_URL` in `src/config/appInfo.ts`.
4. The Terms of Service content SHALL be maintained as a static, self-contained HTML file at `docs/legal/terms.html`, hosted at the configured URL.
5. THE Terms of Service page SHALL cover at minimum: acceptance of terms, license to use, prohibited uses, intellectual property, disclaimer of warranties, limitation of liability, termination/data deletion, governing law, and changes to terms.
6. THE menu item SHALL use a 📄 emoji icon and display "Terms of Service" as its label.

> **Note:** The Privacy Policy follows the same pattern — it opens via `WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)` using the `PRIVACY_POLICY_URL` constant from `src/config/appInfo.ts`. The content is maintained as a static HTML file at `docs/legal/privacy.html`. The onboarding `PrivacyExplanationScreen` also uses this approach to link to the full privacy policy.

### Requirement 6: Open-Source Licenses Screen

**User Story:** As a user, I want to see what open-source software the app uses, for transparency and legal compliance.

#### Acceptance Criteria

1. THE About screen SHALL display an "Open-Source Licenses" menu item below the existing content (after Trademark Notice).
2. Tapping the item SHALL navigate to a new `Licenses` screen.
3. THE Licenses screen SHALL display a scrollable list of direct production dependencies only (not devDependencies, not transitive sub-packages), showing: package name, license type (MIT, Apache-2.0, etc.), and a brief copyright notice.
4. License data SHALL be auto-generated by a build-time script (`scripts/generate-licenses.js`) that reads `package.json` production `dependencies`, extracts each package's license field and LICENSE file from `node_modules`, and outputs `src/data/licenses.json`.
5. THE script SHALL be registered as an EAS Build pre-install hook so that the license list is always current in every release build — no manual maintenance needed when new packages are added.
6. THE script SHALL exclude dev-only packages that don't ship in the production binary (e.g., `expo-dev-client`, `@expo/ngrok`) via a configurable exclusion list in the script.
7. Each license entry SHALL be tappable to expand and show the full license text.
8. THE navigation types SHALL be extended with a `Licenses` route in `RootStackParamList`.
9. THE Licenses screen SHALL follow the app's standard screen layout (SafeAreaView, back button header, scrollable content).

### Requirement 7: Dynamic Version Display

**User Story:** As a user, I want to see the current app version so I can reference it when contacting support or checking for updates.

#### Acceptance Criteria

1. THE About screen SHALL display the app version dynamically from the Expo config (`expo-constants` — `Constants.expoConfig?.version`) instead of the current hardcoded "Version 1.0.0" string.
2. THE version display SHALL also include the build number when available (`Constants.expoConfig?.ios?.buildNumber` or `Constants.expoConfig?.android?.versionCode`), formatted as "Version X.Y.Z (build N)".
3. THE `appInfo.ts` config SHALL export a helper function or constant for retrieving the version string, centralizing version access for both the About screen and email templates (Requirements 3 & 4).
4. IF the version cannot be determined at runtime (e.g., in development), THE App SHALL fall back to displaying "Version (dev)" to avoid showing undefined/null.

### Requirement 8: App Config Constants

**User Story:** As a developer, I want all external URLs and contact info centralized so they can be updated in one place.

#### Acceptance Criteria

1. THE `src/config/appInfo.ts` file SHALL be extended with the following constants:
   - `APP_STORE_URL` — iOS App Store listing URL (placeholder until finalized)
   - `PLAY_STORE_URL` — Google Play Store listing URL (placeholder until finalized)
   - `APP_SUPPORT_EMAIL` — support email address (placeholder, domain TBD)
   - `APP_FEEDBACK_EMAIL` — feedback email address (placeholder, domain TBD)
   - `PRIVACY_POLICY_URL` — hosted privacy policy page URL
   - `TERMS_OF_SERVICE_URL` — hosted terms of service page URL
2. All features in this spec SHALL reference these constants rather than hardcoding URLs or email addresses. This ensures that when the domain is finalized, only `appInfo.ts` needs to change.
3. The existing `APP_CONTACT_EMAIL` (privacy email, also placeholder) SHALL remain as a separate constant — it is specifically for privacy inquiries as referenced in the Privacy Policy.

## Out of Scope

- In-app feedback forms (requires backend) — email is sufficient for MVP
- What's New / Changelog screen (can be added post-launch when there are actual updates)
- Delete account (no user accounts exist — "Delete All Data" already handles this)
- Live chat support (requires backend infrastructure)
- Community links (Discord, etc.) — can be added when community exists
- Referral tracking / reward programs — share is a simple share sheet, no tracking

## Dependencies

- `expo-store-review` — for native in-app review prompt
- `expo-web-browser` — for opening legal pages (Privacy Policy, Terms of Service) in an in-app browser sheet
- `expo-constants` — for dynamic version reading (already installed)
- `expo-linking` — for opening email client (already installed)
- React Native `Share` API — for share sheet (built-in)
- React Native `Platform` API — for device info in emails (built-in)
- A build-time license generation script (e.g., `license-report`) for the Licenses screen
