/**
 * Unit tests for the pure release-tracking helpers (no D1). SQL-level behavior is
 * verified against LOCAL D1 and recorded in the task results.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  releaseExclusionSql,
  metricsExclusionExpr,
  compareVersions,
  summarizeReleases,
  NEVER_RELEASED_AT,
  isNeverReleased,
} from './releases.ts';

test('releaseExclusionSql: no bind params, unqualified by default', () => {
  const sql = releaseExclusionSql();
  assert.ok(!sql.includes('?'));
  assert.ok(sql.startsWith(' AND '));
  assert.ok(sql.includes('version_releases'));
  assert.ok(sql.includes('julianday(received_at) < julianday(vr.live_at)'));
  assert.ok(sql.includes('received_at IS NULL'));
  assert.ok(sql.includes('platform IS NULL') && sql.includes('app_version IS NULL'));
  assert.ok(!sql.includes('events.') && !sql.includes('tc.'));
});

test('releaseExclusionSql: alias qualifies every event column', () => {
  const sql = releaseExclusionSql('tc');
  assert.ok(!sql.includes('?'));
  assert.ok(sql.includes('tc.platform IS NULL'));
  assert.ok(sql.includes('(tc.platform, tc.app_version) NOT IN'));
  assert.ok(sql.includes('julianday(tc.received_at) < julianday(vr.live_at)'));
  assert.ok(!/[^.\w]received_at/.test(sql.replace(/tc\.received_at/g, '')));
});

test('metricsExclusionExpr: contains both skew and release predicates', () => {
  const e = metricsExclusionExpr('events');
  assert.ok(e.includes('julianday(events.timestamp) - julianday(events.received_at) <= 1'));
  assert.ok(e.includes('version_releases'));
  assert.ok(!e.includes('?'));
});

test('compareVersions: numeric dotted ordering', () => {
  assert.ok(compareVersions('1.0.10', '1.0.9') > 0);
  assert.ok(compareVersions('1.0.6', '1.0.6') === 0);
  assert.ok(compareVersions('1.0', '1.0.1') < 0);
  assert.ok(compareVersions('2.0.0', '1.9.9') > 0);
});

test('summarizeReleases: statuses, empty-release rows, ordering, hidden counts', () => {
  const now = '2026-11-10T00:00:00.000Z';
  const seen = [
    { platform: 'android', app_version: '1.0.9', first_seen: 'a', last_seen: 'b', users: 2, events: 10, hidden_pre_live_events: 0 },
    { platform: 'ios', app_version: '1.0.10', first_seen: 'a', last_seen: 'b', users: 3, events: 30, hidden_pre_live_events: 5 },
    { platform: 'android', app_version: '1.0.10', first_seen: 'a', last_seen: 'b', users: 1, events: 4, hidden_pre_live_events: 4 },
    { platform: 'ios', app_version: '1.0.9', first_seen: 'a', last_seen: 'b', users: 1, events: 2, hidden_pre_live_events: 9 },
  ];
  const releases = [
    { platform: 'ios', app_version: '1.0.10', live_at: '2026-11-01T00:00:00Z' },
    { platform: 'android', app_version: '1.0.10', live_at: '2026-12-01T00:00:00Z' },
    { platform: 'ios', app_version: '1.0.11', live_at: '2026-12-05T00:00:00Z' },
  ];
  const rows = summarizeReleases(seen, releases, now);
  assert.deepEqual(
    rows.map((r) => `${r.app_version}/${r.platform}/${r.status}`),
    [
      '1.0.11/ios/scheduled',
      '1.0.10/android/scheduled',
      '1.0.10/ios/live',
      '1.0.9/android/not_recorded',
      '1.0.9/ios/not_recorded',
    ],
  );
  const noEvents = rows[0];
  assert.equal(noEvents.events, 0);
  assert.equal(noEvents.users, 0);
  assert.equal(noEvents.live_at, '2026-12-05T00:00:00Z');
  assert.equal(rows[2].hidden_pre_live_events, 5);
  // No release row => nothing hidden regardless of input.
  assert.equal(rows[4].hidden_pre_live_events, 0);
  assert.equal(rows[3].live_at, null);
});

test('never-released sentinel: skipped versions show as never_released (not scheduled) and hide every event', () => {
  assert.equal(isNeverReleased(NEVER_RELEASED_AT), true);
  assert.equal(isNeverReleased('2026-11-04T14:30:00Z'), false);
  assert.equal(isNeverReleased(null), false);
  const now = '2026-11-05T00:00:00Z';
  const seen = [
    { platform: 'android', app_version: '1.0.2', first_seen: '2026-08-30T00:00:00Z', last_seen: '2026-08-31T00:00:00Z', users: 4, events: 30, hidden_pre_live_events: 30 },
  ];
  const releases = [{ platform: 'android', app_version: '1.0.2', live_at: NEVER_RELEASED_AT, note: 'skipped' }];
  const [row] = summarizeReleases(seen, releases, now);
  assert.equal(row.status, 'never_released');
  assert.equal(row.hidden_pre_live_events, 30);
  // A normal far-future-but-real scheduled release is still "scheduled".
  const [sched] = summarizeReleases([], [{ platform: 'ios', app_version: '1.0.9', live_at: '2027-01-01T00:00:00Z' }], now);
  assert.equal(sched.status, 'scheduled');
});
