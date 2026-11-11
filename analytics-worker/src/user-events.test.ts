/**
 * SQL-level tests for the per-user event timeline drill-down (GET /details/user-events).
 * Mirrors the releases.test.ts approach: the endpoint's query (USER_EVENTS_SQL) and cap
 * (USER_EVENTS_LIMIT) are exported from ./userEvents and exercised against a local in-memory
 * sqlite DB so the chronological ordering, per-user scoping, and cap are verified without a
 * live Worker. D1 read-cost (meta.rows_read) is measured separately against a seeded
 * Miniflare D1 and recorded in the task results.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { USER_EVENTS_SQL, USER_EVENTS_LIMIT } from './userEvents.ts';

function seedDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE events (
    id TEXT PRIMARY KEY,
    anonymous_user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    properties TEXT,
    received_at TEXT NOT NULL,
    platform TEXT,
    os_version TEXT,
    app_version TEXT,
    channel TEXT,
    country TEXT
  )`);
  db.exec('CREATE INDEX idx_events_user ON events (anonymous_user_id, timestamp)');
  const ins = db.prepare(
    'INSERT INTO events (id, anonymous_user_id, session_id, event_type, timestamp, properties, received_at, platform, app_version, channel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  return { db, ins };
}

test('USER_EVENTS_LIMIT is a sane cap to bound reads', () => {
  assert.equal(typeof USER_EVENTS_LIMIT, 'number');
  assert.ok(USER_EVENTS_LIMIT > 0 && USER_EVENTS_LIMIT <= 5000);
});

test('returns only the requested user\'s events, in chronological (timestamp ASC) order', () => {
  const { db, ins } = seedDb();
  // Insert out of order, two users interleaved.
  ins.run('a3', 'userA', 's1', 'tool_opened', '2026-11-03T10:00:00Z', '{"card_id":"c1"}', 'r', 'ios', '1.0.6', null);
  ins.run('b1', 'userB', 's9', 'app_opened', '2026-11-01T00:00:00Z', null, 'r', 'android', '1.0.6', 'tiktok');
  ins.run('a1', 'userA', 's1', 'app_opened', '2026-11-01T09:00:00Z', '{"days_since_install":0}', 'r', 'ios', '1.0.6', null);
  ins.run('a2', 'userA', 's1', 'onboarding_completed', '2026-11-02T09:30:00Z', null, 'r', 'ios', '1.0.6', null);

  const rows = db.prepare(USER_EVENTS_SQL).all('userA', USER_EVENTS_LIMIT) as Array<{
    event_type: string; timestamp: string; session_id: string; platform: string;
    app_version: string; channel: string | null; properties: string | null;
  }>;

  assert.deepEqual(rows.map((r) => r.event_type), ['app_opened', 'onboarding_completed', 'tool_opened']);
  assert.deepEqual(rows.map((r) => r.timestamp), [
    '2026-11-01T09:00:00Z', '2026-11-02T09:30:00Z', '2026-11-03T10:00:00Z',
  ]);
  // No userB rows leaked in.
  assert.ok(rows.every((r) => r.event_type !== 'app_opened' || r.channel === null));
  // properties returned as the RAW stored string (not parsed), NULL stays null.
  assert.equal(rows[0].properties, '{"days_since_install":0}');
  assert.equal(rows[1].properties, null);
  // Device columns carried through.
  assert.equal(rows[2].platform, 'ios');
  assert.equal(rows[2].app_version, '1.0.6');
});

test('is unfiltered: includes clock-skewed / pre-live rows the metric filters would drop', () => {
  const { db, ins } = seedDb();
  // A plausibly clock-skewed event (timestamp far ahead of received_at). The raw timeline
  // must still show it — this endpoint applies no clock-skew/release exclusion.
  ins.run('x1', 'userX', 's1', 'app_opened', '2099-01-01T00:00:00Z', null, '2026-11-01T00:00:00Z', 'ios', '1.0.6', null);
  ins.run('x2', 'userX', 's1', 'tool_opened', '2026-11-01T00:00:00Z', null, '2026-11-01T00:00:01Z', 'ios', '1.0.6', null);
  const rows = db.prepare(USER_EVENTS_SQL).all('userX', USER_EVENTS_LIMIT) as Array<{ event_type: string }>;
  assert.equal(rows.length, 2);
});

test('cap bounds the number of rows returned', () => {
  const { db, ins } = seedDb();
  const total = USER_EVENTS_LIMIT + 25;
  for (let i = 0; i < total; i++) {
    const ts = new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString();
    ins.run('id' + i, 'userC', 's1', 'app_opened', ts, null, 'r', 'ios', '1.0.6', null);
  }
  const rows = db.prepare(USER_EVENTS_SQL).all('userC', USER_EVENTS_LIMIT) as unknown[];
  assert.equal(rows.length, USER_EVENTS_LIMIT);
});

test('a SQL-injection-style user id is matched literally (bound param), returns nothing', () => {
  const { db, ins } = seedDb();
  ins.run('a1', 'userA', 's1', 'app_opened', '2026-11-01T00:00:00Z', null, 'r', 'ios', '1.0.6', null);
  const evil = "userA' OR '1'='1";
  const rows = db.prepare(USER_EVENTS_SQL).all(evil, USER_EVENTS_LIMIT) as unknown[];
  assert.equal(rows.length, 0); // bound literally, so it does NOT match userA
});

test('returns the country column per row (null when unstamped)', () => {
  const { db, ins } = seedDb();
  ins.run('c1', 'userK', 's1', 'app_opened', '2026-11-01T00:00:00Z', null, 'r', 'ios', '1.0.6', null);
  ins.run('c2', 'userK', 's1', 'tool_opened', '2026-11-02T00:00:00Z', null, 'r', 'ios', '1.0.6', null);
  db.prepare('UPDATE events SET country = ? WHERE id = ?').run('DE', 'c2');
  const rows = db.prepare(USER_EVENTS_SQL).all('userK', USER_EVENTS_LIMIT) as Array<{ country: string | null }>;
  assert.deepEqual(rows.map((r) => r.country), [null, 'DE']);
});
