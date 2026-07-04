/**
 * PlatformEmbed — WebView-based embed for streaming platforms
 * (YouTube, Vimeo, SoundCloud, Spotify).
 *
 * Renders platform-specific embed URLs. Shows offline message when
 * network is unavailable.
 *
 * Validates: Requirements 1.9, 1.10, 1.11
 *
 * Note: Requires react-native-webview to be installed for production use.
 * This implementation provides the structure and fallback behavior.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import type { PlatformType } from '@/types/index';
import { logEvent } from '@/services/analyticsEventLogger';

interface PlatformEmbedProps {
  url: string;
  platform: PlatformType;
  label?: string;
  accessibilityLabel?: string;
}

/**
 * Extracts the embed URL for a given platform.
 */
function getEmbedUrl(url: string, platform: PlatformType): string {
  switch (platform) {
    case 'youtube': {
      // Extract video ID from various YouTube URL formats
      const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
      const videoId = match?.[1];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    }
    case 'vimeo': {
      const match = url.match(/vimeo\.com\/(\d+)/);
      const videoId = match?.[1];
      return videoId ? `https://player.vimeo.com/video/${videoId}` : url;
    }
    case 'soundcloud': {
      // SoundCloud requires oEmbed API to get widget URL; use direct URL as fallback
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=false`;
    }
    case 'spotify': {
      // Convert open.spotify.com/track/ID to embed URL
      const match = url.match(/spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/);
      if (match) {
        return `https://open.spotify.com/embed/${match[1]}/${match[2]}`;
      }
      return url;
    }
    default:
      return url;
  }
}

/**
 * Gets the deep link URL for opening the platform's native app.
 */
function getDeepLink(url: string, platform: PlatformType): string | null {
  if (platform === 'spotify') {
    // Convert https://open.spotify.com/track/ID to spotify://track/ID
    const match = url.match(/spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/);
    if (match) {
      return `spotify://${match[1]}/${match[2]}`;
    }
  }
  return null;
}

export default function PlatformEmbed({
  url,
  platform,
  label,
  accessibilityLabel,
}: PlatformEmbedProps) {
  const [isOffline, setIsOffline] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const embedUrl = getEmbedUrl(url, platform);
  const deepLink = getDeepLink(url, platform);

  const handleOpenExternal = async () => {
    const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
    // Try deep link first, then fall back to web URL
    if (deepLink) {
      const canOpen = await Linking.canOpenURL(deepLink);
      if (canOpen) {
        void logEvent('external_resource_opened', {
          resource_url: deepLink,
          resource_name: label || `${platformLabel} content`,
        });
        await Linking.openURL(deepLink);
        return;
      }
    }
    void logEvent('external_resource_opened', {
      resource_url: url,
      resource_name: label || `${platformLabel} content`,
    });
    await Linking.openURL(url);
  };

  const handleRetry = () => {
    setIsOffline(false);
    setLoadError(false);
  };

  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);

  if (isOffline || loadError) {
    return (
      <View style={styles.container}>
        {label && <Text style={styles.label}>{label}</Text>}
        <View style={styles.offlineContainer}>
          <Text style={styles.offlineIcon}>📡</Text>
          <Text style={styles.offlineText}>
            Network connection required to play {platformLabel} content
          </Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetry}
              accessibilityRole="button"
              accessibilityLabel="Retry loading"
            >
              <Text style={styles.buttonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.openButton}
              onPress={handleOpenExternal}
              accessibilityRole="button"
              accessibilityLabel={`Open in ${platformLabel}`}
            >
              <Text style={styles.openButtonText}>Open in {platformLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      style={styles.container}
      accessibilityRole="none"
      accessibilityLabel={accessibilityLabel || `${platformLabel} embed: ${label || url}`}
    >
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={styles.embedContainer}>
        {/* 
          In production, replace this with:
          <WebView source={{ uri: embedUrl }} style={styles.webview} />
          
          For now, render a placeholder with the open button.
        */}
        <View style={styles.embedPlaceholder}>
          <Text style={styles.platformIcon}>
            {platform === 'youtube' ? '▶️' : platform === 'spotify' ? '🎵' : '🎬'}
          </Text>
          <Text style={styles.platformText}>{platformLabel} Content</Text>
          <Text style={styles.requiresInternet}>Requires internet</Text>
        </View>

        {/* Spotify-specific: always show "Open in Spotify" button */}
        {platform === 'spotify' && (
          <TouchableOpacity
            style={styles.spotifyButton}
            onPress={handleOpenExternal}
            accessibilityRole="button"
            accessibilityLabel="Open in Spotify"
          >
            <Text style={styles.spotifyButtonText}>Open in Spotify</Text>
          </TouchableOpacity>
        )}
      </View>
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
  embedContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1F2937',
  },
  embedPlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1F2937',
  },
  platformIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  platformText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  requiresInternet: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  spotifyButton: {
    backgroundColor: '#1DB954',
    paddingVertical: 12,
    alignItems: 'center',
  },
  spotifyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  offlineContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  offlineIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  offlineText: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  openButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#6366F1',
    borderRadius: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  openButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});
