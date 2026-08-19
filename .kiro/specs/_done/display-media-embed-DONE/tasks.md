# Tasks

## Bugs A, B, C — Already Implemented

The following bugfixes were applied prior to this spec being written. They are documented here for traceability:

- **Bug A** (missing LSApplicationQueriesSchemes): Fixed in `app.json` — added `spotify`, `youtube`, `vimeo`, `soundcloud` to the iOS schemes array.
- **Bug B** (no "Open in {Platform}" button for non-Spotify): Fixed in `PlatformEmbed.tsx` — generalized to show "Open in {DisplayName}" for all platforms with brand-colored buttons.
- **Bug C** (false error state on app return): Fixed in `PlatformEmbed.tsx` — removed try/catch around `Linking.openURL`, use fire-and-forget `void Linking.openURL(url)`.
- **Editor warning text**: Fixed in `MediaConfigEditor.tsx` — changed from "Requires internet for playback" to interim "Streams from the internet (not stored locally)". Will be updated to "Plays inline — requires internet" when WebView playback ships (Task 3.14).
- **Bug D** (source mode not restored on edit): Fixed in `MediaConfigEditor.tsx` — `sourceMode` state now initializes from `initialConfig.mediaSourceType` instead of hardcoding `'file'`. If the saved config is `platform_url` or `direct_url`, the editor opens with "URL" selected.
- **Bug E** (URL not saved when navigating without blur): Fixed in `MediaConfigEditor.tsx` — `handleUrlChange` now calls `onConfigChange` immediately on every valid URL input, not just on blur. The parent always has the latest value regardless of whether the user tapped away from the field first.
- **Bug F** (unknown platform URL auto-opens browser on scroll/tap): Fixed in `PlatformEmbed.tsx` — `onShouldStartLoadWithRequest` now allows all navigation within the WebView for unknown platforms (since the page may redirect, load subpages, etc.). Only known embed platforms (YouTube, Spotify, etc.) intercept external navigation and open via `Linking.openURL`.

No additional tasks are needed for these bugs. The tasks below implement the new inline WebView playback feature.

---

## Task 1: Install react-native-webview dependency

- [x] Run `npx expo install react-native-webview` to add the dependency at an Expo SDK 54-compatible version
- [x] Verify the package is added to `package.json` dependencies
- [x] Verify TypeScript can resolve the `react-native-webview` module (no import errors)
- _Requirements: 4.1, 4.2_

## Task 2: Implement getEmbedUrl helper

- [x] Add `getEmbedUrl(url: string, platform: PlatformType): string` function to `PlatformEmbed.tsx`
- [x] Implement YouTube embed URL extraction: `youtube.com/embed/{videoId}` from watch, shorts, youtu.be formats
- [x] Implement Vimeo embed URL extraction: `player.vimeo.com/video/{videoId}`
- [x] Implement SoundCloud widget URL: `w.soundcloud.com/player/?url={encodedUrl}&auto_play=false`
- [x] Implement Spotify embed URL: `open.spotify.com/embed/{type}/{id}`
- [x] For `platform === 'unknown'`: return the original URL unchanged
- [x] Write unit test for `getEmbedUrl` covering all platform types and edge cases (malformed URLs, missing IDs)
- _Requirements: 3.2, 3.8_

## Task 3: Implement WebView-based inline playback in PlatformEmbed

- [x] 3.1: Add `import WebView from 'react-native-webview'` to PlatformEmbed.tsx
- [x] 3.2: Add internal state `embedState: 'loading' | 'ready' | 'error'` (default: `'loading'`)
- [x] 3.3: Compute `embedUrl` using `getEmbedUrl(url, platform)` and `embedOrigin` for navigation filtering
- [x] 3.4: Render WebView with embed URL, configured with `allowsInlineMediaPlayback`, `mediaPlaybackRequiresUserAction: false`, `javaScriptEnabled: true`
- [x] 3.5: Set `embedState` to `'ready'` on `onLoad`, to `'error'` on `onError`/`onHttpError`
- [x] 3.6: Implement `onShouldStartLoadWithRequest` to block external navigation (open via `Linking.openURL` instead)
- [x] 3.7: Use 16:9 aspect ratio for video platforms (YouTube, Vimeo, unknown), fixed height (80px for Spotify, 166px for SoundCloud) for audio platforms
- [x] 3.8: Show ActivityIndicator overlay during `'loading'` state
- [x] 3.9: On `'error'` state, show the tappable fallback placeholder (platform icon + display name + "Tap to open") that opens externally — same UX as before this feature
- [x] 3.10: Always render the "Open in {DisplayName}" button below the WebView/placeholder regardless of state
- [x] 3.11: For Spotify, render disclosure note below embed: "30-second preview — open Spotify for full track"
- [x] 3.12: For SoundCloud, render disclosure note below embed: "Some tracks are preview-only — open SoundCloud for full playback"
- [x] 3.13: Style disclosure notes as secondary text (small, muted color)
- [x] 3.14: Update MediaConfigEditor informational text from interim message to "Plays inline — requires internet" (Req 6.1)
- _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 5.1, 5.2, 5.3, 6.1, 7.1, 7.2, 7.3, 7.4_

## Task 4: Verify accessibility compliance

- [x] Ensure WebView container has `accessibilityLabel` (e.g., "YouTube video: {label}")
- [x] Ensure loading and error states are announced to assistive technology
- [x] Ensure "Open in {DisplayName}" button retains `accessibilityRole="link"` and descriptive label
- [x] Manual check: VoiceOver can navigate through the embed area and button
- _Requirements: 5.1, 5.2, 5.3_

## Task 5: Integration testing and edge cases

- [x] 5.1: Test YouTube URL → inline video plays within card
- [x] 5.2: Test Spotify URL → compact embed widget renders, "Open in Spotify" button works
- [x] 5.3: Test unknown URL (e.g., Bandcamp) → attempts WebView load, falls back to placeholder if blocked by X-Frame-Options
- [x] 5.4: Test with airplane mode → WebView onError fires → fallback placeholder shown (no crash, no false promises)
- [x] 5.5: Test card collapse while media playing → WebView unmounts → playback stops (no background audio leak)
- [x] 5.6: Test that "Open in {DisplayName}" button still works correctly (deep link → web URL fallback)
- [x] 5.7: Run `npx tsc --noEmit` — no type errors
- [x] 5.8: Run `npm test` — all existing tests pass
- _Requirements: 3.1, 3.5, 3.6, 3.7, 3.8, 2.1, 1.3_

## Design: Requirement 11 — Automatic Lazy Loading for Multiple Embeds

### Overview

When a card has 3+ platform URL Display Media controls, only the first one eager-loads its WebView. The rest show a lightweight "Tap to load" placeholder until the user explicitly taps them. This saves bandwidth and memory on cards with multiple media embeds.

### Architecture

The decision of which embeds to lazy-load is made in `ControlRenderer`, which has visibility into all controls. It counts platform URL controls, and for the 2nd+ controls (when count >= 3), passes a `lazy` prop. `DisplayMediaControl` passes this through to `PlatformEmbed`, which starts in a new `'idle'` state instead of `'loading'`.

```
ControlRenderer (knows all controls)
  → counts platform URL Display Media controls
  → if count >= 3, marks index > 0 as lazy
  → passes `lazy` prop to DisplayMediaControl

DisplayMediaControl
  → passes `lazy` prop to PlatformEmbed

PlatformEmbed
  → new state: 'idle' | 'loading' | 'ready' | 'error'
  → if lazy=true, starts in 'idle' (shows tap-to-load placeholder)
  → on user tap, transitions 'idle' → 'loading' (mounts WebView)
```

### State Machine

```
        ┌─────────┐
        │  idle   │  ← initial state when lazy=true
        └────┬────┘
             │ user taps "Tap to load"
             ▼
        ┌─────────┐
        │ loading │  ← WebView mounted, spinner shown
        └────┬────┘
           ┌─┴──┐
           │    │
     onLoad│    │onError/timeout
           ▼    ▼
      ┌───────┐ ┌───────┐
      │ ready │ │ error │
      └───────┘ └───────┘
```

### Component Changes

**`ControlRenderer.tsx`:**
- Before rendering, count controls where `type === 'display_media'` and `config.mediaSourceType === 'platform_url'`
- Track each platform URL control's index within that subset
- If total count >= 3, pass `lazy={platformUrlIndex > 0}` to `DisplayMediaControl`
- If total count < 3, pass `lazy={false}` (all eager-load as today)

**`DisplayMediaControl.tsx`:**
- Add optional `lazy?: boolean` prop
- Pass it through to `PlatformEmbed`

**`PlatformEmbed.tsx`:**
- Add optional `lazy?: boolean` prop
- Extend `EmbedState` to `'idle' | 'loading' | 'ready' | 'error'`
- If `lazy=true`, initialize state to `'idle'`
- Render idle state: same placeholder card as error state but with friendlier copy ("Tap to load" instead of "No connection or content unavailable")
- On tap of idle placeholder, transition to `'loading'` (which causes the WebView to mount)
- Only mount the WebView when state !== `'idle'`

### Idle Placeholder UI

```
┌─────────────────────────────────────┐
│           🎵 (platform icon)         │
│         "Paradise / Coldplay"        │
│           Tap to load                │
├─────────────────────────────────────┤
│       Open in SoundCloud             │
└─────────────────────────────────────┘
```

Same visual style as the error fallback, but:
- Hint text: "Tap to load" (instead of "No connection or content unavailable")
- No error-red styling
- The "Open in {DisplayName}" button is still present

---

## Task 6: Add lazy prop plumbing (ControlRenderer → DisplayMediaControl → PlatformEmbed)

- [x] 6.1: In `ControlRenderer.tsx`, before the render loop, count controls where `type === 'display_media'` and `(config as DisplayMediaConfig).mediaSourceType === 'platform_url'`
- [x] 6.2: Track each platform URL control's index within that subset as the loop iterates
- [x] 6.3: Pass `lazy={platformUrlCount >= 3 && platformUrlIndex > 0}` to `DisplayMediaControl`
- [x] 6.4: Add optional `lazy?: boolean` prop to `DisplayMediaControl` and pass it through to `PlatformEmbed`
- [x] 6.5: Add optional `lazy?: boolean` prop to `PlatformEmbed`
- _Requirements: 11.1, 11.2, 11.6_

## Task 7: Implement idle state in PlatformEmbed

- [x] 7.1: Extend `EmbedState` type to `'idle' | 'loading' | 'ready' | 'error'`
- [x] 7.2: Initialize state to `'idle'` when `lazy=true`, otherwise `'loading'` (current behavior)
- [x] 7.3: Render idle state: tappable placeholder with platform icon, label, "Tap to load" hint, and "Open in {DisplayName}" button
- [x] 7.4: On tap of idle placeholder, transition state from `'idle'` to `'loading'`
- [x] 7.5: Only mount the WebView when state is `'loading'` or `'ready'` (not `'idle'` or `'error'`)
- [x] 7.6: Style the idle placeholder similarly to error fallback but without error-red color — use neutral/muted hint text
- _Requirements: 11.3, 11.4, 11.5_

## Task 8: Verify lazy loading behavior

- [x] 8.1: Test card with 2 platform URL controls → all eager-load (no lazy behavior)
- [x] 8.2: Test card with 3+ platform URL controls → first one eager-loads, rest show "Tap to load"
- [x] 8.3: Tap a lazy placeholder → WebView mounts, loads embed, transitions to ready
- [x] 8.4: Verify "Open in {DisplayName}" button works on idle placeholder (opens externally without loading)
- [x] 8.5: Run `npx tsc --noEmit` — no type errors
- [x] 8.6: Run `npm test` — all tests pass
- _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3"] },
    { "id": 3, "tasks": ["4", "5"] },
    { "id": 4, "tasks": ["6"] },
    { "id": 5, "tasks": ["7"] },
    { "id": 6, "tasks": ["8"] }
  ]
}
```
