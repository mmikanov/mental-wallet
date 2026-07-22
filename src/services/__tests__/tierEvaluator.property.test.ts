import * as fc from 'fast-check';
import { determineTier, TIER_THRESHOLDS, InsightTier } from '../tierEvaluator';

// Feature: usage-outcome-insights, Property 7: Tier evaluation correctness

describe('Feature: usage-outcome-insights, Property 7: Tier evaluation correctness', () => {
  /**
   * **Validates: Requirements 3.3, 3.4**
   *
   * For any combination of (checkInCount, toolUseCount, distinctToolCount) where
   * all values are non-negative integers, the tier evaluator must return:
   * - 'confident' when checkInCount >= 14 AND toolUseCount >= 10 AND distinctToolCount >= 2
   * - 'preliminary' when checkInCount >= 7 AND toolUseCount >= 5 AND distinctToolCount >= 2
   *   (and Confident not met)
   * - 'nascent' when checkInCount >= 3 AND toolUseCount >= 3 (and Preliminary not met)
   * - 'below_nascent' otherwise
   *
   * The evaluator must always return the highest tier whose ALL thresholds are satisfied.
   */
  it('determineTier returns the correct tier for all random input combinations', () => {
    fc.assert(
      fc.property(
        fc.record({
          checkIns: fc.nat({ max: 100 }),
          toolUses: fc.nat({ max: 200 }),
          distinctTools: fc.nat({ max: 20 }),
        }),
        ({ checkIns, toolUses, distinctTools }) => {
          const result = determineTier(checkIns, toolUses, distinctTools);

          // Compute expected tier based on the specification
          const meetsConfident =
            checkIns >= TIER_THRESHOLDS.confident.checkIns &&
            toolUses >= TIER_THRESHOLDS.confident.toolUses &&
            distinctTools >= TIER_THRESHOLDS.confident.distinctTools;

          const meetsPreliminary =
            checkIns >= TIER_THRESHOLDS.preliminary.checkIns &&
            toolUses >= TIER_THRESHOLDS.preliminary.toolUses &&
            distinctTools >= TIER_THRESHOLDS.preliminary.distinctTools;

          const meetsNascent =
            checkIns >= TIER_THRESHOLDS.nascent.checkIns &&
            toolUses >= TIER_THRESHOLDS.nascent.toolUses;

          let expected: InsightTier;
          if (meetsConfident) {
            expected = 'confident';
          } else if (meetsPreliminary) {
            expected = 'preliminary';
          } else if (meetsNascent) {
            expected = 'nascent';
          } else {
            expected = 'below_nascent';
          }

          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('determineTier always returns the highest qualifying tier', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100 }),
        fc.nat({ max: 200 }),
        fc.nat({ max: 20 }),
        (checkIns, toolUses, distinctTools) => {
          const result = determineTier(checkIns, toolUses, distinctTools);

          const tierOrder: InsightTier[] = [
            'below_nascent',
            'nascent',
            'preliminary',
            'confident',
          ];
          const resultIdx = tierOrder.indexOf(result);

          // If result is 'confident', there should be no higher tier
          if (result === 'confident') {
            expect(
              checkIns >= TIER_THRESHOLDS.confident.checkIns &&
                toolUses >= TIER_THRESHOLDS.confident.toolUses &&
                distinctTools >= TIER_THRESHOLDS.confident.distinctTools
            ).toBe(true);
          }

          // If result is NOT 'confident', confirm confident thresholds are NOT all met
          if (result !== 'confident') {
            const meetsConfident =
              checkIns >= TIER_THRESHOLDS.confident.checkIns &&
              toolUses >= TIER_THRESHOLDS.confident.toolUses &&
              distinctTools >= TIER_THRESHOLDS.confident.distinctTools;
            expect(meetsConfident).toBe(false);
          }

          // If result is NOT 'preliminary' or higher, confirm preliminary not met
          if (resultIdx < tierOrder.indexOf('preliminary')) {
            const meetsPreliminary =
              checkIns >= TIER_THRESHOLDS.preliminary.checkIns &&
              toolUses >= TIER_THRESHOLDS.preliminary.toolUses &&
              distinctTools >= TIER_THRESHOLDS.preliminary.distinctTools;
            expect(meetsPreliminary).toBe(false);
          }

          // If result is 'below_nascent', confirm nascent not met
          if (result === 'below_nascent') {
            const meetsNascent =
              checkIns >= TIER_THRESHOLDS.nascent.checkIns &&
              toolUses >= TIER_THRESHOLDS.nascent.toolUses;
            expect(meetsNascent).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('determineTier result is always one of the four valid tiers', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100 }),
        fc.nat({ max: 200 }),
        fc.nat({ max: 20 }),
        (checkIns, toolUses, distinctTools) => {
          const result = determineTier(checkIns, toolUses, distinctTools);
          const validTiers: InsightTier[] = [
            'below_nascent',
            'nascent',
            'preliminary',
            'confident',
          ];
          expect(validTiers).toContain(result);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('determineTier handles negative inputs by clamping to 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: -200, max: 200 }),
        fc.integer({ min: -20, max: 20 }),
        (checkIns, toolUses, distinctTools) => {
          const result = determineTier(checkIns, toolUses, distinctTools);

          // The function clamps negatives to 0 internally, so compute expected
          // with clamped values
          const c = Math.max(0, checkIns);
          const t = Math.max(0, toolUses);
          const d = Math.max(0, distinctTools);

          const meetsConfident =
            c >= TIER_THRESHOLDS.confident.checkIns &&
            t >= TIER_THRESHOLDS.confident.toolUses &&
            d >= TIER_THRESHOLDS.confident.distinctTools;

          const meetsPreliminary =
            c >= TIER_THRESHOLDS.preliminary.checkIns &&
            t >= TIER_THRESHOLDS.preliminary.toolUses &&
            d >= TIER_THRESHOLDS.preliminary.distinctTools;

          const meetsNascent =
            c >= TIER_THRESHOLDS.nascent.checkIns &&
            t >= TIER_THRESHOLDS.nascent.toolUses;

          let expected: InsightTier;
          if (meetsConfident) {
            expected = 'confident';
          } else if (meetsPreliminary) {
            expected = 'preliminary';
          } else if (meetsNascent) {
            expected = 'nascent';
          } else {
            expected = 'below_nascent';
          }

          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });
});
