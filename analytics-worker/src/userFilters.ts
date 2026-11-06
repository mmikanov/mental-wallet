/**
 * User-level cohort restrictions shared by /kpis and every /details/* endpoint.
 *
 * Pure (no D1 / env) so the exact SQL + param order can be unit-tested and measured against
 * Miniflare. Three user-level ideas live here:
 *
 *  1. Acquisition cohort ("new"): users whose FIRST-EVER counted event falls in [from, to).
 *  2. Join-version cohort: users whose FIRST-EVER counted event was on platform P, version V.
 *     (Global "Joined in version" filter. Works with or without the acquisition window.)
 *  3. Resolved channel: a user's channel = MAX(channel) over ALL their counted events (NULL
 *     only when every row is NULL => organic). Same attribution as the Channel Breakdown
 *     (see 904fbe4): the install event itself is untagged, the tag appears on later events,
 *     so a per-EVENT channel predicate would miss the install.
 *
 * "Counted event" = passes the shared read-time exclusions (metricsExclusionExpr) and is not
 * from an excluded internal user, so first-touch is a trustworthy timestamp.
 *
 * SQLite note: a query with exactly ONE min()/max() aggregate takes bare columns (platform,
 * app_version) from the row holding that min/max. The first-event subquery relies on that with
 * MIN(timestamp) as its only aggregate, so the channel (MAX) check is a SEPARATE subquery.
 */
import { metricsExclusionExpr, type ReleaseRow } from './releases.ts';

export interface JoinVersion {
  platform: string;
  version: string;
}

const JOIN_VERSION_RE = /^([a-z]+):([0-9]+(?:\.[0-9]+)*)$/;

/** Parse `?joinVersion=ios:1.0.5`. Anything not matching the strict shape => null (ignored). */
export function parseJoinVersion(raw: string | null | undefined): JoinVersion | null {
  if (!raw) return null;
  const m = JOIN_VERSION_RE.exec(raw);
  return m ? { platform: m[1], version: m[2] } : null;
}

export interface RestrictionInput {
  excludedIds: string[];
  releases: ReleaseRow[];
  fromDate: string | null;
  toDate: string | null;
  /** Acquisition window on the first-ever event (from/to). */
  windowed: boolean;
  joinVersion: JoinVersion | null;
  /** User-level resolved channel: null/''/'all' = none, 'organic' = no channel anywhere. */
  channel: string | null;
}

interface Part {
  sql: string;
  params: string[];
}

/** `FROM events [WHERE id NOT IN (...)] AND <exclusions>` prefix shared by both subqueries. */
function baseFrom(excludedIds: string[], releases: ReleaseRow[]): Part {
  const params: string[] = [];
  let sql = 'SELECT anonymous_user_id FROM events';
  if (excludedIds.length > 0) {
    sql += ` WHERE anonymous_user_id NOT IN (${excludedIds.map(() => '?').join(', ')})`;
    params.push(...excludedIds);
  }
  sql += (excludedIds.length > 0 ? ' AND ' : ' WHERE ') + metricsExclusionExpr(releases);
  sql += ' GROUP BY anonymous_user_id';
  return { sql, params };
}

/** First-event subquery: acquisition window and/or join version. null when neither applies. */
export function buildFirstEventSub(i: RestrictionInput): Part | null {
  const useWindow = i.windowed && (i.fromDate || i.toDate);
  if (!i.windowed && !i.joinVersion) return null;
  const base = baseFrom(i.excludedIds, i.releases);
  let sql = base.sql + ' HAVING MIN(timestamp) IS NOT NULL';
  const params = [...base.params];
  if (useWindow && i.fromDate) { sql += ' AND MIN(timestamp) >= ?'; params.push(i.fromDate); }
  if (useWindow && i.toDate) { sql += ' AND MIN(timestamp) < ?'; params.push(i.toDate); }
  if (i.joinVersion) {
    sql += ' AND platform = ? AND app_version = ?';
    params.push(i.joinVersion.platform, i.joinVersion.version);
  }
  return { sql, params };
}

/** Resolved-channel subquery. null when no user-level channel scope applies. */
export function buildResolvedChannelSub(i: RestrictionInput): Part | null {
  if (!i.channel || i.channel === 'all') return null;
  const base = baseFrom(i.excludedIds, i.releases);
  if (i.channel === 'organic') return { sql: base.sql + ' HAVING MAX(channel) IS NULL', params: base.params };
  return { sql: base.sql + ' HAVING MAX(channel) = ?', params: [...base.params, i.channel] };
}

/**
 * ` AND <col> IN (first-event sub) AND <col> IN (channel sub)` with params in textual order.
 * Empty when nothing applies.
 */
export function buildUserRestrictions(col: string, i: RestrictionInput): Part {
  const first = buildFirstEventSub(i);
  const ch = buildResolvedChannelSub(i);
  let sql = '';
  const params: string[] = [];
  if (first) { sql += ` AND ${col} IN (${first.sql})`; params.push(...first.params); }
  if (ch) { sql += ` AND ${col} IN (${ch.sql})`; params.push(...ch.params); }
  return { sql, params };
}

/**
 * newUsers KPI: count of the acquisition cohort (always windowed; ignores the Users toggle),
 * scoped by the resolved channel and join version. Same subqueries as the cohort=new
 * restriction, so the card equals the row count of the drill-down opened from it.
 */
export function buildNewUsersCount(i: Omit<RestrictionInput, 'windowed'>): Part {
  const full: RestrictionInput = { ...i, windowed: true };
  const first = buildFirstEventSub(full)!;
  const ch = buildResolvedChannelSub(full);
  let sql = `SELECT COUNT(*) as count FROM (${first.sql})`;
  const params = [...first.params];
  if (ch) { sql += ` WHERE anonymous_user_id IN (${ch.sql})`; params.push(...ch.params); }
  return { sql, params };
}
