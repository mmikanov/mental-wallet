/* Shared client logic for the consent pages (subscribe / preferences / unsubscribe).
   Talks to the messaging worker. No framework, no build step. */

const MESSAGING_BASE = 'https://mental-wallet-messaging.mentalwallet.workers.dev';

/* Pragmatic email check — a UX aid only; the worker validation is authoritative. */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token') || '';
}

async function subscribe({ email, firstName, tips, reminders }) {
  const res = await fetch(`${MESSAGING_BASE}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      first_name: firstName || undefined,
      tips: !!tips,
      reminders: !!reminders,
      source: 'website',
    }),
  });
  return { ok: res.ok, status: res.status };
}

async function getPreferences(token) {
  const res = await fetch(`${MESSAGING_BASE}/preferences?token=${encodeURIComponent(token)}`);
  if (!res.ok) return { ok: false, status: res.status };
  const data = await res.json();
  return { ok: true, scopes: data.scopes, firstName: data.first_name };
}

async function savePreferences({ token, tips, reminders }) {
  const res = await fetch(`${MESSAGING_BASE}/preferences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, tips: !!tips, reminders: !!reminders }),
  });
  return { ok: res.ok, status: res.status };
}

async function unsubscribe(token) {
  const res = await fetch(`${MESSAGING_BASE}/unsubscribe?token=${encodeURIComponent(token)}`);
  // The endpoint is idempotent and returns 200 for both found/not-found.
  return { ok: res.ok, status: res.status };
}
