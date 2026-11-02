// Bug 1 (tip consistency) — the drip email must carry the tip's FULL body, not just the
// summary. The worker gets tip content from the website's /content/index.json
// (ContentIndexEntry → parseTip → TipPayload → sendTipEmail's body rendering). This suite
// pins that the body survives the index→payload boundary, and that a body-less tip still
// renders title + summary + CTA (graceful, no regression).
//
// Run via the package.json "test" script (node --test, TypeScript stripped).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTip, type ContentIndexEntry } from './index.ts';

// An index entry shaped exactly like what website/build-content.js now emits, INCLUDING a
// raw-markdown body. Typing it as ContentIndexEntry is the exploration signal: on unfixed
// code ContentIndexEntry has no `body` field, so this file fails to typecheck (`tsc
// --noEmit`) — the entry-level body is dropped at the type boundary. Once `body?: string`
// is added to ContentIndexEntry, it typechecks and parseTip populates TipPayload.body.
test('1.2 exploration — an index entry with a body flows through to TipPayload.body', () => {
  const entry: ContentIndexEntry = {
    slug: 'add-your-own-tool',
    title: 'Add your own tool',
    summary: 'Short summary line.',
    heroImage: '/assets/tips/add-your-own-tool.gif',
    cta: { label: 'Create your own tool', url: 'https://example.test/app/create-tool' },
    body: 'First paragraph of the full body.\n\nSecond paragraph with **bold**.',
  };

  const tip = parseTip(entry);
  assert.ok(tip, 'parseTip should accept a valid index entry');
  assert.equal(tip!.title, 'Add your own tool');
  assert.equal(tip!.summary, 'Short summary line.');
  // The gap this bug fixes: before the fix the body never reaches the payload.
  assert.ok(tip!.body, 'TipPayload.body must be populated from the index entry');
  assert.ok(
    tip!.body!.includes('Second paragraph'),
    'the full body (not just the summary) must survive',
  );
  assert.equal(tip!.cta?.url, 'https://example.test/app/create-tool');
});

test('1.3 preservation — a body-less tip still yields title + summary + CTA, body undefined', () => {
  const entry: ContentIndexEntry = {
    slug: 'older-short-tip',
    title: 'Older short tip',
    summary: 'This one has no markdown body.',
    cta: { label: 'Open your wallet', url: 'https://example.test/app/wallet' },
  };

  const tip = parseTip(entry);
  assert.ok(tip, 'parseTip should still accept a body-less entry');
  assert.equal(tip!.body, undefined, 'no body → body stays undefined (graceful, no regression)');
  assert.equal(tip!.title, 'Older short tip');
  assert.equal(tip!.summary, 'This one has no markdown body.');
  assert.equal(tip!.cta?.label, 'Open your wallet');
  assert.equal(tip!.cta?.url, 'https://example.test/app/wallet');
});
