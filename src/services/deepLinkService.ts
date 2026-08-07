/**
 * Deep Link Service — Handles launching external apps with a
 * prioritized fallback chain.
 *
 * Fallback order:
 * 1. Deep link (cross-platform URI scheme, e.g. headspace://)
 * 2. Platform-specific app store (App Store on iOS, Play Store on Android)
 * 3. Affiliate URL (if present — enables attribution tracking)
 * 4. Generic web URL (last resort)
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import { Linking, Platform } from 'react-native';
import type { ExternalAppConfig } from '@/types/externalApp';

export type LaunchMethod = 'deep_link' | 'app_store' | 'affiliate_fallback' | 'web_fallback';

export interface LaunchResult {
  success: boolean;
  method: LaunchMethod;
}

/**
 * Constructs the platform-appropriate app store URL from config.
 * Returns null if no store ID is available for the current platform.
 */
function getStoreUrl(config: ExternalAppConfig): string | null {
  if (Platform.OS === 'ios' && config.appStoreId) {
    return `https://apps.apple.com/app/id${config.appStoreId}`;
  }
  if (Platform.OS === 'android' && config.playStoreId) {
    return `https://play.google.com/store/apps/details?id=${config.playStoreId}`;
  }
  return null;
}

/**
 * Attempt to launch an external app with the following fallback chain:
 * 1. Try deep link URL (cross-platform scheme preferred, e.g. headspace://)
 * 2. Fall back to platform-specific app store (iOS App Store or Google Play)
 * 3. Fall back to affiliate URL (if provided)
 * 4. Fall back to generic web URL
 *
 * @param config - The external app configuration containing all link variants
 * @returns LaunchResult indicating success and which method was used
 */
export async function launchExternalApp(config: ExternalAppConfig): Promise<LaunchResult> {
  // 1. Try deep link (cross-platform scheme preferred)
  if (config.deepLinkUrl) {
    try {
      const canOpen = await Linking.canOpenURL(config.deepLinkUrl);
      if (canOpen) {
        await Linking.openURL(config.deepLinkUrl);
        return { success: true, method: 'deep_link' };
      }
    } catch {
      // Deep link failed — continue to next fallback
    }
  }

  // 2. Try platform-specific app store
  const storeUrl = getStoreUrl(config);
  if (storeUrl) {
    try {
      await Linking.openURL(storeUrl);
      return { success: true, method: 'app_store' };
    } catch {
      // Store URL failed — continue to next fallback
    }
  }

  // 3. Try affiliate URL (takes priority over plain web URL for attribution)
  if (config.affiliateUrl) {
    try {
      await Linking.openURL(config.affiliateUrl);
      return { success: true, method: 'affiliate_fallback' };
    } catch {
      // Affiliate URL failed — fall through to web
    }
  }

  // 4. Fall back to generic web URL (always available)
  try {
    await Linking.openURL(config.webUrl);
    return { success: true, method: 'web_fallback' };
  } catch {
    // All methods exhausted
    return { success: false, method: 'web_fallback' };
  }
}
