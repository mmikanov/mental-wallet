/**
 * Unit tests for kpiBadgeUtils pure functions.
 *
 * Validates: Requirements 2.1, 3.2, 3.4, 3.5, 6.1, 6.2, 7.1, 7.2, 7.5, 8.2, 8.5
 */

import {
  computeDaysElapsed,
  formatBadgeText,
  getBadgeFontSize,
  getBadgeWidth,
  getAccessibilityLabel,
  formatExplanationMessage,
  validateDaysAgoInput,
  computeFakeRecordTimestamp,
} from '../kpiBadgeUtils';

describe('computeDaysElapsed', () => {
  it('returns null when lastCheckInDateUtc is null', () => {
    expect(computeDaysElapsed(null)).toBeNull();
  });

  it('returns 0 when check-in was today', () => {
    const now = new Date(2024, 5, 15, 14, 30, 0); // June 15, 2024 2:30 PM
    const today = new Date(2024, 5, 15, 8, 0, 0).toISOString();
    expect(computeDaysElapsed(today, now)).toBe(0);
  });

  it('returns 1 when check-in was yesterday', () => {
    const now = new Date(2024, 5, 15, 10, 0, 0); // June 15
    const yesterday = new Date(2024, 5, 14, 22, 0, 0).toISOString();
    expect(computeDaysElapsed(yesterday, now)).toBe(1);
  });

  it('returns correct count for multiple days', () => {
    const now = new Date(2024, 5, 15, 10, 0, 0); // June 15
    const fiveDaysAgo = new Date(2024, 5, 10, 10, 0, 0).toISOString();
    expect(computeDaysElapsed(fiveDaysAgo, now)).toBe(5);
  });

  it('clamps negative values to 0', () => {
    const now = new Date(2024, 5, 10, 10, 0, 0); // June 10
    const futureDate = new Date(2024, 5, 15, 10, 0, 0).toISOString();
    expect(computeDaysElapsed(futureDate, now)).toBe(0);
  });

  it('handles cross-month boundaries', () => {
    const now = new Date(2024, 6, 2, 10, 0, 0); // July 2
    const lastCheckIn = new Date(2024, 5, 29, 10, 0, 0).toISOString(); // June 29
    expect(computeDaysElapsed(lastCheckIn, now)).toBe(3);
  });
});

describe('formatBadgeText', () => {
  it('returns string number for single digit', () => {
    expect(formatBadgeText(5)).toBe('5');
  });

  it('returns string number for two digits', () => {
    expect(formatBadgeText(42)).toBe('42');
  });

  it('returns string number for 99', () => {
    expect(formatBadgeText(99)).toBe('99');
  });

  it('returns "99+" for values over 99', () => {
    expect(formatBadgeText(100)).toBe('99+');
    expect(formatBadgeText(500)).toBe('99+');
  });
});

describe('getBadgeFontSize', () => {
  it('returns 12 for single-digit numbers', () => {
    expect(getBadgeFontSize(1)).toBe(12);
    expect(getBadgeFontSize(9)).toBe(12);
  });

  it('returns 10 for multi-digit numbers', () => {
    expect(getBadgeFontSize(10)).toBe(10);
    expect(getBadgeFontSize(99)).toBe(10);
    expect(getBadgeFontSize(100)).toBe(10);
  });
});

describe('getBadgeWidth', () => {
  it('returns 20 for single-digit numbers', () => {
    expect(getBadgeWidth(1)).toBe(20);
    expect(getBadgeWidth(9)).toBe(20);
  });

  it('returns 22 for two-digit numbers', () => {
    expect(getBadgeWidth(10)).toBe(22);
    expect(getBadgeWidth(99)).toBe(22);
  });

  it('returns 28 for values over 99', () => {
    expect(getBadgeWidth(100)).toBe(28);
    expect(getBadgeWidth(500)).toBe(28);
  });

  it('always returns at least 20', () => {
    expect(getBadgeWidth(1)).toBeGreaterThanOrEqual(20);
    expect(getBadgeWidth(50)).toBeGreaterThanOrEqual(20);
    expect(getBadgeWidth(200)).toBeGreaterThanOrEqual(20);
  });
});

describe('getAccessibilityLabel', () => {
  it('returns base label when daysElapsed is null', () => {
    expect(getAccessibilityLabel(null)).toBe("Check in on how you're doing");
  });

  it('returns base label when daysElapsed is 0', () => {
    expect(getAccessibilityLabel(0)).toBe("Check in on how you're doing");
  });

  it('appends singular "day" for 1 day', () => {
    expect(getAccessibilityLabel(1)).toBe(
      "Check in on how you're doing, 1 day since last check-in"
    );
  });

  it('appends plural "days" for 2+ days', () => {
    expect(getAccessibilityLabel(3)).toBe(
      "Check in on how you're doing, 3 days since last check-in"
    );
  });
});

describe('formatExplanationMessage', () => {
  it('returns null when daysElapsed is null', () => {
    expect(formatExplanationMessage(null)).toBeNull();
  });

  it('returns null when daysElapsed is 0', () => {
    expect(formatExplanationMessage(0)).toBeNull();
  });

  it('returns singular message for 1 day', () => {
    expect(formatExplanationMessage(1)).toBe(
      "It's been 1 day since your last check-in"
    );
  });

  it('returns plural message for 2+ days', () => {
    expect(formatExplanationMessage(5)).toBe(
      "It's been 5 days since your last check-in"
    );
  });

  it('includes the numeric count in the message', () => {
    expect(formatExplanationMessage(42)).toContain('42');
  });
});

describe('validateDaysAgoInput', () => {
  it('returns error for empty string', () => {
    expect(validateDaysAgoInput('')).toBe('Please enter a number of days');
  });

  it('returns error for whitespace-only string', () => {
    expect(validateDaysAgoInput('   ')).toBe('Please enter a number of days');
  });

  it('returns error for non-numeric input', () => {
    expect(validateDaysAgoInput('abc')).toBe('Please enter a valid number');
  });

  it('returns error for decimal input', () => {
    expect(validateDaysAgoInput('3.5')).toBe('Please enter a whole number');
  });

  it('returns error for 0', () => {
    expect(validateDaysAgoInput('0')).toBe('Must be at least 1 day');
  });

  it('returns error for negative numbers', () => {
    expect(validateDaysAgoInput('-5')).toBe('Must be at least 1 day');
  });

  it('returns null for valid positive integer', () => {
    expect(validateDaysAgoInput('1')).toBeNull();
    expect(validateDaysAgoInput('30')).toBeNull();
    expect(validateDaysAgoInput('365')).toBeNull();
  });

  it('handles leading/trailing whitespace gracefully', () => {
    expect(validateDaysAgoInput(' 7 ')).toBeNull();
  });
});

describe('computeFakeRecordTimestamp', () => {
  it('produces ISO string format', () => {
    const result = computeFakeRecordTimestamp(5);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
  });

  it('produces timestamp exactly N days before reference', () => {
    const now = new Date('2024-06-15T12:00:00.000Z');
    const result = computeFakeRecordTimestamp(3, now);
    const resultDate = new Date(result);
    const diffMs = now.getTime() - resultDate.getTime();
    const diffDays = Math.round(diffMs / 86_400_000);
    expect(diffDays).toBe(3);
  });

  it('handles 1 day ago', () => {
    const now = new Date('2024-06-15T12:00:00.000Z');
    const result = computeFakeRecordTimestamp(1, now);
    expect(result).toBe('2024-06-14T12:00:00.000Z');
  });

  it('handles large values', () => {
    const now = new Date('2024-06-15T12:00:00.000Z');
    const result = computeFakeRecordTimestamp(365, now);
    const resultDate = new Date(result);
    const diffMs = now.getTime() - resultDate.getTime();
    const diffDays = Math.round(diffMs / 86_400_000);
    expect(diffDays).toBe(365);
  });
});
