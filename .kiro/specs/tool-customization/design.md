# Design Document

## Overview

Tool Customization adds two capabilities to Mental Health Wallet: (1) a new "media" control type with two variants (display and upload) supporting image, video, and audio, and (2) a background customization system with overlay persistence for Library/Community cards and an optional AI image generation feature.

The implementation extends the existing Control system (new `ControlType` values and configs), adds a new database table for background overlays, introduces a media service for file management, and adds a background customization service with optional AI generation.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Presentation Layer                      │
├─────────────────────────────────────────────────────────┤
│  DisplayMediaControl     UploadMediaControl               │
│  PlatformEmbed (YT/Spotify/Vimeo/SC)                     │
│  AudioPlayer / VideoPlayer                                │
│  BackgroundCustomizerSheet                                │
│  AIPromptInput + AIPreview                                │
├─────────────────────────────────────────────────────────┤
│                     State Layer                           │
├─────────────────────────────────────────────────────────┤
│  WalletStore (extended: overlay resolution)               │
│  CompletionStore (extended: media upload values)          │
├─────────────────────────────────────────────────────────┤
│                    Service Layer                          │
├─────────────────────────────────────────────────────────┤
│  MediaService          BackgroundOverlayService           │
│  (download, cache,     (CRUD overlays, resolve            │
│   validate, cleanup)    backgrounds on load)              │
│                                                           │
│  AIImageService (Req 7 — separate implementation)         │
├─────────────────────────────────────────────────────────┤
│                     Data Layer                            │
├─────────────────────────────────────────────────────────┤
│  SQLite: controls (media configs), background_overlays    │
│  FileSystem: media cache dir, uploaded media dir          │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### New Types

```typescript
// --- New Control Type Extension ---

// Add to ControlType union:
// | 'display_media'
// | 'upload_media'

type MediaSourceType = 'local_file' | 'direct_url' | 'platform_url';
type MediaFileType = 'image' | 'video' | 'audio';
type PlatformType = 'youtube' | 'vimeo' | 'soundcloud' | 'spotify' | 'unknown';

interface DisplayMediaConfig {
  label: string;
  mediaSourceType: MediaSourceType;
  mediaFileType: MediaFileType;
  /** For local_file: relative path in app file system. For URLs: the URL string. */
  source: string;
  /** Recognized platform (null for local files and direct URLs) */
  platform: PlatformType | null;
  /** Local cache path after download (populated at runtime for direct_url sources) */
  cachedPath: string | null;
}

interface UploadMediaConfig {
  label: string;
  /** Accepted media types (creator can restrict, e.g., only audio) */
  acceptedTypes: MediaFileType[];
}

// --- Background Overlay ---

interface BackgroundOverlay {
  id: string;
  cardId: string;
  backgroundType: BackgroundType; // 'color' | 'gradient' | 'image'
  backgroundValue: string;
  createdAt: string;
  updatedAt: string;
}

// --- AI Image Generation (Requirement 7 — future) ---

interface AIImageRequest {
  prompt: string;
  width: number;
  height: number;
}

interface AIImageResult {
  imageUrl: string;
  localPath: string;
  flagged: boolean;
}
```

### Media Service

```typescript
interface MediaService {
  /** Validate a local file: check format, size limits */
  validateFile(uri: string, fileType: MediaFileType): Promise<ValidationResult>;

  /** Validate a URL: check HTTPS, classify as direct/platform */
  validateUrl(url: string): { isValid: boolean; sourceType: MediaSourceType; platform: PlatformType | null; fileType: MediaFileType | null };

  /** Download and cache a direct file URL. Returns local path. */
  downloadAndCache(url: string, cardId: string, controlId: string): Promise<string>;

  /** Copy a locally picked/captured file to the app's media directory */
  storeLocalFile(uri: string, cardId: string, controlId: string): Promise<string>;

  /** Store a user-uploaded media file for a completion */
  storeCompletionMedia(uri: string, completionId: string, controlId: string): Promise<string>;

  /** Delete cached media for a card/control (cleanup on card delete) */
  deleteMediaForCard(cardId: string): Promise<void>;

  /** Get file size in bytes for validation */
  getFileSize(uri: string): Promise<number>;

  /** Generate a thumbnail for an image or video */
  generateThumbnail(uri: string, fileType: MediaFileType): Promise<string>;
}
```

### Background Overlay Service

```typescript
interface BackgroundOverlayService {
  /** Get the overlay for a card, or null if none exists */
  getOverlay(cardId: string): Promise<BackgroundOverlay | null>;

  /** Get all overlays (for batch loading on app start) */
  getAllOverlays(): Promise<BackgroundOverlay[]>;

  /** Create or update an overlay for a card */
  upsertOverlay(cardId: string, backgroundType: BackgroundType, backgroundValue: string): Promise<BackgroundOverlay>;

  /** Remove an overlay (reset to original) */
  removeOverlay(cardId: string): Promise<void>;

  /** Copy overlay to a new card (used during duplication) */
  copyOverlayToCard(sourceCardId: string, targetCardId: string): Promise<void>;
}
```

### AI Image Service (Requirement 7 — implemented separately)

```typescript
interface AIImageService {
  /** Generate an image from a text prompt. Applies system context. */
  generate(request: AIImageRequest): Promise<AIImageResult>;

  /** Cancel an in-progress generation */
  cancel(): void;

  /** Check if the service is available/configured */
  isAvailable(): boolean;
}
```

### UI Components

#### Media Controls

| Component | Location | Purpose |
|-----------|----------|---------|
| `DisplayMediaControl.tsx` | `src/components/controls/` | Renders embedded media (image/video/audio) or platform embed |
| `UploadMediaControl.tsx` | `src/components/controls/` | Renders media upload input with picker |
| `AudioPlayer.tsx` | `src/components/media/` | Reusable audio player with play/pause/seek/volume |
| `VideoPlayer.tsx` | `src/components/media/` | Reusable video player with native controls |
| `PlatformEmbed.tsx` | `src/components/media/` | WebView-based embed for YouTube/Vimeo/SoundCloud/Spotify |
| `MediaPickerSheet.tsx` | `src/components/media/` | Bottom sheet with capture/upload options |
| `MediaConfigEditor.tsx` | `src/components/creator/` | Creator-side config UI for media controls |

#### Background Customization

| Component | Location | Purpose |
|-----------|----------|---------|
| `BackgroundCustomizerSheet.tsx` | `src/components/wallet/` | Bottom sheet with color/image/AI options |
| `AIPromptInput.tsx` | `src/components/wallet/` | Text input + generate button for AI backgrounds (Req 7) |
| `AIPreview.tsx` | `src/components/wallet/` | Preview + confirm/retry for AI-generated images (Req 7) |

### Platform Detection Logic

```typescript
const PLATFORM_PATTERNS: Record<PlatformType, RegExp> = {
  youtube: /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//,
  vimeo: /^https?:\/\/(www\.)?vimeo\.com\//,
  soundcloud: /^https?:\/\/(www\.)?soundcloud\.com\//,
  spotify: /^https?:\/\/(open\.)?spotify\.com\//,
  unknown: /^$/,  // never matches — used as fallback
};

const DIRECT_FILE_EXTENSIONS = /\.(mp4|mov|mp3|m4a|wav|jpg|jpeg|png|gif|webp)(\?.*)?$/i;

function classifyUrl(url: string): { sourceType: MediaSourceType; platform: PlatformType | null } {
  if (DIRECT_FILE_EXTENSIONS.test(url)) {
    return { sourceType: 'direct_url', platform: null };
  }
  for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
    if (pattern.test(url)) {
      return { sourceType: 'platform_url', platform: platform as PlatformType };
    }
  }
  return { sourceType: 'platform_url', platform: 'unknown' };
}
```

### Platform Embed Strategy

| Platform | Embed Approach | Offline Behavior |
|----------|---------------|-----------------|
| YouTube | WebView with `youtube.com/embed/{id}` | "Network required" message |
| Vimeo | WebView with `player.vimeo.com/video/{id}` | "Network required" message |
| SoundCloud | WebView with oEmbed widget URL | "Network required" message |
| Spotify | WebView with `open.spotify.com/embed/track/{id}` + "Open in Spotify" deep link button | "Network required" + "Open in Spotify" button (disabled) |
| Unknown platform | WebView loading the URL directly | "Network required" message |

### File Size Limits

| Media Type | Max Size | Applies To |
|------------|----------|-----------|
| Image | 20 MB | Local upload, direct URL download |
| Audio | 20 MB | Local upload, direct URL download |
| Video | 50 MB | Local upload, direct URL download |
| Background Image | 10 MB | Background customization (min 750×500px) |

### Integration with Existing Card Loading

The `CardService.getAll()` and `getById()` queries are extended to LEFT JOIN `background_overlays`:

```typescript
// In card loading query, add:
// LEFT JOIN background_overlays bo ON bo.card_id = c.id

// In card assembly, apply overlay:
function resolveBackground(card: Card, overlay: BackgroundOverlay | null): Card {
  if (!overlay) return card;
  return {
    ...card,
    backgroundType: overlay.backgroundType,
    backgroundValue: overlay.backgroundValue,
  };
}
```

The original `backgroundType`/`backgroundValue` are preserved in the `cards` table — only the rendered Card object gets the overlay applied.

### Kebab Menu Integration

```typescript
// In KebabMenu.tsx, add for Library/Community cards:
if (card.allowBackgroundCustomization && card.originBadge !== 'my_tool') {
  menuItems.push({ label: 'Customize background', action: 'customize_background' });
}

// For "My tool" cards, background editing is already in the card edit flow
```

## Data Models

### Database Migrations

```sql
-- Migration: Add background_overlays table
CREATE TABLE background_overlays (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  background_type TEXT NOT NULL CHECK(background_type IN ('color', 'gradient', 'image')),
  background_value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(card_id)
);

CREATE INDEX idx_background_overlays_card ON background_overlays(card_id);

-- Migration: Add allow_background_customization to cards
ALTER TABLE cards ADD COLUMN allow_background_customization INTEGER NOT NULL DEFAULT 0;
```

### File System Layout

```
{app_documents}/
├── media/
│   ├── display/            # Creator-embedded media (display_media controls)
│   │   └── {cardId}/
│   │       └── {controlId}.{ext}
│   ├── cache/              # Downloaded direct URL files
│   │   └── {cardId}/
│   │       └── {controlId}.{ext}
│   ├── uploads/            # User completion uploads (upload_media controls)
│   │   └── {completionId}/
│   │       └── {controlId}.{ext}
│   └── thumbnails/         # Generated thumbnails
│       └── {hash}.jpg
├── backgrounds/            # Custom background images
│   ├── cards/              # "My tool" card backgrounds
│   │   └── {cardId}.{ext}
│   └── overlays/           # Library/Community card overlay images
│       └── {cardId}.{ext}
```

### Control Config Storage

Media control configs are stored as JSON in the existing `controls.config` column:

```json
// display_media example (local file):
{
  "label": "Guided Meditation",
  "mediaSourceType": "local_file",
  "mediaFileType": "audio",
  "source": "media/display/abc123/ctrl456.mp3",
  "platform": null,
  "cachedPath": null
}

// display_media example (platform URL):
{
  "label": "Calming Video",
  "mediaSourceType": "platform_url",
  "mediaFileType": "video",
  "source": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "platform": "youtube",
  "cachedPath": null
}

// upload_media example:
{
  "label": "Record how you feel",
  "acceptedTypes": ["audio", "video"]
}
```

## Correctness Properties

### Property 1: Overlay Isolation

For any card with origin_badge "library" or "community", creating, updating, or deleting a Background_Overlay SHALL NOT modify any field in the `cards` table row.

### Property 2: Media Size Enforcement

For any file presented to the MediaService, validation SHALL reject files exceeding type-specific limits (image: 20MB, audio: 20MB, video: 50MB) and accept all files at or below the limit.

### Property 3: URL Classification Determinism

For any HTTPS URL string, `classifyUrl` SHALL always return the same `sourceType` and `platform` classification.

### Property 4: Overlay Persistence Through Archive/Restore

For any card with an overlay, archiving and then restoring the card SHALL result in the same overlay being applied.

## Error Handling

| Scenario | Strategy |
|----------|----------|
| Media file too large | Inline error with size limit for that type; prevent save |
| Direct URL download fails | Retry once; show error with option to remove media or retry |
| Platform embed fails to load | Show "Network required" message with retry |
| Spotify/YouTube unavailable | Show platform icon + "Open in [App]" button as fallback |
| Background image too small (<750×500) | Inline error with resolution requirement |
| AI generation fails (Req 7) | Error message + retry or choose different option |
| AI generation timeout (Req 7) | Timeout message after 30s + retry option |
| Audio/video playback error | Error overlay on player with retry button |
| File system full | Error toast; suggest clearing cached media in settings |

## Testing Strategy

### Unit Tests

- `classifyUrl`: test all platform patterns + direct file extensions + edge cases
- `validateFile`: test each type at exact size boundary
- `BackgroundOverlayService`: CRUD operations, isolation from card data
- `MediaService.validateUrl`: HTTPS enforcement, scheme rejection
- Badge/overlay interaction: overlay preserved through archive/restore

### Integration Tests

- Display media with local file: store → load → render
- Display media with direct URL: download → cache → offline playback
- Upload media: capture → store → retrieve in history
- Background overlay: create → card loads with overlay → reset → original restored
- Card duplication: overlay copied as direct background value

### Component Tests

- `DisplayMediaControl`: renders correct player type per mediaFileType
- `PlatformEmbed`: renders correct embed URL per platform
- `BackgroundCustomizerSheet`: shows/hides based on `allowBackgroundCustomization`
- `AudioPlayer` / `VideoPlayer`: playback controls accessible (44×44pt targets)
