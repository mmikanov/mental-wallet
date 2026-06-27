# Tasks

## Overview

Implementation proceeds in layers: types/migrations → services → UI components → integration. The AI image generation (Requirement 7) is a separate track that can be implemented after the base background customization is complete.

## Task 1: Types and database migrations

- [x] 1.1 Add new control types and config interfaces
  - Add `'display_media' | 'upload_media'` to `ControlType` union in `src/types/index.ts`
  - Add `MediaSourceType`, `MediaFileType`, `PlatformType` type literals
  - Add `DisplayMediaConfig` interface (label, mediaSourceType, mediaFileType, source, platform, cachedPath)
  - Add `UploadMediaConfig` interface (label, acceptedTypes)
  - Add both to `ControlConfig` union
  - Add `BackgroundOverlay` interface (id, cardId, backgroundType, backgroundValue, createdAt, updatedAt)
  - _Requirements: 1.1, 2.1_

- [x] 1.2 Create database migration for background_overlays and card flag
  - Create `background_overlays` table (id, card_id UNIQUE, background_type, background_value, created_at, updated_at) with index on card_id
  - Add `allow_background_customization` column (INTEGER DEFAULT 0) to cards table
  - _Requirements: 5.1, 6.1_

## Task 2: Media Service

- [x] 2.1 Implement media file validation
  - Create `src/services/mediaService.ts`
  - Implement `validateFile(uri, fileType)`: check format (JPEG, PNG, GIF, WebP, MP4, MOV, MP3, M4A, WAV) and size limits (image: 20MB, audio: 20MB, video: 50MB)
  - Implement `getFileSize(uri)` using expo-file-system
  - _Requirements: 1.3, 1.6, 2.4, 2.5, 2.6_

- [x] 2.2 Implement URL validation and classification
  - Implement `validateUrl(url)`: require HTTPS, classify as direct_url (file extension match) or platform_url (YouTube, Vimeo, SoundCloud, Spotify pattern match)
  - Return sourceType, platform, and inferred fileType
  - _Requirements: 1.4, 1.5_

- [x] 2.3 Implement media download and caching
  - Implement `downloadAndCache(url, cardId, controlId)`: download direct file URL to `media/cache/{cardId}/{controlId}.{ext}`, return local path
  - Implement `storeLocalFile(uri, cardId, controlId)`: copy picked/captured file to `media/display/{cardId}/{controlId}.{ext}`
  - Implement `storeCompletionMedia(uri, completionId, controlId)`: store user upload to `media/uploads/{completionId}/{controlId}.{ext}`
  - Implement `deleteMediaForCard(cardId)`: cleanup display + cache dirs for a card
  - Implement `generateThumbnail(uri, fileType)`: create 200px thumbnail for images/video first frame
  - _Requirements: 1.8, 2.7_

## Task 3: Background Overlay Service

- [x] 3.1 Implement BackgroundOverlayService
  - Create `src/services/backgroundOverlayService.ts`
  - Implement `getOverlay(cardId)`, `getAllOverlays()`, `upsertOverlay(cardId, backgroundType, backgroundValue)`, `removeOverlay(cardId)`, `copyOverlayToCard(sourceCardId, targetCardId)`
  - _Requirements: 5.5, 5.6, 5.9, 5.10, 6.1, 6.4_

- [x] 3.2 Integrate overlay resolution into card loading
  - Extend `CardService.getAll()` and `getById()` queries to LEFT JOIN `background_overlays`
  - Apply overlay background to Card object at assembly time (original values preserved in DB)
  - Ensure overlays survive archive/restore (no cascade delete on archive)
  - _Requirements: 5.7, 6.2, 6.3, 6.4_

## Task 4: Display Media Control — Creator UI

- [x] 4.1 Implement media control config editor
  - Create `src/components/creator/MediaConfigEditor.tsx`
  - Variant selector: "Display media" / "Upload media"
  - Display media config: label input, source selector (file upload or URL), media type detection
  - Upload media config: label input, accepted types checkboxes (image/video/audio)
  - Show "Requires internet" indicator for platform URLs
  - Validate URL (HTTPS, classify source type) inline
  - Register "media" in the "Add block" control type picker (Step 2 of card creation)
  - Respect 10 controls max including media controls
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.12, 2.1, 3.5_

## Task 5: Display Media Control — Playback UI

- [x] 5.1 Implement local/direct file media renderer
  - Create `src/components/controls/DisplayMediaControl.tsx`
  - For images: render full-width image with loading indicator
  - For audio: render `AudioPlayer.tsx` (play/pause/seek/volume, 44×44pt controls)
  - For video: render `VideoPlayer.tsx` (native playback controls, 44×44pt targets)
  - On first load of direct_url source: trigger download via MediaService, update cachedPath in config
  - _Requirements: 1.7, 1.8, 3.1, 3.2, 3.3, 3.4_

- [x] 5.2 Implement platform embed renderer
  - Create `src/components/media/PlatformEmbed.tsx` using WebView
  - YouTube: embed URL `youtube.com/embed/{videoId}`
  - Vimeo: embed URL `player.vimeo.com/video/{videoId}`
  - SoundCloud: oEmbed widget URL
  - Spotify: embed URL `open.spotify.com/embed/track/{trackId}` + "Open in Spotify" deep link button
  - Unknown platform: load URL directly in WebView
  - _Requirements: 1.9, 1.10_

- [x] 5.3 Implement offline handling for streaming media
  - Detect network connectivity (NetInfo or equivalent)
  - When offline and source is platform_url: show "Network required" message with retry button
  - When connectivity restored: offer to reload or open in system browser
  - _Requirements: 1.11_

## Task 6: Upload Media Control — User UI

- [x] 6.1 Implement upload media control renderer
  - Create `src/components/controls/UploadMediaControl.tsx`
  - Display label/prompt from config
  - On tap: show `MediaPickerSheet.tsx` with options (photo library, camera, microphone for audio)
  - Filter picker to accepted types from config
  - Validate file size; show error if exceeded
  - Store selection in CompletionStore as pending value (uri reference)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 6.2 Integrate upload media into completion flow
  - On completion submit: call `MediaService.storeCompletionMedia` for each upload_media value
  - Store final file path as control value in control_values table
  - _Requirements: 2.7_

- [x] 6.3 Display uploaded media in usage history
  - Extend UsageHistoryScreen to detect upload_media control values
  - Render thumbnails for images, playback controls for video/audio entries
  - _Requirements: 2.8_

## Task 7: Shared media behavior

- [x] 7.1 Implement loading and error states
  - Add loading indicator (spinner overlay) while media is loading/buffering
  - Add error state with descriptive message and retry button
  - Add accessible labels for screen readers (media type + label)
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 7.2 Create AudioPlayer and VideoPlayer components
  - `src/components/media/AudioPlayer.tsx`: play/pause, seek bar, volume, duration display
  - `src/components/media/VideoPlayer.tsx`: native controls, fullscreen toggle
  - All interactive elements minimum 44×44pt
  - _Requirements: 3.4_

## Task 8: Background Customization — My Tool Cards

- [x] 8.1 Implement background customizer UI
  - Create `src/components/wallet/BackgroundCustomizerSheet.tsx` (bottom sheet)
  - Options: color picker (shared palette from `src/utils/cardColors.ts` with presets + hex input), image upload (photo library or camera)
  - Adaptive text contrast in color preview using `isLightBackground` utility
  - Image validation: min 750×500px, max 10MB
  - Resize uploaded image to max 1500px width before storage
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 8.2 Integrate customizer into card edit flow
  - In CardCreatorScreen Step 1, replace or enhance existing background picker with BackgroundCustomizerSheet
  - On save: update card's backgroundType and backgroundValue directly via CardService.update
  - _Requirements: 4.5_

## Task 9: Background Customization — Library/Community Cards

- [x] 9.1 Add "Customize background" kebab menu option
  - Show "Customize background" in kebab menu only when `card.allowBackgroundCustomization === true` AND `card.originBadge !== 'my_tool'`
  - Do NOT show option when flag is false
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 9.2 Implement overlay-based background save
  - Open BackgroundCustomizerSheet for Library/Community cards
  - On save: call `BackgroundOverlayService.upsertOverlay` (not CardService.update)
  - Card retains original origin badge and read-only status
  - Add "Reset to original" option that calls `removeOverlay`
  - _Requirements: 5.4, 5.5, 5.6, 5.8, 5.9_

- [x] 9.3 Handle overlay during card duplication
  - Extend CardService.duplicate: check for overlay, copy as direct backgroundValue on new "My tool" card
  - _Requirements: 5.10_

## Task 10: AI-Generated Background Images (Requirement 7 — separate track)

- [ ] 10.1 Implement AI Image Service
  - Create `src/services/aiImageService.ts` implementing generate(), cancel(), isAvailable()
  - Prepend system context prompt for calming/positive imagery
  - 30-second timeout with AbortController
  - Content flagging check on response
  - _Requirements: 7.3, 7.6, 7.7, 7.8_

- [ ] 10.2 Implement AI prompt and preview UI
  - Create `src/components/wallet/AIPromptInput.tsx` (text input + generate button)
  - Create `src/components/wallet/AIPreview.tsx` (image preview + confirm/retry/cancel)
  - Progress indicator during generation
  - Cancel button aborts request
  - _Requirements: 7.2, 7.3, 7.5, 7.9, 7.10_

- [ ] 10.3 Integrate AI option into BackgroundCustomizerSheet
  - Add "AI image generation" as third option in BackgroundCustomizerSheet
  - On confirm: apply as direct backgroundValue (My tool) or overlay (Library/Community)
  - Show error + retry on failure; discard flagged content with user message
  - _Requirements: 7.1, 7.4, 7.5, 7.7_

## Task 11: Validation updates

- [ ] 11.1 Extend validateControls for media types
  - In `cardService.ts` `validateControls`: validate display_media config (source non-empty, valid URL if URL type)
  - Validate upload_media config (acceptedTypes non-empty)
  - Media controls count toward 10-control limit
  - _Requirements: 1.5, 3.5_

## Notes

- Tasks 1–9 implement Requirements 1–6 (core media + background customization)
- Task 10 implements Requirement 7 (AI generation) and can be done later
- The existing `image_attachment` control remains unchanged — it handles JPEG/PNG capture at completion time only
- expo-av or react-native-video may be needed for video/audio playback (evaluate during Task 7.2)
- WebView package (react-native-webview) needed for platform embeds (Task 5.2)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3.1"] },
    { "id": 2, "tasks": ["2.3", "3.2", "11.1"] },
    { "id": 3, "tasks": ["4.1", "7.2"] },
    { "id": 4, "tasks": ["5.1", "5.2", "6.1", "7.1"] },
    { "id": 5, "tasks": ["5.3", "6.2", "6.3"] },
    { "id": 6, "tasks": ["8.1"] },
    { "id": 7, "tasks": ["8.2", "9.1"] },
    { "id": 8, "tasks": ["9.2", "9.3"] },
    { "id": 9, "tasks": ["10.1"] },
    { "id": 10, "tasks": ["10.2"] },
    { "id": 11, "tasks": ["10.3"] }
  ]
}
```
