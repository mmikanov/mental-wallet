/**
 * Send one authored tip as an email via the messaging worker's /send-tip endpoint.
 *
 * Reads content/tips/<slug>.md (the single source of truth), parses its
 * frontmatter + body, and POSTs the rendered tip fields to the worker. The worker
 * enforces consent (recipient must be opted into the scope) and renders the email.
 *
 * Usage:
 *   MESSAGING_BASE_URL=https://mental-wallet-messaging.mentalwallet.workers.dev \
 *   ADMIN_SECRET=your-admin-secret \
 *   npx tsx scripts/send-tip.ts --slug emotion-based-session --to you@example.com
 *
 * Optional:
 *   --scope tips|reminders   (default: tips)
 *   --record                 record this send in tip_sends so a later campaign for the
 *                            same tip skips this recipient (default: NOT recorded — safe
 *                            for test/preview sends)
 *   --tips-dir <path>        (default: ../content/tips relative to this script)
 *   DRY_RUN=1                print the parsed tip + payload without sending
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// --- tiny arg parser ---
function getArg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

const slug = getArg('slug');
const to = getArg('to');
const scope = getArg('scope') || 'tips';
const tipsDir = resolve(process.cwd(), getArg('tips-dir') || resolve(__dirname, '../../content/tips'));
const baseUrl = process.env.MESSAGING_BASE_URL;
const adminSecret = process.env.ADMIN_SECRET;
const dryRun = process.env.DRY_RUN === '1';

if (!slug || !to) {
  console.error('Usage: send-tip.ts --slug <slug> --to <email> [--scope tips|reminders]');
  process.exit(1);
}
if (!dryRun && (!baseUrl || !adminSecret)) {
  console.error('Set MESSAGING_BASE_URL and ADMIN_SECRET (or DRY_RUN=1 to preview).');
  process.exit(1);
}

// --- read + parse the tip ---
interface Cta { label?: string; url?: string }
interface Tip {
  title: string;
  summary: string;
  body?: string;
  heroImage?: string;
  cta?: Cta;
}

/**
 * Minimal frontmatter parser for the simple, flat tip schema (plus the nested
 * cta.label / cta.url). Not a general YAML parser; sufficient for these fields.
 */
function parseTipFile(raw: string): Tip {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error('No frontmatter found');
  const [, fm, body] = match;

  const fields: Record<string, string> = {};
  const cta: Cta = {};
  let inCta = false;

  for (const line of fm.split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    // nested cta block: two-space indented "label:"/"url:"
    if (/^cta:\s*$/.test(line)) { inCta = true; continue; }
    if (inCta && /^\s+\w+:/.test(line)) {
      const m = line.match(/^\s+(\w+):\s*(.*)$/);
      if (m) { cta[m[1] as keyof Cta] = stripQuotes(m[2]); continue; }
    }
    inCta = false;
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) fields[m[1]] = stripQuotes(m[2]);
  }

  if (!fields.title || !fields.summary) {
    throw new Error('Tip is missing required title/summary');
  }

  const tip: Tip = {
    title: fields.title,
    summary: fields.summary,
  };
  const trimmedBody = body.trim();
  if (trimmedBody.length > 0) tip.body = trimmedBody;
  if (fields.heroImage && fields.heroImage.length > 0) tip.heroImage = fields.heroImage;
  if (cta.label && cta.url) tip.cta = { label: cta.label, url: cta.url };
  return tip;
}

function stripQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

const filePath = resolve(tipsDir, `${slug}.md`);
let tip: Tip;
try {
  tip = parseTipFile(readFileSync(filePath, 'utf8'));
} catch (err) {
  console.error(`Failed to read/parse ${filePath}: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

// --record makes this one-off send count toward the tip's dedupe history, so a later
// campaign for the same tip skips this recipient. Off by default (test/preview sends
// should not pollute dedupe). Passes tip_slug as the dedupe key.
const record = process.argv.includes('--record');
const payload: Record<string, unknown> = { email: to, scope, tip };
if (record) {
  payload.record = true;
  payload.tip_slug = slug;
}

console.log(`Tip: "${tip.title}"`);
console.log(`  summary: ${tip.summary}`);
console.log(`  hero: ${tip.heroImage || '(none)'}`);
console.log(`  cta: ${tip.cta ? `${tip.cta.label} -> ${tip.cta.url}` : '(none)'}`);
console.log(`  -> ${to} (scope: ${scope})`);

if (dryRun) {
  console.log('\nDRY_RUN=1 — payload:');
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

async function main() {
  const res = await fetch(`${baseUrl!.replace(/\/$/, '')}/send-tip?secret=${encodeURIComponent(adminSecret!)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const textBody = await res.text();
  if (res.ok) {
    console.log(`\nSent. ${textBody}`);
  } else {
    console.error(`\nFailed (${res.status}): ${textBody}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
