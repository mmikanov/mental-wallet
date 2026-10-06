/**
 * Unit tests for the pure channel-attribution helpers.
 *
 * Runs with Node's built-in test runner (no extra deps, no D1, no env):
 *   node --test --experimental-strip-types src/channel.test.ts
 * (see package.json "test" script).
 *
 * SQL-level wiring (that the channel predicate actually scopes queries, untagged→organic,
 * composition with from/to + cohort) is NOT provable here — it is verified against LOCAL
 * D1 and recorded in the FEAT findings. These tests cover only the pure helpers.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractChannel,
  buildChannelClause,
  summarizeChannelBreakdown,
  type ChannelInstallRow,
  type ChannelActivationRow,
  type ChannelCohortUserRow,
} from './channel.ts';
import { computeCohortRetention, type CohortUserRow } from './retention.ts';

// Fixed "today" so cohort age math is deterministic (mirrors retention.test.ts).
const TODAY = '2026-02-10T12:00:00.000Z';

/** Build a per-user+channel cohort row installed `ageDays` ago with a given max_dsi. */
function cohortUser(
  id: string,
  channel: string | null,
  ageDays: number,
  maxDsi: number
): ChannelCohortUserRow {
  const todayMid = Date.UTC(2026, 1, 10); // 2026-02-10 UTC midnight
  const firstMs = todayMid - ageDays * 24 * 60 * 60 * 1000;
  return {
    anonymous_user_id: id,
    channel,
    first_open_ts: new Date(firstMs).toISOString(),
    max_dsi: maxDsi,
    opens: 1,
  };
}

// --- extractChannel ---

test('extractChannel returns the string when properties.channel is a non-empty string', () => {
  assert.equal(extractChannel({ properties: { channel: 'reddit' } }), 'reddit');
});

test('extractChannel returns null when properties.channel is absent', () => {
  assert.equal(extractChannel({ properties: { foo: 'bar' } }), null);
});

test('extractChannel returns null when properties is missing entirely', () => {
  assert.equal(extractChannel({}), null);
});

test('extractChannel returns null for an empty string channel', () => {
  assert.equal(extractChannel({ properties: { channel: '' } }), null);
});

test('extractChannel returns null for a non-string channel', () => {
  assert.equal(extractChannel({ properties: { channel: 123 as unknown as string } }), null);
});

// --- buildChannelClause ---

test('buildChannelClause: absent/null => no predicate', () => {
  assert.deepEqual(buildChannelClause(null), { sql: '', params: [] });
  assert.deepEqual(buildChannelClause(undefined), { sql: '', params: [] });
  assert.deepEqual(buildChannelClause(''), { sql: '', params: [] });
});

test("buildChannelClause: 'all' => no predicate", () => {
  assert.deepEqual(buildChannelClause('all'), { sql: '', params: [] });
});

test("buildChannelClause: 'organic' => IS NULL, no params", () => {
  assert.deepEqual(buildChannelClause('organic'), { sql: ' AND channel IS NULL', params: [] });
});

test("buildChannelClause: a label => '= ?' with the label bound", () => {
  assert.deepEqual(buildChannelClause('reddit'), { sql: ' AND channel = ?', params: ['reddit'] });
});

test('buildChannelClause: custom column is used verbatim', () => {
  assert.deepEqual(buildChannelClause('reddit', 'tc.channel'), {
    sql: ' AND tc.channel = ?',
    params: ['reddit'],
  });
  assert.deepEqual(buildChannelClause('organic', 'events.channel'), {
    sql: ' AND events.channel IS NULL',
    params: [],
  });
});

// --- summarizeChannelBreakdown ---

test('summarizeChannelBreakdown separates channels and buckets untagged under organic', () => {
  const installRows: ChannelInstallRow[] = [
    { channel: 'reddit', installs: 25, walletAdded: 10 },
    { channel: null, installs: 30, walletAdded: 5 },
  ];
  const activationRows: ChannelActivationRow[] = [
    { channel: 'reddit', num: 10, den: 25 },
    { channel: null, num: 12, den: 30 },
  ];
  const cohortRows: ChannelCohortUserRow[] = [];
  const result = summarizeChannelBreakdown(installRows, activationRows, cohortRows, TODAY);

  const reddit = result.find((r) => r.channel === 'reddit');
  const organic = result.find((r) => r.channel === 'organic');
  assert.ok(reddit, 'reddit entry present');
  assert.ok(organic, 'organic entry present');
  assert.equal(reddit!.installs, 25);
  assert.equal(reddit!.walletGrowth.count, 10);
  assert.equal(organic!.installs, 30);
  assert.equal(organic!.walletGrowth.count, 5);
  // No null channel label leaks through.
  assert.equal(result.find((r) => r.channel === null as unknown as string), undefined);
});

test('summarizeChannelBreakdown: a too-small channel returns count + rate:null + smallSample:true', () => {
  const installRows: ChannelInstallRow[] = [{ channel: 'linkedin', installs: 5, walletAdded: 1 }];
  const activationRows: ChannelActivationRow[] = [{ channel: 'linkedin', num: 3, den: 5 }];
  const result = summarizeChannelBreakdown(installRows, activationRows, [], TODAY, 20);

  const linkedin = result.find((r) => r.channel === 'linkedin');
  assert.ok(linkedin);
  assert.equal(linkedin!.installs, 5);
  assert.equal(linkedin!.activation.num, 3);
  assert.equal(linkedin!.activation.den, 5);
  assert.equal(linkedin!.activation.rate, null);
  assert.equal(linkedin!.smallSample, true);
});

test('summarizeChannelBreakdown: an at/above-minSample channel returns a real rate', () => {
  const installRows: ChannelInstallRow[] = [{ channel: 'reddit', installs: 40, walletAdded: 0 }];
  const activationRows: ChannelActivationRow[] = [{ channel: 'reddit', num: 10, den: 40 }];
  const result = summarizeChannelBreakdown(installRows, activationRows, [], TODAY, 20);

  const reddit = result.find((r) => r.channel === 'reddit');
  assert.ok(reddit);
  assert.equal(reddit!.smallSample, false);
  assert.equal(reddit!.activation.rate, 25); // 10/40 * 100
});

test('summarizeChannelBreakdown: cohort-retention column equals computeCohortRetention for that channel rows', () => {
  // reddit: two users eligible+retained at D7; organic: one lapsed user.
  const redditRows = [cohortUser('r1', 'reddit', 10, 7), cohortUser('r2', 'reddit', 10, 8)];
  const organicRows = [cohortUser('o1', null, 10, 0)];
  const cohortRows: ChannelCohortUserRow[] = [...redditRows, ...organicRows];

  const installRows: ChannelInstallRow[] = [
    { channel: 'reddit', installs: 2, walletAdded: 0 },
    { channel: null, installs: 1, walletAdded: 0 },
  ];
  const result = summarizeChannelBreakdown(installRows, [], cohortRows, TODAY);

  const reddit = result.find((r) => r.channel === 'reddit')!;
  const organic = result.find((r) => r.channel === 'organic')!;

  const expectedReddit = computeCohortRetention(redditRows as CohortUserRow[], TODAY, [7, 30]);
  const expectedOrganic = computeCohortRetention(organicRows as CohortUserRow[], TODAY, [7, 30]);

  assert.deepEqual(reddit.retention, expectedReddit);
  assert.deepEqual(organic.retention, expectedOrganic);
  assert.equal(reddit.retention[7].pct, 100);
  assert.equal(organic.retention[7].pct, 0);
});

test('summarizeChannelBreakdown always includes an organic bucket even with no untagged rows', () => {
  const result = summarizeChannelBreakdown(
    [{ channel: 'reddit', installs: 3, walletAdded: 0 }],
    [],
    [],
    TODAY
  );
  assert.ok(result.find((r) => r.channel === 'organic'), 'organic bucket present');
});
