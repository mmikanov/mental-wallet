/**
 * PlatformEmbed — Renders inline WebView-based embeds for platform URLs.
 *
 * Works with any HTTPS URL (Spotify, YouTube, Apple Music, Bandcamp, etc.).
 * Known platforms get converted to their embed URL format for inline playback.
 * Unknown platforms are loaded directly in the WebView. On failure, falls back
 * to a tappable placeholder that opens the URL externally.
 *
 * Validates: Requirements 1.1–1.5, 2.1–2.3, 3.1–3.8, 5.1–5.3, 7.1–7.4
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import type { PlatformType } from '@/types/index';
import { logEvent } from '@/services/analyticsEventLogger';
import { getEmbedUrl, getEmbedOrigin, getEmbedHtml } from './embedUtils';

interface PlatformEmbedProps {
  url: string;
  platform: PlatformType;
  label?: string;
  lazy?: boolean;
  accessibilityLabel?: string;
}

type EmbedState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Derives a human-friendly display name from the URL.
 */
function getDisplayName(url: string, platform: PlatformType): string {
  if (platform !== 'unknown') {
    return platform.charAt(0).toUpperCase() + platform.slice(1);
  }
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const name = hostname.split('.')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return 'External';
  }
}

/**
 * Attempts to construct a deep link for known platforms.
 */
function getDeepLink(url: string, platform: PlatformType): string | null {
  switch (platform) {
    case 'spotify': {
      const match = url.match(/spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/);
      return match ? `spotify://${match[1]}/${match[2]}` : null;
    }
    case 'youtube': {
      const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
      return match ? `youtube://${match[1]}` : null;
    }
    case 'vimeo': {
      const match = url.match(/vimeo\.com\/(\d+)/);
      return match ? `vimeo://app.vimeo.com/videos/${match[1]}` : null;
    }
    default:
      return null;
  }
}

/**
 * Returns a themed button color for known platforms, or a neutral default.
 */
function getButtonColor(platform: PlatformType): string {
  switch (platform) {
    case 'spotify':
      return '#1DB954';
    case 'youtube':
      return '#FF0000';
    case 'vimeo':
      return '#1AB7EA';
    case 'soundcloud':
      return '#FF5500';
    default:
      return '#6366F1';
  }
}

/**
 * Returns an icon for the media type.
 */
function getIcon(platform: PlatformType): string {
  switch (platform) {
    case 'youtube':
      return '▶️';
    case 'spotify':
    case 'soundcloud':
      return '🎵';
    case 'vimeo':
      return '🎬';
    default:
      return '🔗';
  }
}

/**
 * Returns the preview limitation disclosure text, or null if none applies.
 */
function getPreviewDisclosure(platform: PlatformType): string | null {
  switch (platform) {
    case 'spotify':
      return '30-second preview — open Spotify for full track';
    case 'soundcloud':
      return 'Some tracks are preview-only — open SoundCloud for full playback';
    default:
      return null;
  }
}

/**
 * Determines the WebView sizing based on platform type.
 * Video platforms get 16:9 aspect ratio, audio platforms get compact fixed height.
 */
function getWebViewStyle(platform: PlatformType): { aspectRatio?: number; height?: number } {
  switch (platform) {
    case 'spotify':
      return { height: 80 };
    case 'soundcloud':
      return { height: 166 };
    case 'youtube':
    case 'vimeo':
      return { aspectRatio: 16 / 9 };
    default:
      return { aspectRatio: 16 / 9 };
  }
}

export default function PlatformEmbed({
  url,
  platform,
  label,
  lazy = false,
  accessibilityLabel: a11yLabel,
}: PlatformEmbedProps) {
  const [embedState, setEmbedState] = useState<EmbedState>(lazy ? 'idle' : 'loading');

  const displayName = getDisplayName(url, platform);
  const deepLink = getDeepLink(url, platform);
  const embedUrl = useMemo(() => getEmbedUrl(url, platform), [url, platform]);
  const embedOrigin = useMemo(() => getEmbedOrigin(embedUrl), [embedUrl]);
  const embedHtml = useMemo(() => getEmbedHtml(embedUrl, platform), [embedUrl, platform]);
  const previewDisclosure = getPreviewDisclosure(platform);
  const webViewSizing = getWebViewStyle(platform);

  const handleOpenExternal = async () => {
    // Try deep link first (optimization for known platforms)
    if (deepLink) {
      try {
        const canOpen = await Linking.canOpenURL(deepLink);
        if (canOpen) {
          void logEvent('external_resource_opened', {
            resource_url: deepLink,
            resource_name: label || `${displayName} content`,
          });
          await Linking.openURL(deepLink);
          return;
        }
      } catch {
        // Deep link failed — fall through to web URL
      }
    }

    // Universal fallback: open the web URL
    void logEvent('external_resource_opened', {
      resource_url: url,
      resource_name: label || `${displayName} content`,
    });
    void Linking.openURL(url);
  };

  const handleNavigationRequest = (request: WebViewNavigation): boolean => {
    const requestUrl = request.url;
    // Allow about:blank (initial HTML load) and data URIs
    if (requestUrl === 'about:blank' || requestUrl.startsWith('data:')) {
      return true;
    }
    // Allow the embed URL itself
    if (requestUrl === embedUrl) {
      return true;
    }
    // Allow same-origin requests (player internal navigation, redirects)
    if (requestUrl.startsWith(embedOrigin)) {
      return true;
    }
    // When using HTML wrapper, also allow the baseUrl origin
    if (requestUrl.startsWith('https://localhost')) {
      return true;
    }
    // For known embed platforms (YouTube, Spotify, etc.), their embeds
    // shouldn't navigate externally — block and open in native browser
    if (platform !== 'unknown') {
      void Linking.openURL(requestUrl);
      return false;
    }
    // For unknown platforms loaded directly in the WebView, allow all
    // navigation within the WebView (the page may redirect, load subpages, etc.)
    // The user has the "Open in {DisplayName}" button for full browser experience.
    return true;
  };

  // --- Idle state (lazy-loaded, waiting for user tap) ---
  if (embedState === 'idle') {
    return (
      <View
        style={styles.container}
        accessibilityRole="none"
        accessibilityLabel={a11yLabel || `${displayName} media: ${label || url}`}
      >
        {label && <Text style={styles.label}>{label}</Text>}

        <View style={styles.embedContainer}>
          <TouchableOpacity
            style={[styles.idlePlaceholder, webViewSizing.aspectRatio ? { aspectRatio: webViewSizing.aspectRatio } : { height: webViewSizing.height }]}
            onPress={() => setEmbedState('loading')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Load ${label || 'content'} from ${displayName}`}
            accessibilityHint="Tap to load this media"
          >
            <Text style={styles.platformIcon}>{getIcon(platform)}</Text>
            <Text style={styles.platformText}>{label || `${displayName} Content`}</Text>
            <Text style={styles.tapHint}>Tap to load</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.openButton, { backgroundColor: getButtonColor(platform) }]}
            onPress={handleOpenExternal}
            accessibilityRole="link"
            accessibilityLabel={`Open in ${displayName}`}
          >
            <Text style={styles.openButtonText}>Open in {displayName}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- Error/fallback state ---
  if (embedState === 'error') {
    return (
      <View
        style={styles.container}
        accessibilityRole="none"
        accessibilityLabel={a11yLabel || `${displayName} media: ${label || url}`}
      >
        {label && <Text style={styles.label}>{label}</Text>}

        <View style={styles.embedContainer}>
          <TouchableOpacity
            style={[styles.fallbackPlaceholder, webViewSizing.aspectRatio ? { aspectRatio: webViewSizing.aspectRatio } : { height: webViewSizing.height }]}
            onPress={handleOpenExternal}
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel={`Open ${label || 'content'} in ${displayName}`}
            accessibilityHint="Opens in the native app or browser"
          >
            <Text style={styles.platformIcon}>{getIcon(platform)}</Text>
            <Text style={styles.platformText}>{label || `${displayName} Content`}</Text>
            <Text style={styles.errorHint}>No connection or content unavailable</Text>
            <Text style={styles.tapHint}>Tap to open externally</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.openButton, { backgroundColor: getButtonColor(platform) }]}
            onPress={handleOpenExternal}
            accessibilityRole="link"
            accessibilityLabel={`Open in ${displayName}`}
          >
            <Text style={styles.openButtonText}>Open in {displayName}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- Loading + Ready state (WebView renders in both, visibility controlled by opacity) ---
  return (
    <View
      style={styles.container}
      accessibilityRole="none"
      accessibilityLabel={a11yLabel || `${displayName} media: ${label || url}`}
    >
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={styles.embedContainer}>
        {/* WebView — always mounted during loading/ready, hidden via opacity during loading */}
        <View
          style={[
            styles.webViewWrapper,
            webViewSizing.aspectRatio ? { aspectRatio: webViewSizing.aspectRatio } : { height: webViewSizing.height },
          ]}
          accessibilityLabel={
            embedState === 'ready'
              ? `${displayName} ${platform === 'spotify' || platform === 'soundcloud' ? 'audio' : 'video'}: ${label || url}`
              : `Loading ${displayName} content`
          }
          accessibilityLiveRegion="polite"
        >
          <WebView
            source={embedHtml ? { html: embedHtml, baseUrl: 'https://localhost' } : { uri: embedUrl }}
            style={[styles.webView, { opacity: embedState === 'ready' ? 1 : 0 }]}
            originWhitelist={['https://*']}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled={true}
            onLoad={() => {
              // For HTML wrapper embeds, don't mark ready yet — wait for iframe message
              if (!embedHtml) {
                setEmbedState('ready');
              }
            }}
            onMessage={(event) => {
              // Handle messages from the iframe monitor script in HTML wrappers
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === 'iframe_loaded') {
                  setEmbedState('ready');
                } else if (data.type === 'iframe_error') {
                  setEmbedState('error');
                }
              } catch {
                // Ignore non-JSON messages from embed content
              }
            }}
            onError={() => setEmbedState('error')}
            onHttpError={() => setEmbedState('error')}
            onShouldStartLoadWithRequest={handleNavigationRequest}
            // iOS-specific: prevent bouncing
            bounces={false}
            // Prevent scrolling within the WebView (embed should fit)
            scrollEnabled={false}
            // Security: disable file access
            allowFileAccess={false}
            // Needed for Spotify/YouTube embeds that use third-party cookies
            thirdPartyCookiesEnabled={true}
            sharedCookiesEnabled={Platform.OS === 'ios'}
          />

          {/* Loading overlay */}
          {embedState === 'loading' && (
            <View style={styles.loadingOverlay} accessibilityLabel="Loading media content">
              <Text style={styles.platformIcon}>{getIcon(platform)}</Text>
              <ActivityIndicator
                size="small"
                color="#9CA3AF"
                style={styles.spinner}
              />
            </View>
          )}
        </View>

        {/* Preview limitation disclosure (Spotify/SoundCloud) */}
        {embedState === 'ready' && previewDisclosure && (
          <View style={styles.disclosureContainer}>
            <Text style={styles.disclosureText}>{previewDisclosure}</Text>
          </View>
        )}

        {/* "Open in {Platform}" button — always visible */}
        <TouchableOpacity
          style={[styles.openButton, { backgroundColor: getButtonColor(platform) }]}
          onPress={handleOpenExternal}
          accessibilityRole="link"
          accessibilityLabel={`Open in ${displayName}`}
        >
          <Text style={styles.openButtonText}>Open in {displayName}</Text>
        </TouchableOpacity>
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
  webViewWrapper: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#1F2937',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1F2937',
  },
  spinner: {
    marginTop: 8,
  },
  platformIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  platformText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  tapHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  errorHint: {
    fontSize: 12,
    color: '#F87171',
    marginTop: 6,
  },
  fallbackPlaceholder: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1F2937',
  },
  idlePlaceholder: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1F2937',
  },
  disclosureContainer: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#111827',
  },
  disclosureText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  openButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  openButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
