/* app-cta.js — rewrites the tip CTA button to the correct app store based on platform.
 *
 * INTERIM behavior (see .kiro/specs/app-deep-linking): the button opens the app store,
 * where an installed user sees "Open". iOS -> App Store, Android -> Play Store,
 * desktop/unknown -> leave the default href (the site's download section with both
 * stores), so a wrong guess never traps the user.
 *
 * Detection uses the user-agent, which is a heuristic. The desktop/unknown fallback
 * never guesses, so misdetection at worst still lands on a store for the likely OS.
 */
(function () {
  var APP_STORE_URL = 'https://apps.apple.com/app/mental-health-wallet/id6800036822';
  var PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.mentalwallet.app';

  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/i.test(ua) ||
    // iPadOS 13+ reports as Mac; detect touch Macs as iOS-like.
    (/Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);

  var target = null;
  if (isIOS) target = APP_STORE_URL;
  else if (isAndroid) target = PLAY_STORE_URL;
  // else: leave the default href (download section with both stores)

  if (!target) return;

  var buttons = document.querySelectorAll('a.app-cta');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].setAttribute('href', target);
  }
})();
