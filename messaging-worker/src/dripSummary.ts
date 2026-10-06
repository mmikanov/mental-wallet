/**
 * Pure builder for the daily operator summary email.
 *
 * After the daily drip run finishes, the worker emails the operator a summary of who received
 * which campaign/tip, with a dedicated callout for anyone who just received the LAST campaign
 * in the sequence. This module is deliberately pure (no DB, network, or env access) so it can
 * be unit-tested in isolation — the worker composes the inputs and hands them in.
 *
 * See src/index.ts (executeDailyDrip) for where this is wired up.
 */

/** A plan entry as produced by runDripPass, narrowed to the fields the summary needs. */
export interface SummaryPlanEntry {
  email: string;
  status: 'next' | 'waiting' | 'finished' | 'not_yet';
  campaign_id?: string;
  campaign_name?: string;
  tip_slug?: string;
  sent?: string; // 'sent' | 'failed' | 'simulated'
}

/** Top-line counts for the run (as returned by runDripPass). */
export interface SummaryCounts {
  sent: number;
  failed: number;
  waiting: number;
  finished: number;
  /** Total subscribers considered this run (plan length). */
  total: number;
}

export interface DripSummary {
  subject: string;
  html: string;
  text: string;
}

/** HTML-escape text content (same minimal scheme the worker uses for email bodies). */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Format an ISO timestamp in US Eastern time (America/New_York, so EST/EDT follows daylight
 * saving), matching the admin page convention, e.g. "Oct 4, 2026, 10:00 AM EDT".
 */
export function formatEastern(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'unknown';
  try {
    return new Date(t).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return new Date(t).toISOString();
  }
}

/** Just the US Eastern date portion, e.g. "Oct 4, 2026" — used in the subject line. */
export function formatEasternDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'unknown date';
  try {
    return new Date(t).toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return new Date(t).toISOString().slice(0, 10);
  }
}

/** A delivered email: the subscriber actually received the frontier campaign this run. */
function isDelivered(e: SummaryPlanEntry): boolean {
  return e.status === 'next' && e.sent === 'sent';
}

/** A failed send: attempted but Resend rejected it. */
function isFailed(e: SummaryPlanEntry): boolean {
  return e.status === 'next' && e.sent === 'failed';
}

/** A label for a campaign group, falling back gracefully when name/slug are missing. */
function campaignLabel(name: string | undefined, slug: string | undefined): string {
  if (name && slug) return `${name} (${slug})`;
  if (name) return name;
  if (slug) return slug;
  return 'Unknown campaign';
}

/**
 * Build the operator summary email ({ subject, html, text }) from a finished run's plan.
 *
 * @param plan           the run's plan entries (result.plan)
 * @param lastCampaignId campaign_id of the LAST step in the sequence (highest position), or
 *                       null/undefined if the sequence is empty
 * @param counts         top-line counts from the run
 * @param dateIso        the run timestamp (ISO) — formatted in US Eastern for display
 */
export function buildDripSummary(
  plan: SummaryPlanEntry[],
  lastCampaignId: string | null | undefined,
  counts: SummaryCounts,
  dateIso: string
): DripSummary {
  const easternDate = formatEasternDate(dateIso);
  const easternFull = formatEastern(dateIso);

  const delivered = plan.filter(isDelivered);
  const failed = plan.filter(isFailed);

  // Group delivered emails by campaign (preserve first-seen order).
  const groupOrder: string[] = [];
  const groups = new Map<string, { label: string; emails: string[] }>();
  for (const e of delivered) {
    const key = e.campaign_id ?? `__${e.campaign_name ?? e.tip_slug ?? 'unknown'}`;
    let g = groups.get(key);
    if (!g) {
      g = { label: campaignLabel(e.campaign_name, e.tip_slug), emails: [] };
      groups.set(key, g);
      groupOrder.push(key);
    }
    g.emails.push(e.email);
  }

  // Subscribers who just received the LAST campaign in the sequence.
  const finalRecipients = lastCampaignId
    ? delivered.filter((e) => e.campaign_id === lastCampaignId).map((e) => e.email)
    : [];

  const subject = `Drip summary — ${counts.sent} ${counts.sent === 1 ? 'email' : 'emails'} sent (${easternDate})`;

  // ---- Plain-text body ----
  const textLines: string[] = [];
  if (counts.sent === 0) {
    textLines.push(`Drip ran — 0 emails sent today. ${counts.waiting} waiting, ${counts.finished} finished.`);
  } else {
    textLines.push(`Drip summary for ${easternFull}`);
  }
  textLines.push('');
  textLines.push('Totals:');
  textLines.push(`  Delivered (sent): ${counts.sent}`);
  textLines.push(`  Failed: ${counts.failed}`);
  textLines.push(`  Waiting: ${counts.waiting}`);
  textLines.push(`  Finished: ${counts.finished}`);
  textLines.push(`  Total subscribers considered: ${counts.total}`);

  if (groupOrder.length > 0) {
    textLines.push('');
    textLines.push('Delivered by campaign:');
    for (const key of groupOrder) {
      const g = groups.get(key)!;
      textLines.push(`  ${g.label} — ${g.emails.length} ${g.emails.length === 1 ? 'recipient' : 'recipients'}:`);
      for (const email of g.emails) textLines.push(`    - ${email}`);
    }
  }

  textLines.push('');
  if (finalRecipients.length > 0) {
    textLines.push('Final campaign reached:');
    textLines.push('These subscribers just received the final campaign in the sequence (they are now at the end of the drip):');
    for (const email of finalRecipients) textLines.push(`    - ${email}`);
  } else {
    textLines.push('Final campaign reached: none reached the final campaign today.');
  }

  if (failed.length > 0) {
    textLines.push('');
    textLines.push('Failed sends:');
    for (const e of failed) {
      textLines.push(`    - ${e.email} — ${campaignLabel(e.campaign_name, e.tip_slug)}`);
    }
  }

  const text = textLines.join('\n');

  // ---- HTML body (simple, inline styles, no external assets) ----
  const htmlParts: string[] = [];
  htmlParts.push(
    `<div style="font-family:-apple-system,system-ui,sans-serif;color:#1a1a1a;line-height:1.5;max-width:40rem;margin:0 auto">`
  );
  htmlParts.push(`<h1 style="font-size:1.25rem;margin:0 0 .25rem">Daily drip summary</h1>`);
  htmlParts.push(`<p style="color:#666;margin:0 0 1rem">${esc(easternFull)}</p>`);

  if (counts.sent === 0) {
    htmlParts.push(
      `<p style="margin:0 0 1rem"><strong>Drip ran — 0 emails sent today.</strong> ${counts.waiting} waiting, ${counts.finished} finished.</p>`
    );
  }

  htmlParts.push(`<h2 style="font-size:1rem;margin:1.25rem 0 .5rem">Totals</h2>`);
  htmlParts.push(`<ul style="margin:0 0 1rem;padding-left:1.25rem">`);
  htmlParts.push(`<li>Delivered (sent): <strong>${counts.sent}</strong></li>`);
  htmlParts.push(`<li>Failed: <strong>${counts.failed}</strong></li>`);
  htmlParts.push(`<li>Waiting: <strong>${counts.waiting}</strong></li>`);
  htmlParts.push(`<li>Finished: <strong>${counts.finished}</strong></li>`);
  htmlParts.push(`<li>Total subscribers considered: <strong>${counts.total}</strong></li>`);
  htmlParts.push(`</ul>`);

  if (groupOrder.length > 0) {
    htmlParts.push(`<h2 style="font-size:1rem;margin:1.25rem 0 .5rem">Delivered by campaign</h2>`);
    for (const key of groupOrder) {
      const g = groups.get(key)!;
      htmlParts.push(
        `<p style="margin:1rem 0 .25rem"><strong>${esc(g.label)}</strong> — ${g.emails.length} ${g.emails.length === 1 ? 'recipient' : 'recipients'}</p>`
      );
      htmlParts.push(`<ul style="margin:0 0 .5rem;padding-left:1.25rem">`);
      for (const email of g.emails) htmlParts.push(`<li>${esc(email)}</li>`);
      htmlParts.push(`</ul>`);
    }
  }

  if (finalRecipients.length > 0) {
    htmlParts.push(
      `<div style="margin:1.25rem 0;padding:.75rem 1rem;background:#eef2ff;border-left:4px solid #4f46e5;border-radius:4px">`
    );
    htmlParts.push(`<h2 style="font-size:1rem;margin:0 0 .5rem">Final campaign reached</h2>`);
    htmlParts.push(
      `<p style="margin:0 0 .5rem">These subscribers just received the final campaign in the sequence (they are now at the end of the drip):</p>`
    );
    htmlParts.push(`<ul style="margin:0;padding-left:1.25rem">`);
    for (const email of finalRecipients) htmlParts.push(`<li>${esc(email)}</li>`);
    htmlParts.push(`</ul>`);
    htmlParts.push(`</div>`);
  } else {
    htmlParts.push(
      `<p style="margin:1.25rem 0;color:#666"><strong>Final campaign reached:</strong> none reached the final campaign today.</p>`
    );
  }

  if (failed.length > 0) {
    htmlParts.push(`<h2 style="font-size:1rem;margin:1.25rem 0 .5rem;color:#b91c1c">Failed sends</h2>`);
    htmlParts.push(`<ul style="margin:0 0 1rem;padding-left:1.25rem">`);
    for (const e of failed) {
      htmlParts.push(`<li>${esc(e.email)} — ${esc(campaignLabel(e.campaign_name, e.tip_slug))}</li>`);
    }
    htmlParts.push(`</ul>`);
  }

  htmlParts.push(`</div>`);
  const html = htmlParts.join('\n');

  return { subject, html, text };
}
