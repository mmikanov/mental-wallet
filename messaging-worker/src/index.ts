/**
 * Mental Health Wallet — Messaging Worker
 *
 * Owns subscriber consent (its own D1 database, kept separate from the
 * anonymous analytics worker so PII stays isolated) and sends email via Resend.
 *
 * Public routes (called by the marketing website, CORS-enabled, no secret):
 *   POST /subscribe    — create/update a subscriber's consent scopes
 *   POST /preferences  — update scopes via unsubscribe token
 *   GET  /unsubscribe  — disable all scopes via token (one-click target)
 *
 * Admin routes (require ADMIN_SECRET via ?secret= or Authorization: Bearer):
 *   GET  /subscribers  — list recipients opted into a given scope
 *   POST /send-test    — send one email through Resend to a consenting address
 *
 *   GET  /health       — health check (no auth)
 */

export interface Env {
  DB: D1Database;
  ADMIN_SECRET: string;
  RESEND_API_KEY: string;
  SITE_ORIGIN: string;
  EMAIL_FROM: string;
  EMAIL_REPLY_TO: string;
}

type Scope = 'reminders' | 'tips';
const SCOPES: Scope[] = ['reminders', 'tips'];

// --- CORS Helpers ---

function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.SITE_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(
  env: Env,
  body: unknown,
  init: ResponseInit = {}
): Response {
  const headers = new Headers(init.headers);
  for (const [k, v] of Object.entries(corsHeaders(env))) headers.set(k, v);
  headers.set('Content-Type', 'application/json');
  return new Response(body === null ? null : JSON.stringify(body), { ...init, headers });
}

// --- Auth Helpers ---

function isAuthorized(request: Request, env: Env): boolean {
  const url = new URL(request.url);
  const querySecret = url.searchParams.get('secret');
  if (querySecret && querySecret === env.ADMIN_SECRET) return true;

  const authHeader = request.headers.get('Authorization');
  if (authHeader === `Bearer ${env.ADMIN_SECRET}`) return true;

  return false;
}

function unauthorized(env: Env): Response {
  return jsonResponse(env, { error: 'Unauthorized. Provide ?secret= or Authorization: Bearer <secret>' }, { status: 401 });
}

// --- Validation ---

// Pragmatic email format check. The real gatekeeper; the website form adds
// a client-side check for UX (Requirement 2.2 / 2.3).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > 320) return null;
  if (!EMAIL_RE.test(email)) return null;
  return email;
}

function normalizeFirstName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim();
  if (name.length === 0) return null;
  return name.slice(0, 100);
}

/**
 * Parse the desired scope flags from a request body.
 * Any scope key present and truthy → 1; present and falsy → 0; absent → undefined
 * (meaning "leave unchanged" for preferences updates).
 */
function parseScopes(body: Record<string, unknown>): Partial<Record<Scope, boolean>> {
  const out: Partial<Record<Scope, boolean>> = {};
  for (const scope of SCOPES) {
    if (scope in body) out[scope] = Boolean(body[scope]);
  }
  return out;
}

// --- Subscriber row shape ---

interface SubscriberRow {
  id: string;
  email: string;
  first_name: string | null;
  scope_reminders: number;
  scope_tips: number;
  reminders_updated_at: string | null;
  tips_updated_at: string | null;
  unsubscribe_token: string;
  source: string | null;
  created_at: string;
  updated_at: string;
}

// --- Route: POST /subscribe (public) ---

async function handleSubscribe(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(env, { error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return jsonResponse(env, { error: 'A valid email is required' }, { status: 400 });
  }
  const firstName = normalizeFirstName(body.first_name);
  const scopes = parseScopes(body);
  const now = new Date().toISOString();

  const existing = await env.DB.prepare('SELECT * FROM subscribers WHERE email = ?')
    .bind(email)
    .first<SubscriberRow>();

  if (existing) {
    // Update scopes that were provided; leave others unchanged. Update
    // per-scope timestamp only when the value actually changes.
    const nextReminders = 'reminders' in scopes ? (scopes.reminders ? 1 : 0) : existing.scope_reminders;
    const nextTips = 'tips' in scopes ? (scopes.tips ? 1 : 0) : existing.scope_tips;
    const remindersTs = nextReminders !== existing.scope_reminders ? now : existing.reminders_updated_at;
    const tipsTs = nextTips !== existing.scope_tips ? now : existing.tips_updated_at;
    const nextName = firstName ?? existing.first_name;

    await env.DB.prepare(
      `UPDATE subscribers
       SET first_name = ?, scope_reminders = ?, scope_tips = ?,
           reminders_updated_at = ?, tips_updated_at = ?, updated_at = ?
       WHERE email = ?`
    )
      .bind(nextName, nextReminders, nextTips, remindersTs, tipsTs, now, email)
      .run();
  } else {
    const nextReminders = scopes.reminders ? 1 : 0;
    const nextTips = scopes.tips ? 1 : 0;
    await env.DB.prepare(
      `INSERT INTO subscribers
         (id, email, first_name, scope_reminders, scope_tips,
          reminders_updated_at, tips_updated_at, unsubscribe_token, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        email,
        firstName,
        nextReminders,
        nextTips,
        nextReminders ? now : null,
        nextTips ? now : null,
        crypto.randomUUID(),
        (typeof body.source === 'string' ? body.source : 'website'),
        now,
        now
      )
      .run();
  }

  // Uniform response — does not reveal whether the email already existed.
  return jsonResponse(env, { ok: true });
}

// --- Route: GET /preferences (public, token) — read current scopes ---

async function handleGetPreferences(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  if (!token) {
    return jsonResponse(env, { error: 'A token is required' }, { status: 400 });
  }

  const existing = await env.DB.prepare('SELECT * FROM subscribers WHERE unsubscribe_token = ?')
    .bind(token)
    .first<SubscriberRow>();

  if (!existing) {
    // Uniform not-found; do not leak token validity beyond this.
    return jsonResponse(env, { ok: false }, { status: 404 });
  }

  return jsonResponse(env, {
    ok: true,
    scopes: { tips: existing.scope_tips === 1, reminders: existing.scope_reminders === 1 },
    first_name: existing.first_name,
  });
}

// --- Route: POST /preferences (public, token) ---

async function handlePreferences(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(env, { error: 'Invalid JSON body' }, { status: 400 });
  }

  const token = typeof body.token === 'string' ? body.token : '';
  if (!token) {
    return jsonResponse(env, { error: 'A token is required' }, { status: 400 });
  }

  const existing = await env.DB.prepare('SELECT * FROM subscribers WHERE unsubscribe_token = ?')
    .bind(token)
    .first<SubscriberRow>();

  if (!existing) {
    return jsonResponse(env, { error: 'Not found' }, { status: 404 });
  }

  const scopes = parseScopes(body);
  const now = new Date().toISOString();
  const nextReminders = 'reminders' in scopes ? (scopes.reminders ? 1 : 0) : existing.scope_reminders;
  const nextTips = 'tips' in scopes ? (scopes.tips ? 1 : 0) : existing.scope_tips;
  const remindersTs = nextReminders !== existing.scope_reminders ? now : existing.reminders_updated_at;
  const tipsTs = nextTips !== existing.scope_tips ? now : existing.tips_updated_at;

  await env.DB.prepare(
    `UPDATE subscribers
     SET scope_reminders = ?, scope_tips = ?, reminders_updated_at = ?, tips_updated_at = ?, updated_at = ?
     WHERE unsubscribe_token = ?`
  )
    .bind(nextReminders, nextTips, remindersTs, tipsTs, now, token)
    .run();

  return jsonResponse(env, {
    ok: true,
    scopes: { reminders: nextReminders === 1, tips: nextTips === 1 },
  });
}

// --- Route: GET /unsubscribe (public, token) ---

async function handleUnsubscribe(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  if (!token) {
    return new Response(renderUnsubscribeHtml('Invalid unsubscribe link.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders(env) },
    });
  }

  const existing = await env.DB.prepare('SELECT * FROM subscribers WHERE unsubscribe_token = ?')
    .bind(token)
    .first<SubscriberRow>();

  if (!existing) {
    // Uniform: don't reveal token validity beyond a generic message.
    return new Response(renderUnsubscribeHtml("You've been unsubscribed."), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders(env) },
    });
  }

  const now = new Date().toISOString();
  // Idempotent: setting both scopes off; only bump timestamps when they change.
  const remindersTs = existing.scope_reminders !== 0 ? now : existing.reminders_updated_at;
  const tipsTs = existing.scope_tips !== 0 ? now : existing.tips_updated_at;

  await env.DB.prepare(
    `UPDATE subscribers
     SET scope_reminders = 0, scope_tips = 0, reminders_updated_at = ?, tips_updated_at = ?, updated_at = ?
     WHERE unsubscribe_token = ?`
  )
    .bind(remindersTs, tipsTs, now, token)
    .run();

  return new Response(renderUnsubscribeHtml("You've been unsubscribed. You won't receive further emails."), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders(env) },
  });
}

function renderUnsubscribeHtml(message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mental Health Wallet</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1.5rem;color:#1a1a1a;line-height:1.5}h1{font-size:1.25rem}</style>
</head><body><h1>Mental Health Wallet</h1><p>${message}</p></body></html>`;
}

// --- Route: GET /subscribers (admin) ---

async function handleSubscribers(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);

  const url = new URL(request.url);
  const scope = url.searchParams.get('scope');
  if (scope !== 'reminders' && scope !== 'tips') {
    return jsonResponse(env, { error: "Query param 'scope' must be 'reminders' or 'tips'" }, { status: 400 });
  }

  const column = scope === 'reminders' ? 'scope_reminders' : 'scope_tips';
  const result = await env.DB.prepare(
    `SELECT email, first_name, unsubscribe_token, source
     FROM subscribers WHERE ${column} = 1 ORDER BY created_at ASC`
  ).all<Pick<SubscriberRow, 'email' | 'first_name' | 'unsubscribe_token' | 'source'>>();

  return jsonResponse(env, { scope, count: result.results.length, recipients: result.results });
}

// --- Route: POST /send-test (admin) ---

async function handleSendTest(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(env, { error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return jsonResponse(env, { error: 'A valid email is required' }, { status: 400 });
  }
  const scope: Scope = body.scope === 'reminders' ? 'reminders' : 'tips';
  const subject = typeof body.subject === 'string' ? body.subject : 'A quick tip from Mental Health Wallet';
  const bodyText = typeof body.body === 'string' ? body.body : 'This is a test message from Mental Health Wallet.';

  // Consent enforcement: only send to an address opted into the scope.
  const column = scope === 'reminders' ? 'scope_reminders' : 'scope_tips';
  const recipient = await env.DB.prepare(
    `SELECT * FROM subscribers WHERE email = ? AND ${column} = 1`
  )
    .bind(email)
    .first<SubscriberRow>();

  if (!recipient) {
    return jsonResponse(
      env,
      { error: `No subscriber with email opted into scope '${scope}'` },
      { status: 409 }
    );
  }

  const sendResult = await sendEmail(env, recipient, subject, bodyText);
  if (!sendResult.ok) {
    return jsonResponse(env, { error: 'Send failed', detail: sendResult.detail }, { status: 502 });
  }

  return jsonResponse(env, { ok: true, id: sendResult.id });
}

// --- Route: POST /send-tip (admin) ---

interface TipPayload {
  title: string;
  summary: string;
  body?: string;
  heroImage?: string;
  cta?: { label?: string; url?: string };
}

function parseTip(raw: unknown): TipPayload | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const t = raw as Record<string, unknown>;
  const title = typeof t.title === 'string' ? t.title.trim() : '';
  const summary = typeof t.summary === 'string' ? t.summary.trim() : '';
  if (!title || !summary) return null;
  const tip: TipPayload = { title, summary };
  if (typeof t.body === 'string' && t.body.trim().length > 0) tip.body = t.body.trim();
  if (typeof t.heroImage === 'string' && t.heroImage.trim().length > 0) tip.heroImage = t.heroImage.trim();
  if (typeof t.cta === 'object' && t.cta !== null) {
    const cta = t.cta as Record<string, unknown>;
    const label = typeof cta.label === 'string' ? cta.label.trim() : '';
    const url = typeof cta.url === 'string' ? cta.url.trim() : '';
    if (label && url) tip.cta = { label, url };
  }
  return tip;
}

async function handleSendTip(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(env, { error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return jsonResponse(env, { error: 'A valid email is required' }, { status: 400 });
  }
  const tip = parseTip(body.tip);
  if (!tip) {
    return jsonResponse(env, { error: 'tip.title and tip.summary are required' }, { status: 400 });
  }
  const scope: Scope = body.scope === 'reminders' ? 'reminders' : 'tips';

  // Consent enforcement: only send to an address opted into the scope.
  const column = scope === 'reminders' ? 'scope_reminders' : 'scope_tips';
  const recipient = await env.DB.prepare(
    `SELECT * FROM subscribers WHERE email = ? AND ${column} = 1`
  )
    .bind(email)
    .first<SubscriberRow>();

  if (!recipient) {
    return jsonResponse(
      env,
      { error: `No subscriber with email opted into scope '${scope}'` },
      { status: 409 }
    );
  }

  const sendResult = await sendTipEmail(env, recipient, tip);
  if (!sendResult.ok) {
    return jsonResponse(env, { error: 'Send failed', detail: sendResult.detail }, { status: 502 });
  }

  return jsonResponse(env, { ok: true, id: sendResult.id });
}

/**
 * Render and send a tip email: greeting, optional hero image, summary (+ body),
 * a CTA link, and the same compliance footer/headers as sendEmail.
 */
async function sendTipEmail(
  env: Env,
  recipient: SubscriberRow,
  tip: TipPayload
): Promise<{ ok: true; id: string } | { ok: false; detail: string }> {
  const greetingName = recipient.first_name && recipient.first_name.trim().length > 0
    ? recipient.first_name.trim()
    : null;
  const greeting = greetingName ? `Hi ${greetingName},` : 'Hi there,';

  const site = env.SITE_ORIGIN.replace(/\/$/, '');
  const unsubscribeUrl = `${site}/unsubscribe?token=${encodeURIComponent(recipient.unsubscribe_token)}`;
  const preferencesUrl = `${site}/preferences?token=${encodeURIComponent(recipient.unsubscribe_token)}`;

  const heroHtml = tip.heroImage
    ? `<img src="${escapeAttr(tip.heroImage)}" alt="" style="max-width:100%;border-radius:8px;margin:0 0 1rem" />`
    : '';
  const bodyHtml = tip.body ? `<p>${escapeHtml(tip.body)}</p>` : '';
  const ctaHtml = tip.cta
    ? `<p style="margin:1.5rem 0"><a href="${escapeAttr(tip.cta.url!)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">${escapeHtml(tip.cta.label!)}</a></p>`
    : '';

  const html = `<!doctype html><html><body style="font-family:-apple-system,system-ui,sans-serif;color:#1a1a1a;line-height:1.5;max-width:36rem;margin:0 auto">
<p>${greeting}</p>
${heroHtml}
<h2 style="font-size:1.2rem;margin:0 0 .5rem">${escapeHtml(tip.title)}</h2>
<p>${escapeHtml(tip.summary)}</p>
${bodyHtml}
${ctaHtml}
<hr style="border:none;border-top:1px solid #eee;margin:2rem 0">
<p style="font-size:12px;color:#888">
You're receiving this because you subscribed to Mental Health Wallet updates.
<a href="${preferencesUrl}">Manage preferences</a> &middot;
<a href="${unsubscribeUrl}">Unsubscribe</a>
</p>
</body></html>`;

  const ctaText = tip.cta ? `\n\n${tip.cta.label}: ${tip.cta.url}` : '';
  const bodyText = tip.body ? `\n\n${tip.body}` : '';
  const text = `${greeting}\n\n${tip.title}\n\n${tip.summary}${bodyText}${ctaText}\n\n---\nManage preferences: ${preferencesUrl}\nUnsubscribe: ${unsubscribeUrl}`;

  return sendViaResend(env, {
    to: recipient.email,
    subject: tip.title,
    html,
    text,
    unsubscribeUrl,
  });
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

/**
 * Send one email via Resend with the required one-click unsubscribe headers
 * and a personalized greeting (falls back to a neutral greeting).
 */
async function sendEmail(
  env: Env,
  recipient: SubscriberRow,
  subject: string,
  bodyText: string
): Promise<{ ok: true; id: string } | { ok: false; detail: string }> {
  const greetingName = recipient.first_name && recipient.first_name.trim().length > 0
    ? recipient.first_name.trim()
    : null;
  const greeting = greetingName ? `Hi ${greetingName},` : 'Hi there,';

  const unsubscribeUrl = `${env.SITE_ORIGIN.replace(/\/$/, '')}/unsubscribe?token=${encodeURIComponent(recipient.unsubscribe_token)}`;
  const preferencesUrl = `${env.SITE_ORIGIN.replace(/\/$/, '')}/preferences?token=${encodeURIComponent(recipient.unsubscribe_token)}`;

  const html = `<!doctype html><html><body style="font-family:-apple-system,system-ui,sans-serif;color:#1a1a1a;line-height:1.5">
<p>${greeting}</p>
<p>${escapeHtml(bodyText)}</p>
<hr style="border:none;border-top:1px solid #eee;margin:2rem 0">
<p style="font-size:12px;color:#888">
You're receiving this because you subscribed to Mental Health Wallet updates.
<a href="${preferencesUrl}">Manage preferences</a> &middot;
<a href="${unsubscribeUrl}">Unsubscribe</a>
</p>
</body></html>`;

  const text = `${greeting}\n\n${bodyText}\n\n---\nManage preferences: ${preferencesUrl}\nUnsubscribe: ${unsubscribeUrl}`;

  return sendViaResend(env, {
    to: recipient.email,
    subject,
    html,
    text,
    unsubscribeUrl,
  });
}

/**
 * Shared Resend send: applies sender identity and the one-click unsubscribe
 * headers, and normalizes the success/error result. Used by both sendEmail
 * and sendTipEmail.
 */
async function sendViaResend(
  env: Env,
  msg: { to: string; subject: string; html: string; text: string; unsubscribeUrl: string }
): Promise<{ ok: true; id: string } | { ok: false; detail: string }> {
  const payload = {
    from: env.EMAIL_FROM,
    to: [msg.to],
    reply_to: env.EMAIL_REPLY_TO,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    headers: {
      'List-Unsubscribe': `<${msg.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, detail: `${res.status}: ${detail}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id || 'unknown' };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// --- Main Fetch Handler ---

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === '/subscribe' && request.method === 'POST') return await handleSubscribe(request, env);
      if (path === '/preferences' && request.method === 'GET') return await handleGetPreferences(request, env);
      if (path === '/preferences' && request.method === 'POST') return await handlePreferences(request, env);
      if (path === '/unsubscribe' && request.method === 'GET') return await handleUnsubscribe(request, env);
      if (path === '/subscribers' && request.method === 'GET') return await handleSubscribers(request, env);
      if (path === '/send-test' && request.method === 'POST') return await handleSendTest(request, env);
      if (path === '/send-tip' && request.method === 'POST') return await handleSendTip(request, env);

      if ((path === '/' || path === '/health') && request.method === 'GET') {
        return jsonResponse(env, { status: 'ok', service: 'mental-wallet-messaging' });
      }

      return jsonResponse(env, { error: 'Not found' }, { status: 404 });
    } catch (err) {
      // Return a proper JSON error WITH CORS headers. Without this, an unhandled
      // exception yields a bare 500 that the browser misreports as a CORS failure.
      const detail = err instanceof Error ? err.message : String(err);
      const isD1Limit = detail.includes('daily row read limit') || detail.includes('D1_ERROR');
      return jsonResponse(
        env,
        {
          error: isD1Limit ? 'Service temporarily unavailable' : 'Internal error',
          detail,
        },
        { status: isD1Limit ? 503 : 500 }
      );
    }
  },
};
