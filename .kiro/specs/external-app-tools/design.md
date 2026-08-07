# Design Document

## Overview

External App Tools extends the curated library and wallet system to include cards representing third-party wellness apps. These cards use the existing card infrastructure (shell, controls, rationale, completions) with a new `"app"` origin badge and an `externalApp` metadata field for deep linking and affiliate tracking.

The feature is additive — no existing behavior changes to card shell, library browsing, or wallet management. However, it does introduce a new completion behavior: cards that have a `link_button` and no user-input controls will auto-complete on link tap. This affects existing user-created cards that happen to have only a `link_button`, in addition to the new app-origin cards. Cards with only `static_text`/`display_media` and NO link_button are unaffected — they still show "Mark as done".

## Architecture

### Data Flow

```
externalAppCards.ts (static definitions)
  ↓
curatedLibrary.ts (CURATED_LIBRARY array includes external app cards)
  ↓
getMergedLibrary() (existing merge logic — no changes needed)
  ↓
LibraryBrowserScreen (displays with "Apps" orthogonal filter or within category sections)
  ↓ user taps "Add to wallet"
cardService.create() (existing flow, originBadge = 'app')
  ↓ user opens card in wallet
FocusedCardView → "Open in [App]" button → deepLinkService → auto-complete
  ↓
Deep link attempt → success: app opens
                  → failure: app store → affiliate URL → web URL
```

### New Files

| File | Purpose |
|------|---------|
| `src/data/externalAppCards.ts` | Static definitions for the 7 external app cards |
| `src/services/deepLinkService.ts` | Deep link launching with fallback logic |
| `src/types/externalApp.ts` | `ExternalAppConfig` interface |
| `src/data/appLogoRegistry.ts` | Maps card IDs to bundled local logo assets (offline support) |
| `src/config/appInfo.ts` | Central app name constant (`APP_NAME`) for UI strings |
| `assets/app-logos/*.jpg` | Bundled app logo images (7 files, 128-512px) |

### Modified Files

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `'app'` to `OriginBadge` union; add `isAffiliate?` to `LinkButtonConfig` |
| `src/data/curatedLibrary.ts` | Extend `CuratedCardDefinition` with `externalApp?` field; import and spread external app cards into `CURATED_LIBRARY` |
| `src/data/migrations.ts` | Add `runOriginBadgeAppMigration`; update SCHEMA_SQL |
| `src/screens/LibraryBrowserScreen.tsx` | Add "Apps" filter pill; badge rendering; origin badge on add; stale detection for app cards |
| `src/screens/libraryBrowserHelpers.ts` | Duplicate detection includes `'app'` origin |
| `src/screens/ArchiveScreen.tsx` | Fix icon rendering with `sourceId`; category-specific tag colors |
| `src/components/wallet/OriginBadge.tsx` | Add `'app'` badge config |
| `src/components/wallet/ExpandedContent.tsx` | `isLinkOnlyCard` helper; auto-complete logic; affiliate disclosure |
| `src/components/wallet/FocusedCardView.tsx` | Pass `sourceId` to icons; inline disclosure; `showAffiliateDisclosure` |
| `src/components/wallet/CardPreviewSheet.tsx` | External app indicator; inline disclosure; hide controls for app cards |
| `src/components/wallet/CardEdge.tsx` | Pass `sourceId` to `renderCardIcon` |
| `src/components/wallet/CollapsedStack.tsx` | Pass `sourceId` to `renderCardIcon` |
| `src/components/wallet/ThirdPartyIcon.tsx` | `resizeMode="cover"` with border radius |
| `src/components/rationale/RationaleSheet.tsx` | `showAffiliateDisclosure` prop; disclosure section; use `APP_NAME` |
| `src/components/rationale/RationaleEntryPoint.tsx` | `color` prop; darker default; underline |
| `src/components/session/ToolPreviewCard.tsx` | Use `renderCardIcon` instead of raw Text |
| `src/components/session/LibraryToolPreview.tsx` | Use `renderCardIcon` instead of raw Text |
| `src/components/session/SessionLauncherContent.tsx` | Pass `iconType` to `ToolPreviewCard` |
| `src/components/creator/Step2Controls.tsx` | Admin "Affiliate link" toggle for link_button |
| `src/services/adminCardService.ts` | `cardToCuratedDefinition` carries `externalApp` field |
| `src/services/analyticsEventLogger.ts` | `logExternalAppLaunched` helper; `'external_app_launched'` in valid types |
| `src/services/exportService.ts` | Include `externalApp` block in export; use `APP_NAME` |
| `src/services/recommendationService.ts` | Add `iconType` to `ToolRecommendation` and queries |
| `src/services/devInsightsMockData.ts` | Skip duration records for app-origin cards |
| `src/types/analytics.ts` | `ExternalAppLaunchedEvent` type |
| `src/utils/renderCardIcon.tsx` | `sourceId` prop; local logo registry lookup |

## Components and Interfaces

### ExternalAppConfig Type

```typescript
// src/types/externalApp.ts

export interface ExternalAppConfig {
  /** Display name of the external app */
  appName: string;
  /** Deep link URL to open the app directly (platform-specific) */
  deepLinkUrl?: string;
  /** Web URL — always available as the last-resort fallback */
  webUrl: string;
  /** iOS App Store ID (numeric string) for App Store fallback */
  appStoreId?: string;
  /** Android package name for Play Store fallback */
  playStoreId?: string;
  /** Affiliate network name for internal reference */
  affiliateNetwork?: string;
  /** Whether the current fallback URL is an affiliate link (controls FTC disclosure visibility) */
  hasAffiliateLink?: boolean;
  /** 1-2 letter monogram for icon fallback (shown if logo fails to load) */
  monogram: string;
}
```

### Extended CuratedCardDefinition

```typescript
// Added to existing CuratedCardDefinition in src/data/curatedLibrary.ts

export interface CuratedCardDefinition {
  // ... existing fields ...
  externalApp?: ExternalAppConfig;
}
```

### Deep Link Service

```typescript
// src/services/deepLinkService.ts

import { Linking, Platform } from 'react-native';

export interface LaunchResult {
  success: boolean;
  method: 'deep_link' | 'app_store' | 'web_fallback' | 'affiliate_fallback';
}

/**
 * Attempt to launch an external app with the following fallback chain:
 * 1. Try deep link URL (cross-platform scheme preferred, e.g. headspace://)
 * 2. Fall back to platform-specific app store (iOS App Store or Google Play)
 * 3. Fall back to affiliate URL (if provided)
 * 4. Fall back to generic web URL
 */
export async function launchExternalApp(config: ExternalAppConfig): Promise<LaunchResult> {
  // 1. Try deep link (cross-platform scheme preferred)
  if (config.deepLinkUrl) {
    const canOpen = await Linking.canOpenURL(config.deepLinkUrl);
    if (canOpen) {
      await Linking.openURL(config.deepLinkUrl);
      return { success: true, method: 'deep_link' };
    }
  }

  // 2. Try platform-specific app store
  const storeUrl = getStoreUrl(config);
  if (storeUrl) {
    await Linking.openURL(storeUrl);
    return { success: true, method: 'app_store' };
  }

  // 3. Try affiliate URL
  if (config.affiliateUrl) {
    await Linking.openURL(config.affiliateUrl);
    return { success: true, method: 'affiliate_fallback' };
  }

  // 4. Fall back to web URL
  await Linking.openURL(config.webUrl);
  return { success: true, method: 'web_fallback' };
}

function getStoreUrl(config: ExternalAppConfig): string | null {
  if (Platform.OS === 'ios' && config.appStoreId) {
    return `https://apps.apple.com/app/id${config.appStoreId}`;
  }
  if (Platform.OS === 'android' && config.playStoreId) {
    return `https://play.google.com/store/apps/details?id=${config.playStoreId}`;
  }
  return null;
}
```

### Analytics Event Extension

```typescript
// Added to src/types/analytics.ts

export type AnalyticsEventType =
  | // ... existing types ...
  | 'external_app_launched';

export type ExternalAppLaunchedEvent = AnalyticsEventBase & {
  event_type: 'external_app_launched';
  properties: {
    card_id: string;
    app_name: string;
    launch_method: 'deep_link' | 'app_store' | 'web_fallback' | 'affiliate_fallback';
    has_affiliate: boolean;
  };
};
```

### Apps Category

External app cards do NOT use a separate category. Instead, they are assigned to one of the existing 6 therapeutic categories based on their primary use:

| App | Category ID | Rationale |
|-----|-------------|-----------|
| Headspace | `grounding-calming` | Meditation and mindfulness exercises |
| Calm | `grounding-calming` | Meditation, breathing, sleep |
| Talkspace | `lightweight-connection` | Connecting with a therapist |
| BetterHelp | `lightweight-connection` | Connecting with a therapist |
| Wysa | `cognitive-reframing` | CBT-based AI chatbot |
| Mindfulness.com | `grounding-calming` | Meditation library |
| Insight Timer | `grounding-calming` | Meditation timer and guided sessions |

The "Apps" filter in the Library Browser is an orthogonal filter that shows all cards where `originBadge === 'app'`, regardless of category. This allows:
- App cards to appear naturally within their therapeutic category
- App cards to be surfaced in emotion session suggestions via `emotionTags`
- A dedicated "Apps" view for users who want to discover external tools specifically

## Data Models

### External App Card Definition Example

```typescript
// src/data/externalAppCards.ts

export const EXTERNAL_APP_CARDS: CuratedCardDefinition[] = [
  {
    id: 'app-headspace',
    title: 'Headspace',
    description: 'Guided meditation, sleep, and focus exercises for everyday mindfulness.',
    iconType: 'third_party',
    iconValue: 'https://play-lh.googleusercontent.com/...',  // Official logo URL
    backgroundType: 'color',
    backgroundValue: '#FE8645',   // Headspace brand orange
    categoryId: 'grounding-calming',
    allowBackgroundCustomization: false, // Preserve brand identity
    controls: [
      {
        type: 'link_button',
        position: 0,
        config: {
          label: 'Open in Headspace',
          targetUrl: 'headspace://home',            // deep link
          fallbackUrl: 'https://www.headspace.com', // web fallback
        },
        isRequired: false,
      },
    ],
    externalApp: {
      appName: 'Headspace',
      deepLinkUrl: 'headspace://home',
      webUrl: 'https://www.headspace.com',
      affiliateUrl: '', // Placeholder — populate after CJ Affiliate signup
      appStoreId: '493145008',
      playStoreId: 'com.getsomeheadspace.android',
      affiliateNetwork: 'CJ Affiliate',
      monogram: 'H',
    },
    rationale: {
      approach: 'mindfulness-based stress reduction',
      inANutshell: '...', // Sourced from Headspace's official website/research pages
      howItWorks: '...',  // Sourced from Headspace's official website/research pages
      evidenceLevel: 'strong',
      researchSummary: ['...', '...'],
      learnMoreLinks: [
        { title: 'Headspace Research', url: 'https://www.headspace.com/science' },
      ],
    },
  },
  // ... 6 more app cards with their respective brand colors and logos
];
```

### Database Considerations

No new tables or migrations needed. External app cards use the existing `cards` table when added to wallet:
- `origin_badge = 'app'`
- `source_library_id = 'app-headspace'` (etc.)
- `category_id` = one of the existing 6 categories (e.g., `'grounding-calming'`)
- Controls are stored as normal (the `link_button` control with deep link URL)

The `externalApp` metadata is available from the static definition (via `CURATED_LIBRARY.find(c => c.id === card.sourceLibraryId)`) and does NOT need to be duplicated in the database.

### Asset Strategy for App Logos

App logos are hosted as HTTPS URLs (from the app's official CDN or our own asset hosting). The existing `ThirdPartyIcon` component downloads them on first use, caches them locally via `expo-file-system`.

Each card's `iconValue` is set to the app's official logo URL (HTTPS). The `iconType` is `'third_party'`. This requires no new bundling logic — the existing infrastructure handles it.

### Fallback Icon: Styled Monogram (not emoji)

When the logo fails to load, external app cards use a **styled monogram badge** instead of an emoji fallback. This visually differentiates them from native tools (which use emoji icons) even in the fallback state.

The monogram is rendered as a circular `View` with the card's brand background color and a centered bold white letter:

| App | Monogram | Background |
|-----|----------|------------|
| Headspace | **H** | `#FE8645` |
| Calm | **C** | `#4276CE` |
| Talkspace | **T** | `#B9DDFF` |
| BetterHelp | **B** | `#397A4A` |
| Wysa | **W** | `#00A3AD` |
| Mindfulness.com | **M** | `#7C4DFF` |
| Insight Timer | **IT** | `#C17B00` |

Implementation: Extend `ThirdPartyIcon` with a new optional prop `fallbackMonogram?: string`. When provided, the fallback renders the monogram badge instead of the emoji. The `ExternalAppConfig` type includes a `monogram` field so each card definition specifies its fallback letter(s).

### Brand Colors

Each external app card uses a **light pastel tint** of the app's brand color as its `backgroundValue`. This ensures proper contrast with dark text and badges while retaining the app's identity:

| App | Background Color | Hex | Brand Hue |
|-----|-----------------|-----|-----------|
| Headspace | Soft Peach | `#FFF0E6` | Orange |
| Calm | Soft Blue | `#E8F0FA` | Blue |
| Talkspace | Light Blue | `#E8F4FF` | Blue |
| BetterHelp | Soft Green | `#E6F4EA` | Green |
| Wysa | Soft Teal | `#E0F7FA` | Teal |
| Mindfulness.com | Soft Purple | `#F0EBFF` | Purple |
| Insight Timer | Soft Amber | `#FFF4E0` | Gold |

Cards should NOT allow background customization (`allowBackgroundCustomization: false`) to preserve the brand identity.

## UI Behavior

### Link Button Auto-Completion Logic

The existing `LinkButtonControl` is enhanced with auto-completion for "link-only" cards:

```typescript
/**
 * Determines if a card qualifies for auto-completion on link button tap.
 * A card qualifies if it has at least one link_button AND no user-input controls.
 * Cards with only static_text/display_media (no link_button) still need "Mark as done".
 */
function isLinkOnlyCard(controls: Control[]): boolean {
  const hasUserInput = controls.some(c => USER_INPUT_TYPES.has(c.type));
  const hasLinkButton = controls.some(c => c.type === 'link_button');
  return !hasUserInput && hasLinkButton;
}
```

When `isLinkOnlyCard(card.controls)` is true:
- Tapping the link button opens the URL AND calls `completionService.record()` in one action
- The submit button ("Mark as done") is hidden — it's not needed
- Success feedback shows briefly, then card collapses to focused state

This applies uniformly to:
- Curated app-origin cards (Headspace, Calm, etc.)
- User-created `my_tool` cards with only a link_button (e.g., a user adds their Spotify playlist)
- Any library card that consists of only static text + a link button

### Library Browser

- "Apps" filter pill appears after the existing 6 category pills as an orthogonal filter
- When selected, shows all cards with `originBadge === 'app'`, grouped by their assigned therapeutic category
- When a regular category filter is selected, app cards in that category appear alongside native cards
- Each card row shows: app logo, title, short description, "App" badge
- Three-state button: "Add to wallet" / "In wallet" / "Restore from archive"

### Focused Card View (in wallet)

- Card shell shows as normal (logo, title, description, "App" badge)
- Primary action button: "Open in [App Name]" with external-link icon
- Tapping the button launches the external app AND automatically records a completion (no separate "Log use" step needed)
- Stats section shows usage count and streak (same as native cards)
- Kebab menu: Archive, Set reminder, View history (same as native cards)

### Card Preview Sheet (library browse)

- Shows card shell with app logo and description
- Shows rationale section (if available) with "Learn more" entry point
- "Open in [App Name]" preview button (disabled/informational)
- "Add to wallet" button at the bottom
- No interactive controls (external apps don't have fillable controls)

### Rationale Sheet

- Same layout as native tool rationale sheets
- Additional line at the bottom for affiliate cards: disclosure text
- "Further reading" links point to the app's own research/about pages

## Testing Strategy

- Unit test: `launchExternalApp` correctly attempts deep link first, then affiliate fallback, then web fallback
- Unit test: `ExternalAppConfig` validation (webUrl required, other fields optional)
- Unit test: `external_app_launched` analytics event fires with correct properties
- Unit test: "Apps" category filter shows only app-origin cards
- Unit test: affiliate disclosure appears only when `affiliateUrl` is present
- Unit test: external app cards create correctly with `origin_badge = 'app'`
- Unit test: manual completion logging works for app cards (increments totalUses, updates streak)
- Integration test: LibraryBrowserScreen renders app cards under "Apps" section
- Integration test: FocusedCardView shows "Open in [App]" button for app-origin cards
