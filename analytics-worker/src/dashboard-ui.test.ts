/**
 * Headless smoke test of the dashboard's inline script (no browser): runs it in a node:vm with a
 * tiny fake DOM + fetch, then drives the users table sort and the "Joined in version" picker.
 * It proves the wiring (params, header arrows, sort state surviving a re-open, capped => server
 * re-request, picker contents) but NOT real rendering/layout; that still needs a manual pass.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { DASHBOARD_HTML } from './dashboard.ts';

type El = { innerHTML: string; textContent: string; value: string; selectedIndex: number; options: any[]; classList: any; getAttribute: () => null };
function makeEnv(usersResponses: any[]) {
  const els: Record<string, El> = {};
  const el = (id: string): El => (els[id] ||= {
    innerHTML: '', textContent: '', value: '', selectedIndex: -1, options: [],
    classList: { add() {}, remove() {}, contains: () => false }, getAttribute: () => null,
  });
  const urls: string[] = [];
  const doc = {
    getElementById: el, querySelector: () => null, querySelectorAll: () => [], hidden: false,
    addEventListener() {},
  };
  const fetchFn = async (url: string) => {
    urls.push(url);
    const body = url.includes('/details/users') ? usersResponses.shift() : {};
    return { ok: true, json: async () => body };
  };
  const script = DASHBOARD_HTML.match(/<script>([\s\S]*)<\/script>/)![1]
    .replace("'__DASHBOARD_SECRET__'", "'s'")
    .replace(/\n\s*refreshAndSchedule\(\);\n\s*fetchMilestones\(\);[\s\S]*$/, '\n'); // no initial network/timers
  const ctx: any = vm.createContext({
    document: doc, fetch: fetchFn, console, setTimeout, clearTimeout, setInterval: () => 0, Intl, Date, encodeURIComponent,
    window: { open() {} }, confirm: () => true, alert() {},
  });
  vm.runInContext(script, ctx);
  return { ctx, els, urls, run: (code: string) => vm.runInContext(code, ctx) };
}

const U = (id: string, o: any = {}) => ({ anonymous_user_id: id + 'x'.repeat(10), event_count: 1, first_seen: '2026-11-01T00:00:00Z', last_seen: '2026-11-02T00:00:00Z', platform: 'ios', os_version: '17', country: 'US', first_platform: 'ios', first_version: '1.0.5', latest_version: '1.0.5', ...o });
const users = [U('a', { event_count: 3, first_version: '1.0.9' }), U('b', { event_count: 12, first_version: '1.0.10' }), U('c', { event_count: 1, first_version: null, latest_version: null })];
const order = (html: string) => [...html.matchAll(/showUserEvents\('([a-z])/g)].map((m) => m[1]);

test('users table: default Events desc with arrow; click sorts client-side; sort survives re-open', async () => {
  const e = makeEnv([{ users, total: 3, capped: false, limit: 1000 }, { users, total: 3, capped: false, limit: 1000 }]);
  await e.run("showDetail('users', 'new')");
  const html = e.els['detail-panel'].innerHTML;
  assert.match(html, /Events \u25BC/);
  assert.deepEqual(order(html), ['b', 'a', 'c']);
  assert.match(html, /First version/); assert.match(html, /Latest version/);
  assert.match(html, /<td>1\.0\.5<\/td>/); assert.ok(!/ios 1\.0\.5/.test(html), 'version cell has no platform prefix');
  assert.match(html, /<td>United States<\/td>/, 'country shows the name, not the code');
  assert.ok(html.includes('\u2014'), 'NULL version rendered as a dash');

  const before = e.urls.length;
  e.run("sortUsersBy('first_version')"); // new column => default desc, version-aware: 1.0.10 first
  let h = e.els['detail-panel'].innerHTML;
  assert.match(h, /First version \u25BC/); assert.deepEqual(order(h), ['b', 'a', 'c']);
  e.run("sortUsersBy('first_version')"); // toggle
  h = e.els['detail-panel'].innerHTML;
  assert.match(h, /First version \u25B2/); assert.deepEqual(order(h), ['a', 'b', 'c']); // missing stays last
  assert.equal(e.urls.length, before, 'uncapped sort needs no request');

  await e.run("showDetail('users', 'new')"); // auto-refresh re-open
  const last = e.urls[e.urls.length - 1];
  assert.match(last, /sort=first_version&dir=asc/);
  assert.match(last, /cohort=new/);
});

test('capped list: header click asks the server to sort the full set', async () => {
  const e = makeEnv([{ users, total: 5000, capped: true, limit: 1000 }, { users, total: 5000, capped: true, limit: 1000 }]);
  await e.run("showDetail('users')");
  assert.match(e.els['detail-panel'].innerHTML, /top 3 of 5000/);
  await e.run("sortUsersBy('country')");
  assert.match(e.urls[e.urls.length - 1], /sort=country&dir=asc/);
});

test('Joined-in-version picker: live versions only, grouped by OS, date label; flows into params + summary', () => {
  const e = makeEnv([]);
  e.run(`populateJoinVersionSelect([
    {platform:'ios',app_version:'1.0.5',live_at:'2026-10-01T20:06:00Z',status:'live'},
    {platform:'ios',app_version:'1.0.6',live_at:'2026-11-04T21:39:00Z',status:'live'},
    {platform:'ios',app_version:'1.0.2',live_at:'9999-12-31T00:00:00Z',status:'never_released'},
    {platform:'ios',app_version:'1.0.9',live_at:'2099-01-01T00:00:00Z',status:'scheduled'},
    {platform:'android',app_version:'1.0.4',live_at:'2026-09-17T16:42:00Z',status:'live'},
    {platform:'android',app_version:'1.0.7',live_at:null,status:'not_recorded'}])`);
  const html = e.els['join-version-select'].innerHTML;
  assert.match(html, /<optgroup label="Android">[\s\S]*<optgroup label="iOS">/);
  assert.ok(html.indexOf('value="ios:1.0.6"') < html.indexOf('value="ios:1.0.5"'), 'newest first');
  for (const bad of ['1.0.2', '1.0.9', '1.0.7']) assert.ok(!html.includes(bad), `${bad} not offered`);
  assert.match(html, /Any version/);
  assert.equal(e.run('getPhaseParams()').includes('joinVersion'), false);
  e.run("currentJoinVersion = 'ios:1.0.5'");
  assert.match(e.run('getPhaseParams()'), /&joinVersion=ios%3A1\.0\.5/);
  assert.match(e.run('getPhaseParams("new")'), /&cohort=new.*&joinVersion=/);
  e.run('updatePhaseRange()');
  assert.match(e.els['phase-range'].textContent, /users who joined in ios:1\.0\.5/);
});

test('user timeline: Country column shows the country name per event', async () => {
  const e = makeEnv([]);
  const ev = (country: any) => ({ timestamp: '2026-11-01T00:00:00Z', event_type: 'app_opened', session_id: 's1234567890', platform: 'ios', app_version: '1.0.6', channel: null, country, properties: null });
  const fetchFn = async (url: string) => ({ ok: true, json: async () => ({ user: 'u1', capped: false, events: [ev('DE'), ev(null), ev('T1')] }) });
  e.ctx.fetch = fetchFn;
  await e.run("showUserEvents('u1')");
  const h = e.els['detail-panel'].innerHTML;
  assert.match(h, /<th>Country<\/th>/);
  assert.ok(h.includes('<td>Germany</td>') && h.includes('<td>Tor network</td>') && h.includes('<td>\u2014</td>'));
});
