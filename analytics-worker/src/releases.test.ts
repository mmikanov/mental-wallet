/**
 * Unit tests for the pure release-tracking helpers (no D1). SQL-level behavior is
 * verified against LOCAL D1 and recorded in the task results.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  releaseExclusionSql,
  releaseExclusionExpr,
  isSafeReleaseRow,
  loadReleases,
  invalidateReleasesCache,
  RELEASES_CACHE_TTL_MS,
  metricsExclusionExpr,
  compareVersions,
  summarizeReleases,
  NEVER_RELEASED_AT,
  isNeverReleased,
  joinVersionOptions,
} from './releases.ts';

const REL = [
  { platform: 'android', app_version: '1.0.6', live_at: '2026-11-04T14:30:00Z' },
  { platform: 'ios', app_version: '1.0.6', live_at: '2026-11-10T00:00:00Z' },
  { platform: 'android', app_version: '1.0.2', live_at: NEVER_RELEASED_AT, note: 'skipped' },
];

test('releaseExclusionSql: literal conditions, no bind params, no subquery', () => {
  const sql = releaseExclusionSql(REL);
  assert.ok(!sql.includes('?'));
  assert.ok(sql.startsWith(' AND '));
  assert.ok(!sql.includes('version_releases') && !/select/i.test(sql));
  assert.ok(sql.includes("platform = 'android' AND app_version = '1.0.6'"));
  assert.ok(sql.includes("julianday(received_at) < julianday('2026-11-04T14:30:00Z')"));
  assert.ok(!sql.includes('events.') && !sql.includes('tc.'));
});

test('releaseExclusionExpr: no rows => 1=1; alias qualifies every event column', () => {
  assert.equal(releaseExclusionExpr([]), '1=1');
  const sql = releaseExclusionSql(REL, 'tc');
  assert.ok(sql.includes("tc.platform = 'ios' AND tc.app_version = '1.0.6'"));
  assert.ok(sql.includes('julianday(tc.received_at) <'));
  assert.ok(!/[^.\w]received_at/.test(sql.replace(/tc\.received_at/g, '')));
});

test('metricsExclusionExpr: contains both skew and release predicates', () => {
  const e = metricsExclusionExpr(REL, 'events');
  assert.ok(e.includes('julianday(events.timestamp) - julianday(events.received_at) <= 1'));
  assert.ok(e.includes("events.app_version = '1.0.6'"));
  assert.ok(!e.includes('?'));
});

test('release predicate: injection-unsafe rows are skipped, never inlined', () => {
  const evil = [
    { platform: "ios'; DROP TABLE events;--", app_version: '1.0.1', live_at: '2026-01-01T00:00:00Z' },
    { platform: 'ios', app_version: "1.0' OR '1'='1", live_at: '2026-01-01T00:00:00Z' },
    { platform: 'ios', app_version: '1.0.1', live_at: "2026-01-01T00:00:00Z') OR 1=1 --" },
    { platform: 'IOS', app_version: '1.0.1', live_at: '2026-01-01T00:00:00Z' },
    { platform: 'ios', app_version: '1.0.1', live_at: 'tomorrow' },
    { platform: 'ios', app_version: '', live_at: '2026-01-01T00:00:00Z' },
  ];
  for (const r of evil) assert.equal(isSafeReleaseRow(r), false);
  assert.equal(releaseExclusionExpr(evil), '1=1');
  const mixed = releaseExclusionExpr([...evil, REL[0]]);
  assert.ok(!mixed.includes('DROP') && !mixed.includes('OR 1=1') && !mixed.includes('tomorrow'));
  assert.ok(mixed.includes("'1.0.6'"));
  assert.equal(isSafeReleaseRow({ platform: 'ios', app_version: '1.0.6', live_at: '2026-11-04T14:30:00.000+00:00' }), true);
});

test('release predicate is semantically identical to the old correlated predicate (sqlite)', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE events (id INTEGER PRIMARY KEY, platform TEXT, app_version TEXT, received_at TEXT)');
  db.exec('CREATE TABLE version_releases (platform TEXT, app_version TEXT, live_at TEXT)');
  const ins = db.prepare('INSERT INTO version_releases VALUES (?, ?, ?)');
  for (const r of REL) ins.run(r.platform, r.app_version, r.live_at);
  const times = [null, '2026-11-04T14:29:59Z', '2026-11-04T14:30:00Z', '2026-11-09T00:00:00Z', '2026-11-11T00:00:00Z', 'garbage'];
  const plats = [null, 'android', 'ios', 'web'];
  const vers = [null, '1.0.6', '1.0.2', '1.0.9'];
  const insE = db.prepare('INSERT INTO events (platform, app_version, received_at) VALUES (?, ?, ?)');
  for (const p of plats) for (const v of vers) for (const t of times) insE.run(p, v, t);
  const oldSql =
    '(platform IS NULL OR app_version IS NULL OR received_at IS NULL OR (platform, app_version) NOT IN (' +
    'SELECT vr.platform, vr.app_version FROM version_releases vr WHERE julianday(received_at) < julianday(vr.live_at)))';
  const oldIds = db.prepare(`SELECT id FROM events WHERE ${oldSql} ORDER BY id`).all().map((r) => r.id);
  const newIds = db.prepare(`SELECT id FROM events WHERE ${releaseExclusionExpr(REL)} ORDER BY id`).all().map((r) => r.id);
  assert.ok(oldIds.length > 0 && oldIds.length < plats.length * vers.length * times.length);
  assert.deepEqual(newIds, oldIds);
  // No rows => everything included.
  const all = db.prepare(`SELECT COUNT(*) c FROM events WHERE ${releaseExclusionExpr([])}`).get() as { c: number };
  assert.equal(all.c, plats.length * vers.length * times.length);
});

test('loadReleases: reads once, caches for the TTL, refetches after expiry or invalidation', async () => {
  invalidateReleasesCache();
  let calls = 0;
  const db = { prepare: () => ({ all: async () => { calls++; return { results: REL as never[] }; } }) };
  assert.equal((await loadReleases(db as never, 1_000_000)).length, 3);
  await loadReleases(db as never, 1_000_000 + RELEASES_CACHE_TTL_MS - 1);
  assert.equal(calls, 1);
  await loadReleases(db as never, 1_000_000 + RELEASES_CACHE_TTL_MS);
  assert.equal(calls, 2);
  invalidateReleasesCache();
  await loadReleases(db as never, 1_000_000 + RELEASES_CACHE_TTL_MS);
  assert.equal(calls, 3);
  invalidateReleasesCache();
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

test('joinVersionOptions: live, safe, recorded versions only; grouped by platform, newest first', () => {
  const now = '2026-11-05T00:00:00Z';
  const rows = [
    { platform: 'ios', app_version: '1.0.5', live_at: '2026-10-01T00:00:00Z' },
    { platform: 'ios', app_version: '1.0.10', live_at: '2026-11-01T00:00:00Z' },
    { platform: 'ios', app_version: '1.0.9', live_at: '2026-10-20T00:00:00Z' },
    { platform: 'ios', app_version: '1.0.2', live_at: NEVER_RELEASED_AT },
    { platform: 'ios', app_version: '1.1.0', live_at: '2027-01-01T00:00:00Z' }, // scheduled
    { platform: 'android', app_version: '1.0.4', live_at: '2026-09-17T00:00:00Z' },
    { platform: 'android', app_version: "1.0'--", live_at: '2026-09-17T00:00:00Z' }, // unsafe
  ];
  assert.deepEqual(
    joinVersionOptions(rows, now).map((r) => `${r.platform}:${r.app_version}`),
    ['android:1.0.4', 'ios:1.0.10', 'ios:1.0.9', 'ios:1.0.5'],
  );
});
