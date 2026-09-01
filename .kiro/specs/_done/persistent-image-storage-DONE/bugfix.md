# Bugfix Requirements Document

## Introduction

User-attached images (via the image attachment control and the upload-media control) display correctly the same day but render blank/white the next day. Confirmed on iPhone; the same class of bug affects Android.

## Bug Analysis

---

### Bug 1: Attached Images Go Blank After App Restart / Next Day

### Root Cause

When a user picks an image, `expo-image-picker` returns a temporary `asset.uri` pointing into the app's Caches/tmp sandbox area. This raw URI is stored verbatim in SQLite (`control_values.value`) and later rendered directly via `<Image source={{ uri: value }}>`.

Two failure modes make it break over time:
1. **iOS purges the Caches/tmp directory** under storage pressure, so the temp file is gone by the next day.
2. **The app container UUID can change** across app updates, so an absolute sandbox path (`/var/mobile/Containers/Data/Application/<UUID>/...`) stored today may not resolve tomorrow.

Persistence helpers that copy into the persistent `documentDirectory` exist in `mediaService.ts` (`storeCompletionMedia`, `storeLocalFile`) but are dead code — never called on the upload path. Separately, `imageUtils.ts` copies into `cacheDirectory` (also purgeable), so even that path is vulnerable.

### Current Behavior (Defect)

1.1 WHEN a user attaches an image via the image attachment control THEN the raw picker `asset.uri` (a temporary Caches/tmp path) is stored verbatim as the control value

1.2 WHEN the same image is viewed on a later day or after an app update THEN the control renders blank/white because the temporary file was purged or the absolute container path no longer resolves

1.3 WHEN a user uploads media via the upload-media control THEN the same defect applies (raw temp URI stored)

### Expected Behavior (Correct)

2.1 WHEN a user attaches or uploads an image THEN the system SHALL copy the file into the app's persistent `documentDirectory` before storing its reference

2.2 WHEN storing the image reference THEN the system SHALL store a path that survives app-container UUID changes (a path relative to `documentDirectory`, re-anchored at render time)

2.3 WHEN the image is rendered THEN the system SHALL resolve the stored reference against the CURRENT `documentDirectory` so it resolves correctly regardless of container UUID changes

2.4 WHEN a previously attached image is viewed on a later day THEN it SHALL still display correctly

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user picks an image THEN the preview SHALL CONTINUE TO appear immediately after selection

3.2 WHEN a user removes an image THEN the control SHALL CONTINUE TO clear the value

3.3 WHEN the file exceeds the size limit THEN the size-limit error SHALL CONTINUE TO show

3.4 Existing completions with already-broken absolute URIs are NOT recoverable (the underlying files are gone); the fix applies to newly attached images. Rendering SHALL degrade gracefully (blank, no crash) for legacy broken paths.

### Platform Scope

3.5 The fix SHALL apply on BOTH iOS and Android (Android also purges cache and uses transient content URIs).

### Status

**Fixed** — Added `src/utils/persistentImageStore.ts` (`persistPickedImage` copies picked files into `documentDirectory/media/attachments/` and returns a relative path; `resolveImageUri` re-anchors at render time, passing legacy/remote URIs through). Wired into `ImageAttachmentControl` and `UploadMediaControl`. Also moved `imageUtils` background image storage from `cacheDirectory` to `documentDirectory`. 12 new unit tests; existing completion/control tests still pass. Legacy already-broken URIs are unrecoverable but render blank without crashing.
