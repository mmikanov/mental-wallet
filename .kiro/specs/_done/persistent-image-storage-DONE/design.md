# Design Document

## Overview

Fix attached images going blank by copying picked images into persistent storage (`documentDirectory`) and storing a **relative** path that is re-anchored to the current `documentDirectory` at render time. This survives both iOS Caches purges and app-container UUID changes.

## Root Cause Recap

| Layer | Current (broken) | Fixed |
|-------|------------------|-------|
| Pick | `onChange(asset.uri)` — raw temp URI | Copy to `documentDirectory`, store relative path |
| Persist | absolute temp path in SQLite | relative path (e.g. `media/attachments/<uuid>.jpg`) |
| Render | `<Image uri={value} />` (absolute) | `<Image uri={documentDirectory + value} />` |

## New Utility: `persistentImageStore.ts`

A small, focused helper (avoids overloading `mediaService.ts`, which is keyed by cardId/completionId not available at pick time):

```typescript
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';

const ATTACHMENTS_SUBDIR = 'media/attachments/';

/** Absolute path to the attachments directory (persistent). */
function attachmentsDir(): string {
  return `${FileSystem.documentDirectory}${ATTACHMENTS_SUBDIR}`;
}

/**
 * Copies a picked image into persistent storage and returns a RELATIVE path
 * (relative to documentDirectory) suitable for storing in SQLite.
 */
export async function persistPickedImage(sourceUri: string): Promise<string> {
  const dir = attachmentsDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  const ext = (sourceUri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
  const filename = `${Crypto.randomUUID()}.${ext}`;
  const relativePath = `${ATTACHMENTS_SUBDIR}${filename}`;
  const destUri = `${FileSystem.documentDirectory}${relativePath}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  return relativePath; // e.g. "media/attachments/ab12...jpg"
}

/**
 * Resolves a stored image reference to an absolute URI for rendering.
 * - Relative paths are re-anchored to the current documentDirectory.
 * - Legacy absolute/remote URIs (http, file://, content://, ph://) pass through
 *   unchanged so old data doesn't crash (may still be blank if the file is gone).
 */
export function resolveImageUri(stored: string): string {
  if (!stored) return stored;
  if (/^(https?:|file:|content:|ph:|assets-library:)/.test(stored)) {
    return stored;
  }
  if (stored.startsWith('/')) {
    // Legacy absolute sandbox path — return as-is (best effort)
    return stored;
  }
  return `${FileSystem.documentDirectory}${stored}`;
}
```

### Why relative, not absolute

iOS app-container UUIDs can change across app updates, invalidating absolute paths like `/var/mobile/Containers/Data/Application/<UUID>/Documents/...`. Storing a path relative to `documentDirectory` and re-anchoring at render time makes the reference stable across updates.

## Component Changes

### ImageAttachmentControl.tsx
- On pick: `const relativePath = await persistPickedImage(asset.uri); onChange(relativePath);`
- On render: `<Image source={{ uri: resolveImageUri(value) }} />`
- Wrap the copy in try/catch → on failure show an alert and don't set the value.

### UploadMediaControl.tsx
- Same treatment for the image path (`asset.uri` → persist → relative).
- For video/audio, also persist (same purge risk) — copy via the same helper (extension-agnostic) and resolve at render. Video/audio players receive the resolved absolute URI.

### imageUtils.ts (background images)
- Change `getImageCacheDir()` to use `documentDirectory` instead of `cacheDirectory` so background images also survive purges.
- This is a targeted change: `FileSystem.cacheDirectory` → `FileSystem.documentDirectory` for the images subdir. (Background overlay storage already reads these paths; since backgrounds are re-picked rarely, the main risk is the same purge bug — moving to documentDirectory fixes it. Relative-path re-anchoring for backgrounds is out of scope unless trivial.)

## Migration / Legacy Data

Already-attached images with broken absolute temp URIs cannot be recovered (files purged). `resolveImageUri` passes legacy values through unchanged so they don't crash — they'll render blank as they do now. New attachments are fixed going forward. No SQLite migration needed.

## Testing

- Unit test `persistPickedImage` (copies file, returns relative path) and `resolveImageUri` (relative → absolute; legacy passthrough for http/file/content/ph/absolute).
- Manual: attach an image, force-quit, clear app cache (or wait/simulate), reopen → image still shows.
- Regression: preview appears immediately on pick; remove clears value; oversize rejected.

## Platform Notes

- iOS: fixes Caches purge + container-UUID drift.
- Android: `documentDirectory` maps to persistent internal storage; copying off the transient `content://`/cache URI is required there too. `resolveImageUri` handles `content://` passthrough for any legacy values.
