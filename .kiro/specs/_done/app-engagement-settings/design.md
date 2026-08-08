# Design Document

## Overview

Adds standard engagement and support features to the Settings screen: rate app, share, contact support, send feedback, Terms of Service, open-source licenses, and dynamic version display. All features are local-first (no backend required) and leverage native OS capabilities.

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `docs/legal/privacy.html` | Static, self-contained Privacy Policy HTML page (hosted externally) |
| `docs/legal/terms.html` | Static, self-contained Terms of Service HTML page (hosted externally) |
| `src/screens/LicensesScreen.tsx` | Open-source license list with expand/collapse |
| `src/services/appActionsService.ts` | Rate, share, contact, feedback logic (encapsulated) |
| `scripts/generate-licenses.js` | Build-time script to extract license data from node_modules |
| `src/data/licenses.json` | Generated license data (bundled asset) |

### Modified Files

| File | Change |
|------|--------|
| `src/config/appInfo.ts` | Add store URLs, support/feedback emails, `PRIVACY_POLICY_URL`, `TERMS_OF_SERVICE_URL`, version helper |
| `src/screens/SettingsScreen.tsx` | Add "Support Us" section with 4 menu items; Privacy Policy and Terms of Service open via `WebBrowser.openBrowserAsync()` |
| `src/screens/AboutScreen.tsx` | Dynamic version, licenses link |
| `src/navigation/types.ts` | Add `Licenses` route |
| `src/navigation/RootNavigator.tsx` | Register Licenses screen |
| `package.json` | Add `expo-store-review`, `expo-web-browser`, license generation script |

## Detailed Design

### 1. App Config (`src/config/appInfo.ts`)

```typescript
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const APP_NAME = 'Mental Health Wallet';
export const APP_CONTACT_EMAIL = 'privacy@mentalhealthwallet.app';
export const APP_SUPPORT_EMAIL = 'support@mentalhealthwallet.app';
export const APP_FEEDBACK_EMAIL = 'feedback@mentalhealthwallet.app';

export const APP_STORE_URL = 'https://apps.apple.com/app/mental-health-wallet/id<TBD>';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.mentalhealthwallet.app';

export const PRIVACY_POLICY_URL = 'https://mentalhealthwallet.app/legal/privacy.html';
export const TERMS_OF_SERVICE_URL = 'https://mentalhealthwallet.app/legal/terms.html';

export function getStoreUrl(): string {
  return Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
}

export function getAppVersion(): string {
  const version = Constants.expoConfig?.version;
  const buildNumber = Platform.OS === 'ios'
    ? Constants.expoConfig?.ios?.buildNumber
    : Constants.expoConfig?.android?.versionCode?.toString();
  
  if (!version) return 'Version (dev)';
  if (buildNumber) return `Version ${version} (${buildNumber})`;
  return `Version ${version}`;
}
```

### 2. App Actions Service (`src/services/appActionsService.ts`)

Encapsulates all engagement actions. Each function handles its own error/fallback:

```typescript
import * as StoreReview from 'expo-store-review';
import * as Linking from 'expo-linking';
import { Share, Platform, Alert } from 'react-native';
import { APP_NAME, APP_SUPPORT_EMAIL, APP_FEEDBACK_EMAIL, getStoreUrl, getAppVersion } from '@/config/appInfo';

export async function requestAppReview(): Promise<void> {
  const isAvailable = await StoreReview.isAvailableAsync();
  if (isAvailable) {
    await StoreReview.requestReview();
  } else {
    const storeUrl = StoreReview.storeUrl();
    if (storeUrl) {
      await Linking.openURL(storeUrl);
    } else {
      await Linking.openURL(getStoreUrl());
    }
  }
}

export async function shareApp(): Promise<void> {
  const url = getStoreUrl();
  const message = `I've been using ${APP_NAME} to build better coping habits. Check it out: ${url}`;
  await Share.share({ message, url }); // url is used on iOS for link preview
}

export async function contactSupport(): Promise<void> {
  const subject = encodeURIComponent(`${APP_NAME} — Support Request`);
  const body = encodeURIComponent(buildEmailBody('support'));
  const mailto = `mailto:${APP_SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  
  const canOpen = await Linking.canOpenURL(mailto);
  if (canOpen) {
    await Linking.openURL(mailto);
  } else {
    Alert.alert('No Email App', `Send your request to:\n${APP_SUPPORT_EMAIL}`, [{ text: 'OK' }]);
  }
}

export async function sendFeedback(): Promise<void> {
  const subject = encodeURIComponent(`${APP_NAME} — Feedback`);
  const body = encodeURIComponent(buildEmailBody('feedback'));
  const mailto = `mailto:${APP_FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
  
  const canOpen = await Linking.canOpenURL(mailto);
  if (canOpen) {
    await Linking.openURL(mailto);
  } else {
    Alert.alert('No Email App', `Send your feedback to:\n${APP_FEEDBACK_EMAIL}`, [{ text: 'OK' }]);
  }
}

function buildEmailBody(type: 'support' | 'feedback'): string {
  const version = getAppVersion();
  const os = `${Platform.OS} ${Platform.Version}`;
  
  const greeting = type === 'feedback'
    ? "What's on your mind? We'd love to hear your ideas, suggestions, or anything else.\n\n\n"
    : "\n\n\n";
  
  return `${greeting}---\nApp: ${version}\nOS: ${os}\n`;
}
```

### 3. Settings Screen Changes

Add a "Support Us" section between "Safety" and "About":

```
Safety
  🆘 Crisis Resources

Support Us          ← NEW SECTION
  ⭐ Rate [APP_NAME]
  💜 Share with a Friend

Help & Feedback     ← NEW SECTION
  💬 Contact Support
  💡 Send Feedback

About
  ℹ️ About [APP_NAME]
```

Also add "Terms of Service" to the Privacy & Data section (below Privacy Policy):

```
Privacy & Data
  📋 Privacy Policy       → WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)
  📄 Terms of Service     → WebBrowser.openBrowserAsync(TERMS_OF_SERVICE_URL)
  🔘 Help improve the app (toggle)
  📤 Export Data
  ...
```

Both Privacy Policy and Terms of Service open via `expo-web-browser` in an in-app browser sheet (no dedicated screen components or navigation routes needed).

### 4. Legal Pages (Hosted via Web Browser)

Instead of dedicated in-app screen components, both Privacy Policy and Terms of Service are maintained as static HTML files and opened via `expo-web-browser`:

```typescript
import * as WebBrowser from 'expo-web-browser';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/config/appInfo';

// In SettingsScreen or PrivacyExplanationScreen:
await WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL);
await WebBrowser.openBrowserAsync(TERMS_OF_SERVICE_URL);
```

**Rationale:** App stores require publicly accessible URLs for legal pages during review. Hosting a single source of truth (HTML files) avoids content drift between in-app text and the required public pages.

**Content files:**
- `docs/legal/privacy.html` — static, responsive, self-contained Privacy Policy page
- `docs/legal/terms.html` — static, responsive, self-contained Terms of Service page

These HTML files are deployed to the configured URLs. No navigation routes (`PrivacyPolicy`, `TermsOfService`) are needed in the app's route stack for these pages.

### 5. Licenses Screen

- Header with back button
- FlatList/ScrollView of license entries
- Each entry shows: package name (bold), license type (badge/pill), copyright line
- Tapping an entry expands to show full license text
- Data sourced from `src/data/licenses.json` (generated at build time)

### 6. About Screen Changes

- Replace hardcoded "Version 1.0.0" with `getAppVersion()` call
- Add "Open-Source Licenses" touchable at the bottom that navigates to Licenses screen

### 7. Build-Time License Generation

A Node script (`scripts/generate-licenses.js`) that:
1. Reads `package.json` dependencies
2. For each package, reads `node_modules/<pkg>/package.json` for license field and `LICENSE` file
3. Outputs `src/data/licenses.json` with shape: `{ packages: [{ name, version, license, copyright, licenseText }] }`
4. Added as an npm script: `"generate-licenses": "node scripts/generate-licenses.js"`

This should be run before release builds (can be added to EAS build pre-install hook).

## Navigation Changes

```typescript
// In types.ts — add to RootStackParamList:
Licenses: undefined;
```

Only the Licenses screen is registered as a push screen in RootNavigator. Privacy Policy and Terms of Service no longer have dedicated routes — they open via `expo-web-browser` in-app browser sheets.

## Dependency Impact

| Package | Purpose | Already Installed? |
|---------|---------|-------------------|
| `expo-store-review` | Native in-app review prompt | No — needs install |
| `expo-web-browser` | Open legal pages (Privacy Policy, Terms of Service) in in-app browser sheet | No — needs install |
| `expo-constants` | App version at runtime | Yes |
| `expo-linking` | Open email client, store URLs | Yes |
| React Native `Share` | Native share sheet | Built-in |
| React Native `Platform` | OS info for email footer | Built-in |

## Testing Considerations

- `appActionsService` functions can be unit tested by mocking `expo-store-review`, `Linking`, and `Share`
- `contactSupport()` and `sendFeedback()` wrap `Linking.canOpenURL`/`openURL` in try/catch for robustness — test both success and error paths
- Legal pages use `expo-web-browser` — verify `WebBrowser.openBrowserAsync` is called with the correct URL constant
- Licenses screen can be tested with mock license data
- Version helper can be tested with mocked `Constants.expoConfig`
- Settings screen integration: verify new items render and call correct service functions
