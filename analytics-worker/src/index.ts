/**
 * Mental Health Wallet — Production Analytics Worker
 *
 * Routes:
 *   POST /events     — Ingest batch payload from the app (no auth, CORS enabled)
 *   GET  /events     — Return all events as JSON (requires DASHBOARD_SECRET)
 *   GET  /dashboard  — Serve the analytics dashboard HTML (requires DASHBOARD_SECRET)
 *   DELETE /events   — Clear all events (requires DASHBOARD_SECRET)
 */

import { DASHBOARD_HTML } from './dashboard';

export interface Env {
  DB: D1Database;
  DASHBOARD_SECRET: string;
  MILESTONE_RELEASE: string;
  MILESTONE_WARM_END: string;
  MILESTONE_COLD_START: string;
  EXCLUDED_USER_IDS: string; // Comma-separated anonymous_user_ids to exclude from KPIs
}

// --- CORS Helpers ---

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function corsResponse(body: string | null, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    headers.set(k, v);
  }
  return new Response(body, { ...init, headers });
}

// --- Auth Helpers ---

function isAuthorized(request: Request, env: Env): boolean {
  // Check query param first (convenient for browser access)
  const url = new URL(request.url);
  const querySecret = url.searchParams.get('secret');
  if (querySecret === env.DASHBOARD_SECRET) return true;

  // Check Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader === `Bearer ${env.DASHBOARD_SECRET}`) return true;

  return false;
}

function unauthorizedResponse(): Response {
  return corsResponse(JSON.stringify({ error: 'Unauthorized. Provide ?secret= or Authorization: Bearer <secret>' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

// --- Event Validation ---

interface AnalyticsEventPayload {
  anonymous_user_id: string;
  session_id: string;
  event_type: string;
  timestamp: string;
  platform?: string;
  os_version?: string;
  app_version?: string;
  properties?: Record<string, unknown>;
}

function validateEvent(event: unknown): event is AnalyticsEventPayload {
  if (typeof event !== 'object' || event === null) return false;
  const e = event as Record<string, unknown>;
  return (
    typeof e.anonymous_user_id === 'string' && e.anonymous_user_id.length > 0 &&
    typeof e.session_id === 'string' && e.session_id.length > 0 &&
    typeof e.event_type === 'string' && e.event_type.length > 0 &&
    typeof e.timestamp === 'string' && e.timestamp.length > 0
  );
}

// --- Route Handlers ---

async function handlePostEvents(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return corsResponse(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const payload = body as Record<string, unknown>;
  if (!payload || !Array.isArray(payload.events)) {
    return corsResponse(JSON.stringify({ error: 'Invalid payload: "events" must be an array' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const events = payload.events as unknown[];

  // Validate each event
  for (let i = 0; i < events.length; i++) {
    if (!validateEvent(events[i])) {
      return corsResponse(JSON.stringify({
        error: `Invalid event at index ${i}: missing required fields (anonymous_user_id, session_id, event_type, timestamp)`,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Insert events into D1
  const receivedAt = new Date().toISOString();
  const stmt = env.DB.prepare(
    'INSERT INTO events (id, anonymous_user_id, session_id, event_type, timestamp, properties, platform, os_version, app_version, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  // D1 batch supports up to 100 statements per batch call
  const BATCH_SIZE = 100;
  const validEvents = events as AnalyticsEventPayload[];

  for (let i = 0; i < validEvents.length; i += BATCH_SIZE) {
    const chunk = validEvents.slice(i, i + BATCH_SIZE);
    const statements = chunk.map((event) => {
      const id = crypto.randomUUID();
      const properties = event.properties ? JSON.stringify(event.properties) : null;
      const platform = event.platform || null;
      const osVersion = event.os_version || null;
      const appVersion = event.app_version || null;
      return stmt.bind(id, event.anonymous_user_id, event.session_id, event.event_type, event.timestamp, properties, platform, osVersion, appVersion, receivedAt);
    });
    await env.DB.batch(statements);
  }

  return corsResponse(JSON.stringify({ accepted: validEvents.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGetEvents(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorizedResponse();

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '1000', 10), 10000);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const eventType = url.searchParams.get('event_type');

  let query = 'SELECT * FROM events';
  const params: unknown[] = [];

  if (eventType) {
    query += ' WHERE event_type = ?';
    params.push(eventType);
  }

  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const result = await env.DB.prepare(query).bind(...params).all();

  // Parse properties back to objects for the response
  const rows = result.results.map((row) => ({
    ...row,
    properties: row.properties ? JSON.parse(row.properties as string) : null,
  }));

  return corsResponse(JSON.stringify(rows), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleDeleteEvents(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorizedResponse();

  await env.DB.prepare('DELETE FROM events').run();

  return corsResponse(JSON.stringify({ message: 'All events cleared' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleDashboard(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorizedResponse();

  // Inject the secret into the dashboard HTML so it can make authenticated API calls
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret') || '';
  const html = DASHBOARD_HTML.replace('__DASHBOARD_SECRET__', secret);

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS },
  });
}

// --- KPI endpoint for the dashboard to fetch computed data server-side ---

async function handleKpis(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorizedResponse();

  try {
  // Phase filtering: optional date range
  const url = new URL(request.url);
  const fromDate = url.searchParams.get('from') || null;
  const toDate = url.searchParams.get('to') || null;

  // Internal user exclusion
  const excludedIds = env.EXCLUDED_USER_IDS
    ? env.EXCLUDED_USER_IDS.split(',').map(id => id.trim()).filter(id => id.length > 0)
    : [];

  // Build WHERE clause for date filtering and user exclusion
  let dateFilter = '';
  const dateParams: string[] = [];
  if (fromDate) {
    dateFilter += ' AND timestamp >= ?';
    dateParams.push(fromDate);
  }
  if (toDate) {
    dateFilter += ' AND timestamp < ?';
    dateParams.push(toDate);
  }
  if (excludedIds.length > 0) {
    const placeholders = excludedIds.map(() => '?').join(', ');
    dateFilter += ` AND anonymous_user_id NOT IN (${placeholders})`;
    dateParams.push(...excludedIds);
  }

  // Helper to build filtered queries
  const withFilter = (baseWhere: string) => {
    const where = baseWhere ? baseWhere + dateFilter : (dateFilter ? ' WHERE 1=1' + dateFilter : '');
    return { where, params: [...dateParams] };
  };

  // Helper to prepare + bind (handles empty params for local D1 compatibility)
  function query(sql: string, params: unknown[]) {
    const stmt = env.DB.prepare(sql);
    return params.length > 0 ? stmt.bind(...params) : stmt;
  }

  const allFilter = withFilter('');
  const appOpenedFilter = withFilter("WHERE event_type = 'app_opened'");
  const onboardingFilter = withFilter("WHERE event_type = 'onboarding_completed'");
  const modeFilter = withFilter("WHERE event_type = 'start_mode_selected'");
  const toolOpenedFilter = withFilter("WHERE event_type = 'tool_opened'");
  const toolCompletedFilter = withFilter("WHERE event_type = 'tool_completed'");
  const outcomeFilter = withFilter("WHERE event_type = 'outcome_response'");
  const retentionFilter = withFilter("WHERE event_type = 'app_opened'");
  const platformFilter = withFilter("WHERE platform IS NOT NULL");

  const [
    totalResult,
    usersResult,
    appOpenedUsersResult,
    onboardingCompletedUsersResult,
    modeResult,
    toolOpenedResult,
    toolCompletedResult,
    outcomeResult,
    retentionResult,
    platformResult,
  ] = await Promise.all([
    query(`SELECT COUNT(*) as total FROM events${allFilter.where}`, allFilter.params).first<{ total: number }>(),
    query(`SELECT COUNT(DISTINCT anonymous_user_id) as count FROM events${allFilter.where}`, allFilter.params).first<{ count: number }>(),
    query(`SELECT COUNT(DISTINCT anonymous_user_id) as count FROM events ${appOpenedFilter.where}`, appOpenedFilter.params).first<{ count: number }>(),
    query(`SELECT COUNT(DISTINCT anonymous_user_id) as count FROM events ${onboardingFilter.where}`, onboardingFilter.params).first<{ count: number }>(),
    query(`SELECT json_extract(properties, '$.mode') as mode, COUNT(*) as count FROM events ${modeFilter.where} GROUP BY mode`, modeFilter.params).all(),
    query(`SELECT COUNT(*) as count FROM events ${toolOpenedFilter.where}`, toolOpenedFilter.params).first<{ count: number }>(),
    query(`SELECT COUNT(*) as count FROM events ${toolCompletedFilter.where}`, toolCompletedFilter.params).first<{ count: number }>(),
    query(`SELECT json_extract(properties, '$.response') as response, COUNT(*) as count FROM events ${outcomeFilter.where} GROUP BY response`, outcomeFilter.params).all(),
    query(`SELECT json_extract(properties, '$.days_since_install') as days, COUNT(DISTINCT anonymous_user_id) as users FROM events ${retentionFilter.where} GROUP BY days`, retentionFilter.params).all(),
    query(`SELECT platform, COUNT(DISTINCT anonymous_user_id) as users FROM events ${platformFilter.where} GROUP BY platform`, platformFilter.params).all(),
  ]);

  // --- Launch KPI queries (also filtered by date) ---
  const shareTapFilter = withFilter("WHERE event_type = 'share_tapped'");

  // Compute 14-days-ago as ISO string (portable across local and production D1)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const toolCompletedRecent = withFilter("WHERE event_type = 'tool_completed' AND timestamp >= '" + fourteenDaysAgo + "'");

  const [
    activationResult,
    weeklyEngagementResult,
    shareTapsResult,
    walletGrowthResult,
  ] = await Promise.all([
    // Activation: users who completed a tool within 48h of first app_opened
    // Since ISO timestamps aren't easily compared with +2 days in pure SQL without datetime(),
    // we fetch raw data and compute in JS.
    // Build table-qualified filters for the JOIN query to avoid ambiguous column names.
    (() => {
      let innerFilter = '';
      let outerFilter = '';
      const innerParams: string[] = [];
      const outerParams: string[] = [];
      if (fromDate) {
        innerFilter += ' AND events.timestamp >= ?';
        outerFilter += ' AND tc.timestamp >= ?';
        innerParams.push(fromDate);
        outerParams.push(fromDate);
      }
      if (toDate) {
        innerFilter += ' AND events.timestamp < ?';
        outerFilter += ' AND tc.timestamp < ?';
        innerParams.push(toDate);
        outerParams.push(toDate);
      }
      if (excludedIds.length > 0) {
        const ph = excludedIds.map(() => '?').join(', ');
        innerFilter += ` AND events.anonymous_user_id NOT IN (${ph})`;
        outerFilter += ` AND tc.anonymous_user_id NOT IN (${ph})`;
        innerParams.push(...excludedIds);
        outerParams.push(...excludedIds);
      }
      return query(`
        SELECT tc.anonymous_user_id, tc.timestamp as completed_at, fo.first_open
        FROM events tc
        INNER JOIN (
          SELECT events.anonymous_user_id, MIN(events.timestamp) as first_open
          FROM events WHERE events.event_type = 'app_opened'${innerFilter}
          GROUP BY events.anonymous_user_id
        ) fo ON tc.anonymous_user_id = fo.anonymous_user_id
        WHERE tc.event_type = 'tool_completed'${outerFilter}
      `, [...innerParams, ...outerParams]);
    })().all(),
    // Weekly engagement: avg tool completions per user per week (last 14 days within phase)
    query(`
      SELECT
        COUNT(*) as total_completions,
        COUNT(DISTINCT anonymous_user_id) as active_users
      FROM events
      ${toolCompletedRecent.where}
    `, toolCompletedRecent.params).first<{ total_completions: number; active_users: number }>(),
    // Share taps total
    query(`SELECT COUNT(*) as count FROM events ${shareTapFilter.where}`, shareTapFilter.params).first<{ count: number }>(),
    // Wallet growth: tool_added events after first session (days_since_install > 0 proxy)
    (() => {
      let outerFilter = '';
      let innerFilter = '';
      const outerParams: string[] = [];
      const innerParams: string[] = [];
      if (fromDate) {
        outerFilter += ' AND e1.timestamp >= ?';
        innerFilter += ' AND e2.timestamp >= ?';
        outerParams.push(fromDate);
        innerParams.push(fromDate);
      }
      if (toDate) {
        outerFilter += ' AND e1.timestamp < ?';
        innerFilter += ' AND e2.timestamp < ?';
        outerParams.push(toDate);
        innerParams.push(toDate);
      }
      if (excludedIds.length > 0) {
        const ph = excludedIds.map(() => '?').join(', ');
        outerFilter += ` AND e1.anonymous_user_id NOT IN (${ph})`;
        innerFilter += ` AND e2.anonymous_user_id NOT IN (${ph})`;
        outerParams.push(...excludedIds);
        innerParams.push(...excludedIds);
      }
      return query(`
        SELECT COUNT(DISTINCT e1.anonymous_user_id) as users_who_added
        FROM events e1
        WHERE e1.event_type = 'tool_added'${outerFilter}
          AND e1.anonymous_user_id IN (
            SELECT DISTINCT e2.anonymous_user_id FROM events e2
            WHERE e2.event_type = 'app_opened'
              AND json_extract(e2.properties, '$.days_since_install') > 0${innerFilter}
          )
      `, [...outerParams, ...innerParams]);
    })().first<{ users_who_added: number }>(),
  ]);

  // Compute mode split
  const modeRows = modeResult.results as Array<{ mode: string; count: number }>;
  const walletFirst = modeRows.find(r => r.mode === 'wallet_first')?.count || 0;
  const emotionFirst = modeRows.find(r => r.mode === 'emotion_first')?.count || 0;

  // Compute retention buckets
  const retentionRows = retentionResult.results as Array<{ days: number; users: number }>;
  const retention = { D0: 0, D1: 0, D7: 0, D30: 0 };
  for (const row of retentionRows) {
    const d = Number(row.days);
    if (d === 0) retention.D0 += row.users;
    if (d === 1) retention.D1 += row.users;
    if (d >= 1 && d <= 7) retention.D7 += row.users;
    if (d >= 1 && d <= 30) retention.D30 += row.users;
  }

  // Compute outcome breakdown
  const outcomeRows = outcomeResult.results as Array<{ response: string; count: number }>;
  const outcomes: Record<string, number> = { calmer: 0, clearer: 0, hopeful: 0, same: 0, worse: 0 };
  let totalOutcomes = 0;
  for (const row of outcomeRows) {
    if (row.response in outcomes) {
      outcomes[row.response] = row.count;
    }
    totalOutcomes += row.count;
  }

  // Compute platform split
  const platformRows = platformResult.results as Array<{ platform: string; users: number }>;
  const iosUsers = platformRows.find(r => r.platform === 'ios')?.users || 0;
  const androidUsers = platformRows.find(r => r.platform === 'android')?.users || 0;

  // Compute launch KPIs
  const totalUsers = appOpenedUsersResult?.count || 0;

  // Compute activation from raw rows (48h = 172800000ms)
  const activationRows = (activationResult?.results || []) as Array<{ anonymous_user_id: string; completed_at: string; first_open: string }>;
  const activatedUserSet = new Set<string>();
  for (const row of activationRows) {
    const diff = new Date(row.completed_at).getTime() - new Date(row.first_open).getTime();
    if (diff <= 172800000) {
      activatedUserSet.add(row.anonymous_user_id);
    }
  }
  const activatedUsers = activatedUserSet.size;
  const activationRate = totalUsers > 0 ? (activatedUsers / totalUsers) * 100 : 0;

  const totalCompletions14d = weeklyEngagementResult?.total_completions || 0;
  const activeUsers14d = weeklyEngagementResult?.active_users || 0;
  // Avg completions per user per week over 14 days (2 weeks)
  const weeklyEngagement = activeUsers14d > 0 ? (totalCompletions14d / activeUsers14d) / 2 : 0;

  const retentionD7Pct = retention.D0 > 0 ? (retention.D7 / retention.D0) * 100 : 0;
  const retentionD30Pct = retention.D0 > 0 ? (retention.D30 / retention.D0) * 100 : 0;

  const shareTaps = shareTapsResult?.count || 0;
  const usersWhoAddedTools = walletGrowthResult?.users_who_added || 0;

  const kpis = {
    totalEvents: totalResult?.total || 0,
    uniqueUsers: usersResult?.count || 0,
    onboardingRate: (appOpenedUsersResult?.count || 0) > 0
      ? ((onboardingCompletedUsersResult?.count || 0) / (appOpenedUsersResult?.count || 0)) * 100
      : 0,
    walletFirst,
    emotionFirst,
    toolOpened: toolOpenedResult?.count || 0,
    toolCompleted: toolCompletedResult?.count || 0,
    toolCompletionRate: (toolOpenedResult?.count || 0) > 0
      ? ((toolCompletedResult?.count || 0) / (toolOpenedResult?.count || 0)) * 100
      : 0,
    outcomes,
    totalOutcomes,
    outcomePositivity: totalOutcomes > 0
      ? ((outcomes.calmer + outcomes.clearer + outcomes.hopeful) / totalOutcomes) * 100
      : 0,
    retention,
    iosUsers,
    androidUsers,
    // Launch KPIs
    launch: {
      activationRate,
      activatedUsers,
      totalUsers,
      weeklyEngagement,
      activeUsers14d,
      retentionD7Pct,
      retentionD30Pct,
      shareTaps,
      usersWhoAddedTools,
    },
  };

  return corsResponse(JSON.stringify(kpis), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return corsResponse(JSON.stringify({ error: 'KPI computation failed', detail: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// --- Detail endpoints for dashboard drill-downs ---

async function handleDetailUsers(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorizedResponse();

  const result = await env.DB.prepare(`
    SELECT
      anonymous_user_id,
      COUNT(*) as event_count,
      MIN(timestamp) as first_seen,
      MAX(timestamp) as last_seen
    FROM events
    GROUP BY anonymous_user_id
    ORDER BY event_count DESC
    LIMIT 200
  `).all();

  return corsResponse(JSON.stringify(result.results), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleDetailOnboarding(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorizedResponse();

  const [stepsResult, countsResult] = await Promise.all([
    env.DB.prepare(`
      SELECT json_extract(properties, '$.step_name') as step_name, COUNT(*) as views
      FROM events
      WHERE event_type = 'onboarding_step_viewed'
      GROUP BY step_name
      ORDER BY views DESC
    `).all(),
    env.DB.prepare(`
      SELECT
        (SELECT COUNT(DISTINCT anonymous_user_id) FROM events WHERE event_type = 'app_opened') as opened,
        (SELECT COUNT(DISTINCT anonymous_user_id) FROM events WHERE event_type = 'onboarding_completed') as completed
    `).first<{ opened: number; completed: number }>(),
  ]);

  return corsResponse(JSON.stringify({
    steps: stepsResult.results,
    usersOpened: countsResult?.opened || 0,
    usersCompleted: countsResult?.completed || 0,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleDetailModes(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorizedResponse();

  const result = await env.DB.prepare(`
    SELECT
      anonymous_user_id,
      json_extract(properties, '$.mode') as mode,
      timestamp
    FROM events
    WHERE event_type = 'start_mode_selected'
    ORDER BY timestamp DESC
    LIMIT 200
  `).all();

  return corsResponse(JSON.stringify(result.results), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleDetailTools(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorizedResponse();

  const result = await env.DB.prepare(`
    SELECT
      json_extract(properties, '$.card_id') as card_id,
      json_extract(properties, '$.card_category') as card_category,
      COUNT(*) as completions,
      AVG(CAST(json_extract(properties, '$.duration_ms') AS REAL)) as avg_duration_ms
    FROM events
    WHERE event_type = 'tool_completed'
    GROUP BY card_id
    ORDER BY completions DESC
    LIMIT 100
  `).all();

  return corsResponse(JSON.stringify(result.results), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleDetailOutcomes(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorizedResponse();

  const result = await env.DB.prepare(`
    SELECT
      json_extract(properties, '$.response') as response,
      COUNT(*) as count
    FROM events
    WHERE event_type = 'outcome_response'
    GROUP BY response
    ORDER BY count DESC
  `).all();

  return corsResponse(JSON.stringify(result.results), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleDetailPlatforms(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorizedResponse();

  const [platformResult, osVersionResult, appVersionResult] = await Promise.all([
    env.DB.prepare(`
      SELECT platform, COUNT(DISTINCT anonymous_user_id) as users, COUNT(*) as events
      FROM events
      WHERE platform IS NOT NULL
      GROUP BY platform
      ORDER BY users DESC
    `).all(),
    env.DB.prepare(`
      SELECT platform, os_version, COUNT(DISTINCT anonymous_user_id) as users
      FROM events
      WHERE platform IS NOT NULL AND os_version IS NOT NULL
      GROUP BY platform, os_version
      ORDER BY users DESC
      LIMIT 50
    `).all(),
    env.DB.prepare(`
      SELECT app_version, COUNT(DISTINCT anonymous_user_id) as users, COUNT(*) as events
      FROM events
      WHERE app_version IS NOT NULL
      GROUP BY app_version
      ORDER BY app_version DESC
      LIMIT 20
    `).all(),
  ]);

  return corsResponse(JSON.stringify({
    platforms: platformResult.results,
    osVersions: osVersionResult.results,
    appVersions: appVersionResult.results,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// --- Main Fetch Handler ---

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return corsResponse(null, { status: 204 });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Route matching
    if (path === '/events' && request.method === 'POST') {
      return handlePostEvents(request, env);
    }
    if (path === '/events' && request.method === 'GET') {
      return handleGetEvents(request, env);
    }
    if (path === '/events' && request.method === 'DELETE') {
      return handleDeleteEvents(request, env);
    }
    if (path === '/dashboard' && request.method === 'GET') {
      return handleDashboard(request, env);
    }
    if (path === '/kpis' && request.method === 'GET') {
      return handleKpis(request, env);
    }
    if (path === '/details/users' && request.method === 'GET') {
      return handleDetailUsers(request, env);
    }
    if (path === '/details/onboarding' && request.method === 'GET') {
      return handleDetailOnboarding(request, env);
    }
    if (path === '/details/modes' && request.method === 'GET') {
      return handleDetailModes(request, env);
    }
    if (path === '/details/tools' && request.method === 'GET') {
      return handleDetailTools(request, env);
    }
    if (path === '/details/outcomes' && request.method === 'GET') {
      return handleDetailOutcomes(request, env);
    }
    if (path === '/details/platforms' && request.method === 'GET') {
      return handleDetailPlatforms(request, env);
    }

    // Health check
    if (path === '/' || path === '/health') {
      return corsResponse(JSON.stringify({ status: 'ok', service: 'mental-wallet-analytics' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Milestones (phase dates for dashboard filtering)
    if (path === '/milestones' && request.method === 'GET') {
      if (!isAuthorized(request, env)) return unauthorizedResponse();
      const excludedIds = env.EXCLUDED_USER_IDS
        ? env.EXCLUDED_USER_IDS.split(',').map(id => id.trim()).filter(id => id.length > 0)
        : [];
      return corsResponse(JSON.stringify({
        release: env.MILESTONE_RELEASE || null,
        warmEnd: env.MILESTONE_WARM_END || null,
        coldStart: env.MILESTONE_COLD_START || null,
        excludedUserIds: excludedIds,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return corsResponse(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
