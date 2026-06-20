/**
 * MediaService — Handles media file validation, URL classification,
 * downloading/caching, and local storage for media controls.
 *
 * Validates: Requirements 1.3–1.8, 2.4–2.7
 */

import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import type { MediaFileType, MediaSourceType, PlatformType, ValidationResult } from '@/types/index';

// --- Constants ---

const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_AUDIO_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const VIDEO_EXTENSIONS = ['mp4', 'mov'];
const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'wav'];
const ALL_MEDIA_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS];

const IMAGE_MIME_PREFIXES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const VIDEO_MIME_PREFIXES = ['video/mp4', 'video/quicktime'];
const AUDIO_MIME_PREFIXES = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-m4a'];

const PLATFORM_PATTERNS: Record<Exclude<PlatformType, 'unknown'>, RegExp> = {
  youtube: /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//,
  vimeo: /^https?:\/\/(www\.)?vimeo\.com\//,
  soundcloud: /^https?:\/\/(www\.)?soundcloud\.com\//,
  spotify: /^https?:\/\/(open\.)?spotify\.com\//,
};

const DIRECT_FILE_EXTENSION_REGEX = /\.(mp4|mov|mp3|m4a|wav|jpg|jpeg|png|gif|webp)(\?.*)?$/i;

// --- Directories ---

const DOC_DIR = (FileSystem as unknown as { documentDirectory: string }).documentDirectory ?? '';
const MEDIA_BASE_DIR = `${DOC_DIR}media/`;
const DISPLAY_DIR = `${MEDIA_BASE_DIR}display/`;
const CACHE_DIR = `${MEDIA_BASE_DIR}cache/`;
const UPLOADS_DIR = `${MEDIA_BASE_DIR}uploads/`;
const THUMBNAILS_DIR = `${MEDIA_BASE_DIR}thumbnails/`;

// --- URL Classification ---

export interface UrlClassification {
  isValid: boolean;
  sourceType: MediaSourceType;
  platform: PlatformType | null;
  fileType: MediaFileType | null;
  error?: string;
}

/**
 * Classifies a URL as direct file or platform, validates HTTPS.
 */
export function classifyUrl(url: string): UrlClassification {
  if (!url || url.trim().length === 0) {
    return { isValid: false, sourceType: 'direct_url', platform: null, fileType: null, error: 'URL is required' };
  }

  const trimmed = url.trim();

  if (!trimmed.startsWith('https://')) {
    return { isValid: false, sourceType: 'direct_url', platform: null, fileType: null, error: 'URL must use HTTPS' };
  }

  // Check for direct file extension
  if (DIRECT_FILE_EXTENSION_REGEX.test(trimmed)) {
    const ext = trimmed.match(/\.(\w+)(\?.*)?$/)?.[1]?.toLowerCase();
    let fileType: MediaFileType | null = null;
    if (ext && IMAGE_EXTENSIONS.includes(ext)) fileType = 'image';
    else if (ext && VIDEO_EXTENSIONS.includes(ext)) fileType = 'video';
    else if (ext && AUDIO_EXTENSIONS.includes(ext)) fileType = 'audio';

    return { isValid: true, sourceType: 'direct_url', platform: null, fileType };
  }

  // Check for recognized platform
  for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
    if (pattern.test(trimmed)) {
      // Infer file type from platform
      let fileType: MediaFileType | null = null;
      if (platform === 'youtube' || platform === 'vimeo') fileType = 'video';
      else if (platform === 'soundcloud' || platform === 'spotify') fileType = 'audio';

      return { isValid: true, sourceType: 'platform_url', platform: platform as PlatformType, fileType };
    }
  }

  // Unknown platform URL (still valid, just unrecognized)
  return { isValid: true, sourceType: 'platform_url', platform: 'unknown', fileType: null };
}

// --- File Validation ---

/**
 * Returns the maximum file size for a given media type.
 */
export function getMaxFileSize(fileType: MediaFileType): number {
  switch (fileType) {
    case 'image': return MAX_IMAGE_SIZE;
    case 'audio': return MAX_AUDIO_SIZE;
    case 'video': return MAX_VIDEO_SIZE;
  }
}

/**
 * Determines the media file type from a file extension.
 */
export function getFileTypeFromExtension(filename: string): MediaFileType | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return null;
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
  return null;
}

/**
 * Validates a local file: checks format and size.
 */
export async function validateFile(
  uri: string,
  fileType: MediaFileType
): Promise<ValidationResult> {
  const errors: { field: string; message: string }[] = [];

  // Check file exists and get info
  const fileInfo = await FileSystem.getInfoAsync(uri);
  if (!fileInfo.exists) {
    errors.push({ field: 'file', message: 'File not found' });
    return { isValid: false, errors };
  }

  // Check size
  const maxSize = getMaxFileSize(fileType);
  const size = (fileInfo as unknown as { size?: number }).size ?? 0;
  if (size > maxSize) {
    const maxMB = Math.round(maxSize / (1024 * 1024));
    errors.push({ field: 'file', message: `File exceeds maximum size of ${maxMB}MB for ${fileType}` });
  }

  // Check extension
  const ext = uri.split('.').pop()?.toLowerCase();
  let validExtensions: string[];
  switch (fileType) {
    case 'image': validExtensions = IMAGE_EXTENSIONS; break;
    case 'video': validExtensions = VIDEO_EXTENSIONS; break;
    case 'audio': validExtensions = AUDIO_EXTENSIONS; break;
  }
  if (ext && !validExtensions.includes(ext)) {
    errors.push({ field: 'file', message: `Unsupported ${fileType} format. Accepted: ${validExtensions.join(', ')}` });
  }

  return { isValid: errors.length === 0, errors };
}

// --- File Operations ---

/**
 * Ensures a directory exists.
 */
async function ensureDir(dir: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

/**
 * Downloads a direct URL and caches it locally.
 * Returns the local file path.
 */
export async function downloadAndCache(
  url: string,
  cardId: string,
  controlId: string
): Promise<string> {
  const dir = `${CACHE_DIR}${cardId}/`;
  await ensureDir(dir);

  const ext = url.match(/\.(\w+)(\?.*)?$/)?.[1]?.toLowerCase() || 'bin';
  const destPath = `${dir}${controlId}.${ext}`;

  // Check if already cached
  const existing = await FileSystem.getInfoAsync(destPath);
  if (existing.exists) {
    return destPath;
  }

  const downloadResult = await FileSystem.downloadAsync(url, destPath);
  if (downloadResult.status !== 200) {
    throw new Error(`Failed to download media: HTTP ${downloadResult.status}`);
  }

  return destPath;
}

/**
 * Copies a locally picked/captured file to the app's display media directory.
 */
export async function storeLocalFile(
  uri: string,
  cardId: string,
  controlId: string
): Promise<string> {
  const dir = `${DISPLAY_DIR}${cardId}/`;
  await ensureDir(dir);

  const ext = uri.split('.').pop()?.toLowerCase() || 'bin';
  const destPath = `${dir}${controlId}.${ext}`;

  await FileSystem.copyAsync({ from: uri, to: destPath });
  return destPath;
}

/**
 * Stores a user-uploaded media file for a completion.
 */
export async function storeCompletionMedia(
  uri: string,
  completionId: string,
  controlId: string
): Promise<string> {
  const dir = `${UPLOADS_DIR}${completionId}/`;
  await ensureDir(dir);

  const ext = uri.split('.').pop()?.toLowerCase() || 'bin';
  const destPath = `${dir}${controlId}.${ext}`;

  await FileSystem.copyAsync({ from: uri, to: destPath });
  return destPath;
}

/**
 * Deletes all media files associated with a card (display + cache).
 */
export async function deleteMediaForCard(cardId: string): Promise<void> {
  const displayDir = `${DISPLAY_DIR}${cardId}/`;
  const cacheDir = `${CACHE_DIR}${cardId}/`;

  const displayInfo = await FileSystem.getInfoAsync(displayDir);
  if (displayInfo.exists) {
    await FileSystem.deleteAsync(displayDir, { idempotent: true });
  }

  const cacheInfo = await FileSystem.getInfoAsync(cacheDir);
  if (cacheInfo.exists) {
    await FileSystem.deleteAsync(cacheDir, { idempotent: true });
  }
}

/**
 * Generates a thumbnail for an image or video file.
 * For MVP: copies the original (actual thumbnail generation requires expo-image-manipulator or expo-video-thumbnails).
 */
export async function generateMediaThumbnail(
  uri: string,
  _fileType: MediaFileType
): Promise<string> {
  await ensureDir(THUMBNAILS_DIR);

  const hash = Crypto.randomUUID().slice(0, 8);
  const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
  const destPath = `${THUMBNAILS_DIR}${hash}.${ext}`;

  await FileSystem.copyAsync({ from: uri, to: destPath });
  return destPath;
}

/**
 * Gets file size in bytes.
 */
export async function getFileSize(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) return 0;
  return (info as unknown as { size?: number }).size ?? 0;
}
