/**
 * Property-based tests for computeDaysElapsed utility.
 *
 * Property 1: Calendar day computation is correct
 *
 * **Validates: Requirements 2.1**
 */

import * as fc from 'fast-check';
import { computeDaysElapsed } from '../kpiBadgeUtils';

/**
 * Computes the expected calendar day difference by stripping time
 * from both dates in local time and dividing the ms difference by 86400000.
 */
function expectedCalendarDayDiff(lastCheckInUtc: string, now: Date): number {
  const lastDate = new Date(lastCheckInUtc);
  const lastLocalDate = new Date(
    lastDate.getFullYear(),
    lastDate.getMonth(),
    lastDate.getDate()
  );
  const nowLocalDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const diffMs = nowLocalDate.getTime() - lastLocalDate.getTime();
  return Math.round(diffMs / 86_400_000);
}

describe('computeDaysElapsed - Property 1: Calendar day computation is correct', () => {
  it('result is never negative for any pair of dates', () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date('2000-01-01T00:00:00.000Z'),
          max: new Date('2030-12-31T23:59:59.999Z'),
        }),
        fc.date({
          min: new Date('2000-01-01T00:00:00.000Z'),
          max: new Date('2030-12-31T23:59:59.999Z'),
        }),
        (lastCheckIn, now) => {
          const result = computeDaysElapsed(lastCheckIn.toISOString(), now);
          expect(result).not.toBeNull();
          expect(result).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('equals expected calendar day difference in local time when now >= lastCheckIn', () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date('2000-01-01T00:00:00.000Z'),
          max: new Date('2030-12-31T23:59:59.999Z'),
        }),
        fc.integer({ min: 0, max: 1000 }),
        (lastCheckIn, extraDays) => {
          // Construct `now` to be at least `extraDays` days after lastCheckIn
          const now = new Date(
            lastCheckIn.getTime() + extraDays * 86_400_000
          );

          const result = computeDaysElapsed(lastCheckIn.toISOString(), now);
          const expected = expectedCalendarDayDiff(
            lastCheckIn.toISOString(),
            now
          );

          expect(result).toBe(Math.max(0, expected));
        }
      ),
      { numRuns: 200 }
    );
  });

  it('returns null when lastCheckInDateUtc is null', () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date('2000-01-01T00:00:00.000Z'),
          max: new Date('2030-12-31T23:59:59.999Z'),
        }),
        (now) => {
          const result = computeDaysElapsed(null, now);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('returns 0 when lastCheckIn and now are on the same local calendar day', () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date('2000-01-01T00:00:00.000Z'),
          max: new Date('2030-12-31T00:00:00.000Z'),
        }),
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 59 }),
        (baseDate, h1, m1, s1, h2, m2, s2) => {
          // Both dates on the same local calendar day but different times
          const localDate = new Date(
            baseDate.getFullYear(),
            baseDate.getMonth(),
            baseDate.getDate()
          );

          const lastCheckIn = new Date(localDate);
          lastCheckIn.setHours(h1, m1, s1, 0);

          const now = new Date(localDate);
          now.setHours(h2, m2, s2, 0);

          const result = computeDaysElapsed(lastCheckIn.toISOString(), now);
          expect(result).toBe(0);
        }
      ),
      { numRuns: 150 }
    );
  });
});


/**
 * Property-based tests for formatExplanationMessage.
 *
 * Property 6: Explanation message formatting and visibility
 *
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.5**
 *
 * For any daysElapsed >= 1, formatExplanationMessage SHALL return a non-null string
 * containing the numeric count and the correct singular/plural form.
 * For daysElapsed = 0 or null, it SHALL return null.
 */

import { formatExplanationMessage } from '../kpiBadgeUtils';

describe('formatExplanationMessage - Property 6: Explanation message formatting and visibility', () => {
  it('returns a non-null string for any daysElapsed in [1, 999]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999 }),
        (n) => {
          const result = formatExplanationMessage(n);
          expect(result).not.toBeNull();
          expect(typeof result).toBe('string');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('result contains the numeric count as a string for any daysElapsed in [1, 999]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999 }),
        (n) => {
          const result = formatExplanationMessage(n)!;
          expect(result).toContain(String(n));
        }
      ),
      { numRuns: 200 }
    );
  });

  it('uses singular "day" (not "days") when daysElapsed is 1', () => {
    const result = formatExplanationMessage(1)!;
    expect(result).toMatch(/\bday\b/);
    expect(result).not.toMatch(/\bdays\b/);
  });

  it('uses plural "days" for any daysElapsed >= 2', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 999 }),
        (n) => {
          const result = formatExplanationMessage(n)!;
          expect(result).toMatch(/\bdays\b/);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('returns null for daysElapsed = 0', () => {
    expect(formatExplanationMessage(0)).toBeNull();
  });

  it('returns null for daysElapsed = null', () => {
    expect(formatExplanationMessage(null)).toBeNull();
  });
});


/**
 * Property-based tests for validateDaysAgoInput.
 *
 * Property 7: Admin days-ago input validation
 *
 * **Validates: Requirements 8.5**
 *
 * For any string representing a non-positive number (0 or negative),
 * a non-numeric value, an empty/whitespace string, or a decimal,
 * validateDaysAgoInput SHALL return a non-null error message.
 * For any string representing a positive integer (1 or greater),
 * it SHALL return null.
 */

import { validateDaysAgoInput, computeFakeRecordTimestamp } from '../kpiBadgeUtils';

describe('validateDaysAgoInput - Property 7: Admin days-ago input validation', () => {
  it('returns null for any positive integer stringified', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }),
        (n) => {
          expect(validateDaysAgoInput(String(n))).toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('returns non-null error for "0"', () => {
    expect(validateDaysAgoInput('0')).not.toBeNull();
  });

  it('returns non-null error for any negative integer stringified', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10_000, max: -1 }),
        (n) => {
          expect(validateDaysAgoInput(String(n))).not.toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('returns non-null error for non-numeric strings', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => isNaN(Number(s.trim()))),
        (s) => {
          expect(validateDaysAgoInput(s)).not.toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('returns non-null error for decimal numbers stringified', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 10_000, noNaN: true, noDefaultInfinity: true })
          .filter((n) => !Number.isInteger(n)),
        (n) => {
          expect(validateDaysAgoInput(String(n))).not.toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('returns non-null error for empty string', () => {
    expect(validateDaysAgoInput('')).not.toBeNull();
  });
});


/**
 * Property-based tests for computeFakeRecordTimestamp.
 *
 * Property 8: Fake record timestamp computation
 *
 * **Validates: Requirements 8.2**
 *
 * For any positive integer daysAgo and reference date now,
 * computeFakeRecordTimestamp(daysAgo, now) SHALL produce a UTC ISO timestamp
 * such that the calendar day difference between the resulting timestamp
 * and now equals exactly daysAgo.
 */

describe('computeFakeRecordTimestamp - Property 8: Fake record timestamp computation', () => {
  it('calendar day difference equals exactly daysAgo for any positive integer and reference date', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.date({
          min: new Date('2005-01-01T00:00:00.000Z'),
          max: new Date('2030-12-31T23:59:59.999Z'),
        }),
        (daysAgo, now) => {
          const result = computeFakeRecordTimestamp(daysAgo, now);
          const resultDate = new Date(result);

          // Compute calendar day difference in local time
          const resultLocal = new Date(
            resultDate.getFullYear(),
            resultDate.getMonth(),
            resultDate.getDate()
          );
          const nowLocal = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          );
          const diffMs = nowLocal.getTime() - resultLocal.getTime();
          const diffDays = Math.round(diffMs / 86_400_000);

          expect(diffDays).toBe(daysAgo);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('result is a valid ISO 8601 string parseable by new Date()', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.date({
          min: new Date('2005-01-01T00:00:00.000Z'),
          max: new Date('2030-12-31T23:59:59.999Z'),
        }),
        (daysAgo, now) => {
          const result = computeFakeRecordTimestamp(daysAgo, now);
          const parsed = new Date(result);
          expect(parsed.getTime()).not.toBeNaN();
          // ISO string should round-trip
          expect(parsed.toISOString()).toBe(result);
        }
      ),
      { numRuns: 200 }
    );
  });
});
