/**
 * DisplayMediaControl — Renders creator-embedded media (image, video, or audio)
 * based on the source type (local file, direct URL, or platform URL).
 *
 * Validates: Requirements 1.7–1.12, 3.1–3.4
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import type { Control, DisplayMediaConfig } from '@/types/index';
import AudioPlayer from '@/components/media/AudioPlayer';
import VideoPlayer from '@/components/media/VideoPlayer';
import PlatformEmbed from '@/components/media/PlatformEmbed';
import { downloadAndCache } from '@/services/mediaService';

interface DisplayMediaControlProps {
  control: Control;
  readOnly?: boolean;
}

export default function DisplayMediaControl({
  control,
  readOnly = false,
}: DisplayMediaControlProps) {
  const config = control.config as DisplayMediaConfig;
  const [localUri, setLocalUri] = useState<string | null>(config.cachedPath || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For direct_url sources, download and cache on first render
  useEffect(() => {
    if (config.mediaSourceType === 'direct_url' && !localUri) {
      setIsLoading(true);
      downloadAndCache(config.source, control.cardId, control.id)
        .then((path) => {
          setLocalUri(path);
          setIsLoading(false);
        })
        .catch((err) => {
          setError('Failed to load media. Tap to retry.');
          setIsLoading(false);
        });
    } else if (config.mediaSourceType === 'local_file') {
      setLocalUri(config.source);
    }
  }, [config.mediaSourceType, config.source, control.cardId, control.id, localUri]);

  const handleRetry = useCallback(() => {
    setError(null);
    setLocalUri(null);
  }, []);

  // Platform URLs — render embed
  if (config.mediaSourceType === 'platform_url' && config.platform) {
    return (
      <PlatformEmbed
        url={config.source}
        platform={config.platform}
        label={config.label}
        accessibilityLabel={`Streaming media: ${config.label}`}
      />
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        {config.label && <Text style={styles.label}>{config.label}</Text>}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading media...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        {config.label && <Text style={styles.label}>{config.label}</Text>}
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Text
            style={styles.retryLink}
            onPress={handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry loading media"
          >
            Retry
          </Text>
        </View>
      </View>
    );
  }

  // Render based on media type
  if (!localUri) return null;

  return (
    <View
      style={styles.container}
      accessibilityLabel={`${config.mediaFileType} content: ${config.label}`}
    >
      {config.label && <Text style={styles.label}>{config.label}</Text>}

      {config.mediaFileType === 'image' && (
        <Image
          source={{ uri: localUri }}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel={config.label || 'Embedded image'}
        />
      )}

      {config.mediaFileType === 'video' && (
        <VideoPlayer
          uri={localUri}
          label={config.label}
          accessibilityLabel={`Video: ${config.label}`}
        />
      )}

      {config.mediaFileType === 'audio' && (
        <AudioPlayer
          uri={localUri}
          label={config.label}
          accessibilityLabel={`Audio: ${config.label}`}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 8,
  },
  retryLink: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '500',
  },
});
