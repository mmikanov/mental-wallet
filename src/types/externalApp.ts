/**
 * Type definitions for External App Tools.
 * Provides metadata for third-party wellness app cards that can be
 * launched from the wallet via deep links with affiliate tracking.
 *
 * Validates: Requirements 2.1, 4.1, 7.1
 */

/**
 * Configuration for an external app card.
 * Defines how to launch the app, track affiliates, and display fallbacks.
 */
export interface ExternalAppConfig {
  /** Display name of the external app (e.g., "Headspace") */
  appName: string;

  /** Deep link URL to open the app directly. Cross-platform schemes preferred (e.g., "headspace://home") */
  deepLinkUrl?: string;

  /** Web URL — always available as the last-resort fallback */
  webUrl: string;

  /** Affiliate tracking URL — takes priority over webUrl when falling back from a failed deep link */
  affiliateUrl?: string;

  /** Whether the current fallback URL is an affiliate link (controls FTC disclosure visibility) */
  hasAffiliateLink?: boolean;

  /** iOS App Store ID (numeric string, e.g., "493145008") for store fallback */
  appStoreId?: string;

  /** Android package name (e.g., "com.getsomeheadspace.android") for Play Store fallback */
  playStoreId?: string;

  /** Affiliate network name for internal reference (e.g., "CJ Affiliate", "FlexOffers", "Impact") */
  affiliateNetwork?: string;

  /** 1-2 letter monogram shown as icon fallback if logo fails to load (e.g., "H", "IT") */
  monogram: string;
}
