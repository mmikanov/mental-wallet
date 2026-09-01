/**
 * persistentImageStore — Copies picked images into persistent storage and
 * resolves stored references back to absolute URIs at render time.
 *
 * WHY: expo-image-picker returns a temporary URI in the app's Caches/tmp area
 * (e.g. cache/ImagePicker/...). iOS purges that directory under storage pressure,
 * and the app container UUID can change across app updates — so a raw picker URI
 * stored today may render blank tomorrow. We copy the file into the persistent
 * document directory and store a RELATIVE path, re-anchored to the current
 * document directory when rendering.
 *
 * Uses the SDK 54 modern expo-file-system API (File/Directory/Paths). The legacy
 * FileSystem.copyAsync/documentDirectory API throws at runtime in SDK 54.
 *
 * Validates: persistent-image-storage bugfix (Req 2.1–2.4, 3.4, 3.5)
 */

import { File, Directory, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';

const ATTACHMENTS_DIR_NAME = 'media';
const ATTACHMENTS_SUBDIR_NAME = 'attachments';
/** Relative-path prefix stored in SQLite (POSIX-style, no leading slash). */
const RELATIVE_PREFIX = `${ATTACHMENTS_DIR_NAME}/${ATTACHMENTS_SUBDIR_NAME}/`;

/**
 * Copies a picked image/media file into persistent storage and returns a path
 * RELATIVE to the document directory (e.g. "media/attachments/<uuid>.jpg")
 * suitable for storing in SQLite. Re-anchor with resolveImageUri() at render time.
 */
export async function persistPickedImage(sourceUri: string): Promise<string> {
  // Ensure the persistent attachments directory exists.
  const dir = new Directory(Paths.document, ATTACHMENTS_DIR_NAME, ATTACHMENTS_SUBDIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }

  // Derive a safe extension.
  const rawExt = (sourceUri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
  const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : 'jpg';
  const filename = `${Crypto.randomUUID()}.${ext}`;

  // Copy the source file into the persistent directory.
  const source = new File(sourceUri);
  const dest = new File(dir, filename);
  source.copy(dest);

  return `${RELATIVE_PREFIX}${filename}`;
}

/**
 * Resolves a stored image reference to an absolute URI for rendering.
 * - Relative paths (our new format) are re-anchored to the current document dir.
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
    // Legacy absolute sandbox path — best effort, return as-is.
    return stored;
  }
  // Relative path → re-anchor to the current document directory.
  const file = new File(Paths.document, stored);
  return file.uri;
}
