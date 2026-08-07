# Implementation Plan: External App Tools

## Overview

Adds support for third-party wellness app cards (Headspace, Calm, Talkspace, BetterHelp, Wysa, Mindfulness.com, Insight Timer) that users can discover in the library, add to their wallet, and launch via deep links. Includes affiliate tracking, auto-completion on launch, brand identity, FTC disclosure, and admin editing support.

## Tasks

- [x] 1. Type system and data model extensions
  - [x] 1.1 Add `'app'` to `OriginBadge` union and create `ExternalAppConfig` type
    - Add `'app'` to `OriginBadge` in `src/types/index.ts`
    - Create `src/types/externalApp.ts` with `ExternalAppConfig` interface (appName, deepLinkUrl?, webUrl, affiliateUrl?, appStoreId?, playStoreId?, affiliateNetwork?, monogram)
    - _Requirements: 1.1, 2.1, 2.2_

  - [x] 1.2 Extend `CuratedCardDefinition` with `externalApp` field
    - Add `externalApp?: ExternalAppConfig` to the interface in `src/data/curatedLibrary.ts`
    - Import `ExternalAppConfig` from `@/types/externalApp`
    - _Requirements: 2.1_

  - [x] 1.3 Add `external_app_launched` analytics event type
    - Add `'external_app_launched'` to `AnalyticsEventType` union in `src/types/analytics.ts`
    - Add `ExternalAppLaunchedEvent` discriminated type with properties: card_id, app_name, launch_method, has_affiliate
    - Add to `AnalyticsEvent` union
    - _Requirements: 8.1_

  - [x] 1.4 Update DB `origin_badge` constraint to allow `'app'`
    - Update application-layer validation in `src/data/migrations.ts` to include `'app'` in `VALID_ICON_TYPES` equivalent for origin badges
    - Ensure `cardService.create()` accepts `'app'` as a valid origin badge
    - _Requirements: 2.2, 12.1_

- [x] 2. Deep link service and analytics logger
  - [x] 2.1 Create `deepLinkService` with fallback chain
    - Create `src/services/deepLinkService.ts`
    - Implement `launchExternalApp(config: ExternalAppConfig): Promise<LaunchResult>`
    - Fallback chain: deep link → app store (platform-specific) → affiliate URL → web URL
    - Use `Linking.canOpenURL` + `Linking.openURL` for deep link attempt
    - Use `Platform.OS` to construct store URLs from appStoreId/playStoreId
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 2.2 Add `logExternalAppLaunched` analytics helper
    - Add helper function to `src/services/analyticsEventLogger.ts`
    - Accepts card_id, app_name, launch_method, has_affiliate
    - Queues event via existing analytics infrastructure
    - _Requirements: 8.1, 4.7_

- [x] 3. Checkpoint — Core infrastructure
  - Run `npm run typecheck` and `npm test` to verify no regressions

- [x] 4. External app card definitions
  - [x] 4.1 Create `src/data/externalAppCards.ts` with 7 card definitions
    - Define EXTERNAL_APP_CARDS array with all 7 apps
    - Each card: id (app-*), title, description, iconType 'third_party', iconValue (logo URL), brand backgroundValue, categoryId (therapeutic category), allowBackgroundCustomization: false, link_button control, externalApp config, emotionTags
    - Rationale fields as placeholders (filled in task 8.1)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 7.7_

  - [x] 4.2 Import and spread external app cards into CURATED_LIBRARY
    - Import `EXTERNAL_APP_CARDS` in `src/data/curatedLibrary.ts`
    - Spread into the `CURATED_LIBRARY` array
    - _Requirements: 7.1_

- [x] 5. Library Browser UI updates
  - [x] 5.1 Add "Apps" orthogonal filter pill
    - Add `APPS_FILTER` constant in `src/screens/LibraryBrowserScreen.tsx`
    - Render "Apps" pill after the 6 category pills (distinct color #4A90D9)
    - When selected, filter to cards where `!!card.externalApp`
    - Cards still grouped by their therapeutic category within the Apps view
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 5.2 Update badge rendering for app cards
    - Show "App" badge (instead of "Library") for cards with `externalApp` field
    - Add external-link indicator icon (↗) next to app cards
    - _Requirements: 1.2, 1.4, 3.6_

  - [x] 5.3 Update `handleAddToWallet` to pass correct origin badge
    - Use `'app'` origin badge for cards with `externalApp` field
    - Use `'app'` in the `tool_added` analytics event
    - _Requirements: 8.2_

- [x] 6. Checkpoint — Library integration
  - Verify 7 app cards appear in library, "Apps" filter works, cards display with brand colors and logos

- [x] 7. Auto-complete and FocusedCardView
  - [x] 7.1 Implement auto-complete on link tap for link-only cards
    - Add `isLinkOnlyCard(controls)` helper function
    - In `ExpandedContent`, detect link-only cards and trigger auto-completion on link button tap
    - Hide "Mark as done" button for link-only cards
    - Skip outcome prompt for link-only card completions
    - Works for ALL origins: `app`, `library`, `my_tool`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.8, 5.9_

  - [x] 7.2 Update FocusedCardView for external app cards
    - Detect `originBadge === 'app'` on focused card
    - Show "Open in [App Name]" as primary CTA (look up externalApp.appName from curated library via sourceLibraryId)
    - Tapping calls `launchExternalApp`, logs analytics, and auto-records completion
    - Do NOT show interactive controls section
    - _Requirements: 4.1, 5.1, 5.4, 8.1_

  - [x] 7.3 Update CardPreviewSheet for external app cards
    - When previewing an app card, show description and rationale entry point
    - Do NOT render controls section
    - Show "Opens in external app" note
    - "Add to wallet" button works normally
    - _Requirements: 3.4_

- [x] 8. Content, disclosure, and admin
  - [x] 8.1 Source rationale content from official materials
    - Research and populate rationale text for each of the 7 apps using only their own published materials
    - Add source attribution comments in code
    - Set learnMoreLinks to official research/about pages
    - _Requirements: 7.5_

  - [x] 8.2 Add affiliate disclosure to card surfaces and RationaleSheet
    - CardPreviewSheet: short inline disclosure always visible for affiliate cards
    - FocusedCardView: short inline disclosure when `totalUses === 0` (hidden after first use)
    - RationaleSheet: longer disclosure before "Further reading" (always visible)
    - Not shown for cards without affiliateUrl (Calm, Insight Timer)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 8.3 Admin editing support for external app cards
    - Ensure app cards appear in admin mode with Edit/Export/Delete actions
    - Add externalApp fields to admin edit flow (Step 1 Shell or dedicated section)
    - Ensure createStaticOverride, dirty/stale detection work for app- prefixed IDs
    - Include externalApp block in export output
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [x] 9. Checkpoint — Full feature verification
  - [x] 9.1 End-to-end testing
    - Run `npm run typecheck` — no errors
    - Run `npm test` — all existing tests pass
    - Manual verification: browse → preview → add → launch → auto-complete
    - Verify analytics events fire correctly
    - Verify disclosure visibility rules
    - Verify admin edit/export/delete
    - Verify user-created link-only cards also auto-complete
    - _Requirements: All_

## Implementation Notes

- External app cards use existing `link_button` control type — no new control needed
- `ThirdPartyIcon` component already handles HTTPS logo URLs with caching — extend with `fallbackMonogram` prop for styled monogram fallback
- The `externalApp` metadata lives in static definitions only — NOT duplicated in the database. Looked up at runtime via `CURATED_LIBRARY.find(c => c.id === card.sourceLibraryId)`
- Auto-complete behavior change also affects existing user-created cards that have only link/static controls — this is intentional and consistent
- `allowBackgroundCustomization: false` on all app cards preserves brand identity

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["4.1", "4.2"] },
    { "id": 3, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 4, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 5, "tasks": ["8.1", "8.2", "8.3"] },
    { "id": 6, "tasks": ["9.1"] }
  ]
}
```
