/**
 * Mental Wallet Landing Page
 * Progressive enhancement: FAQ uses native <details> elements.
 * This script only adds smooth open/close animation if JS is available.
 */

/**
 * Channel tag forwarding.
 *
 * On load, read utm_source (+ optional utm_campaign) from the URL. If present, persist to
 * localStorage so a later same-visit badge tap on another page still carries the channel.
 * When a tag is resolved (from the URL or a prior stored value), rewrite each store badge
 * href so the channel reaches the store:
 *   - Google Play: append &referrer=<encoded "utm_source=<channel>[&utm_campaign=<campaign>]">
 *   - App Store:   append ct=<channel> (+ optional pt=)
 * No visual or copy change. If no tag is present anywhere, hrefs are left untouched (organic).
 *
 * Exported as window.forwardChannelTag so the test harness can drive it against a parsed DOM.
 */
function forwardChannelTag(doc, search, storage) {
  doc = doc || document;
  search = search != null ? search : (window.location.search || '');
  storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);

  var CHANNEL_KEY = 'mhw_channel';
  var CAMPAIGN_KEY = 'mhw_campaign';

  var params = new URLSearchParams(search);
  var channel = params.get('utm_source');
  var campaign = params.get('utm_campaign');

  // Persist a fresh tag; otherwise fall back to a stored one (multi-page visit).
  if (channel) {
    if (storage) {
      try {
        storage.setItem(CHANNEL_KEY, channel);
        if (campaign) {
          storage.setItem(CAMPAIGN_KEY, campaign);
        } else {
          storage.removeItem(CAMPAIGN_KEY);
        }
      } catch (e) { /* storage unavailable (private mode); still rewrite this page */ }
    }
  } else if (storage) {
    try {
      channel = storage.getItem(CHANNEL_KEY);
      campaign = storage.getItem(CAMPAIGN_KEY);
    } catch (e) { /* ignore */ }
  }

  if (!channel) return; // organic — leave all hrefs plain

  var referrerValue = 'utm_source=' + channel;
  if (campaign) referrerValue += '&utm_campaign=' + campaign;
  var encodedReferrer = encodeURIComponent(referrerValue);

  var badges = doc.querySelectorAll('.store-badge');
  for (var i = 0; i < badges.length; i++) {
    var badge = badges[i];
    var href = badge.getAttribute('href');
    if (!href) continue;
    var sep = href.indexOf('?') === -1 ? '?' : '&';

    if (href.indexOf('play.google.com') !== -1) {
      if (href.indexOf('referrer=') === -1) {
        badge.setAttribute('href', href + sep + 'referrer=' + encodedReferrer);
      }
    } else if (href.indexOf('apps.apple.com') !== -1) {
      if (href.indexOf('ct=') === -1) {
        badge.setAttribute('href', href + sep + 'ct=' + encodeURIComponent(channel));
      }
    }
  }
}

if (typeof window !== 'undefined') {
  window.forwardChannelTag = forwardChannelTag;
}

(function () {
  'use strict';

  // Carry the acquisition channel to the store badges (invisible; organic stays plain).
  try {
    forwardChannelTag(document, window.location.search, typeof localStorage !== 'undefined' ? localStorage : null);
  } catch (e) { /* never block the page on tag forwarding */ }

  // Animate details open/close for smoother UX
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(function (details) {
    const answer = details.querySelector('.faq-answer');
    if (!answer) return;

    details.addEventListener('toggle', function () {
      if (details.open) {
        answer.style.maxHeight = answer.scrollHeight + 'px';
        answer.style.opacity = '1';
      }
    });
  });
})();
