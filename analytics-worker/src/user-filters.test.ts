/**
 * SQL-level tests for the user-level cohort restrictions (userFilters.ts) and the users
 * drill-down query (usersQuery.ts), run against an in-memory sqlite so param alignment,
 * channel attribution (regression for "New Unique Users ignores the Channel filter"), the
 * join-version cohort and card-vs-list agreement are verified without a Worker.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { metricsExclusionExpr } from './releases.ts';
import { parseJoinVersion, buildUserRestrictions, buildNewUsersCount } from './userFilters.ts';
import { buildUsersSql } from './usersQuery.ts';

const FROM = '2026-11-05T00:00:00.000Z';
const TO = '2026-12-01T00:00:00.000Z';
const releases = [{ platform: 'ios', app_version: '1.0.5', live_at: '2026-11-01T00:00:00Z' }];

function seed() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE events (id TEXT PRIMARY KEY, anonymous_user_id TEXT NOT NULL, session_id TEXT, event_type TEXT, timestamp TEXT NOT NULL, properties TEXT, received_at TEXT, platform TEXT, os_version TEXT, app_version TEXT, channel TEXT, country TEXT)`);
  db.exec('CREATE INDEX idx_events_user ON events (anonymous_user_id, timestamp)');
  const ins = db.prepare('INSERT INTO events (id, anonymous_user_id, event_type, timestamp, received_at, platform, os_version, app_version, channel, country) VALUES (?,?,?,?,?,?,?,?,?,?)');
  let n = 0;
  const add = (u: string, ts: string, plat: string | null, ver: string | null, ch: string | null) =>
    ins.run(`e${n++}`, u, 'tool_opened', ts, ts, plat, '17', ver, ch, 'US');
  // fb1/fb2: join on ios 1.0.5 (install event UNTAGGED, channel appears later), update to 1.0.6
  add('fb1', '2026-11-05T10:00:00.000Z', 'ios', '1.0.5', null);
  add('fb1', '2026-11-06T10:00:00.000Z', 'ios', '1.0.6', 'apps.facebook.com');
  add('fb2', '2026-11-07T10:00:00.000Z', 'ios', '1.0.5', null);
  add('fb2', '2026-11-07T11:00:00.000Z', 'ios', '1.0.5', 'apps.facebook.com');
  // org1: android 1.0.6, never tagged
  add('org1', '2026-11-08T10:00:00.000Z', 'android', '1.0.6', null);
  add('org1', '2026-11-09T10:00:00.000Z', 'android', '1.0.6', null);
  // old1: joined BEFORE the window (October) on android 1.0.5, active inside window
  add('old1', '2026-10-20T10:00:00.000Z', 'android', '1.0.5', null);
  add('old1', '2026-11-10T10:00:00.000Z', 'android', '1.0.6', null);
  // nover: NULL app_version first event (pre-version builds)
  add('nover', '2026-11-11T10:00:00.000Z', 'ios', null, null);
  return db;
}

const base = { excludedIds: [] as string[], releases, fromDate: FROM, toDate: TO };
const qs = (s: string) => (s.match(/\?/g) || []).length;

test('parseJoinVersion accepts only platform:dotted-number and rejects injection', () => {
  assert.deepEqual(parseJoinVersion('ios:1.0.5'), { platform: 'ios', version: '1.0.5' });
  assert.deepEqual(parseJoinVersion('android:1.0.10'), { platform: 'android', version: '1.0.10' });
  for (const bad of [null, '', 'ios', 'ios:', ':1.0', "ios:1.0'; DROP TABLE events;--", 'IOS:1.0', 'ios:1.0.x', "x' OR '1'='1:1", 'ios:1..0']) {
    assert.equal(parseJoinVersion(bad as string | null), null, String(bad));
  }
});

test('restriction SQL: placeholder count always equals params length (all combinations)', () => {
  for (const excludedIds of [[], ['a', 'b']]) {
    for (const windowed of [true, false]) {
      for (const joinVersion of [null, { platform: 'ios', version: '1.0.5' }]) {
        for (const channel of [null, 'all', 'organic', 'apps.facebook.com']) {
          const r = buildUserRestrictions('anonymous_user_id', { excludedIds, releases, fromDate: FROM, toDate: TO, windowed, joinVersion, channel });
          assert.equal(qs(r.sql), r.params.length, JSON.stringify({ windowed, joinVersion, channel, excludedIds }));
        }
      }
    }
  }
  const k = buildNewUsersCount({ ...base, excludedIds: ['x'], joinVersion: { platform: 'ios', version: '1.0.5' }, channel: 'tiktok' });
  assert.equal(qs(k.sql), k.params.length);
});

test('hostile channel / join values are bound, never interpolated', () => {
  const evil = "x'; DROP TABLE events;--";
  const r = buildUserRestrictions('anonymous_user_id', { ...base, windowed: true, joinVersion: null, channel: evil });
  assert.ok(!r.sql.includes('DROP TABLE'));
  assert.ok(r.params.includes(evil));
  const j = buildUserRestrictions('anonymous_user_id', { ...base, windowed: false, joinVersion: { platform: 'ios', version: "1.0'--" }, channel: null });
  assert.ok(!j.sql.includes("1.0'--"));
});

test('no restriction => empty fragment (active, no version, no channel scope)', () => {
  const r = buildUserRestrictions('anonymous_user_id', { ...base, windowed: false, joinVersion: null, channel: null });
  assert.deepEqual(r, { sql: '', params: [] });
});

function count(db: DatabaseSync, o: { channel?: string | null; jv?: { platform: string; version: string } | null }) {
  const k = buildNewUsersCount({ ...base, joinVersion: o.jv ?? null, channel: o.channel ?? null });
  return Number((db.prepare(k.sql).get(...k.params) as { count: number }).count);
}
function listUsers(db: DatabaseSync, o: { cohortNew: boolean; channel?: string | null; jv?: { platform: string; version: string } | null }) {
  const restr = buildUserRestrictions('anonymous_user_id', { ...base, windowed: o.cohortNew, joinVersion: o.jv ?? null, channel: o.cohortNew ? o.channel ?? null : null });
  let clause = ' AND timestamp >= ? AND timestamp < ?';
  const params: string[] = [FROM, TO];
  clause += restr.sql; params.push(...restr.params);
  let lookup = ' AND timestamp >= ? AND timestamp < ?';
  const lp: string[] = [FROM, TO];
  if (!o.cohortNew && o.channel) { // per-event channel in active mode
    const c = o.channel === 'organic' ? ' AND channel IS NULL' : ' AND channel = ?';
    clause += c; lookup += c; if (o.channel !== 'organic') { params.push(o.channel); lp.push(o.channel); }
  }
  clause += ' AND ' + metricsExclusionExpr(releases);
  lookup += ' AND ' + metricsExclusionExpr(releases);
  const q = buildUsersSql(clause, params, lookup, lp, releases);
  assert.equal(qs(q.sql), q.params.length, 'users SQL param alignment');
  return db.prepare(q.sql).all(...q.params) as Array<Record<string, any>>;
}

test('REGRESSION: newUsers card respects the Channel filter (resolved per-user channel)', () => {
  const db = seed();
  // Window [Nov 5, Dec 1): fb1, fb2, org1, nover are new (old1 joined in October).
  assert.equal(count(db, {}), 4);
  // Before the fix this stayed 4 under any channel. Install events are untagged, yet fb1/fb2
  // resolve to the facebook channel through their LATER tagged events.
  assert.equal(count(db, { channel: 'apps.facebook.com' }), 2);
  assert.equal(count(db, { channel: 'organic' }), 2); // org1 + nover
  assert.equal(count(db, { channel: 'all' }), 4);
  assert.equal(count(db, { channel: 'no-such-channel' }), 0);
});

test('card count equals the New Unique Users drill-down row count, with and without filters', () => {
  const db = seed();
  const cases = [
    {}, { channel: 'apps.facebook.com' }, { channel: 'organic' },
    { jv: { platform: 'ios', version: '1.0.5' } },
    { jv: { platform: 'ios', version: '1.0.5' }, channel: 'apps.facebook.com' },
    { jv: { platform: 'android', version: '1.0.6' }, channel: 'organic' },
  ];
  for (const c of cases) assert.equal(listUsers(db, { cohortNew: true, ...c }).length, count(db, c), JSON.stringify(c));
});

test('join-version cohort = first-ever event platform+version (not latest, not window)', () => {
  const db = seed();
  const ids = (jv: { platform: string; version: string }, cohortNew: boolean) =>
    listUsers(db, { cohortNew, jv }).map((r) => r.anonymous_user_id).sort();
  assert.deepEqual(ids({ platform: 'ios', version: '1.0.5' }, false), ['fb1', 'fb2']); // fb1 later moved to 1.0.6
  assert.deepEqual(ids({ platform: 'ios', version: '1.0.6' }, false), []);
  assert.deepEqual(ids({ platform: 'android', version: '1.0.5' }, false), ['old1']); // joined in October
  assert.deepEqual(ids({ platform: 'android', version: '1.0.5' }, true), []);        // ...but not NEW in this window
  assert.deepEqual(ids({ platform: 'android', version: '1.0.6' }, true), ['org1']);
});

test('users rows carry first_version (join) and latest_version (last seen); NULL stays NULL', () => {
  const db = seed();
  const rows = listUsers(db, { cohortNew: false });
  const by = Object.fromEntries(rows.map((r) => [r.anonymous_user_id, r]));
  assert.equal(by.fb1.first_platform, 'ios'); assert.equal(by.fb1.first_version, '1.0.5'); assert.equal(by.fb1.latest_version, '1.0.6');
  assert.equal(by.org1.first_version, '1.0.6');
  // old1: first-ever event is in October (outside the window) and must still be reported
  assert.equal(by.old1.first_version, '1.0.5'); assert.equal(by.old1.latest_version, '1.0.6');
  assert.equal(by.nover.first_version, null); assert.equal(by.nover.latest_version, null);
  assert.equal(by.fb1.event_count, 2);
});

test('releases: pre-live traffic is ignored when choosing the join version', () => {
  const db = seed();
  // A tester event received BEFORE ios 1.0.5 went live must not become the "first" event.
  db.prepare('INSERT INTO events (id, anonymous_user_id, event_type, timestamp, received_at, platform, app_version) VALUES (?,?,?,?,?,?,?)')
    .run('pre', 'fb2', 'x', '2026-10-30T00:00:00.000Z', '2026-10-30T00:00:00.000Z', 'ios', '1.0.5');
  const rows = listUsers(db, { cohortNew: false });
  assert.equal(rows.find((r) => r.anonymous_user_id === 'fb2')!.first_seen >= FROM, true);
});
