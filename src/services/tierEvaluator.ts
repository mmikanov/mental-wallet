/**
 * TierEvaluator implementation.
 * Determines the user's current Insight_Tier based on data thresholds
 * and checks per-card qualification for correlation analysis.
 *
 * Validates: Requirements 3.3, 3.4, 3.5
 */

import { getDatabase } from '../data/database';
import { getIncludeArchivedTools } from './settingsService';

// --- Types ---

export type InsightTier = 'below_nascent' | 'nascent' | 'preliminary' | 'confident';

export type TimePeriod = '7d' | '30d' | '90d' | 'all';

export interface TierProgress {
  currentTier: InsightTier;
  checkInCount: number;
  toolUseCount: number;
  distinctToolCount: number;
  nextTier: InsightTier | null;
  checkInsNeeded: number;    // 0 if threshold met
  toolUsesNeeded: number;    // 0 if threshold met
  distinctToolsNeeded: number; // 0 if threshold met
}

export const TIER_THRESHOLDS = {
  nascent: { checkIns: 3, toolUses: 3, distinctTools: 1 },
  preliminary: { checkIns: 7, toolUses: 5, distinctTools: 2 },
  confident: { checkIns: 14, toolUses: 10, distinctTools: 2 },
} as const;

export interface TierEvaluator {
  /** Evaluate the user's current tier and progress toward next. */
  evaluate(): Promise<TierProgress>;

  /** Check if a specific card has enough data for correlation at the given tier. */
  cardQualifiesForCorrelation(
    cardId: string,
    tier: InsightTier,
    timePeriod: TimePeriod
  ): Promise<boolean>;
}

// --- Per-card minimum uses for correlation ---

const CARD_MIN_USES = {
  preliminary: 3,
  confident: 5,
} as const;

// --- Helper: compute start date from TimePeriod ---

function getStartDateFromPeriod(period: TimePeriod): string | null {
  if (period === 'all') {
    return null;
  }

  const now = new Date();
  const daysMap: Record<Exclude<TimePeriod, 'all'>, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
  };

  const days = daysMap[period];
  const startDate = new Date(now);
  startDate.setUTCDate(startDate.getUTCDate() - days);
  startDate.setUTCHours(0, 0, 0, 0);

  return startDate.toISOString();
}

// --- Tier determination logic (pure function for testability) ---

export function determineTier(
  checkInCount: number,
  toolUseCount: number,
  distinctToolCount: number
): InsightTier {
  const c = Math.max(0, checkInCount);
  const t = Math.max(0, toolUseCount);
  const d = Math.max(0, distinctToolCount);

  if (
    c >= TIER_THRESHOLDS.confident.checkIns &&
    t >= TIER_THRESHOLDS.confident.toolUses &&
    d >= TIER_THRESHOLDS.confident.distinctTools
  ) {
    return 'confident';
  }

  if (
    c >= TIER_THRESHOLDS.preliminary.checkIns &&
    t >= TIER_THRESHOLDS.preliminary.toolUses &&
    d >= TIER_THRESHOLDS.preliminary.distinctTools
  ) {
    return 'preliminary';
  }

  if (
    c >= TIER_THRESHOLDS.nascent.checkIns &&
    t >= TIER_THRESHOLDS.nascent.toolUses
  ) {
    return 'nascent';
  }

  return 'below_nascent';
}

// --- Next tier and progress computation (pure function) ---

function computeProgress(
  currentTier: InsightTier,
  checkInCount: number,
  toolUseCount: number,
  distinctToolCount: number
): { nextTier: InsightTier | null; checkInsNeeded: number; toolUsesNeeded: number; distinctToolsNeeded: number } {
  const c = Math.max(0, checkInCount);
  const t = Math.max(0, toolUseCount);
  const d = Math.max(0, distinctToolCount);

  if (currentTier === 'confident') {
    return { nextTier: null, checkInsNeeded: 0, toolUsesNeeded: 0, distinctToolsNeeded: 0 };
  }

  const tierOrder: InsightTier[] = ['below_nascent', 'nascent', 'preliminary', 'confident'];
  const currentIdx = tierOrder.indexOf(currentTier);
  const nextTier = tierOrder[currentIdx + 1];

  const thresholdKey = nextTier as keyof typeof TIER_THRESHOLDS;
  const thresholds = TIER_THRESHOLDS[thresholdKey];

  return {
    nextTier,
    checkInsNeeded: Math.max(0, thresholds.checkIns - c),
    toolUsesNeeded: Math.max(0, thresholds.toolUses - t),
    distinctToolsNeeded: Math.max(0, thresholds.distinctTools - d),
  };
}

// --- Service Implementation ---

export function createTierEvaluator(): TierEvaluator {
  return {
    async evaluate(): Promise<TierProgress> {
      try {
        const db = await getDatabase();
        const includeArchived = await getIncludeArchivedTools();

        // Count total KPI check-ins (always unfiltered — not tool-specific)
        const kpiRow = await db.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) as count FROM kpi_records'
        );
        const checkInCount = kpiRow?.count ?? 0;

        // Count total completions (exclude archived cards unless setting is ON)
        const completionsRow = includeArchived
          ? await db.getFirstAsync<{ count: number }>(
              'SELECT COUNT(*) as count FROM completions'
            )
          : await db.getFirstAsync<{ count: number }>(
              'SELECT COUNT(*) as count FROM completions c INNER JOIN cards ON cards.id = c.card_id WHERE cards.is_archived = 0'
            );
        const toolUseCount = completionsRow?.count ?? 0;

        // Count distinct cards used (exclude archived cards unless setting is ON)
        const distinctRow = includeArchived
          ? await db.getFirstAsync<{ count: number }>(
              'SELECT COUNT(DISTINCT card_id) as count FROM completions'
            )
          : await db.getFirstAsync<{ count: number }>(
              'SELECT COUNT(DISTINCT c.card_id) as count FROM completions c INNER JOIN cards ON cards.id = c.card_id WHERE cards.is_archived = 0'
            );
        const distinctToolCount = distinctRow?.count ?? 0;

        const currentTier = determineTier(checkInCount, toolUseCount, distinctToolCount);
        const progress = computeProgress(currentTier, checkInCount, toolUseCount, distinctToolCount);

        return {
          currentTier,
          checkInCount,
          toolUseCount,
          distinctToolCount,
          ...progress,
        };
      } catch (error) {
        console.warn('[TierEvaluator] Failed to evaluate tier:', error);
        // Default to below_nascent on failure
        return {
          currentTier: 'below_nascent',
          checkInCount: 0,
          toolUseCount: 0,
          distinctToolCount: 0,
          nextTier: 'nascent',
          checkInsNeeded: TIER_THRESHOLDS.nascent.checkIns,
          toolUsesNeeded: TIER_THRESHOLDS.nascent.toolUses,
          distinctToolsNeeded: TIER_THRESHOLDS.nascent.distinctTools,
        };
      }
    },

    async cardQualifiesForCorrelation(
      cardId: string,
      tier: InsightTier,
      timePeriod: TimePeriod
    ): Promise<boolean> {
      // below_nascent and nascent: correlation not available
      if (tier === 'below_nascent' || tier === 'nascent') {
        return false;
      }

      const minUses = CARD_MIN_USES[tier as keyof typeof CARD_MIN_USES];
      if (!minUses) {
        return false;
      }

      try {
        const db = await getDatabase();
        const startDate = getStartDateFromPeriod(timePeriod);

        let query: string;
        let params: (string | number)[];

        if (startDate) {
          query = 'SELECT COUNT(*) as count FROM completions WHERE card_id = ? AND completed_at >= ?';
          params = [cardId, startDate];
        } else {
          query = 'SELECT COUNT(*) as count FROM completions WHERE card_id = ?';
          params = [cardId];
        }

        const row = await db.getFirstAsync<{ count: number }>(query, params);
        const count = row?.count ?? 0;

        return count >= minUses;
      } catch (error) {
        console.warn('[TierEvaluator] Failed to check card qualification:', error);
        return false;
      }
    },
  };
}
