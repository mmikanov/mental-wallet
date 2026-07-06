/**
 * ThirdPartyIcon — Renders a third-party brand logo from a URI with graceful
 * fallback to an emoji icon on load failure or timeout.
 *
 * Downloads the image once and caches it locally using expo-file-system.
 * Subsequent renders use the cached local file — no network requests.
 *
 * Validates: Requirements 4.1, 4.5
 */

import React, { useEffect, useRef, useState } from 'react';
import { Image, Text, StyleSheet } from 'react-native';
import { File, Directory, Paths } from 'expo-file-system';

export interface ThirdPartyIconProps {
  uri: string;
  fallbackEmoji: string;
  size: number;
  timeoutMs?: number; // default 10000
}

const DEFAULT_TIMEOUT_MS = 10000;

/** Cache directory for downloaded icons */
const ICON_CACHE_DIR = new Directory(Paths.cache, 'icon-cache');

/** In-memory map of URI → local file URI (avoids re-checking filesystem) */
const resolvedCache = new Map<string, string>();

/**
 * Get a stable filename for a URI by hashing it.
 */
function getCacheFileName(uri: string): string {
  let hash = 0;
  for (let i = 0; i < uri.length; i++) {
    const char = uri.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const positiveHash = Math.abs(hash).toString(36);
  const extMatch = uri.match(/\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'png';
  return `${positiveHash}.${ext}`;
}

export default function ThirdPartyIcon({
  uri,
  fallbackEmoji,
  size,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ThirdPartyIconProps) {
  const [showFallback, setShowFallback] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(resolvedCache.get(uri) || null);
  const [loaded, setLoaded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Resolve the icon: check cache first, download if needed
  useEffect(() => {
    if (resolvedCache.has(uri)) {
      setLocalUri(resolvedCache.get(uri)!);
      return;
    }

    let cancelled = false;

    async function resolveIcon() {
      try {
        // Ensure cache directory exists
        if (!ICON_CACHE_DIR.exists) {
          ICON_CACHE_DIR.create({ intermediates: true });
        }

        const fileName = getCacheFileName(uri);
        const cachedFile = new File(ICON_CACHE_DIR, fileName);

        // Check if already cached on disk
        if (cachedFile.exists) {
          if (!cancelled && mountedRef.current) {
            resolvedCache.set(uri, cachedFile.uri);
            setLocalUri(cachedFile.uri);
          }
          return;
        }

        // Download and cache using the new File.downloadFileAsync API
        const targetFile = new File(ICON_CACHE_DIR, fileName);
        const downloadedFile = await File.downloadFileAsync(uri, targetFile, { idempotent: true });
        if (downloadedFile.exists) {
          if (!cancelled && mountedRef.current) {
            resolvedCache.set(uri, downloadedFile.uri);
            setLocalUri(downloadedFile.uri);
          }
        } else {
          if (!cancelled && mountedRef.current) {
            setShowFallback(true);
          }
        }
      } catch {
        if (!cancelled && mountedRef.current) {
          setShowFallback(true);
        }
      }
    }

    resolveIcon();

    return () => { cancelled = true; };
  }, [uri]);

  // Timeout fallback
  useEffect(() => {
    if (localUri || showFallback) return;

    timeoutRef.current = setTimeout(() => {
      if (!loaded && mountedRef.current) {
        setShowFallback(true);
      }
    }, timeoutMs);

    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [uri, timeoutMs, loaded, localUri, showFallback]);

  const handleLoad = () => {
    setLoaded(true);
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
  };

  const handleError = () => {
    setShowFallback(true);
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
  };

  if (showFallback) {
    return (
      <Text
        style={[styles.emoji, { fontSize: size }]}
        accessibilityLabel="Card icon"
      >
        {fallbackEmoji}
      </Text>
    );
  }

  if (!localUri) {
    return null;
  }

  return (
    <Image
      source={{ uri: localUri }}
      style={{ width: size, height: size }}
      resizeMode="contain"
      onLoad={handleLoad}
      onError={handleError}
      accessibilityLabel="Third-party brand icon"
    />
  );
}

const styles = StyleSheet.create({
  emoji: {
    textAlign: 'center',
  },
});
