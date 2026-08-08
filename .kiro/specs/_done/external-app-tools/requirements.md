# Requirements Document

## Introduction

External App Tools lets users discover and launch popular mental health and wellness apps directly from their Mental Health Wallet. The wallet becomes a central toolbox that includes not just native tools but also third-party apps users already rely on (Calm, Headspace, etc.) or might want to try.

Cards for external apps appear in the Library Browser with a distinct "App" origin badge and an "Apps" filter pill. When added to the wallet, they function like other cards but their primary action opens the external app (via deep link) or falls back to a web URL. Launching an external app automatically records a completion, tracking usage alongside native tools.

Some external app cards participate in affiliate programs, generating referral revenue when users subscribe through the affiliate link. Cards without affiliate programs still appear for user utility — the wallet aims to be a complete toolbox regardless of monetization.

**Apps in v1:** Headspace, Calm, Talkspace, BetterHelp, Wysa, Mindfulness.com, Insight Timer

**Rationale content policy:** All rationale text (inANutshell, howItWorks, researchSummary) must be sourced from the app's own published descriptions, research pages, or official marketing materials. We do not invent therapeutic claims for third-party tools.

## Requirements

### Requirement 1: External App Origin Type

**User Story:** As a user, I want to see which tools are external apps so I can distinguish them from native wallet tools.

#### Acceptance Criteria

1. THE App SHALL support a new origin badge value `"app"` alongside existing values (`library`, `community`, `my_tool`).
2. THE App SHALL display an "App" badge on external app cards, visually distinct from the "Library" badge (different color/icon to indicate external nature).
3. THE App SHALL show the external app's name prominently on the card (in the title or subtitle area).
4. THE App SHALL display a small external-link indicator icon on external app cards in both the library browser and wallet stack views.

### Requirement 2: External App Card Data Model

**User Story:** As a developer, I need a structured way to define external app cards with linking, affiliate, and brand identity metadata.

#### Acceptance Criteria

1. THE `CuratedCardDefinition` type SHALL be extended with an optional `externalApp` field containing: `appName` (string), `deepLinkUrl` (string, optional), `webUrl` (string, required), `appStoreId` (string, optional — iOS App Store ID), `playStoreId` (string, optional — Android package name), `affiliateNetwork` (string, optional — e.g. "CJ", "FlexOffers", "Impact"), `monogram` (string, required — 1-2 letter fallback for icon), `hasAffiliateLink` (boolean, optional — controls FTC disclosure visibility).
2. THE `OriginBadge` type SHALL be extended to include `"app"` as a valid value.
3. External app cards SHALL use the existing `link_button` control type for their primary "Open in [App]" action, with `targetUrl` set to the deep link and `fallbackUrl` set to the web URL (or affiliate URL once activated). The `link_button` config also supports an `isAffiliate` boolean flag that can be toggled via admin edit.
4. External app cards SHALL have their `iconType` set to `"third_party"` with `iconValue` pointing to the app's official logo URL (Apple CDN). Icons are also bundled locally in `assets/app-logos/` and resolved via `appLogoRegistry.ts` at render time for offline support. The `renderCardIcon` utility checks the local registry first (by `sourceId`) before falling back to the URL.
5. External app cards SHALL use a light pastel tint of the app's brand color as the card's `backgroundValue`, ensuring proper contrast with dark text and badges.
6. External app cards SHALL set `allowBackgroundCustomization` to `false` to preserve brand identity.
7. External app cards MAY include a rationale section, sourced only from the app's own published materials.

### Requirement 3: Apps Filter in Library Browser

**User Story:** As a user, I want to filter the library to see only external app tools, while still seeing them organized by their therapeutic category.

#### Acceptance Criteria

1. External app cards SHALL be assigned to one of the existing 6 categories (grounding-calming, cognitive-reframing, body-sensory, daily-checkin-journaling, self-compassion-reminders, lightweight-connection) based on their primary therapeutic use — NOT to a separate "apps" category.
2. THE App SHALL add an "Apps" filter pill in the Library Browser, displayed after the existing category pills, that acts as an orthogonal filter (filters by `originBadge === 'app'` across all categories).
3. When the "Apps" filter is selected, THE App SHALL show all external app cards grouped by their assigned category.
4. When a regular category filter is selected (e.g., "Grounding & Calming"), external app cards assigned to that category SHALL appear alongside native library cards within the same section.
5. External app cards SHALL be eligible for emotion session tool suggestions based on their `emotionTags`, `contextTags`, and `timeTags` — the same as native library cards.
6. THE App SHALL visually distinguish app cards from native cards within category sections via the "App" origin badge and external-link indicator.

### Requirement 4: Launch External App Action

**User Story:** As a user, I want to tap a button to open the external app directly, or be taken to install it if I don't have it.

#### Acceptance Criteria

1. When an external app card is focused/expanded, THE App SHALL show a prominent "Open in [App Name]" button as the primary action.
2. Tapping the button SHALL attempt to open the app's deep link URL first. Deep link schemes that work on both iOS and Android (e.g., `headspace://`) are preferred over platform-specific links.
3. IF the deep link fails (app not installed), THE App SHALL fall back to opening the platform-appropriate app store link — App Store on iOS (`https://apps.apple.com/app/id{appStoreId}`) or Play Store on Android (`https://play.google.com/store/apps/details?id={playStoreId}`).
4. IF no store IDs are available, THE App SHALL fall back to opening the affiliate URL (if present) or web URL in the system browser.
5. IF the card has an `affiliateUrl`, THE App SHALL use the affiliate URL as the final web fallback (not the plain web URL), to enable attribution tracking.
6. The full fallback chain SHALL be: deep link → app store (platform-specific) → affiliate URL → web URL.
7. THE App SHALL track each launch as an analytics event (`external_app_launched`) with properties: `card_id`, `app_name`, `launch_method` (deep_link | app_store | web_fallback | affiliate_fallback).

### Requirement 5: Automatic Completion on Launch

**User Story:** As a user, I want my wallet to automatically track when I use an external app tool so my practice stats stay accurate without extra steps.

#### Acceptance Criteria

1. When a user taps "Open in [App Name]" on an app-origin card and the external app is successfully launched (deep link or store/web fallback), THE App SHALL automatically record a completion for that card.
2. This auto-complete behavior SHALL also apply to ANY card (including user-created `my_tool` cards) that has at least one `link_button` AND no user-input controls (no text_input, text_area, mood_slider, choice_buttons, checkbox, counter, image_attachment, or upload_media). Cards with only static_text, display_media, and/or link_button controls qualify. Cards with only static_text/display_media and NO link_button still require the "Mark as done" button.
3. For qualifying cards, tapping the link button SHALL both open the URL AND record a completion in a single action — removing the need for a separate "Mark as done" step.
4. The auto-logged completion SHALL increment the card's `totalUses`, update `lastUsedAt`, and maintain streak tracking — identical to native tool completions.
5. THE App SHALL record a completion entry with `controlValues` containing the link_button's value as `"opened"`.
6. External app completions SHALL appear in the card's usage history alongside native completions.
7. External app card completions SHALL contribute to wallet-level analytics (total completions, streaks, etc.).
8. Cards that have user-input controls alongside a link_button SHALL continue to require the manual submit flow (link tap sets value to "opened", user still presses "Save entry" / "Mark as done" to record completion).
9. THE App SHALL NOT show the post-usage outcome prompt ("How do you feel?") for link-only card completions, even if the user has the prompt enabled. The user has just left the app and hasn't completed the exercise yet.

#### Future Enhancement: Return-to-App Confirmation

In a future iteration, the app may detect when the user returns from an external app (via `AppState` foreground event) and show a brief confirmation prompt ("Done with [App]? [Yes / Not yet]"). This would allow distinguishing "opened" from "completed" and make streaks more meaningful. Once return-to-app confirmation is implemented, the outcome prompt ("How do you feel?") should fire after the user confirms they completed the session — not on launch. For v1, launch = completion with no outcome prompt.

### Requirement 6: FTC Affiliate Disclosure

**User Story:** As a user, I want transparency about affiliate relationships so I can trust the app's tool recommendations.

#### Acceptance Criteria

1. When a user first views an affiliate card in a context where they can take action (CardPreviewSheet in library, or first time focusing the card in the wallet), THE App SHALL display a short inline disclosure near the "Open in [App]" or "Add to wallet" button: "Affiliate link — we may earn a commission."
2. The inline disclosure in the wallet SHALL be shown until the user has launched the external app at least once (i.e., the card has `totalUses >= 1`). After first use, the inline disclosure is no longer shown on the expanded card view.
3. The inline disclosure SHALL always remain visible in the CardPreviewSheet (library browse) since that's the discovery/decision point.
4. Affiliate cards SHALL additionally display a longer disclosure in the RationaleSheet: "[APP_NAME] may earn a commission if you subscribe through this link. This doesn't affect which tools we show you." (APP_NAME sourced from `src/config/appInfo.ts`).
5. The RationaleSheet disclosure SHALL be positioned before the "Further reading" section and remain visible regardless of usage count.
6. External app cards WITHOUT an affiliate designation SHALL NOT display any disclosure (neither inline nor in the RationaleSheet).
7. THE App SHALL NOT differentiate the visual prominence of affiliate vs non-affiliate cards in the library (all app cards look equally discoverable).
8. Affiliate status is determined by the `isAffiliate` flag on the `link_button` control config. This can be set via: (a) the static card definition in code, or (b) the admin "Affiliate link" toggle in Step 2 (Controls) which appears when editing a link_button with a non-empty fallback URL in admin mode.
9. The disclosure checks three sources (any being true triggers disclosure): `externalApp.hasAffiliateLink` on the static definition, `isAffiliate` on the DB card's link_button control, or `isAffiliate` on the static source's link_button control.

### Requirement 7: Curated External App Definitions (v1)

**User Story:** As a user, I want access to popular wellness apps I already know or want to try, displayed with their recognizable branding.

#### Acceptance Criteria

1. THE App SHALL include the following 7 external app cards at launch:
   - **Headspace** — Guided meditation, sleep, and focus exercises (background: `#FFF0E6` soft peach, category: grounding-calming)
   - **Calm** — Meditation, sleep stories, and breathing exercises (background: `#E8F0FA` soft blue, category: grounding-calming)
   - **Talkspace** — Online therapy with licensed therapists (background: `#E8F4FF` light blue, category: lightweight-connection)
   - **BetterHelp** — Online therapy and counseling (background: `#E6F4EA` soft green, category: lightweight-connection)
   - **Wysa** — AI-powered mental health chatbot (background: `#E0F7FA` soft teal, category: cognitive-reframing)
   - **Mindfulness.com** — Meditation and mindfulness library (background: `#F0EBFF` soft purple, category: grounding-calming)
   - **Insight Timer** — Free meditation timer and guided sessions (background: `#FFF4E0` soft amber, category: grounding-calming)
2. Each card SHALL include: title, description (from the app's own marketing), icon (app's official logo via HTTPS URL), brand background color, one of the existing 6 therapeutic categories, and a `link_button` control.
3. Each card SHALL use the app's official logo as the icon (`iconType: 'third_party'`, `iconValue: <HTTPS URL>`). If the logo fails to load, the fallback SHALL be a styled text badge showing the app's initial letter(s) in a consistent monogram style (e.g., "H" for Headspace, "C" for Calm) — NOT an emoji. This visually differentiates external app cards from native tools even in fallback state.
4. Each card SHALL use the app's recognizable brand color as its background, so users instantly identify which app the card represents in their wallet stack.
5. Each card's rationale text SHALL be sourced exclusively from the app's own published website, research pages, or official app store descriptions. No invented therapeutic claims.
6. Cards with active affiliate programs (Headspace, Talkspace, BetterHelp, Wysa, Mindfulness.com) SHALL include placeholder `affiliateUrl` fields to be populated with real affiliate links after network signup.
7. Cards without affiliate programs (Calm, Insight Timer) SHALL omit the `affiliateUrl` field and link directly to the app's website/deep link.

### Requirement 8: Analytics Event Tracking

**User Story:** As the app owner, I want to track engagement with external app cards to understand which affiliate links generate clicks.

#### Acceptance Criteria

1. THE App SHALL track a new analytics event `external_app_launched` with properties: `card_id` (string), `app_name` (string), `launch_method` ("deep_link" | "app_store" | "web_fallback" | "affiliate_fallback"), `has_affiliate` (boolean).
2. THE App SHALL track when an external app card is added to the wallet via the existing `tool_added` event with `origin_badge: "app"`.
3. THE App SHALL track completions of external app cards via the existing `tool_completed` event with `origin_badge: "app"`.
4. The analytics dashboard (if implemented) SHALL include external app card data in aggregate stats.

### Requirement 9: Admin Editing of External App Cards

**User Story:** As an admin (via triple-tap in the Library Browser), I want to be able to edit external app cards the same way I edit native library cards, so I can update descriptions, links, rationale, and other metadata without a code deploy.

#### Acceptance Criteria

1. External app cards SHALL appear in the admin mode library list alongside native library cards, with the same Edit/Export/Delete actions available.
2. Tapping Edit on an external app card SHALL open the CardCreatorScreen with the existing 4-step admin flow (Shell → Controls → Preview → Rationale).
3. Admin edits to external app cards SHALL create a DB override (via `createStaticOverride`) following the same pattern as native library card overrides.
4. Draft badge logic SHALL apply to external app cards — if the DB override differs from the static definition in `externalAppCards.ts`, the card shows a "Draft" badge.
5. Stale badge logic SHALL apply to external app cards — if the static source is updated after an override was saved, the card shows a "Stale" badge.
6. The admin SHALL be able to edit the `externalApp`-specific fields (deep link URL, web URL, affiliate URL, app store IDs) in addition to the standard shell, controls, and rationale fields. These fields can be exposed as part of Step 1 (Shell) or as a dedicated section within the admin flow.
7. Export functionality SHALL work for external app cards, including the `externalApp` metadata block in the exported TypeScript literal.

### Requirement 10: Duration and Insights Handling

**User Story:** As a user viewing insights, I want accurate data that doesn't include misleading duration information for external app tools.

#### Acceptance Criteria

1. External app card completions SHALL NOT generate duration records, since the app cannot measure time spent in the external app.
2. The dev mock data seeder (`devInsightsMockData.ts`) SHALL skip duration record generation for cards with `origin_badge = 'app'`.
3. Insights engine calculations that use duration weighting SHALL gracefully handle cards with no duration records (treat as frequency-only data).
4. External app cards SHALL still contribute to frequency-based insights (completion count, streaks, correlation with KPI scores).
