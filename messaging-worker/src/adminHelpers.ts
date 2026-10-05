/**
 * Pure display helpers for the drip admin page, extracted so they are unit-testable without a
 * browser. These do NOT touch the DOM, network, or D1 — they only transform data the page
 * already has (from the drip endpoints) into display-ready shapes/strings.
 */

/**
 * Human-readable "time until next run" from an ISO timestamp, relative to `now`.
 * Returns e.g. "in 3h 12m", "in 2d 4h", "due now". Null/invalid input → "unknown".
 */
export function formatCountdown(nextRunAtISO: string | null | undefined, now: Date = new Date()): string {
  if (!nextRunAtISO) return 'unknown';
  const t = Date.parse(nextRunAtISO);
  if (Number.isNaN(t)) return 'unknown';
  let ms = t - now.getTime();
  if (ms <= 0) return 'due now';
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / (60 * 24));
  const hours = Math.floor((mins % (60 * 24)) / 60);
  const m = mins % 60;
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${m}m`;
  return `in ${m}m`;
}

/** One cell in the simulation grid: a tester's state on a simulated day. */
export interface SimCell {
  status: 'next' | 'waiting' | 'finished';
  tip_slug?: string;
  sent?: string;
}

/** The grid shape the page renders: ordered tester columns + one row per simulated day. */
export interface SimGrid {
  testers: string[]; // column headers (tester labels, e.g. "0d","1d",...)
  rows: Array<{ day: string; cells: Record<string, SimCell> }>;
}

type SimPlanEntry = { email: string; status: 'next' | 'waiting' | 'finished'; tip_slug?: string; sent?: string };
type SimDay = { day: string; plan: SimPlanEntry[] };

/**
 * Build a display grid from a /drip/simulate response's perDay array. The page renders exactly
 * this — it never recomputes the drip logic itself (Req 7.7). Tester columns are derived from
 * the union of emails seen across all days, shortened to their "+Nd" label when possible,
 * sorted by age ascending.
 */
export function buildSimGrid(perDay: SimDay[]): SimGrid {
  const emails = new Set<string>();
  for (const d of perDay) for (const p of d.plan) emails.add(p.email);

  const label = (email: string): string => {
    // tester+<N>d@domain -> "<N>d"; otherwise the local part.
    const m = email.match(/\+(\d+)d@/);
    if (m) return `${m[1]}d`;
    return email.split('@')[0];
  };
  const ageOf = (email: string): number => {
    const m = email.match(/\+(\d+)d@/);
    return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
  };

  const testers = Array.from(emails).sort((a, b) => ageOf(a) - ageOf(b)).map(label);
  // Map label back to email for cell lookup.
  const emailByLabel = new Map<string, string>();
  for (const e of emails) emailByLabel.set(label(e), e);

  const rows = perDay.map((d) => {
    const byEmail = new Map<string, SimPlanEntry>();
    for (const p of d.plan) byEmail.set(p.email, p);
    const cells: Record<string, SimCell> = {};
    for (const t of testers) {
      const e = emailByLabel.get(t);
      const entry = e ? byEmail.get(e) : undefined;
      cells[t] = entry
        ? { status: entry.status, tip_slug: entry.tip_slug, sent: entry.sent }
        : { status: 'finished' };
    }
    return { day: d.day, cells };
  });

  return { testers, rows };
}

/** Short cell text for the grid: the tip slug when sending/next, else the state word. */
export function cellText(cell: SimCell): string {
  if (cell.status === 'next') return cell.tip_slug ? cell.tip_slug : 'next';
  return cell.status; // 'waiting' | 'finished'
}
