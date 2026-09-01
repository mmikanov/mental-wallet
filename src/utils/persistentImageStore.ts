/**
 * persistentImageStore — Copies picked images into persistent storage and
 * resolves stored references back to absolute URIs at render time.
 *
 * WHY: expo-image-picker returns a temporary URI in the app's Caches/tmp area.
 * iOS purges that directory under storage pressure, and the app container UUID
 * can change across app updates — so a raw picker URI stored today may render
 * blank tomorrow. We copy the file into documentDirectory (persistent) and store
 * a RELATIVE path, re-anchored to the current documentDirectory when rendering.
 *
 * Validates: persistent-image-storage bugfix (Req 2.1–2.4, 3.4, 3.5)
 */

import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';

const ATTACHMENTS_SUBDIR = 'media/attachments/';

function documentDirectory(): string {
  return (FileSystem as unknown as { documentDirectory: string | null }).documentDirectory ?? '';
}

function attachmentsDir(): string {
  return `${documentDirectory()}${ATTACHMENTS_SUBDIR}`;
}

/**
 * Copies a picked image/media file into persistent storage and returns a path
 * RELATIVE to documentDirectory (e.g. "media/attachments/<uuid>.jpg") suitable
 * for storing in SQLite. Re-anchor with resolveImageUri() at render time.
 */
export async function persistPickedImage(sourceUri: string): Promise<string> {
  const dir = attachmentsDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }

  const rawExt = (sourceUri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
  // Guard against absurd "extensions" from query-laden or extension-less URIs
  const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : 'jpg';

  const filename = `${Crypto.randomUUID()}.${ext}`;
  const relativePath = `${ATTACHMENTS_SUBDIR}${filename}`;
  const destUri = `${documentDirectory()}${relativePath}`;

  await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  return relativePath;
}

/**
 * Resolves a stored image reference to an absolute URI for rendering.
 * - Relative paths (our new format) are re-anchored to the current documentDirectory.
 * - Legacy/remote URIs (http, file, content, ph, assets-library) and absolute
 *   sandbox paths pass through unchanged so old data never crashes (may still be
 *   blank if the underlying file was purged — unrecoverable legacy state).
 */
export function resolveImageUri(stored: string): string {
  if (!stored) return stored;
  if (/^(https?:|file:|content:|ph:|assets-library:)/.test(stored)) {
    return stored;
  }
  if (stored.startsWith('/')) {
    // Legacy absolute sandbox path — best effort, return as-is
    return stored;
  }
  return `${documentDirectory()}${stored}`;
}
