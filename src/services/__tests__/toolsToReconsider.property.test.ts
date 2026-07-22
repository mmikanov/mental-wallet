import * as fc from 'fast-check';
import {
  classifyEffectivenessPattern,
  computeOutcomeEffectivenessScore,
  EffectivenessPattern,
} from '../correlationEngine';

// Feature: usage-outcome-insights, Property 17: Tools to Reconsider qualification

/**
 * Pure logic representation of a tool's qualification tuple for "Tools to Reconsider".
 * This mirrors the conditions checked by getToolsToReconsider in the CorrelationEngine.
 */
interface ToolQualificationTuple {
  cardId: string;
  cardTitle: string;
  useCount: number;
  outcomeCount: number;
  effectivenessPattern: EffectivenessPattern | null;
  isKpiCard: boolean;
  isDismissed: boolean;
}

/**
 * Pure function that applies the "Tools to Reconsider" qualification rules.
 * This mirrors the filtering/sorting/limiting logic from getToolsToReconsider.
 *
 * Conditions (ALL must be met):
 * 1. useCount >= 8 (completed uses within time period)
 * 2. outcomeCount >= 5 (outcome responses within time period)
 * 3. effectivenessPattern === 'not_helping'
 * 4. isKpiCard === false (NOT the KPI card)
 * 5. isDismissed === false (NOT dismissed for current period)
 * 6. User must be at Confident tier (checked at higher level, not per-tool)
 *
 * Results sorted by useCount descending, limited to top 3.
 */
function filterToolsToReconsider(
  tools: ToolQualificationTuple[]
): ToolQualificationTuple[] {
  const qualified = tools.filter(
    (tool) =>
      tool.useCount >= 8 &&
      tool.outcomeCount >= 5 &&
      tool.effectivenessPattern === 'not_helping' &&
      !tool.isKpiCard &&
      !tool.isDismissed
  );

  // Sort by useCount descending (most-used but unhelpful = most impactful)
  qualified.sort((a, b) => b.useCount - a.useCount);

  // Limit to top 3
  return qualified.slice(0, 3);
}

describe('Feature: usage-outcome-insights, Property 17: Tools to Reconsider qualification', () => {
  /**
   * **Validates: Requirements 13.1, 13.7, 13.8**
   *
   * For any generated array of tool qualification tuples, only tuples where ALL 5
   * per-tool conditions are met should qualify for the "Tools to Reconsider" list.
   * Results must be sorted by useCount descending and limited to top 3.
   */

  // Generator for a single tool qualification tuple
  const toolTupleArb = fc.record({
    cardId: fc.uuid(),
    cardTitle: fc.string({ minLength: 1, maxLength: 30 }),
    useCount: fc.integer({ min: 0, max: 50 }),
    outcomeCount: fc.integer({ min: 0, max: 30 }),
    effectivenessPattern: fc.constantFrom(
      'not_helping' as EffectivenessPattern | null,
      'helpful_on_hard_days' as EffectivenessPattern | null,
      'reliable_booster' as EffectivenessPattern | null,
      'comfort_tool' as EffectivenessPattern | null,
      null
    ),
    isKpiCard: fc.boolean(),
    isDismissed: fc.boolean(),
  });

  it('only tools meeting ALL 5 conditions qualify', () => {
    fc.assert(
      fc.property(
        fc.array(toolTupleArb, { minLength: 0, maxLength: 20 }),
        (tools) => {
          const result = filterToolsToReconsider(tools);

          // Every tool in the result must meet ALL conditions
          for (const tool of result) {
            expect(tool.useCount).toBeGreaterThanOrEqual(8);
            expect(tool.outcomeCount).toBeGreaterThanOrEqual(5);
            expect(tool.effectivenessPattern).toBe('not_helping');
            expect(tool.isKpiCard).toBe(false);
            expect(tool.isDismissed).toBe(false);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('no qualifying tool is omitted from the result (up to the limit of 3)', () => {
    fc.assert(
      fc.property(
        fc.array(toolTupleArb, { minLength: 0, maxLength: 20 }),
        (tools) => {
          const result = filterToolsToReconsider(tools);

          // Count how many tools in the input actually qualify
          const allQualifying = tools.filter(
            (t) =>
              t.useCount >= 8 &&
              t.outcomeCount >= 5 &&
              t.effectivenessPattern === 'not_helping' &&
              !t.isKpiCard &&
              !t.isDismissed
          );

          // Result count should be min(qualifyingCount, 3)
          const expectedCount = Math.min(allQualifying.length, 3);
          expect(result.length).toBe(expectedCount);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('results are sorted by useCount descending', () => {
    fc.assert(
      fc.property(
        fc.array(toolTupleArb, { minLength: 0, maxLength: 20 }),
        (tools) => {
          const result = filterToolsToReconsider(tools);

          // Verify sort order: each item's useCount >= next item's useCount
          for (let i = 0; i < result.length - 1; i++) {
            expect(result[i].useCount).toBeGreaterThanOrEqual(
              result[i + 1].useCount
            );
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('maximum 3 results even when more tools qualify', () => {
    fc.assert(
      fc.property(
        // Generate at least 4 tools that all qualify
        fc.array(
          fc.record({
            cardId: fc.uuid(),
            cardTitle: fc.string({ minLength: 1, maxLength: 30 }),
            useCount: fc.integer({ min: 8, max: 50 }),
            outcomeCount: fc.integer({ min: 5, max: 30 }),
            effectivenessPattern: fc.constant(
              'not_helping' as EffectivenessPattern | null
            ),
            isKpiCard: fc.constant(false),
            isDismissed: fc.constant(false),
          }),
          { minLength: 4, maxLength: 15 }
        ),
        (tools) => {
          const result = filterToolsToReconsider(tools);

          // Must never exceed 3
          expect(result.length).toBeLessThanOrEqual(3);
          // And must be exactly 3 since we generated at least 4 qualifying
          expect(result.length).toBe(3);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('tools with useCount < 8 never qualify', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            cardId: fc.uuid(),
            cardTitle: fc.string({ minLength: 1, maxLength: 30 }),
            useCount: fc.integer({ min: 0, max: 7 }),
            outcomeCount: fc.integer({ min: 5, max: 30 }),
            effectivenessPattern: fc.constant(
              'not_helping' as EffectivenessPattern | null
            ),
            isKpiCard: fc.constant(false),
            isDismissed: fc.constant(false),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (tools) => {
          const result = filterToolsToReconsider(tools);
          expect(result.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('tools with outcomeCount < 5 never qualify', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            cardId: fc.uuid(),
            cardTitle: fc.string({ minLength: 1, maxLength: 30 }),
            useCount: fc.integer({ min: 8, max: 50 }),
            outcomeCount: fc.integer({ min: 0, max: 4 }),
            effectivenessPattern: fc.constant(
              'not_helping' as EffectivenessPattern | null
            ),
            isKpiCard: fc.constant(false),
            isDismissed: fc.constant(false),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (tools) => {
          const result = filterToolsToReconsider(tools);
          expect(result.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('tools not classified as not_helping never qualify', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            cardId: fc.uuid(),
            cardTitle: fc.string({ minLength: 1, maxLength: 30 }),
            useCount: fc.integer({ min: 8, max: 50 }),
            outcomeCount: fc.integer({ min: 5, max: 30 }),
            effectivenessPattern: fc.constantFrom(
              'helpful_on_hard_days' as EffectivenessPattern | null,
              'reliable_booster' as EffectivenessPattern | null,
              'comfort_tool' as EffectivenessPattern | null,
              null
            ),
            isKpiCard: fc.constant(false),
            isDismissed: fc.constant(false),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (tools) => {
          const result = filterToolsToReconsider(tools);
          expect(result.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('KPI card never qualifies regardless of other conditions', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            cardId: fc.uuid(),
            cardTitle: fc.string({ minLength: 1, maxLength: 30 }),
            useCount: fc.integer({ min: 8, max: 50 }),
            outcomeCount: fc.integer({ min: 5, max: 30 }),
            effectivenessPattern: fc.constant(
              'not_helping' as EffectivenessPattern | null
            ),
            isKpiCard: fc.constant(true),
            isDismissed: fc.constant(false),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (tools) => {
          const result = filterToolsToReconsider(tools);
          expect(result.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('dismissed tools never qualify regardless of other conditions', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            cardId: fc.uuid(),
            cardTitle: fc.string({ minLength: 1, maxLength: 30 }),
            useCount: fc.integer({ min: 8, max: 50 }),
            outcomeCount: fc.integer({ min: 5, max: 30 }),
            effectivenessPattern: fc.constant(
              'not_helping' as EffectivenessPattern | null
            ),
            isKpiCard: fc.constant(false),
            isDismissed: fc.constant(true),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (tools) => {
          const result = filterToolsToReconsider(tools);
          expect(result.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('the top 3 results are those with the highest useCount among qualifying tools', () => {
    fc.assert(
      fc.property(
        fc.array(toolTupleArb, { minLength: 0, maxLength: 20 }),
        (tools) => {
          const result = filterToolsToReconsider(tools);

          // Get all qualifying tools sorted by useCount desc
          const allQualifying = tools
            .filter(
              (t) =>
                t.useCount >= 8 &&
                t.outcomeCount >= 5 &&
                t.effectivenessPattern === 'not_helping' &&
                !t.isKpiCard &&
                !t.isDismissed
            )
            .sort((a, b) => b.useCount - a.useCount);

          // The result should be the first 3 from sorted qualifying
          const expectedTop3 = allQualifying.slice(0, 3);
          expect(result.length).toBe(expectedTop3.length);

          for (let i = 0; i < result.length; i++) {
            expect(result[i].cardId).toBe(expectedTop3[i].cardId);
            expect(result[i].useCount).toBe(expectedTop3[i].useCount);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('classifyEffectivenessPattern returns not_helping when Score_Delta <= 0.3 and OES < 0.3', () => {
    fc.assert(
      fc.property(
        // Score_Delta <= 0.3 (neutral or negative correlation)
        fc.double({ min: -5.0, max: 0.3, noNaN: true }),
        // OES < 0.3 (low effectiveness)
        fc.double({ min: 0.0, max: 0.299, noNaN: true }),
        (scoreDelta, oes) => {
          const pattern = classifyEffectivenessPattern(scoreDelta, oes);
          expect(pattern).toBe('not_helping');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('computeOutcomeEffectivenessScore returns null when fewer than 5 responses', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom(
            'calmer',
            'clear',
            'hopeful',
            'same',
            'worse',
            'other'
          ),
          { minLength: 0, maxLength: 4 }
        ),
        (categories) => {
          const score = computeOutcomeEffectivenessScore(categories);
          expect(score).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
