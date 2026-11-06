/**
 * Local measurement (Miniflare D1, never --remote): rows_read + result parity for
 *  - the OLD correlated handleDetailUsers SQL vs the NEW 3-query set-based SQL
 *  - the OLD newUsers KPI query vs the NEW one (channel / join-version aware)
 * and card-vs-drill-down count agreement with and without channel / version filters.
 *
 * Run: node scripts/measure-users-rows-read.mjs
 */
import { Miniflare } from 'miniflare';
import { metricsExclusionExpr } from '../src/releases.ts';
import { buildUserRestrictions, buildNewUsersCount } from '../src/userFilters.ts';
import { buildUsersSql, sortUsers } from '../src/usersQuery.ts';

const mf = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response("ok"); } };', d1Databases: { DB: 'x' } });
const db = await mf.getD1Database('DB');
await db.exec('CREATE TABLE events (id TEXT PRIMARY KEY, anonymous_user_id TEXT NOT NULL, session_id TEXT NOT NULL, event_type TEXT NOT NULL, timestamp TEXT NOT NULL, properties TEXT, received_at TEXT NOT NULL, platform TEXT, os_version TEXT, app_version TEXT, channel TEXT, country TEXT)');
await db.exec('CREATE INDEX idx_events_type_timestamp ON events (event_type, timestamp)');
await db.exec('CREATE INDEX idx_events_user ON events (anonymous_user_id, timestamp)');
await db.exec('CREATE INDEX idx_events_platform ON events (platform)');
await db.exec('CREATE INDEX idx_events_app_version ON events (app_version)');
await db.exec('CREATE INDEX idx_events_channel ON events (channel)');

// 150 users x 20 events. Half join on 1.0.5, half on 1.0.6 and update to 1.0.6 mid-way.
// Every 3rd user is tagged (channel appears only AFTER the install event, like the real app).
const ins = db.prepare('INSERT INTO events (id, anonymous_user_id, session_id, event_type, timestamp, properties, received_at, platform, os_version, app_version, channel, country) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
const base = Date.UTC(2026, 10, 5);
const batch = [];
for (let u = 0; u < 150; u++) {
  for (let e = 0; e < 20; e++) {
    const ts = new Date(base + (u * 20 + e) * 60000).toISOString();
    const plat = u % 2 ? 'ios' : 'android';
    const ver = u < 75 ? (e < 10 ? '1.0.5' : '1.0.6') : '1.0.6';
    const ch = u % 3 === 0 && e > 0 ? 'apps.facebook.com' : null;
    batch.push(ins.bind(`id-${u}-${e}`, `user-${u}`, `s${u}`, e === 0 ? 'app_opened' : 'tool_opened', ts, '{}', ts, plat, '17.0', ver, ch, 'US'));
  }
}
for (let i = 0; i < batch.length; i += 100) await db.batch(batch.slice(i, i + 100));

const releases = [{ platform: 'ios', app_version: '1.0.5', live_at: '2026-11-01T00:00:00Z' }, { platform: 'android', app_version: '1.0.5', live_at: '2026-11-01T00:00:00Z' }];
const from = '2026-11-05T00:00:00.000Z', to = '2026-12-31T00:00:00.000Z';
const run = async (sql, params) => { const s = db.prepare(sql); const r = await (params.length ? s.bind(...params) : s).all(); return r; };
const out = {};

// ---------- OLD handleDetailUsers (copied verbatim) ----------
function oldClause(cohortNew) {
  let clause = ' AND timestamp >= ? AND timestamp < ?'; const params = [from, to];
  if (cohortNew) {
    clause += ` AND anonymous_user_id IN (SELECT anonymous_user_id FROM events WHERE ${metricsExclusionExpr(releases)} GROUP BY anonymous_user_id HAVING 1=1 AND MIN(timestamp) >= ? AND MIN(timestamp) < ?)`;
    params.push(from, to);
  }
  clause += ' AND ' + metricsExclusionExpr(releases);
  return { clause, params };
}
async function oldUsers(cohortNew) {
  const { clause, params } = oldClause(cohortNew);
  const sql = `SELECT e.anonymous_user_id, COUNT(*) as event_count, MIN(e.timestamp) as first_seen, MAX(e.timestamp) as last_seen,
    (SELECT p.platform FROM events p WHERE p.anonymous_user_id = e.anonymous_user_id AND p.platform IS NOT NULL${clause} ORDER BY p.timestamp DESC LIMIT 1) as platform,
    (SELECT o.os_version FROM events o WHERE o.anonymous_user_id = e.anonymous_user_id AND o.os_version IS NOT NULL${clause} ORDER BY o.timestamp DESC LIMIT 1) as os_version,
    (SELECT c.country FROM events c WHERE c.anonymous_user_id = e.anonymous_user_id AND c.country IS NOT NULL${clause} ORDER BY c.timestamp DESC LIMIT 1) as country
    FROM events e WHERE 1=1${clause} GROUP BY e.anonymous_user_id ORDER BY event_count DESC LIMIT 200`;
  return run(sql, [...params, ...params, ...params, ...params]);
}

// ---------- NEW ----------
async function newUsers(opts) {
  const restr = buildUserRestrictions('anonymous_user_id', { excludedIds: [], releases, fromDate: from, toDate: to, windowed: opts.cohortNew, joinVersion: opts.jv ?? null, channel: opts.cohortNew ? opts.channel ?? null : null });
  let clause = ' AND timestamp >= ? AND timestamp < ?'; const params = [from, to];
  clause += restr.sql; params.push(...restr.params);
  // per-event channel only in active mode
  if (!opts.cohortNew && opts.channel) { clause += opts.channel === 'organic' ? ' AND channel IS NULL' : ' AND channel = ?'; if (opts.channel !== 'organic') params.push(opts.channel); }
  clause += ' AND ' + metricsExclusionExpr(releases);
  const lookup = ' AND timestamp >= ? AND timestamp < ? AND ' + metricsExclusionExpr(releases);
  const q = buildUsersSql(clause, params, lookup, [from, to], releases);
  const r = await run(q.sql, q.params);
  return { rows: sortUsers(r.results, { key: 'event_count', dir: 'desc' }), rows_read: r.meta.rows_read };
}

for (const cohortNew of [false, true]) {
  const o = await oldUsers(cohortNew);
  const n = await newUsers({ cohortNew });
  out[`users cohort=${cohortNew ? 'new' : 'active'}`] = { old_rows_read: o.meta.rows_read, new_rows_read: n.rows_read, old_users: o.results.length, new_users: n.rows.length };
}

// ---------- newUsers KPI: old vs new ----------
const oldKpi = `SELECT COUNT(*) as count FROM (SELECT anonymous_user_id FROM events WHERE ${metricsExclusionExpr(releases)} GROUP BY anonymous_user_id HAVING 1=1 AND MIN(timestamp) >= ? AND MIN(timestamp) < ?)`;
const ok = await run(oldKpi, [from, to]);
out['newUsers KPI old (no channel)'] = { count: ok.results[0].count, rows_read: ok.meta.rows_read };
const cases = [
  ['no filters', {}],
  ['channel=apps.facebook.com', { channel: 'apps.facebook.com' }],
  ['channel=organic', { channel: 'organic' }],
  ['joinVersion=ios:1.0.5', { jv: { platform: 'ios', version: '1.0.5' } }],
  ['joinVersion=android:1.0.6 + channel=apps.facebook.com', { jv: { platform: 'android', version: '1.0.6' }, channel: 'apps.facebook.com' }],
];
out.consistency = {};
for (const [name, o] of cases) {
  const k = buildNewUsersCount({ excludedIds: [], releases, fromDate: from, toDate: to, joinVersion: o.jv ?? null, channel: o.channel ?? null });
  const kr = await run(k.sql, k.params);
  const list = await newUsers({ cohortNew: true, ...o });
  // Other KPI card using the same cohort=new restriction path (Active Unique Users under Users=New).
  const restr = buildUserRestrictions('anonymous_user_id', { excludedIds: [], releases, fromDate: from, toDate: to, windowed: true, joinVersion: o.jv ?? null, channel: o.channel ?? null });
  const uq = await run(`SELECT COUNT(DISTINCT anonymous_user_id) AS c FROM events WHERE timestamp >= ? AND timestamp < ?${restr.sql} AND ${metricsExclusionExpr(releases)}`, [from, to, ...restr.params]);
  out.consistency[name] = { newUsers_card: kr.results[0].count, newUsers_card_rows_read: kr.meta.rows_read, drilldown_rows: list.rows.length, uniqueUsers_under_new: uq.results[0].c, drilldown_rows_read: list.rows_read };
}
// Join-version cohort in ACTIVE mode (not windowed on first event)
const act = await newUsers({ cohortNew: false, jv: { platform: 'ios', version: '1.0.5' } });
out['active + joinVersion=ios:1.0.5'] = { users: act.rows.length, sample: act.rows.slice(0, 2).map((r) => [r.first_platform, r.first_version, r.latest_version]) };
console.log(JSON.stringify(out, null, 2));
await mf.dispose();
