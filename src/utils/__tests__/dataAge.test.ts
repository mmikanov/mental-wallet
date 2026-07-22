/**
 * Unit tests for dataAge utility functions.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 2.1–2.7, 4.2, 4.3, 4.4, 5.2, 5.3, 5.4
 */

import { computeDataAge, getDisabledPeriods, formatTrackingLabel } from '../dataAge';

// --- Mocks ---

const mockGetFirstAsync = jest.fn();
const mockDb = { getFirstAsync: mockGetFirstAsync };

jest.mock('@/data/database', () => ({
  getDatabase: jest.fn(() => Promise.resolve(mockDb)),
}));

// --- computeDataAge ---

describe('computeDataAge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns dataAge: 0 and earliestDate: null when no records exist', async () => {
    mockGetFirstAsync.mockResolvedValue({ earliest: null });

    const result = await computeDataAge();

    expect(result).toEqual({ dataAge: 0, earliestDate: null });
  });

  it('returns dataAge: 0 and earliestDate: null when query returns empty row', async () => {
    mockGetFirstAsync.mockResolvedValue(null);

    const result = await computeDataAge();

    expect(result).toEqual({ dataAge: 0, earliestDate: null });
  });

  it('computes correct day count for a date 10 days ago', async () => {
    const now = new Date('2024-06-15T12:00:00.000Z');
    const earliest = '2024-06-05T08:00:00.000Z';
    mockGetFirstAsync.mockResolvedValue({ earliest });

    const result = await computeDataAge(now);

    expect(result.dataAge).toBe(10);
    expect(result.earliestDate).toEqual(new Date(earliest));
  });

  it('computes correct day count for exactly 1 day ago', async () => {
    const now = new Date('2024-06-15T12:00:00.000Z');
    const earliest = '2024-06-14T12:00:00.000Z';
    mockGetFirstAsync.mockResolvedValue({ earliest });

    const result = await computeDataAge(now);

    expect(result.dataAge).toBe(1);
  });

  it('floors partial days (23 hours = 0 days)', async () => {
    const now = new Date('2024-06-15T12:00:00.000Z');
    const earliest = '2024-06-14T13:00:00.000Z'; // 23 hours ago
    mockGetFirstAsync.mockResolvedValue({ earliest });

    const result = await computeDataAge(now);

    expect(result.dataAge).toBe(0);
  });

  it('clamps negative values to 0 (future date)', async () => {
    const now = new Date('2024-06-10T12:00:00.000Z');
    const earliest = '2024-06-15T12:00:00.000Z'; // in the future
    mockGetFirstAsync.mockResolvedValue({ earliest });

    const result = await computeDataAge(now);

    expect(result.dataAge).toBe(0);
  });

  it('returns fallback on database error', async () => {
    mockGetFirstAsync.mockRejectedValue(new Error('DB locked'));

    const result = await computeDataAge();

    expect(result).toEqual({ dataAge: 0, earliestDate: null });
  });

  it('uses current date when now param is not provided', async () => {
    const earliest = new Date(Date.now() - 5 * 86_400_000).toISOString();
    mockGetFirstAsync.mockResolvedValue({ earliest });

    const result = await computeDataAge();

    // Should be approximately 5 days (allow for test execution time)
    expect(result.dataAge).toBeGreaterThanOrEqual(4);
    expect(result.dataAge).toBeLessThanOrEqual(6);
  });
});

// --- getDisabledPeriods ---

describe('getDisabledPeriods', () => {
  it('disables 7d, 30d, 90d when dataAge is 0', () => {
    const disabled = getDisabledPeriods(0);
    expect(disabled).toContain('7d');
    expect(disabled).toContain('30d');
    expect(disabled).toContain('90d');
    expect(disabled).not.toContain('all');
  });

  it('disables 7d, 30d, 90d when dataAge is 6', () => {
    const disabled = getDisabledPeriods(6);
    expect(disabled).toContain('7d');
    expect(disabled).toContain('30d');
    expect(disabled).toContain('90d');
  });

  it('enables 7d, disables 30d and 90d when dataAge is 7', () => {
    const disabled = getDisabledPeriods(7);
    expect(disabled).not.toContain('7d');
    expect(disabled).toContain('30d');
    expect(disabled).toContain('90d');
  });

  it('enables 7d and 30d, disables 90d when dataAge is 30', () => {
    const disabled = getDisabledPeriods(30);
    expect(disabled).not.toContain('7d');
    expect(disabled).not.toContain('30d');
    expect(disabled).toContain('90d');
  });

  it('enables all bounded periods when dataAge is 90', () => {
    const disabled = getDisabledPeriods(90);
    expect(disabled).not.toContain('7d');
    expect(disabled).not.toContain('30d');
    expect(disabled).not.toContain('90d');
  });

  it('never includes "all" regardless of dataAge', () => {
    expect(getDisabledPeriods(0)).not.toContain('all');
    expect(getDisabledPeriods(3)).not.toContain('all');
    expect(getDisabledPeriods(100)).not.toContain('all');
  });
});

// --- formatTrackingLabel ---

describe('formatTrackingLabel', () => {
  it('returns null when dataAge is 0', () => {
    expect(formatTrackingLabel(0)).toBeNull();
  });

  it('returns null for negative dataAge', () => {
    expect(formatTrackingLabel(-1)).toBeNull();
  });

  it('returns singular form for dataAge of 1', () => {
    expect(formatTrackingLabel(1)).toBe('1 day of tracking');
  });

  it('returns plural form for dataAge of 2', () => {
    expect(formatTrackingLabel(2)).toBe('2 days of tracking');
  });

  it('returns plural form for larger values', () => {
    expect(formatTrackingLabel(42)).toBe('42 days of tracking');
    expect(formatTrackingLabel(365)).toBe('365 days of tracking');
  });
});

// --- Property-Based Tests (fast-check) ---

import * as fc from 'fast-check';

/**
 * Property 2: Disabled periods are exactly those whose threshold exceeds data age,
 * and "all" is never disabled.
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**
 */
describe('getDisabledPeriods — property-based tests', () => {
  const THRESHOLDS: Record<string, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
  };

  it('contains a period if and only if dataAge < threshold(period)', () => {
    fc.assert(
      fc.property(fc.nat({ max: 500 }), (dataAge) => {
        const disabled = getDisabledPeriods(dataAge);

        for (const [period, threshold] of Object.entries(THRESHOLDS)) {
          if (dataAge < threshold) {
            expect(disabled).toContain(period);
          } else {
            expect(disabled).not.toContain(period);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it('"all" is never included in the disabled list', () => {
    fc.assert(
      fc.property(fc.nat({ max: 1000 }), (dataAge) => {
        const disabled = getDisabledPeriods(dataAge);
        expect(disabled).not.toContain('all');
      }),
      { numRuns: 200 },
    );
  });

  it('returns only known period values (no unexpected entries)', () => {
    fc.assert(
      fc.property(fc.nat({ max: 500 }), (dataAge) => {
        const disabled = getDisabledPeriods(dataAge);
        const validPeriods = ['7d', '30d', '90d'];
        for (const p of disabled) {
          expect(validPeriods).toContain(p);
        }
      }),
      { numRuns: 200 },
    );
  });
});

/**
 * Property 4: Tracking label formatting is correct for all data ages
 * Validates: Requirements 4.2, 4.3, 4.4, 5.2, 5.3, 5.4
 */
describe('formatTrackingLabel — property tests', () => {
  it('returns null for dataAge of 0', () => {
    // Edge case: exactly 0
    expect(formatTrackingLabel(0)).toBeNull();
  });

  it('returns "1 day of tracking" for dataAge of 1', () => {
    // fc property: singular form holds for exactly 1
    fc.assert(
      fc.property(fc.constant(1), (dataAge) => {
        return formatTrackingLabel(dataAge) === '1 day of tracking';
      }),
    );
  });

  it('returns "${dataAge} days of tracking" for any dataAge >= 2', () => {
    // fc property: plural form holds for all integers >= 2
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 100_000 }), (dataAge) => {
        return formatTrackingLabel(dataAge) === `${dataAge} days of tracking`;
      }),
    );
  });

  it('returns null for dataAge of 0 (property)', () => {
    // fc property: zero always returns null
    fc.assert(
      fc.property(fc.constant(0), (dataAge) => {
        return formatTrackingLabel(dataAge) === null;
      }),
    );
  });

  it('never returns null for any positive dataAge', () => {
    // fc property: positive dataAge always produces a non-null string
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100_000 }), (dataAge) => {
        return formatTrackingLabel(dataAge) !== null;
      }),
    );
  });

  it('returns a string containing the dataAge number for any positive dataAge', () => {
    // fc property: the returned string always includes the numeric value
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100_000 }), (dataAge) => {
        const label = formatTrackingLabel(dataAge);
        return label !== null && label.includes(String(dataAge));
      }),
    );
  });

  it('uses "day" (singular) only when dataAge is exactly 1', () => {
    // fc property: "day" without an "s" appears only for dataAge === 1
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 100_000 }), (dataAge) => {
        const label = formatTrackingLabel(dataAge) ?? '';
        // Should contain "days", not just "day" (singular)
        return label.includes('days of tracking');
      }),
    );
  });
});
