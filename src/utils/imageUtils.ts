/**
 * Image utility functions for background image processing.
 *
 * - resizeForStorage: Resizes to max 1500px width before persisting
 * - generateThumbnail: Creates a 200px width thumbnail for stack view
 *
 * Uses expo-file-system for file operations. In production, expo-image-manipulator
 * would be used for actual resizing — this module provides the interface and
 * fallback behavior for the MVP where expo-image-manipulator is not yet installed.
 *
 * Validates: Requirements 17.1
 */

import { File, Directory, Paths } from 'expo-file-system';

const MAX_STORAGE_WIDTH = 1500;
const THUMBNAIL_WIDTH = 200;

/**
 * Generates a content-addressable filename for cached images.
 */
function generateCacheFilename(uri: string, suffix: string): string {
  // Simple hash: use the last segment of the URI + suffix
  const segments = uri.split('/');
  const filename = segments[segments.length - 1] || 'image';
  const name = filename.split('.')[0];
  const ext = filename.split('.').pop() || 'jpg';
  return `${name}_${suffix}.${ext}`;
}

/**
 * Returns the app's image cache directory, creating it if needed.
 */
function getImageDir(): Directory {
  // Use the document directory (persistent), NOT cache — iOS purges the Caches
  // directory under storage pressure, which caused stored background images to
  // go blank over time.
  const dir = new Directory(Paths.document, 'images');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

/**
 * Resizes a background image to a maximum width of 1500px before storage.
 *
 * For MVP: copies the image to the cache directory with a descriptive name.
 * When expo-image-manipulator is added, this will perform actual resize.
 *
 * @param uri - Source URI of the image (from picker or file system)
 * @returns URI of the processed image in the cache directory
 */
export async function resizeForStorage(uri: string): Promise<string> {
  const dir = getImageDir();
  const filename = generateCacheFilename(uri, `w${MAX_STORAGE_WIDTH}`);
  const dest = new File(dir, filename);

  if (dest.exists) {
    return dest.uri;
  }

  // Copy to persistent storage (actual resize would happen here with expo-image-manipulator)
  new File(uri).copy(dest);
  return dest.uri;
}

/**
 * Generates a 200px width thumbnail for use in the stacked card view.
 *
 * For MVP: copies the image to the cache directory with a thumbnail suffix.
 * When expo-image-manipulator is added, this will perform actual downscale.
 *
 * @param uri - Source URI of the image (from picker or file system)
 * @returns URI of the thumbnail image in the cache directory
 */
export async function generateThumbnail(uri: string): Promise<string> {
  const dir = getImageDir();
  const filename = generateCacheFilename(uri, `thumb${THUMBNAIL_WIDTH}`);
  const dest = new File(dir, filename);

  if (dest.exists) {
    return dest.uri;
  }

  // Copy to persistent storage (actual thumbnail generation would happen here)
  new File(uri).copy(dest);
  return dest.uri;
}

/**
 * Processes a user-uploaded background image for card storage.
 * Generates both the storage-size image and a thumbnail.
 *
 * @param uri - Original image URI from the image picker
 * @returns Object containing both processed URIs
 */
export async function processBackgroundImage(uri: string): Promise<{
  storageUri: string;
  thumbnailUri: string;
}> {
  const [storageUri, thumbnailUri] = await Promise.all([
    resizeForStorage(uri),
    generateThumbnail(uri),
  ]);

  return { storageUri, thumbnailUri };
}

export { MAX_STORAGE_WIDTH, THUMBNAIL_WIDTH };
