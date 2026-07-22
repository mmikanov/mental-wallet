/**
 * Engagement messaging logic.
 * Generates tier-appropriate weekly activity messages for the
 * wallet-level Insights screen.
 *
 * The pure function (generateEngagementMessage) is separated from
 * the database helper (getEngagementData) for easy property testing.
 *
 * Validates: Requirements 5.7
 */

import { getDatabase } from '../data/database';
import { getIncludeArchivedTools } from '../services/settingsService';
import { InsightTier } from '../services/tierEvaluator';

// --- Types ---

export interface EngagementMessage {
  text: string;
  tier: InsightTier;
}

// --- Pure Function ---

/**
 * Generate an engagement message based on tier and activity data.
 *
 * Nascent: Simple count — "You've practiced {count} times this week"
 *
 * Preliminary: Comparison to previous week
 *   - If this week > last week: "You've used your tools {count} times this week — that's more than last week"
 *   - If this week <= last week: "{count} sessions this week so far — every bit counts"
 *
 * Confident: 4-week rolling average comparison
 *   - If current week >= rolling average: "You've been more active this week — nice work."
 *   - If current week < rolling average * 0.7 (30%+ below): "Quieter week so far — that's okay too."
 *   - Otherwise: "You've practiced {count} times this week"
 */
export function generateEngagementMessage(
  tier: InsightTier,
  currentWeekCount: number,
  previousWeekCount?: number,
  rollingAverage?: number
): EngagementMessage {
  const count = Math.max(0, Math.floor(currentWeekCount));

  if (tier === 'nascent' || tier === 'below_nascent') {
    return {
      text: `You've practiced ${count} times this week`,
      tier,
    };
  }

  if (tier === 'preliminary') {
    const prevCount = previousWeekCount ?? 0;
    if (count > prevCount) {
      return {
        text: `You've used your tools ${count} times this week \u2014 that's more than last week`,
        tier,
      };
    }
    return {
      text: `${count} sessions this week so far \u2014 every bit counts`,
      tier,
    };
  }

  // Confident tier
  const avg = rollingAverage ?? 0;

  if (count >= avg) {
    return {
      text: "You've been more active this week \u2014 nice work.",
      tier,
    };
  }

  if (avg > 0 && count < avg * 0.7) {
    return {
      text: "Quieter week so far \u2014 that's okay too.",
      tier,
    };
  }

  return {
    text: `You've practiced ${count} times this week`,
    tier,
  };
}

// --- Database Helper ---

/**
 * Get the Monday of the given ISO week containing `date`.
 * ISO weeks start on Monday.
 */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  // Adjust: Sunday(0) => -6, Mon(1) => 0, Tue(2) => -1, etc.
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Query the database for engagement data needed by generateEngagementMessage.
 *
 * Returns:
 * - currentWeekCount: completions in the current Mon-Sun calendar week
 * - previousWeekCount: completions in the previous Mon-Sun calendar week
 * - rollingAverage: average weekly completions over the 4 weeks before the current week
 */
export async function getEngagementData(): Promise<{
  currentWeekCount: number;
  previousWeekCount: number;
  rollingAverage: number;
}> {
  const db = await getDatabase();
  const now = new Date();

  // Current week: Monday 00:00:00 UTC to Sunday 23:59:59 UTC
  const currentMonday = getMonday(now);
  const currentMondayISO = currentMonday.toISOString();

  // Previous week: one week before current Monday
  const prevMonday = new Date(currentMonday);
  prevMonday.setUTCDate(prevMonday.getUTCDate() - 7);
  const prevMondayISO = prevMonday.toISOString();

  // 4 weeks before current week start (for rolling average)
  const fourWeeksAgoMonday = new Date(currentMonday);
  fourWeeksAgoMonday.setUTCDate(fourWeeksAgoMonday.getUTCDate() - 28);
  const fourWeeksAgoMondayISO = fourWeeksAgoMonday.toISOString();

  // Determine whether to include archived cards
  const includeArchived = await getIncludeArchivedTools();
  const baseFrom = includeArchived
    ? 'FROM completions'
    : 'FROM completions c INNER JOIN cards ON cards.id = c.card_id WHERE cards.is_archived = 0';
  const dateCol = includeArchived ? 'completed_at' : 'c.completed_at';
  const andWhere = includeArchived ? 'WHERE' : 'AND';

  // Current week count
  const currentRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count ${baseFrom} ${andWhere} ${dateCol} >= ?`,
    [currentMondayISO]
  );
  const currentWeekCount = currentRow?.count ?? 0;

  // Previous week count
  const prevRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count ${baseFrom} ${andWhere} ${dateCol} >= ? AND ${dateCol} < ?`,
    [prevMondayISO, currentMondayISO]
  );
  const previousWeekCount = prevRow?.count ?? 0;

  // 4-week rolling average (excluding current week)
  // Count completions in the 4 weeks before the current week and divide by 4
  const rollingRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count ${baseFrom} ${andWhere} ${dateCol} >= ? AND ${dateCol} < ?`,
    [fourWeeksAgoMondayISO, currentMondayISO]
  );
  const totalInFourWeeks = rollingRow?.count ?? 0;
  const rollingAverage = totalInFourWeeks / 4;

  return {
    currentWeekCount,
    previousWeekCount,
    rollingAverage,
  };
}
