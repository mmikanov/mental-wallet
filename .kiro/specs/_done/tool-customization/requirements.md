# Requirements Document

## Introduction

Tool Customization extends the Mental Health Wallet with two capabilities: (1) a new "media" control type that tool creators can add to cards for displaying static media content or accepting user media uploads, and (2) a card background customization system that allows users to personalize the background of any card — including read-only Library and Community cards — without duplicating them.

## Glossary

- **Media_Control**: A control type with two variants ("display_media" and "upload_media") that handles image, video, and audio content within a card.
- **Display_Media_Variant**: A Media_Control variant where the creator embeds a specific media file or URL that plays/displays as static content during tool use.
- **Upload_Media_Variant**: A Media_Control variant where the user uploads or captures media (image, video, or audio) during each completion.
- **Background_Overlay**: A per-user personalization record that overrides the visual background of a Library or Community card without modifying the original card data.
- **Card_Background_Customizer**: The UI component that allows users to change a card's background via color selection, image upload, or AI image generation.
- **AI_Image_Generator**: A service that accepts a user text prompt and returns a generated background image.
- **Media_File**: An image (JPEG, PNG, GIF, WebP), video (MP4, MOV), or audio (MP3, M4A, WAV) file.
- **CardShell**: The visual wrapper of a card containing title, description, icon, and background properties.
- **Creator**: A user who builds or edits a "My tool" card using the card creation flow.

## Requirements

### Requirement 1: Media Control — Display Media Variant

**User Story:** As a tool creator, I want to embed a media file (image, video, or audio) into a card, so that users experience guided content like meditation audio, calming videos, or motivational images when using the tool.

#### Acceptance Criteria

1. THE Card_Creator SHALL offer a "media" control type in the available control list with a variant selector for "Display media" and "Upload media".
2. WHEN a Creator selects the "Display media" variant, THE Card_Creator SHALL present fields for a label and a media source (file upload or URL).
3. WHEN a Creator provides a local file as media source, THE Media_Control SHALL accept image files (JPEG, PNG, GIF, WebP), video files (MP4, MOV), and audio files (MP3, M4A, WAV).
4. WHEN a Creator provides a URL as media source, THE Media_Control SHALL classify the URL as either a "direct file URL" (ending with a supported media file extension such as .mp4, .mp3, .jpg, etc.) or a "streaming/platform URL" (recognized platforms such as YouTube, Vimeo, SoundCloud, Spotify, or any URL not ending with a supported extension).
5. THE Media_Control SHALL validate that the URL uses HTTPS protocol.
6. THE Media_Control SHALL enforce a maximum file size of 50 MB for video files, 20 MB for audio files, and 20 MB for image files (applicable to local uploads and direct file URLs only; not applicable to streaming/platform URLs).
7. WHEN a user expands a card containing a Display_Media_Variant control with a local file or direct file URL, THE Control_Renderer SHALL display the embedded image, play the embedded video with playback controls, or play the embedded audio with playback controls, according to the media type.
8. WHEN a Display_Media_Variant uses a direct file URL, THE System SHALL download the media file on first load and store it locally on-device so that subsequent playback functions without network connectivity.
9. WHEN a Display_Media_Variant uses a streaming/platform URL, THE Control_Renderer SHALL embed an in-app player or webview that streams the content directly from the URL, requiring an active network connection.
10. WHEN a Display_Media_Variant uses a Spotify URL, THE Control_Renderer SHALL render Spotify's embed widget (preview playback) and provide an "Open in Spotify" button that launches the Spotify app via deep link or falls back to the web URL.
11. WHEN a streaming/platform URL media cannot be played due to no network connectivity, THE Control_Renderer SHALL display a message indicating that network access is required and offer an option to open the URL in the system browser when connectivity is restored.
12. THE Card_Creator SHALL display a "Requires internet" indicator next to streaming/platform URLs so the creator understands the offline limitation.

### Requirement 2: Media Control — Upload Media Variant

**User Story:** As a tool creator, I want to add a media upload field to a card, so that users can capture or upload images, videos, or audio as part of completing the tool.

#### Acceptance Criteria

1. WHEN a Creator selects the "Upload media" variant, THE Card_Creator SHALL present a label/prompt configuration field.
2. WHEN a user expands a card containing an Upload_Media_Variant control, THE Control_Renderer SHALL display a media input area with the configured label.
3. WHEN a user taps the media input area, THE Media_Control SHALL present options to upload from photo/file library or capture using the device camera or microphone.
4. THE Upload_Media_Variant SHALL accept the same file formats as the Display_Media_Variant: image (JPEG, PNG, GIF, WebP), video (MP4, MOV), and audio (MP3, M4A, WAV).
5. THE Upload_Media_Variant SHALL enforce a maximum file size of 50 MB for video, 20 MB for audio, and 20 MB for image uploads.
6. IF a user selects a file that exceeds the size limit, THEN THE Media_Control SHALL display an error message stating the maximum allowed size for that media type.
7. WHEN a completion is submitted with an Upload_Media_Variant value, THE Completion_Service SHALL store the uploaded media file locally and record the file path as the control value.
8. WHEN a user views usage history for a card with Upload_Media_Variant completions, THE Usage_History_View SHALL display thumbnails for images, playback controls for video and audio entries.

### Requirement 3: Media Control — Shared Behavior

**User Story:** As a user, I want media content to display correctly and accessibly, so that I can benefit from multimedia coping tools.

#### Acceptance Criteria

1. THE Media_Control SHALL display a loading indicator while media files are being loaded or buffered.
2. IF a media file fails to load or play, THEN THE Media_Control SHALL display a descriptive error message and a retry option.
3. THE Media_Control SHALL provide accessible labels describing the media type and content for screen readers.
4. WHILE a video or audio file is playing, THE Media_Control SHALL display pause, seek, and volume controls with minimum 44×44 point tap targets.
5. THE Card_Creator SHALL enforce the existing maximum of 10 controls per card inclusive of any Media_Control instances.

### Requirement 4: Card Background Customization — My Tool Cards

**User Story:** As a user who creates custom tools, I want to change my card's background to a custom color or uploaded image, so that my cards feel personal and visually distinct.

#### Acceptance Criteria

1. WHEN a Creator edits a "My tool" card, THE Card_Background_Customizer SHALL present background options including: color selection and image upload.
2. WHEN a Creator selects color, THE Card_Background_Customizer SHALL display the existing color picker with preset colors and a custom hex input.
3. WHEN a Creator selects image upload, THE Card_Background_Customizer SHALL allow selection from the device photo library or capture via camera.
4. THE Card_Background_Customizer SHALL enforce a minimum resolution of 750×500 pixels and a maximum file size of 10 MB for uploaded background images.
5. WHEN a Creator saves a background change on a "My tool" card, THE Card_Service SHALL update the card's backgroundType and backgroundValue fields directly.

### Requirement 5: Card Background Customization — Library and Community Cards

**User Story:** As a user, I want to personalize the background of Library and Community cards without duplicating them, so that my wallet feels cohesive and personal while retaining the original card's read-only content and origin badge.

#### Acceptance Criteria

1. Library and Community cards SHALL include a `allowBackgroundCustomization` flag set by the card's creator or curator, defaulting to false.
2. WHEN a user views a Library or Community card that has `allowBackgroundCustomization` set to true, THE Card_Background_Customizer SHALL be accessible from the kebab menu as "Customize background".
3. IF a Library or Community card has `allowBackgroundCustomization` set to false, THEN THE kebab menu SHALL NOT display the "Customize background" option for that card.
4. THE Card_Background_Customizer SHALL offer the same options for eligible Library/Community cards as for "My tool" cards: color selection and image upload.
5. WHEN a user saves a background customization for a Library or Community card, THE System SHALL create or update a Background_Overlay record associated with the user and card.
6. THE Background_Overlay SHALL store the backgroundType and backgroundValue without modifying the original card record.
7. WHEN rendering a card that has an associated Background_Overlay, THE CardShell SHALL display the overlay background instead of the original card background.
8. WHILE a Background_Overlay is applied, THE card SHALL retain its original origin badge (Library or Community) and remain read-only for all other fields.
9. THE Card_Background_Customizer SHALL provide a "Reset to original" option that removes the Background_Overlay and restores the card's original background.
10. WHEN a Library or Community card is duplicated, THE Duplicate_Service SHALL copy the Background_Overlay (if present) to the new "My tool" card as a direct backgroundValue.

### Requirement 6: Background Overlay Persistence

**User Story:** As a user, I want my background customizations to persist across app sessions and survive card updates from the library, so that my personalization is durable.

#### Acceptance Criteria

1. THE System SHALL store Background_Overlay records in the local SQLite database with a schema containing card_id, backgroundType, backgroundValue, and created/updated timestamps.
2. WHEN the app loads cards, THE Card_Service SHALL join Background_Overlay records and apply them before rendering.
3. IF a Library card is updated from a remote source, THEN THE System SHALL preserve any existing Background_Overlay for that card.
4. WHEN a user archives a card that has a Background_Overlay, THE System SHALL retain the Background_Overlay record so it applies if the card is restored.

### Requirement 7: AI-Generated Background Images

**User Story:** As a user, I want to generate a background image from a text prompt using AI, so that I can create unique, personalized card backgrounds without needing design skills or stock images.

#### Acceptance Criteria

1. THE Card_Background_Customizer SHALL offer "AI image generation" as an additional background option alongside color and image upload, for both "My tool" cards and Library/Community cards.
2. WHEN a user selects AI image generation, THE Card_Background_Customizer SHALL present a text prompt input field.
3. WHEN a user submits a text prompt, THE AI_Image_Generator SHALL return a generated image and display a preview before the user confirms.
4. WHEN a user confirms the AI-generated image, THE Card_Background_Customizer SHALL apply the image as the card background (direct update for "My tool" cards, overlay for Library/Community cards).
5. IF the AI_Image_Generator fails to produce an image, THEN THE Card_Background_Customizer SHALL display an error message and allow the user to retry or choose a different background option.
6. THE AI_Image_Generator SHALL prepend a system context to user prompts instructing generation of calming, positive, or neutral imagery suitable for a mental health application.
7. IF the AI_Image_Generator returns content flagged as inappropriate, THEN THE System SHALL discard the result and display a message asking the user to try a different prompt.
8. THE AI_Image_Generator SHALL complete image generation within 30 seconds; IF generation exceeds 30 seconds, THEN THE System SHALL display a timeout message and allow retry.
9. WHILE the AI_Image_Generator is processing, THE Card_Background_Customizer SHALL display a progress indicator and a cancel button.
10. WHEN a user cancels AI generation, THE System SHALL abort the request and return the user to the background option selection.
