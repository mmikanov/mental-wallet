/**
 * Unit tests for the pure cohort-retention helper.
 *
 * Runs with Node's built-in test runner (no extra deps):
 *   node --test --experimental-strip-types src/retention.test.ts
 * (see package.json "test" script).
 *
 * Requirements: 4.1, 4.2
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCohortRetention, type CohortUserRow } from './retention.ts';

// Fixed "today" so age math is deterministic.
const TODAY = '2026-02-10T12:00:00.000Z';

/** Helper to build a user row installed `ageDays` ago with a given max days_since_install. */
function user(id: string, ageDays: number, maxDsi: number, opens = 1): CohortUserRow {
  const todayMid = Date.UTC(2026, 1, 10); // 2026-02-10 UTC midnight
  const firstMs = todayMid - ageDays * 24 * 60 * 60 * 1000;
  return {
    anonymous_user_id: id,
    first_open_ts: new Date(firstMs).toISOString(),
    max_dsi: maxDsi,
    opens,
  };
}

test('two users installed 40d ago, both retained at D30 -> 100%, cohort 2', () => {
  const rows = [user('a', 40, 30), user('b', 40, 35)];
  const r = computeCohortRetention(rows, TODAY, [7, 30]);
  assert.equal(r[30].pct, 100);
  assert.equal(r[30].cohort, 2);
  // Both are also eligible and retained at D7.
  assert.equal(r[7].pct, 100);
  assert.equal(r[7].cohort, 2);
});

test('user installed 3d ago is excluded from the D7 eligible denominator', () => {
  // Only user is too new to have reached day 7 -> D7 n/a (null), cohort 0.
  const rows = [user('new', 3, 1)];
  const r = computeCohortRetention(rows, TODAY, [7, 30]);
  assert.equal(r[7].pct, null);
  assert.equal(r[7].cohort, 0);
  assert.equal(r[30].pct, null);
  assert.equal(r[30].cohort, 0);
});

test('day-0-only user installed 10d ago counts against D7 (eligible, not retained)', () => {
  // Eligible for D7 (age 10 >= 7) but never returned (max_dsi 0 < 7) -> 0% over cohort 1.
  const rows = [user('lapsed', 10, 0)];
  const r = computeCohortRetention(rows, TODAY, [7, 30]);
  assert.equal(r[7].pct, 0);
  assert.equal(r[7].cohort, 1);
  // Not eligible for D30 (age 10 < 30) -> n/a.
  assert.equal(r[30].pct, null);
  assert.equal(r[30].cohort, 0);
});

test('mixed cohort: D7 denominator excludes the too-new user', () => {
  const rows = [
    user('retained', 10, 7), // eligible D7, retained
    user('lapsed', 10, 2),   // eligible D7, not retained
    user('tooNew', 2, 0),    // not eligible D7
  ];
  const r = computeCohortRetention(rows, TODAY, [7, 30]);
  // Eligible = 2 (retained, lapsed); retained = 1 -> 50%.
  assert.equal(r[7].cohort, 2);
  assert.equal(r[7].pct, 50);
});

test('empty input -> all horizons null, cohort 0', () => {
  const r = computeCohortRetention([], TODAY, [7, 30]);
  assert.equal(r[7].pct, null);
  assert.equal(r[7].cohort, 0);
  assert.equal(r[30].pct, null);
  assert.equal(r[30].cohort, 0);
});

test('retained exactly at the horizon boundary (max_dsi === N) counts as retained', () => {
  const rows = [user('boundary', 30, 7)]; // age 30 eligible for both; max_dsi 7
  const r = computeCohortRetention(rows, TODAY, [7, 30]);
  assert.equal(r[7].pct, 100); // max_dsi 7 >= 7 retained
  assert.equal(r[30].pct, 0);  // max_dsi 7 < 30 not retained, but eligible
  assert.equal(r[30].cohort, 1);
});

test('eligibility boundary: age exactly N is eligible', () => {
  const rows = [user('exactly7', 7, 7)];
  const r = computeCohortRetention(rows, TODAY, [7, 30]);
  assert.equal(r[7].cohort, 1); // age 7 >= 7 -> eligible
  assert.equal(r[7].pct, 100);
});
