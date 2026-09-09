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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
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

  // Optional: record this send in tip_sends so a later campaign for the same tip skips
  // this recipient. Off by default so preview/test sends don't pollute dedupe history.
  // Requires tip_slug (the dedupe key); if record is requested without it, reject.
  const record = body.record === true;
  const tipSlug = typeof body.tip_slug === 'string' ? body.tip_slug.trim() : '';
  if (record && !tipSlug) {
    return jsonResponse(
      env,
      { error: 'record:true requires tip_slug (the dedupe key used by campaigns)' },
      { status: 400 }
    );
  }

  const idempotencyKey = record && tipSlug ? `${tipSlug}:${recipient.email}` : undefined;
  const sendResult = await sendTipEmail(env, recipient, tip, idempotencyKey);
  if (!sendResult.ok) {
    return jsonResponse(env, { error: 'Send failed', detail: sendResult.detail }, { status: 502 });
  }

  // Record a 'sent' row (tip-keyed) when requested, so campaigns dedupe against it.
  if (record && tipSlug) {
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO tip_sends (id, tip_slug, email, campaign_id, status, resend_id, sent_at, created_at, updated_at)
       VALUES (?, ?, ?, NULL, 'sent', ?, ?, ?, ?)
       ON CONFLICT (tip_slug, email) DO UPDATE SET
         status = 'sent', resend_id = excluded.resend_id, error = NULL,
         sent_at = excluded.sent_at, updated_at = excluded.updated_at`
    ).bind(crypto.randomUUID(), tipSlug, recipient.email, sendResult.id, now, now, now).run();
  }

  return jsonResponse(env, { ok: true, id: sendResult.id, recorded: record });
}

/**
 * Render and send a tip email: greeting, optional hero image, summary (+ body),
 * a CTA link, and the same compliance footer/headers as sendEmail.
 */
async function sendTipEmail(
  env: Env,
  recipient: SubscriberRow,
  tip: TipPayload,
  idempotencyKey?: string
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
<p style="margin:1.5rem 0 0">Cheers,<br>Moshe<br>Products for Good</p>
<hr style="border:none;border-top:1px solid #eee;margin:2rem 0">
<p style="font-size:12px;color:#888">
You're receiving this because you subscribed to Mental Health Wallet updates.
<a href="${preferencesUrl}">Manage preferences</a> &middot;
<a href="${unsubscribeUrl}">Unsubscribe</a>
</p>
</body></html>`;

  const ctaText = tip.cta ? `\n\n${tip.cta.label}: ${tip.cta.url}` : '';
  const bodyText = tip.body ? `\n\n${tip.body}` : '';
  const signatureText = `\n\nCheers,\nMoshe\nProducts for Good`;
  const text = `${greeting}\n\n${tip.title}\n\n${tip.summary}${bodyText}${ctaText}${signatureText}\n\n---\nManage preferences: ${preferencesUrl}\nUnsubscribe: ${unsubscribeUrl}`;

  return sendViaResend(env, {
    to: recipient.email,
    subject: tip.title,
    html,
    text,
    unsubscribeUrl,
    idempotencyKey,
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
  msg: { to: string; subject: string; html: string; text: string; unsubscribeUrl: string; idempotencyKey?: string }
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

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
  };
  // Resend de-duplicates identical sends carrying the same Idempotency-Key, closing the
  // crash-between-send-and-record window (at-most-once).
  if (msg.idempotencyKey) reqHeaders['Idempotency-Key'] = msg.idempotencyKey;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: reqHeaders,
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

// ============================================================================
// Campaigns (batch send) — Requirements: messaging-batch-send
// ============================================================================

type CampaignScope = Scope;
type CampaignMode = 'new_only' | 'resend_all';
type CampaignStatus = 'draft' | 'sending' | 'sent' | 'paused';

interface CampaignRow {
  id: string;
  name: string;
  tip_slug: string;
  scope: CampaignScope;
  mode: CampaignMode;
  status: CampaignStatus;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
}

function isScope(v: unknown): v is CampaignScope {
  return v === 'tips' || v === 'reminders';
}
function isMode(v: unknown): v is CampaignMode {
  return v === 'new_only' || v === 'resend_all';
}

async function getCampaign(env: Env, id: string): Promise<CampaignRow | null> {
  return env.DB.prepare('SELECT * FROM campaigns WHERE id = ?').bind(id).first<CampaignRow>();
}

/** Send counts for a campaign's tip (dedupe is tip-keyed, so counts are by tip_slug). */
async function tipSendCounts(env: Env, tipSlug: string): Promise<{ sent: number; failed: number; pending: number }> {
  const row = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
     FROM tip_sends WHERE tip_slug = ?`
  ).bind(tipSlug).first<{ sent: number | null; failed: number | null; pending: number | null }>();
  return { sent: row?.sent || 0, failed: row?.failed || 0, pending: row?.pending || 0 };
}

// --- POST /campaigns (create) ---

async function handleCreateCampaign(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(env, { error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const tipSlug = typeof body.tip_slug === 'string' ? body.tip_slug.trim() : '';
  const scope = body.scope;
  const mode = 'mode' in body ? body.mode : 'new_only';

  if (!name) return jsonResponse(env, { error: 'name is required' }, { status: 400 });
  if (!tipSlug) return jsonResponse(env, { error: 'tip_slug is required' }, { status: 400 });
  if (!isScope(scope)) return jsonResponse(env, { error: "scope must be 'tips' or 'reminders'" }, { status: 400 });
  if (!isMode(mode)) return jsonResponse(env, { error: "mode must be 'new_only' or 'resend_all'" }, { status: 400 });

  // Unique name check (friendly 409 rather than relying on the DB constraint error).
  const existing = await env.DB.prepare('SELECT id FROM campaigns WHERE name = ?').bind(name).first();
  if (existing) {
    return jsonResponse(env, { error: `A campaign named "${name}" already exists` }, { status: 409 });
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      `INSERT INTO campaigns (id, name, tip_slug, scope, mode, status, created_at, updated_at, last_run_at)
       VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, NULL)`
    ).bind(id, name, tipSlug, scope, mode, now, now).run();
  } catch (err) {
    // Unique constraint race, or other write failure.
    const detail = err instanceof Error ? err.message : String(err);
    if (detail.includes('UNIQUE')) {
      return jsonResponse(env, { error: `A campaign named "${name}" already exists` }, { status: 409 });
    }
    throw err;
  }

  const campaign = await getCampaign(env, id);
  return jsonResponse(env, { ok: true, campaign }, { status: 201 });
}

// --- GET /campaigns (list all) ---

async function handleListCampaigns(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);

  const result = await env.DB.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all<CampaignRow>();
  const campaigns = [];
  for (const c of result.results) {
    const counts = await tipSendCounts(env, c.tip_slug);
    campaigns.push({ ...c, counts });
  }
  return jsonResponse(env, { count: campaigns.length, campaigns });
}

// --- GET /campaigns/:id (read one) ---

async function handleGetCampaign(request: Request, env: Env, id: string): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);

  const campaign = await getCampaign(env, id);
  if (!campaign) return jsonResponse(env, { error: 'Campaign not found' }, { status: 404 });

  const counts = await tipSendCounts(env, campaign.tip_slug);
  return jsonResponse(env, { campaign: { ...campaign, counts } });
}

// --- PUT/PATCH /campaigns/:id (update a not-yet-sent campaign) ---

async function handleUpdateCampaign(request: Request, env: Env, id: string): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);

  const campaign = await getCampaign(env, id);
  if (!campaign) return jsonResponse(env, { error: 'Campaign not found' }, { status: 404 });

  // Block destructive edits once it has sent or is sending (Requirement 1.5).
  if (campaign.status === 'sent' || campaign.status === 'sending') {
    return jsonResponse(
      env,
      { error: `Cannot edit a campaign with status '${campaign.status}'. Only draft/paused campaigns are editable.` },
      { status: 409 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(env, { error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = 'name' in body ? (typeof body.name === 'string' ? body.name.trim() : '') : campaign.name;
  const tipSlug = 'tip_slug' in body ? (typeof body.tip_slug === 'string' ? body.tip_slug.trim() : '') : campaign.tip_slug;
  const scope = 'scope' in body ? body.scope : campaign.scope;
  const mode = 'mode' in body ? body.mode : campaign.mode;

  if (!name) return jsonResponse(env, { error: 'name cannot be empty' }, { status: 400 });
  if (!tipSlug) return jsonResponse(env, { error: 'tip_slug cannot be empty' }, { status: 400 });
  if (!isScope(scope)) return jsonResponse(env, { error: "scope must be 'tips' or 'reminders'" }, { status: 400 });
  if (!isMode(mode)) return jsonResponse(env, { error: "mode must be 'new_only' or 'resend_all'" }, { status: 400 });

  // Name uniqueness (excluding this campaign).
  if (name !== campaign.name) {
    const clash = await env.DB.prepare('SELECT id FROM campaigns WHERE name = ? AND id != ?').bind(name, id).first();
    if (clash) return jsonResponse(env, { error: `A campaign named "${name}" already exists` }, { status: 409 });
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE campaigns SET name = ?, tip_slug = ?, scope = ?, mode = ?, updated_at = ? WHERE id = ?`
  ).bind(name, tipSlug, scope, mode, now, id).run();

  return jsonResponse(env, { ok: true, campaign: await getCampaign(env, id) });
}

// --- DELETE /campaigns/:id (leaves tip_sends intact) ---

async function handleDeleteCampaign(request: Request, env: Env, id: string): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);

  const campaign = await getCampaign(env, id);
  if (!campaign) return jsonResponse(env, { error: 'Campaign not found' }, { status: 404 });

  // Delete the campaign row only. tip_sends is keyed by tip and preserved so the
  // "already received this tip" history survives (Requirement 1.5 / 5.2).
  await env.DB.prepare('DELETE FROM campaigns WHERE id = ?').bind(id).run();
  return jsonResponse(env, { ok: true, deleted: id });
}

// --- Audience selection ---

/**
 * Recipients for a campaign, per scope + mode, excluding those already sent this tip
 * (new_only) or including all opted-in (resend_all). Returns up to `limit` not-yet-sent
 * subscribers, plus the total counts for reporting.
 */
async function selectAudience(
  env: Env,
  campaign: CampaignRow,
  limit: number
): Promise<{ recipients: SubscriberRow[]; newCount: number; fullCount: number }> {
  const scopeCol = campaign.scope === 'reminders' ? 'scope_reminders' : 'scope_tips';

  // Full opted-in count for this scope.
  const fullRow = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM subscribers WHERE ${scopeCol} = 1`
  ).first<{ c: number }>();
  const fullCount = fullRow?.c || 0;

  // Recipients who have NOT yet received this tip = opted-in AND without a sent/pending
  // tip_sends row (pending is in-doubt and must NOT be blindly resent — at-most-once).
  // This is the chunking/remaining basis for BOTH modes: new_only excludes prior sends
  // permanently, while resend_all clears prior sends once at run start (in the execute
  // handler) so everyone requalifies, then converges via this same exclusion.
  const notYetClause =
    `AND s.email NOT IN (SELECT email FROM tip_sends WHERE tip_slug = ? AND status IN ('sent','pending'))`;

  const newRow = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM subscribers s WHERE s.${scopeCol} = 1 ${notYetClause}`
  ).bind(campaign.tip_slug).first<{ c: number }>();
  const newCount = newRow?.c || 0;

  const result = await env.DB.prepare(
    `SELECT * FROM subscribers s WHERE s.${scopeCol} = 1 ${notYetClause} ORDER BY s.created_at ASC LIMIT ?`
  ).bind(campaign.tip_slug, limit).all<SubscriberRow>();

  return { recipients: result.results, newCount, fullCount };
}

// --- POST /campaigns/:id/execute (chunked, explicit mode) ---

async function handleExecuteCampaign(request: Request, env: Env, id: string): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);

  const campaign = await getCampaign(env, id);
  if (!campaign) return jsonResponse(env, { error: 'Campaign not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(env, { error: 'Invalid JSON body' }, { status: 400 });
  }

  // REQUIRED explicit mode; no dangerous default (Requirement 7.2/7.3).
  const runMode = body.mode;
  if (runMode !== 'dry-run' && runMode !== 'production') {
    return jsonResponse(
      env,
      { error: "mode is required and must be 'dry-run' or 'production'" },
      { status: 400 }
    );
  }

  const limit = typeof body.limit === 'number' && body.limit > 0 ? Math.min(body.limit, 100) : 50;
  const { recipients, newCount, fullCount } = await selectAudience(env, campaign, limit);

  if (runMode === 'dry-run') {
    // Dry-run shows WHO would receive it (not just how many), so the operator can eyeball
    // the list before an irreversible send. Capped so a huge list doesn't blow up the
    // response; `wouldSend` still reflects the true total. Admin-only endpoint, so showing
    // emails (PII) here is consistent with /subscribers.
    const PREVIEW_CAP = 500;
    const scopeCol = campaign.scope === 'reminders' ? 'scope_reminders' : 'scope_tips';
    // new_only previews those not-yet-sent; resend_all previews ALL opted-in (it clears the
    // tip's history at run start, so everyone requalifies).
    const previewRows = await (
      campaign.mode === 'new_only'
        ? env.DB.prepare(
            `SELECT s.email FROM subscribers s WHERE s.${scopeCol} = 1
             AND s.email NOT IN (SELECT email FROM tip_sends WHERE tip_slug = ? AND status IN ('sent','pending'))
             ORDER BY s.created_at ASC LIMIT ?`
          ).bind(campaign.tip_slug, PREVIEW_CAP)
        : env.DB.prepare(
            `SELECT s.email FROM subscribers s WHERE s.${scopeCol} = 1 ORDER BY s.created_at ASC LIMIT ?`
          ).bind(PREVIEW_CAP)
    ).all<{ email: string }>();
    const wouldSend = campaign.mode === 'new_only' ? newCount : fullCount;
    const recipientEmails = previewRows.results.map((r) => r.email);

    return jsonResponse(env, {
      ok: true,
      mode: 'dry-run',
      tip_slug: campaign.tip_slug,
      scope: campaign.scope,
      campaignMode: campaign.mode,
      wouldSend,
      newOnlyCount: newCount,
      fullAudienceCount: fullCount,
      recipients: recipientEmails,
      recipientsTruncated: wouldSend > recipientEmails.length,
    });
  }

  // --- production ---
  const tip = parseTip(body.tip);
  if (!tip) {
    return jsonResponse(env, { error: 'production send requires tip.title and tip.summary' }, { status: 400 });
  }

  const scopeCol = campaign.scope === 'reminders' ? 'scope_reminders' : 'scope_tips';
  const now = new Date().toISOString();

  // resend_all intent = "reach everyone again". Since dedupe is tip-keyed, a deliberate
  // full re-send clears this tip's prior send records ONCE at the start of a fresh run
  // (only when the campaign isn't already mid-send), so all opted-in recipients requalify.
  // After that, both modes proceed identically: exclude sent/pending as they go, so a
  // resumed run never double-sends within the run.
  if (campaign.mode === 'resend_all' && campaign.status !== 'sending') {
    await env.DB.prepare('DELETE FROM tip_sends WHERE tip_slug = ?').bind(campaign.tip_slug).run();
  }

  await env.DB.prepare("UPDATE campaigns SET status = 'sending', last_run_at = ?, updated_at = ? WHERE id = ?")
    .bind(now, now, id).run();

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const recipient of recipients) {
    // Re-check consent right now (Requirement 3.1) — the list may be stale mid-run.
    const fresh = await env.DB.prepare(`SELECT * FROM subscribers WHERE email = ?`).bind(recipient.email).first<SubscriberRow>();
    if (!fresh || (fresh as unknown as Record<string, number>)[scopeCol] !== 1) {
      skipped++;
      continue;
    }

    // Skip if already sent/pending for this tip (idempotency; new_only already excludes,
    // but this guards resend_all and concurrent runs).
    const already = await env.DB.prepare(
      `SELECT status FROM tip_sends WHERE tip_slug = ? AND email = ?`
    ).bind(campaign.tip_slug, recipient.email).first<{ status: string }>();
    if (already && (already.status === 'sent' || already.status === 'pending')) {
      skipped++;
      continue;
    }

    // Write intent (pending) BEFORE sending, so a crash mid-send is recoverable and not
    // blindly resent (at-most-once, Requirement 5.6).
    const rowId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO tip_sends (id, tip_slug, email, campaign_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?)
       ON CONFLICT (tip_slug, email) DO UPDATE SET status = 'pending', campaign_id = excluded.campaign_id, updated_at = excluded.updated_at
       WHERE tip_sends.status = 'failed'`
    ).bind(rowId, campaign.tip_slug, recipient.email, id, now, now).run();

    // Send individually (never BCC) via the shared renderer, with a Resend idempotency key.
    const idempotencyKey = `${campaign.tip_slug}:${recipient.email}`;
    const result = await sendTipEmail(env, fresh, tip, idempotencyKey);

    const ts = new Date().toISOString();
    if (result.ok) {
      await env.DB.prepare(
        `UPDATE tip_sends SET status = 'sent', resend_id = ?, error = NULL, sent_at = ?, updated_at = ? WHERE tip_slug = ? AND email = ?`
      ).bind(result.id, ts, ts, campaign.tip_slug, recipient.email).run();
      sent++;
    } else {
      await env.DB.prepare(
        `UPDATE tip_sends SET status = 'failed', error = ?, updated_at = ? WHERE tip_slug = ? AND email = ?`
      ).bind(result.detail, ts, campaign.tip_slug, recipient.email).run();
      failed++;
    }
  }

  // Recompute how many not-yet-sent recipients remain for this tip. Both modes converge
  // on the same "not yet sent/pending" query after a chunk: newCount reflects opted-in
  // recipients without a sent/pending tip_sends row.
  const after = await selectAudience(env, campaign, 1);
  const remainingCount = after.newCount;

  const doneStatus: CampaignStatus = remainingCount > 0 ? 'sending' : 'sent';
  const finishedAt = new Date().toISOString();
  await env.DB.prepare('UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?')
    .bind(doneStatus, finishedAt, id).run();

  return jsonResponse(env, {
    ok: true,
    mode: 'production',
    sent,
    failed,
    skipped,
    remaining: remainingCount,
    status: doneStatus,
  });
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

      // --- Campaign routes (admin) ---
      if (path === '/campaigns' && request.method === 'POST') return await handleCreateCampaign(request, env);
      if (path === '/campaigns' && request.method === 'GET') return await handleListCampaigns(request, env);
      const campaignExecMatch = path.match(/^\/campaigns\/([^/]+)\/execute$/);
      if (campaignExecMatch && request.method === 'POST') return await handleExecuteCampaign(request, env, decodeURIComponent(campaignExecMatch[1]));
      const campaignIdMatch = path.match(/^\/campaigns\/([^/]+)$/);
      if (campaignIdMatch) {
        const campaignId = decodeURIComponent(campaignIdMatch[1]);
        if (request.method === 'GET') return await handleGetCampaign(request, env, campaignId);
        if (request.method === 'PUT' || request.method === 'PATCH') return await handleUpdateCampaign(request, env, campaignId);
        if (request.method === 'DELETE') return await handleDeleteCampaign(request, env, campaignId);
      }

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
