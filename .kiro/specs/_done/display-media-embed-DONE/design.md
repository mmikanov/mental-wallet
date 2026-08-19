# Design Document

## Overview

This design completes the original Tool Customization spec's intent for inline platform media playback (Req 1.9–1.11) and documents the bugfixes already applied to the external-open fallback path.

The core change is replacing the static placeholder in `PlatformEmbed.tsx` with an actual `react-native-webview` WebView that loads platform-specific embed URLs, while keeping the "Open in {DisplayName}" button as a secondary action. The component remains fully generic — it works with any HTTPS URL, deriving embed URLs for known platforms and loading unknown URLs directly.

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    PlatformEmbed Component                       │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  State: 'loading' | 'ready' | 'error'                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  WebView (embed URL)                                     │   │
│  │  - YouTube: youtube.com/embed/{id}                       │   │
│  │  - Spotify: open.spotify.com/embed/{type}/{id}           │   │
│  │  - Vimeo: player.vimeo.com/video/{id}                   │   │
│  │  - SoundCloud: w.soundcloud.com/player/?url=...          │   │
│  │  - Unknown: original URL loaded directly                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  "Open in {DisplayName}" Button (always visible)         │   │
│  │  → deep link attempt → fallback to Linking.openURL       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Fallback states:                                                │
│  - Loading: spinner overlay on WebView area                     │
│  - Error: tappable placeholder + "Open in {DisplayName}"        │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Modified: `PlatformEmbed.tsx`

The component transitions from a static placeholder to a stateful WebView embed with fallback behavior.

```typescript
interface PlatformEmbedProps {
  url: string;
  platform: PlatformType;
  label?: string;
  accessibilityLabel?: string;
}

// Internal state
type EmbedState = 'loading' | 'ready' | 'error';
```

**Render logic by state:**
- `loading` — WebView renders (hidden via opacity 0) + ActivityIndicator overlay with platform icon
- `ready` — WebView visible at full opacity, preview limitation note (if Spotify/SoundCloud), "Open in {DisplayName}" button below
- `error` — Fallback placeholder (platform icon + display name + "No connection or content unavailable" + "Tap to open"), tappable to open externally. Handles all failure modes uniformly (network, X-Frame-Options, HTTP errors).

### New Helper: `getEmbedUrl(url, platform)`

Reintroduced from the original design (was removed when the placeholder approach was taken). Converts a standard platform URL into its embeddable equivalent.

```typescript
function getEmbedUrl(url: string, platform: PlatformType): string {
  switch (platform) {
    case 'youtube': {
      const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
      return match ? `https://www.youtube.com/embed/${match[1]}` : url;
    }
    case 'vimeo': {
      const match = url.match(/vimeo\.com\/(\d+)/);
      return match ? `https://player.vimeo.com/video/${match[1]}` : url;
    }
    case 'soundcloud':
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=false`;
    case 'spotify': {
      const match = url.match(/spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/);
      return match ? `https://open.spotify.com/embed/${match[1]}/${match[2]}` : url;
    }
    default:
      return url; // Unknown platforms: try loading the original URL
  }
}
```

### Existing Helpers (retained from current implementation)

- `getDisplayName(url, platform)` — derives human-readable name from URL hostname
- `getDeepLink(url, platform)` — constructs native app deep links for known platforms
- `getButtonColor(platform)` — brand-colored button backgrounds
- `getIcon(platform)` — emoji icon per platform type

### WebView Configuration

```typescript
<WebView
  source={{ uri: embedUrl }}
  style={webViewStyle}  // conditional based on platform aspect ratio
  allowsInlineMediaPlayback={true}
  mediaPlaybackRequiresUserAction={false}
  javaScriptEnabled={true}
  onLoad={() => setEmbedState('ready')}
  onError={() => setEmbedState('error')}
  onHttpError={() => setEmbedState('error')}
  // Prevent navigation away from the embed
  onShouldStartLoadWithRequest={(request) => {
    // Allow the initial embed URL and same-origin requests
    // Block navigation to external pages (open them externally instead)
    if (request.url === embedUrl || request.url.startsWith(embedOrigin)) {
      return true;
    }
    void Linking.openURL(request.url);
    return false;
  }}
/>
```

### Aspect Ratio Strategy

```typescript
function getAspectRatio(platform: PlatformType): number | undefined {
  switch (platform) {
    case 'youtube':
    case 'vimeo':
      return 16 / 9;  // Standard video embed
    case 'spotify':
    case 'soundcloud':
      return undefined;  // Use fixed height instead
    default:
      return 16 / 9;  // Default to video-like for unknown
  }
}

function getFixedHeight(platform: PlatformType): number | undefined {
  switch (platform) {
    case 'spotify':
      return 80;   // Compact Spotify embed widget
    case 'soundcloud':
      return 166;  // SoundCloud mini player height
    default:
      return undefined;
  }
}
```

### Network Detection

The WebView's `onError` callback handles all network and load failures. There is no separate "offline" detection or `@react-native-community/netinfo` dependency. When the WebView fails to load for any reason (no network, content blocked, timeout), the component transitions to the `'error'` state and shows the tappable fallback placeholder.

This keeps the implementation simple and avoids false positives from proactive connectivity checks.

## Data Flow

```
URL input (creator) 
  → classifyUrl() → { sourceType: 'platform_url', platform, fileType }
  → Stored in DisplayMediaConfig on the control

Card expanded (user)
  → DisplayMediaControl routes to PlatformEmbed
  → PlatformEmbed computes embedUrl via getEmbedUrl(url, platform)
  → WebView loads embedUrl
  → On success: shows inline player + "Open in {DisplayName}" button
  → On error: shows tappable fallback placeholder
  → "Open in {DisplayName}": deep link → fallback Linking.openURL
```

## Dependencies

### New dependency: `react-native-webview`

```bash
npx expo install react-native-webview
```

This is an Expo-compatible package that works in the managed workflow. No plugin entry in `app.json` is required for Expo SDK 54+ — it auto-links.

### No new dependency for NetInfo

As noted above, we avoid `@react-native-community/netinfo` and rely on WebView load errors for offline detection.

## Changes Summary

| File | Change |
|------|--------|
| `package.json` | Add `react-native-webview` dependency |
| `app.json` | Already updated: `LSApplicationQueriesSchemes` includes platform schemes |
| `src/components/media/PlatformEmbed.tsx` | Rewrite: WebView embed with loading/error/ready states, preview limitation notes for Spotify/SoundCloud, retain "Open in {DisplayName}" button |
| `src/components/creator/MediaConfigEditor.tsx` | Update informational text to "Plays inline — requires internet" (currently interim: "Streams from the internet") |

## Edge Cases

1. **Spotify free-tier limitations** — Spotify embeds only play 30-second previews regardless of the user's subscription (embeds can't authenticate). A disclosure note ("30-second preview — open Spotify for full track") is shown below the embed widget per Requirement 7.
2. **SoundCloud Go tracks** — Licensed "Go" tracks are preview-only in embeds. A note ("Some tracks are preview-only — open SoundCloud for full playback") is shown per Requirement 7. Free/creator-uploaded tracks play in full.
2. **YouTube age-restricted content** — Embed will show YouTube's age gate. User can tap "Open in YouTube" to sign in.
3. **Blocked embeds** — Some videos disable embedding. WebView `onError` or `onHttpError` fires → fallback placeholder shown.
4. **Unknown platform that blocks iframes** — Many sites set `X-Frame-Options: DENY`. The WebView will fail to load → fallback placeholder with "Open in {DisplayName}" is the experience.
5. **Audio continues after card collapse** — When the user collapses the card, the WebView unmounts (React's component lifecycle handles this), stopping playback automatically.

## Security Considerations

- WebView is sandboxed to the embed URL origin
- External navigation from within the WebView is intercepted and opened via `Linking.openURL` rather than allowing in-WebView navigation
- No JavaScript injection or `postMessage` bridges are needed
- Only HTTPS URLs are accepted (enforced at `classifyUrl` level)
