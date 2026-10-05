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

import { resolveNextStep, deriveTestAges, type SequenceStep } from './drip';
import { ADMIN_HTML } from './adminPage';

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

/**
 * One entry in the website's generated content index (/content/index.json).
 * The drip pass fetches this to get tip content server-side (the worker has no filesystem
 * access to content/tips/*.md; local scripts pass content in by request body, but the cron
 * cannot). The index carries exactly the fields the email needs: title, summary, heroImage,
 * cta. Body is intentionally absent (email leads with summary + CTA; the body lives on the
 * web page the CTA links to).
 */
interface ContentIndexEntry {
  slug: string;
  title: string;
  summary: string;
  heroImage?: string;
  cta?: { label?: string; url?: string };
}

/**
 * Fetch the published content index from the marketing site and return a slug -> TipPayload
 * map. Returns null on fetch/parse failure (caller treats that day's run as a no-op; the
 * next day retries). Keyed off SITE_ORIGIN, the marketing site that hosts the index.
 */
async function fetchTipIndex(env: Env): Promise<Map<string, TipPayload> | null> {
  const base = (env.SITE_ORIGIN || '').replace(/\/$/, '');
  if (!base) return null;
  try {
    const res = await fetch(`${base}/content/index.json`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const entries = (await res.json()) as ContentIndexEntry[];
    if (!Array.isArray(entries)) return null;
    const map = new Map<string, TipPayload>();
    for (const e of entries) {
      const tip = parseTip(e);
      if (tip && typeof e.slug === 'string') map.set(e.slug, tip);
    }
    return map;
  } catch {
    return null;
  }
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

  // One-off test send. It does NOT write a tip_sends row: dedupe is now per CAMPAIGN
  // (see migration 0004 / the drip spec), and a campaign-less test send has no campaign to
  // record against. The old `record`/`tip_slug` option (which wrote tip-keyed rows so a
  // later campaign for the same tip would skip the recipient) was removed because tips may
  // now intentionally recur across campaigns. If `record` is passed, we ignore it and say so.
  const recordRequested = body.record === true;

  const sendResult = await sendTipEmail(env, recipient, tip, undefined);
  if (!sendResult.ok) {
    return jsonResponse(env, { error: 'Send failed', detail: sendResult.detail }, { status: 502 });
  }

  return jsonResponse(env, {
    ok: true,
    id: sendResult.id,
    recorded: false,
    ...(recordRequested
      ? { note: 'record is no longer supported: dedupe is per-campaign; a one-off test send is not recorded.' }
      : {}),
  });
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
  // Render the body as SEPARATE paragraphs so it doesn't collapse into one wall of text.
  // Split on blank lines → one <p> per paragraph. Single newlines WITHIN a paragraph are
  // just source-wrapping (the markdown wraps prose at ~90 chars), not intentional breaks, so
  // collapse them to spaces to keep prose flowing. Still fully escaped (plain-text-safe) —
  // no rich HTML in email (see the email-inline-media spec for the future richer path).
  const bodyHtml = tip.body
    ? tip.body
        .split(/\n\s*\n/)
        .map((para) => para.trim().replace(/\s*\n\s*/g, ' '))
        .filter((para) => para.length > 0)
        .map((para) => `<p>${escapeHtml(para)}</p>`)
        .join('\n')
    : '';
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
  // Plain-text body: collapse source line-wrapping within each paragraph to spaces, keep
  // blank lines between paragraphs.
  const bodyTextClean = tip.body
    ? tip.body
        .split(/\n\s*\n/)
        .map((para) => para.trim().replace(/\s*\n\s*/g, ' '))
        .filter((para) => para.length > 0)
        .join('\n\n')
    : '';
  const bodyText = bodyTextClean ? `\n\n${bodyTextClean}` : '';
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
  gap_days: number;
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
/** Parse a gap_days value, clamping to an integer >= 1. Defaults to 1 when absent/invalid. */
function parseGapDays(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

async function getCampaign(env: Env, id: string): Promise<CampaignRow | null> {
  return env.DB.prepare('SELECT * FROM campaigns WHERE id = ?').bind(id).first<CampaignRow>();
}

/** Send counts for a campaign (dedupe is campaign-keyed, so counts are by campaign_id). */
async function campaignSendCounts(env: Env, campaignId: string): Promise<{ sent: number; failed: number; pending: number }> {
  const row = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
     FROM tip_sends WHERE campaign_id = ?`
  ).bind(campaignId).first<{ sent: number | null; failed: number | null; pending: number | null }>();
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
  const gapDays = parseGapDays(body.gap_days);

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
      `INSERT INTO campaigns (id, name, tip_slug, scope, mode, gap_days, status, created_at, updated_at, last_run_at)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, NULL)`
    ).bind(id, name, tipSlug, scope, mode, gapDays, now, now).run();
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
    const counts = await campaignSendCounts(env, c.id);
    campaigns.push({ ...c, counts });
  }
  return jsonResponse(env, { count: campaigns.length, campaigns });
}

// --- GET /campaigns/:id (read one) ---

async function handleGetCampaign(request: Request, env: Env, id: string): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);

  const campaign = await getCampaign(env, id);
  if (!campaign) return jsonResponse(env, { error: 'Campaign not found' }, { status: 404 });

  const counts = await campaignSendCounts(env, campaign.id);
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
  const gapDays = 'gap_days' in body ? parseGapDays(body.gap_days) : campaign.gap_days;

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
    `UPDATE campaigns SET name = ?, tip_slug = ?, scope = ?, mode = ?, gap_days = ?, updated_at = ? WHERE id = ?`
  ).bind(name, tipSlug, scope, mode, gapDays, now, id).run();

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
 * Today's calendar date in UTC as `YYYY-MM-DD`, matching the date portion of the ISO
 * `sent_at` timestamps stored in tip_sends. Used by the same-day fatigue guard.
 */
function utcToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * N-day gap cutoff (Requirement 5): the earliest `sent_at` that still counts against a
 * subscriber for a campaign with the given `gapDays`. A subscriber is eligible only if they
 * have NO `sent` email at/after this cutoff.
 *
 * cutoff = start-of-day UTC of (today - (gapDays - 1)).
 *   - gapDays = 1 -> cutoff = start of today -> excludes anyone emailed today (the old
 *     same-day guard, exactly).
 *   - gapDays = 7 -> cutoff = start of 6 days ago -> excludes anyone emailed in the last
 *     7 calendar days (today + the 6 prior).
 *
 * `gapDays` is clamped to a minimum of 1. `now` is injectable for the test harness.
 */
function gapCutoffISO(gapDays: number, now: Date = new Date()): string {
  const g = Math.max(1, Math.floor(gapDays || 1));
  const todayMidUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const cutoffMs = todayMidUTC - (g - 1) * 24 * 60 * 60 * 1000;
  return new Date(cutoffMs).toISOString();
}

/**
 * N-day gap fatigue guard (Requirement 5): exclude any recipient who received an email from
 * us within the campaign's gap window, regardless of which campaign/tip. Cross-campaign —
 * distinct from the per-campaign dedupe. Only `sent` rows count (a pending/failed attempt
 * must not permanently shield a recipient). The bind parameter is the gap cutoff ISO
 * timestamp from `gapCutoffISO()`. A gap of 1 reproduces the old same-day guard.
 */
const GAP_CLAUSE =
  `AND s.email NOT IN (SELECT email FROM tip_sends WHERE status = 'sent' AND sent_at >= ?)`;

/**
 * Recipients for a campaign, per scope + mode, excluding those already sent this tip
 * (new_only) or including all opted-in (resend_all), AND excluding anyone who already got
 * an email today (same-day fatigue guard, Requirement 10). Returns up to `limit` eligible
 * subscribers, plus the total counts for reporting.
 */
async function selectAudience(
  env: Env,
  campaign: CampaignRow,
  limit: number,
  now: Date = new Date()
): Promise<{ recipients: SubscriberRow[]; newCount: number; fullCount: number }> {
  const scopeCol = campaign.scope === 'reminders' ? 'scope_reminders' : 'scope_tips';
  // N-day gap cutoff for this campaign (gap_days defaults/clamps to >= 1).
  const gapCutoff = gapCutoffISO(campaign.gap_days, now);

  // Full opted-in count for this scope.
  const fullRow = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM subscribers WHERE ${scopeCol} = 1`
  ).first<{ c: number }>();
  const fullCount = fullRow?.c || 0;

  // Recipients who have NOT yet received THIS CAMPAIGN = opted-in AND without a sent/pending
  // tip_sends row for this campaign_id (pending is in-doubt and must NOT be blindly resent —
  // at-most-once). Dedupe is per CAMPAIGN (not per tip), so the same tip delivered by a
  // different campaign is NOT skipped. new_only excludes this campaign's prior sends
  // permanently; resend_all clears this campaign's prior sends once at run start (in the
  // execute handler) so everyone requalifies, then converges via this same exclusion.
  const notYetClause =
    `AND s.email NOT IN (SELECT email FROM tip_sends WHERE campaign_id = ? AND status IN ('sent','pending'))`;

  // Both counts and the recipient list also honor the N-day gap, so dry-run reflects the true
  // post-gap audience. Bind order: campaign_id, then the gap cutoff.
  const newRow = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM subscribers s WHERE s.${scopeCol} = 1 ${notYetClause} ${GAP_CLAUSE}`
  ).bind(campaign.id, gapCutoff).first<{ c: number }>();
  const newCount = newRow?.c || 0;

  const result = await env.DB.prepare(
    `SELECT * FROM subscribers s WHERE s.${scopeCol} = 1 ${notYetClause} ${GAP_CLAUSE} ORDER BY s.created_at ASC LIMIT ?`
  ).bind(campaign.id, gapCutoff, limit).all<SubscriberRow>();

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
    const gapCutoff = gapCutoffISO(campaign.gap_days);
    // new_only previews those not-yet-sent for THIS CAMPAIGN; resend_all previews ALL opted-in
    // (it clears this campaign's history at run start, so everyone requalifies). BOTH also
    // honor the N-day gap so the preview matches what will actually send.
    const previewRows = await (
      campaign.mode === 'new_only'
        ? env.DB.prepare(
            `SELECT s.email FROM subscribers s WHERE s.${scopeCol} = 1
             AND s.email NOT IN (SELECT email FROM tip_sends WHERE campaign_id = ? AND status IN ('sent','pending'))
             ${GAP_CLAUSE}
             ORDER BY s.created_at ASC LIMIT ?`
          ).bind(campaign.id, gapCutoff, PREVIEW_CAP)
        : env.DB.prepare(
            `SELECT s.email FROM subscribers s WHERE s.${scopeCol} = 1
             ${GAP_CLAUSE}
             ORDER BY s.created_at ASC LIMIT ?`
          ).bind(gapCutoff, PREVIEW_CAP)
    ).all<{ email: string }>();
    // For resend_all, fullCount is the raw opted-in total; subtract those within the gap
    // window so wouldSend reflects the post-gap audience.
    let resendAllWouldSend = fullCount;
    if (campaign.mode === 'resend_all') {
      const guardedRow = await env.DB.prepare(
        `SELECT COUNT(*) as c FROM subscribers s WHERE s.${scopeCol} = 1 ${GAP_CLAUSE}`
      ).bind(gapCutoff).first<{ c: number }>();
      resendAllWouldSend = guardedRow?.c ?? fullCount;
    }
    const wouldSend = campaign.mode === 'new_only' ? newCount : resendAllWouldSend;
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

  // resend_all intent = "reach everyone again". Since dedupe is campaign-keyed, a deliberate
  // full re-send clears THIS CAMPAIGN's prior send records ONCE at the start of a fresh run
  // (only when the campaign isn't already mid-send), so all opted-in recipients requalify.
  // After that, both modes proceed identically: exclude sent/pending as they go, so a
  // resumed run never double-sends within the run.
  if (campaign.mode === 'resend_all' && campaign.status !== 'sending') {
    await env.DB.prepare('DELETE FROM tip_sends WHERE campaign_id = ?').bind(campaign.id).run();
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

    // Skip if already sent/pending for THIS CAMPAIGN (idempotency; new_only already excludes,
    // but this guards resend_all and concurrent runs).
    const already = await env.DB.prepare(
      `SELECT status FROM tip_sends WHERE campaign_id = ? AND email = ?`
    ).bind(campaign.id, recipient.email).first<{ status: string }>();
    if (already && (already.status === 'sent' || already.status === 'pending')) {
      skipped++;
      continue;
    }

    // N-day gap guard: re-check at send time so a recipient who got any email from us within
    // this campaign's gap window (e.g. via a concurrent campaign after the list was selected)
    // is skipped, not emailed too soon. Only 'sent' rows count; deferred (not marked for this
    // campaign), so they requalify once the gap passes.
    const withinGap = await env.DB.prepare(
      `SELECT 1 FROM tip_sends WHERE email = ? AND status = 'sent' AND sent_at >= ? LIMIT 1`
    ).bind(recipient.email, gapCutoffISO(campaign.gap_days)).first<{ 1: number }>();
    if (withinGap) {
      skipped++;
      continue;
    }

    // Write intent (pending) BEFORE sending, so a crash mid-send is recoverable and not
    // blindly resent (at-most-once). Keyed by (campaign_id, email); tip_slug stored for audit.
    const rowId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO tip_sends (id, campaign_id, tip_slug, email, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?)
       ON CONFLICT (campaign_id, email) DO UPDATE SET status = 'pending', updated_at = excluded.updated_at
       WHERE tip_sends.status = 'failed'`
    ).bind(rowId, id, campaign.tip_slug, recipient.email, now, now).run();

    // Send individually (never BCC) via the shared renderer, with a Resend idempotency key.
    // Keyed by campaign+email so repeating a tip via a new campaign is NOT collapsed by Resend.
    const idempotencyKey = `${campaign.id}:${recipient.email}`;
    const result = await sendTipEmail(env, fresh, tip, idempotencyKey);

    const ts = new Date().toISOString();
    if (result.ok) {
      await env.DB.prepare(
        `UPDATE tip_sends SET status = 'sent', resend_id = ?, error = NULL, sent_at = ?, updated_at = ? WHERE campaign_id = ? AND email = ?`
      ).bind(result.id, ts, ts, campaign.id, recipient.email).run();
      sent++;
    } else {
      await env.DB.prepare(
        `UPDATE tip_sends SET status = 'failed', error = ?, updated_at = ? WHERE campaign_id = ? AND email = ?`
      ).bind(result.detail, ts, campaign.id, recipient.email).run();
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

// =====================================================================================
// Drip sequence: the single global ordered list of campaigns, derived per-subscriber
// advancement, and the sequence-edit admin endpoints.
// =====================================================================================

interface SequenceStepRow extends SequenceStep {
  created_at: string;
  updated_at: string;
}

/** All sequence steps, position order. */
async function getSequenceSteps(env: Env): Promise<SequenceStepRow[]> {
  const res = await env.DB.prepare(
    'SELECT id, campaign_id, position, enabled, created_at, updated_at FROM sequence_steps ORDER BY position ASC'
  ).all<SequenceStepRow>();
  return res.results || [];
}

/** The campaign_ids a subscriber has already received (a 'sent' tip_sends row). */
async function receivedCampaignIds(env: Env, email: string): Promise<Set<string>> {
  const res = await env.DB.prepare(
    `SELECT DISTINCT campaign_id FROM tip_sends WHERE email = ? AND status = 'sent'`
  ).bind(email).all<{ campaign_id: string }>();
  return new Set((res.results || []).map((r) => r.campaign_id));
}

/**
 * Resolve the next campaign for one subscriber against the live sequence, using the pure
 * resolveNextStep over DB-derived facts. Eligibility for the frontier step = opted into the
 * campaign's scope AND the campaign's N-day gap satisfied (no 'sent' email since the cutoff).
 * `now` is injectable for the test harness (Phase 4).
 */
async function resolveNextForSubscriber(
  env: Env,
  subscriber: SubscriberRow,
  steps: SequenceStepRow[],
  campaignsById: Map<string, CampaignRow>,
  now: Date = new Date()
): Promise<{ kind: 'next' | 'waiting' | 'finished'; campaign?: CampaignRow }> {
  const received = await receivedCampaignIds(env, subscriber.email);

  // Resolve synchronously via the pure function; eligibility needs async DB checks, so we
  // first find the frontier step (earliest unreceived enabled) with an always-eligible probe,
  // then evaluate real eligibility on just that step.
  const frontier = resolveNextStep(steps, (c) => received.has(c), () => true);
  if (frontier.kind === 'finished') return { kind: 'finished' };

  const step = frontier.step;
  const campaign = campaignsById.get(step.campaign_id);
  if (!campaign) {
    // Step points at a missing campaign — treat as not sendable; waiting.
    return { kind: 'waiting' };
  }

  // Eligibility: scope opt-in + gap.
  const scopeOptedIn =
    campaign.scope === 'reminders'
      ? (subscriber as unknown as Record<string, number>).scope_reminders === 1
      : (subscriber as unknown as Record<string, number>).scope_tips === 1;
  if (!scopeOptedIn) return { kind: 'waiting', campaign };

  const gapCutoff = gapCutoffISO(campaign.gap_days, now);
  const withinGap = await env.DB.prepare(
    `SELECT 1 FROM tip_sends WHERE email = ? AND status = 'sent' AND sent_at >= ? LIMIT 1`
  ).bind(subscriber.email, gapCutoff).first<{ 1: number }>();
  if (withinGap) return { kind: 'waiting', campaign };

  return { kind: 'next', campaign };
}

/** Map of campaign_id -> campaign, for all campaigns referenced by the sequence. */
async function loadCampaignsForSteps(env: Env, steps: SequenceStepRow[]): Promise<Map<string, CampaignRow>> {
  const map = new Map<string, CampaignRow>();
  for (const s of steps) {
    if (map.has(s.campaign_id)) continue;
    const c = await getCampaign(env, s.campaign_id);
    if (c) map.set(c.id, c);
  }
  return map;
}

// --- GET /drip/sequence (admin): the ordered sequence with campaign details ---

async function handleGetSequence(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);
  const steps = await getSequenceSteps(env);
  const campaignsById = await loadCampaignsForSteps(env, steps);
  const detailed = steps.map((s) => {
    const c = campaignsById.get(s.campaign_id);
    return {
      id: s.id,
      position: s.position,
      enabled: s.enabled === 1,
      campaign_id: s.campaign_id,
      campaign_name: c?.name ?? null,
      tip_slug: c?.tip_slug ?? null,
      scope: c?.scope ?? null,
      gap_days: c?.gap_days ?? null,
    };
  });
  return jsonResponse(env, { count: detailed.length, steps: detailed });
}

// --- POST /drip/sequence/steps (admin): add a campaign as a step ---
// Body: { campaign_id, position? }. Appends to the end if position omitted. Building the
// sequence from scratch = adding the first step to an empty table (no seed action).

async function handleAddSequenceStep(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; }
  catch { return jsonResponse(env, { error: 'Invalid JSON body' }, { status: 400 }); }

  const campaignId = typeof body.campaign_id === 'string' ? body.campaign_id.trim() : '';
  if (!campaignId) return jsonResponse(env, { error: 'campaign_id is required' }, { status: 400 });

  const campaign = await getCampaign(env, campaignId);
  if (!campaign) return jsonResponse(env, { error: 'Campaign not found' }, { status: 404 });

  // One appearance per campaign in the sequence (UNIQUE campaign_id).
  const existing = await env.DB.prepare('SELECT id FROM sequence_steps WHERE campaign_id = ?').bind(campaignId).first();
  if (existing) return jsonResponse(env, { error: 'Campaign is already in the sequence' }, { status: 409 });

  // Default position = end of the sequence.
  const maxRow = await env.DB.prepare('SELECT MAX(position) as m FROM sequence_steps').first<{ m: number | null }>();
  const nextPos = (maxRow?.m ?? 0) + 1;
  const position = typeof body.position === 'number' ? Math.floor(body.position) : nextPos;

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  // If inserting at an occupied position, shift later steps down to keep positions unique.
  await env.DB.prepare('UPDATE sequence_steps SET position = position + 1, updated_at = ? WHERE position >= ?')
    .bind(now, position).run();
  await env.DB.prepare(
    `INSERT INTO sequence_steps (id, campaign_id, position, enabled, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?)`
  ).bind(id, campaignId, position, now, now).run();

  return jsonResponse(env, { ok: true }, { status: 201 });
}

// --- PATCH /drip/sequence/steps/:id (admin): enable/disable or move a step ---
// Body: { enabled? } to toggle, { position? } to move.

async function handleUpdateSequenceStep(request: Request, env: Env, stepId: string): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);
  const step = await env.DB.prepare('SELECT * FROM sequence_steps WHERE id = ?').bind(stepId).first<SequenceStepRow>();
  if (!step) return jsonResponse(env, { error: 'Step not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; }
  catch { return jsonResponse(env, { error: 'Invalid JSON body' }, { status: 400 }); }

  const now = new Date().toISOString();

  if ('enabled' in body) {
    const enabled = body.enabled === true || body.enabled === 1 ? 1 : 0;
    await env.DB.prepare('UPDATE sequence_steps SET enabled = ?, updated_at = ? WHERE id = ?')
      .bind(enabled, now, stepId).run();
  }

  if ('position' in body && typeof body.position === 'number') {
    const target = Math.max(1, Math.floor(body.position));
    // Simple reorder: pull this step out, shift the gap closed, then open a slot at target
    // and insert. Done with a normalize pass to keep positions contiguous and unique.
    await env.DB.prepare('UPDATE sequence_steps SET position = position - 1, updated_at = ? WHERE position > ?')
      .bind(now, step.position).run();
    await env.DB.prepare('UPDATE sequence_steps SET position = position + 1, updated_at = ? WHERE position >= ?')
      .bind(now, target).run();
    await env.DB.prepare('UPDATE sequence_steps SET position = ?, updated_at = ? WHERE id = ?')
      .bind(target, now, stepId).run();
  }

  return jsonResponse(env, { ok: true });
}

// --- DELETE /drip/sequence/steps/:id (admin): remove a step (keeps the campaign) ---

async function handleDeleteSequenceStep(request: Request, env: Env, stepId: string): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);
  const step = await env.DB.prepare('SELECT * FROM sequence_steps WHERE id = ?').bind(stepId).first<SequenceStepRow>();
  if (!step) return jsonResponse(env, { error: 'Step not found' }, { status: 404 });
  const now = new Date().toISOString();
  // Remove the step (the campaign and its send history are untouched), then close the gap.
  await env.DB.prepare('DELETE FROM sequence_steps WHERE id = ?').bind(stepId).run();
  await env.DB.prepare('UPDATE sequence_steps SET position = position - 1, updated_at = ? WHERE position > ?')
    .bind(now, step.position).run();
  return jsonResponse(env, { ok: true, deleted: stepId });
}

// =====================================================================================
// Drip daily run: state (pause / run-state), the pass itself, status, and preview.
// =====================================================================================

interface DripStateRow {
  id: string;
  paused: number;
  running_since: string | null;
  last_run_at: string | null;
  updated_at: string;
}

async function getDripState(env: Env): Promise<DripStateRow> {
  let row = await env.DB.prepare(`SELECT * FROM drip_state WHERE id = 'singleton'`).first<DripStateRow>();
  if (!row) {
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO drip_state (id, paused, running_since, last_run_at, updated_at) VALUES ('singleton', 0, NULL, NULL, ?)`
    ).bind(now).run();
    row = await env.DB.prepare(`SELECT * FROM drip_state WHERE id = 'singleton'`).first<DripStateRow>();
  }
  return row as DripStateRow;
}

async function setDripPaused(env: Env, paused: boolean): Promise<void> {
  const now = new Date().toISOString();
  await getDripState(env); // ensure the row exists
  await env.DB.prepare(`UPDATE drip_state SET paused = ?, updated_at = ? WHERE id = 'singleton'`)
    .bind(paused ? 1 : 0, now).run();
}

/** The fixed daily cron hour (UTC). Keep in sync with wrangler.toml [triggers] crons. */
const DRIP_CRON_HOUR_UTC = 14;

/** Next scheduled run (UTC) given the fixed daily hour. */
function nextRunAtISO(now: Date = new Date()): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), DRIP_CRON_HOUR_UTC, 0, 0));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

/**
 * Send one campaign to one subscriber: write intent (pending), send, record sent/failed.
 * Campaign-keyed, mirrors the per-recipient logic in handleExecuteCampaign. Returns the
 * outcome. Assumes eligibility (scope + gap + not-yet-received) was already checked by the
 * caller, but still re-checks consent and the gap at send time for safety.
 */
async function sendOneDrip(
  env: Env,
  subscriber: SubscriberRow,
  campaign: CampaignRow,
  tip: TipPayload,
  now: Date
): Promise<'sent' | 'failed' | 'skipped'> {
  // Fresh consent re-check (the list may be stale).
  const fresh = await env.DB.prepare(`SELECT * FROM subscribers WHERE email = ?`).bind(subscriber.email).first<SubscriberRow>();
  const scopeCol = campaign.scope === 'reminders' ? 'scope_reminders' : 'scope_tips';
  if (!fresh || (fresh as unknown as Record<string, number>)[scopeCol] !== 1) return 'skipped';

  // Already sent/pending for this campaign?
  const already = await env.DB.prepare(`SELECT status FROM tip_sends WHERE campaign_id = ? AND email = ?`)
    .bind(campaign.id, subscriber.email).first<{ status: string }>();
  if (already && (already.status === 'sent' || already.status === 'pending')) return 'skipped';

  // Gap guard at send time.
  const withinGap = await env.DB.prepare(
    `SELECT 1 FROM tip_sends WHERE email = ? AND status = 'sent' AND sent_at >= ? LIMIT 1`
  ).bind(subscriber.email, gapCutoffISO(campaign.gap_days, now)).first<{ 1: number }>();
  if (withinGap) return 'skipped';

  const ts0 = now.toISOString();
  const rowId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO tip_sends (id, campaign_id, tip_slug, email, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)
     ON CONFLICT (campaign_id, email) DO UPDATE SET status = 'pending', updated_at = excluded.updated_at
     WHERE tip_sends.status = 'failed'`
  ).bind(rowId, campaign.id, campaign.tip_slug, subscriber.email, ts0, ts0).run();

  const result = await sendTipEmail(env, fresh, tip, `${campaign.id}:${subscriber.email}`);
  const ts = new Date().toISOString();
  if (result.ok) {
    await env.DB.prepare(
      `UPDATE tip_sends SET status = 'sent', resend_id = ?, error = NULL, sent_at = ?, updated_at = ? WHERE campaign_id = ? AND email = ?`
    ).bind(result.id, ts, ts, campaign.id, subscriber.email).run();
    return 'sent';
  }
  await env.DB.prepare(
    `UPDATE tip_sends SET status = 'failed', error = ?, updated_at = ? WHERE campaign_id = ? AND email = ?`
  ).bind(result.detail, ts, campaign.id, subscriber.email).run();
  return 'failed';
}

/**
 * One drip pass over a set of subscribers: for each, resolve their next due campaign and send
 * exactly that one (if `send` is true). Honors the gap/one-per-day via sendOneDrip + the
 * just-written 'sent' row (a subscriber sent earlier in the pass is excluded from a later
 * campaign by the gap guard). Returns a per-subscriber plan (for preview) + tallies.
 *
 * @param send   true = actually send (production); false = dry-run plan only.
 * @param now    evaluation date (injectable for the test harness / simulate).
 * @param onlySubscribers optional explicit subscriber list (e.g. test cohort); default = all.
 */
async function runDripPass(
  env: Env,
  opts: {
    send: boolean;
    now?: Date;
    onlySubscribers?: SubscriberRow[];
    /**
     * Simulation-only: instead of emailing, record a virtual 'sent' tip_sends row (dated at
     * `now`) so sequence state ADVANCES across simulated days without sending real email.
     * This is what lets a no-send simulation step a tester through the whole sequence
     * (Req 10.3/10.4). Must only ever be used with a test-subscriber `onlySubscribers` set.
     */
    simulateAdvance?: boolean;
  }
): Promise<{ plan: Array<{ email: string; status: 'next' | 'waiting' | 'finished'; campaign_id?: string; tip_slug?: string; sent?: string }>; sent: number; failed: number; skipped: number; finished: number; waiting: number }> {
  const now = opts.now ?? new Date();
  const steps = await getSequenceSteps(env);
  const campaignsById = await loadCampaignsForSteps(env, steps);
  const tipIndex = opts.send ? await fetchTipIndex(env) : null;

  const subscribers =
    opts.onlySubscribers ?? ((await env.DB.prepare(`SELECT * FROM subscribers`).all<SubscriberRow>()).results || []);

  const plan: Array<{ email: string; status: 'next' | 'waiting' | 'finished'; campaign_id?: string; tip_slug?: string; sent?: string }> = [];
  let sent = 0, failed = 0, skipped = 0, finished = 0, waiting = 0;

  for (const sub of subscribers) {
    const resolved = await resolveNextForSubscriber(env, sub, steps, campaignsById, now);
    if (resolved.kind === 'finished') {
      finished++;
      plan.push({ email: sub.email, status: 'finished' });
      continue;
    }
    if (resolved.kind === 'waiting' || !resolved.campaign) {
      waiting++;
      plan.push({ email: sub.email, status: 'waiting', campaign_id: resolved.campaign?.id, tip_slug: resolved.campaign?.tip_slug });
      continue;
    }
    // kind === 'next'
    const campaign = resolved.campaign;
    if (!opts.send) {
      if (opts.simulateAdvance) {
        // Record a virtual 'sent' row (dated at the simulated day) so state advances across
        // simulated days — NO email is sent. Test-cohort only.
        const ts = now.toISOString();
        await env.DB.prepare(
          `INSERT INTO tip_sends (id, campaign_id, tip_slug, email, status, sent_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'sent', ?, ?, ?)
           ON CONFLICT (campaign_id, email) DO UPDATE SET status = 'sent', sent_at = excluded.sent_at, updated_at = excluded.updated_at`
        ).bind(crypto.randomUUID(), campaign.id, campaign.tip_slug, sub.email, ts, ts, ts).run();
        sent++;
        plan.push({ email: sub.email, status: 'next', campaign_id: campaign.id, tip_slug: campaign.tip_slug, sent: 'simulated' });
      } else {
        plan.push({ email: sub.email, status: 'next', campaign_id: campaign.id, tip_slug: campaign.tip_slug });
      }
      continue;
    }
    // Production: need the tip content.
    const tip = tipIndex?.get(campaign.tip_slug);
    if (!tip) {
      // Content unavailable (index fetch failed or slug missing) — skip, retry next run.
      skipped++;
      plan.push({ email: sub.email, status: 'waiting', campaign_id: campaign.id, tip_slug: campaign.tip_slug });
      continue;
    }
    const outcome = await sendOneDrip(env, sub, campaign, tip, now);
    if (outcome === 'sent') { sent++; plan.push({ email: sub.email, status: 'next', campaign_id: campaign.id, tip_slug: campaign.tip_slug, sent: 'sent' }); }
    else if (outcome === 'failed') { failed++; plan.push({ email: sub.email, status: 'next', campaign_id: campaign.id, tip_slug: campaign.tip_slug, sent: 'failed' }); }
    else { skipped++; plan.push({ email: sub.email, status: 'waiting', campaign_id: campaign.id, tip_slug: campaign.tip_slug }); }
  }

  return { plan, sent, failed, skipped, finished, waiting };
}

/**
 * Execute the daily drip (production), guarded by pause and wrapped in run-state tracking.
 * Called by the scheduled (cron) handler. Sets running_since at start, clears it in a
 * finally (even on error), updates last_run_at on completion.
 */
async function executeDailyDrip(env: Env, now: Date = new Date()): Promise<{ ran: boolean; sent?: number; failed?: number; skipped?: number }> {
  const state = await getDripState(env);
  if (state.paused === 1) return { ran: false };

  const startedAt = now.toISOString();
  await env.DB.prepare(`UPDATE drip_state SET running_since = ?, updated_at = ? WHERE id = 'singleton'`)
    .bind(startedAt, startedAt).run();
  try {
    const result = await runDripPass(env, { send: true, now });
    const doneAt = new Date().toISOString();
    await env.DB.prepare(`UPDATE drip_state SET last_run_at = ?, updated_at = ? WHERE id = 'singleton'`)
      .bind(doneAt, doneAt).run();
    return { ran: true, sent: result.sent, failed: result.failed, skipped: result.skipped };
  } finally {
    const clearedAt = new Date().toISOString();
    await env.DB.prepare(`UPDATE drip_state SET running_since = NULL, updated_at = ? WHERE id = 'singleton'`)
      .bind(clearedAt).run();
  }
}

// --- GET /drip/status (admin) ---

async function handleDripStatus(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);
  const state = await getDripState(env);
  return jsonResponse(env, {
    paused: state.paused === 1,
    running: state.running_since != null,
    runningSince: state.running_since,
    lastRunAt: state.last_run_at,
    nextRunAt: nextRunAtISO(),
  });
}

// --- POST /drip/pause and POST /drip/resume (admin) ---

async function handleDripPause(request: Request, env: Env, paused: boolean): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);
  await setDripPaused(env, paused);
  return jsonResponse(env, { ok: true, paused });
}

// --- POST /drip/preview (admin): dry-run plan for the next run (no sends) ---
// Body (optional): { asOf?: ISO date }

async function handleDripPreview(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);
  let body: Record<string, unknown> = {};
  try { body = (await request.json()) as Record<string, unknown>; } catch { /* no body is fine */ }
  const asOf = typeof body.asOf === 'string' && !Number.isNaN(Date.parse(body.asOf)) ? new Date(body.asOf) : new Date();

  const result = await runDripPass(env, { send: false, now: asOf });
  const PREVIEW_CAP = 500;
  return jsonResponse(env, {
    mode: 'dry-run',
    asOf: asOf.toISOString(),
    counts: { next: result.plan.filter((p) => p.status === 'next').length, waiting: result.waiting, finished: result.finished },
    plan: result.plan.slice(0, PREVIEW_CAP),
    planTruncated: result.plan.length > PREVIEW_CAP,
  });
}

// =====================================================================================
// Drip test harness: isolated test subscribers (relative-age), create (replace) / reset
// (keep), and the day-by-day time-travel simulation. All operate ONLY on is_test = 1 rows.
// =====================================================================================

const TEST_EMAIL_DOMAIN = 'drip-test.local';

/** All test subscribers (is_test = 1), oldest signup first. */
async function listTestSubscribers(env: Env): Promise<SubscriberRow[]> {
  const res = await env.DB.prepare(`SELECT * FROM subscribers WHERE is_test = 1 ORDER BY created_at ASC`).all<SubscriberRow>();
  return res.results || [];
}

/** Delete all test subscribers AND their tip_sends. Never touches real subscribers. */
async function wipeTestCohort(env: Env): Promise<void> {
  // tip_sends is keyed by email; delete test subscribers' sends first, then the subscribers.
  await env.DB.prepare(
    `DELETE FROM tip_sends WHERE email IN (SELECT email FROM subscribers WHERE is_test = 1)`
  ).run();
  await env.DB.prepare(`DELETE FROM subscribers WHERE is_test = 1`).run();
}

// --- POST /drip/test/create (admin): REPLACE the test cohort with a fresh, sequence-derived set ---
// Derives relative signup ages from the current enabled sequence (cumulative gap_days), so
// each tester sits at a meaningful point in the flow. Replaces any prior test cohort entirely.

async function handleTestCreate(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);

  // Gaps of the enabled steps, in order, to derive tester ages.
  const steps = await getSequenceSteps(env);
  const campaignsById = await loadCampaignsForSteps(env, steps);
  const enabledInOrder = steps.filter((s) => s.enabled === 1).sort((a, b) => a.position - b.position);
  const gapsInOrder = enabledInOrder.map((s) => campaignsById.get(s.campaign_id)?.gap_days ?? 1);
  const ages = deriveTestAges(gapsInOrder); // ascending days-ago, always includes 0

  // Replace the whole cohort (clean, no leftovers).
  await wipeTestCohort(env);

  const now = Date.now();
  const created: Array<{ email: string; ageDays: number }> = [];
  for (const age of ages) {
    const createdAt = new Date(now - age * 24 * 60 * 60 * 1000).toISOString();
    const email = `tester+${age}d@${TEST_EMAIL_DOMAIN}`;
    // Opted into BOTH scopes so a tester is eligible for any step; is_test = 1.
    await env.DB.prepare(
      `INSERT INTO subscribers
         (id, email, first_name, scope_reminders, scope_tips,
          reminders_updated_at, tips_updated_at, unsubscribe_token, source, created_at, updated_at, is_test)
       VALUES (?, ?, ?, 1, 1, ?, ?, ?, 'drip_test', ?, ?, 1)`
    ).bind(
      crypto.randomUUID(),
      email,
      `Tester ${age}d`,
      createdAt,
      createdAt,
      crypto.randomUUID(),
      createdAt,
      createdAt
    ).run();
    created.push({ email, ageDays: age });
  }

  return jsonResponse(env, {
    ok: true,
    replaced: true,
    derivedFromGaps: gapsInOrder,
    testers: created,
  }, { status: 201 });
}

// --- POST /drip/test/reset (admin): KEEP the test cohort, clear their send history ---

async function handleTestReset(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);
  await env.DB.prepare(
    `DELETE FROM tip_sends WHERE email IN (SELECT email FROM subscribers WHERE is_test = 1)`
  ).run();
  const testers = await listTestSubscribers(env);
  return jsonResponse(env, { ok: true, kept: testers.length });
}

// --- POST /drip/simulate (admin): step the drip forward N days over the test cohort ---
// Body: { startDate?: ISO (default now), days?: number (default 14), mode?: 'dry-run'|'production' }
// dry-run = no sends (plan only). production = actually sends, but ONLY to test subscribers.
// Full-sequence test = pass a large enough `days`; few-days test = pass a small `days`.

async function handleSimulate(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorized(env);
  let body: Record<string, unknown> = {};
  try { body = (await request.json()) as Record<string, unknown>; } catch { /* defaults */ }

  const mode = body.mode === 'production' ? 'production' : 'dry-run';
  const days = typeof body.days === 'number' && body.days > 0 ? Math.min(Math.floor(body.days), 400) : 14;
  const start = typeof body.startDate === 'string' && !Number.isNaN(Date.parse(body.startDate))
    ? new Date(body.startDate)
    : new Date();

  const testers = await listTestSubscribers(env);
  if (testers.length === 0) {
    return jsonResponse(env, { error: 'No test subscribers. Create a test cohort first (POST /drip/test/create).' }, { status: 400 });
  }

  // Step one simulated day at a time, re-reading the (test-only) subscribers each day so
  // their 'sent' history from earlier simulated days carries forward.
  const perDay: Array<{ day: string; plan: unknown[]; sent?: number; failed?: number; skipped?: number }> = [];
  for (let i = 0; i < days; i++) {
    const dayDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i, DRIP_CRON_HOUR_UTC, 0, 0));
    const only = await listTestSubscribers(env); // refresh (sends from prior days change state)
    // dry-run advances state VIRTUALLY (records 'sent' rows, no email) so the sequence
    // progresses across simulated days; production actually sends to the test cohort.
    const result = await runDripPass(env, {
      send: mode === 'production',
      now: dayDate,
      onlySubscribers: only,
      simulateAdvance: mode === 'dry-run',
    });
    perDay.push({
      day: dayDate.toISOString().slice(0, 10),
      plan: result.plan,
      ...(mode === 'production' ? { sent: result.sent, failed: result.failed, skipped: result.skipped } : {}),
    });
  }

  return jsonResponse(env, {
    mode,
    startDate: start.toISOString().slice(0, 10),
    days,
    testerCount: testers.length,
    perDay,
  });
}

// --- GET /admin (operator-only HTML page; secret-gated like other admin routes) ---

async function handleAdminPage(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) {
    // Deny without the secret. Plain text (not the JSON helper) since this route serves HTML.
    return new Response('Unauthorized. Open /admin?secret=<ADMIN_SECRET>.', {
      status: 401,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders(env) },
    });
  }
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret') || '';
  const html = ADMIN_HTML.replace('__ADMIN_SECRET__', secret);
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders(env) },
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

      // --- Drip sequence routes (admin) ---
      if (path === '/drip/sequence' && request.method === 'GET') return await handleGetSequence(request, env);
      if (path === '/drip/sequence/steps' && request.method === 'POST') return await handleAddSequenceStep(request, env);
      const seqStepMatch = path.match(/^\/drip\/sequence\/steps\/([^/]+)$/);
      if (seqStepMatch) {
        const stepId = decodeURIComponent(seqStepMatch[1]);
        if (request.method === 'PATCH' || request.method === 'PUT') return await handleUpdateSequenceStep(request, env, stepId);
        if (request.method === 'DELETE') return await handleDeleteSequenceStep(request, env, stepId);
      }
      if (path === '/admin' && request.method === 'GET') return await handleAdminPage(request, env);
      if (path === '/drip/status' && request.method === 'GET') return await handleDripStatus(request, env);
      if (path === '/drip/pause' && request.method === 'POST') return await handleDripPause(request, env, true);
      if (path === '/drip/resume' && request.method === 'POST') return await handleDripPause(request, env, false);
      if (path === '/drip/preview' && request.method === 'POST') return await handleDripPreview(request, env);
      if (path === '/drip/test/create' && request.method === 'POST') return await handleTestCreate(request, env);
      if (path === '/drip/test/reset' && request.method === 'POST') return await handleTestReset(request, env);
      if (path === '/drip/simulate' && request.method === 'POST') return await handleSimulate(request, env);

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

  /**
   * Daily cron entry point (Cloudflare Cron Trigger; see wrangler.toml [triggers]).
   * Runs the production drip pass with the real current time, honoring pause and tracking
   * run-state. Whether the cron actually fires daily is a runtime-only fact — confirmed by
   * observing a live run (worker logs / new tip_sends rows), not by unit tests.
   */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(executeDailyDrip(env).then(() => undefined));
  },
};
