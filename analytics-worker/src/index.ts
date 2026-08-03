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
    'INSERT INTO events (id, anonymous_user_id, session_id, event_type, timestamp, properties, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  // D1 batch supports up to 100 statements per batch call
  const BATCH_SIZE = 100;
  const validEvents = events as AnalyticsEventPayload[];

  for (let i = 0; i < validEvents.length; i += BATCH_SIZE) {
    const chunk = validEvents.slice(i, i + BATCH_SIZE);
    const statements = chunk.map((event) => {
      const id = crypto.randomUUID();
      const properties = event.properties ? JSON.stringify(event.properties) : null;
      return stmt.bind(id, event.anonymous_user_id, event.session_id, event.event_type, event.timestamp, properties, receivedAt);
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
  ] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as total FROM events').first<{ total: number }>(),
    env.DB.prepare('SELECT COUNT(DISTINCT anonymous_user_id) as count FROM events').first<{ count: number }>(),
    env.DB.prepare("SELECT COUNT(DISTINCT anonymous_user_id) as count FROM events WHERE event_type = 'app_opened'").first<{ count: number }>(),
    env.DB.prepare("SELECT COUNT(DISTINCT anonymous_user_id) as count FROM events WHERE event_type = 'onboarding_completed'").first<{ count: number }>(),
    env.DB.prepare("SELECT json_extract(properties, '$.mode') as mode, COUNT(*) as count FROM events WHERE event_type = 'start_mode_selected' GROUP BY mode").all(),
    env.DB.prepare("SELECT COUNT(*) as count FROM events WHERE event_type = 'tool_opened'").first<{ count: number }>(),
    env.DB.prepare("SELECT COUNT(*) as count FROM events WHERE event_type = 'tool_completed'").first<{ count: number }>(),
    env.DB.prepare("SELECT json_extract(properties, '$.response') as response, COUNT(*) as count FROM events WHERE event_type = 'outcome_response' GROUP BY response").all(),
    env.DB.prepare("SELECT json_extract(properties, '$.days_since_install') as days, COUNT(DISTINCT anonymous_user_id) as users FROM events WHERE event_type = 'app_opened' GROUP BY days").all(),
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
  };

  return corsResponse(JSON.stringify(kpis), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
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

    // Health check
    if (path === '/' || path === '/health') {
      return corsResponse(JSON.stringify({ status: 'ok', service: 'mental-wallet-analytics' }), {
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
