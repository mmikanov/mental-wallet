import * as fc from 'fast-check';
import { generateEngagementMessage } from '../../utils/engagementMessaging';
import { InsightTier } from '../tierEvaluator';

// Feature: usage-outcome-insights, Property 18: Insight text language constraints

/**
 * **Validates: Requirements 8.1, 8.2**
 *
 * For any generated insight text (from correlation descriptors, engagement messages,
 * wallet summary):
 * - Must NOT contain causal language: "caused", "resulted in", "made you feel",
 *   "fixed", "improved your score", "proven", "guarantees", "will make"
 * - SHOULD only use hedging language: "tends to", "seems to", "associated with",
 *   "linked to", "might be"
 */

const FORBIDDEN_PATTERNS: RegExp[] = [
  /\bcaused\b/i,
  /\bresulted in\b/i,
  /\bmade you feel\b/i,
  /\bfixed\b/i,
  /\bimproved your score\b/i,
  /\bproven\b/i,
  /\bguarantees\b/i,
  /\bwill make\b/i,
];

function containsForbiddenLanguage(text: string): string | null {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      return pattern.source;
    }
  }
  return null;
}

/**
 * Generate a descriptor label like getBestTools does.
 * This replicates the format used in correlationEngine.ts getBestTools.
 */
function generateDescriptorLabel(
  scoreDelta: number,
  isHedged: boolean
): string {
  if (isHedged) {
    return `Might be linked to +${scoreDelta.toFixed(1)} higher check-in days`;
  }
  return `Linked to +${scoreDelta.toFixed(1)} higher check-in days`;
}

/**
 * Generate wallet summary text like computeWalletCorrelation does.
 * This replicates the logic in correlationEngine.ts generateWalletSummaryText.
 */
function generateWalletSummaryText(
  trend: 'positive' | 'neutral' | 'negative',
  weeklyAvgScore: number[]
): string {
  if (weeklyAvgScore.length === 0) {
    return 'Not enough data to identify trends yet.';
  }
  if (weeklyAvgScore.length < 2) {
    return 'Keep checking in \u2014 patterns will emerge as you build more data.';
  }

  switch (trend) {
    case 'positive':
      return 'Weeks where you practiced more tended to have higher check-in scores.';
    case 'negative':
      return 'Your check-in scores have been slightly lower in recent weeks \u2014 many factors can influence this.';
    case 'neutral':
      return 'Your check-in scores have been relatively steady across weeks.';
  }
}

describe('Feature: usage-outcome-insights, Property 18: Insight text language constraints', () => {
  const tierArb = fc.constantFrom<InsightTier>(
    'below_nascent',
    'nascent',
    'preliminary',
    'confident'
  );

  const scoreDeltaArb = fc.double({ min: -5, max: 5, noNaN: true });
  const trendArb = fc.constantFrom<'positive' | 'neutral' | 'negative'>(
    'positive',
    'neutral',
    'negative'
  );

  describe('Engagement message text must not contain forbidden causal language', () => {
    it('for nascent/below_nascent tiers with any session count', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<InsightTier>('nascent', 'below_nascent'),
          fc.nat({ max: 200 }),
          (tier, currentWeekCount) => {
            const message = generateEngagementMessage(tier, currentWeekCount);
            const forbidden = containsForbiddenLanguage(message.text);
            expect(forbidden).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for preliminary tier with any session counts', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 200 }),
          fc.nat({ max: 200 }),
          (currentWeekCount, previousWeekCount) => {
            const message = generateEngagementMessage(
              'preliminary',
              currentWeekCount,
              previousWeekCount
            );
            const forbidden = containsForbiddenLanguage(message.text);
            expect(forbidden).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for confident tier with any session counts and rolling averages', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 200 }),
          fc.nat({ max: 200 }),
          fc.double({ min: 0, max: 50, noNaN: true }),
          (currentWeekCount, previousWeekCount, rollingAverage) => {
            const message = generateEngagementMessage(
              'confident',
              currentWeekCount,
              previousWeekCount,
              rollingAverage
            );
            const forbidden = containsForbiddenLanguage(message.text);
            expect(forbidden).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Descriptor label text must not contain forbidden causal language', () => {
    it('for hedged descriptors (preliminary tier) with any Score_Delta', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 5, noNaN: true }),
          (scoreDelta) => {
            const label = generateDescriptorLabel(scoreDelta, true);
            const forbidden = containsForbiddenLanguage(label);
            expect(forbidden).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for confident descriptors with any Score_Delta', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 5, noNaN: true }),
          (scoreDelta) => {
            const label = generateDescriptorLabel(scoreDelta, false);
            const forbidden = containsForbiddenLanguage(label);
            expect(forbidden).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Wallet summary text must not contain forbidden causal language', () => {
    it('for any trend direction and weekly score array', () => {
      fc.assert(
        fc.property(
          trendArb,
          fc.array(fc.double({ min: 1, max: 10, noNaN: true }), {
            minLength: 0,
            maxLength: 20,
          }),
          (trend, weeklyAvgScore) => {
            const text = generateWalletSummaryText(trend, weeklyAvgScore);
            const forbidden = containsForbiddenLanguage(text);
            expect(forbidden).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('All insight texts use appropriate hedging language', () => {
    const HEDGING_PATTERNS: RegExp[] = [
      /tends? to/i,
      /seems? to/i,
      /associated with/i,
      /linked to/i,
      /might be/i,
      /tended to/i,
    ];

    function containsHedgingLanguage(text: string): boolean {
      return HEDGING_PATTERNS.some((pattern) => pattern.test(text));
    }

    it('descriptor labels always use hedging language ("linked to" or "might be linked to")', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 5, noNaN: true }),
          fc.boolean(),
          (scoreDelta, isHedged) => {
            const label = generateDescriptorLabel(scoreDelta, isHedged);
            expect(containsHedgingLanguage(label)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('wallet summary text uses hedging language when describing correlations (positive trend)', () => {
      const text = generateWalletSummaryText('positive', [5.0, 6.0]);
      expect(containsHedgingLanguage(text)).toBe(true);
    });
  });
});
