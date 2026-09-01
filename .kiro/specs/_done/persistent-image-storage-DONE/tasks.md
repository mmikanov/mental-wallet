# Tasks

## Task 1: Create persistentImageStore utility

- [x] Create `src/utils/persistentImageStore.ts` with `persistPickedImage(sourceUri)` (copies into `documentDirectory/media/attachments/`, returns a relative path) and `resolveImageUri(stored)` (re-anchors relative paths to current `documentDirectory`, passes through http/file/content/ph/absolute legacy URIs)
- [x] Write unit tests: persist returns a relative path; resolve turns relative → absolute; resolve passes through legacy/remote URIs; resolve handles empty string
- _Requirements: 2.1, 2.2, 2.3, 3.4, 3.5_

## Task 2: Fix ImageAttachmentControl

- [x] On pick, copy via `persistPickedImage(asset.uri)` and `onChange(relativePath)` (wrap in try/catch; on failure show alert, don't set value)
- [x] On render, use `resolveImageUri(value)` in the `<Image>` source
- [x] Verify preview still appears immediately, remove still clears, oversize still rejected
- _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_

## Task 3: Fix UploadMediaControl

- [x] On pick, copy via `persistPickedImage(asset.uri)` and `onChange(relativePath)` for image/video (try/catch)
- [x] On render, use `resolveImageUri(value)` for the image preview; pass resolved URI to video/audio players
- _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.5_

## Task 4: Fix imageUtils background image directory

- [x] Change `getImageCacheDir()` in `imageUtils.ts` to use `FileSystem.documentDirectory` instead of `cacheDirectory` so background images survive iOS Caches purges
- _Requirements: 2.1, 2.4_

## Task 5: Verify

- [x] `npx tsc --noEmit` — no new errors in changed files
- [x] `npm test` — new util tests pass; existing control/completion tests still pass
- [x] Manual on device: attach image → force quit → reopen → still shows (and ideally after clearing cache)
- _Requirements: all_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "3", "4"] },
    { "id": 2, "tasks": ["5"] }
  ]
}
```
