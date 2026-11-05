/**
 * One-off local measurement: rows_read for the per-user timeline query
 * (GET /details/user-events) against a seeded Miniflare D1 (~3k events).
 *
 * Follows the steering rule: measure meta.rows_read on LOCAL Miniflare D1, never --remote.
 * Run: node scripts/measure-user-events-rows-read.mjs
 */
import { Miniflare } from 'miniflare';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(join(__dirname, '..', 'src', 'userEvents.ts'), 'utf8')
  .match(/USER_EVENTS_SQL = `([\s\S]*?)`/)[1];
const LIMIT = Number(
  readFileSync(join(__dirname, '..', 'src', 'userEvents.ts'), 'utf8')
    .match(/USER_EVENTS_LIMIT = (\d+)/)[1]
);

const mf = new Miniflare({
  modules: true,
  script: 'export default { fetch() { return new Response("ok"); } };',
  d1Databases: { DB: 'analytics-db' },
});

const db = await mf.getD1Database('DB');

// Schema (matches migrations 0001/0002/0003/0005).
await db.exec(
  'CREATE TABLE events (id TEXT PRIMARY KEY, anonymous_user_id TEXT NOT NULL, session_id TEXT NOT NULL, event_type TEXT NOT NULL, timestamp TEXT NOT NULL, properties TEXT, received_at TEXT NOT NULL, platform TEXT, os_version TEXT, app_version TEXT, channel TEXT, country TEXT)'
);
await db.exec('CREATE INDEX idx_events_type_timestamp ON events (event_type, timestamp)');
await db.exec('CREATE INDEX idx_events_user ON events (anonymous_user_id, timestamp)');

// Seed ~3000 events across 150 users (20 events each), as the steering suggests.
const USERS = 150;
const PER_USER = 20;
const TOTAL = USERS * PER_USER;
const insert = db.prepare(
  'INSERT INTO events (id, anonymous_user_id, session_id, event_type, timestamp, properties, received_at, platform, app_version, channel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
const base = Date.UTC(2026, 9, 1);
const batch = [];
for (let u = 0; u < USERS; u++) {
  for (let e = 0; e < PER_USER; e++) {
    const ts = new Date(base + (u * PER_USER + e) * 60000).toISOString();
    batch.push(
      insert.bind(
        `id-${u}-${e}`,
        `user-${u}`,
        `sess-${u}`,
        e === 0 ? 'app_opened' : 'tool_opened',
        ts,
        JSON.stringify({ i: e }),
        ts,
        u % 2 ? 'ios' : 'android',
        '1.0.6',
        u % 3 ? null : 'tiktok'
      )
    );
  }
}
for (let i = 0; i < batch.length; i += 100) await db.batch(batch.slice(i, i + 100));

// Measure: single user's timeline (the indexed per-user lookup).
const target = 'user-42';
const res = await db.prepare(SQL).bind(target, LIMIT).all();
console.log(JSON.stringify({
  seeded_total_events: TOTAL,
  users: USERS,
  per_user: PER_USER,
  target_user: target,
  rows_returned: res.results.length,
  rows_read: res.meta?.rows_read,
}, null, 2));

// Sanity: a heavy user with > a few events still only reads their own rows + index walk.
await mf.dispose();
