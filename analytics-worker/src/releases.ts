/**
 * Version release tracking: pure helpers (no D1, no env).
 *
 * `version_releases` records when each (platform, app_version) went live. Metrics ignore
 * events RECEIVED before that moment (store review / tester traffic). No row => included.
 * Read-time only; nothing is deleted.
 */

/** Prefix a column with an optional table alias ('' => unqualified). */
function col(alias: string | undefined, name: string): string {
  return alias ? `${alias}.${name}` : name;
}

/**
 * Clock-skew predicate (bare expression, no leading AND, no bind params).
 * NULL received_at is kept.
 */
export function skewExclusionExpr(alias?: string): string {
  const r = col(alias, 'received_at');
  const t = col(alias, 'timestamp');
  return `(${r} IS NULL OR julianday(${t}) - julianday(${r}) <= 1)`;
}

// --- Release predicate -------------------------------------------------------------
//
// The old predicate was a correlated `(platform, app_version) NOT IN (SELECT ... FROM
// version_releases ...)` that D1 re-evaluated per event row, multiplying rows_read by the
// size of version_releases (6k -> 46-84k reads per query). The Worker now reads the ~12
// release rows ONCE (cached per isolate) and emits LITERAL per-release conditions, so the
// event scan never touches version_releases. Still no bind params.

const PLATFORM_RE = /^[a-z]+$/;
const VERSION_RE = /^[0-9]+(\.[0-9]+)*$/;
// ISO-8601 UTC / offset timestamp, e.g. 2026-11-04T14:30:00Z or ...:00.000+00:00
const LIVE_AT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

/** True when a release row is safe to inline as SQL literals (strict whitelist). */
export function isSafeReleaseRow(r: ReleaseRow): boolean {
  return (
    typeof r?.platform === 'string' && PLATFORM_RE.test(r.platform) &&
    typeof r?.app_version === 'string' && VERSION_RE.test(r.app_version) &&
    typeof r?.live_at === 'string' && LIVE_AT_RE.test(r.live_at)
  );
}

/**
 * Release predicate as a bare expression (no leading AND, no bind params).
 *
 * One condition per VALID release row, AND-ed together; no (valid) rows => `1=1`. Values
 * are whitelist-validated (rows failing the regexes are skipped), so inlining is safe.
 * The COALESCE matters: with a NULL platform/app_version/received_at the inner comparison
 * is NULL, and a bare `NOT NULL` would DROP the row. COALESCE(...,0) keeps it, matching the
 * old semantics (NULLs always included, no row => included).
 */
export function releaseExclusionExpr(releases: ReleaseRow[], alias?: string): string {
  const p = col(alias, 'platform');
  const v = col(alias, 'app_version');
  const r = col(alias, 'received_at');
  const conds = releases.filter(isSafeReleaseRow).map(
    (x) =>
      `NOT COALESCE(${p} = '${x.platform}' AND ${v} = '${x.app_version}' AND ${r} IS NOT NULL ` +
      `AND julianday(${r}) < julianday('${x.live_at}'), 0)`,
  );
  return conds.length > 0 ? `(${conds.join(' AND ')})` : '1=1';
}

/** `AND <release predicate>` fragment for appending to an existing WHERE. */
export function releaseExclusionSql(releases: ReleaseRow[], alias?: string): string {
  return ` AND ${releaseExclusionExpr(releases, alias)}`;
}

/**
 * Combined metrics exclusion (clock-skew + pre-live release), bare expression. Use this
 * everywhere the skew predicate used to be so the two can never drift apart.
 */
export function metricsExclusionExpr(releases: ReleaseRow[], alias?: string): string {
  return `${skewExclusionExpr(alias)} AND ${releaseExclusionExpr(releases, alias)}`;
}

/** `AND <combined>` fragment. */
export function metricsExclusionSql(releases: ReleaseRow[], alias?: string): string {
  return ` AND ${metricsExclusionExpr(releases, alias)}`;
}

// --- Per-isolate release cache -------------------------------------------------------

export const RELEASES_CACHE_TTL_MS = 60_000;
let releasesCache: { rows: ReleaseRow[]; at: number } | null = null;

export function invalidateReleasesCache(): void {
  releasesCache = null;
}

/** Minimal D1 surface so this stays testable without Workers types. */
export interface ReleasesDb {
  prepare(sql: string): { all<T>(): Promise<{ results?: T[] }> };
}

/** Read version_releases once (~12 rows), cached in-isolate for 60s. */
export async function loadReleases(db: ReleasesDb, now: number = Date.now()): Promise<ReleaseRow[]> {
  if (releasesCache && now - releasesCache.at < RELEASES_CACHE_TTL_MS) return releasesCache.rows;
  const res = await db.prepare('SELECT platform, app_version, live_at, note FROM version_releases').all<ReleaseRow>();
  const rows = (res.results || []) as ReleaseRow[];
  releasesCache = { rows, at: now };
  return rows;
}

/** Numeric dotted compare. Returns <0, 0, >0 (ascending). Non-numeric parts count as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export interface SeenVersionRow {
  platform: string;
  app_version: string;
  first_seen: string | null;
  last_seen: string | null;
  users: number;
  events: number;
  /** Events received before live_at (0 when no release row). */
  hidden_pre_live_events: number;
}

export interface ReleaseRow {
  platform: string;
  app_version: string;
  live_at: string;
  note?: string | null;
}

/**
 * Sentinel `live_at` for a version number that was skipped / never shipped publicly (e.g. a
 * build number consumed only to keep iOS and Android versions in sync). Because it is far in
 * the future, the release predicate hides ALL events for that (platform, version) — they are
 * test/review traffic by definition. Displayed as "Never released", not "Scheduled".
 */
export const NEVER_RELEASED_AT = '9999-12-31T00:00:00Z';

export function isNeverReleased(liveAt: string | null | undefined): boolean {
  return !!liveAt && liveAt.startsWith('9999');
}

export type ReleaseStatus = 'live' | 'scheduled' | 'not_recorded' | 'never_released';

export interface ReleaseSummaryRow {
  platform: string;
  app_version: string;
  live_at: string | null;
  status: ReleaseStatus;
  note: string | null;
  first_seen: string | null;
  last_seen: string | null;
  users: number;
  events: number;
  hidden_pre_live_events: number;
}

/** Merge seen-in-events versions with recorded releases; newest version first, then platform. */
export function summarizeReleases(
  seen: SeenVersionRow[],
  releases: ReleaseRow[],
  nowISO: string,
): ReleaseSummaryRow[] {
  const key = (p: string, v: string) => `${p}\u0000${v}`;
  const relByKey = new Map<string, ReleaseRow>();
  for (const r of releases) relByKey.set(key(r.platform, r.app_version), r);
  const rows = new Map<string, ReleaseSummaryRow>();
  const nowMs = new Date(nowISO).getTime();

  const build = (
    platform: string,
    app_version: string,
    s: SeenVersionRow | undefined,
  ): ReleaseSummaryRow => {
    const rel = relByKey.get(key(platform, app_version));
    let status: ReleaseStatus = 'not_recorded';
    if (rel) {
      status = isNeverReleased(rel.live_at)
        ? 'never_released'
        : new Date(rel.live_at).getTime() <= nowMs
          ? 'live'
          : 'scheduled';
    }
    return {
      platform,
      app_version,
      live_at: rel ? rel.live_at : null,
      status,
      note: rel?.note ?? null,
      first_seen: s?.first_seen ?? null,
      last_seen: s?.last_seen ?? null,
      users: Number(s?.users ?? 0),
      events: Number(s?.events ?? 0),
      hidden_pre_live_events: rel ? Number(s?.hidden_pre_live_events ?? 0) : 0,
    };
  };

  for (const s of seen) rows.set(key(s.platform, s.app_version), build(s.platform, s.app_version, s));
  for (const r of releases) {
    const k = key(r.platform, r.app_version);
    if (!rows.has(k)) rows.set(k, build(r.platform, r.app_version, undefined));
  }

  return Array.from(rows.values()).sort(
    (a, b) => compareVersions(b.app_version, a.app_version) || a.platform.localeCompare(b.platform),
  );
}
