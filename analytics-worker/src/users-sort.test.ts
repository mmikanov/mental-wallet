/**
 * Users-table sorting: server comparators (usersQuery.ts), the browser copy that ships in the
 * dashboard (usersTableClient.ts, evaluated here exactly as shipped), whitelist handling of
 * sort params, and a parse check of the dashboard's inline script.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortUsers, parseUsersSort, defaultDirFor, SORT_KEYS, type UserRow, type SortKey } from './usersQuery.ts';
import { countryName } from './countryName.ts';
import { USERS_SORT_JS } from './usersTableClient.ts';
import { DASHBOARD_HTML } from './dashboard.ts';

const row = (id: string, o: Partial<UserRow> = {}): UserRow => ({
  anonymous_user_id: id, event_count: 1, first_seen: '2026-11-01T00:00:00.000Z', last_seen: '2026-11-02T00:00:00.000Z',
  platform: 'ios', os_version: '17', country: 'US', first_platform: 'ios', first_version: '1.0.5', latest_version: '1.0.5', ...o,
});
const client = new Function(USERS_SORT_JS + '; return { sortUsersRows, usersDefaultDir, cmpVersionStr, countryName, versionLabel };')() as {
  countryName: (c: string | null) => string; versionLabel: (v: string | null) => string;
  sortUsersRows: (r: UserRow[], k: string, d: string) => UserRow[]; usersDefaultDir: (k: string) => string; cmpVersionStr: (a: string, b: string) => number;
};
const ids = (r: UserRow[]) => r.map((x) => x.anonymous_user_id);

const data = [
  row('a', { event_count: 9, first_version: '1.0.9', latest_version: '1.0.10', first_seen: '2026-11-03T05:00:00+00:00', last_seen: '2026-11-04T00:00:00.000Z', country: 'US' }),
  row('b', { event_count: 10, first_version: '1.0.10', latest_version: null, first_seen: '2026-11-03T04:00:00.000Z', country: null }),
  row('c', { event_count: 2, first_version: null, latest_version: '1.0.2', first_seen: '2026-10-30T00:00:00.000Z', country: 'CA' }),
  row('d', { event_count: 100, first_version: '1.0.5', latest_version: '1.0.9', platform: 'android', first_platform: 'android', country: 'br' }),
];

test('events sort numerically (10 > 9, not string order), both directions', () => {
  assert.deepEqual(ids(sortUsers(data, { key: 'event_count', dir: 'desc' })), ['d', 'b', 'a', 'c']);
  assert.deepEqual(ids(sortUsers(data, { key: 'event_count', dir: 'asc' })), ['c', 'a', 'b', 'd']);
});

test('versions sort by dotted number: 1.0.10 > 1.0.9; missing last in both directions', () => {
  assert.deepEqual(ids(sortUsers(data, { key: 'first_version', dir: 'desc' })), ['b', 'a', 'd', 'c']);
  assert.deepEqual(ids(sortUsers(data, { key: 'first_version', dir: 'asc' })), ['d', 'a', 'b', 'c']);
  assert.deepEqual(ids(sortUsers(data, { key: 'latest_version', dir: 'desc' })), ['a', 'd', 'c', 'b']);
});

test('timestamps sort chronologically as instants (offset-aware), not as strings', () => {
  // a = 05:00+00:00 is later than b = 04:00Z on the same day.
  const r = sortUsers(data, { key: 'first_seen', dir: 'asc' });
  assert.deepEqual(ids(r), ['c', 'd', 'b', 'a']);
});

test('text sorts case-insensitively with missing last; stable on ties', () => {
  // Country sorts by NAME: Brazil (br) < Canada (CA) < United States (US).
  assert.deepEqual(ids(sortUsers(data, { key: 'country', dir: 'asc' })), ['d', 'c', 'a', 'b']);
  assert.deepEqual(ids(sortUsers(data, { key: 'country', dir: 'desc' })), ['a', 'c', 'd', 'b']);
  const ties = [row('x'), row('y'), row('z')];
  assert.deepEqual(ids(sortUsers(ties, { key: 'platform', dir: 'asc' })), ['x', 'y', 'z']);
});

test('browser copy matches the server comparators for every key and direction', () => {
  for (const key of SORT_KEYS) {
    for (const dir of ['asc', 'desc'] as const) {
      assert.deepEqual(ids(client.sortUsersRows(data, key, dir)), ids(sortUsers(data, { key, dir })), `${key} ${dir}`);
    }
    assert.equal(client.usersDefaultDir(key), defaultDirFor(key as SortKey), `default dir ${key}`);
  }
  assert.ok(client.cmpVersionStr('1.0.10', '1.0.9') > 0);
  assert.ok(client.cmpVersionStr('1.0', '1.0.0') === 0);
});

test('sort params are whitelisted: unknown keys / hostile values fall back to the default', () => {
  assert.deepEqual(parseUsersSort(null, null), { key: 'event_count', dir: 'desc' });
  assert.deepEqual(parseUsersSort('first_version', null), { key: 'first_version', dir: 'desc' });
  assert.deepEqual(parseUsersSort('country', null), { key: 'country', dir: 'asc' });
  assert.deepEqual(parseUsersSort('country', 'desc'), { key: 'country', dir: 'desc' });
  assert.deepEqual(parseUsersSort("event_count; DROP TABLE events;--", "desc; --"), { key: 'event_count', dir: 'desc' });
  assert.deepEqual(parseUsersSort('constructor', 'asc'), { key: 'event_count', dir: 'asc' });
  assert.deepEqual(parseUsersSort('__proto__', 'sideways'), { key: 'event_count', dir: 'desc' });
});

test('dashboard inline script parses and wires the new filter + sortable headers', () => {
  const m = DASHBOARD_HTML.match(/<script>([\s\S]*)<\/script>/);
  assert.ok(m, 'script block present');
  assert.doesNotThrow(() => new Function(m![1]), 'inline dashboard script has no syntax errors');
  assert.ok(m![1].includes("'&joinVersion=' + encodeURIComponent(currentJoinVersion)"), 'getPhaseParams sends joinVersion');
  assert.ok(m![1].includes('function sortUsersBy'));
  assert.ok(DASHBOARD_HTML.includes('id="join-version-select"'));
});

test('country sort uses the displayed name, not the code (server + browser)', () => {
  // Codes DE < NL < SE would differ from names: Germany, Netherlands, Sweden is same, so pick
  // a case where they diverge: CH (Switzerland) vs DE (Germany) vs AT (Austria) -> names A,G,S.
  const rows = [row('x', { country: 'CH' }), row('y', { country: 'DE' }), row('z', { country: 'AT' }), row('t', { country: 'T1' })];
  // Names: Austria, Germany, Switzerland, Tor network. Codes: AT, CH, DE, T1 (CH < DE by code).
  assert.deepEqual(ids(sortUsers(rows, { key: 'country', dir: 'asc' })), ['z', 'y', 'x', 't']);
  assert.deepEqual(ids(client.sortUsersRows(rows, 'country', 'asc')), ['z', 'y', 'x', 't']);
});

test('countryName: names, special codes, missing, bad input; browser copy matches', () => {
  const cases: Array<[string | null | undefined, string]> = [
    ['US', 'United States'], ['de', 'Germany'], [' il ', 'Israel'], ['XX', 'Unknown'], ['T1', 'Tor network'],
    [null, '\u2014'], [undefined, '\u2014'], ['', '\u2014'], ['  ', '\u2014'], ['not-a-code', 'NOT-A-CODE'],
  ];
  for (const [input, want] of cases) {
    assert.equal(countryName(input), want, String(input));
    assert.equal(client.countryName(input as string | null), want, 'browser ' + String(input));
  }
});

test('versionLabel: version number only, em dash when missing', () => {
  assert.equal(client.versionLabel('1.0.5'), '1.0.5');
  assert.equal(client.versionLabel(null), '\u2014');
  assert.equal(client.versionLabel(''), '\u2014');
});
