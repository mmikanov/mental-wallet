/**
 * Dependency-free test for channel tag forwarding (FEAT-003).
 *
 * Run with:  node --test website/tests/forward-tag.test.mjs
 *
 * There is no jsdom in this project, so we use a tiny DOM shim that implements the exact
 * subset forwardChannelTag() touches: querySelectorAll('.store-badge') and each badge's
 * getAttribute/setAttribute('href'). The badge anchors are extracted from the REAL
 * website/index.html and website/app-fallback.html markup so the test exercises the actual
 * shipped hrefs, not a hand-written copy.
 *
 * app-fallback.html carries its forwarding logic inline (no script.js include). Its logic is
 * byte-for-byte the same algorithm as website/script.js's forwardChannelTag, so driving the
 * extracted app-fallback badges through the shared function validates the identical behavior.
 * The inline copy is kept in sync by hand (see the comment at the top of that <script>).
 *
 * MANUAL BROWSER CHECK (equivalent, no network needed):
 *   1. Open website/index.html via file:// with ?utm_source=reddit and inspect the four
 *      .store-badge hrefs: Google Play contains referrer=utm_source%3Dreddit, App Store
 *      contains ct=reddit.
 *   2. Reload without any query string: all four hrefs are unchanged (plain store URLs).
 *   3. Repeat for website/app-fallback.html (#store-badges, two badges).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const websiteDir = join(here, '..');

// --- Load forwardChannelTag from script.js without a browser --------------------------------
// script.js references `window`/`document`/`localStorage` only inside the self-invoking IIFE
// at load time. We provide stubs on globalThis, evaluate the file, and capture the exported
// window.forwardChannelTag.
function loadForwardChannelTag() {
  const src = readFileSync(join(websiteDir, 'script.js'), 'utf8');
  const sandboxWindow = {};
  // Minimal globals the top-level IIFE needs so evaluating the module does not throw.
  const fn = new Function(
    'window',
    'document',
    'localStorage',
    'URLSearchParams',
    src + '\nreturn window.forwardChannelTag;'
  );
  const stubDoc = { querySelectorAll: () => [] };
  const stubLocation = { search: '' };
  sandboxWindow.location = stubLocation;
  return fn(sandboxWindow, stubDoc, undefined, URLSearchParams);
}

const forwardChannelTag = loadForwardChannelTag();

// --- Tiny DOM shim --------------------------------------------------------------------------
class FakeAnchor {
  constructor(href) {
    this._href = href;
  }
  getAttribute(name) {
    return name === 'href' ? this._href : null;
  }
  setAttribute(name, value) {
    if (name === 'href') this._href = value;
  }
}

function makeDoc(badges) {
  return {
    querySelectorAll(selector) {
      if (selector === '.store-badge') return badges;
      return [];
    },
  };
}

// In-memory localStorage shim.
function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

// Extract the href of every <a class="store-badge" ...> from a page's markup.
function extractBadgeHrefs(fileName) {
  const html = readFileSync(join(websiteDir, fileName), 'utf8');
  const anchorRe = /<a\b[^>]*class="[^"]*\bstore-badge\b[^"]*"[^>]*>/g;
  const hrefRe = /href="([^"]*)"/;
  const hrefs = [];
  let m;
  while ((m = anchorRe.exec(html)) !== null) {
    const hm = hrefRe.exec(m[0]);
    if (hm) hrefs.push(hm[1]);
  }
  return hrefs;
}

// --- Tests ----------------------------------------------------------------------------------

test('index.html: ?utm_source=reddit tags all four badges', () => {
  const hrefs = extractBadgeHrefs('index.html');
  assert.equal(hrefs.length, 4, 'expected hero + CTA = 4 store badges');

  const badges = hrefs.map((h) => new FakeAnchor(h));
  forwardChannelTag(makeDoc(badges), '?utm_source=reddit', makeStorage());

  for (const badge of badges) {
    const href = badge.getAttribute('href');
    if (href.includes('play.google.com')) {
      assert.match(href, /referrer=utm_source%3Dreddit/, 'Google Play referrer tag');
    } else if (href.includes('apps.apple.com')) {
      assert.match(href, /ct=reddit/, 'App Store ct tag');
    } else {
      assert.fail('unexpected badge href: ' + href);
    }
  }

  const play = badges.map((b) => b.getAttribute('href')).filter((h) => h.includes('play.google.com'));
  const apple = badges.map((b) => b.getAttribute('href')).filter((h) => h.includes('apps.apple.com'));
  assert.equal(play.length, 2, 'both Google Play badges tagged');
  assert.equal(apple.length, 2, 'both App Store badges tagged');
});

test('index.html: no query leaves all hrefs unchanged (organic)', () => {
  const hrefs = extractBadgeHrefs('index.html');
  const badges = hrefs.map((h) => new FakeAnchor(h));
  forwardChannelTag(makeDoc(badges), '', makeStorage());

  badges.forEach((badge, i) => {
    assert.equal(badge.getAttribute('href'), hrefs[i], 'href untouched when no tag');
  });
});

test('app-fallback.html: ?utm_source=reddit tags #store-badges', () => {
  const hrefs = extractBadgeHrefs('app-fallback.html');
  assert.equal(hrefs.length, 2, 'expected 2 store badges in #store-badges');

  const badges = hrefs.map((h) => new FakeAnchor(h));
  forwardChannelTag(makeDoc(badges), '?utm_source=reddit', makeStorage());

  for (const badge of badges) {
    const href = badge.getAttribute('href');
    if (href.includes('play.google.com')) {
      assert.match(href, /referrer=utm_source%3Dreddit/);
    } else if (href.includes('apps.apple.com')) {
      assert.match(href, /ct=reddit/);
    } else {
      assert.fail('unexpected badge href: ' + href);
    }
  }
});

test('app-fallback.html: no query leaves hrefs unchanged', () => {
  const hrefs = extractBadgeHrefs('app-fallback.html');
  const badges = hrefs.map((h) => new FakeAnchor(h));
  forwardChannelTag(makeDoc(badges), '', makeStorage());

  badges.forEach((badge, i) => {
    assert.equal(badge.getAttribute('href'), hrefs[i]);
  });
});

test('utm_campaign is included in the Google Play referrer', () => {
  const badge = new FakeAnchor('https://play.google.com/store/apps/details?id=com.mentalwallet.app');
  forwardChannelTag(makeDoc([badge]), '?utm_source=reddit&utm_campaign=launch', makeStorage());
  const href = badge.getAttribute('href');
  // encodeURIComponent('utm_source=reddit&utm_campaign=launch')
  assert.match(href, /referrer=utm_source%3Dreddit%26utm_campaign%3Dlaunch/);
});

test('stored tag forwards on a later same-visit page with no query', () => {
  const storage = makeStorage();
  // First page view carried the tag.
  forwardChannelTag(makeDoc([]), '?utm_source=linkedin', storage);
  // Second page view (no query) should still tag from storage.
  const badge = new FakeAnchor('https://apps.apple.com/app/mental-health-wallet/id6800036822');
  forwardChannelTag(makeDoc([badge]), '', storage);
  assert.match(badge.getAttribute('href'), /ct=linkedin/);
});
