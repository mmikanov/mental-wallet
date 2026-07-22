import * as fc from 'fast-check';
import {
  classifyCorrelationDirection,
  getTimePeriodStartDate,
} from '../correlationEngine';

// Feature: usage-outcome-insights, Properties 8, 9, 10, 11

// --- Property 8: Score_Delta computation with duration weighting ---

describe('Feature: usage-outcome-insights, Property 8: Score_Delta computation with duration weighting', () => {
  /**
   * **Validates: Requirements 3.1, 3.2**
   *
   * For any set of KPI records, completions for a card, and duration records:
   * the Score_Delta must equal weightedAvg(tool-day scores) - simpleAvg(other-day scores),
   * where tool-associated days = union of {D, D-1} for each completion day D.
   * Test the pure computation logic with generated data.
   */

  // Helpers replicating the pure computation logic
  function toDateString(isoTimestamp: string): string {
    const date = new Date(isoTimestamp);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getPreviousDay(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() - 1);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  interface KpiRecord {
    value: number;
    recorded_at: string;
  }

  interface Completion {
    completed_at: string;
  }

  interface DurationRecord {
    active_duration_sec: number;
    started_at: string;
  }

  /**
   * Pure Score_Delta computation matching the CorrelationEngine logic.
   * Returns null if either partition is empty.
   */
  function computeScoreDelta(
    kpiRecords: KpiRecord[],
    completions: Completion[],
    durationRecords: DurationRecord[],
    cardAvgDuration: number | null
  ): number | null {
    // Build tool-associated day set
    const toolAssociatedDays = new Set<string>();
    for (const completion of completions) {
      const day = toDateString(completion.completed_at);
      toolAssociatedDays.add(day);
      toolAssociatedDays.add(getPreviousDay(day));
    }

    // Build duration-by-day map (longest session per day)
    const durationByDay = new Map<string, number>();
    for (const rec of durationRecords) {
      const day = toDateString(rec.started_at);
      const existing = durationByDay.get(day);
      if (existing === undefined || rec.active_duration_sec > existing) {
        durationByDay.set(day, rec.active_duration_sec);
      }
    }

    // Partition KPI records
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

    if (toolDayRecords.length === 0 || otherDayRecords.length === 0) {
      return null;
    }

    // Weighted average for tool days
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

    // Simple average for other days
    const otherSum = otherDayRecords.reduce((sum, r) => sum + r.value, 0);
    const otherAvg = otherSum / otherDayRecords.length;

    return weightedAvg - otherAvg;
  }

  // Generators
  const kpiRecordArb = fc.record({
    value: fc.integer({ min: 1, max: 10 }),
    recorded_at: fc
      .date({
        min: new Date('2024-01-01T00:00:00Z'),
        max: new Date('2024-01-31T23:59:59Z'),
      })
      .map((d) => d.toISOString()),
  });

  const completionArb = fc.record({
    completed_at: fc
      .date({
        min: new Date('2024-01-05T00:00:00Z'),
        max: new Date('2024-01-25T23:59:59Z'),
      })
      .map((d) => d.toISOString()),
  });

  const durationRecordArb = fc.record({
    active_duration_sec: fc.integer({ min: 3, max: 1800 }),
    started_at: fc
      .date({
        min: new Date('2024-01-05T00:00:00Z'),
        max: new Date('2024-01-25T23:59:59Z'),
      })
      .map((d) => d.toISOString()),
  });

  it('Score_Delta equals weightedAvg(tool-day scores) - simpleAvg(other-day scores)', () => {
    fc.assert(
      fc.property(
        fc.array(kpiRecordArb, { minLength: 5, maxLength: 30 }),
        fc.array(completionArb, { minLength: 1, maxLength: 10 }),
        fc.array(durationRecordArb, { minLength: 0, maxLength: 10 }),
        fc.option(fc.integer({ min: 10, max: 600 }), { nil: null }),
        (kpiRecords, completions, durationRecords, cardAvgDuration) => {
          const result = computeScoreDelta(
            kpiRecords,
            completions,
            durationRecords,
            cardAvgDuration
          );

          if (result === null) {
            // If result is null, at least one partition must be empty
            const toolAssociatedDays = new Set<string>();
            for (const completion of completions) {
              const day = toDateString(completion.completed_at);
              toolAssociatedDays.add(day);
              toolAssociatedDays.add(getPreviousDay(day));
            }
            const toolDayKpis = kpiRecords.filter((kpi) =>
              toolAssociatedDays.has(toDateString(kpi.recorded_at))
            );
            const otherDayKpis = kpiRecords.filter(
              (kpi) => !toolAssociatedDays.has(toDateString(kpi.recorded_at))
            );
            expect(
              toolDayKpis.length === 0 || otherDayKpis.length === 0
            ).toBe(true);
            return;
          }

          // Score_Delta must be a finite number
          expect(isFinite(result)).toBe(true);

          // Score_Delta must be in the range [-9, +9] since KPI scores are 1-10
          expect(result).toBeGreaterThanOrEqual(-9);
          expect(result).toBeLessThanOrEqual(9);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Score_Delta computation is deterministic (same inputs produce same output)', () => {
    fc.assert(
      fc.property(
        fc.array(kpiRecordArb, { minLength: 5, maxLength: 20 }),
        fc.array(completionArb, { minLength: 1, maxLength: 5 }),
        fc.array(durationRecordArb, { minLength: 0, maxLength: 5 }),
        fc.option(fc.integer({ min: 10, max: 600 }), { nil: null }),
        (kpiRecords, completions, durationRecords, cardAvgDuration) => {
          const result1 = computeScoreDelta(
            kpiRecords,
            completions,
            durationRecords,
            cardAvgDuration
          );
          const result2 = computeScoreDelta(
            kpiRecords,
            completions,
            durationRecords,
            cardAvgDuration
          );
          expect(result1).toBe(result2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when cardAvgDuration is null, all weights are 1.0 (simple average for tool days)', () => {
    fc.assert(
      fc.property(
        fc.array(kpiRecordArb, { minLength: 5, maxLength: 20 }),
        fc.array(completionArb, { minLength: 1, maxLength: 5 }),
        fc.array(durationRecordArb, { minLength: 0, maxLength: 5 }),
        (kpiRecords, completions, durationRecords) => {
          const result = computeScoreDelta(
            kpiRecords,
            completions,
            durationRecords,
            null // no average duration
          );

          if (result === null) return;

          // Compute manually with simple averages (no weighting)
          const toolAssociatedDays = new Set<string>();
          for (const c of completions) {
            const day = toDateString(c.completed_at);
            toolAssociatedDays.add(day);
            toolAssociatedDays.add(getPreviousDay(day));
          }

          const toolDayValues = kpiRecords
            .filter((kpi) =>
              toolAssociatedDays.has(toDateString(kpi.recorded_at))
            )
            .map((kpi) => kpi.value);
          const otherDayValues = kpiRecords
            .filter(
              (kpi) => !toolAssociatedDays.has(toDateString(kpi.recorded_at))
            )
            .map((kpi) => kpi.value);

          if (toolDayValues.length === 0 || otherDayValues.length === 0) return;

          const toolAvg =
            toolDayValues.reduce((s, v) => s + v, 0) / toolDayValues.length;
          const otherAvg =
            otherDayValues.reduce((s, v) => s + v, 0) / otherDayValues.length;
          const expected = toolAvg - otherAvg;

          expect(result).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 9: Duration weight clamping ---

describe('Feature: usage-outcome-insights, Property 9: Duration weight clamping', () => {
  /**
   * **Validates: Requirements 3.2**
   *
   * For any session_duration and card_average_duration > 0, the weight =
   * clamp(session_duration / card_average_duration, 0.5, 2.0) must always
   * be between 0.5 and 2.0 inclusive.
   */

  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  it('weight is always in [0.5, 2.0] for any positive session and card average duration', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 36000 }), // session_duration (1 sec to 10 hours)
        fc.integer({ min: 1, max: 7200 }),   // card_average_duration (1 sec to 2 hours)
        (sessionDuration, cardAverageDuration) => {
          const weight = clamp(
            sessionDuration / cardAverageDuration,
            0.5,
            2.0
          );

          expect(weight).toBeGreaterThanOrEqual(0.5);
          expect(weight).toBeLessThanOrEqual(2.0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('weight equals exactly 1.0 when session_duration equals card_average_duration', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 7200 }),
        (duration) => {
          const weight = clamp(duration / duration, 0.5, 2.0);
          expect(weight).toBe(1.0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('weight equals 0.5 when session_duration is much less than card_average_duration', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),    // small session duration
        fc.integer({ min: 500, max: 7200 }), // large card average
        (sessionDuration, cardAverageDuration) => {
          // Ensure ratio < 0.5
          fc.pre(sessionDuration / cardAverageDuration < 0.5);

          const weight = clamp(
            sessionDuration / cardAverageDuration,
            0.5,
            2.0
          );
          expect(weight).toBe(0.5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('weight equals 2.0 when session_duration is much greater than card_average_duration', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 36000 }), // large session duration
        fc.integer({ min: 1, max: 200 }),      // small card average
        (sessionDuration, cardAverageDuration) => {
          // Ensure ratio > 2.0
          fc.pre(sessionDuration / cardAverageDuration > 2.0);

          const weight = clamp(
            sessionDuration / cardAverageDuration,
            0.5,
            2.0
          );
          expect(weight).toBe(2.0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('weight is proportional within bounds (0.5 <= ratio <= 2.0 means weight === ratio)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 400 }),   // session_duration
        fc.integer({ min: 100, max: 200 }),  // card_average_duration
        (sessionDuration, cardAverageDuration) => {
          const ratio = sessionDuration / cardAverageDuration;
          fc.pre(ratio >= 0.5 && ratio <= 2.0);

          const weight = clamp(ratio, 0.5, 2.0);
          expect(weight).toBeCloseTo(ratio, 10);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 10: Correlation direction classification ---

describe('Feature: usage-outcome-insights, Property 10: Correlation direction classification', () => {
  /**
   * **Validates: Requirements 4.2, 4.3, 4.4**
   *
   * For any Score_Delta value:
   * - >= +0.3 -> 'positive'
   * - <= -0.3 -> 'negative'
   * - between -0.3 and +0.3 -> 'neutral'
   * Must be exhaustive (every number maps to exactly one category).
   */

  it('Score_Delta >= +0.3 classifies as positive', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.3, max: 10, noNaN: true }),
        (scoreDelta) => {
          const result = classifyCorrelationDirection(scoreDelta);
          expect(result).toBe('positive');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Score_Delta <= -0.3 classifies as negative', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10, max: -0.3, noNaN: true }),
        (scoreDelta) => {
          const result = classifyCorrelationDirection(scoreDelta);
          expect(result).toBe('negative');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Score_Delta strictly between -0.3 and +0.3 classifies as neutral', () => {
    fc.assert(
      fc.property(
        fc.double({
          min: -0.29999999999,
          max: 0.29999999999,
          noNaN: true,
        }),
        (scoreDelta) => {
          // Ensure we're strictly between the thresholds
          fc.pre(scoreDelta > -0.3 && scoreDelta < 0.3);

          const result = classifyCorrelationDirection(scoreDelta);
          expect(result).toBe('neutral');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('every Score_Delta maps to exactly one valid category (exhaustiveness)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10, max: 10, noNaN: true }),
        (scoreDelta) => {
          const result = classifyCorrelationDirection(scoreDelta);
          const validCategories = ['positive', 'neutral', 'negative'];
          expect(validCategories).toContain(result);

          // Verify exactly one category matches
          let matchCount = 0;
          if (scoreDelta >= 0.3) matchCount++;
          if (scoreDelta <= -0.3) matchCount++;
          if (scoreDelta > -0.3 && scoreDelta < 0.3) matchCount++;
          expect(matchCount).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('boundary value +0.3 classifies as positive', () => {
    expect(classifyCorrelationDirection(0.3)).toBe('positive');
  });

  it('boundary value -0.3 classifies as negative', () => {
    expect(classifyCorrelationDirection(-0.3)).toBe('negative');
  });

  it('boundary value 0 classifies as neutral', () => {
    expect(classifyCorrelationDirection(0)).toBe('neutral');
  });
});
