// Unit tests for the pure drip operator-summary builder.
// Run via the package.json "test" script (node --test, TypeScript stripped).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDripSummary,
  formatEasternDate,
  type SummaryPlanEntry,
  type SummaryCounts,
} from './dripSummary.ts';

const RUN_ISO = '2026-10-04T14:05:00Z'; // a cron run; EDT (US Eastern) on this date

function counts(partial: Partial<SummaryCounts>): SummaryCounts {
  return { sent: 0, failed: 0, waiting: 0, finished: 0, total: 0, ...partial };
}

test('(a) sends across multiple campaigns: grouped by campaign with recipients', () => {
  const plan: SummaryPlanEntry[] = [
    { email: 'a@x.com', status: 'next', campaign_id: 'c1', campaign_name: 'Welcome', tip_slug: 'welcome', sent: 'sent' },
    { email: 'b@x.com', status: 'next', campaign_id: 'c1', campaign_name: 'Welcome', tip_slug: 'welcome', sent: 'sent' },
    { email: 'c@x.com', status: 'next', campaign_id: 'c2', campaign_name: 'Grounding', tip_slug: 'grounding', sent: 'sent' },
    { email: 'd@x.com', status: 'waiting', campaign_id: 'c2', campaign_name: 'Grounding', tip_slug: 'grounding' },
  ];
  const s = buildDripSummary(plan, 'c9', counts({ sent: 3, waiting: 1, total: 4 }), RUN_ISO);

  assert.match(s.subject, /Drip summary — 3 emails sent/);
  // Both campaigns appear with their slugs and recipients.
  assert.match(s.text, /Welcome \(welcome\) — 2 recipients/);
  assert.match(s.text, /- a@x\.com/);
  assert.match(s.text, /- b@x\.com/);
  assert.match(s.text, /Grounding \(grounding\) — 1 recipient/);
  assert.match(s.text, /- c@x\.com/);
  // Waiting subscriber is NOT listed as delivered.
  assert.doesNotMatch(s.text, /- d@x\.com/);
  // Totals present.
  assert.match(s.text, /Delivered \(sent\): 3/);
  assert.match(s.text, /Total subscribers considered: 4/);
  // HTML carries the same groups.
  assert.match(s.html, /Welcome \(welcome\)/);
  assert.match(s.html, /Grounding \(grounding\)/);
});

test('(b) someone hits the last campaign: callout present', () => {
  const plan: SummaryPlanEntry[] = [
    { email: 'a@x.com', status: 'next', campaign_id: 'c1', campaign_name: 'Welcome', tip_slug: 'welcome', sent: 'sent' },
    { email: 'z@x.com', status: 'next', campaign_id: 'cLast', campaign_name: 'Farewell', tip_slug: 'farewell', sent: 'sent' },
  ];
  const s = buildDripSummary(plan, 'cLast', counts({ sent: 2, total: 2 }), RUN_ISO);

  assert.match(s.text, /Final campaign reached:/);
  assert.match(s.text, /just received the final campaign/);
  assert.match(s.text, /- z@x\.com/);
  assert.doesNotMatch(s.text, /none reached the final campaign today/);
  // HTML callout block present.
  assert.match(s.html, /Final campaign reached/);
  assert.match(s.html, /z@x\.com/);
});

test('(c) no one hits the last campaign: callout absent (states none)', () => {
  const plan: SummaryPlanEntry[] = [
    { email: 'a@x.com', status: 'next', campaign_id: 'c1', campaign_name: 'Welcome', tip_slug: 'welcome', sent: 'sent' },
  ];
  const s = buildDripSummary(plan, 'cLast', counts({ sent: 1, total: 1 }), RUN_ISO);

  assert.match(s.text, /none reached the final campaign today/);
  assert.doesNotMatch(s.text, /just received the final campaign/);
});

test('(d) zero-send day: still produces a short summary', () => {
  const plan: SummaryPlanEntry[] = [
    { email: 'a@x.com', status: 'waiting', campaign_id: 'c1', campaign_name: 'Welcome', tip_slug: 'welcome' },
    { email: 'b@x.com', status: 'finished' },
    { email: 'c@x.com', status: 'finished' },
  ];
  const s = buildDripSummary(plan, 'cLast', counts({ sent: 0, waiting: 1, finished: 2, total: 3 }), RUN_ISO);

  assert.match(s.subject, /Drip summary — 0 emails sent/);
  assert.match(s.text, /Drip ran — 0 emails sent today\. 1 waiting, 2 finished\./);
  assert.match(s.html, /0 emails sent today/);
  // No delivered-by-campaign section when nothing was delivered.
  assert.doesNotMatch(s.text, /Delivered by campaign:/);
});

test('failed sends are listed with email + campaign', () => {
  const plan: SummaryPlanEntry[] = [
    { email: 'ok@x.com', status: 'next', campaign_id: 'c1', campaign_name: 'Welcome', tip_slug: 'welcome', sent: 'sent' },
    { email: 'bad@x.com', status: 'next', campaign_id: 'c1', campaign_name: 'Welcome', tip_slug: 'welcome', sent: 'failed' },
  ];
  const s = buildDripSummary(plan, 'cLast', counts({ sent: 1, failed: 1, total: 2 }), RUN_ISO);

  assert.match(s.text, /Failed sends:/);
  assert.match(s.text, /- bad@x\.com — Welcome \(welcome\)/);
  // Failed send is not counted as a delivered recipient under the campaign group.
  assert.doesNotMatch(s.text, /Welcome \(welcome\) — 2 recipients/);
});

test('subject date is formatted in US Eastern', () => {
  // 2026-10-04T14:05:00Z is 10:05 AM EDT on Oct 4, 2026.
  assert.equal(formatEasternDate(RUN_ISO), 'Oct 4, 2026');
});

test('empty sequence (no last campaign) omits the callout as "none"', () => {
  const plan: SummaryPlanEntry[] = [
    { email: 'a@x.com', status: 'next', campaign_id: 'c1', campaign_name: 'Welcome', tip_slug: 'welcome', sent: 'sent' },
  ];
  const s = buildDripSummary(plan, null, counts({ sent: 1, total: 1 }), RUN_ISO);
  assert.match(s.text, /none reached the final campaign today/);
});
