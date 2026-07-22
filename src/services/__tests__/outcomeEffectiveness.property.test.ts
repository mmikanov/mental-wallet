import * as fc from 'fast-check';
import {
  computeOutcomeEffectivenessScore,
  classifyEffectivenessPattern,
  POSITIVE_OUTCOME_CATEGORIES,
  EffectivenessPattern,
} from '../correlationEngine';

// Feature: usage-outcome-insights, Property 15: Outcome_Effectiveness_Score computation

describe('Feature: usage-outcome-insights, Property 15: Outcome_Effectiveness_Score computation', () => {
  /**
   * **Validates: Requirements 12.1, 12.2**
   *
   * For any set of outcome response records for a card where the total count >= 5,
   * the Outcome_Effectiveness_Score must equal:
   * count(records where category IN ('calmer', 'clear', 'hopeful')) / count(all records)
   *
   * The result must be in the range [0.0, 1.0]. When total count < 5, the score is null.
   */

  const categoryArb = fc.constantFrom(
    'calmer',
    'clear',
    'hopeful',
    'same',
    'worse',
    'energized'
  );

  it('returns null when fewer than 5 outcome responses', () => {
    fc.assert(
      fc.property(
        fc.array(categoryArb, { minLength: 0, maxLength: 4 }),
        (categories) => {
          const result = computeOutcomeEffectivenessScore(categories);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('computes OES correctly as positive count / total count when >= 5 responses', () => {
    fc.assert(
      fc.property(
        fc.array(categoryArb, { minLength: 5, maxLength: 100 }),
        (categories) => {
          const result = computeOutcomeEffectivenessScore(categories);

          // Must not be null since length >= 5
          expect(result).not.toBeNull();

          // Compute expected value
          const positiveCategories: readonly string[] = POSITIVE_OUTCOME_CATEGORIES;
          const positiveCount = categories.filter((cat) =>
            positiveCategories.includes(cat)
          ).length;
          const expected = positiveCount / categories.length;

          expect(result).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('OES is always in range [0.0, 1.0] when computed', () => {
    fc.assert(
      fc.property(
        fc.array(categoryArb, { minLength: 5, maxLength: 100 }),
        (categories) => {
          const result = computeOutcomeEffectivenessScore(categories);
          expect(result).not.toBeNull();
          expect(result!).toBeGreaterThanOrEqual(0.0);
          expect(result!).toBeLessThanOrEqual(1.0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('OES equals 1.0 when all categories are positive', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('calmer', 'clear', 'hopeful'), {
          minLength: 5,
          maxLength: 50,
        }),
        (categories) => {
          const result = computeOutcomeEffectivenessScore(categories);
          expect(result).toBe(1.0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('OES equals 0.0 when no categories are positive', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('same', 'worse', 'energized'), {
          minLength: 5,
          maxLength: 50,
        }),
        (categories) => {
          const result = computeOutcomeEffectivenessScore(categories);
          expect(result).toBe(0.0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: usage-outcome-insights, Property 16: Effectiveness pattern classification

describe('Feature: usage-outcome-insights, Property 16: Effectiveness pattern classification', () => {
  /**
   * **Validates: Requirements 12.1, 12.2**
   *
   * For any tool with a computed Score_Delta and Outcome_Effectiveness_Score (OES):
   * - 'helpful_on_hard_days' when Score_Delta <= +0.3 AND OES >= 0.6
   * - 'reliable_booster' when Score_Delta > +0.3 AND OES >= 0.6
   * - 'comfort_tool' when Score_Delta <= +0.3 AND OES >= 0.3 AND OES < 0.6
   * - 'not_helping' when Score_Delta <= +0.3 AND OES < 0.3
   * - No pattern (null) when Score_Delta > +0.3 AND OES < 0.6
   *
   * The classification must be mutually exclusive and cover all valid (Score_Delta, OES) combinations.
   */

  const scoreDeltaArb = fc.double({ min: -5, max: 5, noNaN: true });
  const oesArb = fc.double({ min: 0, max: 1, noNaN: true });

  it('returns null when OES is null', () => {
    fc.assert(
      fc.property(scoreDeltaArb, (scoreDelta) => {
        const result = classifyEffectivenessPattern(scoreDelta, null);
        expect(result).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('returns reliable_booster when Score_Delta > 0.3 AND OES >= 0.6', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.300001, max: 5, noNaN: true }),
        fc.double({ min: 0.6, max: 1, noNaN: true }),
        (scoreDelta, oes) => {
          const result = classifyEffectivenessPattern(scoreDelta, oes);
          expect(result).toBe('reliable_booster');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns null (no pattern) when Score_Delta > 0.3 AND OES < 0.6', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.300001, max: 5, noNaN: true }),
        fc.double({ min: 0, max: 0.599999, noNaN: true }),
        (scoreDelta, oes) => {
          const result = classifyEffectivenessPattern(scoreDelta, oes);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns helpful_on_hard_days when Score_Delta <= 0.3 AND OES >= 0.6', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -5, max: 0.3, noNaN: true }),
        fc.double({ min: 0.6, max: 1, noNaN: true }),
        (scoreDelta, oes) => {
          const result = classifyEffectivenessPattern(scoreDelta, oes);
          expect(result).toBe('helpful_on_hard_days');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns comfort_tool when Score_Delta <= 0.3 AND 0.3 <= OES < 0.6', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -5, max: 0.3, noNaN: true }),
        fc.double({ min: 0.3, max: 0.599999, noNaN: true }),
        (scoreDelta, oes) => {
          const result = classifyEffectivenessPattern(scoreDelta, oes);
          expect(result).toBe('comfort_tool');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns not_helping when Score_Delta <= 0.3 AND OES < 0.3', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -5, max: 0.3, noNaN: true }),
        fc.double({ min: 0, max: 0.299999, noNaN: true }),
        (scoreDelta, oes) => {
          const result = classifyEffectivenessPattern(scoreDelta, oes);
          expect(result).toBe('not_helping');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('classification is mutually exclusive and exhaustive for all valid (scoreDelta, OES) pairs', () => {
    fc.assert(
      fc.property(scoreDeltaArb, oesArb, (scoreDelta, oes) => {
        const result = classifyEffectivenessPattern(scoreDelta, oes);

        const isPositiveCorrelation = scoreDelta > 0.3;

        // Compute expected classification
        let expected: EffectivenessPattern | null;
        if (isPositiveCorrelation && oes >= 0.6) {
          expected = 'reliable_booster';
        } else if (isPositiveCorrelation && oes < 0.6) {
          expected = null;
        } else if (!isPositiveCorrelation && oes >= 0.6) {
          expected = 'helpful_on_hard_days';
        } else if (!isPositiveCorrelation && oes >= 0.3) {
          expected = 'comfort_tool';
        } else {
          expected = 'not_helping';
        }

        expect(result).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it('classification always returns a valid pattern or null', () => {
    fc.assert(
      fc.property(
        scoreDeltaArb,
        fc.oneof(oesArb, fc.constant(null as number | null)),
        (scoreDelta, oes) => {
          const result = classifyEffectivenessPattern(scoreDelta, oes);
          const validPatterns: (EffectivenessPattern | null)[] = [
            'helpful_on_hard_days',
            'reliable_booster',
            'comfort_tool',
            'not_helping',
            null,
          ];
          expect(validPatterns).toContain(result);
        }
      ),
      { numRuns: 100 }
    );
  });
});
