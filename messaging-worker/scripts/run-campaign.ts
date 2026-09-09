/**
 * Run a campaign: execute it in chunks against the messaging worker until done.
 *
 * Reads the campaign (to learn its tip_slug), parses content/tips/<slug>.md, then loops
 * POST /campaigns/:id/execute chunk by chunk, pacing between chunks to respect Resend's
 * rate limits, until `remaining` is 0. Individual per-recipient sends and dedupe happen
 * server-side; this script just drives the chunks.
 *
 * Usage:
 *   MESSAGING_BASE_URL=https://mental-wallet-messaging.mentalwallet.workers.dev \
 *   ADMIN_SECRET=your-admin-secret \
 *   npx tsx scripts/run-campaign.ts --id <campaignId> --mode dry-run
 *
 *   ...same, with --mode production   (actually sends)
 *
 * Optional:
 *   --limit <n>        chunk size (default 50, max 100)
 *   --pace-ms <n>      delay between chunks in ms (default 1000)
 *   --tips-dir <path>  default ../content/tips relative to this script
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function getArg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

const campaignId = getArg('id');
const mode = getArg('mode');
const limit = getArg('limit') ? parseInt(getArg('limit')!, 10) : 50;
const paceMs = getArg('pace-ms') ? parseInt(getArg('pace-ms')!, 10) : 1000;
const tipsDir = resolve(process.cwd(), getArg('tips-dir') || resolve(__dirname, '../../content/tips'));
const baseUrl = process.env.MESSAGING_BASE_URL;
const adminSecret = process.env.ADMIN_SECRET;

if (!campaignId || (mode !== 'dry-run' && mode !== 'production')) {
  console.error('Usage: run-campaign.ts --id <campaignId> --mode dry-run|production [--limit n] [--pace-ms n]');
  process.exit(1);
}
if (!baseUrl || !adminSecret) {
  console.error('Set MESSAGING_BASE_URL and ADMIN_SECRET.');
  process.exit(1);
}

// --- tip frontmatter parsing (same minimal parser as send-tip.ts) ---
interface Cta { label?: string; url?: string }
interface Tip { title: string; summary: string; body?: string; heroImage?: string; cta?: Cta }

function stripQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

function parseTipFile(raw: string): Tip {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error('No frontmatter found');
  const [, fm, body] = match;
  const fields: Record<string, string> = {};
  const cta: Cta = {};
  let inCta = false;
  for (const line of fm.split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    if (/^cta:\s*$/.test(line)) { inCta = true; continue; }
    if (inCta && /^\s+\w+:/.test(line)) {
      const m = line.match(/^\s+(\w+):\s*(.*)$/);
      if (m) { cta[m[1] as keyof Cta] = stripQuotes(m[2]); continue; }
    }
    inCta = false;
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) fields[m[1]] = stripQuotes(m[2]);
  }
  if (!fields.title || !fields.summary) throw new Error('Tip is missing required title/summary');
  const tip: Tip = { title: fields.title, summary: fields.summary };
  const tb = stripWebOnlyBlocks(body.trim());
  if (tb.length > 0) tip.body = tb;
  if (fields.heroImage && fields.heroImage.length > 0) tip.heroImage = fields.heroImage;
  if (cta.label && cta.url) tip.cta = { label: cta.label, url: cta.url };
  return tip;
}

/**
 * Remove website-only HTML blocks (e.g. inline `<figure class="tip-anim">` animations)
 * from a tip body before emailing. The email renders the body as plain text, so such HTML
 * would show as raw markup; the animation is already represented in email by the GIF
 * heroImage. See send-tip.ts for the canonical note. (Interim until email-inline-media.)
 */
function stripWebOnlyBlocks(body: string): string {
  return body
    .replace(/<figure[\s\S]*?<\/figure>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const base = baseUrl.replace(/\/$/, '');
const authQ = `secret=${encodeURIComponent(adminSecret)}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 1. Read the campaign to learn its tip_slug.
  const cRes = await fetch(`${base}/campaigns/${encodeURIComponent(campaignId!)}?${authQ}`);
  if (!cRes.ok) {
    console.error(`Failed to load campaign (${cRes.status}): ${await cRes.text()}`);
    process.exit(1);
  }
  const { campaign } = (await cRes.json()) as { campaign: { name: string; tip_slug: string; scope: string; mode: string } };
  console.log(`Campaign: "${campaign.name}"  tip=${campaign.tip_slug}  scope=${campaign.scope}  mode=${campaign.mode}`);

  // 2. Parse the tip markdown (single source of truth).
  const tip = parseTipFile(readFileSync(resolve(tipsDir, `${campaign.tip_slug}.md`), 'utf8'));

  // 3. Dry-run: one call, report counts + WHO would receive it, done.
  if (mode === 'dry-run') {
    const res = await fetch(`${base}/campaigns/${encodeURIComponent(campaignId!)}/execute?${authQ}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'dry-run', limit }),
    });
    if (!res.ok) {
      console.error(`\nDry-run failed (${res.status}): ${await res.text()}`);
      process.exit(1);
    }
    const r = (await res.json()) as {
      wouldSend: number; recipients: string[]; recipientsTruncated: boolean;
    };
    console.log(`\nDRY RUN — would send to ${r.wouldSend} recipient(s):`);
    for (const email of r.recipients) console.log(`  - ${email}`);
    if (r.recipientsTruncated) {
      console.log(`  ... (list truncated; ${r.wouldSend} total)`);
    }
    console.log('\nNothing was sent. Re-run with --mode production to send.');
    return;
  }

  // 4. Production: loop chunks until remaining is 0.
  let totalSent = 0, totalFailed = 0, totalSkipped = 0, chunk = 0;
  for (;;) {
    chunk++;
    const res = await fetch(`${base}/campaigns/${encodeURIComponent(campaignId!)}/execute?${authQ}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'production', limit, tip }),
    });
    if (!res.ok) {
      console.error(`\nChunk ${chunk} failed (${res.status}): ${await res.text()}`);
      process.exit(1);
    }
    const r = (await res.json()) as { sent: number; failed: number; skipped: number; remaining: number; status: string };
    totalSent += r.sent; totalFailed += r.failed; totalSkipped += r.skipped;
    console.log(`chunk ${chunk}: sent=${r.sent} failed=${r.failed} skipped=${r.skipped} remaining=${r.remaining}`);
    if (r.remaining <= 0) break;
    await sleep(paceMs);
  }

  console.log(`\nDone. total sent=${totalSent} failed=${totalFailed} skipped=${totalSkipped}`);
  if (totalFailed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
