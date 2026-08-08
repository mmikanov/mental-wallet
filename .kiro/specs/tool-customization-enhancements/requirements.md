# Tool Customization — Future Enhancements

## Introduction

This spec tracks remaining enhancements for the tool customization system. The core functionality is already implemented:

**Already implemented (not in scope here):**
- Media control type (display_media and upload_media variants)
- Display media: local files, direct URLs with download/cache, platform embeds (YouTube, Vimeo, SoundCloud, Spotify)
- Upload media: image/video/audio capture and upload during completion, stored with completion records
- Audio/video players with accessible controls
- Background customization for "My tool" cards (color picker + image upload)
- Background overlay system for Library/Community cards (non-destructive, persists through archive/restore)
- BackgroundCustomizerSheet accessible from kebab menu
- Media service (validation, download, cache, cleanup, thumbnails)
- Background overlay service (CRUD, overlay resolution on card load)
- Database migration for background_overlays table and allow_background_customization flag
- All media types validated (size limits, format checks, HTTPS enforcement)

**Future enhancements below — implement based on user feedback and product roadmap.**

## Requirements

### Requirement 1: AI-Generated Background Images

**User Story:** As a user, I want to generate a background image from a text prompt using AI, so that I can create unique, personalized card backgrounds without needing design skills or stock images.

#### Acceptance Criteria

1. THE Card_Background_Customizer SHALL offer "AI image generation" as an additional background option alongside color and image upload, for both "My tool" cards and eligible Library/Community cards.
2. WHEN a user selects AI image generation, THE system SHALL present a text prompt input field with a "Generate" button.
3. WHEN a user submits a text prompt, THE AI_Image_Generator SHALL return a generated image and display a preview before the user confirms.
4. WHEN a user confirms the AI-generated image, THE system SHALL apply the image as the card background (direct update for "My tool" cards, overlay for Library/Community cards).
5. IF generation fails, THE system SHALL display an error message and allow retry or choosing a different option.
6. THE AI_Image_Generator SHALL prepend a system context to user prompts instructing generation of calming, positive, or neutral imagery suitable for a mental health application.
7. IF the returned content is flagged as inappropriate, THE system SHALL discard it and display a message asking the user to try a different prompt.
8. THE system SHALL enforce a 30-second timeout; on timeout, display a message and allow retry.
9. WHILE generating, THE system SHALL display a progress indicator and a cancel button.
10. WHEN a user cancels, THE system SHALL abort the request and return to option selection.

### Requirement 2: Media Control Validation in Card Creator

**User Story:** As a developer, I want robust validation for media control configurations, so that invalid media controls are caught before save.

#### Acceptance Criteria

1. THE card creator SHALL validate display_media config: source must be non-empty, URL sources must be valid HTTPS URLs.
2. THE card creator SHALL validate upload_media config: acceptedTypes must be a non-empty array.
3. Media controls SHALL count toward the existing 10-control-per-card limit.

## Out of Scope (decided against for now)

- AI image generation provider selection (just pick one and ship)
- Media control drag-to-reorder (use existing control reorder system)
- Streaming media offline download (platform URLs are always online-only by design)

## Dependencies

- AI image generation requires a third-party API (e.g., DALL-E, Stability AI, or similar)
- Need to evaluate cost, quality, and content safety filtering before committing to a provider
