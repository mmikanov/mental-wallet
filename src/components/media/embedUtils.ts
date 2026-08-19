/**
 * embedUtils — Pure utility functions for platform URL embed transformations.
 *
 * These are extracted from PlatformEmbed for testability and reuse.
 */

import type { PlatformType } from '@/types/index';

/**
 * Converts a standard platform URL to its embeddable equivalent.
 *
 * - YouTube: youtube.com/embed/{videoId}
 * - Vimeo: player.vimeo.com/video/{videoId}
 * - SoundCloud: w.soundcloud.com/player/?url={encodedUrl}&auto_play=false
 * - Spotify: open.spotify.com/embed/{type}/{id}
 * - Unknown: returns the original URL (WebView will attempt to load it directly)
 */
export function getEmbedUrl(url: string, platform: PlatformType): string {
  switch (platform) {
    case 'youtube': {
      const match = url.match(
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/
      );
      return match
        ? `https://www.youtube.com/embed/${match[1]}`
        : url;
    }
    case 'vimeo': {
      const match = url.match(/vimeo\.com\/(\d+)/);
      return match
        ? `https://player.vimeo.com/video/${match[1]}`
        : url;
    }
    case 'soundcloud': {
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=false`;
    }
    case 'spotify': {
      const match = url.match(
        /spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/
      );
      return match
        ? `https://open.spotify.com/embed/${match[1]}/${match[2]}`
        : url;
    }
    default:
      return url;
  }
}

/**
 * Extracts the origin from an embed URL for same-origin navigation filtering.
 */
export function getEmbedOrigin(embedUrl: string): string {
  try {
    const parsed = new URL(embedUrl);
    return parsed.origin;
  } catch {
    return '';
  }
}

/**
 * Generates an HTML wrapper page for platforms that require proper Referer headers
 * (specifically YouTube, which rejects embeds from WKWebView due to missing referrer).
 *
 * Returns null for platforms that work fine with direct URL loading.
 */
export function getEmbedHtml(embedUrl: string, platform: PlatformType): string | null {
  // Shared script that monitors iframe load status and reports failures
  // back to React Native via window.ReactNativeWebView.postMessage
  const iframeMonitorScript = `
  <script>
    (function() {
      var iframe = document.querySelector('iframe');
      var loaded = false;
      var timeout = setTimeout(function() {
        if (!loaded) {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'iframe_error', reason: 'timeout' }));
        }
      }, 10000); // 10 second timeout

      iframe.addEventListener('load', function() {
        loaded = true;
        clearTimeout(timeout);
        // Check if the iframe loaded an error page (cross-origin prevents reading content,
        // but we can detect a successful load event)
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'iframe_loaded' }));
      });

      iframe.addEventListener('error', function() {
        loaded = true;
        clearTimeout(timeout);
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'iframe_error', reason: 'load_failed' }));
      });
    })();
  </script>`;

  // YouTube requires an HTML wrapper with referrerpolicy to send proper Referer headers
  if (platform === 'youtube') {
    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    iframe { width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <iframe
    src="${embedUrl}"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    referrerpolicy="strict-origin-when-cross-origin"
    allowfullscreen
  ></iframe>
  ${iframeMonitorScript}
</body>
</html>`;
  }

  // Vimeo can also benefit from the HTML wrapper for consistency
  if (platform === 'vimeo') {
    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    iframe { width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <iframe
    src="${embedUrl}"
    allow="autoplay; fullscreen; picture-in-picture"
    referrerpolicy="strict-origin-when-cross-origin"
    allowfullscreen
  ></iframe>
  ${iframeMonitorScript}
</body>
</html>`;
  }

  return null;
}
