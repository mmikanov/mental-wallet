/**
 * Users drill-down (GET /details/users): SQL, merge and sort. Pure so it is unit-testable and
 * measurable against Miniflare without importing the Worker.
 *
 * Read-budget design: ONE GROUP BY over the filtered events; the per-user attributes (latest
 * platform/os/country/app_version and the first-ever event's platform/app_version) are
 * per-USER LIMIT 1 index probes on idx_events_user, never per-event-row predicates. A
 * set-based rewrite (extra GROUP BY scans or a window function) measured 2.5x-7x WORSE, see
 * scripts/measure-users-rows-read.mjs and the steering doc.
 *
 * Sorting is server-side only so the cap applies to the TRUE full set: the sort key is looked up
 * in a whitelist (SORT_KEYS) and never reaches SQL. The Worker sorts in JS with the comparators
 * below; the dashboard sorts the already-loaded rows with an equivalent client copy
 * (usersTableClient.ts) when the list is not capped.
 */
import { countryName } from './countryName.ts';
import { compareVersions, metricsExclusionExpr, type ReleaseRow } from './releases.ts';

/** Max rows returned. Above this the dashboard re-requests with sort params (server-side). */
export const USERS_LIMIT = 1000;

export const SORT_KEYS = [
  'user', 'platform', 'os_version', 'country', 'first_version', 'latest_version',
  'event_count', 'first_seen', 'last_seen',
] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = 'asc' | 'desc';
/** Direction a column starts in when first chosen: counts/dates/versions high-first, text A-Z. */
export function defaultDirFor(key: SortKey): SortDir {
  return key === 'event_count' || key === 'first_seen' || key === 'last_seen' || key === 'first_version' || key === 'latest_version'
    ? 'desc' : 'asc';
}
export const DEFAULT_SORT: { key: SortKey; dir: SortDir } = { key: 'event_count', dir: 'desc' };

/** Whitelist-parse ?sort=&dir=. Unknown / missing values fall back to the defaults. */
export function parseUsersSort(sort: string | null | undefined, dir: string | null | undefined): { key: SortKey; dir: SortDir } {
  const key = (SORT_KEYS as readonly string[]).includes(sort ?? '') ? (sort as SortKey) : DEFAULT_SORT.key;
  const d: SortDir = dir === 'asc' || dir === 'desc' ? dir : defaultDirFor(key);
  return { key, dir: d };
}

export interface UserRow {
  anonymous_user_id: string;
  event_count: number;
  first_seen: string;
  last_seen: string;
  platform: string | null;
  os_version: string | null;
  country: string | null;
  /** First-ever event's platform / app_version (join version). */
  first_platform: string | null;
  first_version: string | null;
  /** Latest in-window event's app_version. */
  latest_version: string | null;
}

/**
 * One statement, one row per user. `clause`/`params` is the full global filter (outer WHERE).
 * `lookupClause`/`lookupParams` is the same filter WITHOUT the user-level restrictions (cohort /
 * join-version / resolved-channel IN-subqueries): the correlated lookups are already pinned to
 * one user, so repeating those subqueries per lookup would re-materialise them each time
 * (that is what made cohort=new cost 4x). Lookups are per-USER index probes on
 * idx_events_user (LIMIT 1), not per-event-row predicates.
 *
 * Param order = textual order: 4 latest-value lookups, then the outer WHERE. The two
 * first-event lookups use only the (param-free) read-time exclusions.
 */
export function buildUsersSql(
  clause: string,
  params: string[],
  lookupClause: string,
  lookupParams: string[],
  releases: ReleaseRow[],
) {
  const excl = metricsExclusionExpr(releases, 'f');
  const sql = `
    SELECT
      e.anonymous_user_id,
      COUNT(*) AS event_count,
      MIN(e.timestamp) AS first_seen,
      MAX(e.timestamp) AS last_seen,
      (SELECT p.platform FROM events p
        WHERE p.anonymous_user_id = e.anonymous_user_id AND p.platform IS NOT NULL${lookupClause}
        ORDER BY p.timestamp DESC LIMIT 1) AS platform,
      (SELECT o.os_version FROM events o
        WHERE o.anonymous_user_id = e.anonymous_user_id AND o.os_version IS NOT NULL${lookupClause}
        ORDER BY o.timestamp DESC LIMIT 1) AS os_version,
      (SELECT c.country FROM events c
        WHERE c.anonymous_user_id = e.anonymous_user_id AND c.country IS NOT NULL${lookupClause}
        ORDER BY c.timestamp DESC LIMIT 1) AS country,
      (SELECT v.app_version FROM events v
        WHERE v.anonymous_user_id = e.anonymous_user_id${lookupClause}
        ORDER BY v.timestamp DESC LIMIT 1) AS latest_version,
      (SELECT f.platform FROM events f
        WHERE f.anonymous_user_id = e.anonymous_user_id AND ${excl}
        ORDER BY f.timestamp ASC LIMIT 1) AS first_platform,
      (SELECT f.app_version FROM events f
        WHERE f.anonymous_user_id = e.anonymous_user_id AND ${excl}
        ORDER BY f.timestamp ASC LIMIT 1) AS first_version
    FROM events e
    WHERE 1=1${clause}
    GROUP BY e.anonymous_user_id
  `;
  return { sql, params: [...lookupParams, ...lookupParams, ...lookupParams, ...lookupParams, ...params] };
}

function cmpStr(a: string | null, b: string | null): number {
  return String(a ?? '').toLowerCase().localeCompare(String(b ?? '').toLowerCase());
}

/** Ascending comparator for a key; NULL/empty values are handled by sortUsers (always last). */
function cmpValue(key: SortKey, a: UserRow, b: UserRow): number {
  switch (key) {
    case 'event_count': return a.event_count - b.event_count;
    case 'first_seen': // ISO timestamps: compare as instants, not strings
    case 'last_seen': return new Date(a[key]).getTime() - new Date(b[key]).getTime();
    case 'first_version':
      return compareVersions(a.first_version as string, b.first_version as string) || cmpStr(a.first_platform, b.first_platform);
    case 'latest_version':
      return compareVersions(a.latest_version as string, b.latest_version as string) || cmpStr(a.platform, b.platform);
    case 'country': return cmpStr(countryName(a.country), countryName(b.country));
    case 'user': return cmpStr(a.anonymous_user_id, b.anonymous_user_id);
    default: return cmpStr(a[key], b[key]);
  }
}

function isMissing(key: SortKey, r: UserRow): boolean {
  const v = key === 'user' ? r.anonymous_user_id : r[key];
  return v === null || v === undefined || v === '';
}

/** Stable sort; missing values always sort last in BOTH directions. Returns a new array. */
export function sortUsers(rows: UserRow[], sort: { key: SortKey; dir: SortDir }): UserRow[] {
  const sign = sort.dir === 'asc' ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((x, y) => {
      const mx = isMissing(sort.key, x.r), my = isMissing(sort.key, y.r);
      if (mx || my) return mx && my ? x.i - y.i : mx ? 1 : -1;
      return sign * cmpValue(sort.key, x.r, y.r) || x.i - y.i;
    })
    .map((x) => x.r);
}
