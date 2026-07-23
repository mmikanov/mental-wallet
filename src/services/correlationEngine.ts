/**
 * CorrelationEngine implementation.
 * Computes Tool_Outcome_Correlation (Score_Delta) per tool by comparing
 * average Daily_Check_In_Score on tool-associated days vs other days,
 * with duration weighting.
 *
 * Validates: Requirements 3.1, 3.2, 3.6, 5.6, 5.8, 6.1, 6.4, 6.5, 6.6, 6.7, 13.1, 13.7, 13.8, 3.9
 */

import { getDatabase } from '../data/database';
import { getIncludeArchivedTools } from './settingsService';
import { InsightTier, TimePeriod } from './tierEvaluator';

// --- Types ---

export type EffectivenessPattern =
  | 'helpful_on_hard_days'
  | 'reliable_booster'
  | 'comfort_tool'
  | 'not_helping';

export interface ToolCorrelationResult {
  cardId: string;
  cardTitle: string;
  scoreDelta: number;
  correlationDirection: 'positive' | 'neutral' | 'negative';
  sampleSizeToolDays: number;
  sampleSizeOtherDays: number;
  avgDurationSec: number | null;
  outcomeEffectivenessScore: number | null;
  effectivenessPattern: EffectivenessPattern | null;
  isArchived?: boolean;
}

export interface WalletCorrelationResult {
  weeklyAvgScore: number[];
  weeklyTotalDurationMin: number[];
  /** Per-bucket positive outcome rate (0–1). Null entries mean no outcome data for that bucket. */
  weeklyPositiveOutcomeRate?: (number | null)[];
  overallTrend: 'positive' | 'neutral' | 'negative';
  summaryText: string;
  granularity?: 'daily' | 'weekly';
  rangeStartDate?: string;
}

export interface BestToolEntry {
  cardId: string;
  cardTitle: string;
  scoreDelta: number;
  avgDurationSec: number;
  descriptorLabel: string;
  isHedged: boolean;
  isArchived?: boolean;
}

export interface KpiLabelChange {
  previousLabel: string;
  newLabel: string;
  changedAt: string;
}

export interface CorrelationEngine {
  /** Compute correlation for a single tool. */
  computeSingleToolCorrelation(
    cardId: string,
    timePeriod: TimePeriod
  ): Promise<ToolCorrelationResult | null>;

  /** Compute per-tool correlations for all tools with enough data. */
  computeToolCorrelations(
    timePeriod: TimePeriod
  ): Promise<ToolCorrelationResult[]>;

  /** Compute wallet-level summary for the dual-axis chart. */
  computeWalletCorrelation(timePeriod: TimePeriod, granularity?: 'daily' | 'weekly'): Promise<WalletCorrelationResult>;

  /** Get Best Tools ranking (filtered and sorted). */
  getBestTools(
    tier: InsightTier,
    timePeriod: TimePeriod
  ): Promise<BestToolEntry[]>;

  /** Get tools that qualify for "Tools to Reconsider". */
  getToolsToReconsider(
    timePeriod: TimePeriod,
    dismissedToolIds?: string[]
  ): Promise<ToolCorrelationResult[]>;

  /** Check if user has changed KPI label within the given time period. */
  detectKpiLabelChange(timePeriod: TimePeriod): Promise<KpiLabelChange | null>;

  /** Compute per-tool weekly outcome trend data for the dual-axis chart. */
  computeToolOutcomeTrend(cardId: string, startDate?: string, granularity?: 'daily' | 'weekly'): Promise<WalletCorrelationResult | null>;
}

// --- Exported Helpers ---

/**
 * Positive outcome categories for OES computation.
 */
export const POSITIVE_OUTCOME_CATEGORIES = ['calmer', 'clear', 'hopeful'] as const;

/**
 * Compute the start date (ISO 8601) for a given time period.
 * Returns null for 'all' (no lower boundary).
 */
export function getTimePeriodStartDate(period: TimePeriod): string | null {
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

/**
 * Classify Score_Delta into a correlation direction.
 * - positive: >= +0.3
 * - negative: <= -0.3
 * - neutral: between -0.3 and +0.3 (exclusive)
 */
export function classifyCorrelationDirection(
  scoreDelta: number
): 'positive' | 'neutral' | 'negative' {
  if (scoreDelta >= 0.3) {
    return 'positive';
  }
  if (scoreDelta <= -0.3) {
    return 'negative';
  }
  return 'neutral';
}

/**
 * Compute the Outcome_Effectiveness_Score for a set of outcome categories.
 * Returns null if fewer than 5 total responses.
 * OES = count(positive outcomes) / count(all outcomes)
 * Positive categories: 'calmer', 'clear', 'hopeful'
 */
export function computeOutcomeEffectivenessScore(
  outcomeCategories: string[]
): number | null {
  if (outcomeCategories.length < 5) {
    return null;
  }

  const positiveCount = outcomeCategories.filter((cat) =>
    (POSITIVE_OUTCOME_CATEGORIES as readonly string[]).includes(cat)
  ).length;

  return positiveCount / outcomeCategories.length;
}

/**
 * Classify a tool into an effectiveness pattern based on Score_Delta and OES.
 * Returns null when:
 * - OES is null (insufficient outcome data)
 * - Score_Delta > +0.3 (positive correlation) AND OES < 0.6 (no pattern for this combo)
 */
export function classifyEffectivenessPattern(
  scoreDelta: number,
  oes: number | null
): EffectivenessPattern | null {
  if (oes === null) {
    return null;
  }

  const isPositiveCorrelation = scoreDelta > 0.3;

  if (isPositiveCorrelation && oes >= 0.6) {
    return 'reliable_booster';
  }

  if (isPositiveCorrelation && oes < 0.6) {
    // No pattern for positive correlation + low effectiveness
    return null;
  }

  // Score_Delta <= +0.3 (neutral or negative correlation)
  if (oes >= 0.6) {
    return 'helpful_on_hard_days';
  }
  if (oes >= 0.3) {
    return 'comfort_tool';
  }
  return 'not_helping';
}

// --- Internal Helpers ---

/**
 * Extract the UTC date string (YYYY-MM-DD) from an ISO 8601 timestamp.
 */
function toDateString(isoTimestamp: string): string {
  // Handle both full ISO timestamps and date-only strings
  const date = new Date(isoTimestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get the previous day (D-1) as a YYYY-MM-DD string.
 */
function getPreviousDay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() - 1);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Clamp a value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Get the ISO week start date (Monday) for a given date string.
 * Returns a string key like "2024-W01" for grouping.
 */
function getWeekKey(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  // Get the Thursday of the week (ISO week algorithm)
  const day = date.getUTCDay();
  // Adjust: Sunday=0 to Monday=1-based (Mon=0, Tue=1, ..., Sun=6)
  const dayOfWeek = day === 0 ? 6 : day - 1;
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() - dayOfWeek + 3);
  const year = thursday.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const weekNumber = Math.ceil(
    ((thursday.getTime() - jan1.getTime()) / 86400000 + 1) / 7
  );
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Group values by ISO week (Mon-Sun).
 */
function groupByWeek(
  entries: { value: number; date: string }[]
): Record<string, number[]> {
  const grouped: Record<string, number[]> = {};
  for (const entry of entries) {
    const key = getWeekKey(entry.date);
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(entry.value);
  }
  return grouped;
}

/**
 * Determine overall trend from first week to last week KPI score.
 * Positive: last week avg > first week avg by 0.3+
 * Negative: last week avg < first week avg by 0.3+
 * Neutral: difference is within ±0.3
 */
function determineOverallTrend(
  weeklyAvgScore: number[]
): 'positive' | 'neutral' | 'negative' {
  if (weeklyAvgScore.length < 2) {
    return 'neutral';
  }
  const first = weeklyAvgScore[0];
  const last = weeklyAvgScore[weeklyAvgScore.length - 1];
  const diff = last - first;
  if (diff >= 0.3) {
    return 'positive';
  }
  if (diff <= -0.3) {
    return 'negative';
  }
  return 'neutral';
}

/**
 * Generate a plain-language summary for wallet-level correlation.
 * Uses hedging language as required by Req 8.
 */
function generateWalletSummaryText(
  trend: 'positive' | 'neutral' | 'negative',
  weeklyAvgScore: number[]
): string {
  if (weeklyAvgScore.length === 0) {
    return 'Not enough data to identify trends yet.';
  }
  if (weeklyAvgScore.length < 2) {
    return 'Keep checking in — patterns will emerge as you build more data.';
  }

  switch (trend) {
    case 'positive':
      return 'Weeks where you practiced more tended to have higher check-in scores.';
    case 'negative':
      return 'Your check-in scores have been slightly lower in recent weeks — many factors can influence this.';
    case 'neutral':
      return 'Your check-in scores have been relatively steady across weeks.';
  }
}

/**
 * Determine per-tool trend by comparing last 2 weekly scores vs all prior.
 * Positive: recent avg exceeds prior avg by 0.3+
 * Negative: recent avg falls below prior avg by 0.3+
 * Neutral: within ±0.3
 */
function determinePerToolTrend(
  weeklyAvgScore: number[]
): 'positive' | 'neutral' | 'negative' {
  if (weeklyAvgScore.length < 2) {
    return 'neutral';
  }

  const last2 = weeklyAvgScore.slice(-2);
  const prior = weeklyAvgScore.slice(0, -2);

  if (prior.length === 0) {
    // Only 2 weeks — compare second to first
    const diff = last2[1] - last2[0];
    if (diff >= 0.3) return 'positive';
    if (diff <= -0.3) return 'negative';
    return 'neutral';
  }

  const recentAvg = last2.reduce((s, v) => s + v, 0) / last2.length;
  const priorAvg = prior.reduce((s, v) => s + v, 0) / prior.length;
  const diff = recentAvg - priorAvg;

  if (diff >= 0.3) return 'positive';
  if (diff <= -0.3) return 'negative';
  return 'neutral';
}

/**
 * Generate plain-language summary for per-tool outcome trend.
 */
function generatePerToolSummaryText(
  trend: 'positive' | 'neutral' | 'negative'
): string {
  switch (trend) {
    case 'positive':
      return 'Your check-in scores tend to be higher in weeks where you practice this tool more.';
    case 'negative':
      return 'Your check-in scores have dipped recently on weeks you use this tool.';
    case 'neutral':
      return 'Your scores and practice time have stayed fairly steady.';
  }
}

// --- Service Implementation ---

export function createCorrelationEngine(): CorrelationEngine {
  return {
    async computeSingleToolCorrelation(
      cardId: string,
      timePeriod: TimePeriod
    ): Promise<ToolCorrelationResult | null> {
      try {
        const db = await getDatabase();
        const startDate = getTimePeriodStartDate(timePeriod);

        // 1. Fetch card title
        const cardRow = await db.getFirstAsync<{ title: string }>(
          'SELECT title FROM cards WHERE id = ?',
          [cardId]
        );
        if (!cardRow) {
          return null;
        }

        // 2. Fetch all KPI records within the time period
        let kpiQuery = 'SELECT id, value, recorded_at FROM kpi_records';
        const kpiParams: (string | number)[] = [];
        if (startDate) {
          kpiQuery += ' WHERE recorded_at >= ?';
          kpiParams.push(startDate);
        }
        const kpiRecords = await db.getAllAsync<{
          id: string;
          value: number;
          recorded_at: string;
        }>(kpiQuery, kpiParams);

        if (kpiRecords.length === 0) {
          return null;
        }

        // 3. Fetch all completions for cardId within the time period
        let completionQuery =
          'SELECT id, completed_at FROM completions WHERE card_id = ?';
        const completionParams: (string | number)[] = [cardId];
        if (startDate) {
          completionQuery += ' AND completed_at >= ?';
          completionParams.push(startDate);
        }
        const completions = await db.getAllAsync<{
          id: string;
          completed_at: string;
        }>(completionQuery, completionParams);

        if (completions.length === 0) {
          return null;
        }

        // 4. Fetch duration records for cardId within the time period
        let durationQuery =
          'SELECT active_duration_sec, started_at FROM duration_records WHERE card_id = ?';
        const durationParams: (string | number)[] = [cardId];
        if (startDate) {
          durationQuery += ' AND started_at >= ?';
          durationParams.push(startDate);
        }
        const durationRecords = await db.getAllAsync<{
          active_duration_sec: number;
          started_at: string;
        }>(durationQuery, durationParams);

        // 5. Compute card's average duration (across all completed sessions)
        const avgDurationRow = await db.getFirstAsync<{
          avg_duration: number | null;
        }>(
          `SELECT AVG(active_duration_sec) as avg_duration FROM duration_records
           WHERE card_id = ? AND end_status = 'completed'`,
          [cardId]
        );
        const cardAvgDuration = avgDurationRow?.avg_duration ?? null;

        // 6. Build tool-associated day set: for each completion day D, add D and D-1
        const toolAssociatedDays = new Set<string>();
        for (const completion of completions) {
          const day = toDateString(completion.completed_at);
          toolAssociatedDays.add(day);
          toolAssociatedDays.add(getPreviousDay(day));
        }

        // 7. Build a map of date -> longest duration for this card on that day
        const durationByDay = new Map<string, number>();
        for (const rec of durationRecords) {
          const day = toDateString(rec.started_at);
          const existing = durationByDay.get(day);
          if (existing === undefined || rec.active_duration_sec > existing) {
            durationByDay.set(day, rec.active_duration_sec);
          }
        }

        // 8. Partition KPI records into tool-day vs other-day
        const toolDayRecords: { value: number; day: string }[] = [];
        const otherDayRecords: { value: number }[] = [];

        for (const kpi of kpiRecords) {
          const day = toDateString(kpi.recorded_at);
          if (toolAssociatedDays.has(day)) {
            toolDayRecords.push({ value: kpi.value, day });
          } else {
            otherDayRecords.push({ value: kpi.value });
          }
        }

        // Cannot compute Score_Delta without both partitions having data
        if (toolDayRecords.length === 0 || otherDayRecords.length === 0) {
          return null;
        }

        // 9. Compute weighted average for tool days
        let weightedSum = 0;
        let totalWeight = 0;

        for (const record of toolDayRecords) {
          let weight = 1.0;

          if (cardAvgDuration !== null && cardAvgDuration > 0) {
            const dayDuration = durationByDay.get(record.day);
            if (dayDuration !== undefined) {
              weight = clamp(dayDuration / cardAvgDuration, 0.5, 2.0);
            }
          }

          weightedSum += record.value * weight;
          totalWeight += weight;
        }

        const weightedAvg = totalWeight > 0 ? weightedSum / totalWeight : 0;

        // 10. Compute simple average for other days
        const otherSum = otherDayRecords.reduce((sum, r) => sum + r.value, 0);
        const otherAvg = otherSum / otherDayRecords.length;

        // 11. Score_Delta
        const scoreDelta = weightedAvg - otherAvg;

        // 12. Classify direction
        const correlationDirection = classifyCorrelationDirection(scoreDelta);

        // 13. Compute average duration for this tool (for display)
        const avgDurationSec = cardAvgDuration !== null ? Math.round(cardAvgDuration) : null;

        // 14. Compute Outcome_Effectiveness_Score (OES)
        let outcomeCategories: string[] = [];
        let outcomeQuery =
          'SELECT category FROM outcome_responses WHERE card_id = ?';
        const outcomeParams: (string | number)[] = [cardId];
        if (startDate) {
          outcomeQuery += ' AND created_at >= ?';
          outcomeParams.push(startDate);
        }
        try {
          const outcomeRows = await db.getAllAsync<{ category: string }>(
            outcomeQuery,
            outcomeParams
          );
          outcomeCategories = outcomeRows.map((r) => r.category);
        } catch {
          // outcome_responses table may not exist yet; treat as no data
          outcomeCategories = [];
        }

        const outcomeEffectivenessScore =
          computeOutcomeEffectivenessScore(outcomeCategories);

        // 15. Classify effectiveness pattern
        const effectivenessPattern = classifyEffectivenessPattern(
          scoreDelta,
          outcomeEffectivenessScore
        );

        return {
          cardId,
          cardTitle: cardRow.title,
          scoreDelta,
          correlationDirection,
          sampleSizeToolDays: toolDayRecords.length,
          sampleSizeOtherDays: otherDayRecords.length,
          avgDurationSec,
          outcomeEffectivenessScore,
          effectivenessPattern,
        };
      } catch (error) {
        console.warn(
          '[CorrelationEngine] Failed to compute single tool correlation:',
          error
        );
        return null;
      }
    },

    async computeToolCorrelations(
      timePeriod: TimePeriod
    ): Promise<ToolCorrelationResult[]> {
      try {
        const db = await getDatabase();
        const startDate = getTimePeriodStartDate(timePeriod);
        const includeArchived = await getIncludeArchivedTools();

        // Query all cards that have completions in the time period (only active wallet cards unless include-archived is ON)
        // Exclude KPI card — it's the measurement instrument, not a tool to rank
        let cardsQuery =
          'SELECT DISTINCT c.card_id FROM completions c' +
          ' INNER JOIN cards ON cards.id = c.card_id' +
          ` WHERE${includeArchived ? '' : ' cards.is_archived = 0 AND'} cards.card_type != 'session_launcher'` +
          " AND (cards.source_library_id IS NULL OR cards.source_library_id != 'lib-personal-kpi')";
        const cardsParams: (string | number)[] = [];
        if (startDate) {
          cardsQuery += ' AND c.completed_at >= ?';
          cardsParams.push(startDate);
        }

        const cardRows = await db.getAllAsync<{ card_id: string }>(
          cardsQuery,
          cardsParams
        );

        if (cardRows.length === 0) {
          return [];
        }

        // Compute correlation for each card
        const results: ToolCorrelationResult[] = [];
        for (const row of cardRows) {
          const result = await this.computeSingleToolCorrelation(
            row.card_id,
            timePeriod
          );
          if (result !== null) {
            results.push(result);
          }
        }

        return results;
      } catch (error) {
        console.warn(
          '[CorrelationEngine] Failed to compute tool correlations:',
          error
        );
        return [];
      }
    },

    async computeWalletCorrelation(
      timePeriod: TimePeriod,
      granularity: 'daily' | 'weekly' = 'weekly'
    ): Promise<WalletCorrelationResult> {
      try {
        const db = await getDatabase();
        const startDate = getTimePeriodStartDate(timePeriod);
        const includeArchived = await getIncludeArchivedTools();

        // 1. Fetch all KPI records within the time period
        let kpiQuery = 'SELECT value, recorded_at FROM kpi_records';
        const kpiParams: (string | number)[] = [];
        if (startDate) {
          kpiQuery += ' WHERE recorded_at >= ?';
          kpiParams.push(startDate);
        }
        kpiQuery += ' ORDER BY recorded_at ASC';
        const kpiRecords = await db.getAllAsync<{
          value: number;
          recorded_at: string;
        }>(kpiQuery, kpiParams);

        // 2. Fetch all duration records within the time period (filter by archived status)
        let durationQuery =
          "SELECT dr.active_duration_sec, dr.started_at FROM duration_records dr" +
          " INNER JOIN cards c ON c.id = dr.card_id" +
          ` WHERE dr.end_status = 'completed'${includeArchived ? '' : ' AND c.is_archived = 0'}`;
        const durationParams: (string | number)[] = [];
        if (startDate) {
          durationQuery += ' AND dr.started_at >= ?';
          durationParams.push(startDate);
        }
        durationQuery += ' ORDER BY dr.started_at ASC';
        const durationRecords = await db.getAllAsync<{
          active_duration_sec: number;
          started_at: string;
        }>(durationQuery, durationParams);

        // --- DAILY GRANULARITY BRANCH ---
        if (granularity === 'daily') {
          // Group KPI records by date
          const kpiByDate = new Map<string, number>();
          for (const r of kpiRecords) {
            const day = toDateString(r.recorded_at);
            // Use last value for each date
            kpiByDate.set(day, r.value);
          }

          // Group duration records by date — sum all duration_sec per date
          const durationByDate = new Map<string, number>();
          for (const r of durationRecords) {
            const day = toDateString(r.started_at);
            const existing = durationByDate.get(day) ?? 0;
            durationByDate.set(day, existing + r.active_duration_sec);
          }

          // Generate all calendar dates from startDate (or earliest KPI record date) to now
          const earliestKpiDate = kpiRecords.length > 0
            ? new Date(kpiRecords[0].recorded_at)
            : null;
          const rangeStart = startDate
            ? new Date(startDate)
            : earliestKpiDate ?? new Date();
          const rangeEnd = new Date(); // now

          // Generate all date keys from rangeStart to rangeEnd
          const allDateKeys: string[] = [];
          const cursor = new Date(rangeStart);
          cursor.setUTCHours(0, 0, 0, 0);
          while (cursor <= rangeEnd) {
            allDateKeys.push(toDateString(cursor.toISOString()));
            cursor.setUTCDate(cursor.getUTCDate() + 1);
          }

          if (allDateKeys.length < 2) {
            return {
              weeklyAvgScore: [],
              weeklyTotalDurationMin: [],
              overallTrend: 'neutral',
              summaryText: 'Not enough data to identify trends yet.',
              granularity: 'daily',
            };
          }

          // Build output arrays
          const dailyScores: number[] = [];
          const dailyDurationMin: number[] = [];

          for (const dateKey of allDateKeys) {
            const score = kpiByDate.get(dateKey) ?? 0;
            const durationSec = durationByDate.get(dateKey) ?? 0;
            const durationMin = durationSec / 60;

            dailyScores.push(Math.round(score * 100) / 100);
            dailyDurationMin.push(Math.round(durationMin * 100) / 100);
          }

          // Determine overall trend using wallet-level logic (first vs last with ±0.3)
          const overallTrend = determineOverallTrend(dailyScores);

          // Generate wallet summary text
          const summaryText = generateWalletSummaryText(overallTrend, dailyScores);

          return {
            weeklyAvgScore: dailyScores,
            weeklyTotalDurationMin: dailyDurationMin,
            overallTrend,
            summaryText,
            granularity: 'daily',
            rangeStartDate: toDateString(rangeStart.toISOString()),
          };
        }

        // 3. Group records into Mon-Sun weeks
        const kpiByWeek = groupByWeek(
          kpiRecords.map((r) => ({ value: r.value, date: r.recorded_at }))
        );
        const durationByWeek = groupByWeek(
          durationRecords.map((r) => ({
            value: r.active_duration_sec,
            date: r.started_at,
          }))
        );

        // 4. Compute weekly averages for KPI scores
        const allWeekKeys = new Set([
          ...Object.keys(kpiByWeek),
          ...Object.keys(durationByWeek),
        ]);
        const sortedWeeks = Array.from(allWeekKeys).sort();

        const weeklyAvgScore: number[] = [];
        const weeklyTotalDurationMin: number[] = [];

        for (const weekKey of sortedWeeks) {
          const kpiValues = kpiByWeek[weekKey] || [];
          const durationValues = durationByWeek[weekKey] || [];

          const avgScore =
            kpiValues.length > 0
              ? kpiValues.reduce((s, v) => s + v, 0) / kpiValues.length
              : 0;
          const totalDurationMin =
            durationValues.reduce((s, v) => s + v, 0) / 60;

          weeklyAvgScore.push(Math.round(avgScore * 100) / 100);
          weeklyTotalDurationMin.push(
            Math.round(totalDurationMin * 100) / 100
          );
        }

        // 5. Determine overall trend from first week to last
        const overallTrend = determineOverallTrend(weeklyAvgScore);

        // 6. Generate summary text
        const summaryText = generateWalletSummaryText(
          overallTrend,
          weeklyAvgScore
        );

        return {
          weeklyAvgScore,
          weeklyTotalDurationMin,
          overallTrend,
          summaryText,
          granularity: 'weekly',
          rangeStartDate: startDate ?? (kpiRecords.length > 0 ? toDateString(kpiRecords[0].recorded_at) : undefined),
        };
      } catch (error) {
        console.warn(
          '[CorrelationEngine] Failed to compute wallet correlation:',
          error
        );
        return {
          weeklyAvgScore: [],
          weeklyTotalDurationMin: [],
          overallTrend: 'neutral',
          summaryText:
            'Unable to compute trends at this time.',
          granularity: 'weekly',
        };
      }
    },

    async getBestTools(
      tier: InsightTier,
      timePeriod: TimePeriod
    ): Promise<BestToolEntry[]> {
      try {
        const db = await getDatabase();
        const startDate = getTimePeriodStartDate(timePeriod);
        const includeArchived = await getIncludeArchivedTools();

        // Determine minimum uses and result limit based on tier
        const minUses = tier === 'preliminary' ? 3 : tier === 'confident' ? 5 : 0;
        const limit = tier === 'preliminary' ? 3 : tier === 'confident' ? 5 : 0;
        const isHedged = tier === 'preliminary';

        if (minUses === 0 || limit === 0) {
          // Not available for nascent or below_nascent
          return [];
        }

        // 1. Get all cards with enough completions in the time period (only active wallet cards unless include-archived is ON)
        // Exclude KPI card — it's the measurement instrument, not a tool to rank
        let completionsQuery =
          'SELECT c.card_id, COUNT(*) as use_count FROM completions c' +
          ' INNER JOIN cards ON cards.id = c.card_id' +
          ` WHERE${includeArchived ? '' : ' cards.is_archived = 0 AND'} cards.card_type != 'session_launcher'` +
          " AND (cards.source_library_id IS NULL OR cards.source_library_id != 'lib-personal-kpi')";
        const completionsParams: (string | number)[] = [];
        if (startDate) {
          completionsQuery += ' AND c.completed_at >= ?';
          completionsParams.push(startDate);
        }
        completionsQuery += ' GROUP BY c.card_id HAVING COUNT(*) >= ?';
        completionsParams.push(minUses);

        console.log('[getBestTools] includeArchived:', includeArchived);

        const qualifyingCards = await db.getAllAsync<{
          card_id: string;
          use_count: number;
        }>(completionsQuery, completionsParams);

        // Debug: log qualifying cards with their archived status
        for (const qc of qualifyingCards) {
          const cardInfo = await db.getFirstAsync<{ title: string; is_archived: number }>(
            'SELECT title, is_archived FROM cards WHERE id = ?',
            [qc.card_id]
          );
          console.log(`[getBestTools] qualifying card: "${cardInfo?.title}" is_archived=${cardInfo?.is_archived} uses=${qc.use_count}`);
        }

        if (qualifyingCards.length === 0) {
          return [];
        }

        // 2. Compute correlation for each qualifying card
        const entries: BestToolEntry[] = [];
        for (const card of qualifyingCards) {
          const result = await this.computeSingleToolCorrelation(
            card.card_id,
            timePeriod
          );
          if (result === null) {
            continue;
          }

          // Filter: exclude tools with negative Score_Delta (< 0)
          if (result.scoreDelta < 0) {
            continue;
          }

          const avgDurationSec = result.avgDurationSec ?? 0;
          const descriptorLabel = isHedged
            ? `Might be linked to +${result.scoreDelta.toFixed(1)} higher check-in days`
            : `Linked to +${result.scoreDelta.toFixed(1)} higher check-in days`;

          // Look up archived status when include-archived is ON
          let isArchived: boolean | undefined;
          if (includeArchived) {
            const archivedRow = await db.getFirstAsync<{ is_archived: number }>(
              'SELECT is_archived FROM cards WHERE id = ?',
              [card.card_id]
            );
            if (archivedRow?.is_archived === 1) {
              isArchived = true;
            }
          }

          entries.push({
            cardId: result.cardId,
            cardTitle: result.cardTitle,
            scoreDelta: result.scoreDelta,
            avgDurationSec,
            descriptorLabel,
            isHedged,
            ...(isArchived ? { isArchived } : {}),
          });
        }

        // 3. Sort by Score_Delta descending, with tiebreaker
        entries.sort((a, b) => {
          // Primary: Score_Delta descending
          const aDelta = Math.round(a.scoreDelta * 10) / 10;
          const bDelta = Math.round(b.scoreDelta * 10) / 10;
          if (aDelta !== bDelta) {
            return bDelta - aDelta;
          }

          // Tiebreaker 1: Average Active_Duration descending
          if (a.avgDurationSec !== b.avgDurationSec) {
            return b.avgDurationSec - a.avgDurationSec;
          }

          // Tiebreaker 2: Tool title alphabetically ascending
          return a.cardTitle.localeCompare(b.cardTitle);
        });

        // 4. Limit results
        return entries.slice(0, limit);
      } catch (error) {
        console.warn(
          '[CorrelationEngine] Failed to get best tools:',
          error
        );
        return [];
      }
    },

    async getToolsToReconsider(
      timePeriod: TimePeriod,
      dismissedToolIds: string[] = []
    ): Promise<ToolCorrelationResult[]> {
      try {
        const db = await getDatabase();
        const startDate = getTimePeriodStartDate(timePeriod);
        const includeArchived = await getIncludeArchivedTools();

        // 1. Find cards with >= 8 completions in the time period
        let completionsQuery =
          'SELECT c.card_id, COUNT(*) as use_count FROM completions c' +
          ' INNER JOIN cards ON cards.id = c.card_id' +
          ` WHERE${includeArchived ? '' : ' cards.is_archived = 0 AND'} cards.card_type != 'session_launcher'`;
        const completionsParams: (string | number)[] = [];
        if (startDate) {
          completionsQuery += ' AND c.completed_at >= ?';
          completionsParams.push(startDate);
        }
        completionsQuery += ' GROUP BY c.card_id HAVING COUNT(*) >= 8';

        const frequentCards = await db.getAllAsync<{
          card_id: string;
          use_count: number;
        }>(completionsQuery, completionsParams);

        if (frequentCards.length === 0) {
          return [];
        }

        // 2. Filter and compute for each card
        const results: { result: ToolCorrelationResult; useCount: number }[] = [];

        for (const card of frequentCards) {
          // Exclude dismissed tools
          if (dismissedToolIds.includes(card.card_id)) {
            continue;
          }

          // Exclude the KPI card
          const cardRow = await db.getFirstAsync<{
            source_library_id: string | null;
          }>(
            'SELECT source_library_id FROM cards WHERE id = ?',
            [card.card_id]
          );
          if (cardRow?.source_library_id === 'lib-personal-kpi') {
            continue;
          }

          // Check for >= 5 outcome_responses in the time period
          let outcomeCountQuery =
            'SELECT COUNT(*) as count FROM outcome_responses WHERE card_id = ?';
          const outcomeCountParams: (string | number)[] = [card.card_id];
          if (startDate) {
            outcomeCountQuery += ' AND created_at >= ?';
            outcomeCountParams.push(startDate);
          }

          let outcomeCount = 0;
          try {
            const outcomeRow = await db.getFirstAsync<{ count: number }>(
              outcomeCountQuery,
              outcomeCountParams
            );
            outcomeCount = outcomeRow?.count ?? 0;
          } catch {
            // outcome_responses table may not exist yet
            continue;
          }

          if (outcomeCount < 5) {
            continue;
          }

          // Compute correlation for this card
          const result = await this.computeSingleToolCorrelation(
            card.card_id,
            timePeriod
          );
          if (result === null) {
            continue;
          }

          // Only include tools classified as 'not_helping'
          if (result.effectivenessPattern !== 'not_helping') {
            continue;
          }

          // Look up archived status when include-archived is ON
          if (includeArchived) {
            const archivedRow = await db.getFirstAsync<{ is_archived: number }>(
              'SELECT is_archived FROM cards WHERE id = ?',
              [card.card_id]
            );
            if (archivedRow?.is_archived === 1) {
              result.isArchived = true;
            }
          }

          results.push({ result, useCount: card.use_count });
        }

        // 3. Sort by total uses descending
        results.sort((a, b) => b.useCount - a.useCount);

        // 4. Limit to top 3
        return results.slice(0, 3).map((r) => r.result);
      } catch (error) {
        console.warn(
          '[CorrelationEngine] Failed to get tools to reconsider:',
          error
        );
        return [];
      }
    },

    async detectKpiLabelChange(
      timePeriod: TimePeriod
    ): Promise<KpiLabelChange | null> {
      try {
        const db = await getDatabase();
        const startDate = getTimePeriodStartDate(timePeriod);

        // Read personal_kpi_history from settings table
        const row = await db.getFirstAsync<{ value: string }>(
          'SELECT value FROM settings WHERE key = ?',
          ['personal_kpi_history']
        );

        if (!row) {
          return null;
        }

        const history: Array<{
          previousValue: string;
          newValue: string;
          changedAt: string;
        }> = JSON.parse(row.value);

        if (!Array.isArray(history) || history.length === 0) {
          return null;
        }

        // Find the most recent change within the time period
        // Iterate in reverse order (most recent first)
        for (let i = history.length - 1; i >= 0; i--) {
          const entry = history[i];

          // If 'all' period, any change qualifies
          if (startDate === null) {
            return {
              previousLabel: entry.previousValue,
              newLabel: entry.newValue,
              changedAt: entry.changedAt,
            };
          }

          // Check if changedAt falls within the selected time period
          if (entry.changedAt >= startDate) {
            return {
              previousLabel: entry.previousValue,
              newLabel: entry.newValue,
              changedAt: entry.changedAt,
            };
          }
        }

        return null;
      } catch (error) {
        console.warn(
          '[CorrelationEngine] Failed to detect KPI label change:',
          error
        );
        return null;
      }
    },

    async computeToolOutcomeTrend(
      cardId: string,
      startDate?: string,
      granularity?: 'daily' | 'weekly'
    ): Promise<WalletCorrelationResult | null> {
      const effectiveGranularity = granularity ?? 'weekly';

      try {
        const db = await getDatabase();

        // 1. Fetch completions for cardId (optionally filtered by startDate)
        let completionQuery = 'SELECT id, completed_at FROM completions WHERE card_id = ?';
        const completionParams: (string | number)[] = [cardId];
        if (startDate) {
          completionQuery += ' AND completed_at >= ?';
          completionParams.push(startDate);
        }
        const completions = await db.getAllAsync<{
          id: string;
          completed_at: string;
        }>(completionQuery, completionParams);

        if (completions.length === 0) {
          return null;
        }

        // 2. Build Tool_Associated_Days set: for each completion day D, add D and D−1
        const toolAssociatedDays = new Set<string>();
        for (const completion of completions) {
          const day = toDateString(completion.completed_at);
          toolAssociatedDays.add(day);
          toolAssociatedDays.add(getPreviousDay(day));
        }

        // 3. Fetch KPI records (optionally filtered by startDate), then filter to Tool_Associated_Days
        let kpiQuery = 'SELECT value, recorded_at FROM kpi_records';
        const kpiParams: (string | number)[] = [];
        if (startDate) {
          kpiQuery += ' WHERE recorded_at >= ?';
          kpiParams.push(startDate);
        }
        kpiQuery += ' ORDER BY recorded_at ASC';
        const allKpiRecords = await db.getAllAsync<{
          value: number;
          recorded_at: string;
        }>(kpiQuery, kpiParams);

        const filteredKpiRecords = allKpiRecords.filter((r) =>
          toolAssociatedDays.has(toDateString(r.recorded_at))
        );

        if (filteredKpiRecords.length === 0) {
          return null;
        }

        // 4. Fetch duration_records for cardId with end_status = 'completed' (optionally filtered by startDate)
        let durationQuery = "SELECT active_duration_sec, started_at FROM duration_records WHERE card_id = ? AND end_status = 'completed'";
        const durationParams: (string | number)[] = [cardId];
        if (startDate) {
          durationQuery += ' AND started_at >= ?';
          durationParams.push(startDate);
        }
        durationQuery += ' ORDER BY started_at ASC';
        const durationRecords = await db.getAllAsync<{
          active_duration_sec: number;
          started_at: string;
        }>(durationQuery, durationParams);

        // 4.5 Fetch outcome_responses for this cardId (optionally filtered by startDate)
        let outcomeRecords: { category: string; created_at: string }[] = [];
        try {
          let outcomeQuery = 'SELECT category, created_at FROM outcome_responses WHERE card_id = ?';
          const outcomeParams: (string | number)[] = [cardId];
          if (startDate) {
            outcomeQuery += ' AND created_at >= ?';
            outcomeParams.push(startDate);
          }
          outcomeQuery += ' ORDER BY created_at ASC';
          outcomeRecords = await db.getAllAsync<{
            category: string;
            created_at: string;
          }>(outcomeQuery, outcomeParams);
        } catch {
          // outcome_responses table may not exist yet; proceed without outcome data
          outcomeRecords = [];
        }

        if (effectiveGranularity === 'daily') {
          // --- DAILY GRANULARITY ---
          // Group KPI records by date
          const kpiByDate = new Map<string, number>();
          for (const r of filteredKpiRecords) {
            const day = toDateString(r.recorded_at);
            // Use the last score for the day (at most one per day typically)
            kpiByDate.set(day, r.value);
          }

          // Group duration records by date
          const durationByDate = new Map<string, number>();
          for (const r of durationRecords) {
            const day = toDateString(r.started_at);
            const existing = durationByDate.get(day) ?? 0;
            durationByDate.set(day, existing + r.active_duration_sec);
          }

          // Generate all calendar dates from startDate (or earliest data) to now
          const earliestData = new Date(Math.min(
            ...completions.map(c => new Date(c.completed_at).getTime()),
            ...filteredKpiRecords.map(r => new Date(r.recorded_at).getTime())
          ));
          const rangeStart = startDate
            ? new Date(Math.max(new Date(startDate).getTime(), earliestData.getTime()))
            : earliestData;
          const rangeEnd = new Date(); // now

          // Generate all date keys from rangeStart to rangeEnd
          const allDateKeys: string[] = [];
          const cursor = new Date(rangeStart);
          cursor.setUTCHours(0, 0, 0, 0);
          while (cursor <= rangeEnd) {
            allDateKeys.push(toDateString(cursor.toISOString()));
            cursor.setUTCDate(cursor.getUTCDate() + 1);
          }

          if (allDateKeys.length < 2) {
            return null;
          }

          // Build output arrays: for each date, use KPI score directly or 0, sum duration for that day
          const dailyScores: number[] = [];
          const dailyDurationMin: number[] = [];
          const dailyPositiveOutcomeRate: (number | null)[] = [];

          // Group outcome records by date
          const outcomeByDate = new Map<string, string[]>();
          for (const r of outcomeRecords) {
            const day = toDateString(r.created_at);
            const existing = outcomeByDate.get(day) ?? [];
            existing.push(r.category);
            outcomeByDate.set(day, existing);
          }

          for (const dateKey of allDateKeys) {
            const score = kpiByDate.get(dateKey) ?? 0;
            const durationSec = durationByDate.get(dateKey) ?? 0;
            const durationMin = durationSec / 60;

            dailyScores.push(Math.round(score * 100) / 100);
            dailyDurationMin.push(Math.round(durationMin * 100) / 100);

            // Compute positive outcome rate for this day (null if no outcomes)
            const dayOutcomes = outcomeByDate.get(dateKey);
            if (dayOutcomes && dayOutcomes.length > 0) {
              const positiveCount = dayOutcomes.filter((cat) =>
                (POSITIVE_OUTCOME_CATEGORIES as readonly string[]).includes(cat)
              ).length;
              dailyPositiveOutcomeRate.push(Math.round((positiveCount / dayOutcomes.length) * 100) / 100);
            } else {
              dailyPositiveOutcomeRate.push(null);
            }
          }

          // Determine overall trend using per-tool trend logic
          const overallTrend = determinePerToolTrend(dailyScores);
          const summaryText = generatePerToolSummaryText(overallTrend);

          // Only include outcome rate if there's at least some outcome data
          const hasOutcomeData = dailyPositiveOutcomeRate.some((r) => r !== null);

          return {
            weeklyAvgScore: dailyScores,
            weeklyTotalDurationMin: dailyDurationMin,
            ...(hasOutcomeData ? { weeklyPositiveOutcomeRate: dailyPositiveOutcomeRate } : {}),
            overallTrend,
            summaryText,
            granularity: 'daily',
            rangeStartDate: toDateString(rangeStart.toISOString()),
          };
        }

        // --- WEEKLY GRANULARITY (existing behavior) ---

        // 5. Group KPI scores into Weekly_Buckets using getWeekKey()
        const kpiByWeek = groupByWeek(
          filteredKpiRecords.map((r) => ({ value: r.value, date: r.recorded_at }))
        );

        // 6. Group duration records into Weekly_Buckets using getWeekKey()
        const durationByWeek = groupByWeek(
          durationRecords.map((r) => ({
            value: r.active_duration_sec,
            date: r.started_at,
          }))
        );

        // 7. Generate weekly buckets from the earliest actual data to now.
        //    For weeks within the range where the tool wasn't used: score = 0, duration = 0.
        //    Uses the LATER of startDate and earliest data — never shows empty weeks
        //    before the user's first data point.

        // Determine the date range for week generation
        // Use the LATER of the time-period start and the earliest actual data.
        // This prevents showing empty weeks before the user's first data point.
        const earliestData = new Date(Math.min(
          ...completions.map(c => new Date(c.completed_at).getTime()),
          ...filteredKpiRecords.map(r => new Date(r.recorded_at).getTime())
        ));
        const rangeStart = startDate
          ? new Date(Math.max(new Date(startDate).getTime(), earliestData.getTime()))
          : earliestData;
        const rangeEnd = new Date(); // now

        // Generate all week keys from rangeStart to rangeEnd
        const allWeekKeys: string[] = [];
        const cursor = new Date(rangeStart);
        // Move cursor to start of its week (Monday)
        const cursorDay = cursor.getUTCDay();
        const mondayOffset = cursorDay === 0 ? -6 : 1 - cursorDay;
        cursor.setUTCDate(cursor.getUTCDate() + mondayOffset);
        cursor.setUTCHours(0, 0, 0, 0);

        while (cursor <= rangeEnd) {
          allWeekKeys.push(getWeekKey(cursor.toISOString()));
          cursor.setUTCDate(cursor.getUTCDate() + 7);
        }

        // De-duplicate (getWeekKey might produce the same key for dates in the same week)
        const uniqueWeekKeys = [...new Set(allWeekKeys)].sort();

        const weeklyAvgScore: number[] = [];
        const weeklyTotalDurationMin: number[] = [];
        const weeklyPositiveOutcomeRate: (number | null)[] = [];

        // Group outcome records by week
        const outcomeByWeek: Record<string, string[]> = {};
        for (const r of outcomeRecords) {
          const key = getWeekKey(r.created_at);
          if (!outcomeByWeek[key]) {
            outcomeByWeek[key] = [];
          }
          outcomeByWeek[key].push(r.category);
        }

        for (const weekKey of uniqueWeekKeys) {
          const kpiValues = kpiByWeek[weekKey];
          const durationValues = durationByWeek[weekKey] || [];

          const avgScore = kpiValues && kpiValues.length > 0
            ? kpiValues.reduce((s, v) => s + v, 0) / kpiValues.length
            : 0;

          const totalDurationMin = durationValues.length > 0
            ? durationValues.reduce((s, v) => s + v, 0) / 60
            : 0;

          weeklyAvgScore.push(Math.round(avgScore * 100) / 100);
          weeklyTotalDurationMin.push(
            Math.round(totalDurationMin * 100) / 100
          );

          // Compute positive outcome rate for this week (null if no outcomes)
          const weekOutcomes = outcomeByWeek[weekKey];
          if (weekOutcomes && weekOutcomes.length > 0) {
            const positiveCount = weekOutcomes.filter((cat) =>
              (POSITIVE_OUTCOME_CATEGORIES as readonly string[]).includes(cat)
            ).length;
            weeklyPositiveOutcomeRate.push(Math.round((positiveCount / weekOutcomes.length) * 100) / 100);
          } else {
            weeklyPositiveOutcomeRate.push(null);
          }
        }

        // 9. If fewer than 2 qualifying buckets exist, return null
        if (weeklyAvgScore.length < 2) {
          return null;
        }

        // 10. Determine overall trend using per-tool trend logic
        const overallTrend = determinePerToolTrend(weeklyAvgScore);

        // 11. Generate summary text based on trend direction
        const summaryText = generatePerToolSummaryText(overallTrend);

        // Only include outcome rate if there's at least some outcome data
        const hasOutcomeData = weeklyPositiveOutcomeRate.some((r) => r !== null);

        return {
          weeklyAvgScore,
          weeklyTotalDurationMin,
          ...(hasOutcomeData ? { weeklyPositiveOutcomeRate } : {}),
          overallTrend,
          summaryText,
          granularity: 'weekly',
          rangeStartDate: toDateString(rangeStart.toISOString()),
        };
      } catch (error) {
        console.warn(
          '[CorrelationEngine] Failed to compute tool outcome trend:',
          error
        );
        return null;
      }
    },
  };
}
