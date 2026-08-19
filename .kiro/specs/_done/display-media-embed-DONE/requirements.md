# Requirements Document

## Introduction

This spec addresses three bugs in the Display Media control's platform URL handling and adds inline WebView-based playback so users can consume embedded media (YouTube videos, Spotify tracks, etc.) directly within the wallet without leaving the app.

**Context:** The original Tool Customization spec (Requirement 1.9–1.11) called for in-app streaming via WebView embeds. The initial implementation shipped a placeholder UI that required users to open content externally. This spec completes that original intent while also fixing the bugs discovered in the placeholder implementation.

**Bugs (already fixed, documented here for completeness):**
- Bug A: "Open in Spotify" button failed on real iOS devices because `LSApplicationQueriesSchemes` was missing platform URL schemes
- Bug B: Non-Spotify platforms (YouTube, Vimeo, SoundCloud, unknown) had no "Open in {Platform}" button at all
- Bug C: After successfully opening a link externally and returning to the app, a false error state ("Could not open this link") was displayed because `await Linking.openURL()` was caught in a try/catch that triggered on app foregrounding

**New feature:** Inline WebView-based playback for platform URLs, with a fallback "Open externally" option.

## Glossary

- **PlatformEmbed**: The component at `src/components/media/PlatformEmbed.tsx` responsible for rendering platform URL media within a card's Display Media control.
- **Platform URL**: Any URL classified as `mediaSourceType: 'platform_url'` by `classifyUrl()` — includes YouTube, Vimeo, SoundCloud, Spotify, and any unrecognized HTTPS URL that doesn't end with a direct media file extension.
- **Embed URL**: A platform-specific URL format designed for iframe/WebView embedding (e.g., `youtube.com/embed/{id}`, `open.spotify.com/embed/track/{id}`).
- **Deep Link**: A custom URL scheme (e.g., `spotify://track/ID`) that opens the platform's native app directly.
- **Display Name**: A human-readable label for the platform, derived from the URL hostname for unknown platforms or capitalized from `PlatformType` for recognized ones.
- **Direct URL**: A URL ending with a recognized media file extension (`.mp4`, `.mp3`, `.jpg`, etc.) that is downloaded and cached locally — NOT covered by this spec.
- **LSApplicationQueriesSchemes**: An iOS Info.plist key that must list URL schemes before `Linking.canOpenURL()` will return accurate results for those schemes.

## Requirements

### Requirement 1: Generic Platform Support (Bugs A & B — already fixed)

**User Story:** As a tool creator, I want to embed any HTTPS URL (not just Spotify) as a Display Media control, and have users be able to open it regardless of the platform.

#### Acceptance Criteria

1.1 THE PlatformEmbed component SHALL display a human-readable platform name derived from the URL: capitalized `PlatformType` for recognized platforms (YouTube, Vimeo, SoundCloud, Spotify), or the capitalized first segment of the hostname for unrecognized URLs (e.g., `bandcamp.com` → "Bandcamp").

1.2 THE PlatformEmbed component SHALL render an "Open in {DisplayName}" button for ALL platform URLs, not only for Spotify.

1.3 WHEN the user taps "Open in {DisplayName}" or taps the media placeholder area, THE system SHALL attempt to open the URL via the platform's deep link (if a deep link pattern is known), and if that fails or is unavailable, SHALL fall back to `Linking.openURL(url)` which opens in the native app (via universal links) or the system browser.

1.4 THE `app.json` SHALL include `spotify`, `youtube`, `vimeo`, and `soundcloud` in `LSApplicationQueriesSchemes` so that `Linking.canOpenURL()` accurately reports whether the platform's native app is installed on iOS.

1.5 THE deep link optimization SHALL be a best-effort enhancement for known platforms only; the component SHALL function correctly for any valid HTTPS URL without requiring platform-specific deep link support.

### Requirement 2: No False Error on App Return (Bug C — already fixed)

**User Story:** As a user, I want to open a media link externally and return to the app without seeing an error message, since the link opened successfully.

#### Acceptance Criteria

2.1 WHEN the user taps to open a platform URL externally and the system browser or native app opens successfully, THEN upon returning to the app the PlatformEmbed component SHALL NOT display an error state.

2.2 THE PlatformEmbed component SHALL NOT wrap `Linking.openURL()` for HTTPS URLs in a try/catch that sets error state, because the app backgrounding during navigation can cause spurious promise rejections.

2.3 THE PlatformEmbed component SHALL use fire-and-forget (`void Linking.openURL(url)`) for the web URL fallback path.

### Requirement 3: Inline WebView Playback

**User Story:** As a user, I want to play embedded media (YouTube videos, Spotify tracks, etc.) directly within the card in my wallet, so I don't have to leave the app to consume the content.

#### Acceptance Criteria

3.1 WHEN a card containing a Display Media control with a platform URL is expanded, THE PlatformEmbed component SHALL render an inline WebView that loads the platform's embed URL, allowing the user to interact with the media (play, pause, seek) without leaving the app.

3.2 THE system SHALL convert platform URLs to their embed equivalents:
  - YouTube: `https://www.youtube.com/embed/{videoId}`
  - Vimeo: `https://player.vimeo.com/video/{videoId}`
  - SoundCloud: `https://w.soundcloud.com/player/?url={encodedUrl}&auto_play=false`
  - Spotify: `https://open.spotify.com/embed/{type}/{id}`
  - Unknown platforms: load the original URL directly in the WebView

3.3 THE WebView SHALL have a 16:9 aspect ratio for video platforms (YouTube, Vimeo) and a compact height (~80px) for audio platforms (Spotify, SoundCloud) to match their native embed widget sizes.

3.4 THE WebView SHALL be configured with:
  - `allowsInlineMediaPlayback: true` (iOS)
  - `mediaPlaybackRequiresUserAction: false` (allow autoplay of embeds when user initiates)
  - `javaScriptEnabled: true` (required for embed players)
  - No navigation outside the embed (intercept external link taps)

3.5 THE PlatformEmbed component SHALL continue to render an "Open in {DisplayName}" button below the inline WebView, so the user can choose to open the full experience in the native app or browser.

3.6 WHEN the WebView fails to load (network error, content blocked, timeout), THE PlatformEmbed component SHALL display a fallback state showing the platform icon, display name, a message ("No connection or content unavailable"), and the "Open in {DisplayName}" button — the same tappable placeholder shown today.

3.7 THE error fallback state SHALL serve as the single failure mode for all load failures (network unavailability, X-Frame-Options blocking, HTTP errors, timeouts). There is no separate "offline" state — the WebView's `onError` callback handles all cases uniformly.

3.8 FOR unknown platform URLs where no embed URL transformation is available, THE system SHALL attempt to load the original URL in the WebView. If the page renders successfully, show it inline. If it fails or displays a non-embeddable page, fall back to the tappable placeholder with "Open in {DisplayName}".

### Requirement 4: Dependency and Configuration

**User Story:** As a developer, I need the correct dependencies installed and configured for WebView-based embeds to function.

#### Acceptance Criteria

4.1 THE project SHALL include `react-native-webview` as a production dependency at a version compatible with React Native 0.81 and Expo SDK 54.

4.2 THE WebView component SHALL be imported from `react-native-webview`.

### Requirement 5: Accessibility

**User Story:** As a user with assistive technology, I want the embedded media to be accessible and understandable.

#### Acceptance Criteria

5.1 THE WebView container SHALL have an `accessibilityLabel` describing the embedded content (e.g., "YouTube video: {label}" or "Spotify track: {label}").

5.2 THE "Open in {DisplayName}" button SHALL have appropriate `accessibilityRole="link"` and descriptive `accessibilityLabel`.

5.3 WHEN the WebView is in a loading or error state, THE component SHALL convey the state to assistive technology via `accessibilityLiveRegion` or equivalent.

### Requirement 6: Editor Warning Text

**User Story:** As a tool creator, I want clear information about how platform URLs will behave when users view my tool.

#### Acceptance Criteria

6.1 WHEN a creator enters a platform URL in the Display Media control editor (Step 2), THE MediaConfigEditor SHALL display an informational note: "Plays inline — requires internet" to communicate that (a) the media will stream inside the tool and (b) it won't work offline.

6.2 THE informational note SHALL appear for all URLs classified as `platform_url` (known and unknown platforms alike).

### Requirement 7: Preview Limitation Disclosure

**User Story:** As a user, I want to know when an embedded player only plays a short preview, so I understand why the audio cuts off and know to open the full app for the complete experience.

#### Acceptance Criteria

7.1 WHEN a Spotify embed is rendered inline, THE PlatformEmbed component SHALL display a note below the embed widget: "30-second preview — open Spotify for full track".

7.2 WHEN a SoundCloud embed is rendered inline, THE PlatformEmbed component SHALL display a note below the embed widget: "Some tracks are preview-only — open SoundCloud for full playback".

7.3 THE notes SHALL be styled as secondary text (small, muted color) so they inform without being intrusive.

7.4 THE notes SHALL only appear for Spotify and SoundCloud URLs respectively — not for YouTube, Vimeo, or other platforms that support full-length embedded playback.

### Requirement 8: Source Mode Persistence on Edit (Bug D — fixed)

**User Story:** As a tool creator, when I re-open a Display Media control for editing that was previously configured with a URL, I want to see the URL tab selected and my URL visible — not the "Upload File" tab.

#### Acceptance Criteria

8.1 WHEN the MediaConfigEditor opens with an existing Display Media control whose `mediaSourceType` is `'platform_url'` or `'direct_url'`, THE editor SHALL initialize the source mode toggle to "URL" (not "Upload File").

8.2 WHEN the MediaConfigEditor opens with an existing Display Media control whose `mediaSourceType` is `'local_file'`, THE editor SHALL initialize the source mode toggle to "Upload File".

8.3 THE URL input field SHALL be pre-populated with the saved URL when the source mode initializes to "URL".

### Requirement 9: URL Value Persisted on Navigation Without Blur (Bug E — fixed)

**User Story:** As a tool creator, when I type a URL into the Display Media control and immediately tap "Next" without tapping elsewhere first, I expect the URL to be saved with the control.

#### Acceptance Criteria

9.1 WHEN the user types a valid URL into the URL input field and taps "Next" (or any navigation action) without first blurring the field, THE MediaConfigEditor SHALL have already emitted the current URL value to the parent via `onConfigChange`.

9.2 THE MediaConfigEditor SHALL emit config updates on every valid URL text change (not only on blur), so the parent always has the latest value regardless of focus state.

9.3 THE onBlur handler SHALL continue to emit config as a fallback for edge cases, but SHALL NOT be the sole mechanism for persisting URL changes.

### Requirement 10: Unknown Platform URLs Don't Auto-Open Browser (Bug F — fixed)

**User Story:** As a user viewing a card with a non-media website URL (e.g., a regular website), I want to be able to scroll through the card preview without the browser opening unexpectedly.

#### Acceptance Criteria

10.1 WHEN a Display Media control loads an unknown platform URL in the inline WebView, THE PlatformEmbed component SHALL allow all navigation within the WebView (including redirects, subpage loads, and internal link taps) without opening the system browser.

10.2 FOR known embed platforms (YouTube, Spotify, Vimeo, SoundCloud), external navigation from within the embed SHALL continue to be intercepted and opened via `Linking.openURL` (these embeds shouldn't navigate away).

10.3 THE "Open in {DisplayName}" button SHALL remain the explicit user action for opening the content in the native browser or app.

10.4 Scrolling, tapping, or interacting with WebView content for unknown platform URLs SHALL NOT trigger `Linking.openURL`.

### Requirement 11: Automatic Lazy Loading for Multiple Embeds

**User Story:** As a user with a card containing multiple media embeds, I want only the first one to load automatically so that I don't waste data and the card loads quickly — and I can tap the others to load them when I'm ready.

#### Acceptance Criteria

11.1 WHEN a card has 3 or more Display Media controls with platform URLs, THE system SHALL eager-load only the first platform URL embed (the one with the lowest position) and lazy-load the rest.

11.2 WHEN a card has fewer than 3 platform URL Display Media controls, THE system SHALL eager-load all of them (current behavior unchanged).

11.3 A lazy-loaded embed SHALL render a placeholder showing the platform icon, the control's label, and a "Tap to load" hint — visually similar to the error fallback but with friendlier copy.

11.4 WHEN the user taps a lazy-loaded placeholder, THE system SHALL mount the WebView for that embed and transition through the normal loading → ready states.

11.5 THE "Open in {DisplayName}" button SHALL still be visible on the lazy-load placeholder, so the user can open externally without loading the embed first.

11.6 THE lazy-load threshold (3+) SHALL be based on the count of platform URL controls in the card, not total controls (text, checkboxes, etc. don't count).

## Out of Scope

- Offline caching of platform content (embed players require live network by design)
- DRM-protected content playback within the app
- Custom player UI replacing platform embed widgets
- Auto-detection of embed compatibility for arbitrary unknown URLs beyond a simple WebView load attempt
- Audio ducking or background audio playback from WebView embeds
