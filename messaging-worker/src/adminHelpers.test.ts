// Unit tests for the pure drip-admin display helpers.
// Run via the package.json "test" script (node --test, TypeScript stripped).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCountdown, buildSimGrid, cellText } from './adminHelpers.ts';

const NOW = new Date('2026-02-10T10:00:00Z');

test('formatCountdown: hours + minutes', () => {
  assert.equal(formatCountdown('2026-02-10T14:30:00Z', NOW), 'in 4h 30m');
});

test('formatCountdown: days + hours', () => {
  assert.equal(formatCountdown('2026-02-12T14:00:00Z', NOW), 'in 2d 4h');
});

test('formatCountdown: minutes only', () => {
  assert.equal(formatCountdown('2026-02-10T10:45:00Z', NOW), 'in 45m');
});

test('formatCountdown: past = due now', () => {
  assert.equal(formatCountdown('2026-02-10T09:00:00Z', NOW), 'due now');
});

test('formatCountdown: null / invalid = unknown', () => {
  assert.equal(formatCountdown(null, NOW), 'unknown');
  assert.equal(formatCountdown('not-a-date', NOW), 'unknown');
});

test('buildSimGrid: columns sorted by tester age, rows per day', () => {
  const perDay = [
    { day: '2026-02-10', plan: [
      { email: 'tester+1d@drip-test.local', status: 'next' as const, tip_slug: 'welcome' },
      { email: 'tester+0d@drip-test.local', status: 'next' as const, tip_slug: 'welcome' },
    ]},
    { day: '2026-02-11', plan: [
      { email: 'tester+1d@drip-test.local', status: 'waiting' as const, tip_slug: 'emotion' },
      { email: 'tester+0d@drip-test.local', status: 'waiting' as const, tip_slug: 'emotion' },
    ]},
  ];
  const grid = buildSimGrid(perDay);
  assert.deepEqual(grid.testers, ['0d', '1d']); // sorted ascending by age
  assert.equal(grid.rows.length, 2);
  assert.equal(grid.rows[0].day, '2026-02-10');
  assert.equal(grid.rows[0].cells['0d'].status, 'next');
  assert.equal(grid.rows[0].cells['0d'].tip_slug, 'welcome');
  assert.equal(grid.rows[1].cells['1d'].status, 'waiting');
});

test('buildSimGrid: a tester missing from a day defaults to finished', () => {
  const perDay = [
    { day: '2026-02-10', plan: [
      { email: 'tester+0d@drip-test.local', status: 'next' as const, tip_slug: 'welcome' },
      { email: 'tester+5d@drip-test.local', status: 'next' as const, tip_slug: 'welcome' },
    ]},
    { day: '2026-02-11', plan: [
      { email: 'tester+0d@drip-test.local', status: 'finished' as const },
      // 5d absent this day
    ]},
  ];
  const grid = buildSimGrid(perDay);
  assert.deepEqual(grid.testers, ['0d', '5d']);
  assert.equal(grid.rows[1].cells['5d'].status, 'finished');
});

test('cellText: next shows tip slug; waiting/finished show the word', () => {
  assert.equal(cellText({ status: 'next', tip_slug: 'welcome' }), 'welcome');
  assert.equal(cellText({ status: 'next' }), 'next');
  assert.equal(cellText({ status: 'waiting' }), 'waiting');
  assert.equal(cellText({ status: 'finished' }), 'finished');
});
