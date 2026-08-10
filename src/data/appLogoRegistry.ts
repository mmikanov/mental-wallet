/**
 * App Logo Registry — Maps external app card IDs to their bundled logo assets.
 *
 * Logos are bundled locally to avoid dependency on external CDNs and ensure
 * they work offline. The renderCardIcon utility checks this registry first;
 * if a match is found, it uses the local asset directly (as a require() number)
 * instead of downloading from the URL.
 *
 * To update a logo: replace the corresponding .jpg in assets/app-logos/
 * and rebuild the app.
 */

/**
 * Bundled app logo assets keyed by card ID.
 * Using require() ensures Metro bundles them.
 */
const APP_LOGO_ASSETS: Record<string, number> = {
  'app-headspace': require('../../assets/app-logos/headspace.jpg'),
  'app-calm': require('../../assets/app-logos/calm.jpg'),
  'app-talkspace': require('../../assets/app-logos/talkspace.jpg'),
  'app-betterhelp': require('../../assets/app-logos/betterhelp.jpg'),
  'app-wysa': require('../../assets/app-logos/wysa.jpg'),
  'app-mindfulness-com': require('../../assets/app-logos/mindfulness-com.jpg'),
  'app-insight-timer': require('../../assets/app-logos/insight-timer.jpg'),
};

/**
 * Get the bundled asset source for an app logo by card ID.
 * Returns the require() number that can be passed directly to Image source,
 * or null if no bundled logo exists.
 */
export function getAppLogoSource(cardId: string): number | null {
  return APP_LOGO_ASSETS[cardId] ?? null;
}

/**
 * Check if a card ID has a bundled logo available.
 */
export function hasAppLogo(cardId: string): boolean {
  return cardId in APP_LOGO_ASSETS;
}
