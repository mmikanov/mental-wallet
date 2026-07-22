import * as fc from 'fast-check';
import { getTimePeriodStartDate } from '../correlationEngine';
import { TimePeriod } from '../tierEvaluator';

// Feature: usage-outcome-insights, Property 11: Time period date boundaries

describe('Feature: usage-outcome-insights, Property 11: Time period date boundaries', () => {
  /**
   * **Validates: Requirements 3.7, 5.9**
   *
   * For any TimePeriod:
   * - '7d' produces a start date exactly 7 days before now (at midnight UTC)
   * - '30d' produces exactly 30 days before
   * - '90d' produces exactly 90 days before
   * - 'all' produces null
   */

  it("'all' always returns null", () => {
    const result = getTimePeriodStartDate('all');
    expect(result).toBeNull();
  });

  it("'7d' produces a start date exactly 7 days before now at midnight UTC", () => {
    fc.assert(
      fc.property(fc.constant('7d' as TimePeriod), (period) => {
        const before = new Date();
        const result = getTimePeriodStartDate(period);
        const after = new Date();

        expect(result).not.toBeNull();
        const resultDate = new Date(result!);

        // Should be at midnight UTC
        expect(resultDate.getUTCHours()).toBe(0);
        expect(resultDate.getUTCMinutes()).toBe(0);
        expect(resultDate.getUTCSeconds()).toBe(0);
        expect(resultDate.getUTCMilliseconds()).toBe(0);

        // Should be approximately 7 days before now (within 2 seconds tolerance for test execution)
        const expectedBefore = new Date(before);
        expectedBefore.setUTCDate(expectedBefore.getUTCDate() - 7);
        expectedBefore.setUTCHours(0, 0, 0, 0);

        const expectedAfter = new Date(after);
        expectedAfter.setUTCDate(expectedAfter.getUTCDate() - 7);
        expectedAfter.setUTCHours(0, 0, 0, 0);

        // Both should be the same date (midnight is deterministic)
        expect(resultDate.getTime()).toBe(expectedBefore.getTime());
      }),
      { numRuns: 5 }
    );
  });

  it("'30d' produces a start date exactly 30 days before now at midnight UTC", () => {
    fc.assert(
      fc.property(fc.constant('30d' as TimePeriod), (period) => {
        const before = new Date();
        const result = getTimePeriodStartDate(period);

        expect(result).not.toBeNull();
        const resultDate = new Date(result!);

        // Should be at midnight UTC
        expect(resultDate.getUTCHours()).toBe(0);
        expect(resultDate.getUTCMinutes()).toBe(0);
        expect(resultDate.getUTCSeconds()).toBe(0);
        expect(resultDate.getUTCMilliseconds()).toBe(0);

        // Should be exactly 30 days before now at midnight
        const expected = new Date(before);
        expected.setUTCDate(expected.getUTCDate() - 30);
        expected.setUTCHours(0, 0, 0, 0);

        expect(resultDate.getTime()).toBe(expected.getTime());
      }),
      { numRuns: 5 }
    );
  });

  it("'90d' produces a start date exactly 90 days before now at midnight UTC", () => {
    fc.assert(
      fc.property(fc.constant('90d' as TimePeriod), (period) => {
        const before = new Date();
        const result = getTimePeriodStartDate(period);

        expect(result).not.toBeNull();
        const resultDate = new Date(result!);

        // Should be at midnight UTC
        expect(resultDate.getUTCHours()).toBe(0);
        expect(resultDate.getUTCMinutes()).toBe(0);
        expect(resultDate.getUTCSeconds()).toBe(0);
        expect(resultDate.getUTCMilliseconds()).toBe(0);

        // Should be exactly 90 days before now at midnight
        const expected = new Date(before);
        expected.setUTCDate(expected.getUTCDate() - 90);
        expected.setUTCHours(0, 0, 0, 0);

        expect(resultDate.getTime()).toBe(expected.getTime());
      }),
      { numRuns: 5 }
    );
  });

  it('for any non-all period, start date is always at midnight UTC', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('7d' as TimePeriod, '30d' as TimePeriod, '90d' as TimePeriod),
        (period) => {
          const result = getTimePeriodStartDate(period);

          expect(result).not.toBeNull();
          const resultDate = new Date(result!);

          // Always at midnight UTC
          expect(resultDate.getUTCHours()).toBe(0);
          expect(resultDate.getUTCMinutes()).toBe(0);
          expect(resultDate.getUTCSeconds()).toBe(0);
          expect(resultDate.getUTCMilliseconds()).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for any non-all period, start date is strictly in the past', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('7d' as TimePeriod, '30d' as TimePeriod, '90d' as TimePeriod),
        (period) => {
          const now = new Date();
          const result = getTimePeriodStartDate(period);

          expect(result).not.toBeNull();
          const resultDate = new Date(result!);

          expect(resultDate.getTime()).toBeLessThan(now.getTime());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('longer periods produce earlier (or equal) start dates: 90d <= 30d <= 7d', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const date7d = new Date(getTimePeriodStartDate('7d')!);
        const date30d = new Date(getTimePeriodStartDate('30d')!);
        const date90d = new Date(getTimePeriodStartDate('90d')!);

        // 90d start should be earlier than or equal to 30d
        expect(date90d.getTime()).toBeLessThanOrEqual(date30d.getTime());
        // 30d start should be earlier than or equal to 7d
        expect(date30d.getTime()).toBeLessThanOrEqual(date7d.getTime());
      }),
      { numRuns: 10 }
    );
  });

  it('the result is a valid ISO 8601 string for any non-all period', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('7d' as TimePeriod, '30d' as TimePeriod, '90d' as TimePeriod),
        (period) => {
          const result = getTimePeriodStartDate(period);

          expect(result).not.toBeNull();
          // Should parse back to the same timestamp (valid ISO 8601)
          const parsed = new Date(result!);
          expect(parsed.toISOString()).toBe(result);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('every valid TimePeriod maps to either a valid date string or null', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          '7d' as TimePeriod,
          '30d' as TimePeriod,
          '90d' as TimePeriod,
          'all' as TimePeriod
        ),
        (period) => {
          const result = getTimePeriodStartDate(period);

          if (period === 'all') {
            expect(result).toBeNull();
          } else {
            expect(result).not.toBeNull();
            expect(typeof result).toBe('string');
            // Should be a valid date
            const parsed = new Date(result!);
            expect(isNaN(parsed.getTime())).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
