import * as fc from 'fast-check';
import { generateEngagementMessage } from '../../utils/engagementMessaging';
import { InsightTier } from '../tierEvaluator';

// Feature: usage-outcome-insights, Property 12: Engagement messaging logic

describe('Feature: usage-outcome-insights, Property 12: Engagement messaging logic', () => {
  /**
   * **Validates: Requirements 5.7**
   *
   * For any combination of (tier, currentWeekCount, previousWeekCount, rollingAverage):
   * - At Nascent/below_nascent: message always contains the current count and no comparison
   * - At Preliminary: message references comparison to previous week
   *   (positive if currentWeek > prevWeek, neutral otherwise)
   * - At Confident: message references rolling average comparison:
   *   - currentWeek >= rollingAvg → "more active" language
   *   - currentWeek < rollingAvg * 0.7 → "quieter week" language
   *   - Otherwise → simple count
   */

  const tierArb = fc.constantFrom<InsightTier>(
    'below_nascent',
    'nascent',
    'preliminary',
    'confident'
  );

  it('at Nascent/below_nascent tier: message is always a simple activity count', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<InsightTier>('below_nascent', 'nascent'),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 50 }),
        (tier, currentWeekCount, previousWeekCount, rollingAverage) => {
          const result = generateEngagementMessage(
            tier,
            currentWeekCount,
            previousWeekCount,
            rollingAverage
          );

          const count = Math.max(0, Math.floor(currentWeekCount));

          // Message must be the simple count format
          expect(result.text).toBe(
            `You've practiced ${count} times this week`
          );
          // Tier must be preserved
          expect(result.tier).toBe(tier);
          // Must NOT contain comparison language
          expect(result.text).not.toContain('more than last week');
          expect(result.text).not.toContain('every bit counts');
          expect(result.text).not.toContain('more active');
          expect(result.text).not.toContain('Quieter week');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('at Preliminary tier: positive comparison when currentWeek > prevWeek', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 99 }),
        (currentWeekCount, previousWeekCount) => {
          // Ensure currentWeek > prevWeek
          fc.pre(currentWeekCount > previousWeekCount);

          const result = generateEngagementMessage(
            'preliminary',
            currentWeekCount,
            previousWeekCount
          );

          const count = Math.max(0, Math.floor(currentWeekCount));

          expect(result.text).toBe(
            `You've used your tools ${count} times this week \u2014 that's more than last week`
          );
          expect(result.tier).toBe('preliminary');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('at Preliminary tier: neutral observation when currentWeek <= prevWeek', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (currentWeekCount, previousWeekCount) => {
          // Ensure currentWeek <= prevWeek
          fc.pre(currentWeekCount <= previousWeekCount);

          const result = generateEngagementMessage(
            'preliminary',
            currentWeekCount,
            previousWeekCount
          );

          const count = Math.max(0, Math.floor(currentWeekCount));

          expect(result.text).toBe(
            `${count} sessions this week so far \u2014 every bit counts`
          );
          expect(result.tier).toBe('preliminary');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('at Confident tier: positive reinforcement when currentWeek >= rollingAverage', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 50 }),
        (currentWeekCount, rollingAverage) => {
          const count = Math.max(0, Math.floor(currentWeekCount));
          // Ensure count >= rollingAverage
          fc.pre(count >= rollingAverage);

          const result = generateEngagementMessage(
            'confident',
            currentWeekCount,
            undefined,
            rollingAverage
          );

          expect(result.text).toBe(
            "You've been more active this week \u2014 nice work."
          );
          expect(result.tier).toBe('confident');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('at Confident tier: quieter week when currentWeek < rollingAverage * 0.7', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 2, max: 50 }),
        (currentWeekCount, rollingAverage) => {
          const count = Math.max(0, Math.floor(currentWeekCount));
          // Ensure count < rollingAverage * 0.7 AND rollingAverage > 0
          fc.pre(rollingAverage > 0 && count < rollingAverage * 0.7);

          const result = generateEngagementMessage(
            'confident',
            currentWeekCount,
            undefined,
            rollingAverage
          );

          expect(result.text).toBe(
            "Quieter week so far \u2014 that's okay too."
          );
          expect(result.tier).toBe('confident');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('at Confident tier: neutral count when between rollingAverage*0.7 and rollingAverage', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 2, max: 50 }),
        (currentWeekCount, rollingAverage) => {
          const count = Math.max(0, Math.floor(currentWeekCount));
          // Ensure count is in the "neutral zone": >= rollingAverage * 0.7 AND < rollingAverage
          fc.pre(
            rollingAverage > 0 &&
              count >= rollingAverage * 0.7 &&
              count < rollingAverage
          );

          const result = generateEngagementMessage(
            'confident',
            currentWeekCount,
            undefined,
            rollingAverage
          );

          expect(result.text).toBe(
            `You've practiced ${count} times this week`
          );
          expect(result.tier).toBe('confident');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('tier is always preserved in the returned message', () => {
    fc.assert(
      fc.property(
        tierArb,
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 50 }),
        (tier, currentWeekCount, previousWeekCount, rollingAverage) => {
          const result = generateEngagementMessage(
            tier,
            currentWeekCount,
            previousWeekCount,
            rollingAverage
          );

          expect(result.tier).toBe(tier);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('message text is always non-empty for any valid inputs', () => {
    fc.assert(
      fc.property(
        tierArb,
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 50 }),
        (tier, currentWeekCount, previousWeekCount, rollingAverage) => {
          const result = generateEngagementMessage(
            tier,
            currentWeekCount,
            previousWeekCount,
            rollingAverage
          );

          expect(result.text.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
