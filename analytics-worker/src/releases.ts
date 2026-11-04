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

/**
 * Release predicate as a bare expression (no leading AND, no bind params).
 *
 * Shape: keep the row if any of platform / app_version / received_at is NULL, or if its
 * (platform, app_version) is NOT in the set of releases whose live_at is later than the
 * event's received_at. The row-value is evaluated in the OUTER scope on purpose: an
 * unqualified `platform` inside a subquery over version_releases would bind to the
 * release row, not the event row. `received_at` is not a version_releases column, so it
 * correctly resolves to the event row (qualified when an alias is given).
 */
export function releaseExclusionExpr(alias?: string): string {
  const p = col(alias, 'platform');
  const v = col(alias, 'app_version');
  const r = col(alias, 'received_at');
  return `(${p} IS NULL OR ${v} IS NULL OR ${r} IS NULL OR (${p}, ${v}) NOT IN (` +
    `SELECT vr.platform, vr.app_version FROM version_releases vr ` +
    `WHERE julianday(${r}) < julianday(vr.live_at)))`;
}

/** `AND <release predicate>` fragment for appending to an existing WHERE. */
export function releaseExclusionSql(alias?: string): string {
  return ` AND ${releaseExclusionExpr(alias)}`;
}

/**
 * Combined metrics exclusion (clock-skew + pre-live release), bare expression. Use this
 * everywhere the skew predicate used to be so the two can never drift apart.
 */
export function metricsExclusionExpr(alias?: string): string {
  return `${skewExclusionExpr(alias)} AND ${releaseExclusionExpr(alias)}`;
}

/** `AND <combined>` fragment. */
export function metricsExclusionSql(alias?: string): string {
  return ` AND ${metricsExclusionExpr(alias)}`;
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
