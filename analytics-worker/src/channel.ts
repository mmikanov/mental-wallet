/**
 * Pure channel-attribution helpers.
 *
 * Kept in their own module (like retention.ts) so they can be unit-tested directly with
 * the Node built-in test runner — importing from index.ts is not possible under that
 * runner because index.ts transitively imports the dashboard HTML string.
 *
 * These functions are pure (no D1, no network): the SQL handlers in index.ts call them.
 * SQL-level wiring (that the predicate scopes queries, untagged→organic, composition with
 * from/to + cohort) is verified against LOCAL D1, not in the unit runner.
 */

import { computeCohortRetention, type CohortUserRow, type CohortRetention } from './retention.ts';

/**
 * Extract the acquisition channel from an event's properties for promotion to the
 * dedicated `channel` column at ingest. The channel lives inside `properties.channel`
 * (and stays there — the properties JSON is unchanged). Returns the non-empty string, or
 * null when properties is missing, channel is absent, empty, or non-string.
 * null => organic/untagged.
 */
export function extractChannel(event: { properties?: Record<string, unknown> }): string | null {
  const channel = event.properties?.channel;
  if (typeof channel === 'string' && channel.length > 0) return channel;
  return null;
}

/**
 * Build the channel predicate shared by handleKpis and buildDetailFilter.
 *   null / '' / 'all' => no predicate (all channels)
 *   'organic'         => AND <col> IS NULL (untagged)
 *   any other label   => AND <col> = ? (bound param = label)
 * `col` lets table-qualified callers pass e.g. 'events.channel' / 'tc.channel'.
 */
export function buildChannelClause(
  channelParam: string | null | undefined,
  col = 'channel'
): { sql: string; params: string[] } {
  if (!channelParam || channelParam === 'all') return { sql: '', params: [] };
  if (channelParam === 'organic') return { sql: ` AND ${col} IS NULL`, params: [] };
  return { sql: ` AND ${col} = ?`, params: [channelParam] };
}

/**
 * Raw per-channel install + wallet-growth aggregate row (channel null => organic).
 * Produced by a GROUP BY channel query over the install (new-user) + wallet-add signals.
 */
export interface ChannelInstallRow {
  channel: string | null;
  /** New installs attributed to this channel. */
  installs: number;
  /** Distinct users who added/created a tool, attributed to this channel. */
  walletAdded: number;
}

/** Raw per-channel activation aggregate (num = activated users, den = installs). */
export interface ChannelActivationRow {
  channel: string | null;
  num: number;
  den: number;
}

/** Per-user cohort-retention row extended with the user's channel bucket. */
export interface ChannelCohortUserRow extends CohortUserRow {
  channel: string | null;
}

/** One channel's summarized breakdown entry. */
export interface ChannelBreakdownEntry {
  channel: string;
  installs: number;
  activation: { rate: number | null; num: number; den: number };
  walletGrowth: { count: number };
  retention: CohortRetention;
  smallSample: boolean;
}

/** The reserved bucket label for untagged (channel IS NULL) traffic. */
export const ORGANIC = 'organic';

/**
 * Summarize the per-channel breakdown from raw GROUP BY channel aggregates + per-user
 * cohort rows. Untagged rows (channel === null) are bucketed under 'organic'. For each
 * channel compute installs, activation (rate + raw num/den), wallet growth count, and
 * cohort retention via computeCohortRetention over that channel's rows.
 *
 * Small-sample suppression (mirrors computeCohortRetention's pct:null n/a convention):
 * when a channel's activation denominator < minSample, the rate is returned as null and
 * smallSample:true, while the raw count is still exposed.
 */
export function summarizeChannelBreakdown(
  installRows: ChannelInstallRow[],
  activationRows: ChannelActivationRow[],
  cohortRows: ChannelCohortUserRow[],
  nowISO: string,
  minSample = 20
): ChannelBreakdownEntry[] {
  const bucket = (c: string | null): string => (c == null ? ORGANIC : c);

  // Collect every distinct channel bucket seen across all inputs, always including organic.
  const labels = new Set<string>([ORGANIC]);
  for (const r of installRows) labels.add(bucket(r.channel));
  for (const r of activationRows) labels.add(bucket(r.channel));
  for (const r of cohortRows) labels.add(bucket(r.channel));

  const installByLabel = new Map<string, number>();
  const walletByLabel = new Map<string, number>();
  for (const r of installRows) {
    const l = bucket(r.channel);
    installByLabel.set(l, (installByLabel.get(l) || 0) + r.installs);
    walletByLabel.set(l, (walletByLabel.get(l) || 0) + r.walletAdded);
  }
  const activationByLabel = new Map<string, { num: number; den: number }>();
  for (const r of activationRows) {
    const l = bucket(r.channel);
    const prev = activationByLabel.get(l) || { num: 0, den: 0 };
    activationByLabel.set(l, { num: prev.num + r.num, den: prev.den + r.den });
  }
  const cohortByLabel = new Map<string, CohortUserRow[]>();
  for (const r of cohortRows) {
    const l = bucket(r.channel);
    const arr = cohortByLabel.get(l) || [];
    arr.push(r);
    cohortByLabel.set(l, arr);
  }

  const entries: ChannelBreakdownEntry[] = [];
  for (const label of labels) {
    const installs = installByLabel.get(label) || 0;
    const act = activationByLabel.get(label) || { num: 0, den: 0 };
    const smallSample = act.den < minSample;
    const rate = smallSample ? null : act.den > 0 ? (act.num / act.den) * 100 : null;
    const retention = computeCohortRetention(cohortByLabel.get(label) || [], nowISO, [7, 30]);
    entries.push({
      channel: label,
      installs,
      activation: { rate, num: act.num, den: act.den },
      walletGrowth: { count: walletByLabel.get(label) || 0 },
      retention,
      smallSample,
    });
  }
  // Stable ordering: biggest install counts first, organic last on ties for readability.
  entries.sort((a, b) => b.installs - a.installs || (a.channel === ORGANIC ? 1 : -1));
  return entries;
}
