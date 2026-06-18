/**
 * Unit tests for StatsRow's formatLastUsed utility function.
 */

import { formatLastUsed } from '../StatsRow';

describe('formatLastUsed', () => {
  it('returns "Never used" for null', () => {
    expect(formatLastUsed(null)).toBe('Never used');
  });

  it('returns "Today" for a date that is today', () => {
    const now = new Date();
    expect(formatLastUsed(now.toISOString())).toBe('Today');
  });

  it('returns "Yesterday" for a date that is yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatLastUsed(yesterday.toISOString())).toBe('Yesterday');
  });

  it('returns "X days ago" for dates within a week', () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    expect(formatLastUsed(threeDaysAgo.toISOString())).toBe('3 days ago');
  });

  it('returns month and day for dates older than a week', () => {
    const oldDate = new Date('2024-01-15T12:00:00Z');
    const result = formatLastUsed(oldDate.toISOString());
    // Should contain the month abbreviation and day
    expect(result).toMatch(/Jan\s*15/);
  });
});
